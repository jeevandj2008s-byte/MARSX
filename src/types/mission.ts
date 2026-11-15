export type ViewId =
  | 'overview'
  | 'explorer'
  | 'terrain'
  | 'targets'
  | 'planner'
  | 'environment'
  | 'assistant'
  | 'reports'
  | 'settings';

export type ExplorationRegionId =
  | 'jezero-crater-floor'
  | 'jezero-western-delta'
  | 'jezero-neretva-vallis'
  | 'gale-aeolis-palus'
  | 'mount-sharp-foothills'
  | 'western-butte-corridor';

export interface PlanetaryCoordinates {
  /** Planetocentric latitude in degrees North (negative for South) */
  lat: number;
  /** East longitude in degrees (0 to 360°E, IAU 2000) */
  lon: number;
  /** MOLA areoid elevation in metres */
  elevationM: number;
  /** Local derived terrain slope in degrees */
  slopeDeg: number;
  /** Local MOLA pulse-width roughness proxy in metres */
  roughnessM: number;
}

export interface ExplorationRegion {
  id: ExplorationRegionId;
  name: string;
  quadrangle: string;
  center: { lat: number; lon: number };
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  elevationRangeM: [number, number];
  crsLabel: string;
  summary: string;
  primarySource: string;
}

export type DataLayerCategory =
  | 'optical'
  | 'topographic'
  | 'thermal'
  | 'spectral'
  | 'environmental';

export type LayerAvailabilityStatus =
  | 'available'
  | 'active'
  | 'loading'
  | 'unavailable'
  | 'error';

export interface ScientificLayer {
  id: string;
  name: string;
  shortCode: string;
  category: DataLayerCategory;
  status: LayerAvailabilityStatus;
  visible: boolean;
  opacity: number;
  source: string;
  instrument: string;
  datasetDate: string;
  spatialResolution: string;
  units?: string;
  colormap?: 'grayscale' | 'viridis' | 'cividis' | 'thermal' | 'spectral';
  valueDomain?: [number, number];
  unavailableReason?: string;
  description: string;
  epistemicStatus?: 'Observed' | 'Derived' | 'Interpreted' | 'Simulated';
}

export type ScienceTargetCategory =
  | 'Stratigraphy'
  | 'Mineralogy'
  | 'Geomorphology'
  | 'Sedimentology'
  | 'Structural Geology';

export interface ScienceTarget {
  id: string;
  name: string;
  code: string;
  regionId: ExplorationRegionId;
  category: ScienceTargetCategory;
  coords: PlanetaryCoordinates;
  description: string;
  scientificSignificance: string;
  source: string;
  instrument: string;
  observationDate: string;
  sol?: number;
  geologicalUnit: string;
  documentedFeatures: string[];
  selectedForMission: boolean;
}

export type WaypointType = 'start' | 'waypoint' | 'science-stop' | 'destination';

export interface RouteWaypoint {
  id: string;
  label: string;
  type: WaypointType;
  coords: PlanetaryCoordinates;
  targetId?: string;
  dwellMinutes: number;
}

export type MobilityMode =
  | 'eva-foot'
  | 'unpressurized-rover-assist'
  | 'pressurized-rover';

export interface MissionConfig {
  missionId: string;
  missionName: string;
  scientificObjective: string;
  regionId: ExplorationRegionId;
  /** Configurable simulation assumption in km/h */
  walkingSpeedKmh: number;
  /** Total available EVA time budget in hours */
  timeBudgetHours: number;
  /** Default science observation stop duration in minutes */
  scienceStopMinutes: number;
  /** Contingency reserve duration in minutes */
  contingencyMinutes: number;
  /** Whether the traverse includes returning to the starting point */
  includeReturnJourney: boolean;
  /** Simulation mobility configuration assumption */
  mobilityMode: MobilityMode;
  /** Explicit demonstration dataset toggle */
  demoMode: boolean;
}

export interface RouteSegmentTelemetry {
  index: number;
  fromLabel: string;
  toLabel: string;
  distanceM: number;
  /** Signed elevation difference (to.elevationM - from.elevationM) */
  deltaElevationM: number;
  meanSlopeDeg: number;
  maxSlopeDeg: number;
  traverseMinutes: number;
  isReturnLeg: boolean;
  hazardLevel: 'nominal' | 'caution' | 'warning';
}

export interface ElevationProfilePoint {
  cumulativeDistanceM: number;
  elevationM: number;
  slopeDeg: number;
  roughnessM: number;
  lat: number;
  lon: number;
  waypointLabel?: string;
  isReturnLeg?: boolean;
}

export interface TerrainWarning {
  id: string;
  severity: 'warning' | 'error' | 'info';
  title: string;
  detail: string;
  segmentIndex?: number;
}

export interface MissionMetricsSummary {
  hasRoute: boolean;
  oneWayDistanceM: number;
  totalDistanceM: number;
  /** Net elevation difference between start and final outbound waypoint (null if <2 points) */
  netElevationChangeM: number | null;
  /** Cumulative positive elevation gain across traverse */
  totalAscentM: number;
  /** Cumulative negative elevation loss across traverse */
  totalDescentM: number;
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  traverseMinutes: number;
  scienceStopMinutesTotal: number;
  contingencyMinutes: number;
  totalDurationMinutes: number;
  timeBudgetMinutes: number;
  remainingBudgetMinutes: number;
  isOverBudget: boolean;
  budgetUtilizationPct: number;
  selectedTargetsCount: number;
  availableLayersCount: number;
  activeLayersCount: number;
  segments: RouteSegmentTelemetry[];
  elevationProfile: ElevationProfilePoint[];
  warnings: TerrainWarning[];
}

export interface EnvironmentalObservation {
  id: string;
  parameter: string;
  category: 'Radiation' | 'Thermal' | 'Atmospheric Pressure' | 'Wind & Dust';
  valueDisplay: string;
  unit: string;
  statusLabel: 'Historical observation' | 'Dataset available' | 'Data unavailable' | 'Requires further validation';
  instrumentSource: string;
  observationPeriod: string;
  notes: string;
  timeSeries?: Array<{ label: string; value: number; secondaryValue?: number }>;
}

export interface AIMissionBriefing {
  generatedAt: string;
  sourceMode: 'gemini-api' | 'deterministic-fallback';
  modelUsed: string;
  missionSummary: string;
  scientificObjectiveSummary: string;
  routeSummary: string;
  terrainObservations: string[];
  timeBudgetAssessment: string;
  assumptions: string[];
  missingInformation: string[];
  planningConsiderations: string[];
}
