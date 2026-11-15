import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  FileWarning,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';

export const MissionAssistant: React.FC = () => {
  const {
    briefing,
    isGeneratingBriefing,
    briefingWarning,
    generateBriefing,
    config,
    metrics,
  } = useMission();

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <span className="label-caps tracking-[0.2em]">Science Operations Synthesis</span>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            AI Mission Briefing & Telemetry Audit
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 max-w-3xl leading-relaxed font-sans">
            Synthesizes current route geometry, selected Jezero Crater targets, MOLA terrain gradients, and simulation assumptions into a structured operational briefing.
          </p>
        </div>

        <button
          type="button"
          onClick={generateBriefing}
          disabled={isGeneratingBriefing}
          className="px-4 py-2.5 rounded-[12px] bg-[#F0942F] hover:bg-[#F8A749] disabled:opacity-50 text-[#FFF4E6] text-[12.5px] font-bold flex items-center gap-2 border border-white/30 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-150 cursor-pointer"
        >
          {isGeneratingBriefing ? (
            <>
              <RefreshCw size={16} strokeWidth={2} className="animate-spin" />
              <span>Synthesizing mission briefing...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} strokeWidth={2} />
              <span>Generate mission briefing</span>
            </>
          )}
        </button>
      </div>

      {/* Provenance & Fallback Banner */}
      <div className="p-4 rounded-[16px] glass-panel border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.15)] flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-2">
          <CheckCircle2
            size={18}
            strokeWidth={1.75}
            className="text-emerald-300 shrink-0"
          />
          <span className="text-[#FFF4E6] font-bold">
            Compilation Engine:
          </span>
          <span className="font-mono-tabular text-[#FFF4E6]/80 bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
            {briefing.modelUsed}
          </span>
        </div>

        <div className="font-mono-tabular text-[12px] text-[#FFF4E6]/75">
          Generated: {new Date(briefing.generatedAt).toLocaleTimeString()} · Mission{' '}
          {config.missionId}
        </div>
      </div>

      {briefingWarning && (
        <div className="p-4 rounded-[16px] glass-panel border border-amber-400/40 bg-amber-500/20 text-[12px] text-amber-100 flex items-start gap-2.5">
          <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5 text-amber-300" />
          <span>{briefingWarning}</span>
        </div>
      )}

      {/* Main Structured Briefing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Mission, Objectives, Route, Time Budget */}
        <div className="lg:col-span-7 glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] divide-y divide-white/15 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-1.5">
            <span className="label-caps">1. Executive Mission Summary</span>
            <p className="text-[13px] text-[#FFF4E6] leading-relaxed font-sans">
              {briefing.missionSummary}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1.5">
            <span className="label-caps">2. Scientific Objective Summary</span>
            <p className="text-[13px] text-[#FFF4E6] leading-relaxed font-sans">
              {briefing.scientificObjectiveSummary}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1.5">
            <span className="label-caps">3. Traverse Route Summary</span>
            <p className="text-[13px] font-mono-tabular text-[#FFF4E6] leading-relaxed">
              {briefing.routeSummary}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="label-caps">4. Time-Budget Assessment</span>
              <span
                className={`font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded-[6px] border ${
                  metrics.isOverBudget
                    ? 'bg-red-500/25 border-red-400/40 text-red-200'
                    : 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                }`}
              >
                {metrics.isOverBudget ? 'EXCEEDS BUDGET' : 'WITHIN BUDGET'}
              </span>
            </div>
            <p className="text-[13px] text-[#FFF4E6] leading-relaxed font-sans">
              {briefing.timeBudgetAssessment}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-2.5">
            <span className="label-caps">5. Terrain & Topographic Observations</span>
            <ul className="space-y-2 text-[12.5px] font-mono-tabular text-[#FFF4E6]">
              {briefing.terrainObservations.map((obs, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Compass
                    size={16}
                    strokeWidth={1.75}
                    className="text-[#FFF4E6] shrink-0 mt-0.5"
                  />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Assumptions, Missing Info, Planning Considerations */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-2.5">
            <span className="label-caps flex items-center gap-1.5 text-amber-200">
              <Clock size={16} strokeWidth={1.75} />
              <span>6. Explicit Simulation Assumptions</span>
            </span>
            <ul className="space-y-2 text-[12px] text-[#FFF4E6]/80 font-sans">
              {briefing.assumptions.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-2.5">
            <span className="label-caps flex items-center gap-1.5 text-amber-200">
              <FileWarning size={16} strokeWidth={1.75} />
              <span>7. Missing Information & Dataset Gaps</span>
            </span>
            <ul className="space-y-2 text-[12px] text-[#FFF4E6]/80 font-sans">
              {briefing.missingInformation.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-2.5">
            <span className="label-caps">8. Operational Planning Considerations</span>
            <ul className="space-y-2 text-[12px] text-[#FFF4E6] font-sans">
              {briefing.planningConsiderations.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
