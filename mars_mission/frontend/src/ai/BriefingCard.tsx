import React, { useState } from "react";
import { MissionBriefing, BriefingWaypoint, HazardItem } from "./types";

interface BriefingCardProps {
  briefing: MissionBriefing;
  onWaypointSelect?: (lat: number, lon: number) => void;
}

export const BriefingCard: React.FC<BriefingCardProps> = ({
  briefing,
  onWaypointSelect,
}) => {
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "GO":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
      case "CAUTION":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      case "NO-GO":
        return "bg-rose-500/20 text-rose-300 border-rose-500/50";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  const getSeverityBadge = (severity: HazardItem["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "HIGH":
        return "bg-orange-500/20 text-orange-400 border-orange-500/40";
      case "MODERATE":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "LOW":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    }
  };

  const handleWaypointClick = (wp: BriefingWaypoint, idx: number) => {
    setSelectedWaypointIndex(idx);
    if (onWaypointSelect) {
      onWaypointSelect(wp.lat, wp.lon);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-2xl backdrop-blur-md space-y-6">
      {/* 1. Header & Verdict Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-md text-sm font-bold tracking-wider uppercase border ${getVerdictBadge(
              briefing.go_no_go
            )}`}
          >
            DECISION: {briefing.go_no_go}
          </span>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase tracking-wide">
            Risk: <strong className="text-amber-400">{briefing.risk_level}</strong>
          </span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Confidence:</span>
          <span className="text-cyan-400 font-mono font-bold">
            {(briefing.confidence * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-500">(Multi-Mission Telemetry)</span>
        </div>
      </div>

      {/* 2. Executive Summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1.5 flex items-center gap-1.5">
          <span>🛡️</span> EVA Mission Assessment
        </h4>
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          {briefing.summary}
        </p>
      </div>

      {/* 3. Consumables & Life Support Budget */}
      {briefing.consumables && (
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-lg space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <span>⚡</span> Consumables & Limits
            </span>
            <span className="text-amber-400 font-mono">
              Turn-Around Deadline: T+{briefing.consumables.safe_return_deadline_minutes}m
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Oxygen Reserve */}
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">Oxygen Reserve</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {briefing.consumables.oxygen_reserve_margin_percent}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      briefing.consumables.oxygen_reserve_margin_percent
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Burn rate: {briefing.consumables.oxygen_consumed_percent}% used
              </span>
            </div>

            {/* Suit Power Battery */}
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">Suit Power Margin</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {(100 - briefing.consumables.battery_consumed_percent).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.max(
                      0,
                      100 - briefing.consumables.battery_consumed_percent
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Total duration est: {briefing.consumables.estimated_duration_hours} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Identified Environmental Hazards */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2.5 flex items-center gap-1.5">
          <span>⚠️</span> Identified Hazards & Mitigations ({briefing.hazards?.length || 0})
        </h4>

        {briefing.hazards && briefing.hazards.length > 0 ? (
          <div className="space-y-2.5">
            {briefing.hazards.map((hazard, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getSeverityBadge(
                        hazard.severity
                      )}`}
                    >
                      {hazard.severity}
                    </span>
                    <strong className="text-slate-100 text-sm">{hazard.type}</strong>
                  </div>
                  <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400 font-mono">
                    Source: {hazard.source_layer}
                  </span>
                </div>
                <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <span>📍</span>
                  <span>{hazard.location}</span>
                </div>
                <div className="text-emerald-300/90 bg-emerald-950/20 p-2 rounded border border-emerald-900/30 flex items-start gap-1.5">
                  <span className="text-emerald-400">↳ Protocol:</span>
                  <span>{hazard.mitigation}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded">
            No critical hazards flagged along nominal traverse corridor.
          </div>
        )}
      </div>

      {/* 5. Interactive Waypoints (Click to highlight on map) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <span>🗺️</span> Traverse Waypoints
          </h4>
          <span className="text-[10px] text-cyan-500 italic">Click waypoint to focus map</span>
        </div>

        {briefing.waypoints && briefing.waypoints.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {briefing.waypoints.map((wp, idx) => {
              const isSelected = selectedWaypointIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleWaypointClick(wp, idx)}
                  type="button"
                  className={`text-left p-3 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-950/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-900 text-cyan-300 text-[10px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      {wp.label}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {wp.lat.toFixed(4)}°, {wp.lon.toFixed(4)}°
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{wp.reason}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded">
            No distinct waypoints provided in route profile.
          </div>
        )}
      </div>

      {/* 6. Chronological EVA Timeline */}
      {briefing.eva_timeline && briefing.eva_timeline.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2.5 flex items-center gap-1.5">
            <span>⏱️</span> Operational EVA Timeline
          </h4>
          <div className="border-l-2 border-indigo-500/30 pl-3 space-y-3.5 ml-1">
            {briefing.eva_timeline.map((event, idx) => (
              <div key={idx} className="relative text-xs space-y-1">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-900" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-indigo-300 font-bold">
                    T+{event.time_offset_min} min
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {event.consumable_status}
                  </span>
                </div>
                <p className="text-slate-200">{event.action}</p>
                <p className="text-[11px] text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-semibold">Checkpoint:</span>{" "}
                  {event.safety_checkpoint}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Science Opportunities & Data Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
        {/* Science */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
          <h5 className="font-semibold text-emerald-400 flex items-center gap-1">
            <span>🔬</span> Science Opportunities
          </h5>
          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
            {briefing.science_opportunities && briefing.science_opportunities.length > 0 ? (
              briefing.science_opportunities.map((item, i) => <li key={i}>{item}</li>)
            ) : (
              <li className="text-slate-500 italic">No specific science targets registered.</li>
            )}
          </ul>
        </div>

        {/* Data Gaps */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
          <h5 className="font-semibold text-amber-400 flex items-center gap-1">
            <span>📡</span> Mission Data Gaps & Uncertainty
          </h5>
          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
            {briefing.data_gaps && briefing.data_gaps.length > 0 ? (
              briefing.data_gaps.map((item, i) => <li key={i}>{item}</li>)
            ) : (
              <li className="text-slate-500 italic">No critical telemetry voids identified.</li>
            )}
          </ul>
        </div>
      </div>

      {/* 8. Explicit Data Limitations & Scientific Disclaimers */}
      {briefing.data_limitations && briefing.data_limitations.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-lg text-xs space-y-2">
          <h5 className="font-semibold text-amber-300 flex items-center gap-1.5">
            <span>⚠️</span> Data Limitations & Operational Caveats
          </h5>
          <ul className="list-disc list-inside space-y-1 text-amber-200/80 text-[11px]">
            {briefing.data_limitations.map((limit, idx) => (
              <li key={idx}>{limit}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Simulation Notice Footer */}
      <div className="text-[10px] text-center text-slate-500 font-mono pt-2 border-t border-slate-800/60">
        {briefing.simulation_notice ||
          "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."}
      </div>
    </div>
  );
};
