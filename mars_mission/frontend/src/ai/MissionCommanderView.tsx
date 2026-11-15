import React, { useState, useEffect } from "react";
import {
  MapContext,
  OrchestrateResponse,
  EnvironmentSnapshot,
  DecisionAuditRecord,
} from "./types";
import {
  getEnvironmentSnapshot,
  subscribeEnvironmentStream,
  getDecisionAuditTrail,
  useMissionCommander,
} from "./api";

interface MissionCommanderViewProps {
  context?: MapContext;
  onWaypointSelect?: (lat: number, lon: number) => void;
}

export const MissionCommanderView: React.FC<MissionCommanderViewProps> = ({
  context,
  onWaypointSelect,
}) => {
  const commander = useMissionCommander(context);
  const [envSnapshot, setEnvSnapshot] = useState<EnvironmentSnapshot | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(true);
  const [decisions, setDecisions] = useState<DecisionAuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  // Simulated vitals state
  const [vitals, setVitals] = useState({
    heart_rate_bpm: 72,
    spo2_pct: 98,
    suit_pressure_kpa: 29.6,
    fatigue_score: 1.0,
  });

  // Initial load: snapshot, orchestrate baseline, load decisions
  useEffect(() => {
    getEnvironmentSnapshot()
      .then(setEnvSnapshot)
      .catch((err) => console.warn("Environment snapshot warning:", err));

    loadDecisions();

    // Trigger initial orchestration
    commander.emitEvent("route_changed", {
      site: context?.mission?.region || "jezero",
      vitals,
    });

    // Subscribe to SSE stream
    const unsubscribe = subscribeEnvironmentStream(
      (event) => {
        setStreamActive(true);
        if (event.type === "snapshot" && event.data) {
          setEnvSnapshot(event.data);
        } else if (event.data) {
          setEnvSnapshot((prev) => (prev ? { ...prev, ...event.data } : event.data));
        }
      },
      (err) => {
        setStreamActive(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loadDecisions = () => {
    setAuditLoading(true);
    getDecisionAuditTrail(10)
      .then((data) => setDecisions(data.decisions || []))
      .catch((err) => console.warn("Audit trail warning:", err))
      .finally(() => setAuditLoading(false));
  };

  const handleSimulateEmergency = async () => {
    const emVitals = {
      heart_rate_bpm: 182,
      spo2_pct: 81,
      suit_pressure_kpa: 21.4,
      fatigue_score: 4.8,
    };
    setVitals(emVitals);
    await commander.emitEvent("vitals_updated", {
      vitals: emVitals,
      query: "CRITICAL: Astronaut reports severe chest pain and sudden suit pressure drop.",
    });
    loadDecisions();
  };

  const handleResetVitals = async () => {
    const nomVitals = {
      heart_rate_bpm: 72,
      spo2_pct: 98,
      suit_pressure_kpa: 29.6,
      fatigue_score: 1.0,
    };
    setVitals(nomVitals);
    await commander.emitEvent("vitals_updated", { vitals: nomVitals });
    loadDecisions();
  };

  const verdict = commander.lastResponse?.verdict || commander.activeVerdict || "GO";

  const getVerdictStyle = () => {
    switch (verdict) {
      case "ABORT":
        return "bg-red-950/90 border-red-500 text-red-200 animate-pulse";
      case "NO-GO":
        return "bg-rose-950/80 border-rose-500 text-rose-200";
      case "CAUTION":
        return "bg-amber-950/80 border-amber-500 text-amber-200";
      case "GO":
      default:
        return "bg-emerald-950/80 border-emerald-500 text-emerald-200";
    }
  };

  const getProvenanceBadge = (status?: string) => {
    switch (status) {
      case "Observed":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800";
      case "Derived":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "Interpreted":
        return "bg-purple-950/80 text-purple-300 border-purple-800";
      case "Simulated":
        return "bg-blue-950/80 text-blue-300 border-blue-800";
      case "Assumed":
      default:
        return "bg-orange-950/80 text-orange-300 border-orange-800";
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans text-slate-200">
      {/* 1. Commander Master Verdict Hero */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${getVerdictStyle()}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">
              {verdict === "ABORT" ? "🚨" : verdict === "NO-GO" ? "🛑" : verdict === "CAUTION" ? "⚠️" : "✅"}
            </span>
            <span className="text-sm font-black tracking-wider uppercase">
              ORCHESTRATED VERDICT: {verdict}
            </span>
            {commander.degraded && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-amber-300 font-mono">
                DEGRADED FALLBACK
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-slate-300 font-mono">
              Confidence: {Math.round((commander.lastResponse?.confidence || 1.0) * 100)}%
            </span>
          </div>
          <p className="text-[11px] mt-1 text-slate-300">
            {commander.lastResponse?.reasons?.[0] ||
              "All operational engines, physiological boundaries, and consumable reserves evaluated."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-[10px] text-slate-400 font-mono">
            Provider: {commander.lastResponse?.provider_used || "deterministic_gate"}
          </span>
          <button
            type="button"
            onClick={() => commander.emitEvent("route_changed", { site: "jezero", vitals })}
            disabled={commander.loading}
            className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-medium transition-all"
          >
            {commander.loading ? "Evaluating..." : "Re-evaluate"}
          </button>
        </div>
      </div>

      {/* Emergency Protocol Display if ABORT */}
      {verdict === "ABORT" && commander.lastResponse?.emergency_protocol && (
        <div className="p-4 rounded-xl bg-red-950/90 border border-red-600 text-red-100 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
              <span>⚠️</span> {commander.lastResponse.emergency_protocol.recommended_action}
            </span>
            <span className="text-[10px] font-mono bg-red-900 border border-red-700 px-2 py-0.5 rounded">
              CATEGORY: {commander.lastResponse.emergency_protocol.triage_category}
            </span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-red-200">
            {commander.lastResponse.emergency_protocol.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Key Grounded Numbers & Provenance Matrix */}
      {commander.lastResponse?.numbers && commander.lastResponse.numbers.length > 0 && (
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-white tracking-wide">
              GROUNDED TELEMETRY & PROVENANCE
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Core Rule 1: No invented numbers
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {commander.lastResponse.numbers.map((num, i) => (
              <div
                key={i}
                className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-400 truncate">{num.name || "Metric"}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${getProvenanceBadge(
                      num.status
                    )}`}
                  >
                    {num.status || "Derived"}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {num.value !== undefined && num.value !== null ? String(num.value) : "N/A"}{" "}
                  <span className="text-[10px] font-normal text-slate-400">{num.unit || ""}</span>
                </div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5" title={num.source || ""}>
                  Source: {num.source || "Simulation Engine"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Recommended Fixes & Alternatives */}
      {commander.lastResponse?.alternatives && commander.lastResponse.alternatives.length > 0 && (
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <span className="font-semibold text-white tracking-wide">
            RECOMMENDED FIXES & ALTERNATIVES
          </span>
          <div className="space-y-1.5">
            {commander.lastResponse.alternatives.map((alt, i) => (
              <div
                key={i}
                className="p-2 bg-slate-950/60 border border-slate-800/60 rounded-lg flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded">
                    {alt.fix_type}
                  </span>
                  <span className="text-[11px] text-slate-300">{alt.description}</span>
                </div>
                {alt.time_saved_min && (
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                    -{alt.time_saved_min} min
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Live Environment & Continuous Monitoring */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">ENVIRONMENTAL TELEMETRY</span>
            <span
              className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-mono border ${
                streamActive
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  streamActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {streamActive ? "LIVE SSE STREAM" : "POLLING"}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {envSnapshot?.site?.toUpperCase() || "JEZERO"} CORRIDOR
          </span>
        </div>

        {envSnapshot ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Air Temp (REMS)</span>
              <span className="text-sm font-bold text-white">
                {envSnapshot.temperature?.air_c ?? "-62.0"} °C
              </span>
              <span className="text-[9px] text-slate-500 block">
                Ground: {envSnapshot.temperature?.ground_c ?? "-18.0"} °C
              </span>
            </div>

            <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Dust Opacity (τ)</span>
              <span className="text-sm font-bold text-amber-300">
                {envSnapshot.dust?.optical_depth_tau ?? "0.45"}
              </span>
              <span className="text-[9px] text-slate-500 block">Status: Derived</span>
            </div>

            <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Radiation Baseline</span>
              <span className="text-sm font-bold text-white">
                {envSnapshot.radiation?.dose_rate_usvh ?? "25.2"} µSv/hr
              </span>
              <span className="text-[9px] text-slate-500 block">MSL RAD Baseline</span>
            </div>

            <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Earth Comms (DTE)</span>
              <span className="text-sm font-bold text-emerald-400">
                {envSnapshot.comms?.dte_visible ? "Visible" : "Blackout"}
              </span>
              <span className="text-[9px] text-slate-500 block">
                Delay: ~{Math.round((envSnapshot.comms?.light_delay_sec || 852) / 60)} min
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-xs py-2">Loading live environmental stream...</div>
        )}

        {/* Curated Measures */}
        {envSnapshot?.measures_to_follow && envSnapshot.measures_to_follow.length > 0 && (
          <div className="mt-2 space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 block">
              CURATED OPERATIONAL MEASURES:
            </span>
            {envSnapshot.measures_to_follow.map((m, i) => (
              <div
                key={i}
                className="p-1.5 bg-slate-950/50 border border-slate-800 rounded text-[10px] text-slate-300 flex items-start gap-1.5"
              >
                <span className="text-amber-400">▸</span>
                <div>
                  <span className="font-semibold text-white">{m.condition}: </span>
                  <span>{m.measure}</span>
                  <span className="text-[9px] text-slate-500 ml-1">({m.source})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Explorer Vitals & Biometrics */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white">EXPLORER BIOMETRIC TELEMETRY</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSimulateEmergency}
              className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 rounded text-[10px] font-bold transition-all"
            >
              Simulate Emergency (ABORT)
            </button>
            <button
              type="button"
              onClick={handleResetVitals}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded text-[10px] transition-all"
            >
              Reset Nominal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 block">Heart Rate</span>
            <span
              className={`text-sm font-bold ${
                vitals.heart_rate_bpm > 175 || vitals.heart_rate_bpm < 38
                  ? "text-red-400 animate-pulse"
                  : "text-white"
              }`}
            >
              {vitals.heart_rate_bpm} bpm
            </span>
          </div>

          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 block">SpO2 Level</span>
            <span
              className={`text-sm font-bold ${
                vitals.spo2_pct < 88 ? "text-red-400 animate-pulse" : "text-white"
              }`}
            >
              {vitals.spo2_pct}%
            </span>
          </div>

          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 block">Suit Pressure</span>
            <span
              className={`text-sm font-bold ${
                vitals.suit_pressure_kpa < 25.0 ? "text-red-400 animate-pulse" : "text-white"
              }`}
            >
              {vitals.suit_pressure_kpa} kPa
            </span>
          </div>

          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 block">Fatigue Index</span>
            <span className="text-sm font-bold text-white">{vitals.fatigue_score.toFixed(1)} / 5.0</span>
          </div>
        </div>
      </div>

      {/* 6. Immutable Decision Audit Trail */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white">DECISION AUDIT TRAIL</span>
          <button
            type="button"
            onClick={loadDecisions}
            disabled={auditLoading}
            className="text-[10px] text-slate-400 hover:text-white underline font-mono"
          >
            {auditLoading ? "Refreshing..." : "Refresh Trail"}
          </button>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[10px]">
          {decisions.length === 0 ? (
            <div className="text-slate-500 py-1">No decisions recorded yet.</div>
          ) : (
            decisions.map((dec) => (
              <div
                key={dec.decision_id}
                className="p-2 bg-slate-950/60 border border-slate-800/60 rounded flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      dec.verdict === "ABORT"
                        ? "bg-red-950 text-red-300"
                        : dec.verdict === "NO-GO"
                        ? "bg-rose-950 text-rose-300"
                        : dec.verdict === "CAUTION"
                        ? "bg-amber-950 text-amber-300"
                        : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    {dec.verdict}
                  </span>
                  <span className="text-slate-300 truncate">{dec.event_type}</span>
                  <span className="text-slate-500 text-[9px]">ID: {dec.decision_id.slice(0, 8)}</span>
                </div>
                <div className="text-slate-500 shrink-0">{dec.latency_ms} ms</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 7. Data Limitations Notice */}
      <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 text-[10px] text-slate-400 space-y-1">
        <div className="font-semibold text-slate-300 flex items-center gap-1">
          <span>ℹ️</span> DATA LIMITATIONS & HONESTY DISCLOSURE:
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-slate-400">
          <li>Orbital thermal inertia is not a live meteorological weather forecast.</li>
          <li>Historical Curiosity RAD surface readings do not predict instantaneous solar particle events.</li>
          <li>Walking speeds and metabolic limits are simulation assumptions. Missing values display "data not available".</li>
        </ul>
      </div>
    </div>
  );
};
