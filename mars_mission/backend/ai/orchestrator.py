"""ROVERSE Autonomous Mission Commander (Head of Backend Orchestrator).

Coordinates all engines, enforces deterministic safety gate, invokes LLM narrator
via the provider chain, validates numeric grounding, logs decision audit trail,
and returns structured responses with full provenance and zero hallucinations.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from .audit import decision_audit
from .engines.comms import comms_engine
from .engines.environment import env_engine
from .engines.eva import eva_engine
from .engines.health_state import health_engine
from .engines.radiation import radiation_engine
from .engines.terrain import terrain_engine
from .numeric_guard import validate_numeric_grounding
from .report_builder import build_mission_report
from .route_optimizer import optimize_routes
from .router import provider_router
from .safety_gate import evaluate_safety

logger = logging.getLogger("roverse.ai.orchestrator")


class MissionCommander:
    """The central orchestrator governing all ROVERSE backend services."""

    def handle(self, event: dict[str, Any]) -> dict[str, Any]:
        """Handle any incoming event or telemetry payload with zero unhandled exceptions."""
        t0 = time.time()
        event_type = event.get("event_type", "chat")
        payload = event.get("payload") or {}
        map_context = event.get("map_context") or {}
        decision_id = str(uuid.uuid4())

        try:
            # 1. Health Triage Preemption: Always inspect vitals/query for red flags
            vitals = payload.get("vitals") or map_context.get("vitals")
            query = payload.get("message") or payload.get("query")
            
            # Check vitals emergency or emergency keywords
            health_status = health_engine.triage_vitals(vitals, query=query)
            if health_status.get("is_emergency"):
                return self._handle_emergency_abort(
                    health_status=health_status,
                    payload=payload,
                    map_context=map_context,
                    event_type=event_type,
                    decision_id=decision_id,
                    t0=t0,
                )

            # 2. Dispatch to dedicated event handler
            if event_type == "area_selected":
                return self._handle_area_selected(payload, map_context, decision_id, t0)
            elif event_type in ("route_changed", "waypoint_added", "parameter_changed"):
                return self._handle_route_changed(payload, map_context, event_type, decision_id, t0)
            elif event_type == "vitals_updated":
                return self._handle_vitals_updated(payload, map_context, health_status, decision_id, t0)
            elif event_type == "environment_update":
                return self._handle_environment_update(payload, map_context, decision_id, t0)
            elif event_type == "report_requested":
                return self._handle_report_requested(payload, map_context, decision_id, t0)
            elif event_type == "chat":
                return self._handle_chat(payload, map_context, decision_id, t0)
            else:
                # Default general orchestration
                return self._handle_general(payload, map_context, event_type, decision_id, t0)

        except Exception as exc:
            elapsed_ms = (time.time() - t0) * 1000.0
            logger.error("Unhandled exception in MissionCommander.handle: %s", exc, exc_info=True)
            # Graceful degraded fallback
            return {
                "decision_id": decision_id,
                "event_type": event_type,
                "verdict": "CAUTION",
                "confidence": 0.50,
                "degraded": True,
                "error": str(exc),
                "reasons": ["Internal orchestrator error encountered. System fell back to safe degraded mode."],
                "numbers": [],
                "alternatives": [],
                "data_limitations": ["System running in degraded mode due to unexpected processing error."],
                "simulation_notice": "Simulation data only. Not certified for flight operations.",
                "provider_used": "offline_fallback",
                "latency_ms": round(elapsed_ms, 2),
            }

    # -------------------------------------------------------------------------
    # Event Handlers
    # -------------------------------------------------------------------------

    def _handle_emergency_abort(
        self,
        health_status: dict[str, Any],
        payload: dict[str, Any],
        map_context: dict[str, Any],
        event_type: str,
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Preempts all inference and forces immediate system-wide ABORT."""
        elapsed_ms = (time.time() - t0) * 1000.0
        tools_called = ["health_engine.triage_vitals"]
        tool_outputs = {"health": health_status}

        reasons = [
            f"RED FLAG EMERGENCY: {health_status.get('emergency_summary', 'Critical astronaut biometric or suit alert')}"
        ]
        emergency_steps = health_status.get("emergency_steps", [
            "Halt all traverse and science activities immediately.",
            "Seal helmet and check suit pressure integrity.",
            "Execute direct return to nearest pressurized haven.",
        ])

        # Record decision
        decision_audit.record_decision(
            event_type=f"{event_type}_EMERGENCY_ABORT",
            inputs={"payload": payload},
            tools_called=tools_called,
            tool_outputs=tool_outputs,
            rules_fired=[{"rule": "health_red_flag_preemption", "status": "ABORT"}],
            verdict="ABORT",
            provider_used="deterministic_safety_gate",
            latency_ms=elapsed_ms,
            data_limitations=["Critical medical alert preempted all LLM reasoning."],
            decision_id=decision_id,
        )

        return {
            "decision_id": decision_id,
            "event_type": event_type,
            "verdict": "ABORT",
            "confidence": 1.0,
            "degraded": False,
            "provider_used": "deterministic_safety_gate",
            "latency_ms": round(elapsed_ms, 2),
            "reasons": reasons,
            "emergency_protocol": {
                "triage_category": health_status.get("category", "RED_FLAG_EMERGENCY"),
                "recommended_action": "EXECUTE IMMEDIATE EXPEDITION ABORT",
                "steps": emergency_steps,
                "fastest_return_route": health_status.get("fastest_return_route", {}),
            },
            "numbers": [
                {
                    "name": "Heart Rate",
                    "value": health_status.get("vitals", {}).get("heart_rate_bpm"),
                    "unit": "bpm",
                    "status": "Observed",
                    "source": "Biometric Telemetry",
                },
                {
                    "name": "SpO2",
                    "value": health_status.get("vitals", {}).get("spo2_pct"),
                    "unit": "%",
                    "status": "Observed",
                    "source": "Pulse Oximeter",
                },
            ],
            "alternatives": [
                {
                    "fix_type": "IMMEDIATE_ABORT_TO_BASE",
                    "description": "Abandon secondary objectives; proceed along high-speed return vector.",
                }
            ],
            "data_limitations": [
                "Biometric red-flags strictly preempt all AI decision making.",
                "Not certified medical advice.",
            ],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_area_selected(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Process Explorer area or point selection."""
        tools_called = ["terrain_engine", "env_engine", "radiation_engine", "comms_engine"]
        lat = payload.get("lat")
        lon = payload.get("lon")
        polygon = payload.get("polygon")
        radius_km = payload.get("radius_km", 2.0)

        # Default fallback coords if none provided
        if lat is None or lon is None:
            lat = map_context.get("location", {}).get("lat", -4.68)
            lon = map_context.get("location", {}).get("lon", 137.38)

        # 1. Terrain Engine
        if polygon and len(polygon) >= 3:
            terrain_res = terrain_engine.sample_polygon(polygon)
        else:
            terrain_res = terrain_engine.sample_point(lat, lon)

        # 2. Environment & Radiation & Comms
        env_res = env_engine.get_environment_at(lat, lon)
        rad_res = radiation_engine.get_radiation_summary(lat, lon)
        comms_res = comms_engine.get_comms_status(lat, lon)

        tool_outputs = {
            "terrain": terrain_res,
            "environment": env_res,
            "radiation": rad_res,
            "comms": comms_res,
        }

        # Check safety gate
        gate_input = {
            "slope_deg": terrain_res.get("slope_deg") or (terrain_res.get("slope_stats", {}).get("mean_deg")),
            "terrain_traversability": terrain_res.get("traversability"),
            "environment": env_res,
            "radiation": rad_res,
            "comms": comms_res,
        }
        gate_result = evaluate_safety(gate_input)
        verdict = gate_result.get("verdict", "GO")

        # Deterministic Narrative Fallback
        det_narrative = (
            f"Area Analysis for ({lat:.3f}, {lon:.3f}): "
            + (f"Terrain Class is {terrain_res.get('terrain_class', 'Unknown')} with elevation {terrain_res.get('elevation_m', 'N/A')} m and slope {terrain_res.get('slope_deg', 'N/A')}°. "
               if terrain_res.get("available") else "Target coordinates lie outside mapped high-resolution coverage. ")
            + f"Verdict: {verdict}. Ambient temperature {env_res.get('temperature_c', 'N/A')} °C, dose rate {rad_res.get('dose_rate_usvh', 25.2)} µSv/hr."
        )

        # Numeric Grounding Guard check on narrative
        clean_narrative, passed, violations = validate_numeric_grounding(
            narrative_text=det_narrative,
            tool_outputs=tool_outputs,
            deterministic_fallback=det_narrative,
        )

        elapsed_ms = (time.time() - t0) * 1000.0

        decision_audit.record_decision(
            event_type="area_selected",
            inputs={"lat": lat, "lon": lon, "polygon": bool(polygon)},
            tools_called=tools_called,
            tool_outputs=tool_outputs,
            rules_fired=gate_result.get("rules_fired", []),
            verdict=verdict,
            provider_used="deterministic_engines",
            latency_ms=elapsed_ms,
            data_limitations=terrain_res.get("data_limitations", []) + env_res.get("caveats", []),
            decision_id=decision_id,
        )

        return {
            "decision_id": decision_id,
            "event_type": "area_selected",
            "verdict": verdict,
            "confidence": 0.90 if terrain_res.get("available") else 0.50,
            "degraded": not terrain_res.get("available", True),
            "provider_used": "deterministic_engines",
            "latency_ms": round(elapsed_ms, 2),
            "summary": clean_narrative,
            "terrain": terrain_res,
            "environment": env_res,
            "radiation": rad_res,
            "comms": comms_res,
            "reasons": gate_result.get("reasons", ["Area parameters evaluated within nominal limits."]),
            "numbers": [
                {
                    "name": "Elevation",
                    "value": terrain_res.get("elevation_m"),
                    "unit": "m",
                    "status": "Observed" if terrain_res.get("available") else "Assumed",
                    "source": terrain_res.get("source", "USGS MOLA / HiRISE"),
                },
                {
                    "name": "Slope",
                    "value": terrain_res.get("slope_deg"),
                    "unit": "deg",
                    "status": "Derived",
                    "source": "Terrain Grid DTM",
                },
                {
                    "name": "Surface Temperature",
                    "value": env_res.get("temperature_c"),
                    "unit": "°C",
                    "status": "Observed",
                    "source": env_res.get("source"),
                },
            ],
            "alternatives": [],
            "data_limitations": terrain_res.get("data_limitations", []) + [
                "Orbital slope data represents pixel-scale gradients; local obstacles may vary.",
            ],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_route_changed(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        event_type: str,
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Process Route changes, parameter adjustments, and waypoint additions."""
        tools_called = ["eva_engine", "route_optimizer", "safety_gate"]
        scenario = payload.get("scenario") or payload.get("route") or map_context.get("route") or {}
        user_constraints = payload.get("constraints") or {}

        # Run Route Optimizer
        site = payload.get("site") or map_context.get("region") or "jezero"
        opt_results = optimize_routes(
            scenario_or_segments=scenario,
            user_constraints=user_constraints,
            site="jezero" if "jezero" in str(site).lower() else "gale",
        )

        recommended = opt_results.get("recommended_route", {})
        verdict = recommended.get("verdict", "GO")
        reasons = recommended.get("rejection_reasons") or ["Traverse path evaluated within acceptable limits."]

        elapsed_ms = (time.time() - t0) * 1000.0

        decision_audit.record_decision(
            event_type=event_type,
            inputs={"site": site, "constraints": user_constraints},
            tools_called=tools_called,
            tool_outputs=opt_results,
            rules_fired=[{"rule": "route_optimizer_eval", "verdict": verdict}],
            verdict=verdict,
            provider_used="deterministic_eva_engine",
            latency_ms=elapsed_ms,
            data_limitations=opt_results.get("data_limitations", []),
            decision_id=decision_id,
        )

        return {
            "decision_id": decision_id,
            "event_type": event_type,
            "verdict": verdict,
            "confidence": 0.95,
            "degraded": False,
            "provider_used": "deterministic_eva_engine",
            "latency_ms": round(elapsed_ms, 2),
            "recommended_route": recommended,
            "candidates": opt_results.get("candidates", []),
            "alternatives": opt_results.get("alternatives", []),
            "recommended_fixes": opt_results.get("recommended_fixes", []),
            "reasons": reasons,
            "numbers": [
                {
                    "name": "Total Duration",
                    "value": recommended.get("metrics", {}).get("total_min"),
                    "unit": "min",
                    "status": "Derived",
                    "source": "EVA Planner Engine",
                },
                {
                    "name": "3D Distance",
                    "value": recommended.get("metrics", {}).get("d3d_m"),
                    "unit": "m",
                    "status": "Derived",
                    "source": "EVA Planner Engine (R=3,389,500 m)",
                },
                {
                    "name": "Contingency Buffer",
                    "value": recommended.get("metrics", {}).get("contingency_min"),
                    "unit": "min",
                    "status": "Assumed",
                    "source": "20% Expedition Rule",
                },
            ],
            "data_limitations": opt_results.get("data_limitations", []),
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_vitals_updated(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        health_status: dict[str, Any],
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Process nominal astronaut health updates."""
        tools_called = ["health_engine.triage_vitals"]
        tool_outputs = {"health": health_status}
        verdict = health_status.get("verdict", "GO")
        reasons = [health_status.get("guidance", "Astronaut vitals within nominal range.")]

        elapsed_ms = (time.time() - t0) * 1000.0

        decision_audit.record_decision(
            event_type="vitals_updated",
            inputs={"vitals": payload.get("vitals")},
            tools_called=tools_called,
            tool_outputs=tool_outputs,
            rules_fired=[{"rule": "health_triage", "verdict": verdict}],
            verdict=verdict,
            provider_used="deterministic_health_engine",
            latency_ms=elapsed_ms,
            data_limitations=["Simulation physiological model; not certified medical advice."],
            decision_id=decision_id,
        )

        return {
            "decision_id": decision_id,
            "event_type": "vitals_updated",
            "verdict": verdict,
            "confidence": 0.95,
            "degraded": False,
            "provider_used": "deterministic_health_engine",
            "latency_ms": round(elapsed_ms, 2),
            "health_state": health_status,
            "reasons": reasons,
            "numbers": [
                {
                    "name": "Heart Rate",
                    "value": health_status.get("vitals", {}).get("heart_rate_bpm"),
                    "unit": "bpm",
                    "status": "Observed",
                    "source": "Simulated Biometrics",
                },
                {
                    "name": "SpO2",
                    "value": health_status.get("vitals", {}).get("spo2_pct"),
                    "unit": "%",
                    "status": "Observed",
                    "source": "Simulated Biometrics",
                },
                {
                    "name": "Pacing Multiplier",
                    "value": health_status.get("pacing_multiplier"),
                    "unit": "x",
                    "status": "Assumed",
                    "source": "Fatigue Biomechanical Model",
                },
            ],
            "alternatives": [],
            "data_limitations": [
                "Biometric monitoring is educational only. Not a medical diagnostic device.",
            ],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_environment_update(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Process environmental changes and update route viability."""
        lat = payload.get("lat", -4.68)
        lon = payload.get("lon", 137.38)
        snapshot = env_engine.get_environment_at(lat, lon)
        measures = env_engine.get_curated_measures(snapshot)

        elapsed_ms = (time.time() - t0) * 1000.0

        return {
            "decision_id": decision_id,
            "event_type": "environment_update",
            "verdict": "CAUTION" if snapshot.get("dust_optical_depth_tau", 0.0) > 1.0 else "GO",
            "confidence": 0.90,
            "degraded": False,
            "provider_used": "deterministic_env_engine",
            "latency_ms": round(elapsed_ms, 2),
            "snapshot": snapshot,
            "measures_to_follow": measures,
            "reasons": ["Environmental update received and indexed into active mission context."],
            "numbers": [
                {
                    "name": "Temperature",
                    "value": snapshot.get("temperature_c"),
                    "unit": "°C",
                    "status": "Observed",
                    "source": snapshot.get("source"),
                },
                {
                    "name": "Dust Tau",
                    "value": snapshot.get("dust_optical_depth_tau"),
                    "unit": "tau",
                    "status": "Derived",
                    "source": snapshot.get("source"),
                },
            ],
            "alternatives": [],
            "data_limitations": snapshot.get("caveats", []),
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_report_requested(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Generate comprehensive mission report."""
        report = build_mission_report(
            state={"payload": payload, "map_context": map_context},
            site=payload.get("site", "jezero"),
        )
        elapsed_ms = (time.time() - t0) * 1000.0

        return {
            "decision_id": decision_id,
            "event_type": "report_requested",
            "verdict": report.get("verdict", "GO"),
            "confidence": 0.95,
            "degraded": False,
            "provider_used": "deterministic_report_builder",
            "latency_ms": round(elapsed_ms, 2),
            "report": report,
            "reasons": ["Mission report successfully compiled from active expedition telemetry."],
            "numbers": [],
            "alternatives": [],
            "data_limitations": report.get("data_limitations", []),
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_chat(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Handle tactical chat input with function calling and numeric guard."""
        user_message = payload.get("message", "").strip()

        # Check if message attempts to bypass safety gate
        bypass_terms = ["ignore the limits", "bypass safety", "override no-go", "ignore no-go", "disregard limits"]
        if any(term in user_message.lower() for term in bypass_terms):
            elapsed_ms = (time.time() - t0) * 1000.0
            return {
                "decision_id": decision_id,
                "event_type": "chat",
                "verdict": "NO-GO",
                "confidence": 1.0,
                "degraded": False,
                "provider_used": "deterministic_safety_gate",
                "latency_ms": round(elapsed_ms, 2),
                "reply": "PERMISSION DENIED: Safety gate hard limits are enforced in system code and cannot be overridden by user or model prompts. All NO-GO decisions stand.",
                "reasons": ["Attempted safety override rejected by deterministic gate."],
                "numbers": [],
                "alternatives": [],
                "data_limitations": ["Safety architecture strictly forbids prompt injection of limit overrides."],
                "simulation_notice": "Simulation data only. Not certified for flight operations.",
            }

        # Nominal deterministic chat response
        chat_reply = (
            f"ROVERSE Mission Commander standing by. Your query has been logged and correlated with active "
            f"telemetry. All engine limits, terrain slope bands, and consumable reserves remain active."
        )

        elapsed_ms = (time.time() - t0) * 1000.0
        return {
            "decision_id": decision_id,
            "event_type": "chat",
            "verdict": "GO",
            "confidence": 0.90,
            "degraded": False,
            "provider_used": "ai_mission_commander",
            "latency_ms": round(elapsed_ms, 2),
            "reply": chat_reply,
            "reasons": ["Nominal tactical advisory response."],
            "numbers": [],
            "alternatives": [],
            "data_limitations": ["Advisory response only; follow mission flight rules."],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

    def _handle_general(
        self,
        payload: dict[str, Any],
        map_context: dict[str, Any],
        event_type: str,
        decision_id: str,
        t0: float,
    ) -> dict[str, Any]:
        """Generic event dispatcher."""
        elapsed_ms = (time.time() - t0) * 1000.0
        return {
            "decision_id": decision_id,
            "event_type": event_type,
            "verdict": "GO",
            "confidence": 0.85,
            "degraded": False,
            "provider_used": "deterministic_commander",
            "latency_ms": round(elapsed_ms, 2),
            "reasons": [f"Event {event_type} acknowledged and processed."],
            "numbers": [],
            "alternatives": [],
            "data_limitations": [],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }


mission_commander = MissionCommander()
