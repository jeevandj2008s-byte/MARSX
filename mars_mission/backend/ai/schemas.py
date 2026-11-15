"""Typed Pydantic schemas for ROVERSE: Mars Surface Exploration Planning System.

NASA Space Apps Challenge 2026: "Interplanetary Survival Guide: Martian Map"
Demo Region: Gale Crater / Mount Sharp
Demo Mission: "Boxwork Discovery Expedition"
Proposed Educational Simulation - Not a real NASA astronaut mission.

CORE RULE: The AI never calculates or invents numbers. Distance, duration, slope,
elevation and radiation values come strictly from supplied data. The AI only explains,
summarizes, and gives planning insights from it.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


# ==============================================================================
# 1. CONTEXT CONTRACT SCHEMAS (Teammate Input)
# ==============================================================================

class MissionContext(BaseModel):
    """Mission metadata for the exploration scenario."""
    name: Optional[str] = Field(
        default="Boxwork Discovery Expedition (SAMPLE)",
        description="Mission designation or code name",
    )
    region: Optional[str] = Field(
        default="Gale Crater / Mount Sharp (SAMPLE)",
        description="Martian geographic region",
    )
    objective: Optional[str] = Field(
        default="Traverse from base to boxwork formation, survey secondary contact, and return to base.",
        description="Primary exploration objective",
    )


class LocationContext(BaseModel):
    """Current focus site or basecamp coordinates and geology."""
    lat: Optional[float] = Field(default=None, description="Martian latitude (-90 to +90)")
    lon: Optional[float] = Field(default=None, description="Martian longitude (-180 to +180 or 0 to 360)")
    site_name: Optional[str] = Field(default=None, description="Landmark or site name")
    elevation_m: Optional[float] = Field(default=None, description="Elevation relative to Martian datum (MOLA)")
    geological_unit: Optional[str] = Field(default=None, description="Geological formation or rock unit")
    description: Optional[str] = Field(default=None, description="General notes or observations")


class Waypoint(BaseModel):
    """Ordered waypoint along a planned EVA route."""
    id: Optional[str] = Field(default=None, description="Unique waypoint identifier, e.g. 'wp-base'")
    name: Optional[str] = Field(default=None, description="Waypoint name, e.g. 'Base Camp Alpha'")
    lat: float = Field(..., description="Martian latitude")
    lon: float = Field(..., description="Martian longitude")
    type: Optional[Literal["base", "science", "return", "checkpoint", "hazard"]] = Field(
        default="science",
        description="Waypoint role: 'base' | 'science' | 'return' | 'checkpoint' | 'hazard'",
    )
    elevation_m: Optional[float] = Field(default=None, description="Elevation in meters (from supplied data)")
    sequence: Optional[int] = Field(default=1, description="Order along route")
    label: Optional[str] = Field(default=None, description="Alternative label for backwards compatibility")
    reason: Optional[str] = Field(default=None, description="Navigational or scientific reason")
    hazard_notes: Optional[str] = Field(default=None, description="Known hazards at this point")
    is_mandatory: Optional[bool] = Field(default=True, description="Whether this waypoint must be visited")


class RouteSegment(BaseModel):
    """Segment connecting two ordered waypoints with supplied metrics."""
    from_waypoint_id: Optional[str] = Field(default=None, description="Origin waypoint ID")
    to_waypoint_id: Optional[str] = Field(default=None, description="Destination waypoint ID")
    distance_km: Optional[float] = Field(default=None, description="Supplied segment distance in km")
    elevation_change_m: Optional[float] = Field(default=None, description="Supplied net elevation change in meters")
    max_slope_deg: Optional[float] = Field(default=None, description="Supplied maximum slope in degrees")
    estimated_minutes: Optional[float] = Field(default=None, description="Supplied duration estimate in minutes")
    notes: Optional[str] = Field(default=None, description="Supplied terrain or operational segment notes")


class RouteTotals(BaseModel):
    """Aggregate route metrics supplied by teammates' route logic."""
    distance_km: Optional[float] = Field(default=None, description="Total traverse distance in km")
    elevation_change_m: Optional[float] = Field(default=None, description="Total cumulative elevation change in m")
    max_slope_deg: Optional[float] = Field(default=None, description="Maximum slope encountered on traverse")
    estimated_minutes: Optional[float] = Field(default=None, description="Total estimated duration in minutes")


