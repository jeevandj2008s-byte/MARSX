import type {
  ElevationProfilePoint,
  MissionConfig,
  MissionMetricsSummary,
  PlanetaryCoordinates,
  RouteSegmentTelemetry,
  RouteWaypoint,
  ScienceTarget,
  ScientificLayer,
  TerrainWarning,
} from '../types/mission';

/**
 * IAU 2000 Mars mean equatorial radius in metres (3,396.19 km)
 */
export const MARS_EQUATORIAL_RADIUS_M = 3_396_190;

/**
 * Perceptually uniform Viridis colormap stops (0.0 -> 1.0)
 * Strictly used for MOLA elevation rendering (no rainbow or jet).
 */
export const VIRIDIS_STOPS: ReadonlyArray<[number, number, number]> = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 73, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [181, 222, 43],
  [253, 231, 37],
];

/**
 * Perceptually uniform Cividis colormap stops (0.0 -> 1.0)
 * Strictly used for derived terrain slope rendering (color-vision deficiency safe).
 */
export const CIVIDIS_STOPS: ReadonlyArray<[number, number, number]> = [
  [0, 32, 76],
  [0, 54, 111],
  [42, 73, 108],
  [76, 91, 107],
  [104, 109, 113],
  [131, 128, 121],
  [160, 149, 119],
  [191, 171, 107],
  [224, 196, 86],
  [253, 234, 69],
];

