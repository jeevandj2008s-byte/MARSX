import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  formatDistanceMetric,
  formatDurationHm,
  formatMarsCoordinates,
} from '../../utils/marsGeospatial';
import { VisualMap360 } from '../map/VisualMap360';
import { ElevationProfile } from '../terrain/ElevationProfile';

interface RouteControlsProps {
  compact?: boolean;
}

export const RouteControls: React.FC<RouteControlsProps> = ({ compact = false }) => {
  const {
    waypoints,
    selectedWaypointId,
    setSelectedWaypointId,
    addWaypointAtCoords,
    addScienceTargetToRoute,
    removeLastWaypoint,
    removeWaypointById,
    updateWaypointDwell,
    clearRoute,
    loadDefaultRoute,
    targets,
    metrics,
    config,
    updateConfig,
    inspectedPoint,
  } = useMission();

  const [customLat, setCustomLat] = useState<string>('18.4447');
  const [customLon, setCustomLon] = useState<string>('77.4508');
  const [selectedTargetToAdd, setSelectedTargetToAdd] = useState<string>(
    targets[0]?.id ?? ''
  );

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);
  const oneWayFmt = formatDistanceMetric(metrics.oneWayDistanceM);

  const handleAddCoordinateWaypoint = (type: 'waypoint' | 'science-stop') => {
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    addWaypointAtCoords(lat, lon, type);
  };

  return (
    <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/15 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Route size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            EVA Traverse Route Controls
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={removeLastWaypoint}
            disabled={waypoints.length === 0}
            className="px-3 py-1.5 rounded-[10px] bg-white/15 hover:bg-white/25 disabled:opacity-40 border border-white/20 text-[#FFF4E6] text-[12px] font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer"
          >
            <Undo2 size={15} strokeWidth={1.75} />
            <span>Remove last</span>
          </button>

          <button
            type="button"
            onClick={clearRoute}
            disabled={waypoints.length === 0}
            className="px-3 py-1.5 rounded-[10px] bg-white/15 hover:bg-red-500/30 disabled:opacity-40 border border-white/20 text-[#FFF4E6] hover:text-red-200 text-[12px] font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer"
          >
            <Trash2 size={15} strokeWidth={1.75} />
            <span>Clear route</span>
          </button>

          {waypoints.length === 0 && (
            <button
              type="button"
              onClick={loadDefaultRoute}
              className="px-3.5 py-1.5 rounded-[10px] bg-[#F0942F] hover:bg-[#F8A749] text-[#FFF4E6] border border-white/30 text-[12px] font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
              <span>Restore baseline route</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/15 divide-y sm:divide-y-0 sm:divide-x divide-white/15 bg-white/[0.05] text-[12px]">
        <div className="p-3.5">
          <span className="label-caps block">Route Distance</span>
          <span className="font-mono-tabular text-[17px] font-bold text-[#FFF4E6] mt-0.5 block">
            {metrics.hasRoute ? `${distFmt.value} ${distFmt.unit}` : 'Unavailable'}
          </span>
          <span className="text-[11px] text-[#FFF4E6]/70">
            {metrics.hasRoute
              ? `Outbound: ${oneWayFmt.value} ${oneWayFmt.unit}`
              : 'Need ≥2 waypoints'}
          </span>
        </div>

        <div className="p-3.5">
          <span className="label-caps block">Estimated Duration</span>
          <span
            className={`font-mono-tabular text-[17px] font-bold mt-0.5 block ${
              metrics.isOverBudget
                ? 'text-red-300'
                : 'text-[#FFF4E6]'
            }`}
          >
            {metrics.hasRoute
              ? formatDurationHm(metrics.totalDurationMinutes)
              : 'Unavailable'}
          </span>
          <span className="text-[11px] text-[#FFF4E6]/70">
            Budget: {formatDurationHm(metrics.timeBudgetMinutes)}
          </span>
        </div>

        <div className="p-3.5">
          <span className="label-caps block">Net Elevation Δz</span>
          <span className="font-mono-tabular text-[17px] font-bold text-[#FFF4E6] mt-0.5 block">
            {metrics.netElevationChangeM !== null
              ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM} m`
              : 'Unavailable'}
          </span>
          <span className="text-[11px] text-[#FFF4E6]/70">
            Ascent: {metrics.totalAscentM} m
          </span>
        </div>

        <div className="p-3.5">
          <span className="label-caps block">Return Journey</span>
          <label className="mt-1.5 inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeReturnJourney}
              onChange={(e) =>
                updateConfig({ includeReturnJourney: e.target.checked })
              }
              className="rounded-[4px] accent-white"
            />
            <span className="font-mono-tabular text-[12px] font-bold text-[#FFF4E6]">
              {config.includeReturnJourney ? 'Included' : 'Outbound only'}
            </span>
          </label>
        </div>
      </div>

      {/* Add Waypoint / Science Target Actions */}
      <div className="p-4 sm:p-5 border-b border-white/15 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="route-lat-input" className="label-caps block mb-1.5">
              Latitude (°N, negative °S)
            </label>
            <input
              id="route-lat-input"
              type="number"
              step="0.005"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-[12px] px-3 py-2 text-[13px] font-mono-tabular text-[#FFF4E6]"
            />
          </div>

          <div>
            <label htmlFor="route-lon-input" className="label-caps block mb-1.5">
              Longitude (°E)
            </label>
            <input
              id="route-lon-input"
              type="number"
              step="0.005"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-[12px] px-3 py-2 text-[13px] font-mono-tabular text-[#FFF4E6]"
            />
          </div>

          <div className="sm:col-span-2 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleAddCoordinateWaypoint('waypoint')}
              className="px-3.5 py-2 rounded-[12px] bg-white/15 hover:bg-white/25 border border-white/20 text-[#FFF4E6] text-[12px] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all duration-150 cursor-pointer"
            >
              <Plus size={16} strokeWidth={1.75} />
              <span>Add waypoint</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddCoordinateWaypoint('science-stop')}
              className="px-3.5 py-2 rounded-[12px] bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-100 text-[12px] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all duration-150 cursor-pointer"
            >
              <Crosshair size={16} strokeWidth={1.75} />
              <span>Add stop</span>
            </button>
          </div>
        </div>

        {/* Append Documented Science Target */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-3 border-t border-white/15">
          <label htmlFor="route-science-target-select" className="label-caps shrink-0">
            Select Science Target:
          </label>
          <select
            id="route-science-target-select"
            value={selectedTargetToAdd}
            onChange={(e) => setSelectedTargetToAdd(e.target.value)}
            className="flex-1 min-w-0 bg-[#251208] border border-white/25 rounded-[12px] px-3 py-2 text-[13px] text-[#FFF4E6]"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name} ({t.coords.elevationM} m)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addScienceTargetToRoute(selectedTargetToAdd)}
            className="px-4 py-2 rounded-[12px] bg-white/20 hover:bg-white/30 border border-white/30 text-[#FFF4E6] text-[12px] font-bold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer"
          >
            Append target to route
          </button>
        </div>
      </div>

      {/* Waypoint Sequence Table */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-caps">
            Traverse Waypoint Sequence ({waypoints.length})
          </span>
          <button
            type="button"
            onClick={() =>
              addWaypointAtCoords(
                inspectedPoint.lat,
                inspectedPoint.lon,
                'waypoint'
              )
            }
            className="text-[12px] font-mono-tabular text-[#FFF4E6] hover:underline transition-all cursor-pointer"
          >
            + Add current probe ({formatMarsCoordinates(inspectedPoint.lat, inspectedPoint.lon, 3)})
          </button>
        </div>

        {waypoints.length === 0 ? (
          <div className="p-6 rounded-[16px] glass-nested text-center space-y-2 border border-white/15">
            <p className="text-[13px] font-bold text-[#FFF4E6]">
              No traverse route currently defined
            </p>
            <p className="text-[12px] text-[#FFF4E6]/75 max-w-md mx-auto font-sans">
              Click on the Mars surface map, enter planetary coordinates above, or append a documented Jezero Crater science target to begin building an astronaut exploration route.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/15 glass-nested rounded-[16px] overflow-hidden border border-white/15">
            {waypoints.map((wp, idx) => {
              const isSelected = wp.id === selectedWaypointId;
              const roleBadgeColor =
                wp.type === 'start'
                  ? 'text-emerald-300'
                  : wp.type === 'destination'
                    ? 'text-[#FFF4E6]'
                    : wp.type === 'science-stop'
                      ? 'text-emerald-300'
                      : 'text-amber-200';

              return (
                <div
                  key={wp.id}
                  onClick={() => setSelectedWaypointId(wp.id)}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer transition-colors duration-150 ${
                    isSelected ? 'bg-white/20' : 'hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-mono-tabular font-bold text-[#FFF4E6]">
                        WP-{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className={`font-mono-tabular text-[11px] font-bold ${roleBadgeColor}`}>
                        {wp.type === 'science-stop'
                          ? 'SCIENCE OBSERVATION POINT'
                          : wp.type === 'start'
                            ? 'STARTING POINT'
                            : wp.type === 'destination'
                              ? 'DESTINATION'
                              : 'INTERMEDIATE WAYPOINT'}
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-[#FFF4E6] truncate">
                      {wp.label}
                    </div>
                    <div className="font-mono-tabular text-[12px] text-[#FFF4E6]/75">
                      {formatMarsCoordinates(wp.coords.lat, wp.coords.lon, 4)} · Elev{' '}
                      {wp.coords.elevationM} m · Slope {wp.coords.slopeDeg.toFixed(1)}°
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(wp.type === 'science-stop' || wp.targetId) && !compact && (
                      <div className="flex items-center gap-1.5 text-[12px] font-mono-tabular">
                        <label htmlFor={`dwell-${wp.id}`} className="text-[#FFF4E6]/75">
                          Dwell:
                        </label>
                        <input
                          id={`dwell-${wp.id}`}
                          type="number"
                          min={0}
                          max={180}
                          value={wp.dwellMinutes}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            updateWaypointDwell(wp.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-16 bg-white/10 border border-white/20 rounded-[10px] px-2 py-1 text-[#FFF4E6] font-bold"
                        />
                        <span className="text-[#FFF4E6]/75">min</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWaypointById(wp.id);
                      }}
                      aria-label={`Remove ${wp.label}`}
                      className="p-2 rounded-full text-[#FFF4E6]/70 hover:text-red-300 hover:bg-white/15 transition-all duration-150 cursor-pointer"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Terrain & Budget Warnings */}
        {metrics.warnings.length > 0 && (
          <div className="space-y-2 pt-2">
            {metrics.warnings.map((w) => (
              <div
                key={w.id}
                className="p-3.5 rounded-[14px] glass-nested flex items-start gap-2.5 text-[12px] border border-white/15"
              >
                <AlertTriangle
                  size={18}
                  strokeWidth={1.5}
                  className={
                    w.severity === 'error'
                      ? 'text-red-300 shrink-0 mt-0.5'
                      : 'text-amber-300 shrink-0 mt-0.5'
                  }
                />
                <div>
                  <div
                    className={`font-bold ${
                      w.severity === 'error'
                        ? 'text-red-200'
                        : 'text-amber-200'
                    }`}
                  >
                    {w.title}
                  </div>
                  <p className="text-[#FFF4E6]/80 mt-0.5 font-sans">{w.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const RoutePlannerView: React.FC = () => {
  const { metrics } = useMission();

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="label-caps tracking-[0.2em]">Astronaut Traverse Engineering</span>
          <h1 className="text-[22px] sm:text-[28px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            Jezero Crater Route Planner &amp; Segment Telemetry
          </h1>
          <p className="text-[12.5px] sm:text-[13px] text-[#FFF4E6]/80 mt-1 leading-relaxed font-sans">
            Reproduced calculations and interactive waypoint planning from the Jezero Crater EVA expedition report on the IAU 2000 Mars sphere.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 items-start">
        <div className="2xl:col-span-6">
          <RouteControls />
        </div>
        <div className="2xl:col-span-6 space-y-4">
          <VisualMap360 compact heightClass="h-[420px]" />
          <ElevationProfile />
        </div>
      </div>

      {/* Segment-by-Segment Telemetry Table */}
      <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/15">
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            Segment-by-Segment Traverse Breakdown
          </h2>
        </div>

        {metrics.segments.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[#FFF4E6]/75">
            Add at least two waypoints to generate segment distance, elevation change, and slope telemetry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="glass-table text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold uppercase tracking-wider">
                  <th className="py-3 px-5 text-left">Leg</th>
                  <th className="py-3 px-5 text-left">From → To</th>
                  <th className="py-3 px-5 text-right">Distance</th>
                  <th className="py-3 px-5 text-right">Elev Diff (Δz)</th>
                  <th className="py-3 px-5 text-right">Mean / Max Slope</th>
                  <th className="py-3 px-5 text-right">Est. Time</th>
                  <th className="py-3 px-5 text-right">Grade Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-mono-tabular text-[12.5px]">
                {metrics.segments.map((seg) => (
                  <tr
                    key={seg.index}
                    className="hover:bg-white/[0.10] transition-colors"
                  >
                    <td className="py-3 px-5 text-[#FFF4E6] font-bold">
                      #{String(seg.index).padStart(2, '0')}
                      {seg.isReturnLeg ? ' (RET)' : ''}
                    </td>
                    <td className="py-3 px-5 text-[#FFF4E6]">
                      {seg.fromLabel} → {seg.toLabel}
                    </td>
                    <td className="py-3 px-5 text-right text-[#FFF4E6]">
                      {seg.distanceM} m
                    </td>
                    <td className="py-3 px-5 text-right text-[#FFF4E6]">
                      {seg.deltaElevationM > 0 ? '+' : ''}
                      {seg.deltaElevationM} m
                    </td>
                    <td className="py-3 px-5 text-right text-[#FFF4E6]">
                      {seg.meanSlopeDeg.toFixed(1)}° / {seg.maxSlopeDeg.toFixed(1)}°
                    </td>
                    <td className="py-3 px-5 text-right text-[#FFF4E6]">
                      {seg.traverseMinutes} min
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span
                        className={
                          seg.hazardLevel === 'warning'
                            ? 'text-red-300 font-bold'
                            : seg.hazardLevel === 'caution'
                              ? 'text-amber-200 font-semibold'
                              : 'text-emerald-300 font-medium'
                        }
                      >
                        {seg.hazardLevel === 'warning'
                          ? 'Steep (>15°)'
                          : seg.hazardLevel === 'caution'
                            ? 'Moderate (10–15°)'
                            : 'Nominal (<10°)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
