"""Deterministic Radiation Engine for ROVERSE.

Models Galactic Cosmic Ray (GCR) background exposure and evaluates Solar Particle Event (SPE) thresholds.
Honesty rule: Historical MSL RAD surface measurements provide baseline context but do NOT establish future
astronaut biological exposure or predict acute solar events.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class RadiationEngine:
    """Calculates mission ionizing radiation dose budgets and enforces limits."""

    HISTORICAL_RAD_BASELINE_USV_HR = 25.2  # Curiosity MSL RAD surface average (~0.6 mSv/day)

    LIMITS_MSV = {
        "single_eva_nominal": 2.0,
        "single_eva_caution": 5.0,
        "single_eva_no_go": 10.0,
        "thirty_day_limit": 250.0,
        "annual_limit": 500.0,
    }

    CAVEAT = (
        "Historical Curiosity RAD surface measurements (~25.2 μSv/hr) provide baseline context "
        "but do NOT establish future astronaut biological exposure or predict acute Solar Particle Events."
    )

    def evaluate_eva_exposure(
        self,
        duration_hours: float,
        current_accumulated_msv: float = 0.0,
        spe_active: bool = False,
        spe_rate_msv_hr: float = 0.0,
    ) -> Dict[str, Any]:
        """Calculates expected ionizing radiation dose for an EVA duration."""
        baseline_hourly_msv = self.HISTORICAL_RAD_BASELINE_USV_HR / 1000.0
        hourly_rate_msv = spe_rate_msv_hr if spe_active else baseline_hourly_msv

        eva_dose_msv = hourly_rate_msv * max(0.0, duration_hours)
        total_post_eva_msv = current_accumulated_msv + eva_dose_msv

        # Safety Gate Verdict
        if spe_active or eva_dose_msv >= self.LIMITS_MSV["single_eva_no_go"]:
            verdict = "NO-GO"
            reason = (
                f"Radiation hazard alert: EVA dose {eva_dose_msv:.2f} mSv exceeds safety limit "
                f"({self.LIMITS_MSV['single_eva_no_go']} mSv) or active Solar Particle Event reported."
            )
        elif eva_dose_msv >= self.LIMITS_MSV["single_eva_caution"] or total_post_eva_msv >= 100.0:
            verdict = "CAUTION"
            reason = f"Elevated radiation budget ({eva_dose_msv:.2f} mSv). Minimize surface exposure duration."
        else:
            verdict = "GO"
            reason = f"Nominal radiation dose ({eva_dose_msv:.3f} mSv / {eva_dose_msv * 1000.0:.1f} μSv). Within standard single-EVA envelope."

        return {
            "verdict": verdict,
            "reason": reason,
            "eva_dose_msv": round(eva_dose_msv, 3),
            "eva_dose_usv": round(eva_dose_msv * 1000.0, 1),
            "projected_total_msv": round(total_post_eva_msv, 3),
            "spe_active": spe_active,
            "status": "Derived (Biophysical Model)",
            "caveat": self.CAVEAT,
        }

    def get_radiation_summary(self, lat: float = 0.0, lon: float = 0.0) -> Dict[str, Any]:
        """Provides baseline radiation summary for the requested coordinates."""
        return {
            "dose_rate_usvh": self.HISTORICAL_RAD_BASELINE_USV_HR,
            "status": "Observed",
            "instrument": "MSL / RAD Surface Detector",
            "historical_caveat": self.CAVEAT,
            "verdict": "GO",
            "reason": "Nominal GCR surface background (~25.2 µSv/hr).",
        }


radiation_engine = RadiationEngine()
