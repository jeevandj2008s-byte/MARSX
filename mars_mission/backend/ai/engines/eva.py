"""Deterministic EVA Planner Engine for ROVERSE.

Wraps backend/eva_planner.py to provide ONE single authoritative time,
distance, and consumable budget model across the entire application.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure root backend directory and local backend are importable
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))
sys.path.insert(0, str(ROOT_DIR / "mars_mission" / "backend"))

try:
    import eva_planner
except ImportError:
    eva_planner = None

MARS_RADIUS_M = 3_389_500.0  # Report reference radius
MARS_RADIUS_METERS = MARS_RADIUS_M


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float, r: float = MARS_RADIUS_METERS
) -> float:
    """Standard Haversine horizontal distance calculation on Mars."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class EvaEngine:
    """Delegates all EVA time, distance, and feasibility calculations to eva_planner.py."""

    def __init__(self):
        # Locate scenario in either root or mars_mission
        paths = [
            ROOT_DIR / "scenarios" / "jezero_reference.json",
            ROOT_DIR / "mars_mission" / "scenarios" / "jezero_reference.json",
            ROOT_DIR / "mars_mission" / "backend" / "scenarios" / "jezero_reference.json",
        ]
        self.scenario_path = next((p for p in paths if p.exists()), paths[0])
        self._reference_scenario: Optional[Dict[str, Any]] = None
        self._load_reference()

    def _load_reference(self):
        if self.scenario_path.exists():
            try:
                import json
                with open(self.scenario_path, "r", encoding="utf-8") as f:
                    self._reference_scenario = json.load(f)
            except Exception:
                self._reference_scenario = None

    def get_reference_scenario(self) -> Optional[Dict[str, Any]]:
        return self._reference_scenario

    def plan_jezero_reference(self, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Calculates full Jezero reference EVA plan (exact 83/83 reproduction)."""
        if eva_planner and self._reference_scenario:
            return eva_planner.plan(self._reference_scenario, overrides or {})
        elif eva_planner:
            sc = eva_planner.load()
            return eva_planner.plan(sc, overrides or {})
        raise RuntimeError("eva_planner engine or jezero_reference.json not loaded")

    def calculate_plan(self, scenario_or_segments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Unified plan calculator."""
        if not scenario_or_segments or not scenario_or_segments.get("segments"):
            return self.plan_jezero_reference(scenario_or_segments or {})
        
        # If waypoints are present, compute custom route
        if scenario_or_segments.get("waypoints"):
            return self.compute_custom_route(
                waypoints=scenario_or_segments.get("waypoints", []),
                tortuosity=scenario_or_segments.get("config", {}).get("tortuosity", 1.0),
                eva_limit_min=scenario_or_segments.get("config", {}).get("eva_limit_min", 480.0),
            )
        
        return self.plan_jezero_reference(scenario_or_segments)

    def run_scenarios(self, scenario: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        sc = scenario or self._reference_scenario
        if eva_planner and sc:
            return eva_planner.run_scenarios(sc)
        elif eva_planner:
            return eva_planner.run_scenarios(eva_planner.load())
        return []

    def get_scenarios(self, scenario: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {"scenarios": self.run_scenarios(scenario)}

    def verify(self, result: Dict[str, Any], scenario: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        sc = scenario or self._reference_scenario
        if eva_planner and sc:
            return eva_planner.verify(result, sc.get("reference", {}), sc)
        elif eva_planner:
            loaded = eva_planner.load()
            return eva_planner.verify(result, loaded.get("reference", {}), loaded)
        return {"all_pass": False, "passed": 0, "total": 0, "checks": []}

    def compute_custom_route(
        self,
        waypoints: List[Dict[str, Any]],
        speeds_ms: Optional[List[float]] = None,
        tortuosity: float = 1.0,
        eva_limit_min: float = 480.0,
        contingency_fraction: float = 0.20,
    ) -> Dict[str, Any]:
        """Computes complete EVA telemetry for an arbitrary route on Mars using the official formulas."""
        if len(waypoints) < 2:
            return {
                "available": False,
                "error": "At least 2 waypoints required to construct an EVA traverse.",
            }

        # Build synthetic scenario
        sc_waypoints = []
        for i, wp in enumerate(waypoints, start=1):
            sc_waypoints.append({
                "id": i,
                "name": wp.get("label") or wp.get("name") or f"WP-{i:02d}",
                "lat": float(wp["lat"]),
                "lon": float(wp["lon"]),
                "elevation_m": float(wp.get("elevation_m") or wp.get("elevation", -2500.0)),
                "unit": wp.get("unit") or wp.get("description", "Traverse waypoint"),
            })

        sc_segments = []
        for i in range(len(sc_waypoints) - 1):
            spd = (speeds_ms[i] if speeds_ms and i < len(speeds_ms) else 0.65)
            sc_segments.append({
                "from": sc_waypoints[i]["id"],
                "to": sc_waypoints[i + 1]["id"],
                "terrain": "General Martian Terrain",
                "speed_ms": max(0.1, spd),
                "class": "General Surface Unit",
                "contingency_min": None,
            })

        sci_stops = {}
        for i, wp in enumerate(waypoints, start=1):
            dwell = wp.get("dwellMinutes") or wp.get("dwell_min") or (20 if i > 1 else 15)
            sci_stops[str(i)] = dwell

        synthetic_scenario = {
            "id": "custom-eva",
            "name": "Custom Explorer Traverse",
            "radius_m": MARS_RADIUS_M,
            "waypoints": sc_waypoints,
            "segments": sc_segments,
            "science_stops_min": sci_stops,
            "science_activities": {str(w["id"]): "Science sampling & observation" for w in sc_waypoints},
            "config": {
                "contingency_fraction": contingency_fraction,
                "contingency_mode": "proportional",
                "round_segment_minutes": True,
                "tortuosity": max(1.0, tortuosity),
                "eva_limit_min": eva_limit_min,
                "reserve_min": 30,
            },
        }

        if eva_planner:
            return eva_planner.plan(synthetic_scenario)

        return {"available": False, "error": "EVA planner engine unavailable"}

    def calculate_eva_budget(
        self,
        distance_km: float,
        speed_kmh: Optional[float] = None,
        oxygen_hours: float = 8.0,
        power_hours: float = 7.0,
        tortuosity: float = 1.0,
    ) -> Dict[str, Any]:
        """Calculates consumables and 50% turn-around deadline delegated to the EVA planner model."""
        speed_ms = (speed_kmh / 3.6) if speed_kmh else 0.65  # Default ~2.34 km/h (0.65 m/s)
        dist_m = distance_km * 1000.0 * max(1.0, tortuosity)
        walk_min = (dist_m / speed_ms) / 60.0
        # 20% contingency applied
        total_time_min = walk_min * 1.20
        total_hours = total_time_min / 60.0

        o2_pct = (total_hours / max(1.0, oxygen_hours)) * 100.0
        power_pct = (total_hours / max(1.0, power_hours)) * 100.0
        o2_reserve = max(0.0, 100.0 - o2_pct)

        # 50% Turn-Around Rule: explorer must initiate return journey when 50% of budget is reached
        nominal_limit_hours = min(oxygen_hours, power_hours, 8.0)
        pnr_minutes = int((nominal_limit_hours * 60.0) * 0.50)

        return {
            "planned_distance_km": round(distance_km, 2),
            "assumed_speed_kmh": round(speed_ms * 3.6, 2),
            "tortuosity": round(tortuosity, 2),
            "estimated_duration_hours": round(total_hours, 2),
            "estimated_duration_minutes": round(total_time_min, 1),
            "oxygen_consumed_percent": min(100.0, round(o2_pct, 1)),
            "oxygen_reserve_margin_percent": round(o2_reserve, 1),
            "safe_turn_around_deadline_minutes": pnr_minutes,
            "contingency_fraction": 0.20,
            "turn_around_rule": "50% turn-around rule enforced: initiate return path when 50% of consumables or time budget is spent.",
            "simulation_disclaimer": "Reference envelope for ROVERSE educational simulation. Not certified NASA life support limits.",
        }


eva_engine = EvaEngine()
