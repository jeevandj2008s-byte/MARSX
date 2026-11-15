"""Deterministic Safety Gate for ROVERSE.

RULE: Deterministic safety gate sits ABOVE the AI.
The AI can explain a NO-GO and propose alternatives; it can NEVER upgrade or override
a NO-GO, and neither can user text ('ignore the limits' is treated as passive data).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

VerdictType = Literal["GO", "CAUTION", "NO-GO", "ABORT"]


class SafetyGate:
    """Enforces life-critical operational safety constraints in pure deterministic code."""

    def __init__(self, rules_path: Optional[Path] = None):
        if rules_path is None:
            rules_path = Path(__file__).resolve().parent / "safety_rules.json"
        self.rules_path = rules_path
        self.rules: Dict[str, Any] = self._load_rules()

    def _load_rules(self) -> Dict[str, Any]:
        if self.rules_path.exists():
            try:
                with open(self.rules_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def evaluate(
        self,
        health_assessment: Optional[Dict[str, Any]] = None,
        eva_plan: Optional[Dict[str, Any]] = None,
        environment_assessment: Optional[Dict[str, Any]] = None,
        terrain_assessment: Optional[Dict[str, Any]] = None,
        radiation_assessment: Optional[Dict[str, Any]] = None,
        comms_assessment: Optional[Dict[str, Any]] = None,
        max_slope_deg: Optional[float] = None,
        total_duration_min: Optional[float] = None,
        eva_limit_min: float = 480.0,
    ) -> Dict[str, Any]:
        """Evaluates all operational inputs deterministically. Verdict is strictly monotone.

        Hierarchy: ABORT > NO-GO > CAUTION > GO.
        """
        reasons: List[str] = []
        rules_fired: List[str] = []
        highest_verdict: VerdictType = "GO"

        def upgrade(new_verdict: VerdictType, rule_id: str, reason_text: str):
            nonlocal highest_verdict
            priority = {"GO": 0, "CAUTION": 1, "NO-GO": 2, "ABORT": 3}
            if priority[new_verdict] > priority[highest_verdict]:
                highest_verdict = new_verdict
            rules_fired.append(rule_id)
            reasons.append(reason_text)

        # 1. Health Triage (Highest priority: can trigger immediate ABORT)
        if health_assessment:
            h_verdict = health_assessment.get("verdict", "GO")
            if h_verdict == "ABORT" or health_assessment.get("is_emergency"):
                upgrade("ABORT", "RULE_HEALTH_RED_FLAG", f"EMERGENCY HEALTH RED-FLAG: {'; '.join(health_assessment.get('reasons', []))}")
            elif h_verdict == "NO-GO":
                upgrade("NO-GO", "RULE_HEALTH_NO_GO", f"Physiological exhaustion: {'; '.join(health_assessment.get('reasons', []))}")
            elif h_verdict == "CAUTION":
                upgrade("CAUTION", "RULE_HEALTH_CAUTION", f"Physiological warning: {'; '.join(health_assessment.get('reasons', []))}")

        # 2. Slope Gradient Check
        slope = max_slope_deg
        if slope is None and terrain_assessment:
            slope = terrain_assessment.get("max_slope_deg")
        if slope is None and eva_plan:
            segs = eva_plan.get("segments", [])
            if segs:
                slope = max((s.get("slope_deg", 0.0) for s in segs), default=0.0)

        if slope is not None:
            if slope >= 30.0:
                upgrade("NO-GO", "RULE_SLOPE_AVOID", f"Max slope {slope:.1f}° exceeds 30.0° threshold (avoid band; prototype thresholds, not official NASA limits).")
            elif slope >= 20.0:
                upgrade("CAUTION", "RULE_SLOPE_DIFFICULT", f"Steep slope section {slope:.1f}° (20-30° difficult band; high metabolic expenditure, switchbacks required).")
            elif slope >= 10.0:
                upgrade("CAUTION", "RULE_SLOPE_MODERATE", f"Moderate terrain slope {slope:.1f}° (10-20° moderate band; proceed with standard traction caution).")

        # 3. EVA Duration vs 480 min Limit & Turn-Around Margin
        dur = total_duration_min
        if dur is None and eva_plan:
            t = eva_plan.get("totals", {})
            dur = t.get("total_min")

        if dur is not None:
            limit = eva_limit_min or self.rules.get("eva_limit_min", 480.0)
            if dur > limit:
                over = dur - limit
                upgrade("NO-GO", "RULE_EVA_LIMIT_EXCEEDED", f"Total estimated EVA duration {dur:.1f} min exceeds nominal limit ({limit:.0f} min) by {over:.1f} min.")
            elif dur > (limit * 0.85):
                upgrade("CAUTION", "RULE_EVA_MARGIN_TIGHT", f"Total EVA duration {dur:.1f} min is within 15% of nominal limit ({limit:.0f} min).")

            # 50% Turn-Around Rule
            pnr_min = limit * self.rules.get("turn_around_fraction", 0.50)
            if dur > (pnr_min * 1.8):
                upgrade("CAUTION", "RULE_50_PCT_TURN_AROUND", f"Traverse duration ({dur:.1f} min) requires point-of-no-return check at {pnr_min:.0f} min.")

        # 4. Atmospheric / Dust / Wind Check
        if environment_assessment:
            env_v = environment_assessment.get("verdict", "GO")
            if env_v == "NO-GO":
                upgrade("NO-GO", "RULE_ENV_NO_GO", environment_assessment.get("reason", "Severe environmental hazard."))
            elif env_v == "CAUTION":
                upgrade("CAUTION", "RULE_ENV_CAUTION", environment_assessment.get("reason", "Adverse environmental condition."))

        # 5. Ionizing Radiation Check
        if radiation_assessment:
            rad_v = radiation_assessment.get("verdict", "GO")
            if rad_v == "NO-GO":
                upgrade("NO-GO", "RULE_RAD_NO_GO", radiation_assessment.get("reason", "Radiation budget exceeded or Solar Particle Event."))
            elif rad_v == "CAUTION":
                upgrade("CAUTION", "RULE_RAD_CAUTION", radiation_assessment.get("reason", "Elevated ionizing radiation dose."))

        # 6. Communications Coverage Check
        if comms_assessment:
            comms_v = comms_assessment.get("verdict", "GO")
            if comms_v == "NO-GO":
                upgrade("NO-GO", "RULE_COMMS_NO_GO", comms_assessment.get("reason", "Comms blackout window exceeds threshold."))
            elif comms_v == "CAUTION":
                upgrade("CAUTION", "RULE_COMMS_CAUTION", comms_assessment.get("reason", "Intermittent comms blackout expected."))

        if not reasons:
            reasons.append("All operational, consumable, and physiological parameters are within verified safety envelopes.")

        return {
            "verdict": highest_verdict,
            "can_proceed": highest_verdict in ("GO", "CAUTION"),
            "is_emergency": highest_verdict == "ABORT",
            "reasons": reasons,
            "rules_fired": rules_fired,
            "slope_label": self.rules.get("slope_label", "prototype thresholds, not official NASA limits"),
            "disclaimer": self.rules.get("disclaimer", "Proposed educational simulation; not certified NASA operations."),
        }


safety_gate = SafetyGate()



def evaluate_safety(input_data: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
    """Helper function wrapping safety_gate.evaluate."""
    if input_data:
        totals = input_data.get("totals", {})
        dur = totals.get("total_min") or input_data.get("total_duration_min")
        limit = input_data.get("eva_time_limit_min", 480.0)
        slope = input_data.get("slope_deg") or input_data.get("max_slope_deg")
        return safety_gate.evaluate(
            health_assessment=input_data.get("health") or input_data.get("vitals"),
            eva_plan=input_data.get("eva_plan"),
            environment_assessment=input_data.get("environment"),
            terrain_assessment=input_data.get("terrain"),
            radiation_assessment=input_data.get("radiation"),
            comms_assessment=input_data.get("comms"),
            max_slope_deg=slope,
            total_duration_min=dur,
            eva_limit_min=limit,
        )
    return safety_gate.evaluate(**kwargs)