class RouteContext(BaseModel):
    """Planned traverse route with ordered waypoints, segments, and supplied totals."""
    route_id: str = Field(default="route-1", description="Unique route identifier")
    name: Optional[str] = Field(default="Planned Traverse", description="Name of the route")
    waypoints: Optional[List[Waypoint]] = Field(default_factory=list, description="Ordered waypoints")
    segments: Optional[List[RouteSegment]] = Field(default_factory=list, description="Ordered segments")
    totals: Optional[RouteTotals] = Field(default=None, description="Supplied route totals")

    # Backward compatibility fields
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None
    max_slope_deg: Optional[float] = None
    elevation_gain_m: Optional[float] = None
    elevation_loss_m: Optional[float] = None


class ScienceTarget(BaseModel):
    """High-interest geological or astrobiological feature."""
    id: str = Field(..., description="Unique target identifier, e.g. 'target-boxwork-1'")
    name: str = Field(..., description="Target name, e.g. 'Mount Sharp Boxwork Ridge'")
    lat: Optional[float] = Field(default=None, description="Martian latitude")
    lon: Optional[float] = Field(default=None, description="Martian longitude")
    description: Optional[str] = Field(default=None, description="Morphological or visual description")
    geology_notes: Optional[str] = Field(default=None, description="Geological hypothesis, mineralogy or context")


class LayerData(BaseModel):
    """Standardized multi-mission layer envelope."""
    available: Optional[bool] = Field(default=False, description="Whether this layer data is available")
    source: Optional[str] = Field(default=None, description="NASA mission or instrument source (e.g. 'HiRISE', 'MOLA', 'RAD')")
    observation_date: Optional[str] = Field(default=None, description="Date or sol of observation")
    resolution: Optional[str] = Field(default=None, description="Spatial resolution, e.g. '0.25 m/pixel'")
    units: Optional[str] = Field(default=None, description="Measurement units, e.g. 'm', 'deg', 'μSv/hr'")
    value: Optional[Any] = Field(default=None, description="Supplied measurement, summary or reading")
    summary: Optional[str] = Field(default=None, description="Brief narrative summary of layer observation")

    # Optional backward compatibility shortcuts
    source_mission: Optional[str] = None
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    dose_rate_uSv_hr: Optional[float] = None
    air_temperature_c: Optional[float] = None
    ground_temperature_c: Optional[float] = None
    wind_speed_mps: Optional[float] = None
    roughness_index: Optional[float] = None
    slope_classification: Optional[str] = None
    terrain_type: Optional[str] = None
    boulder_hazard: Optional[str] = None
    hazard_level: Optional[str] = None
    optical_depth_tau: Optional[float] = None
    ice_detected: Optional[bool] = None
    relay_satellite_visible: Optional[bool] = None


class MissionLayers(BaseModel):
    """Collection of NASA multi-mission layers for ROVERSE."""
    optical: Optional[LayerData] = None
    elevation: Optional[LayerData] = None
    slope: Optional[LayerData] = None
    thermal: Optional[LayerData] = None
    mineralogy: Optional[LayerData] = None
    radiation: Optional[LayerData] = None

    # Backward compatibility keys
    imagery: Optional[LayerData] = None
    weather: Optional[LayerData] = None
    dust: Optional[LayerData] = None
    lighting: Optional[LayerData] = None
    water_ice: Optional[LayerData] = None
    comms: Optional[LayerData] = None


class AstronautConstraints(BaseModel):
    """Simulation constraints for suited explorer planning."""
    crew_size: Optional[int] = 1
    suit_oxygen_capacity_hours: Optional[float] = 8.0
    suit_power_capacity_hours: Optional[float] = 7.0
    nominal_walking_speed_kmh: Optional[float] = 2.5
    rover_supported: Optional[bool] = False


