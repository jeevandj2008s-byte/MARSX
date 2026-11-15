import React, { useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Mountain,
  Plus,
  Route,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  formatDistanceMetric,
  formatDurationHm,
  formatMarsCoordinates,
} from '../../utils/marsGeospatial';
import { STATUS } from '../../terrainIntelligence';

type InspectorTab = 'terrain' | 'route' | 'target' | 'layers';

export const ContextualRightPanel: React.FC = () => {
  const {
    rightPanelOpen,
    setRightPanelOpen,
    inspectedPoint,
    terrainQuery,
    waypoints,
    selectedWaypointId,
    setSelectedWaypointId,
    addWaypointAtCoords,
    removeLastWaypoint,
    clearRoute,
    targets,
    selectedTargetId,
    setSelectedTargetId,
    toggleTargetForMission,
    layers,
    toggleLayerVisibility,
    metrics,
    config,
    updateConfig,
    setActiveView,
  } = useMission();

  const [activeTab, setActiveTab] = useState<InspectorTab>('terrain');

  if (!rightPanelOpen) {
    return null;
  }

  const selectedTarget =
    targets.find((t) => t.id === selectedTargetId) ?? targets[0] ?? null;

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);

  return (
    <aside
      aria-label="Mission telemetry and contextual inspector"
      className="hidden xl:flex flex-col w-[332px] shrink-0 glass-panel rounded-[18px] border border-white/25 bg-[#251208]/92 backdrop-blur-xl h-full overflow-y-auto no-print transition-all duration-150 select-none shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
    >
      {/* Top Surface Probe Readout */}
      <div className="p-4 border-b border-white/15 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="label-caps tracking-widest text-[#FFF4E6]/75">Cursor / Probe Telemetry</span>
          <div className="flex items-center gap-2">
            <span className="font-mono-tabular text-[11px] text-emerald-300 font-bold bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
              MOLA DEM
            </span>
            <button
              type="button"
              onClick={() => setRightPanelOpen(false)}
              aria-label="Close inspector panel"
              title="Close inspector panel"
              className="w-6 h-6 rounded-[8px] bg-white/15 hover:bg-white/25 text-[#FFF4E6] flex items-center justify-center transition-colors cursor-pointer border border-white/20"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="font-mono-tabular text-[14px] text-[#FFF4E6] font-bold flex items-center justify-between">
          <span>{formatMarsCoordinates(inspectedPoint.lat, inspectedPoint.lon, 4)}</span>
          {terrainQuery?.status === 'outside_region' && (
            <span className="text-[10px] px-2 py-0.5 rounded-[6px] bg-amber-500/20 text-amber-200 border border-amber-400/30 font-bold">
              Outside Project Region
            </span>
          )}
        </div>

        {terrainQuery?.status === 'outside_region' && (
          <p className="text-[11px] text-amber-200 leading-snug font-sans">
            Outside the MARS X MISSION project region (77.0°E–78.0°E, 18.0°N–19.0°N).
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1 text-[12px] font-mono-tabular">
          <div className="glass-nested rounded-[10px] px-2.5 py-2 border border-white/15">
            <span className="text-[#FFF4E6]/70 block text-[10px]">
              Elev · {terrainQuery?.status_labels.elevation ? 'DEM' : 'MOLA'}
            </span>
            <span className="text-[#FFF4E6] font-bold">
              {terrainQuery?.elevation_m != null
                ? `${terrainQuery.elevation_m} m`
                : terrainQuery?.status === 'outside_region'
                ? 'Outside'
                : `${inspectedPoint.elevationM} m`}
            </span>
          </div>
          <div className="glass-nested rounded-[10px] px-2.5 py-2 border border-white/15">
            <span className="text-[#FFF4E6]/70 block text-[10px]">
              Slope · {terrainQuery?.status_labels.slope ? 'Deriv' : 'θ'}
            </span>
            <span
              className={
                (terrainQuery?.slope_deg ?? inspectedPoint.slopeDeg) >= 15
                  ? 'text-amber-200 font-bold'
                  : 'text-[#FFF4E6] font-bold'
              }
            >
              {terrainQuery?.slope_deg != null
                ? `${terrainQuery.slope_deg.toFixed(1)}°`
                : terrainQuery?.status === 'outside_region'
                ? 'Outside'
                : `${inspectedPoint.slopeDeg.toFixed(1)}°`}
            </span>
          </div>
          <div className="glass-nested rounded-[10px] px-2.5 py-2 border border-white/15">
            <span className="text-[#FFF4E6]/70 block text-[10px]">Roughness</span>
            <span className="text-[#FFF4E6] font-bold">
              {terrainQuery?.roughness_m != null
                ? `${terrainQuery.roughness_m.toFixed(2)} m`
                : terrainQuery?.status === 'outside_region'
                ? 'Outside'
                : `${inspectedPoint.roughnessM.toFixed(2)} m`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            addWaypointAtCoords(inspectedPoint.lat, inspectedPoint.lon, 'waypoint')
          }
          className="w-full mt-1 px-3 py-1.5 rounded-[10px] bg-white/15 hover:bg-white/25 border border-white/20 text-[#FFF4E6] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
        >
          <Plus size={15} strokeWidth={2} />
          <span>Append probe point to route</span>
        </button>
      </div>

      {/* Segmented Inspector Mode Switcher */}
      <div className="px-3 pt-3 pb-2 border-b border-white/15">
        <div className="grid grid-cols-4 gap-1 p-1 bg-white/10 rounded-[12px] border border-white/15">
          <button
            type="button"
            onClick={() => setActiveTab('terrain')}
            className={`px-1 py-1.5 rounded-[8px] text-[11.5px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'terrain'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-sm'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6]'
            }`}
          >
            <Mountain size={13} strokeWidth={1.75} />
            <span>Terrain</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('route')}
            className={`px-1 py-1.5 rounded-[8px] text-[11.5px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'route'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-sm'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6]'
            }`}
          >
            <Route size={13} strokeWidth={1.75} />
            <span>Route</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('target')}
            className={`px-1 py-1.5 rounded-[8px] text-[11.5px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'target'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-sm'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6]'
            }`}
          >
            <Crosshair size={13} strokeWidth={1.75} />
            <span>Target</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`px-1 py-1.5 rounded-[8px] text-[11.5px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-sm'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6]'
            }`}
          >
            <Layers size={13} strokeWidth={1.75} />
            <span>Layers</span>
          </button>
        </div>
      </div>

      {/* Tab 0: Traceable Terrain Intelligence */}
      {activeTab === 'terrain' && (
        <div className="p-4 space-y-4 flex-1 text-[12px]">
          {/* Header Status */}
          <div className="flex items-center justify-between">
            <span className="label-caps">Terrain Intelligence</span>
            <span
              className={`font-mono-tabular text-[10px] px-2 py-0.5 rounded-[6px] border ${
                terrainQuery?.status === 'ok'
                  ? 'bg-white/20 text-[#FFF4E6] border-white/25 font-bold'
                  : terrainQuery?.status === 'outside_region'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/30 font-bold'
                  : 'bg-white/10 text-[#FFF4E6]/70 border-white/15'
              }`}
            >
              {terrainQuery?.status === 'ok'
                ? 'Jezero Project Grid'
                : terrainQuery?.status === 'outside_region'
                ? 'Outside Region'
                : 'DEM Raster Pending'}
            </span>
          </div>

          {/* Traceable Data Fields Table */}
          <div className="glass-nested rounded-[14px] divide-y divide-white/15 overflow-hidden border border-white/15">
            {/* Terrain Type + Confidence */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Terrain type</span>
                <span className="font-mono-tabular text-[10.5px] text-[#FFF4E6] font-bold">
                  {STATUS.terrain}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#FFF4E6] text-[13.5px]">
                  {terrainQuery?.terrain_name ?? 'No data'}
                </span>
                <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded bg-white/15 text-[#FFF4E6]/80 font-medium">
                  Conf: {terrainQuery?.terrain_confidence ?? 'unknown'}
                </span>
              </div>
              <p className="text-[11.5px] text-[#FFF4E6]/75 leading-snug font-sans">
                {terrainQuery?.terrain_caution ?? 'DEM-only rule-based candidate unit; prototype thresholds.'}
              </p>
            </div>

            {/* Elevation */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <span className="text-[#FFF4E6]/75 block">Elevation (m)</span>
                <span className="font-mono-tabular text-[10px] text-emerald-300 font-bold">
                  {STATUS.elevation}
                </span>
              </div>
              <span className="font-mono-tabular font-bold text-[#FFF4E6] text-[13.5px]">
                {terrainQuery?.elevation_m != null ? `${terrainQuery.elevation_m} m` : 'No data'}
              </span>
            </div>

            {/* Slope & Difficulty Band */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#FFF4E6]/75 block">Slope (°)</span>
                  <span className="font-mono-tabular text-[10px] text-emerald-300 font-bold">
                    {STATUS.slope} / {STATUS.difficulty}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono-tabular font-bold text-[#FFF4E6] text-[13.5px] block">
                    {terrainQuery?.slope_deg != null ? `${terrainQuery.slope_deg.toFixed(1)}°` : 'No data'}
                  </span>
                  {terrainQuery?.difficulty && (
                    <span
                      className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded font-bold"
                      style={{
                        backgroundColor: `${terrainQuery.difficulty.color}35`,
                        color: '#FFF4E6',
                        border: `1px solid ${terrainQuery.difficulty.color}60`,
                      }}
                    >
                      {terrainQuery.difficulty.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Roughness */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <span className="text-[#FFF4E6]/75 block">Roughness (m)</span>
                <span className="font-mono-tabular text-[10px] text-emerald-300 font-bold">
                  {STATUS.roughness}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono-tabular font-bold text-[#FFF4E6] text-[13.5px] block">
                  {terrainQuery?.roughness_m != null ? `${terrainQuery.roughness_m.toFixed(2)} m` : 'No data'}
                </span>
                <span className="text-[10px] text-[#FFF4E6]/70 font-mono-tabular">
                  {terrainQuery?.roughness_method ?? '3x3-cell window (~600 m)'}
                </span>
              </div>
            </div>

            {/* Nearest Science Target */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Nearest science target (≤5 km)</span>
                <Crosshair size={13} className="text-[#FFF4E6]/75" />
              </div>
              {terrainQuery?.nearest_target ? (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[12px] font-bold text-[#FFF4E6]">
                    <span>{terrainQuery.nearest_target.name}</span>
                    <span className="font-mono-tabular text-[#FFF4E6]">
                      {terrainQuery.nearest_target.distance_m} m
                    </span>
                  </div>
                  <div className="text-[11px] text-[#FFF4E6]/75 flex items-center gap-2 mt-0.5">
                    <span>{terrainQuery.nearest_target.category}</span>
                    <span>·</span>
                    <span>Confidence: {terrainQuery.nearest_target.coordinate_confidence}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#FFF4E6]/70 font-sans">
                  None within 5 km range of probe coordinates.
                </p>
              )}
            </div>

            {/* Provenance & Limitations */}
            <div className="p-3 space-y-2 bg-black/25">
              <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
                <div>Source: {terrainQuery?.source?.elevation?.id ?? 'NASA/USGS DEM Pending'}</div>
                <div>Instrument: {terrainQuery?.source?.elevation?.instrument ?? 'MOLA / HRSC'}</div>
                <div>Grid Note: {terrainQuery?.grid_note}</div>
              </div>
            </div>
          </div>

          {/* Prototype Caution Box */}
          <div className="p-3 rounded-[12px] bg-white/10 border border-white/15 text-[11.5px] text-[#FFF4E6]/80 leading-relaxed font-sans">
            <span className="font-bold text-[#FFF4E6] block mb-0.5">Notice:</span>
            Slope bands are prototype game thresholds, not official NASA rover safety limits.
          </div>
        </div>
      )}

      {/* Tab 1: Active Route & Quick Parameters */}
      {activeTab === 'route' && (
        <div className="p-4 space-y-4 flex-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-caps">Traverse Telemetry</span>
              <span className="font-mono-tabular text-[12px] text-[#FFF4E6]/75">
                {waypoints.length} waypoints
              </span>
            </div>

            <div className="glass-nested rounded-[14px] divide-y divide-white/15 text-[13px] border border-white/15">
              <div className="p-3 flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Total distance</span>
                <span className="font-mono-tabular font-bold text-[#FFF4E6]">
                  {metrics.hasRoute ? `${distFmt.value} ${distFmt.unit}` : 'Unavailable'}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Est. duration</span>
                <span
                  className={`font-mono-tabular font-bold ${
                    metrics.isOverBudget
                      ? 'text-red-300'
                      : 'text-[#FFF4E6]'
                  }`}
                >
                  {metrics.hasRoute
                    ? formatDurationHm(metrics.totalDurationMinutes)
                    : 'Unavailable'}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Net elev. diff (Δz)</span>
                <span className="font-mono-tabular font-bold text-[#FFF4E6]">
                  {metrics.netElevationChangeM !== null
                    ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM} m`
                    : 'Unavailable'}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-[#FFF4E6]/75">Return leg</span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeReturnJourney}
                    onChange={(e) =>
                      updateConfig({ includeReturnJourney: e.target.checked })
                    }
                    className="rounded-[4px] accent-white"
                  />
                  <span className="font-mono-tabular text-[12px] font-bold text-[#FFF4E6]">
                    {config.includeReturnJourney ? 'Included' : 'One-way'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Simulation Speed Slider */}
          <div className="space-y-1.5 pt-2 border-t border-white/15">
            <div className="flex items-center justify-between text-[12px]">
              <label htmlFor="inspector-speed-slider" className="text-[#FFF4E6]/80 flex items-center gap-1.5 font-medium">
                <Sliders size={16} strokeWidth={1.75} />
                <span>Walking speed (assumption)</span>
              </label>
              <span className="font-mono-tabular text-[#FFF4E6] font-bold">
                {config.walkingSpeedKmh.toFixed(1)} km/h
              </span>
            </div>
            <input
              id="inspector-speed-slider"
              type="range"
              min={0.8}
              max={4.5}
              step={0.1}
              value={config.walkingSpeedKmh}
              onChange={(e) =>
                updateConfig({ walkingSpeedKmh: parseFloat(e.target.value) })
              }
              className="w-full accent-white"
            />
          </div>

          {/* Waypoint Sequence List */}
          <div className="space-y-2 pt-2 border-t border-white/15">
            <div className="flex items-center justify-between">
              <span className="label-caps">Waypoint Sequence</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={removeLastWaypoint}
                  disabled={waypoints.length === 0}
                  className="px-2.5 py-1 rounded-[8px] text-[11px] bg-white/15 hover:bg-white/25 disabled:opacity-40 text-[#FFF4E6] font-semibold transition-all cursor-pointer border border-white/20"
                >
                  Undo last
                </button>
                <button
                  type="button"
                  onClick={clearRoute}
                  disabled={waypoints.length === 0}
                  aria-label="Clear route"
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-red-500/30 disabled:opacity-40 text-[#FFF4E6] hover:text-red-200 flex items-center justify-center transition-all cursor-pointer border border-white/20"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {waypoints.length === 0 ? (
              <div className="p-3.5 rounded-[14px] glass-nested text-[12px] text-[#FFF4E6]/75 border border-white/15 font-sans">
                No active route waypoints. Click directly on the Mars map canvas or select a science target to begin plotting an EVA traverse.
              </div>
            ) : (
              <div className="divide-y divide-white/15 rounded-[14px] glass-nested overflow-hidden border border-white/15">
                {waypoints.map((wp, idx) => {
                  const isSelected = wp.id === selectedWaypointId;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => setSelectedWaypointId(wp.id)}
                      className={`w-full text-left p-3 transition-colors duration-150 flex items-start justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-white/25'
                          : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tabular text-[11px] text-[#FFF4E6] font-bold">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[12px] font-bold text-[#FFF4E6] truncate">
                            {wp.label}
                          </span>
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#FFF4E6]/75 mt-0.5">
                          {formatMarsCoordinates(wp.coords.lat, wp.coords.lon, 3)} ·{' '}
                          {wp.coords.elevationM} m
                        </div>
                      </div>
                      <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/75 shrink-0">
                        {wp.type === 'science-stop' ? `${wp.dwellMinutes}m` : wp.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {metrics.warnings.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/15">
              <span className="label-caps flex items-center gap-1.5 text-amber-200">
                <AlertTriangle size={16} strokeWidth={1.75} />
                <span>Active Advisories ({metrics.warnings.length})</span>
              </span>
              {metrics.warnings.slice(0, 2).map((w) => (
                <div
                  key={w.id}
                  className="p-3 rounded-[12px] glass-nested text-[12px] border border-white/15"
                >
                  <div
                    className={`font-bold ${
                      w.severity === 'error'
                        ? 'text-red-200'
                        : 'text-amber-200'
                    }`}
                  >
                    {w.title}
                  </div>
                  <p className="text-[#FFF4E6]/75 text-[11px] mt-1 font-sans">{w.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Selected Science Target Inspector */}
      {activeTab === 'target' && (
        <div className="p-4 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label htmlFor="inspector-target-select" className="label-caps block">
              Inspect Documented Target
            </label>
            <select
              id="inspector-target-select"
              value={selectedTarget?.id ?? ''}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full bg-[#251208] border border-white/25 rounded-[12px] px-3 py-2 text-[13px] text-[#FFF4E6] font-medium"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTarget && (
            <div className="glass-nested rounded-[16px] p-4 space-y-3 border border-white/15">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#FFF4E6]/75">
                  <span className="font-bold">{selectedTarget.code}</span>
                  <span>{selectedTarget.category}</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#FFF4E6] mt-1">
                  {selectedTarget.name}
                </h3>
                <p className="text-[12px] text-[#FFF4E6]/85 mt-0.5 font-medium">
                  {selectedTarget.geologicalUnit}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 py-2.5 border-y border-white/15 text-[12px] font-mono-tabular">
                <div>
                  <span className="text-[#FFF4E6]/70 block text-[11px]">
                    Coordinates
                  </span>
                  <span className="text-[#FFF4E6]">
                    {formatMarsCoordinates(
                      selectedTarget.coords.lat,
                      selectedTarget.coords.lon,
                      3
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[#FFF4E6]/70 block text-[11px]">
                    Elevation / Slope
                  </span>
                  <span className="text-[#FFF4E6]">
                    {selectedTarget.coords.elevationM} m / {selectedTarget.coords.slopeDeg}°
                  </span>
                </div>
                <div>
                  <span className="text-[#FFF4E6]/70 block text-[11px]">
                    Instrument
                  </span>
                  <span className="text-[#FFF4E6]">{selectedTarget.instrument}</span>
                </div>
                <div>
                  <span className="text-[#FFF4E6]/70 block text-[11px]">
                    Observation
                  </span>
                  <span className="text-[#FFF4E6]">
                    {selectedTarget.observationDate}
                  </span>
                </div>
              </div>

              <p className="text-[12px] text-[#FFF4E6]/80 leading-relaxed font-sans">
                {selectedTarget.description}
              </p>

              <div className="space-y-1.5">
                <span className="label-caps">Documented Signatures</span>
                <ul className="space-y-1 text-[12px] text-[#FFF4E6]">
                  {selectedTarget.documentedFeatures.map((feat) => (
                    <li key={feat} className="flex items-start gap-1.5 font-sans">
                      <MapPin
                        size={15}
                        strokeWidth={1.75}
                        className="text-[#FFF4E6] shrink-0 mt-0.5"
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleTargetForMission(selectedTarget.id)}
                  className={`w-full px-3.5 py-2 rounded-[12px] text-[12px] font-bold transition-all duration-150 cursor-pointer border ${
                    selectedTarget.selectedForMission
                      ? 'bg-white/20 border-white/30 text-[#FFF4E6] hover:bg-white/25'
                      : 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/35'
                  }`}
                >
                  {selectedTarget.selectedForMission
                    ? 'Remove target from mission'
                    : 'Include target in mission'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('targets')}
                  className="w-full px-3.5 py-2 rounded-[12px] bg-white/10 hover:bg-white/20 text-[#FFF4E6] border border-white/15 text-[12px] font-semibold transition-all duration-150 cursor-pointer"
                >
                  Open full target catalog
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Quick Scientific Layer Toggles */}
      {activeTab === 'layers' && (
        <div className="p-4 space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <span className="label-caps">Data Layer Stack</span>
            <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/75">
              {metrics.activeLayersCount} active / {metrics.availableLayersCount} avail
            </span>
          </div>

          <div className="divide-y divide-white/15 rounded-[14px] glass-nested overflow-hidden border border-white/15">
            {layers.map((layer) => {
              const isUnavailable =
                layer.status === 'unavailable' || layer.status === 'error';
              return (
                <div key={layer.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`quick-layer-${layer.id}`}
                      className={`text-[12px] font-semibold flex items-center gap-2 ${
                        isUnavailable
                          ? 'text-[#FFF4E6]/40 cursor-not-allowed'
                          : 'text-[#FFF4E6] cursor-pointer'
                      }`}
                    >
                      <input
                        id={`quick-layer-${layer.id}`}
                        type="checkbox"
                        disabled={isUnavailable}
                        checked={layer.visible && !isUnavailable}
                        onChange={() => toggleLayerVisibility(layer.id)}
                        className="rounded-[4px] accent-white"
                      />
                      <span>{layer.name}</span>
                    </label>
                    <span
                      className={`font-mono-tabular text-[10.5px] font-bold px-2 py-0.5 rounded-[6px] border ${
                        isUnavailable
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                          : layer.visible
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                            : 'bg-white/10 text-[#FFF4E6]/70 border-white/15'
                      }`}
                    >
                      {isUnavailable
                        ? 'Unavailable'
                        : layer.visible
                          ? 'Active'
                          : 'Available'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/70 pl-5">
                    {layer.instrument} · {layer.spatialResolution}
                  </div>
                  {isUnavailable && layer.unavailableReason && (
                    <p className="text-[11px] text-amber-200 pl-5 font-sans">
                      {layer.unavailableReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