export function interpolateColormap(
  t: number,
  stops: ReadonlyArray<[number, number, number]>
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  if (idx >= stops.length - 1) {
    return stops[stops.length - 1];
  }
  const a = stops[idx];
  const b = stops[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

export function rgbToCss(rgb: [number, number, number], alpha = 1): string {
  if (alpha >= 1) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Formats planetocentric coordinates into standard planetary notation (e.g. 4.5895°S, 137.4417°E)
 */
export function formatMarsCoordinates(lat: number, lon: number, decimals = 4): string {
  const ns = lat < 0 ? 'S' : 'N';
  const normalizedLon = ((lon % 360) + 360) % 360;
  return `${Math.abs(lat).toFixed(decimals)}°${ns}, ${normalizedLon.toFixed(decimals)}°E`;
}

/**
 * Great-circle surface distance on Mars (IAU 2000 sphere R = 3396.19 km) using Haversine formula.
 * Returns distance in metres.
 */
export function calculateMarsSurfaceDistanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return MARS_EQUATORIAL_RADIUS_M * c;
}

/**
 * Continuous MOLA / HRSC Digital Elevation Model approximation for Jezero Crater & Western Delta Traverse.
 * Anchored to NASA Mars 2020 Perseverance & MOLA / HRSC Jezero elevations:
 * - Octavia E. Butler Landing (18.4447°N, 77.4508°E): ~ -2574 m
 * - Crater Floor Maaz (18.4350°N, 77.4440°E): ~ -2570 m
 * - South Séítah (18.4230°N, 77.4380°E): ~ -2578 m
 * - Three Forks Delta Depot (18.4314°N, 77.4082°E): ~ -2545 m
 * - Hawksbill Gap Delta Scarp (18.4350°N, 77.4055°E): ~ -2530 m
 * - Belva Crater Rim / Delta Top (18.4410°N, 77.3825°E): ~ -2490 m
 * - Neretva Vallis Inflow Channel (18.4552°N, 77.3450°E): ~ -2420 m
 * - Bright Angel Mudstone (18.4520°N, 77.3380°E): ~ -2415 m
 * - Western Crater Rim Lookout Hill (18.4815°N, 77.3010°E): ~ -2070 m
 */
const JEZERO_ANCHORS = [
  { lat: 18.4447, lon: 77.4508, elev: -2574 },
  { lat: 18.4350, lon: 77.4440, elev: -2570 },
  { lat: 18.4230, lon: 77.4380, elev: -2578 },
  { lat: 18.4314, lon: 77.4082, elev: -2545 },
  { lat: 18.4350, lon: 77.4055, elev: -2530 },
  { lat: 18.4410, lon: 77.3825, elev: -2490 },
  { lat: 18.4552, lon: 77.3450, elev: -2420 },
  { lat: 18.4520, lon: 77.3380, elev: -2415 },
  { lat: 18.4815, lon: 77.3010, elev: -2070 },
];

export function sampleJezeroCraterTerrain(lat: number, lon: number): PlanetaryCoordinates {
  const evalElevOnly = (la: number, lo: number): number => {
    // 1. Check exact proximity to reference anchors
    for (const a of JEZERO_ANCHORS) {
      const dLa = la - a.lat;
      const dLo = lo - a.lon;
      const distDegSq = dLa * dLa + dLo * dLo;
      if (distDegSq < 0.00000004) {
        return a.elev;
      }
    }

    // 2. Regional macro-topography of western Jezero Crater
    // Base crater floor elevation ~ -2576m
    // Longitude ramp: westward rise from delta toe (~77.45E) up to crater rim (~77.28E)
    const dLonWest = 77.4508 - lo;
    let westRise = 0;
    if (dLonWest > 0) {
      if (dLonWest < 0.048) {
        // Floor to Three Forks / Delta Scarp toe (slight rise ~30m)
        westRise = Math.pow(dLonWest / 0.048, 1.2) * 31;
      } else if (dLonWest < 0.075) {
        // Delta front scarp up to Belva Rim / Delta top (rise to ~ -2490m)
        const t = (dLonWest - 0.048) / 0.027;
        westRise = 31 + Math.pow(t, 1.1) * 55;
      } else if (dLonWest < 0.115) {
        // Neretva Vallis canyon floor approach (rise to ~ -2415m)
        const t = (dLonWest - 0.075) / 0.040;
        westRise = 86 + Math.pow(t, 1.05) * 75;
      } else {
        // Western crater rim wall ascent up to Lookout Hill and rim crest
        const t = (dLonWest - 0.115) / 0.035;
        westRise = 161 + Math.pow(t, 1.45) * 345;
      }
    } else {
      // East of Butler Landing: flat volcanic plains with minor floor ripples
      westRise = Math.sin((lo - 77.45) * 120) * 4;
    }

    // Latitude gradient: north/south rim bowl effect
    const dLatRim = (la - 18.435) / 0.08;
    const rimFlankRise = Math.pow(Math.abs(dLatRim), 2.2) * 60;

    // Local Belva Crater impact rim relief near 18.44N, 77.382E
    const dBelvaLat = la - 18.441;
    const dBelvaLon = lo - 77.3825;
    const distBelva = Math.sqrt(dBelvaLat * dBelvaLat + dBelvaLon * dBelvaLon);
    const belvaRimEffect = 18 * Math.exp(-Math.pow((distBelva - 0.008) / 0.006, 2));

    const macroElev = -2574 + westRise + rimFlankRise + belvaRimEffect;

    // 3. IDW blending with nearest anchors for smooth local precision
    let sumWeight = 0;
    let sumDelta = 0;
    for (const a of JEZERO_ANCHORS) {
      const dLa = la - a.lat;
      const dLo = (lo - a.lon) * Math.cos((la * Math.PI) / 180);
      const d = Math.sqrt(dLa * dLa + dLo * dLo);
      if (d < 0.025) {
        const w = 1 / Math.pow(d + 0.0003, 2.5);
        // Anchor target elevation delta from macro
        const delta = a.elev - (-2574 + (a.lon < 77.4508 ? Math.pow((77.4508 - a.lon) / 0.15, 1.3) * 504 : 0));
        sumWeight += w;
        sumDelta += w * delta;
      }
    }

    const anchorCorrection = sumWeight > 0 ? (sumDelta / sumWeight) * 0.45 : 0;
    return macroElev + anchorCorrection;
  };

  const elevationM = Math.round(evalElevOnly(lat, lon));

  // Compute numerical gradient for slope (degrees) using ~30m step
  const stepDeg = 0.0005;
  const stepM = (stepDeg * Math.PI * MARS_EQUATORIAL_RADIUS_M) / 180;

  const dzDy = (evalElevOnly(lat + stepDeg, lon) - evalElevOnly(lat - stepDeg, lon)) / (2 * stepM);
  const dzDx =
    (evalElevOnly(lat, lon + stepDeg) - evalElevOnly(lat, lon - stepDeg)) /
    (2 * stepM * Math.cos((lat * Math.PI) / 180));

  const gradMag = Math.sqrt(dzDx * dzDx + dzDy * dzDy);
  const slopeDeg = Number(((Math.atan(gradMag) * 180) / Math.PI).toFixed(1));

  // Roughness proxy derived from slope + local fluvial/deltaic surface texture
  const roughnessM = Number(
    Math.max(
      0.12,
      Math.min(4.5, 0.22 + slopeDeg * 0.13 + Math.abs(Math.sin(lat * 310 + lon * 190)) * 0.3)
    ).toFixed(2)
  );

  return {
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    elevationM,
    slopeDeg,
    roughnessM,
  };
}

/**
 * Backward compatibility alias: sampleGaleCraterTerrain now maps to Jezero Crater terrain
 */
export const sampleGaleCraterTerrain = sampleJezeroCraterTerrain;

/**
 * Computes complete mission metrics, segment telemetry, elevation profile, and terrain warnings
 * from a single shared state source.
 */
export function computeMissionMetrics(
  waypoints: RouteWaypoint[],
  config: MissionConfig,
  targets: ScienceTarget[],
  layers: ScientificLayer[]
): MissionMetricsSummary {
  const selectedTargetsCount = targets.filter((t) => t.selectedForMission).length;
  const availableLayersCount = layers.filter(
    (l) => l.status === 'available' || l.status === 'active'
  ).length;
  const activeLayersCount = layers.filter(
    (l) => l.visible && (l.status === 'available' || l.status === 'active')
  ).length;

  const timeBudgetMinutes = Math.round(config.timeBudgetHours * 60);

  if (waypoints.length < 2) {
    const singleStopMinutes =
      waypoints.length === 1 && waypoints[0].type === 'science-stop'
        ? waypoints[0].dwellMinutes
        : 0;
    const elevationProfile: ElevationProfilePoint[] =
      waypoints.length === 1
        ? [
            {
              cumulativeDistanceM: 0,
              elevationM: waypoints[0].coords.elevationM,
              slopeDeg: waypoints[0].coords.slopeDeg,
              roughnessM: waypoints[0].coords.roughnessM,
              lat: waypoints[0].coords.lat,
              lon: waypoints[0].coords.lon,
              waypointLabel: waypoints[0].label,
            },
          ]
        : [];

    return {
      hasRoute: false,
      oneWayDistanceM: 0,
      totalDistanceM: 0,
      netElevationChangeM: null,
      totalAscentM: 0,
      totalDescentM: 0,
      maxSlopeDeg: waypoints[0]?.coords.slopeDeg ?? 0,
      meanSlopeDeg: waypoints[0]?.coords.slopeDeg ?? 0,
      traverseMinutes: 0,
      scienceStopMinutesTotal: singleStopMinutes,
      contingencyMinutes: config.contingencyMinutes,
      totalDurationMinutes: singleStopMinutes > 0 ? singleStopMinutes + config.contingencyMinutes : 0,
      timeBudgetMinutes,
      remainingBudgetMinutes: timeBudgetMinutes,
      isOverBudget: false,
      budgetUtilizationPct: 0,
      selectedTargetsCount,
      availableLayersCount,
      activeLayersCount,
      segments: [],
      elevationProfile,
      warnings: [],
    };
  }

  const speedMPerMin = Math.max(0.1, (config.walkingSpeedKmh * 1000) / 60);
  const segments: RouteSegmentTelemetry[] = [];
  const elevationProfile: ElevationProfilePoint[] = [];

  let cumulativeDistanceM = 0;
  let oneWayDistanceM = 0;
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxSlopeDeg = 0;
  let weightedSlopeSum = 0;

  // Build effective waypoint sequence (including return leg to start if enabled)
  const sequence: Array<{ wp: RouteWaypoint; isReturn: boolean }> = waypoints.map((wp) => ({
    wp,
    isReturn: false,
  }));

  if (config.includeReturnJourney && waypoints.length >= 2) {
    sequence.push({
      wp: {
        ...waypoints[0],
        id: `${waypoints[0].id}-return`,
        label: `${waypoints[0].label} (Return)`,
      },
      isReturn: true,
    });
  }

  // First point on profile
  elevationProfile.push({
    cumulativeDistanceM: 0,
    elevationM: sequence[0].wp.coords.elevationM,
    slopeDeg: sequence[0].wp.coords.slopeDeg,
    roughnessM: sequence[0].wp.coords.roughnessM,
    lat: sequence[0].wp.coords.lat,
    lon: sequence[0].wp.coords.lon,
    waypointLabel: sequence[0].wp.label,
    isReturnLeg: false,
  });

  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i].wp;
    const to = sequence[i + 1].wp;
    const isReturnLeg = sequence[i + 1].isReturn;

    const segDistM = calculateMarsSurfaceDistanceM(from.coords, to.coords);
    const samplesCount = Math.max(4, Math.min(16, Math.ceil(segDistM / 150)));
    let segMaxSlope = Math.max(from.coords.slopeDeg, to.coords.slopeDeg);
    let segSlopeSum = 0;
    let prevElev = from.coords.elevationM;

    for (let s = 1; s <= samplesCount; s++) {
      const frac = s / samplesCount;
      const lat = from.coords.lat + (to.coords.lat - from.coords.lat) * frac;
      const lon = from.coords.lon + (to.coords.lon - from.coords.lon) * frac;
      const sampled =
        s === samplesCount
          ? to.coords
          : sampleJezeroCraterTerrain(lat, lon);

      const stepElevDiff = sampled.elevationM - prevElev;
      if (stepElevDiff > 0) {
        totalAscentM += stepElevDiff;
      } else {
        totalDescentM += Math.abs(stepElevDiff);
      }
      prevElev = sampled.elevationM;

      if (sampled.slopeDeg > segMaxSlope) {
        segMaxSlope = sampled.slopeDeg;
      }
      segSlopeSum += sampled.slopeDeg;

      elevationProfile.push({
        cumulativeDistanceM: Math.round(cumulativeDistanceM + segDistM * frac),
        elevationM: sampled.elevationM,
        slopeDeg: sampled.slopeDeg,
        roughnessM: sampled.roughnessM,
        lat: sampled.lat,
        lon: sampled.lon,
        waypointLabel: s === samplesCount ? to.label : undefined,
        isReturnLeg,
      });
    }

    const segMeanSlope = Number((segSlopeSum / samplesCount).toFixed(1));
    const deltaElevationM = to.coords.elevationM - from.coords.elevationM;

    // Slope penalty factor on traverse time (1 + 0.03 * meanSlopeDeg) as explicit simulation assumption
    const slopePenaltyFactor = 1 + segMeanSlope * 0.025;
    const traverseMinutes = Math.max(
      1,
      Math.round((segDistM / speedMPerMin) * slopePenaltyFactor)
    );

    const hazardLevel: 'nominal' | 'caution' | 'warning' =
      segMaxSlope >= 15 ? 'warning' : segMaxSlope >= 10 ? 'caution' : 'nominal';

    segments.push({
      index: i + 1,
      fromLabel: from.label,
      toLabel: to.label,
      distanceM: Math.round(segDistM),
      deltaElevationM,
      meanSlopeDeg: segMeanSlope,
      maxSlopeDeg: Number(segMaxSlope.toFixed(1)),
      traverseMinutes,
      isReturnLeg,
      hazardLevel,
    });

    cumulativeDistanceM += segDistM;
    if (!isReturnLeg) {
      oneWayDistanceM += segDistM;
    }
    if (segMaxSlope > maxSlopeDeg) {
      maxSlopeDeg = segMaxSlope;
    }
    weightedSlopeSum += segMeanSlope * segDistM;
  }

  const totalDistanceM = Math.round(cumulativeDistanceM);
  oneWayDistanceM = Math.round(oneWayDistanceM);

  // Net elevation difference is strictly final outbound destination minus start elevation
  const outboundEnd = waypoints[waypoints.length - 1];
  const netElevationChangeM =
    outboundEnd.coords.elevationM - waypoints[0].coords.elevationM;

  const meanSlopeDeg =
    totalDistanceM > 0 ? Number((weightedSlopeSum / totalDistanceM).toFixed(1)) : 0;

  const traverseMinutes = segments.reduce((acc, s) => acc + s.traverseMinutes, 0);
  const scienceStopMinutesTotal = waypoints.reduce((acc, wp) => {
    if (wp.type === 'science-stop' || wp.targetId) {
      return acc + (wp.dwellMinutes > 0 ? wp.dwellMinutes : config.scienceStopMinutes);
    }
    return acc + wp.dwellMinutes;
  }, 0);

  const totalDurationMinutes =
    traverseMinutes + scienceStopMinutesTotal + config.contingencyMinutes;
  const remainingBudgetMinutes = timeBudgetMinutes - totalDurationMinutes;
  const isOverBudget = totalDurationMinutes > timeBudgetMinutes;
  const budgetUtilizationPct =
    timeBudgetMinutes > 0
      ? Math.round((totalDurationMinutes / timeBudgetMinutes) * 100)
      : 0;

  // Build deterministic terrain & time warnings
  const warnings: TerrainWarning[] = [];

  if (isOverBudget) {
    warnings.push({
      id: 'warn-time-budget',
      severity: 'error',
      title: 'Estimated duration exceeds mission time budget',
      detail: `Planned EVA requires ${formatDurationHm(totalDurationMinutes)} against a ${formatDurationHm(timeBudgetMinutes)} budget (overrun of ${formatDurationHm(Math.abs(remainingBudgetMinutes))}). Reduce route length, omit return leg, or adjust time budget.`,
    });
  } else if (budgetUtilizationPct >= 85) {
    warnings.push({
      id: 'warn-time-margin',
      severity: 'warning',
      title: 'Narrow time budget margin',
      detail: `Traverse consumes ${budgetUtilizationPct}% of available mission time (${formatDurationHm(remainingBudgetMinutes)} remaining after contingency).`,
    });
  }

  segments.forEach((seg) => {
    if (seg.maxSlopeDeg >= 15) {
      warnings.push({
        id: `warn-slope-seg-${seg.index}`,
        severity: 'warning',
        title: `Steep scarp gradient on Segment ${seg.index} (${seg.fromLabel} → ${seg.toLabel})`,
        detail: `Derived MOLA/HiRISE slope reaches ${seg.maxSlopeDeg.toFixed(1)}° (mean ${seg.meanSlopeDeg.toFixed(1)}°), exceeding the 15.0° EVA nominal grade threshold.`,
        segmentIndex: seg.index,
      });
    }
  });

  if (Math.abs(netElevationChangeM) >= 350) {
    warnings.push({
      id: 'warn-elev-delta',
      severity: 'info',
      title: 'Substantial vertical relief across outbound traverse',
      detail: `Net elevation difference between start and destination is ${netElevationChangeM > 0 ? '+' : ''}${netElevationChangeM} m (cumulative ascent ${Math.round(totalAscentM)} m).`,
    });
  }

  return {
    hasRoute: true,
    oneWayDistanceM,
    totalDistanceM,
    netElevationChangeM,
    totalAscentM: Math.round(totalAscentM),
    totalDescentM: Math.round(totalDescentM),
    maxSlopeDeg: Number(maxSlopeDeg.toFixed(1)),
    meanSlopeDeg,
    traverseMinutes,
    scienceStopMinutesTotal,
    contingencyMinutes: config.contingencyMinutes,
    totalDurationMinutes,
    timeBudgetMinutes,
    remainingBudgetMinutes,
    isOverBudget,
    budgetUtilizationPct,
    selectedTargetsCount,
    availableLayersCount,
    activeLayersCount,
    segments,
    elevationProfile,
    warnings,
  };
}

export function formatDistanceMetric(distanceM: number): { value: string; unit: string } {
  if (distanceM >= 1000) {
    return {
      value: (distanceM / 1000).toFixed(2),
      unit: 'km',
    };
  }
  return {
    value: `${Math.round(distanceM)}`,
    unit: 'm',
  };
}

export function formatDurationHm(totalMinutes: number): string {
  const abs = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
