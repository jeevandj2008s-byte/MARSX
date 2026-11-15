/**
 * TypeScript Type Definitions for ROVERSE: Mars Surface Exploration Planning System.
 * Matches backend schemas and docs/ai-context-contract.md.
 */

export interface MissionContext {
  name?: string;
  region?: string;
  objective?: string;
}

export interface LocationContext {
  lat?: number;
  lon?: number;
  site_name?: string;
  elevation_m?: number;
  geological_unit?: string;
  description?: string;
}

export interface Waypoint {
  id?: string;
  name?: string;
  lat: number;
  lon: number;
  type?: "base" | "science" | "return" | "checkpoint" | "hazard";
  elevation_m?: number;
  sequence?: number;
  reason?: string;
  label?: string;
  hazard_notes?: string;
  is_mandatory?: boolean;
}

export interface RouteSegment {
  from_waypoint_id?: string;
  to_waypoint_id?: string;
  distance_km?: number;
  elevation_change_m?: number;
  max_slope_deg?: number;
  estimated_minutes?: number;
  notes?: string;
}

export interface RouteTotals {
  distance_km?: number;
  elevation_change_m?: number;
  max_slope_deg?: number;
  estimated_minutes?: number;
}

export interface RouteContext {
  route_id: string;
  name?: string;
  waypoints?: Waypoint[];
  segments?: RouteSegment[];
  totals?: RouteTotals;
  // Backward compatibility
  distance_km?: number;
  estimated_duration_hours?: number;
  max_slope_deg?: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
}

export interface ScienceTarget {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
  description?: string;
  geology_notes?: string;
}

export interface LayerData {
  available?: boolean;
  source?: string;
  observation_date?: string;
  resolution?: string;
  units?: string;
  value?: any;
  summary?: string;
  // Optional backward compatibility
  source_mission?: string;
  elevation_m?: number;
  slope_deg?: number;
  dose_rate_uSv_hr?: number;
  air_temperature_c?: number;
}

export interface MissionLayers {
  optical?: LayerData;
  elevation?: LayerData;
  slope?: LayerData;
  thermal?: LayerData;
  mineralogy?: LayerData;
  radiation?: LayerData;
  // Backward compatibility
  imagery?: LayerData;
  weather?: LayerData;
  dust?: LayerData;
  lighting?: LayerData;
  water_ice?: LayerData;
  comms?: LayerData;
}

export interface AstronautConstraints {
  crew_size?: number;
  suit_oxygen_capacity_hours?: number;
  suit_power_capacity_hours?: number;
  nominal_walking_speed_kmh?: number;
  rover_supported?: boolean;
}

export interface MapContext {
  mission?: MissionContext;
  location?: LocationContext;
  route?: RouteContext;
  science_targets?: ScienceTarget[];
  layers?: MissionLayers;
  astronaut_constraints?: AstronautConstraints;
  custom_notes?: string;
}

// =============================================================================
// Structured Output Types & Multi-Provider Response Metadata
// =============================================================================

export interface ResponseMetadata {
  provider_used: string;
  model_used: string;
  degraded: boolean;
  fallback_reason?: string | null;
  latency_ms: number;
}

export interface HazardItem {
  type: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  location: string;
  source_layer: string;
  mitigation: string;
}

export interface BriefingWaypoint {
  lat: number;
  lon: number;
  label: string;
  reason: string;
}

export interface TimelineEvent {
  time_offset_min: number;
  action: string;
  safety_checkpoint: string;
  consumable_status: string;
}

export interface ConsumablesBudget {
  estimated_duration_hours: number;
  oxygen_consumed_percent: number;
  oxygen_reserve_margin_percent: number;
  battery_consumed_percent: number;
  safe_return_deadline_minutes: number;
}

