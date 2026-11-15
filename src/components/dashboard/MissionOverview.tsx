import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Compass,
  Crosshair,
  Layers,
  Mountain,
  Route,
  Sparkles,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  formatDistanceMetric,
  formatDurationHm,
  formatMarsCoordinates,
} from '../../utils/marsGeospatial';
import { VisualMap360 } from '../map/VisualMap360';
import { MetricCard } from './MetricCard';
import { CinematicHeroLanding } from '../landing/CinematicHeroLanding';

export const MissionOverview: React.FC = () => {
  const {
    config,
    currentRegion,
    metrics,
    targets,
    layers,
    briefing,
    setActiveView,
    setSelectedTargetId,
  } = useMission();

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);
  const oneWayFmt = formatDistanceMetric(metrics.oneWayDistanceM);

  const scrollToWorkstation = () => {
    const el = document.getElementById('mission-workstation');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setActiveView('explorer');
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Cinematic Hero Landing matching screenshot */}
      <CinematicHeroLanding onScrollToWorkstation={scrollToWorkstation} />

      {/* Top Mission Identity & Status Header */}
      <div
        id="mission-workstation"
        className="scroll-mt-4 glass-panel rounded-[20px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-mono-tabular">
              <span className="text-[#FFF4E6] font-bold bg-white/20 px-2 py-0.5 rounded-[6px] border border-white/25">
                {config.missionId}
              </span>
              <span className="text-[#FFF4E6]/50">·</span>
              <span className="text-emerald-300 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>MISSION SIMULATION ACTIVE</span>
              </span>
              {config.demoMode && (
                <>
                  <span className="text-[#FFF4E6]/50">·</span>
                  <span className="text-[#FFF4E6]/75">
                    DEMONSTRATION DATASET (MOLA / CTX / MSL)
                  </span>
                </>
              )}
            </div>

            <h1 className="text-[24px] sm:text-[30px] font-bold text-[#FFF4E6] tracking-tight leading-snug">
              {config.missionName}
            </h1>

            <p className="text-[13px] text-[#FFF4E6]/80 leading-relaxed font-sans">
              <strong className="text-[#FFF4E6] font-semibold">
                Scientific Objective:
              </strong>{' '}
              {config.scientificObjective}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('explorer')}
              className="px-4 py-2.5 rounded-[12px] bg-[#F0942F] hover:bg-[#F8A749] text-[#FFF4E6] font-bold text-[12.5px] flex items-center gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] border border-white/30 transition-all duration-150 cursor-pointer"
            >
              <Compass size={16} strokeWidth={1.75} />
              <span>Open Planetary Explorer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('planner')}
              className="px-4 py-2.5 rounded-[12px] bg-white/15 hover:bg-white/25 border border-white/25 text-[#FFF4E6] text-[12.5px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all duration-150 cursor-pointer"
            >
              <Route size={16} strokeWidth={1.75} />
              <span>Configure Route</span>
            </button>
          </div>
        </div>

        {/* Mission Time Budget Utilization Bar */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-[12px] font-mono-tabular">
            <span className="label-caps">EVA Time Budget Allocation</span>
            <span className="text-[#FFF4E6] font-medium">
              Consumed:{' '}
              {metrics.hasRoute ? formatDurationHm(metrics.totalDurationMinutes) : '0m'}{' '}
              / {formatDurationHm(metrics.timeBudgetMinutes)}
            </span>
            <span
              className={
                metrics.isOverBudget
                  ? 'text-red-300 font-semibold'
                  : 'text-emerald-300 font-medium'
              }
            >
              {metrics.hasRoute
                ? metrics.isOverBudget
                  ? `Overrun: +${formatDurationHm(Math.abs(metrics.remainingBudgetMinutes))}`
                  : `Remaining: ${formatDurationHm(metrics.remainingBudgetMinutes)}`
                : 'Awaiting traverse waypoints'}
            </span>
          </div>

          <div className="w-full sm:w-72 h-2.5 bg-black/30 rounded-full overflow-hidden border border-white/20">
            <div
              style={{
                width: `${Math.min(100, metrics.budgetUtilizationPct)}%`,
                backgroundColor: metrics.isOverBudget
                  ? '#F87171'
                  : metrics.budgetUtilizationPct >= 85
                    ? '#FBBF24'
                    : '#FFF4E6',
              }}
              className="h-full rounded-full transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* 6 Required Scientific Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <MetricCard
          label="Route Distance"
          value={metrics.hasRoute ? distFmt.value : 'Unavailable'}
          unit={metrics.hasRoute ? distFmt.unit : undefined}
          subtext={
            metrics.hasRoute
              ? config.includeReturnJourney
                ? `Round-trip (${oneWayFmt.value} ${oneWayFmt.unit} outbound)`
                : 'Outbound one-way surface arc'
              : 'No active route plotted'
          }
          status={metrics.hasRoute ? 'nominal' : 'unavailable'}
          icon={<Route size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('planner')}
        />

        <MetricCard
          label="Est. Duration"
          value={
            metrics.hasRoute
              ? formatDurationHm(metrics.totalDurationMinutes)
              : 'Unavailable'
          }
          subtext={
            metrics.hasRoute
              ? `${formatDurationHm(metrics.traverseMinutes)} walk + ${metrics.scienceStopMinutesTotal}m stops + ${metrics.contingencyMinutes}m buffer`
              : `Assumes ${config.walkingSpeedKmh.toFixed(1)} km/h simulation speed`
          }
          status={
            !metrics.hasRoute
              ? 'unavailable'
              : metrics.isOverBudget
                ? 'error'
                : 'nominal'
          }
          icon={<Clock size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('settings')}
        />

        <MetricCard
          label="Elevation Change"
          value={
            metrics.netElevationChangeM !== null
              ? `${metrics.netElevationChangeM > 0 ? '+' : ''}${metrics.netElevationChangeM}`
              : 'Unavailable'
          }
          unit={metrics.netElevationChangeM !== null ? 'm' : undefined}
          subtext={
            metrics.netElevationChangeM !== null
              ? `Net Δz (Total ascent ${metrics.totalAscentM} m / descent ${metrics.totalDescentM} m)`
              : 'Requires ≥2 route waypoints'
          }
          status={metrics.netElevationChangeM !== null ? 'nominal' : 'unavailable'}
          icon={<Mountain size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('terrain')}
        />

        <MetricCard
          label="Science Targets"
          value={`${metrics.selectedTargetsCount}`}
          unit={`of ${targets.length} sites`}
          subtext="Documented Jezero Crater geological stations included in mission"
          status="nominal"
          icon={<Crosshair size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('targets')}
        />

        <MetricCard
          label="Mission Time Budget"
          value={
            metrics.hasRoute
              ? metrics.isOverBudget
                ? `-${formatDurationHm(Math.abs(metrics.remainingBudgetMinutes))}`
                : formatDurationHm(metrics.remainingBudgetMinutes)
              : formatDurationHm(metrics.timeBudgetMinutes)
          }
          unit={metrics.hasRoute ? 'rem' : 'avail'}
          subtext={
            metrics.isOverBudget
              ? `Warning: Exceeds ${formatDurationHm(metrics.timeBudgetMinutes)} budget (${metrics.budgetUtilizationPct}%)`
              : `${metrics.budgetUtilizationPct}% of ${formatDurationHm(metrics.timeBudgetMinutes)} budget consumed`
          }
          status={
            metrics.isOverBudget
              ? 'error'
              : metrics.budgetUtilizationPct >= 85
                ? 'warning'
                : 'nominal'
          }
          icon={<AlertTriangle size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('settings')}
        />

        <MetricCard
          label="Data Layers"
          value={`${metrics.availableLayersCount}`}
          unit="available"
          subtext={`${metrics.activeLayersCount} active on map · ${layers.length - metrics.availableLayersCount} unavailable`}
          status="nominal"
          icon={<Layers size={18} strokeWidth={1.5} />}
          onClick={() => setActiveView('explorer')}
        />
      </div>

      {/* Central Interactive Mars Map & Active Layer Matrix Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <VisualMap360 compact heightClass="h-[460px]" />
        </div>

        {/* Right Column: Data Layer Availability & AI Briefing Preview */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Layer Availability Summary Panel */}
          <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex-1 flex flex-col justify-between overflow-hidden">
            <div className="p-4 border-b border-white/15 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#FFF4E6]">
                Dataset Availability Matrix
              </span>
              <button
                type="button"
                onClick={() => setActiveView('explorer')}
                className="text-[12px] font-semibold text-[#FFF4E6] hover:text-white flex items-center gap-1 transition-colors duration-150 cursor-pointer"
              >
                <span>Layer controls</span>
                <ArrowUpRight size={15} strokeWidth={1.75} />
              </button>
            </div>

            <div className="divide-y divide-white/15 text-[13px]">
              {layers.slice(0, 6).map((layer) => {
                const isUnavailable = layer.status === 'unavailable';
                return (
                  <div
                    key={layer.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-white/[0.08] transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <div className="text-[#FFF4E6] font-medium truncate text-[12.5px]">
                        {layer.name}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/70">
                        {layer.instrument} · {layer.spatialResolution}
                      </div>
                    </div>
                    <span
                      className={`font-mono-tabular text-[11px] font-semibold px-2 py-0.5 rounded-[6px] shrink-0 border ${
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
                );
              })}
            </div>
          </div>

          {/* AI Mission Briefing Preview */}
          <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#FFF4E6] flex items-center gap-1.5">
                <Sparkles size={16} strokeWidth={1.75} className="text-[#FFF4E6]" />
                <span>AI Mission Briefing Preview</span>
              </span>
              <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/75 bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
                {briefing.sourceMode === 'gemini-api' ? 'Gemini API' : 'Deterministic'}
              </span>
            </div>

            <p className="text-[12.5px] text-[#FFF4E6]/80 leading-relaxed line-clamp-3 font-sans">
              {briefing.missionSummary}
            </p>

            <button
              type="button"
              onClick={() => setActiveView('assistant')}
              className="w-full px-3 py-2 rounded-[10px] bg-white/15 hover:bg-white/25 border border-white/25 text-[#FFF4E6] text-[12.5px] font-semibold flex items-center justify-center gap-1.5 backdrop-blur-md transition-all duration-150 cursor-pointer"
            >
              <span>Open AI Mission Assistant</span>
              <ArrowUpRight size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Documented Scientific Observations Table */}
      <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#FFF4E6]">
              Documented Regional Scientific Observations ({currentRegion.quadrangle})
            </h2>
            <p className="text-[12px] text-[#FFF4E6]/75 mt-0.5">
              Archival NASA Mars 2020 geological targets within the Jezero Crater traverse corridor
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('targets')}
            className="px-3.5 py-2 rounded-[12px] bg-white/15 hover:bg-white/25 border border-white/25 text-[#FFF4E6] text-[12px] font-semibold backdrop-blur-md transition-all duration-150 cursor-pointer"
          >
            Manage Science Targets
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="glass-table text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-white/15 bg-white/[0.08] text-[11.5px] text-[#FFF4E6]/80 font-bold tracking-wider uppercase">
                <th className="py-3 px-5 text-left">Code</th>
                <th className="py-3 px-5 text-left">Target / Geological Unit</th>
                <th className="py-3 px-5 text-left">Category</th>
                <th className="py-3 px-5 text-left">Coordinates</th>
                <th className="py-3 px-5 text-right">Elev / Slope</th>
                <th className="py-3 px-5 text-left">Instrument Source</th>
                <th className="py-3 px-5 text-right">Mission Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {targets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => {
                    setSelectedTargetId(t.id);
                    setActiveView('targets');
                  }}
                  className="hover:bg-white/[0.12] cursor-pointer transition-colors duration-150"
                >
                  <td className="py-3 px-5 font-mono-tabular text-[12px] text-[#FFF4E6] font-bold">
                    {t.code}
                  </td>
                  <td className="py-3 px-5">
                    <div className="text-[#FFF4E6] font-semibold">{t.name}</div>
                    <div className="text-[11.5px] text-[#FFF4E6]/75">
                      {t.geologicalUnit}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-[12.5px] text-[#FFF4E6]/80">
                    {t.category}
                  </td>
                  <td className="py-3 px-5 font-mono-tabular text-[12.5px] text-[#FFF4E6]">
                    {formatMarsCoordinates(t.coords.lat, t.coords.lon, 3)}
                  </td>
                  <td className="py-3 px-5 font-mono-tabular text-[12.5px] text-[#FFF4E6] text-right">
                    {t.coords.elevationM} m · {t.coords.slopeDeg.toFixed(1)}°
                  </td>
                  <td className="py-3 px-5 text-[12.5px] text-[#FFF4E6]/80">
                    {t.instrument} ({t.observationDate})
                  </td>
                  <td className="py-3 px-5 font-mono-tabular text-[12.5px] text-right">
                    <span
                      className={`px-2 py-0.5 rounded-[6px] border text-[11px] font-bold ${
                        t.selectedForMission
                          ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                          : 'bg-white/10 border-white/15 text-[#FFF4E6]/70'
                      }`}
                    >
                      {t.selectedForMission ? 'Included' : 'Standby'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