class MapContext(BaseModel):
    """Master ROVERSE Map Context. All fields optional."""
    mission: Optional[MissionContext] = Field(default_factory=MissionContext)
    location: Optional[LocationContext] = None
    route: Optional[RouteContext] = None
    science_targets: Optional[List[ScienceTarget]] = Field(default_factory=list)
    layers: Optional[MissionLayers] = None
    astronaut_constraints: Optional[AstronautConstraints] = Field(default_factory=AstronautConstraints)
    custom_notes: Optional[str] = None


# ==============================================================================
# 2. RESPONSE METADATA & STRUCTURED OUTPUT SCHEMAS
# ==============================================================================

class ResponseMetadata(BaseModel):
    """Telemetry metadata tracking multi-provider chain execution."""
    provider_used: str = Field(default="offline", description="Active provider that answered ('gemini', 'groq', 'openrouter', 'mistral', 'ollama', 'offline')")
    model_used: str = Field(default="deterministic-template", description="Model or template source used")
    degraded: bool = Field(default=False, description="True if primary provider failed or offline mode was activated")
    fallback_reason: Optional[str] = Field(default=None, description="Short, safe diagnostic if fallback occurred")
    latency_ms: int = Field(default=0, description="Execution latency in milliseconds")


class BaseAIResponse(BaseModel):
    """Base class providing uniform metadata on every AI response."""
    provider_used: Optional[str] = "offline"
    model_used: Optional[str] = "deterministic-template"
    degraded: Optional[bool] = False
    fallback_reason: Optional[str] = None
    latency_ms: Optional[int] = 0
    metadata: Optional[ResponseMetadata] = None
    response_metadata: Optional[ResponseMetadata] = None


class HazardItem(BaseModel):
    """Specific hazard flagged from supplied data."""
    type: str = Field(description="Hazard type (e.g. Steep Slope, Boulder Density, Historical Radiation, Thermal Cold)")
    severity: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"] = Field(description="Severity based strictly on supplied metrics")
    location: str = Field(description="Location or waypoint where hazard is present")
    source_layer: str = Field(description="NASA mission/layer source citing the observation")
    mitigation: str = Field(description="Actionable planning insight or operational recommendation")


class BriefingWaypoint(BaseModel):
    """Waypoint summarized in mission briefing."""
    lat: float = Field(description="Martian latitude")
    lon: float = Field(description="Martian longitude")
    label: str = Field(description="Waypoint name or identifier")
    reason: str = Field(description="Planning reason or scientific objective")


class TimelineEvent(BaseModel):
    """Chronological EVA timeline step."""
    time_offset_min: int = Field(description="Supplied or reference elapsed time in minutes")
    action: str = Field(description="Planned exploration task")
    safety_checkpoint: str = Field(description="Operational check")
    consumable_status: str = Field(description="Supplied reserve status or reference limit")


class ConsumablesBudget(BaseModel):
    """Reference life-support envelope based strictly on supplied route duration."""
    estimated_duration_hours: float = Field(description="Supplied route duration in hours")
    oxygen_consumed_percent: float = Field(description="Reference oxygen consumed percentage")
    oxygen_reserve_margin_percent: float = Field(description="Reference safety reserve margin")
    battery_consumed_percent: float = Field(description="Reference battery capacity consumed")
    safe_return_deadline_minutes: int = Field(description="Calculated turn-around checkpoint from supplied duration")


class MissionBriefing(BaseAIResponse):
    """Complete structured mission briefing produced by AI."""
    summary: str = Field(description="Concise 2-3 sentence mission overview grounded in supplied data")
    risk_level: Literal["LOW", "MODERATE", "HIGH", "EXTREME"] = Field(description="Overall mission risk evaluation")
    go_no_go: Literal["GO", "CAUTION", "NO-GO"] = Field(description="Operational planning decision")
    hazards: List[HazardItem] = Field(default_factory=list, description="Hazards identified from supplied layers")
    waypoints: List[BriefingWaypoint] = Field(default_factory=list, description="Traverse waypoints")
    eva_timeline: List[TimelineEvent] = Field(default_factory=list, description="Chronological mission schedule")
    consumables: ConsumablesBudget = Field(description="Reference consumables envelope based on supplied metrics")
    science_opportunities: List[str] = Field(default_factory=list, description="Science opportunities derived from targets")
    data_gaps: List[str] = Field(default_factory=list, description="Missing mission sensor data or unmapped layers")
    data_limitations: List[str] = Field(
        default_factory=list,
        description="Explicit caveats: thermal data is not a live forecast; historical radiation is not future exposure; simulation disclaimer.",
    )
    confidence: float = Field(default=0.85, description="Confidence score from 0.0 to 1.0 based on data completeness")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
        description="Standard simulation disclaimer",
    )


