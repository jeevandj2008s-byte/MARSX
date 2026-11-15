import React from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  formatDistanceMetric,
  formatDurationHm,
  formatMarsCoordinates,
} from '../../utils/marsGeospatial';

export const MissionReport: React.FC = () => {
  const {
    config,
    currentRegion,
    waypoints,
    targets,
    layers,
    metrics,
    briefing,
  } = useMission();

  const selectedTargets = targets.filter((t) => t.selectedForMission);
  const availableLayers = layers.filter(
    (l) => l.status === 'available' || l.status === 'active'
  );
  const unavailableLayers = layers.filter((l) => l.status === 'unavailable');

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);

  const handleDownloadJson = () => {
    const manifest = {
      exportedAt: new Date().toISOString(),
      system: 'MARS X MISSION — Mars Surface Exploration Planning System',
      missionConfig: config,
      explorationRegion: currentRegion,
      metricsSummary: metrics,
      routeWaypoints: waypoints,
      selectedScienceTargets: selectedTargets,
      activeScientificLayers: layers.filter((l) => l.visible),
      aiBriefing: briefing,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.missionId.toLowerCase()}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header & Export Actions */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4 no-print border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <span className="label-caps tracking-[0.2em]">Mission Manifest & Provenance Dossier</span>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            Mission Report — {config.missionId}
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 leading-relaxed font-sans">
            Complete technical specification of exploration location, targets, traverse geometry, scientific sources, assumptions, and limitations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-4 py-2.5 rounded-[12px] bg-white/15 hover:bg-white/25 border border-white/20 text-[#FFF4E6] text-[12.5px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all duration-150 cursor-pointer"
          >
            <Download size={16} strokeWidth={1.75} />
            <span>Export JSON manifest</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-[12px] bg-[#F0942F] hover:bg-[#F8A749] text-[#FFF4E6] border border-white/30 text-[12.5px] font-bold flex items-center gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-150 cursor-pointer"
          >
            <Printer size={16} strokeWidth={1.75} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Unified Printable Dossier Sheet */}
      <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] divide-y divide-white/15 overflow-hidden">
        {/* Section 1: Mission Overview & Settings */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet
                size={18}
                strokeWidth={1.5}
                className="text-[#FFF4E6]"
              />
              <h2 className="text-[17px] font-bold text-[#FFF4E6]">
                1. Mission Specification & Kinematics
              </h2>
            </div>
            <span className="font-mono-tabular text-[12px] text-[#FFF4E6]/75 bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
              ID: {config.missionId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-[13px]">
            <div className="p-4 rounded-[14px] glass-nested border border-white/15">
              <span className="label-caps block">Mission Name & Region</span>
              <div className="font-bold text-[#FFF4E6] mt-1">
                {config.missionName}
              </div>
              <div className="text-[12px] text-[#FFF4E6]/75 mt-0.5">
                {currentRegion.name} ({currentRegion.quadrangle})
              </div>
            </div>

            <div className="p-4 rounded-[14px] glass-nested border border-white/15">
              <span className="label-caps block">Traverse Distance & Relief</span>
              <div className="font-mono-tabular font-bold text-[#FFF4E6] mt-1">
                {metrics.hasRoute ? `${distFmt.value} ${distFmt.unit}` : 'No route'} (
                {config.includeReturnJourney ? 'Round-trip' : 'One-way'})
              </div>
              <div className="font-mono-tabular text-[12px] text-[#FFF4E6]/75 mt-0.5">
                Net Δz:{' '}
                {metrics.netElevationChangeM !== null
                  ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM} m`
                  : 'N/A'}{' '}
                · Max Slope: {metrics.maxSlopeDeg.toFixed(1)}°
              </div>
            </div>

            <div className="p-4 rounded-[14px] glass-nested border border-white/15">
              <span className="label-caps block">Estimated Duration vs Budget</span>
              <div
                className={`font-mono-tabular font-bold mt-1 ${
                  metrics.isOverBudget
                    ? 'text-red-300'
                    : 'text-[#FFF4E6]'
                }`}
              >
                {metrics.hasRoute
                  ? formatDurationHm(metrics.totalDurationMinutes)
                  : '0m'}{' '}
                / {formatDurationHm(metrics.timeBudgetMinutes)}
              </div>
              <div className="font-mono-tabular text-[12px] text-[#FFF4E6]/75 mt-0.5">
                Speed assumption: {config.walkingSpeedKmh.toFixed(1)} km/h · Contingency:{' '}
                {config.contingencyMinutes}m
              </div>
            </div>
          </div>

          <div className="text-[13px]">
            <span className="label-caps block mb-1">Scientific Objective</span>
            <p className="text-[#FFF4E6] leading-relaxed font-sans">{config.scientificObjective}</p>
          </div>
        </div>

        {/* Section 2: Selected Science Targets */}
        <div className="p-4 sm:p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            2. Selected Science Targets ({selectedTargets.length})
          </h2>

          {selectedTargets.length === 0 ? (
            <p className="text-[13px] text-[#FFF4E6]/75 font-sans">
              No cataloged science targets selected for this mission simulation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="glass-table text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-left">Code</th>
                    <th className="py-2.5 px-3 text-left">Target Name</th>
                    <th className="py-2.5 px-3 text-left">Geological Unit</th>
                    <th className="py-2.5 px-3 text-left">Coordinates</th>
                    <th className="py-2.5 px-3 text-left">Source & Instrument</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono-tabular text-[12px]">
                  {selectedTargets.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.08] transition-colors">
                      <td className="py-2.5 px-3 text-[#FFF4E6] font-bold">{t.code}</td>
                      <td className="py-2.5 px-3 text-[#FFF4E6] font-semibold">
                        {t.name}
                      </td>
                      <td className="py-2.5 px-3 text-[#FFF4E6]/75">
                        {t.geologicalUnit}
                      </td>
                      <td className="py-2.5 px-3 text-[#FFF4E6]">
                        {formatMarsCoordinates(t.coords.lat, t.coords.lon, 4)} (
                        {t.coords.elevationM} m)
                      </td>
                      <td className="py-2.5 px-3 text-[#FFF4E6]/75">
                        {t.instrument} · {t.observationDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Route Waypoint Manifest */}
        <div className="p-4 sm:p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            3. Planned Route Waypoints ({waypoints.length})
          </h2>

          {waypoints.length === 0 ? (
            <p className="text-[13px] text-[#FFF4E6]/75 font-sans">
              No route waypoints defined.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="glass-table text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-left">Idx</th>
                    <th className="py-2.5 px-3 text-left">Station Label</th>
                    <th className="py-2.5 px-3 text-left">Type / Role</th>
                    <th className="py-2.5 px-3 text-left">Coordinates</th>
                    <th className="py-2.5 px-3 text-right">Elevation</th>
                    <th className="py-2.5 px-3 text-right">Slope</th>
                    <th className="py-2.5 px-3 text-right">Dwell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono-tabular text-[12px]">
                  {waypoints.map((wp, idx) => (
                    <tr key={wp.id} className="hover:bg-white/[0.08] transition-colors">
                      <td className="py-2.5 px-3 text-[#FFF4E6] font-bold">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3 text-[#FFF4E6] font-semibold">{wp.label}</td>
                      <td className="py-2.5 px-3 text-[#FFF4E6]/75">{wp.type}</td>
                      <td className="py-2.5 px-3 text-[#FFF4E6]">
                        {formatMarsCoordinates(wp.coords.lat, wp.coords.lon, 4)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#FFF4E6]">
                        {wp.coords.elevationM} m
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#FFF4E6]">
                        {wp.coords.slopeDeg.toFixed(1)}°
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#FFF4E6]">
                        {wp.dwellMinutes}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Data Layer Catalog */}
        <div className="p-4 sm:p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            4. Planetary Data Layer Catalog ({layers.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <div className="space-y-2">
              <span className="label-caps block">Integrated Datasets ({availableLayers.length})</span>
              <div className="divide-y divide-white/15 glass-nested rounded-[14px] overflow-hidden border border-white/15">
                {availableLayers.map((l) => (
                  <div key={l.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[#FFF4E6] font-semibold">{l.name}</div>
                      <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
                        {l.instrument} · {l.spatialResolution}
                      </div>
                    </div>
                    <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-bold">
                      {l.visible ? 'ACTIVE' : 'AVAILABLE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="label-caps block">Unavailable Data Feeds ({unavailableLayers.length})</span>
              <div className="divide-y divide-white/15 glass-nested rounded-[14px] overflow-hidden border border-white/15">
                {unavailableLayers.map((l) => (
                  <div key={l.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[#FFF4E6]/80 font-medium">{l.name}</div>
                      <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/60">
                        {l.instrument} · {l.unavailableReason}
                      </div>
                    </div>
                    <span className="font-mono-tabular text-[10.5px] px-2 py-0.5 rounded-[6px] bg-amber-500/20 text-amber-200 border border-amber-400/30 font-bold">
                      OFFLINE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Epistemic Distinctions, Assumptions & Limitations */}
        <div className="p-4 sm:p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-[#FFF4E6]">
            5. Epistemic Distinctions, Assumptions & Limitations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[12.5px] font-sans">
            <div className="p-4 rounded-[14px] glass-nested space-y-1.5 border border-white/15">
              <span className="font-bold text-[#FFF4E6] block">
                Simulation Assumptions Notice
              </span>
              <p className="text-[#FFF4E6]/80 leading-relaxed">
                All astronaut walking speeds ({config.walkingSpeedKmh} km/h), traverse stop dwells, contingency buffers ({config.contingencyMinutes}m), and metabolic rates are configurable simulation models.
              </p>
            </div>

            <div className="p-4 rounded-[14px] glass-nested space-y-1.5 border border-white/15">
              <span className="font-bold text-[#FFF4E6] block">
                Dataset Resolution & Ground Truth
              </span>
              <p className="text-[#FFF4E6]/80 leading-relaxed">
                MOLA elevation (megr128) provides 128 pixels/degree resolution (~463 m/pixel at the Martian equator). Local sub-pixel slope hazards (boulders, sand traps, crevasses) are below sensor detection limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
