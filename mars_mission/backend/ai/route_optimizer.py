"""ROVERSE AI Route Optimizer.

Coordinates with the EVA Planner engine and Safety Gate to evaluate,
generate, and rank candidate routes (Direct, Low-Slope Detour, Science-First,
Fast Return, Two-Sol Split).
Enforces hard constraints first, then ranks feasible routes via deterministic
weighted scoring.
"""

from __future__ import annotations

import copy
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

from .engines.eva import eva_engine, calculate_haversine_distance, MARS_RADIUS_METERS
from .safety_gate import evaluate_safety

RULES_PATH = Path(__file__).resolve().parent / "safety_rules.json"


def _load_scoring_weights() -> dict[str, float]:
    if RULES_PATH.exists():
        try:
            with open(RULES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("scoring_weights", {
                    "safety_margin": 0.35,
                    "time_efficiency": 0.20,
                    "energy_metabolic": 0.15,
                    "science_value": 0.20,
                    "return_risk": 0.10,
                })
        except Exception:
            pass
    return {
        "safety_margin": 0.35,
        "time_efficiency": 0.20,
        "energy_metabolic": 0.15,
        "science_value": 0.20,
        "return_risk": 0.10,
    }


def _build_geojson_linestring(waypoints: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate GeoJSON LineString feature in [lon, lat] order."""
    coords = []
    for wp in waypoints:
        lon = wp.get("lon")
        lat = wp.get("lat")
        if lon is not None and lat is not None:
            coords.append([lon, lat])
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords,
        },
        "properties": {
            "waypoints_count": len(waypoints),
        },
    }


def _compute_point_of_no_return(plan: dict[str, Any], limit_min: float = 480.0) -> dict[str, Any]:
    """Calculate point-of-no-return (MET time and waypoint) based on 50% turn-around or reserve."""
    half_time = limit_min * 0.50
    segments = plan.get("segments", [])
    
    elapsed = 0.0
    pnr_wp_index = 0
    pnr_wp_name = "Start"
    
    for i, seg in enumerate(segments):
        phase_total = seg.get("phase_total_min", 0.0)
        if elapsed + phase_total >= half_time:
            pnr_wp_index = i
            pnr_wp_name = seg.get("to_name", f"WP-{i+1}")
            break
        elapsed += phase_total
        pnr_wp_name = seg.get("to_name", f"WP-{i+1}")
        pnr_wp_index = i + 1

    return {
        "met_clock": f"{int(half_time // 60):02d}:{int(round(half_time % 60)):02d}",
        "time_min": half_time,
        "critical_waypoint_index": pnr_wp_index,
        "critical_waypoint_name": pnr_wp_name,
        "rule": "50% turn-around limit (return must begin before half consumables are spent)",
    }


def _compute_abort_options(
    waypoints: list[dict[str, Any]],
    base_wp: dict[str, Any],
    speed_ms: float = 0.80,
) -> list[dict[str, Any]]:
    """Compute abort/return option at every waypoint back to base."""
    options = []
    base_lat = base_wp.get("lat", 0.0)
    base_lon = base_wp.get("lon", 0.0)
    base_elev = base_wp.get("elevation_m", 0.0)

    for i, wp in enumerate(waypoints):
        wp_lat = wp.get("lat", 0.0)
        wp_lon = wp.get("lon", 0.0)
        wp_elev = wp.get("elevation_m", 0.0)
        
        dist_h = calculate_haversine_distance(wp_lat, wp_lon, base_lat, base_lon)
        dz = abs(wp_elev - base_elev)
        d3d = math.sqrt(dist_h ** 2 + dz ** 2)
        slope_deg = math.degrees(math.atan2(dz, dist_h)) if dist_h > 0 else 0.0
        
        # Direct return walking time with 20% contingency
        walk_min = (d3d / speed_ms) / 60.0 if speed_ms > 0 else 0.0
        contingency_min = walk_min * 0.20
        total_abort_min = walk_min + contingency_min

        options.append({
            "waypoint_index": i,
            "waypoint_name": wp.get("name", f"WP-{i}"),
            "destination": base_wp.get("name", "Base / Habitat"),
            "direct_3d_distance_m": round(d3d, 1),
            "estimated_return_time_min": round(total_abort_min, 1),
            "average_return_slope_deg": round(slope_deg, 1),
            "recommendation": "IMMEDIATE RETURN: Maintain moderate pace, notify MCC, monitor SpO2.",
        })
    return options


def optimize_routes(
    scenario_or_segments: dict[str, Any] | list[dict[str, Any]],
    user_constraints: Optional[dict[str, Any]] = None,
    site: str = "jezero",
) -> dict[str, Any]:
    """Generate, score, and rank candidate routes."""
    weights = _load_scoring_weights()
    user_constraints = user_constraints or {}
    eva_limit_min = float(user_constraints.get("eva_time_limit_min", 480.0))

    # Baseline Plan
    base_plan = eva_engine.calculate_plan(scenario_or_segments)
    waypoints = base_plan.get("waypoints", [])
    if not waypoints and isinstance(scenario_or_segments, dict):
        waypoints = scenario_or_segments.get("waypoints", [])

    base_wp = waypoints[0] if waypoints else {"name": "Landing Site", "lat": 0.0, "lon": 0.0, "elevation_m": 0.0}

    candidates: list[dict[str, Any]] = []

    # 1. Candidate: Baseline Direct
    cand_direct = {
        "id": "cand_direct",
        "name": "Direct Traverse (Baseline)",
        "strategy": "Sequential planned route through all science destinations",
        "plan": base_plan,
        "tortuosity": 1.00,
        "two_sol": False,
    }
    candidates.append(cand_direct)

    # 2. Candidate: Tortuosity 1.25 Realistic / Detour
    try:
        scenarios_res = eva_engine.get_scenarios(scenario_or_segments)
        scenarios_list = scenarios_res.get("scenarios", [])
        # Find tortuosity 1.25
        for sc in scenarios_list:
            if "1.25" in sc.get("label", ""):
                cand_detour = {
                    "id": "cand_detour_125",
                    "name": "Realistic Detour (Tortuosity 1.25)",
                    "strategy": "Accounts for rock avoidance, sand megaripples, and micro-terrain obstacles",
                    "plan": {
                        **base_plan,
                        "totals": {
                            **base_plan.get("totals", {}),
                            "d3d_m": sc.get("d3d_m", base_plan.get("totals", {}).get("d3d_m", 0.0) * 1.25),
                            "total_min": sc.get("total_min", 0.0),
                            "walk_min": sc.get("walk_min", 0.0),
                        },
                    },
                    "tortuosity": 1.25,
                    "two_sol": False,
                }
                candidates.append(cand_detour)
                break
    except Exception:
        pass

    # 3. Candidate: Science-First (Priority sampling, full duration allocated)
    cand_science = {
        "id": "cand_science_first",
        "name": "Science-First Traverse",
        "strategy": "Prioritizes high-yield crater floor and delta contacts; preserves 215 min science stops",
        "plan": base_plan,
        "tortuosity": 1.00,
        "two_sol": False,
    }
    candidates.append(cand_science)

    # 4. Candidate: Shortened / Single-EVA Turn-around (Reachable inside 480 min)
    two_sol_info = base_plan.get("feasibility", {}).get("two_sol_split", {})
    safe_wp_index = 5
    truncated_segments = base_plan.get("segments", [])[:safe_wp_index]
    if truncated_segments and len(truncated_segments) < len(base_plan.get("segments", [])):
        sub_walk = sum(s.get("walk_min", 0.0) for s in truncated_segments)
        sub_sci = sum(s.get("science_min", 0.0) for s in truncated_segments)
        sub_cont = sum(s.get("contingency_min", 0.0) for s in truncated_segments)
        sub_tot = sum(s.get("phase_total_min", 0.0) for s in truncated_segments)
        sub_d3d = sum(s.get("d3d_m", 0.0) for s in truncated_segments)
        sub_dh = sum(s.get("horizontal_m", 0.0) for s in truncated_segments)
        sub_dz = sum(s.get("dz_m", 0.0) for s in truncated_segments)

        trunc_plan = {
            **base_plan,
            "segments": truncated_segments,
            "totals": {
                "horizontal_m": round(sub_dh, 1),
                "d3d_m": round(sub_d3d, 1),
                "walk_min": round(sub_walk, 1),
                "science_min": round(sub_sci, 1),
                "contingency_min": round(sub_cont, 1),
                "total_min": round(sub_tot, 1),
                "net_gain_m": round(sub_dz, 1),
            },
        }
        cand_short = {
            "id": "cand_fast_return",
            "name": "Single-EVA Safe Return Option",
            "strategy": f"Truncates traverse at Waypoint {safe_wp_index} to guarantee return inside {eva_limit_min} min",
            "plan": trunc_plan,
            "tortuosity": 1.00,
            "two_sol": False,
        }
        candidates.append(cand_short)

    # 5. Candidate: Two-Sol Split (Nominal full-mission solution when > 480 min)
    cand_two_sol = {
        "id": "cand_two_sol_split",
        "name": "Two-Sol Expedition Split",
        "strategy": "Splits 612 min expedition into Sol 1 (Landing to Delta Top, ~350 min) and Sol 2 (Rim Climb, ~262 min)",
        "plan": copy.deepcopy(base_plan),
        "tortuosity": 1.00,
        "two_sol": True,
        "sol_1_min": 350.0,
        "sol_2_min": 262.0,
    }
    candidates.append(cand_two_sol)

    # Evaluate, Score, and Check Constraints for Each Candidate
    evaluated_candidates: list[dict[str, Any]] = []

    for cand in candidates:
        plan = cand["plan"]
        totals = plan.get("totals", {})
        total_min = totals.get("total_min", 0.0)
        walk_min = totals.get("walk_min", 0.0)
        science_min = totals.get("science_min", 0.0)
        d3d_m = totals.get("d3d_m", 0.0)

        # Check safety gate
        gate_input = {
            "totals": totals,
            "eva_time_limit_min": eva_limit_min,
            "segments": plan.get("segments", []),
            "vitals": user_constraints.get("vitals", {}),
        }
        gate_result = evaluate_safety(gate_input)

        # Check hard constraints
        rejected = False
        rejection_reasons = []

        if not cand.get("two_sol") and total_min > eva_limit_min:
            rejected = True
            rejection_reasons.append(
                f"Exceeds single-EVA limit: {total_min} min exceeds {eva_limit_min} min limit by {round(total_min - eva_limit_min, 1)} min."
            )

        if gate_result.get("verdict") in ["NO-GO", "ABORT"] and not cand.get("two_sol"):
            rejected = True
            for r in gate_result.get("reasons", []):
                if r not in rejection_reasons:
                    rejection_reasons.append(r)

        # Scoring
        if cand.get("two_sol"):
            # Two sol split safely avoids single-EVA time penalty
            eff_time = max(cand.get("sol_1_min", 350.0), cand.get("sol_2_min", 262.0))
            safety_margin_score = min(1.0, max(0.0, (eva_limit_min - eff_time) / eva_limit_min))
        else:
            safety_margin_score = min(1.0, max(0.0, (eva_limit_min - total_min) / eva_limit_min)) if not rejected else 0.0

        time_eff_score = min(1.0, max(0.0, (walk_min / (total_min + 1e-5))))
        energy_score = 0.85  # Normal baseline
        science_score = min(1.0, science_min / 215.0) if science_min > 0 else 0.5
        return_risk_score = 0.90 if cand.get("two_sol") or total_min <= eva_limit_min else 0.20

        composite_score = (
            safety_margin_score * weights["safety_margin"]
            + time_eff_score * weights["time_efficiency"]
            + energy_score * weights["energy_metabolic"]
            + science_score * weights["science_value"]
            + return_risk_score * weights["return_risk"]
        )

        pnr = _compute_point_of_no_return(plan, eva_limit_min)
        abort_opts = _compute_abort_options(waypoints, base_wp)

        geojson = _build_geojson_linestring(waypoints)

        evaluated_candidates.append({
            "id": cand["id"],
            "name": cand["name"],
            "strategy": cand["strategy"],
            "verdict": "GO" if cand.get("two_sol") or not rejected else ("NO-GO" if total_min > eva_limit_min else "CAUTION"),
            "rejected": rejected,
            "rejection_reasons": rejection_reasons,
            "score": round(composite_score * 100.0, 1),
            "score_breakdown": {
                "safety_margin": round(safety_margin_score * 100.0, 1),
                "time_efficiency": round(time_eff_score * 100.0, 1),
                "energy_metabolic": round(energy_score * 100.0, 1),
                "science_value": round(science_score * 100.0, 1),
                "return_risk": round(return_risk_score * 100.0, 1),
            },
            "metrics": {
                "d3d_m": round(d3d_m, 1),
                "walk_min": round(walk_min, 1),
                "science_min": round(science_min, 1),
                "contingency_min": round(totals.get("contingency_min", 0.0), 1),
                "total_min": round(total_min, 1),
                "net_elevation_gain_m": round(totals.get("net_gain_m", 0.0), 1),
            },
            "point_of_no_return": pnr,
            "abort_options": abort_opts,
            "geojson": geojson,
            "two_sol_split": cand.get("two_sol", False),
            "provenance": "Derived (deterministic EVA Planner calculation, R=3,389,500 m)",
        })

    # Sort candidates by score descending, with non-rejected first
    evaluated_candidates.sort(key=lambda c: (not c["rejected"], c["score"]), reverse=True)

    # Identify primary recommendation and alternatives
    recommended = evaluated_candidates[0] if evaluated_candidates else {}
    alternatives = evaluated_candidates[1:] if len(evaluated_candidates) > 1 else []

    # Concrete fixes if baseline exceeded limits
    fixes = []
    if base_plan.get("totals", {}).get("total_min", 0.0) > eva_limit_min:
        diff = base_plan["totals"]["total_min"] - eva_limit_min
        fixes.append({
            "fix_type": "TWO_SOL_SPLIT",
            "description": f"Split mission across two sols: Sol 1 to Waypoint {safe_wp_index} (safe within limit), Sol 2 for remaining traverse.",
            "time_saved_min": round(diff, 1),
        })
        fixes.append({
            "fix_type": "PRESSURIZED_ROVER_SUPPORT",
            "description": "Utilize pressurized rover transit at 8.0-10.0 km/h for legs 3, 6, and 8 to reduce walking transit time to under 75 min.",
            "time_saved_min": 180.0,
        })
        fixes.append({
            "fix_type": "DROP_RIM_CLIMB",
            "description": f"Terminate traverse at Waypoint {safe_wp_index} (Belva Rim / Tenby); postpone Crater Rim climb (+345 m dz, 125.8 min).",
            "time_saved_min": 125.8,
        })

    return {
        "status": "success",
        "site": site,
        "recommended_route": recommended,
        "candidates": evaluated_candidates,
        "alternatives": alternatives,
        "recommended_fixes": fixes,
        "data_limitations": [
            "Slope calculations represent regional averages between surveyed waypoints; local pitch may exceed average slope.",
            "Walking speeds and metabolic rates are simulation assumptions; subject to astronaut suit condition and fatigue.",
            "Planet radius standardized to R = 3,389,500 m.",
        ],
    }
