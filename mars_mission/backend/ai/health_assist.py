"""Deterministic Astronaut Health & Safety Assistant for ROVERSE.

Rules:
1. A deterministic red-flag triage check runs BEFORE any model call.
   Triggers: chest pain, trouble breathing, suit oxygen/pressure alarms, loss of consciousness,
   severe bleeding, stroke signs, seizures, cyanosis.
2. On match: returns an IMMEDIATE fixed pre-written emergency response. Never model-generated!
3. On non-match: answers strictly from curated knowledge base protocols (hydration, thermal regulation,
   metabolic fatigue, radiation hygiene).
4. Strictly NO medical diagnosis, NO dosing, NO prescribing.
5. Always states this is an educational simulation and not certified medical advice.
6. Works 100% identically in offline mode without network connectivity.
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

from .knowledge_base import kb
from .schemas import HealthAssistRequest, HealthAssistResponse, ResponseMetadata

logger = logging.getLogger("roverse.ai.health_assist")


class HealthAssistant:
    """Safety-critical triage and health protocol provider."""

    def evaluate(self, request: HealthAssistRequest) -> HealthAssistResponse:
        query_text = (request.query or "").lower().strip()

        # 1. Check for Red-Flag Triggers (Deterministic Regex/Substring matching)
        red_flags = kb.health.get("red_flag_triggers", [
            "chest pain", "trouble breathing", "shortness of breath",
            "oxygen alarm", "o2 alarm", "low oxygen", "suit pressure alarm",
            "suit pressure loss", "pressure loss", "decompression",
            "depressurization", "suit leak", "loss of consciousness", "passed out",
            "unconscious", "severe bleeding", "hemorrhage", "arterial bleeding",
            "stroke", "slurred speech", "seizure", "cyanosis",
            "radiation spike", "rad spike", "radiation alarm", "rad alarm",
            "radiation flux", "ionizing radiation", "critical radiation",
        ])

        triggered_flags = [flag for flag in red_flags if flag in query_text]

        # Also inspect vitals telemetry if supplied
        if request.vital_signs:
            spo2 = request.vital_signs.get("spo2")
            if spo2 is not None and isinstance(spo2, (int, float)) and spo2 < 88:
                triggered_flags.append("critically low SpO2 (<88%)")
            heart_rate = request.vital_signs.get("heart_rate")
            if heart_rate is not None and isinstance(heart_rate, (int, float)) and (heart_rate > 175 or heart_rate < 38):
                triggered_flags.append(f"abnormal heart rate ({heart_rate} bpm)")
            suit_p = request.vital_signs.get("suit_pressure_kpa")
            if suit_p is not None and isinstance(suit_p, (int, float)) and suit_p < 25.0:
                triggered_flags.append(f"critical suit depressurization ({suit_p} kPa)")

        # RED-FLAG MATCH: Return deterministic fixed emergency action protocol
        if triggered_flags:
            logger.warning(f"CRITICAL RED-FLAG TRIAGE TRIGGERED: {triggered_flags}")
            return HealthAssistResponse(
                is_emergency=True,
                triaged_category="RED_FLAG_EMERGENCY",
                guidance=(
                    f"CRITICAL LIFE-SAFETY ALERT: Immediate medical red-flag detected ({', '.join(triggered_flags)}). "
                    "CEASE ALL ACTIVITY IMMEDIATELY. This situation represents an immediate threat to explorer safety."
                ),
                recommended_action=(
                    "ABORT EVA IMMEDIATELY. Switch suit life-support to emergency secondary O2 loop, stabilize suit pressure, "
                    "and initiate buddy-assisted egress to the nearest airlock/habitat. Transmit emergency MAYDAY to mission control."
                ),
                emergency_steps=[
                    "1. STOP ACTIVITY: Cease all traverse, drilling, and sample collection immediately.",
                    "2. SUIT PRESSURE CHECK: Verify primary/secondary O2 regulators; ensure seal is maintained at 29.6 kPa.",
                    "3. BUDDY ASSIST: Alert traverse companion; establish physical tether if dizziness or weakness is present.",
                    "4. AIRLOCK RETURN: Egress along fastest safe corridor back to Base Camp airlock.",
                    "5. MAYDAY TRANSMISSION: Transmit urgent telemetry and emergency status to Mission Operations.",
                    "6. EARTH EMERGENCY NOTICE: In any real terrestrial emergency, immediately call local emergency services (911 / 112 / clinic).",
                ],
                data_limitations=[
                    "ROVERSE Educational Simulation: Automated deterministic safety response.",
                    "NOT MEDICAL ADVICE. Does not provide clinical diagnosis, pharmaceutical dosing, or prescribing.",
                    "In an actual terrestrial emergency, contact emergency medical services immediately."
                ],
                simulation_notice="ROVERSE Educational Simulation: Not medical advice. For real emergencies on Earth, contact local emergency services immediately.",
                provider_used="offline",
                model_used="deterministic-triage",
                degraded=False,
                latency_ms=1,
                metadata=ResponseMetadata(
                    provider_used="offline",
                    model_used="deterministic-triage",
                    degraded=False,
                    fallback_reason="Deterministic red-flag safety protocol matched",
                    latency_ms=1,
                ),
            )

        # 2. Non-emergency: match against curated guidelines
        general_guidance = kb.health.get("general_guidance", {})

        if any(w in query_text for w in ["water", "drink", "dehydration", "hydrate", "hydration", "fluid", "electrolyte", "thirst"]):
            h_info = general_guidance.get("hydration", {})
            return self._build_response(
                category="HYDRATION",
                guidance=h_info.get("guidelines", "Maintain 250-400 mL/hr fluid intake via in-suit drink bag."),
                action="Verify drink bag valve operation and monitor fluid consumption checkpoints.",
            )

        if any(w in query_text for w in ["cold", "heat", "temperature", "freeze", "frostbite", "shivering", "thermal"]):
            t_info = general_guidance.get("thermal_stress", {})
            return self._build_response(
                category="THERMAL",
                guidance=t_info.get("guidelines", "Adjust Liquid Cooling Garment (LCVG) and auxiliary glove heaters for ambient temps below -60°C."),
                action="Verify LCVG temperature dial setting and check glove distal joint heating loops.",
            )

        if any(w in query_text for w in ["tired", "fatigue", "exhaustion", "rest", "pace", "walking", "speed"]):
            f_info = general_guidance.get("fatigue_and_metabolic_rate", {})
            return self._build_response(
                category="FATIGUE",
                guidance=f_info.get("guidelines", "Walking in 0.38g gravity in suit expends ~200-350W. Take 5-minute rest every 45 minutes on slopes >10°."),
                action="Enforce a 5-minute stationary metabolic rest break; monitor heart rate recovery below 110 bpm.",
            )

        if any(w in query_text for w in ["radiation", "rad", "solar flare", "spe", "cosmic ray", "dose"]):
            r_info = general_guidance.get("radiation_hygiene", {})
            return self._build_response(
                category="RADIATION",
                guidance=r_info.get("guidelines", "Historical MSL RAD baseline is ~25 μSv/hr. In case of active Solar Particle Event, seek regolith or boulder shielding."),
                action="Check personal dosimeter total millisieverts against mission EVA cumulative limits.",
            )

        # Default general health & safety response from curated knowledge
        return self._build_response(
            category="GENERAL",
            guidance=(
                "ROVERSE Suited Explorer Safety Protocol: Monitor vital signs (heart rate, SpO2, core temp), "
                "verify PLSS suit pressure remains at 29.6 kPa, adhere to nominal walking speed (<2.5 km/h), "
                "and maintain visual contact with traverse buddy."
            ),
            action="Perform standard 30-minute EVA safety checkpoint review with traverse partner.",
        )

    def _build_response(self, category: str, guidance: str, action: str) -> HealthAssistResponse:
        return HealthAssistResponse(
            is_emergency=False,
            triaged_category=category,
            guidance=guidance,
            recommended_action=action,
            emergency_steps=[],
            data_limitations=[
                "ROVERSE Educational Simulation: For mission planning education only.",
                "NOT MEDICAL ADVICE. Does not provide clinical diagnosis, pharmaceutical dosing, or prescribing.",
                "In an actual terrestrial emergency, contact emergency medical services immediately."
            ],
            simulation_notice="ROVERSE Educational Simulation: Not medical advice. For real emergencies on Earth, contact local emergency services immediately.",
            provider_used="offline",
            model_used="deterministic-triage",
            degraded=False,
            latency_ms=1,
            metadata=ResponseMetadata(
                provider_used="offline",
                model_used="deterministic-triage",
                degraded=False,
                latency_ms=1,
            ),
        )

    # Alias for safety triage
    triage = evaluate


health_assistant = HealthAssistant()