class ExplainTargetResponse(BaseAIResponse):
    """Structured response for POST /api/ai/explain-target."""
    target_id: str = Field(description="Target identifier")
    target_name: str = Field(description="Target name")
    geological_significance: str = Field(description="Explanation of geological formation based on supplied notes")
    scientific_hypothesis: str = Field(description="Working exploration hypothesis (e.g. hydrothermal or groundwater mineral veins)")
    sampling_recommendations: List[str] = Field(default_factory=list, description="Suggested in-situ measurements or sample priorities")
    source_layer_citations: List[str] = Field(default_factory=list, description="NASA source layers cited")
    data_limitations: List[str] = Field(default_factory=list, description="Data gaps and uncertainty notes")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
    )


class TerrainSummaryResponse(BaseAIResponse):
    """Structured response for POST /api/ai/terrain-summary."""
    region_overview: str = Field(description="Narrative overview of Gale Crater / Mount Sharp region")
    layer_summaries: Dict[str, str] = Field(default_factory=dict, description="Summary per supplied mission layer")
    terrain_roughness_and_slopes: str = Field(description="Summary of elevation, slope, and optical surface features")
    environmental_considerations: str = Field(description="Thermal inertia, mineralogy, and historical radiation context")
    source_layer_citations: List[str] = Field(default_factory=list, description="Citations of available layers")
    data_limitations: List[str] = Field(default_factory=list, description="Unmapped layers and simulation caveats")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
    )


class SegmentInsight(BaseModel):
    """Insight for an individual route segment."""
    segment_id: str
    from_to: str
    distance_km: Optional[float] = None
    max_slope_deg: Optional[float] = None
    steepness_flag: bool = Field(description="True if slope exceeds nominal threshold (e.g. >12°)")
    long_segment_flag: bool = Field(description="True if segment duration or length is elevated")
    planning_insights: str = Field(description="Operational traverse considerations")


class RouteInsightsResponse(BaseAIResponse):
    """Structured response for POST /api/ai/route-insights."""
    route_name: str = Field(description="Name of the analyzed route")
    summary_of_metrics: str = Field(description="Summary of supplied distance, slopes, and duration totals")
    steep_segments: List[str] = Field(default_factory=list, description="Segments flagged with steep slopes")
    long_segments: List[str] = Field(default_factory=list, description="Segments flagged with long duration/distance")
    segment_insights: List[SegmentInsight] = Field(default_factory=list, description="Detailed per-segment breakdown")
    return_trip_considerations: str = Field(description="Fatigue, reverse slope gradients, and turn-around margin analysis")
    planning_insights: List[str] = Field(default_factory=list, description="Tactical recommendations")
    data_limitations: List[str] = Field(default_factory=list, description="Data gaps affecting route analysis")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
    )


class ReportResponse(BaseAIResponse):
    """Structured response for POST /api/ai/report."""
    mission_name: str = Field(description="Mission title")
    executive_summary: str = Field(description="Executive summary suitable for downloadable report")
    geological_context: str = Field(description="Geological background and significance of targets")
    route_assessment: str = Field(description="Route metrics explanation and segment breakdown")
    environmental_and_hazard_evaluation: str = Field(description="Evaluation of slopes, thermal data, and historical radiation")
    science_target_dossier: str = Field(description="Summary of designated science targets")
    operational_recommendations: str = Field(description="EVA timeline, checklists, and safe return planning")
    data_limitations: List[str] = Field(default_factory=list, description="Full disclosure of data voids and assumptions")
    full_report_markdown: str = Field(description="Complete report formatted as GitHub-flavored Markdown")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
    )


