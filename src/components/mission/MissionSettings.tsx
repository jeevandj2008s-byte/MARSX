import React from 'react';
import { Info, Settings, Sparkles } from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import { EXPLORATION_REGIONS } from '../../data/marsMissionData';
import type { ExplorationRegionId, MobilityMode } from '../../types/mission';
import { formatDistanceMetric, formatDurationHm } from '../../utils/marsGeospatial';

export const MissionSettings: React.FC = () => {
  const {
    config,
    updateConfig,
    selectRegion,
    targets,
    toggleTargetForMission,
    metrics,
    setActiveView,
  } = useMission();

  const distFmt = formatDistanceMetric(metrics.totalDistanceM);

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <span className="label-caps tracking-[0.2em]">Simulation Parameter Configuration</span>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            Mission Configuration & Simulation Assumptions
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 max-w-3xl leading-relaxed font-sans">
            Configure mission identity, regional domain, and astronaut traverse assumptions. Changes immediately recalculate route telemetry and time-budget margins across all views.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('assistant')}
          className="px-4 py-2.5 rounded-[12px] bg-[#F0942F] hover:bg-[#F8A749] text-[#FFF4E6] border border-white/30 text-[12.5px] font-bold flex items-center gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-150 cursor-pointer"
        >
          <Sparkles size={16} strokeWidth={1.75} />
          <span>Request updated AI briefing</span>
        </button>
      </div>

      {/* Explicit Simulation Assumption Disclaimer */}
      <div className="p-4 sm:p-5 rounded-[18px] glass-panel border border-white/25 bg-white/[0.10] flex items-start gap-3 text-[13px]">
        <Info size={18} strokeWidth={1.75} className="text-[#FFF4E6] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-[#FFF4E6]">
            Simulation Parameter Notice
          </div>
          <p className="text-[#FFF4E6]/80 text-[12px] leading-relaxed font-sans">
            All walking speeds, science stop dwell times, contingency buffers, and mobility modes configured below are{' '}
            <strong className="text-[#FFF4E6]">configurable simulation assumptions</strong>{' '}
            for mission planning studies — not validated astronaut physiological performance data or NASA operational flight rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Core Mission Identity & Kinematics */}
        <div className="lg:col-span-7 glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] divide-y divide-white/15 overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center gap-2">
            <Settings size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[17px] font-bold text-[#FFF4E6]">
              Mission Identity & Kinematics
            </h2>
          </div>

          {/* A. Mission Name & ID */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label htmlFor="cfg-mission-name" className="label-caps block mb-1.5">
                A. Mission Name
              </label>
              <input
                id="cfg-mission-name"
                type="text"
                value={config.missionName}
                onChange={(e) => updateConfig({ missionName: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-[12px] px-3.5 py-2 text-[13px] text-[#FFF4E6] font-semibold"
              />
            </div>

            <div>
              <label htmlFor="cfg-mission-id" className="label-caps block mb-1.5">
                Mission Identifier
              </label>
              <input
                id="cfg-mission-id"
                type="text"
                value={config.missionId}
                onChange={(e) => updateConfig({ missionId: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-[12px] px-3.5 py-2 text-[13px] font-mono-tabular text-[#FFF4E6] font-bold"
              />
            </div>
          </div>

          {/* B. Selected Region & Scientific Objective */}
          <div className="p-4 sm:p-5 space-y-3.5">
            <div>
              <label htmlFor="cfg-region" className="label-caps block mb-1.5">
                B. Selected Exploration Region
              </label>
              <select
                id="cfg-region"
                value={config.regionId}
                onChange={(e) => selectRegion(e.target.value as ExplorationRegionId)}
                className="w-full bg-[#251208] border border-white/25 rounded-[12px] px-3.5 py-2 text-[13px] text-[#FFF4E6] font-medium"
              >
                {Object.values(EXPLORATION_REGIONS).map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name} ({reg.quadrangle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cfg-objective" className="label-caps block mb-1.5">
                Primary Scientific Objective
              </label>
              <textarea
                id="cfg-objective"
                rows={2}
                value={config.scientificObjective}
                onChange={(e) => updateConfig({ scientificObjective: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-[12px] px-3.5 py-2 text-[13px] text-[#FFF4E6] font-sans"
              />
            </div>
          </div>

          {/* C & D: Walking Speed & Available Mission Time */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="cfg-speed" className="label-caps">
                  C. Walking Speed Assumption
                </label>
                <span className="font-mono-tabular text-[13px] font-bold text-[#FFF4E6]">
                  {config.walkingSpeedKmh.toFixed(1)} km/h
                </span>
              </div>
              <input
                id="cfg-speed"
                type="range"
                min={0.6}
                max={5.0}
                step={0.1}
                value={config.walkingSpeedKmh}
                onChange={(e) =>
                  updateConfig({ walkingSpeedKmh: parseFloat(e.target.value) })
                }
                className="w-full accent-white"
              />
              <p className="text-[11.5px] text-[#FFF4E6]/75 font-sans">
                Simulation assumption on flat regolith (+2.5% duration penalty per degree slope).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="cfg-budget" className="label-caps">
                  D. Available Mission Time
                </label>
                <span className="font-mono-tabular text-[13px] font-bold text-[#FFF4E6]">
                  {config.timeBudgetHours.toFixed(1)} hours ({Math.round(config.timeBudgetHours * 60)} min)
                </span>
              </div>
              <input
                id="cfg-budget"
                type="range"
                min={2.0}
                max={12.0}
                step={0.5}
                value={config.timeBudgetHours}
                onChange={(e) =>
                  updateConfig({ timeBudgetHours: parseFloat(e.target.value) })
                }
                className="w-full accent-white"
              />
              <p className="text-[11.5px] text-[#FFF4E6]/75 font-sans">
                Total configurable EVA window before life-support reserve threshold.
              </p>
            </div>
          </div>

          {/* E & F: Science-Stop Duration & Contingency Duration */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="cfg-stop-min" className="label-caps block">
                E. Default Science-Stop Duration (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cfg-stop-min"
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={config.scienceStopMinutes}
                  onChange={(e) =>
                    updateConfig({
                      scienceStopMinutes: Math.max(5, parseInt(e.target.value, 10) || 15),
                    })
                  }
                  className="w-28 bg-white/10 border border-white/20 rounded-[12px] px-3 py-2 text-[13px] font-mono-tabular text-[#FFF4E6] font-bold"
                />
                <span className="text-[12px] font-mono-tabular text-[#FFF4E6]/75">
                  min / target stop
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cfg-contingency-min" className="label-caps block">
                F. Contingency Duration Buffer (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cfg-contingency-min"
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={config.contingencyMinutes}
                  onChange={(e) =>
                    updateConfig({
                      contingencyMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-28 bg-white/10 border border-white/20 rounded-[12px] px-3 py-2 text-[13px] font-mono-tabular text-[#FFF4E6] font-bold"
                />
                <span className="text-[12px] font-mono-tabular text-[#FFF4E6]/75">
                  min reserve
                </span>
              </div>
            </div>
          </div>

          {/* G & I: Return Journey & Mobility Assumption */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <span className="label-caps block">G. Return Journey Inclusion</span>
              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeReturnJourney}
                  onChange={(e) =>
                    updateConfig({ includeReturnJourney: e.target.checked })
                  }
                  className="rounded-[4px] accent-white"
                />
                <span className="text-[13px] text-[#FFF4E6] font-medium">
                  Include return leg to starting station
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cfg-mobility" className="label-caps block">
                I. Mobility / Suit Assumption Preset
              </label>
              <select
                id="cfg-mobility"
                value={config.mobilityMode}
                onChange={(e) => {
                  const mode = e.target.value as MobilityMode;
                  const presetSpeed =
                    mode === 'eva-foot'
                      ? 2.2
                      : mode === 'unpressurized-rover-assist'
                        ? 4.0
                        : 4.8;
                  updateConfig({ mobilityMode: mode, walkingSpeedKmh: presetSpeed });
                }}
                className="w-full bg-[#251208] border border-white/25 rounded-[12px] px-3.5 py-2 text-[13px] text-[#FFF4E6] font-medium"
              >
                <option value="eva-foot">Disembarked EVA Foot Traverse (2.2 km/h ref)</option>
                <option value="unpressurized-rover-assist">
                  Unpressurized LTV Assisted Traverse (4.0 km/h ref)
                </option>
                <option value="pressurized-rover">
                  Pressurized Rover Scout Mode (4.8 km/h ref)
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Selected Science Targets & Live Recalculated Impact Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
            <span className="label-caps block">
              H. Selected Science Targets ({metrics.selectedTargetsCount} of {targets.length})
            </span>

            <div className="divide-y divide-white/15 glass-nested rounded-[14px] overflow-hidden border border-white/15">
              {targets.map((target) => (
                <label
                  key={target.id}
                  className="p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.08] transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={target.selectedForMission}
                      onChange={() => toggleTargetForMission(target.id)}
                      className="mt-1 rounded-[4px] accent-white"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#FFF4E6] truncate">
                        {target.name}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
                        {target.code} · {target.coords.elevationM} m
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-[12px] text-[#FFF4E6]/75 shrink-0">
                    {config.scienceStopMinutes}m
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Live Recalculated Mission Summary */}
          <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
            <span className="label-caps block">Live Recalculated Mission Summary</span>
            <div className="divide-y divide-white/15 text-[13px] font-mono-tabular">
              <div className="py-2.5 flex justify-between">
                <span className="text-[#FFF4E6]/75">Total route distance</span>
                <span className="text-[#FFF4E6] font-bold">
                  {metrics.hasRoute ? `${distFmt.value} ${distFmt.unit}` : 'Unavailable'}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#FFF4E6]/75">Translation duration</span>
                <span className="text-[#FFF4E6]">
                  {formatDurationHm(metrics.traverseMinutes)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#FFF4E6]/75">Science stops total</span>
                <span className="text-[#FFF4E6]">
                  {formatDurationHm(metrics.scienceStopMinutesTotal)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#FFF4E6]/75">Contingency reserve</span>
                <span className="text-[#FFF4E6]">
                  {formatDurationHm(metrics.contingencyMinutes)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between font-bold">
                <span className="text-[#FFF4E6]">Total estimated EVA</span>
                <span
                  className={
                    metrics.isOverBudget
                      ? 'text-red-300'
                      : 'text-emerald-300'
                  }
                >
                  {formatDurationHm(metrics.totalDurationMinutes)} /{' '}
                  {formatDurationHm(metrics.timeBudgetMinutes)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
