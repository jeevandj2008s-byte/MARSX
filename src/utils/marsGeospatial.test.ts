import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMarsSurfaceDistanceM,
  computeMissionMetrics,
  formatDistanceMetric,
  formatDurationHm,
  formatMarsCoordinates,
  interpolateColormap,
  sampleJezeroCraterTerrain,
  sampleGaleCraterTerrain,
  VIRIDIS_STOPS,
  CIVIDIS_STOPS,
} from './marsGeospatial';
import {
  INITIAL_MISSION_CONFIG,
  INITIAL_ROUTE_WAYPOINTS,
  INITIAL_SCIENCE_TARGETS,
  INITIAL_SCIENTIFIC_LAYERS,
  EXPLORATION_REGIONS,
} from '../data/marsMissionData';
import { buildDeterministicMissionBriefing } from './briefingBuilder';

test('Mars surface distance on IAU 2000 sphere is accurate (~59.27 km per degree latitude)', () => {
  const dist1DegLat = calculateMarsSurfaceDistanceM(
    { lat: -4.0, lon: 137.0 },
    { lat: -5.0, lon: 137.0 }
  );
  // 2 * pi * 3396190 / 360 = 59,274.7 m
  assert.ok(dist1DegLat > 59200 && dist1DegLat < 59350);
});

test('Jezero Crater terrain sampler distinguishes crater floor from western rim elevation', () => {
  const landing = sampleJezeroCraterTerrain(18.4447, 77.4508);
  const deltaTop = sampleJezeroCraterTerrain(18.4410, 77.3825);
  const rimPeak = sampleJezeroCraterTerrain(18.4815, 77.3010);

  assert.ok(landing.elevationM < -2550, 'Landing floor should be below -2550 m');
  assert.ok(deltaTop.elevationM > landing.elevationM, 'Delta top should be higher than Landing');
  assert.ok(rimPeak.elevationM > -2100, 'Lookout Hill rim peak should be above -2100 m');
});

test('Perceptually uniform Viridis and Cividis colormaps clamp and interpolate cleanly', () => {
  assert.deepEqual(interpolateColormap(0, VIRIDIS_STOPS), [68, 1, 84]);
  assert.deepEqual(interpolateColormap(1, VIRIDIS_STOPS), [253, 231, 37]);
  assert.deepEqual(interpolateColormap(0, CIVIDIS_STOPS), [0, 32, 76]);
  assert.deepEqual(interpolateColormap(1, CIVIDIS_STOPS), [253, 234, 69]);
});

test('Mission metrics engine separates net elevation difference from total ascent and detects budget overrun', () => {
  const metrics = computeMissionMetrics(
    INITIAL_ROUTE_WAYPOINTS,
    INITIAL_MISSION_CONFIG,
    INITIAL_SCIENCE_TARGETS,
    INITIAL_SCIENTIFIC_LAYERS
  );

  assert.equal(metrics.hasRoute, true);
  assert.ok(metrics.totalDistanceM > 9000 && metrics.totalDistanceM < 12000);
  const expectedNetDelta =
    INITIAL_ROUTE_WAYPOINTS[INITIAL_ROUTE_WAYPOINTS.length - 1].coords.elevationM -
    INITIAL_ROUTE_WAYPOINTS[0].coords.elevationM;
  assert.equal(metrics.netElevationChangeM, expectedNetDelta);
  assert.ok(metrics.totalAscentM >= Math.max(0, expectedNetDelta));
  assert.equal(metrics.selectedTargetsCount, 9);
  assert.equal(metrics.availableLayersCount, 11);

  // Test return journey & tight budget triggering over-budget warning
  const tightMetrics = computeMissionMetrics(
    INITIAL_ROUTE_WAYPOINTS,
    { ...INITIAL_MISSION_CONFIG, includeReturnJourney: true, timeBudgetHours: 4.0 },
    INITIAL_SCIENCE_TARGETS,
    INITIAL_SCIENTIFIC_LAYERS
  );
  assert.equal(tightMetrics.isOverBudget, true);
  assert.ok(tightMetrics.totalDistanceM > metrics.totalDistanceM);
  assert.ok(tightMetrics.warnings.some((w) => w.id === 'warn-time-budget'));
});

test('Empty route state returns hasRoute=false and null netElevationChangeM', () => {
  const emptyMetrics = computeMissionMetrics(
    [],
    INITIAL_MISSION_CONFIG,
    INITIAL_SCIENCE_TARGETS,
    INITIAL_SCIENTIFIC_LAYERS
  );
  assert.equal(emptyMetrics.hasRoute, false);
  assert.equal(emptyMetrics.totalDistanceM, 0);
  assert.equal(emptyMetrics.netElevationChangeM, null);
});

test('Deterministic briefing compiler produces complete structured fields without hallucination', () => {
  const metrics = computeMissionMetrics(
    INITIAL_ROUTE_WAYPOINTS,
    INITIAL_MISSION_CONFIG,
    INITIAL_SCIENCE_TARGETS,
    INITIAL_SCIENTIFIC_LAYERS
  );
  const briefing = buildDeterministicMissionBriefing({
    config: INITIAL_MISSION_CONFIG,
    region: EXPLORATION_REGIONS[INITIAL_MISSION_CONFIG.regionId],
    waypoints: INITIAL_ROUTE_WAYPOINTS,
    metrics,
    targets: INITIAL_SCIENCE_TARGETS,
    layers: INITIAL_SCIENTIFIC_LAYERS,
  });

  assert.ok(briefing.missionSummary.includes(INITIAL_MISSION_CONFIG.missionId));
  assert.ok(briefing.assumptions.length >= 3);
  assert.ok(briefing.missingInformation.length >= 2);
  assert.ok(briefing.missingInformation.some((m) => m.includes('boulder') || m.includes('solar')));
  assert.equal(formatMarsCoordinates(18.4447, 77.4508, 4), '18.4447°N, 77.4508°E');
  assert.deepEqual(formatDistanceMetric(12450), { value: '12.45', unit: 'km' });
  assert.equal(formatDurationHm(135), '2h 15m');
});