class RouteEvaluation(BaseModel):
    """Comparative analysis of an individual candidate route."""
    route_id: str = Field(description="ID of the candidate route")
    rank: int = Field(description="Rank order (1 = Best)")
    score_out_of_100: int = Field(description="Composite score (0-100)")
    verdict: Literal["RECOMMENDED", "VIABLE_WITH_CAUTION", "NOT_RECOMMENDED"] = Field(description="Verdict")
    pros: List[str] = Field(default_factory=list, description="Advantages of this route")
    cons: List[str] = Field(default_factory=list, description="Drawbacks or risks")
    hazard_summary: str = Field(description="Key hazards along path")
    recommendation_rationale: str = Field(description="Why this route received this ranking")


class RouteAdviceResponse(BaseAIResponse):
    """Structured response comparing 2-3 candidate routes."""
    recommended_route_id: str = Field(description="The primary recommended route ID")
    routes_ranked: List[RouteEvaluation] = Field(default_factory=list, description="Ranked candidate routes")
    strategic_advice: str = Field(description="Strategic tactical advice")
    data_gaps_identified: List[str] = Field(default_factory=list, description="Data gaps affecting routing confidence")
    data_limitations: List[str] = Field(default_factory=list, description="Explicit caveats and simulation notices")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
    )


class HealthAssistResponse(BaseAIResponse):
    """Response for POST /api/ai/health-assist."""
    is_emergency: bool = Field(description="True if a critical red-flag emergency was triggered")
    triaged_category: str = Field(description="Category: 'RED_FLAG_EMERGENCY', 'HYDRATION', 'THERMAL', 'FATIGUE', 'RADIATION', 'GENERAL'")
    guidance: str = Field(description="Operational health and safety guidance from curated protocols")
    recommended_action: str = Field(description="Immediate action for explorer or mission operator")
    emergency_steps: List[str] = Field(default_factory=list, description="Step-by-step emergency actions if applicable")
    data_limitations: List[str] = Field(default_factory=list, description="Caveats and disclosures")
    simulation_notice: str = Field(
        default="ROVERSE Educational Simulation: Not medical advice. In any real emergency on Earth, contact local emergency services immediately."
    )


# ==============================================================================
# 3. API REQUEST ENVELOPES
# ==============================================================================

class ChatMessage(BaseModel):
    role: Literal["user", "model", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=5000, description="User prompt or question")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Conversation history")
    map_context: Optional[MapContext] = Field(default=None, description="Active ROVERSE map context")


class BriefingRequest(BaseModel):
    map_context: Optional[MapContext] = Field(default=None, description="Active map context and layers")
    candidate_route: Optional[RouteContext] = Field(default=None, description="Optional specific route override")


class ExplainTargetRequest(BaseModel):
    target_id: Optional[str] = Field(default=None, description="Target ID to explain from context")
    target: Optional[ScienceTarget] = Field(default=None, description="Direct target object if not in map_context")
    map_context: Optional[MapContext] = Field(default=None, description="Surrounding map context and layers")


class TerrainSummaryRequest(BaseModel):
    map_context: Optional[MapContext] = Field(default=None, description="Active map context and layers")


class RouteInsightsRequest(BaseModel):
    route: Optional[RouteContext] = Field(default=None, description="Route to analyze with segments and totals")
    map_context: Optional[MapContext] = Field(default=None, description="Surrounding map context")


class ReportRequest(BaseModel):
    map_context: Optional[MapContext] = Field(default=None, description="Full map context for complete report generation")


class RouteAdviceRequest(BaseModel):
    candidate_routes: List[RouteContext] = Field(..., min_length=1, description="Candidate routes to compare")
    map_context: Optional[MapContext] = Field(default=None, description="Active map context")


class HealthAssistRequest(BaseModel):
    query: str = Field(..., max_length=1000, description="Astronaut health question or symptom description")
    vital_signs: Optional[Dict[str, Any]] = Field(default=None, description="Optional telemetry (heart rate, SpO2, suit pressure)")
    map_context: Optional[MapContext] = Field(default=None, description="Surrounding map context")


class TerrainAnalysisRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded PNG or JPEG image")
    mime_type: Optional[str] = Field(default="image/jpeg", description="MIME type")
    map_context: Optional[MapContext] = Field(default=None, description="Context")


# ==============================================================================
# 4. HEALTH & STATUS SCHEMAS
# ==============================================================================

