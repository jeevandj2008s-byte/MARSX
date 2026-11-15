import type {
  AIMissionBriefing,
  ExplorationRegion,
  MissionConfig,
  MissionMetricsSummary,
  RouteWaypoint,
  ScienceTarget,
  ScientificLayer,
} from '../types/mission';
import { formatDistanceMetric, formatDurationHm, formatMarsCoordinates } from './marsGeospatial';

/**
 * Builds a deterministic, scientifically grounded mission briefing strictly from current
 * application state. Used both as the structured payload context for the server-side Gemini endpoint
 * and as a zero-hallucination fallback when the external AI service is unreachable.
 */
export function buildDeterministicMissionBriefing(params: {
  config: MissionConfig;
  region: ExplorationRegion;
  waypoints: RouteWaypoint[];
  metrics: MissionMetricsSummary;
  targets: ScienceTarget[];
  layers: ScientificLayer[];
  sourceMode?: 'gemini-api' | 'deterministic-fallback';
  modelUsed?: string;
}): AIMissionBriefing {
  const {
    config,
    region,
    waypoints,
    metrics,
    targets,
    layers,
    sourceMode = 'deterministic-fallback',
    modelUsed = 'MARS X MISSION Deterministic Telemetry Compiler',
  } = params;

  const selectedTargets = targets.filter((t) => t.selectedForMission);
  const activeLayers = layers.filter(
    (l) => l.visible && (l.status === 'available' || l.status === 'active')
  );
  const unavailableLayers = layers.filter((l) => l.status === 'unavailable');

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);
  const oneWayFmt = formatDistanceMetric(metrics.oneWayDistanceM);

  const missionSummary = metrics.hasRoute
    ? `Mission ${config.missionId} ("${config.missionName}") is configured in ${region.name} (${region.quadrangle}). The planned ${config.includeReturnJourney ? 'round-trip' : 'one-way'} traverse covers ${distFmt.value} ${distFmt.unit} across ${waypoints.length} waypoints (${selectedTargets.length} selected science targets) with an estimated total duration of ${formatDurationHm(metrics.totalDurationMinutes)} against a ${formatDurationHm(metrics.timeBudgetMinutes)} time budget.`
    : `Mission ${config.missionId} ("${config.missionName}") is staged in ${region.name}. No multi-waypoint traverse route is currently plotted (${waypoints.length} waypoint defined); ${selectedTargets.length} documented scientific targets are flagged for investigation.`;

  const scientificObjectiveSummary =
    selectedTargets.length > 0
      ? `${config.scientificObjective} Primary target units include: ${selectedTargets
          .map((t) => `${t.name} (${t.geologicalUnit}, source: ${t.instrument})`)
          .join('; ')}.`
      : `${config.scientificObjective} Note: Zero cataloged science targets are currently marked as selected in the mission manifest.`;

  const routeSummary = metrics.hasRoute
    ? `Start at ${waypoints[0].label} (${formatMarsCoordinates(waypoints[0].coords.lat, waypoints[0].coords.lon, 4)}, ${waypoints[0].coords.elevationM} m) and terminate outbound at ${waypoints[waypoints.length - 1].label} (${formatMarsCoordinates(waypoints[waypoints.length - 1].coords.lat, waypoints[waypoints.length - 1].coords.lon, 4)}, ${waypoints[waypoints.length - 1].coords.elevationM} m). Outbound distance: ${oneWayFmt.value} ${oneWayFmt.unit}; total distance (${config.includeReturnJourney ? 'including return leg' : 'outbound only'}): ${distFmt.value} ${distFmt.unit}. Net outbound elevation difference: ${metrics.netElevationChangeM !== null ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM} m` : 'N/A'} (cumulative ascent ${metrics.totalAscentM} m, cumulative descent ${metrics.totalDescentM} m).`
    : 'Route geometry is incomplete. Add at least two waypoints on the Planetary Explorer map or Route Planner panel to compute segment distances and elevation differences.';

  const terrainObservations: string[] = [];
  if (metrics.hasRoute) {
    terrainObservations.push(
      `Mean route slope derived from MOLA/stereo topography is ${metrics.meanSlopeDeg.toFixed(1)}° with a maximum segment slope of ${metrics.maxSlopeDeg.toFixed(1)}°.`
    );
    metrics.segments.forEach((seg) => {
      terrainObservations.push(
        `Segment ${seg.index} (${seg.fromLabel} → ${seg.toLabel}): ${seg.distanceM} m, Δz ${seg.deltaElevationM > 0 ? '+' : ''}${seg.deltaElevationM} m, mean slope ${seg.meanSlopeDeg.toFixed(1)}° (max ${seg.maxSlopeDeg.toFixed(1)}°), estimated ${seg.traverseMinutes} min [${seg.hazardLevel.toUpperCase()}].`
      );
    });
  } else {
    terrainObservations.push(
      `Regional elevation domain for ${region.name} spans ${region.elevationRangeM[0]} m to ${region.elevationRangeM[1]} m referenced to the Mars IAU 2000 areoid.`
    );
  }

  const timeBudgetAssessment = metrics.hasRoute
    ? metrics.isOverBudget
      ? `OVER BUDGET WARNING: Total estimated duration of ${formatDurationHm(metrics.totalDurationMinutes)} (traverse ${formatDurationHm(metrics.traverseMinutes)} + science stops ${formatDurationHm(metrics.scienceStopMinutesTotal)} + contingency ${formatDurationHm(metrics.contingencyMinutes)}) exceeds the configured ${formatDurationHm(metrics.timeBudgetMinutes)} budget by ${formatDurationHm(Math.abs(metrics.remainingBudgetMinutes))} (${metrics.budgetUtilizationPct}% utilization).`
      : `WITHIN TIME BUDGET: Total estimated duration is ${formatDurationHm(metrics.totalDurationMinutes)} (${metrics.traverseMinutes}m translation, ${metrics.scienceStopMinutesTotal}m science dwell, ${metrics.contingencyMinutes}m contingency), leaving ${formatDurationHm(metrics.remainingBudgetMinutes)} margin (${metrics.budgetUtilizationPct}% of ${formatDurationHm(metrics.timeBudgetMinutes)} budget).`
    : `Available time budget is set to ${formatDurationHm(metrics.timeBudgetMinutes)} with a ${config.contingencyMinutes} min contingency reserve. Traverse time consumption requires an active route.`;

  const assumptions: string[] = [
    `Baseline translation speed is a configurable simulation assumption set to ${config.walkingSpeedKmh.toFixed(1)} km/h (${config.mobilityMode}) with a +2.5% duration penalty per degree of mean segment slope; this is NOT validated astronaut biomechanical performance data.`,
    `Science observation stops assume ${config.scienceStopMinutes} min default dwell time per station unless overridden at individual waypoints.`,
    `Contingency reserve is fixed at ${config.contingencyMinutes} min regardless of distance from staging base.`,
    `Coordinate distances are calculated as great-circle surface arcs on the IAU 2000 Mars sphere (R = 3,396.19 km) without meter-scale obstacle avoidance detours.`,
  ];

  const missingInformation: string[] = [
    ...unavailableLayers.map(
      (l) => `${l.name} (${l.shortCode}): ${l.unavailableReason ?? 'Dataset not integrated.'}`
    ),
    'Sub-meter boulder field distribution and wheel/boot sinkage resistance (regolith bearing capacity) are not resolved by regional MOLA/CTX layers.',
    'Real-time solar particle event (SPE) forecasting and live surface anemometer telemetry are not connected; environmental panel displays historical MSL archival context only.',
  ];

  const planningConsiderations: string[] = [
    ...metrics.warnings.map((w) => `[${w.severity.toUpperCase()}] ${w.title}: ${w.detail}`),
    activeLayers.length > 0
      ? `Active visual verification layers (${activeLayers.map((l) => l.shortCode).join(', ')}) should be cross-checked against HiRISE 0.25 m/px sub-frames prior to final scarp ascent.`
      : 'No scientific data layers are currently toggled visible on the map; enable MOLA Elevation or CTX Optical mosaic to verify terrain context.',
    !config.includeReturnJourney && metrics.hasRoute
      ? 'Return journey inclusion is currently DISABLED (one-way traverse simulated). Enable "Include Return Journey" if crew must return to staging base (WP-01) within the same EVA window.'
      : 'Return leg to starting point is included in total distance and duration calculations.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    sourceMode,
    modelUsed,
    missionSummary,
    scientificObjectiveSummary,
    routeSummary,
    terrainObservations,
    timeBudgetAssessment,
    assumptions,
    missingInformation,
    planningConsiderations,
  };
}