export interface MissionBriefing {
  summary: string;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  go_no_go: "GO" | "CAUTION" | "NO-GO";
  hazards: HazardItem[];
  waypoints: BriefingWaypoint[];
  eva_timeline: TimelineEvent[];
  consumables: ConsumablesBudget;
  science_opportunities: string[];
  data_gaps: string[];
  data_limitations: string[];
  confidence: number;
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface ExplainTargetResponse {
  target_id: string;
  target_name: string;
  geological_significance: string;
  scientific_hypothesis: string;
  sampling_recommendations: string[];
  source_layer_citations: string[];
  data_limitations: string[];
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface TerrainSummaryResponse {
  region_overview: string;
  layer_summaries: Record<string, string>;
  terrain_roughness_and_slopes: string;
  environmental_considerations: string;
  source_layer_citations: string[];
  data_limitations: string[];
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface SegmentInsight {
  segment_id: string;
  from_to: string;
  distance_km?: number;
  max_slope_deg?: number;
  steepness_flag: boolean;
  long_segment_flag: boolean;
  planning_insights: string;
}

export interface RouteInsightsResponse {
  route_name: string;
  summary_of_metrics: string;
  steep_segments: string[];
  long_segments: string[];
  segment_insights: SegmentInsight[];
  return_trip_considerations: string;
  planning_insights: string[];
  data_limitations: string[];
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface ReportResponse {
  mission_name: string;
  executive_summary: string;
  geological_context: string;
  route_assessment: string;
  environmental_and_hazard_evaluation: string;
  science_target_dossier: string;
  operational_recommendations: string;
  data_limitations: string[];
  full_report_markdown: string;
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface RouteEvaluation {
  route_id: string;
  rank: number;
  score_out_of_100: number;
  verdict: "RECOMMENDED" | "VIABLE_WITH_CAUTION" | "NOT_RECOMMENDED";
  pros: string[];
  cons: string[];
  hazard_summary: string;
  recommendation_rationale: string;
}

export interface RouteAdviceResponse {
  recommended_route_id: string;
  routes_ranked: RouteEvaluation[];
  strategic_advice: string;
  data_gaps_identified: string[];
  data_limitations: string[];
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface HealthAssistRequest {
  query: string;
  vital_signs?: Record<string, any>;
  map_context?: MapContext;
}

export interface HealthAssistResponse {
  is_emergency: boolean;
  triaged_category: string;
  guidance: string;
  recommended_action: string;
  emergency_steps: string[];
  data_limitations: string[];
  simulation_notice: string;
  response_metadata?: ResponseMetadata;
}

export interface ChatMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface HealthStatus {
  status: string;
  project: string;
  provider: string;
  gemini_model: string;
  local_model?: string;
  demo_mode: boolean;
  api_key_configured: boolean;
  version: string;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
  healthy: boolean;
  circuit_state: "closed" | "open" | "disabled";
  configured_models: string[];
  verified_models: string[];
  last_error?: string | null;
}

export interface SystemStatusResponse {
  status: string;
  project: string;
  active_provider_order: string[];
  providers: Record<string, ProviderStatus>;
  demo_mode: boolean;
  circuit_breakers_active: string[];
  timestamp: number;
}


// ==============================================================================
// ORCHESTRATION & MISSION COMMANDER TYPES
// ==============================================================================

export interface ProvenanceNumber {
  name?: string;
  value?: any;
  unit?: string;
  status?: "Observed" | "Derived" | "Interpreted" | "Simulated" | "Assumed";
  source?: string;
  date?: string;
  resolution?: string;
  limitation?: string;
}

export interface SafetyAlternative {
  fix_type: string;
  description: string;
  time_saved_min?: number;
}

export interface DecisionAuditRecord {
  decision_id: string;
  timestamp: string;
  event_type: string;
  inputs_hash: string;
  tools_called: string[];
  rules_fired_count: number;
  verdict: "GO" | "CAUTION" | "NO-GO" | "ABORT";
  provider_used: string;
  latency_ms: number;
  data_limitations: string[];
}

export interface OrchestrateEvent {
  event_type:
    | "area_selected"
    | "route_changed"
    | "waypoint_added"
    | "parameter_changed"
    | "vitals_updated"
    | "environment_update"
    | "report_requested"
    | "chat";
  payload?: Record<string, any>;
  map_context?: MapContext;
}

export interface OrchestrateResponse {
  decision_id: string;
  event_type: string;
  verdict: "GO" | "CAUTION" | "NO-GO" | "ABORT";
  confidence: number;
  degraded: boolean;
  reasons: string[];
  numbers: ProvenanceNumber[];
  alternatives: SafetyAlternative[];
  data_limitations: string[];
  simulation_notice: string;
  provider_used: string;
  latency_ms: number;
  summary?: string;
  emergency_protocol?: {
    triage_category: string;
    recommended_action: string;
    steps: string[];
    fastest_return_route?: any;
  };
  recommended_route?: any;
  candidates?: any[];
  terrain?: any;
  environment?: any;
  radiation?: any;
  comms?: any;
  health_state?: any;
  report?: any;
  reply?: string;
}

export interface EnvironmentSnapshot {
  timestamp: string;
  site: string;
  confidence: number;
  temperature: {
    air_c?: number;
    ground_c?: number;
    status: string;
    source?: string;
    age_hours?: number;
  };
  wind: {
    speed_ms?: number;
    status: string;
    source?: string;
  };
  dust: {
    optical_depth_tau?: number;
    status: string;
    source?: string;
  };
  pressure: {
    kpa?: number;
    status: string;
    source?: string;
  };
  radiation: {
    dose_rate_usvh?: number;
    status: string;
    instrument?: string;
    historical_caveat?: string;
  };
  comms: {
    dte_visible?: boolean;
    active_relays?: number;
    next_pass_min?: number;
    light_delay_sec?: number;
  };
  measures_to_follow: Array<{ condition?: string; measure?: string; source?: string }>;
  caveats: string[];
  data_limitations: string[];
  simulation_notice: string;
}