class HealthStatus(BaseModel):
    status: str
    project: str = "ROVERSE - Mars Surface Exploration Planning System"
    provider: str
    gemini_model: str
    local_model: Optional[str] = None
    demo_mode: bool
    api_key_configured: bool
    version: str = "2.1.0"


class ProviderStatus(BaseModel):
    name: str
    configured: bool
    healthy: bool
    circuit_state: Literal["closed", "open", "disabled"]
    configured_models: List[str] = Field(default_factory=list)
    verified_models: List[str] = Field(default_factory=list)
    last_error: Optional[str] = None


class SystemStatusResponse(BaseModel):
    status: str = "operational"
    project: str = "ROVERSE - Mars Surface Exploration Planning System"
    active_provider_order: List[str] = Field(default_factory=list)
    providers: Dict[str, ProviderStatus] = Field(default_factory=dict)
    demo_mode: bool = False
    circuit_breakers_active: List[str] = Field(default_factory=list)
    timestamp: float = 0.0


# ==============================================================================
# 5. ORCHESTRATION & SAFETY COMMANDER SCHEMAS
# ==============================================================================

class ProvenanceNumber(BaseModel):
    name: Optional[str] = None
    value: Any = None
    unit: Optional[str] = None
    status: Literal["Observed", "Derived", "Interpreted", "Simulated", "Assumed"] = "Derived"
    source: Optional[str] = None
    date: Optional[str] = None
    resolution: Optional[str] = None
    limitation: Optional[str] = None


class SafetyAlternative(BaseModel):
    fix_type: str
    description: str
    time_saved_min: Optional[float] = None


class DecisionAuditRecord(BaseModel):
    decision_id: str
    timestamp: str
    event_type: str
    inputs_hash: str
    tools_called: List[str] = Field(default_factory=list)
    rules_fired_count: int = 0
    verdict: str
    provider_used: str
    latency_ms: float
    data_limitations: List[str] = Field(default_factory=list)


class OrchestrateEvent(BaseModel):
    event_type: Literal[
        "area_selected",
        "route_changed",
        "waypoint_added",
        "parameter_changed",
        "vitals_updated",
        "environment_update",
        "report_requested",
        "chat",
    ] = Field(..., description="Orchestration trigger event type")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Event payload data")
    map_context: Optional[MapContext] = Field(default=None, description="Optional map context")


class OrchestrateResponse(BaseModel):
    decision_id: str
    event_type: str
    verdict: Literal["GO", "CAUTION", "NO-GO", "ABORT"] = "GO"
    confidence: float = 1.0
    degraded: bool = False
    reasons: List[str] = Field(default_factory=list)
    numbers: List[ProvenanceNumber] = Field(default_factory=list)
    alternatives: List[SafetyAlternative] = Field(default_factory=list)
    data_limitations: List[str] = Field(default_factory=list)
    simulation_notice: str = "Simulation data only. Not certified for flight operations."
    provider_used: str = "ai_mission_commander"
    latency_ms: float = 0.0
    summary: Optional[str] = None
    emergency_protocol: Optional[Dict[str, Any]] = None
    recommended_route: Optional[Dict[str, Any]] = None
    candidates: Optional[List[Dict[str, Any]]] = None
    terrain: Optional[Dict[str, Any]] = None
    environment: Optional[Dict[str, Any]] = None
    radiation: Optional[Dict[str, Any]] = None
    comms: Optional[Dict[str, Any]] = None
    health_state: Optional[Dict[str, Any]] = None
    report: Optional[Dict[str, Any]] = None
    reply: Optional[str] = None


class AreaAnalysisRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    polygon: Optional[List[List[float]]] = None
    radius_km: Optional[float] = 2.0
    map_context: Optional[MapContext] = None


class RouteOptimizeRequest(BaseModel):
    scenario: Optional[Dict[str, Any]] = None
    route: Optional[RouteContext] = None
    constraints: Optional[Dict[str, Any]] = None
    site: Optional[str] = "jezero"
    map_context: Optional[MapContext] = None


class HealthStateRequest(BaseModel):
    vitals: Optional[Dict[str, Any]] = None
    query: Optional[str] = None
    map_context: Optional[MapContext] = None
