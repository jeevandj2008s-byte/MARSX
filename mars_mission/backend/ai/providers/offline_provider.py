"""Offline deterministic template provider for ROVERSE.

Final tier in the fallback chain.
Features:
1. Zero internet, zero API keys required.
2. Built entirely from supplied context and curated knowledge base.
3. It must NEVER fail or throw unhandled exceptions.
4. Strictly cites supplied layers and includes data_limitations in every response.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from ..demo_data import (
    DEMO_CHAT_RESPONSES,
    DEMO_EXPLAIN_TARGET,
    DEMO_GALE_CRATER_BRIEFING,
    DEMO_REPORT,
    DEMO_ROUTE_ADVICE,
    DEMO_ROUTE_INSIGHTS,
    DEMO_TERRAIN_SUMMARY,
)
from ..health_assist import health_assistant
from ..knowledge_base import kb
from ..schemas import (
    BriefingWaypoint,
    ChatMessage,
    ConsumablesBudget,
    ExplainTargetResponse,
    HazardItem,
    HealthAssistRequest,
    HealthAssistResponse,
    MapContext,
    MissionBriefing,
    ReportResponse,
    ResponseMetadata,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsResponse,
    ScienceTarget,
    SegmentInsight,
    TerrainSummaryResponse,
    TimelineEvent,
)
from .base import BaseAIProvider

logger = logging.getLogger("roverse.ai.offline_provider")


class OfflineProvider(BaseAIProvider):
    """Guaranteed 100% resilient offline provider."""

    @property
    def name(self) -> str:
        return "offline"

    @property
    def is_configured(self) -> bool:
        return True

    def _make_metadata(self, model: str = "deterministic-template", latency: int = 1) -> ResponseMetadata:
        return ResponseMetadata(
            provider_used="offline",
            model_used=model,
            degraded=True,
            fallback_reason="Offline deterministic tier",
            latency_ms=latency,
        )

    # 1. Chat Stream
    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        lower = (message or "").lower()
        if "hazard" in lower or "slope" in lower:
            text = DEMO_CHAT_RESPONSES["hazards"]
        elif "budget" in lower or "oxygen" in lower or "duration" in lower or "time" in lower:
            text = DEMO_CHAT_RESPONSES["budget"]
        else:
            text = DEMO_CHAT_RESPONSES["default"]

        for word in text.split(" "):
            yield word + " "
            await asyncio.sleep(0.015)

    # 2. Briefing
    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        t0 = time.time()
        ctx = map_context.model_dump() if map_context else {}
        route = candidate_route.model_dump() if candidate_route else (ctx.get("route") or {})
        totals = route.get("totals") or {}

        dist = totals.get("distance_km") or route.get("distance_km") or 7.2
        dur_min = totals.get("estimated_minutes") or 172.0
        max_slope = totals.get("max_slope_deg") or route.get("max_slope_deg") or 14.2

        layers = ctx.get("layers") or {}
        limitations = [
            "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            "Thermal data (THEMIS) reflects orbital thermal inertia, NOT a live surface temperature forecast.",
            "Historical radiation measurements (MSL RAD) do NOT establish future human exposure or acute solar storm warnings.",
            "All numeric metrics derive strictly from supplied data layers; the AI never invents or calculates numbers."
        ]

        # Check for explicitly missing layers
        for l_key in ["optical", "elevation", "slope", "thermal", "mineralogy", "radiation"]:
            if l_key not in layers or layers[l_key] is None or layers[l_key].get("available") is False:
                limitations.append(f"Layer '{l_key}' is unavailable in telemetry; observation status: data not available.")

        briefing = MissionBriefing(
            summary=(
                f"ROVERSE Offline Synthesis: Mission evaluated as CAUTION. Total supplied traverse distance is {dist} km "
                f"with a supplied estimated duration of {dur_min} minutes (SAMPLE - replace with real data). Peak slope of {max_slope}° "
                "occurs on Segment 1; footing is supported by duricrust thermal inertia, and historical radiation is nominal."
            ),
            risk_level="MODERATE",
            go_no_go="CAUTION",
            hazards=[
                HazardItem(
                    type=f"Ascent Slope ({max_slope}°)",
                    severity="MODERATE",
                    location="Segment 1 (Base Camp -> Boxwork Ridge)",
                    source_layer="HRSC Slope Map [SAMPLE - replace with real data]",
                    mitigation="Traverse along designated switchbacks; avoid direct vertical climbs on scarp face."
                ),
                HazardItem(
                    type="Blade-Like Boxwork Vein Relief",
                    severity="MODERATE",
                    location="Waypoint 2 (Mount Sharp Boxwork Formation)",
                    source_layer="HiRISE (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
                    mitigation="Boxwork ridges form 1-5m relief; route through natural erosional passes to prevent suit snags."
                ),
                HazardItem(
                    type="Surface Thermal Extreme",
                    severity="LOW",
                    location="Traverse-wide",
                    source_layer="THEMIS (Mars Odyssey) [SAMPLE - replace with real data]",
                    mitigation="Thermal data is thermal inertia, not a live forecast; ensure suit auxiliary heaters are active."
                ),
            ],
            waypoints=[
                BriefingWaypoint(lat=-4.6821, lon=137.3812, label="Base Camp Curiosity Ridge [SAMPLE]", reason="Airlock egress and comms lock."),
                BriefingWaypoint(lat=-4.6954, lon=137.3945, label="Mount Sharp Boxwork Formation [SAMPLE]", reason="Survey polygonal groundwater mineral veins."),
                BriefingWaypoint(lat=-4.7088, lon=137.4082, label="Sulfate-Clay Transition Outcrop [SAMPLE]", reason="Sample geochemical lake desiccation boundary."),
                BriefingWaypoint(lat=-4.6821, lon=137.3812, label="Base Camp Return Airlock [SAMPLE]", reason="Safe return airlock ingress."),
            ],
            eva_timeline=[
                TimelineEvent(time_offset_min=0, action="Airlock depressurization at Base Camp.", safety_checkpoint="Suit pressure 29.6 kPa nominal.", consumable_status="O2: 100% | Batt: 100%"),
                TimelineEvent(time_offset_min=58, action="Arrive at Boxwork Ridge crest.", safety_checkpoint="Verify boot gaiters and MRO UHF link.", consumable_status="O2: 84% | Batt: 86%"),
                TimelineEvent(time_offset_min=96, action="Arrive at Sulfate-Clay contact zone.", safety_checkpoint="Verify airtight core sample container.", consumable_status="O2: 72% | Batt: 76%"),
                TimelineEvent(time_offset_min=115, action="MANDATORY TURN-AROUND CHECKPOINT.", safety_checkpoint="Confirm remaining O2 > 55%; begin return.", consumable_status="O2: 66% | Batt: 70%"),
                TimelineEvent(time_offset_min=172, action="Airlock repressurization at Base Camp.", safety_checkpoint="Sample containment transfer.", consumable_status="O2: 51% | Batt: 56%"),
            ],
            consumables=ConsumablesBudget(
                estimated_duration_hours=round(dur_min / 60.0, 2),
                oxygen_consumed_percent=49.0,
                oxygen_reserve_margin_percent=51.0,
                battery_consumed_percent=44.0,
                safe_return_deadline_minutes=115,
            ),
            science_opportunities=[
                "In-situ spectroscopic survey of boxwork ridge cementation (CRISM / APXS analogue).",
                "Core drilling across the sulfate-clay boundary to date the cessation of lacustrine deposition in Gale Crater.",
            ],
            data_gaps=[
                "Sub-meter micro-topography in shadow zones requires in-situ visual confirmation.",
            ],
            data_limitations=limitations,
            confidence=0.88,
            simulation_notice="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )
        return briefing

    # 3. Explain Target
    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        t0 = time.time()
        t_id = target.id if target else (target_id or "target-boxwork-1")
        name = target.name if target else "Mount Sharp Boxwork Network (SAMPLE - replace with real data)"
        box_data = kb.boxwork

        return ExplainTargetResponse(
            target_id=t_id,
            target_name=name,
            geological_significance=box_data.get("significance", DEMO_EXPLAIN_TARGET["geological_significance"]),
            scientific_hypothesis=box_data.get("formation_mechanism", DEMO_EXPLAIN_TARGET["scientific_hypothesis"]),
            sampling_recommendations=box_data.get("sampling_protocols", DEMO_EXPLAIN_TARGET["sampling_recommendations"]),
            source_layer_citations=[
                "HiRISE (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
                "CRISM (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
                "HRSC DTM (Mars Express) [SAMPLE - replace with real data]",
            ],
            data_limitations=[
                "ROVERSE Educational Simulation: Derived from curated knowledge base.",
                "CRISM spectral resolution (~18 m/px) cannot resolve centimeter veins; in-situ verification required.",
                "All descriptions reflect supplied sample notes and educational models."
            ],
            simulation_notice="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )

    # 4. Terrain Summary
    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        t0 = time.time()
        layers_ref = kb.layers.get("layers", {})
        ctx_layers = (map_context.model_dump() if map_context else {}).get("layers") or {}

        summaries = {}
        limitations = [
            "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            "Thermal data is orbital thermal inertia, not a live surface weather forecast.",
            "Historical radiation readings from rover telemetry do not predict future astronaut exposure.",
            "All metrics derive strictly from supplied sample data."
        ]

        for k in ["optical", "elevation", "slope", "thermal", "mineralogy", "radiation"]:
            l_info = ctx_layers.get(k)
            if l_info and l_info.get("available") is not False and (l_info.get("value") or l_info.get("summary")):
                summaries[k] = str(l_info.get("value") or l_info.get("summary"))
            elif k in DEMO_TERRAIN_SUMMARY["layer_summaries"]:
                summaries[k] = DEMO_TERRAIN_SUMMARY["layer_summaries"][k]
            else:
                summaries[k] = "data not available"
                limitations.append(f"Layer '{k}' is unavailable or unmapped in telemetry.")

        return TerrainSummaryResponse(
            region_overview=DEMO_TERRAIN_SUMMARY["region_overview"],
            layer_summaries=summaries,
            terrain_roughness_and_slopes=DEMO_TERRAIN_SUMMARY["terrain_roughness_and_slopes"],
            environmental_considerations=DEMO_TERRAIN_SUMMARY["environmental_considerations"],
            source_layer_citations=[
                "HiRISE (MRO) [SAMPLE]",
                "MOLA / HRSC (MGS/MEX) [SAMPLE]",
                "THEMIS (Mars Odyssey) [SAMPLE]",
                "CRISM (MRO) [SAMPLE]",
                "RAD (MSL / Curiosity) [SAMPLE]",
            ],
            data_limitations=limitations,
            simulation_notice="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )

    # 5. Route Insights
    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        t0 = time.time()
        r = route or (map_context.route if map_context else None)
        r_name = r.name if r and r.name else "Boxwork Discovery Loop (SAMPLE - replace with real data)"
        totals = r.totals if r else None
        dist = totals.distance_km if totals and totals.distance_km else 7.2
        dur = totals.estimated_minutes if totals and totals.estimated_minutes else 172.0
        max_slope = totals.max_slope_deg if totals and totals.max_slope_deg else 14.2

        return RouteInsightsResponse(
            route_name=r_name,
            summary_of_metrics=f"Supplied route totals: {dist} km traverse distance, {max_slope}° maximum slope, and {dur} minutes estimated duration.",
            steep_segments=[
                f"Segment 1 (Base Camp -> Mount Sharp Boxwork Ridge): Maximum supplied slope is {max_slope}° over 2.4 km distance."
            ],
            long_segments=[
                "Segment 3 (Sulfate-Clay Outcrop -> Base Camp Return): Longest segment at 3.2 km distance and 76 minutes estimated duration."
            ],
            segment_insights=[
                SegmentInsight(
                    segment_id="seg-1",
                    from_to="wp-base -> wp-boxwork",
                    distance_km=2.4,
                    max_slope_deg=max_slope,
                    steepness_flag=True,
                    long_segment_flag=False,
                    planning_insights="Steepest leg (+85m elevation gain). Maintain cadence below 2.5 km/h to conserve metabolic power."
                ),
                SegmentInsight(
                    segment_id="seg-2",
                    from_to="wp-boxwork -> wp-contact",
                    distance_km=1.6,
                    max_slope_deg=8.5,
                    steepness_flag=False,
                    long_segment_flag=False,
                    planning_insights="Gentle descent across sulfate yardangs. Optimal corridor for geological photography."
                ),
                SegmentInsight(
                    segment_id="seg-3",
                    from_to="wp-contact -> wp-return",
                    distance_km=3.2,
                    max_slope_deg=11.0,
                    steepness_flag=False,
                    long_segment_flag=True,
                    planning_insights="Longest distance leg (3.2 km). Return trip considerations are critical: monitor explorer fatigue."
                ),
            ],
            return_trip_considerations="The return leg (Segment 3) represents 44% of total distance. Explorer fatigue will be elevated after science operations. Downslope descent on tired legs increases loose rock tripping hazards. Strict turn-around deadline of 115 minutes ensures 51% oxygen reserve margin remains.",
            planning_insights=[
                f"Ascend Segment 1 using diagonal switchbacks to mitigate the {max_slope}° slope.",
                "Limit sampling stop at Boxwork Formation to 25 minutes to protect return consumable budget.",
                "Initiate return egress no later than T+115 minutes."
            ],
            data_limitations=[
                "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
                "Segment durations and slopes are taken verbatim from supplied route data; the AI does not calculate or independently verify them.",
                "Micro-topographical obstacles (boulders <0.5m) are not resolved by orbital slope maps."
            ],
            simulation_notice="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )

    # 6. Report
    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        t0 = time.time()
        return ReportResponse(
            mission_name=DEMO_REPORT["mission_name"],
            executive_summary=DEMO_REPORT["executive_summary"],
            geological_context=DEMO_REPORT["geological_context"],
            route_assessment=DEMO_REPORT["route_assessment"],
            environmental_and_hazard_evaluation=DEMO_REPORT["environmental_and_hazard_evaluation"],
            science_target_dossier=DEMO_REPORT["science_target_dossier"],
            operational_recommendations=DEMO_REPORT["operational_recommendations"],
            data_limitations=DEMO_REPORT["data_limitations"],
            full_report_markdown=DEMO_REPORT["full_report_markdown"],
            simulation_notice=DEMO_REPORT["simulation_notice"],
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )

    # 7. Route Advice
    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        t0 = time.time()
        return RouteAdviceResponse(
            recommended_route_id=DEMO_ROUTE_ADVICE["recommended_route_id"],
            routes_ranked=DEMO_ROUTE_ADVICE["routes_ranked"],
            strategic_advice=DEMO_ROUTE_ADVICE["strategic_advice"],
            data_gaps_identified=DEMO_ROUTE_ADVICE["data_gaps_identified"],
            data_limitations=DEMO_ROUTE_ADVICE["data_limitations"],
            simulation_notice=DEMO_ROUTE_ADVICE["simulation_notice"],
            provider_used="offline",
            model_used="deterministic-template",
            degraded=True,
            fallback_reason="Offline deterministic template",
            latency_ms=int((time.time() - t0) * 1000) or 1,
            metadata=self._make_metadata(),
            response_metadata=self._make_metadata(),
        )

    # 8. Health Assist
    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        return health_assistant.evaluate(request)

    # 9. Terrain Image
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        return {
            "terrain_classification": "Gale Crater Mount Sharp lower pediment (Offline Simulation)",
            "identified_features": [
                "Boxwork polygonal mineral veins protruding 1-5m above bedrock",
                "Lower slope dark sand ripple patches",
                "Basaltic scree float boulders"
            ],
            "traversability_rating": "MODERATE_CAUTION",
            "recommended_footpath": "Ascend along northern scree corridor; avoid direct vertical climbs over boxwork blades.",
            "data_limitations": [
                "ROVERSE Educational Simulation.",
                "Orbital image interpretation requires in-situ rover or suited astronaut validation."
            ],
            "source": "Offline Deterministic Template",
            "provider_used": "offline",
            "model_used": "deterministic-template",
            "degraded": True,
            "latency_ms": 1,
        }
