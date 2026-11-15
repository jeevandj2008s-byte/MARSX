"""Deterministic Astronaut Health and Safety State Engine for ROVERSE.

Enforces:
1. Deterministic red-flag triage running before any model call.
2. Emergency state switches entire system to ABORT with fixed emergency protocol.
3. Non-emergency fatigue and hydration multipliers modifying planning pace.
4. Non-medical disclaimer and simulation honesty labels.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


class HealthStateEngine:
    """Manages telemetry vitals, physiological degradation, and emergency abort triage."""

    RED_FLAG_KEYWORDS = [
        "unconscious", "unresponsive", "chest pain", "cardiac", "hemorrhage",
        "bleeding heavily", "suit breach", "decompression", "suit puncture",
        "hypoxia", "asphyxiation", "seizure", "convulsing", "mayday",
        "emergency abort", "catastrophic",
    ]

    DISCLAIMER = (
        "ROVERSE Educational Simulation: Not medical advice. In any real medical emergency on Earth, "
        "contact local emergency services immediately. ROVERSE is not certified for flight operations."
    )

    def evaluate_vitals(
        self,
        vital_signs: Optional[Dict[str, Any]] = None,
        query_text: str = "",
    ) -> Dict[str, Any]:
        """Triage vitals and text symptoms deterministically before any LLM inference."""
        v = vital_signs or {}
        hr = v.get("heart_rate_bpm") or v.get("heart_rate") or v.get("hr")
        spo2 = v.get("spo2_pct") or v.get("spo2") or v.get("o2_saturation")
        pressure_kpa = v.get("suit_pressure_kpa") or v.get("suit_pressure")
        temp_c = v.get("core_temp_c") or v.get("temperature_c")
        hydration_pct = v.get("hydration_pct", 100.0)
        fatigue_score = v.get("fatigue_score", 0.0)
        accumulated_dose_msv = v.get("accumulated_dose_msv", 0.0)

        # 1. Deterministic Red-Flag Triage
        text_lower = query_text.lower()
        matched_kw = [kw for kw in self.RED_FLAG_KEYWORDS if kw in text_lower]

        is_emergency = False
        reasons = []

        if spo2 is not None and float(spo2) < 88.0:
            is_emergency = True
            reasons.append(f"Severe hypoxia alert: SpO2 {spo2}% < critical 88% threshold.")

        if hr is not None:
            hr_val = float(hr)
            if hr_val > 175.0:
                is_emergency = True
                reasons.append(f"Critical tachycardia: Heart rate {hr_val} bpm > 175 bpm.")
            elif hr_val < 38.0:
                is_emergency = True
                reasons.append(f"Critical bradycardia: Heart rate {hr_val} bpm < 38 bpm.")

        if pressure_kpa is not None and float(pressure_kpa) < 25.0:
            is_emergency = True
            reasons.append(f"Catastrophic suit depressurization: Suit pressure {pressure_kpa} kPa < 25.0 kPa safety minimum.")

        if temp_c is not None:
            t = float(temp_c)
            if t > 39.0:
                is_emergency = True
                reasons.append(f"Severe hyperthermia: Core temperature {t}°C > 39.0°C.")
            elif t < 35.0:
                is_emergency = True
                reasons.append(f"Severe hypothermia: Core temperature {t}°C < 35.0°C.")

        if matched_kw:
            is_emergency = True
            reasons.append(f"Emergency symptom keyword trigger: '{', '.join(matched_kw)}'.")

        # 2. Handle Emergency Abort State
        if is_emergency:
            return {
                "verdict": "ABORT",
                "is_emergency": True,
                "reasons": reasons,
                "summary": "MISSION ABORT INITIATED. Vital parameters breach life-critical margins.",
                "mayday_summary": (
                    "MAYDAY - MAYDAY - MAYDAY. ROVERSE Mission Abort. "
                    f"Explorer vital signs breached: {'; '.join(reasons)}. Immediate airlock ingress required."
                ),
                "nearest_safe_haven": "Base Camp Airlock 01 (Pressurized)",
                "fastest_return_route": {
                    "strategy": "Direct Emergency Bearing",
                    "mode": "Maximum sustainable astronaut walk / sprint to nearest ingress",
                    "contingency": "Life support reserve bottles engaged",
                },
                "emergency_steps": [
                    "1. ABORT ALL SURFACE OPERATIONS IMMEDIATELY.",
                    "2. Open suit secondary O2 emergency supply valve.",
                    "3. Inform Mission Operations Lead and confirm locator beacon active.",
                    "4. Move immediately toward nearest pressurized rover or habitat airlock.",
                    "5. Do NOT attempt rock/sample transport or equipment salvage.",
                ],
                "pace_multiplier": 0.5,
                "max_duration_multiplier": 0.0,
                "simulation_notice": self.DISCLAIMER,
                "status": "Simulated",
            }

        # 3. Handle Non-Emergency Physiological Pacing State
        pace_mult = 1.0
        dur_mult = 1.0
        health_verdict = "GO"
        warnings = []

        if fatigue_score >= 90:
            health_verdict = "NO-GO"
            pace_mult = 0.55
            dur_mult = 0.70
            warnings.append("Severe physiological exhaustion (fatigue >= 90). Further EVA traversal prohibited.")
        elif fatigue_score >= 75:
            health_verdict = "CAUTION"
            pace_mult = 0.70
            dur_mult = 0.85
            warnings.append("High physical fatigue (score >= 75). Walking pace degraded by 30%.")
        elif fatigue_score >= 60:
            health_verdict = "CAUTION"
            pace_mult = 0.80
            dur_mult = 0.90
            warnings.append("Moderate physical fatigue. Regular 5-min rests recommended.")
        elif fatigue_score >= 40:
            pace_mult = 0.90
            warnings.append("Mild fatigue observed. Nominal pacing adjustments applied.")

        if hydration_pct < 85.0:
            if health_verdict != "NO-GO":
                health_verdict = "CAUTION"
            dur_mult = min(dur_mult, 0.80)
            warnings.append(f"Sub-optimal hydration ({hydration_pct}%). Drink 250 mL in-suit hydration fluid.")

        if accumulated_dose_msv >= 5.0:
            if health_verdict != "NO-GO":
                health_verdict = "CAUTION"
            warnings.append(f"Elevated cumulative mission radiation ({accumulated_dose_msv:.1f} mSv). Monitor solar weather.")

        return {
            "verdict": health_verdict,
            "is_emergency": False,
            "reasons": warnings if warnings else ["All vital telemetry within nominal biological envelope."],
            "summary": f"Physiological status: {health_verdict}. Pacing multiplier {pace_mult:.2f}x applied.",
            "pace_multiplier": pace_mult,
            "max_duration_multiplier": dur_mult,
            "vitals_snapshot": {
                "heart_rate_bpm": hr,
                "spo2_percent": spo2,
                "suit_pressure_kpa": pressure_kpa,
                "core_temp_c": temp_c,
                "hydration_percent": hydration_pct,
                "fatigue_score": fatigue_score,
                "accumulated_dose_msv": accumulated_dose_msv,
            },
            "emergency_steps": [],
            "simulation_notice": self.DISCLAIMER,
            "status": "Simulated",
        }

    def triage_vitals(
        self,
        vitals: Optional[Dict[str, Any]] = None,
        query: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convenience method matching orchestrator signature."""
        return self.evaluate_vitals(vital_signs=vitals, query_text=query or "")


health_engine = HealthStateEngine()
