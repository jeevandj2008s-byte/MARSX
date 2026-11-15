import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Database,
  Layers,
  Mountain,
  Radiation,
  Route,
  ShieldAlert,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import { formatMarsCoordinates } from '../../utils/marsGeospatial';
import { ElevationProfile } from './ElevationProfile';
import {
  BAND_NOTE,
  LayerMetadata,
  SLOPE_BANDS,
  STATUS,
} from '../../terrainIntelligence';

export const TerrainAnalysis: React.FC = () => {
  const {
    metrics,
    inspectedPoint,
    currentRegion,
    waypoints,
    terrainEngine,
    terrainQuery,
  } = useMission();

  const [activeSubTab, setActiveSubTab] = useState<'diagnostics' | 'classes' | 'sources'>(
    'diagnostics'
  );

  // Radiation display from engine
  const radDisplay = useMemo(() => {
    if (!terrainEngine) {
      return {
        available: false,
        text: 'Data unavailable',
        label: 'Historical rover measurement',
        limitations: 'Historical rover measurement; not a prediction for an astronaut.',
      };
    }
    return terrainEngine.radiationDisplay();
  }, [terrainEngine]);

  // Layers metadata and placeholder check
  const metadataList: LayerMetadata[] = terrainEngine?.meta || [];
  const hasPlaceholders = metadataList.some((m) =>
    Object.values(m).some((v) => typeof v === 'string' && v.includes('REPLACE_WITH'))
  );

  // Slope distribution based on SLOPE_BANDS
  const slopeBuckets = SLOPE_BANDS.map((b) => ({
    ...b,
    count: 0,
  }));

  const profileSamples = metrics.elevationProfile;
  profileSamples.forEach((pt) => {
    for (const b of slopeBuckets) {
      if (pt.slopeDeg >= b.min && pt.slopeDeg < b.max) {
        b.count += 1;
        break;
      }
    }
  });

  const totalSamples = Math.max(1, profileSamples.length);

  // Donut geometry for slope distribution
  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedOffset = 0;
  const donutSegments = slopeBuckets.map((b) => {
    const fraction = b.count / totalSamples;
    const dashLength = fraction * donutCircumference;
    const offset = -accumulatedOffset;
    accumulatedOffset += dashLength;
    return {
      ...b,
      pct: Math.round(fraction * 100),
      dashLength,
      offset,
    };
  });

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header with Epistemic Distinction Notice */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-caps tracking-[0.2em]">Topographic & Geomorphic Intelligence</span>
            <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/20 text-[#FFF4E6] border border-white/25 font-bold">
              Offline Data Pipeline
            </span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            Terrain Intelligence — {currentRegion.name}
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 max-w-3xl leading-relaxed font-sans">
            Traceable digital elevation, derived slope gradients, and rule-based candidate geomorphic units. Distinguishes observed orbital altimetry from derived terrain models and simulation scores.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('diagnostics')}
            className={`px-3.5 py-1.5 rounded-[12px] text-[12.5px] font-semibold transition-all cursor-pointer ${
              activeSubTab === 'diagnostics'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'glass-nested border border-white/15 text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/15'
            }`}
          >
            Diagnostics
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('classes')}
            className={`px-3.5 py-1.5 rounded-[12px] text-[12.5px] font-semibold transition-all cursor-pointer ${
              activeSubTab === 'classes'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'glass-nested border border-white/15 text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/15'
            }`}
          >
            Terrain Units
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('sources')}
            className={`px-3.5 py-1.5 rounded-[12px] text-[12.5px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'sources'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'glass-nested border border-white/15 text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/15'
            }`}
          >
            <Database size={13} strokeWidth={1.75} />
            <span>Data Sources</span>
            {hasPlaceholders && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: DIAGNOSTICS & ELEVATION PROFILE */}
      {activeSubTab === 'diagnostics' && (
        <div className="space-y-3.5 sm:space-y-4">
          {/* Top Key Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between">
                <span className="label-caps">Net Elevation Δz</span>
                <span className="font-mono-tabular text-[10.5px] text-emerald-300 font-semibold">
                  {STATUS.slope}
                </span>
              </div>
              <div className="text-[26px] sm:text-[28px] font-bold font-mono-tabular text-[#FFF4E6] mt-1.5 leading-none">
                {metrics.netElevationChangeM !== null
                  ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM} m`
                  : 'Unavailable'}
              </div>
              <p className="text-[12px] text-[#FFF4E6]/75 mt-1.5 leading-snug font-sans">
                Net elevation difference between endpoints (Observed DEM)
              </p>
            </div>

            <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between">
                <span className="label-caps">Traverse Ascent/Descent</span>
                <span className="font-mono-tabular text-[10.5px] text-[#FFF4E6]/80 font-semibold">
                  {STATUS.difficulty}
                </span>
              </div>
              <div className="text-[24px] sm:text-[26px] font-bold font-mono-tabular text-[#FFF4E6] mt-1.5 leading-none">
                {metrics.hasRoute
                  ? `+${metrics.totalAscentM}m / -${metrics.totalDescentM}m`
                  : 'Unavailable'}
              </div>
              <p className="text-[12px] text-[#FFF4E6]/75 mt-1.5 leading-snug font-sans">
                Cumulative vertical travel (Simulated game score)
              </p>
            </div>

            <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between">
                <span className="label-caps">Mean / Peak Slope</span>
                <span className="font-mono-tabular text-[10.5px] text-emerald-300 font-semibold">
                  {STATUS.slope}
                </span>
              </div>
              <div
                className={`text-[26px] sm:text-[28px] font-bold font-mono-tabular mt-1.5 leading-none ${
                  metrics.maxSlopeDeg >= 15
                    ? 'text-amber-200'
                    : 'text-[#FFF4E6]'
                }`}
              >
                {metrics.hasRoute
                  ? `${metrics.meanSlopeDeg.toFixed(1)}° / ${metrics.maxSlopeDeg.toFixed(1)}°`
                  : 'Unavailable'}
              </div>
              <p className="text-[12px] text-[#FFF4E6]/75 mt-1.5 leading-snug font-sans">
                First-derivative gradient magnitude (Derived from DEM)
              </p>
            </div>

            <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between">
                <span className="label-caps">Selected Point</span>
                <span className="font-mono-tabular text-[10.5px] text-emerald-300 font-semibold">
                  {STATUS.elevation}
                </span>
              </div>
              <div className="text-[22px] sm:text-[24px] font-bold font-mono-tabular text-[#FFF4E6] mt-1.5 leading-none">
                {terrainQuery?.elevation_m != null
                  ? `${terrainQuery.elevation_m} m · ${terrainQuery.slope_deg?.toFixed(1) ?? '—'}°`
                  : terrainQuery?.status === 'outside_region'
                  ? 'Outside Region'
                  : `${inspectedPoint.elevationM} m · ${inspectedPoint.slopeDeg.toFixed(1)}°`}
              </div>
              <p className="text-[11.5px] font-mono-tabular text-[#FFF4E6]/75 mt-1.5 leading-snug">
                {formatMarsCoordinates(inspectedPoint.lat, inspectedPoint.lon, 4)}
              </p>
            </div>
          </div>

          {/* Elevation Profile Chart */}
          <ElevationProfile />

          {/* Slope Distribution & Epistemic Classification */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Slope Distribution with Prototype Bands */}
            <div className="lg:col-span-6 glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#FFF4E6]">
                      Traverse Slope Distribution (Prototype Bands)
                    </h2>
                    <p className="text-[12px] text-[#FFF4E6]/75 mt-0.5">
                      Percentage of sampled route points within each difficulty band
                    </p>
                  </div>
                  <span className="font-mono-tabular text-[12px] text-[#FFF4E6]/75 shrink-0">
                    {metrics.hasRoute ? `${metrics.elevationProfile.length} samples` : 'No route'}
                  </span>
                </div>

                {!metrics.hasRoute ? (
                  <div className="py-10 text-center text-[13px] text-[#FFF4E6]/75">
                    Plot at least two waypoints to compute slope distribution along the traverse.
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <div className="glass-nested rounded-[16px] p-4 flex flex-col 2xl:flex-row items-center gap-4 border border-white/15">
                      <div className="relative w-[116px] h-[116px] shrink-0">
                        <svg viewBox="0 0 116 116" className="w-full h-full -rotate-90">
                          <circle
                            cx="58"
                            cy="58"
                            r={donutRadius}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.15)"
                            strokeWidth="16"
                          />
                          {donutSegments.map(
                            (seg) =>
                              seg.dashLength > 0 && (
                                <circle
                                  key={seg.label}
                                  cx="58"
                                  cy="58"
                                  r={donutRadius}
                                  fill="none"
                                  stroke={seg.color}
                                  strokeWidth="16"
                                  strokeDasharray={`${seg.dashLength} ${donutCircumference}`}
                                  strokeDashoffset={seg.offset}
                                />
                              )
                          )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-mono-tabular text-[18px] font-bold text-[#FFF4E6]">
                            {metrics.meanSlopeDeg.toFixed(1)}°
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 w-full text-[12px] font-mono-tabular">
                        {donutSegments.map((seg) => (
                          <div key={seg.label} className="flex items-center justify-between gap-2 min-w-0">
                            <span className="flex items-center gap-2 text-[#FFF4E6] min-w-0 font-medium">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: seg.color }}
                              />
                              <span className="truncate">{seg.label} ({seg.min}°–{seg.max}°)</span>
                            </span>
                            <span className="text-[#FFF4E6]/75 shrink-0 font-bold">{seg.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {slopeBuckets.map((b) => {
                        const pct = Math.round((b.count / totalSamples) * 100);
                        return (
                          <div key={b.label} className="space-y-1">
                            <div className="flex items-center justify-between text-[11.5px] font-mono-tabular">
                              <span className="text-[#FFF4E6] font-medium">{b.label} ({b.min}°–{b.max}°)</span>
                              <span className="text-[#FFF4E6]/75">
                                {b.count} pts ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-black/25 rounded-full overflow-hidden border border-white/15">
                              <div
                                style={{
                                  width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
                                  backgroundColor: b.color,
                                }}
                                className="h-full rounded-full transition-all duration-200"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Crucial Note */}
              <div className="pt-3 border-t border-white/15 text-[11px] font-mono-tabular text-[#FFF4E6]/70 leading-relaxed">
                {BAND_NOTE}
              </div>
            </div>

            {/* Epistemic Provenance Classification & Historical Radiation */}
            <div className="lg:col-span-6 space-y-4">
              <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
                <div className="flex items-center gap-2">
                  <Compass size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
                  <h2 className="text-[16px] font-semibold text-[#FFF4E6]">
                    Epistemic Classification & Status Labels
                  </h2>
                </div>

                <div className="divide-y divide-white/15 glass-nested rounded-[16px] text-[12px] border border-white/15">
                  <div className="p-3 space-y-1">
                    <div className="font-mono-tabular text-[12px] font-bold text-emerald-300">
                      1. Observed (DEM Product)
                    </div>
                    <p className="text-[#FFF4E6]/75 leading-relaxed font-sans">
                      Pixel-level surface elevation readings derived directly from calibrated altimetry instruments (MGS MOLA / Mars Express HRSC).
                    </p>
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="font-mono-tabular text-[12px] font-bold text-emerald-300">
                      2. Derived from DEM
                    </div>
                    <p className="text-[#FFF4E6]/75 leading-relaxed font-sans">
                      Numerical gradients (slope angle θ = arctan|∇z|), aspect angles, and spatial window roughness metrics calculated mathematically from the continuous DEM surface.
                    </p>
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="font-mono-tabular text-[12px] font-bold text-[#FFF4E6]">
                      3. Interpreted (Rule-Based Candidate)
                    </div>
                    <p className="text-[#FFF4E6]/75 leading-relaxed font-sans">
                      Automated classification into 5 prototype geomorphic units. Candidate hypotheses requiring validation against high-resolution imagery.
                    </p>
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="font-mono-tabular text-[12px] font-bold text-amber-200">
                      4. Simulated (Game Score)
                    </div>
                    <p className="text-[#FFF4E6]/75 leading-relaxed font-sans">
                      Difficulty bands, astronaut travel times, and traversal energy budgets. These are game simulation assumptions and do not represent NASA rover engineering clearances.
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Surface Radiation Summary */}
              <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radiation size={16} strokeWidth={1.5} className="text-amber-300" />
                    <h3 className="text-[14px] font-semibold text-[#FFF4E6]">
                      Historical Surface Radiation
                    </h3>
                  </div>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/15 text-[#FFF4E6]/80 border border-white/20">
                    Historical rover measurement
                  </span>
                </div>

                <div className="glass-nested rounded-[14px] p-3 text-[12px] space-y-2 border border-white/15">
                  <div className="flex items-center justify-between">
                    <span className="text-[#FFF4E6]/75">Dataset</span>
                    <span className="font-semibold text-[#FFF4E6]">Curiosity RAD Historical Summary</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#FFF4E6]/75">Dose Equivalent</span>
                    <span className="font-mono-tabular font-bold text-amber-200">
                      {radDisplay.available && radDisplay.value != null
                        ? `${radDisplay.value} ${radDisplay.unit}`
                        : 'Data unavailable'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#FFF4E6]/70 pt-1 border-t border-white/15 font-sans">
                    {radDisplay.limitations || 'Historical rover measurement; not a prediction for an astronaut.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Waypoint Schedule Table */}
          <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mountain size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
                <h2 className="text-[16px] font-semibold text-[#FFF4E6]">
                  Waypoint Topographic & Roughness Schedule
                </h2>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/75">
                IAU 2000 Mars Areoid Datum
              </span>
            </div>

            {waypoints.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#FFF4E6]/75">
                No waypoints defined on current route.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="glass-table text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold uppercase tracking-wider">
                      <th className="py-3 px-5 text-left">Station</th>
                      <th className="py-3 px-5 text-left">Role</th>
                      <th className="py-3 px-5 text-left">Planetocentric Coords</th>
                      <th className="py-3 px-5 text-right">Elevation (Observed)</th>
                      <th className="py-3 px-5 text-right">Local Slope (Derived)</th>
                      <th className="py-3 px-5 text-right">Roughness (Derived)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-mono-tabular text-[12.5px]">
                    {waypoints.map((wp, idx) => (
                      <tr
                        key={wp.id}
                        className="hover:bg-white/[0.12] transition-colors duration-150"
                      >
                        <td className="py-3 px-5 text-[#FFF4E6] font-bold">
                          WP-{String(idx + 1).padStart(2, '0')} · {wp.label}
                        </td>
                        <td className="py-3 px-5 text-[12px] text-[#FFF4E6]/75">
                          {wp.type}
                        </td>
                        <td className="py-3 px-5 text-[#FFF4E6]">
                          {formatMarsCoordinates(wp.coords.lat, wp.coords.lon, 4)}
                        </td>
                        <td className="py-3 px-5 text-right text-[#FFF4E6] font-bold">
                          {wp.coords.elevationM} m
                        </td>
                        <td className="py-3 px-5 text-right text-[#FFF4E6]">
                          {wp.coords.slopeDeg.toFixed(1)}°
                        </td>
                        <td className="py-3 px-5 text-right text-[#FFF4E6]">
                          {wp.coords.roughnessM.toFixed(2)} m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CANDIDATE GEOMORPHIC UNITS */}
      {activeSubTab === 'classes' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-[18px] p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-4">
            <div>
              <span className="label-caps tracking-[0.2em]">Terrain Intelligence Classification Engine</span>
              <h2 className="text-[18px] font-bold text-[#FFF4E6] mt-1">
                Five Rule-Based Candidate Geomorphic Units (DEM-only)
              </h2>
              <p className="text-[13px] text-[#FFF4E6]/80 mt-1 leading-relaxed max-w-3xl font-sans">
                Classes are derived mathematically from continuous elevation, gradient, and roughness metrics. Dune fields, sandy mantles, dust-covered terrain, impact craters, and fluvial valleys require optical review and are not auto-generated.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 pt-2">
              <div className="glass-nested rounded-[16px] p-4 border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#4f8f6b]" />
                    Flat Plains
                  </span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/10 text-[#FFF4E6]/75">
                    Confidence: Low
                  </span>
                </div>
                <div className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                  Rule: Slope &lt; 5° AND Relief &lt; 150 m
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  Low slope and low relief at DEM scale. Smooth regional terrain suitable for baseline transit; micro-hazards remain unresolved.
                </p>
              </div>

              <div className="glass-nested rounded-[16px] p-4 border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#c9a24a]" />
                    Moderate Terrain
                  </span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/10 text-[#FFF4E6]/75">
                    Confidence: Low
                  </span>
                </div>
                <div className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                  Rule: Default (unmatched by other criteria)
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  Default class for undulating terrain that matches no specific extreme threshold. Not an individual distinct landform unit.
                </p>
              </div>

              <div className="glass-nested rounded-[16px] p-4 border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#9a5a3a]" />
                    Rough / Rocky (candidate)
                  </span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/10 text-[#FFF4E6]/75">
                    Confidence: Low
                  </span>
                </div>
                <div className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                  Rule: Roughness std ≥ 15 m AND Slope &lt; 20°
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  Based on DEM roughness only; confirm with CTX/HiRISE imagery. Small rocks and block fields are below regional DEM pixel resolution.
                </p>
              </div>

              <div className="glass-nested rounded-[16px] p-4 border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#7b6aa8]" />
                    Mountainous Terrain
                  </span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/10 text-[#FFF4E6]/75">
                    Confidence: Low
                  </span>
                </div>
                <div className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                  Rule: Relief ≥ 150 m AND Slope ≥ 10°
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  High local relief with moderate-to-steep incline representing the flanks of Aeolis Mons and crater rim scarps.
                </p>
              </div>

              <div className="glass-nested rounded-[16px] p-4 border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#d9412f]" />
                    Steep Slopes / Ridges
                  </span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-red-500/20 text-red-200 border border-red-400/30">
                    Confidence: Medium
                  </span>
                </div>
                <div className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                  Rule: Slope ≥ 20°
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  High-gradient escarpments and ridge walls. Slope alone does not prove traversability.
                </p>
              </div>

              <div className="glass-nested rounded-[16px] p-4 border border-dashed border-white/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FFF4E6]/80">Imagery Review Classes</span>
                  <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/10 text-[#FFF4E6]/70">
                    Schema Supported
                  </span>
                </div>
                <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
                  Dune fields, active sand corridors, dust-covered surfaces, and crater interiors are preserved in the schema but not auto-generated without multi-spectral imagery.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: DATA SOURCES & PROVENANCE */}
      {activeSubTab === 'sources' && (
        <div className="space-y-4">
          {hasPlaceholders && (
            <div className="p-4 rounded-[16px] bg-amber-500/20 border border-amber-400/35 flex items-start gap-3">
              <AlertTriangle className="text-amber-300 shrink-0 mt-0.5" size={20} />
              <div className="space-y-1">
                <h3 className="font-semibold text-[#FFF4E6] text-[14px]">
                  Data Source Traceability Notice
                </h3>
                <p className="text-[12px] text-[#FFF4E6]/80 leading-relaxed font-sans">
                  Some dataset entries in <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[#FFF4E6]">layers_metadata.json</code> contain placeholders (<code className="text-[#FFF4E6] font-bold">REPLACE_WITH_*</code>). To enable full scientific traceability, download the Jezero Crater DEM product from USGS Astropedia or NASA PDS and run:
                </p>
                <div className="p-2.5 rounded-[10px] bg-black/50 font-mono text-[11px] text-[#FFF4E6] overflow-x-auto select-all mt-1 border border-white/15">
                  python scripts/process_dem.py --dem raw/jezero_dem.tif --dem-id "MOLA_HRSC_JEZERO_200M" --source-url "https://astrogeology.usgs.gov" --instrument "MOLA / HRSC" --date-range "2001-2024" --out public/data
                </div>
              </div>
            </div>
          )}

          {/* Metadata Listing Table */}
          <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/15 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#FFF4E6]">
                  Registered Data Layers & Sensor Specifications
                </h3>
                <p className="text-[12px] text-[#FFF4E6]/75 mt-0.5">
                  Extracted from <span className="font-mono text-[#FFF4E6]">layers_metadata.json</span>
                </p>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/75">
                {metadataList.length} layers registered
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="glass-table text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">Layer</th>
                    <th className="py-3 px-4 text-left">Source / Product ID</th>
                    <th className="py-3 px-4 text-left">Instrument</th>
                    <th className="py-3 px-4 text-left">Resolution</th>
                    <th className="py-3 px-4 text-left">Units</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Limitations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono-tabular text-[12px]">
                  {metadataList.map((m) => {
                    const isPending = Object.values(m).some(
                      (v) => typeof v === 'string' && v.includes('REPLACE_WITH')
                    );
                    return (
                      <tr key={m.name} className="hover:bg-white/[0.10] transition-colors">
                        <td className="py-3 px-4 font-bold text-[#FFF4E6]">
                          {m.name}
                        </td>
                        <td className="py-3 px-4 text-[#FFF4E6]/85">
                          {isPending ? (
                            <span className="text-amber-200 font-semibold">Pending ingest</span>
                          ) : (
                            <span>{m.source}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#FFF4E6]/80">{m.instrument}</td>
                        <td className="py-3 px-4 text-[#FFF4E6]/80">{m.resolution_m} m</td>
                        <td className="py-3 px-4 text-[#FFF4E6]/80">{m.units}</td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] px-2 py-0.5 rounded-[6px] bg-white/15 text-[#FFF4E6] border border-white/20">
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11.5px] text-[#FFF4E6]/70 max-w-xs truncate" title={m.limitations}>
                          {m.limitations}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
