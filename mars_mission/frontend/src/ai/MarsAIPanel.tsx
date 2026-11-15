import React, { useState, useEffect } from "react";
import {
  MapContext,
  MissionBriefing,
  ExplainTargetResponse,
  TerrainSummaryResponse,
  RouteInsightsResponse,
  ReportResponse,
  HealthAssistResponse,
  HealthStatus,
  SystemStatusResponse,
} from "./types";
import {
  fetchMissionBriefing,
  fetchExplainTarget,
  fetchTerrainSummary,
  fetchRouteInsights,
  fetchMissionReport,
  fetchHealthAssist,
  checkAIHealth,
  fetchSystemStatus,
} from "./api";
import { BriefingCard } from "./BriefingCard";
import { ChatWindow } from "./ChatWindow";
import { MissionCommanderView } from "./MissionCommanderView";

export interface MarsAIPanelProps {
  context?: MapContext;
  onWaypointSelect?: (lat: number, lon: number) => void;
  className?: string;
}

export const MarsAIPanel: React.FC<MarsAIPanelProps> = ({
  context,
  onWaypointSelect,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<
    "commander" | "briefing" | "targets" | "insights" | "terrain" | "report" | "health" | "chat"
  >("commander");

  const [briefing, setBriefing] = useState<MissionBriefing | null>(null);
  const [targetExplanation, setTargetExplanation] = useState<ExplainTargetResponse | null>(null);
  const [terrainSummary, setTerrainSummary] = useState<TerrainSummaryResponse | null>(null);
  const [routeInsights, setRouteInsights] = useState<RouteInsightsResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [healthAssist, setHealthAssist] = useState<HealthAssistResponse | null>(null);

  const [healthQuery, setHealthQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [lastUsedProvider, setLastUsedProvider] = useState<string | null>(null);

  useEffect(() => {
    checkAIHealth()
      .then(setHealth)
      .catch((err) => console.warn("Backend health check warning:", err));

    fetchSystemStatus()
      .then((status) => {
        setSystemStatus(status);
        if (status.active_provider_order && status.active_provider_order.length > 0) {
          setLastUsedProvider(status.active_provider_order[0]);
        }
      })
      .catch((err) => console.warn("System status check warning:", err));
  }, []);

  const getProviderBadge = () => {
    const prov = (lastUsedProvider || health?.provider || "gemini").toLowerCase();
    if (health?.demo_mode || prov === "offline") {
      return {
        label: "Offline guide mode",
        color: "bg-slate-800 text-amber-300 border-slate-700",
      };
    }
    if (prov === "gemini") {
      return {
        label: "AI: Gemini",
        color: "bg-cyan-950 text-cyan-300 border-cyan-800",
      };
    }
    if (prov === "groq") {
      return {
        label: "Backup AI: Groq",
        color: "bg-amber-950 text-amber-300 border-amber-800",
      };
    }
    if (prov === "openrouter") {
      return {
        label: "Backup AI: OpenRouter",
        color: "bg-indigo-950 text-indigo-300 border-indigo-800",
      };
    }
    if (prov === "mistral") {
      return {
        label: "Backup AI: Mistral",
        color: "bg-orange-950 text-orange-300 border-orange-800",
      };
    }
    if (prov === "ollama") {
      return {
        label: "Local AI: Ollama",
        color: "bg-emerald-950 text-emerald-300 border-emerald-800",
      };
    }
    return {
      label: `AI: ${prov.toUpperCase()}`,
      color: "bg-slate-800 text-slate-300 border-slate-700",
    };
  };

  const handleGenerateBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMissionBriefing(context);
      setBriefing(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("briefing");
    } catch (err: any) {
      setError(err.message || "Failed to generate briefing.");
    } finally {
      setLoading(false);
    }
  };

  const handleExplainTarget = async (targetId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const selectedId = targetId || context?.science_targets?.[0]?.id || "target-boxwork-1";
      const data = await fetchExplainTarget(selectedId, undefined, context);
      setTargetExplanation(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("targets");
    } catch (err: any) {
      setError(err.message || "Failed to explain science target.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRouteInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRouteInsights(context?.route, context);
      setRouteInsights(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("insights");
    } catch (err: any) {
      setError(err.message || "Failed to generate route insights.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchTerrainSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTerrainSummary(context);
      setTerrainSummary(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("terrain");
    } catch (err: any) {
      setError(err.message || "Failed to generate terrain summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMissionReport(context);
      setReport(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("report");
    } catch (err: any) {
      setError(err.message || "Failed to generate mission report.");
    } finally {
      setLoading(false);
    }
  };

  const handleHealthAssist = async (customQuery?: string) => {
    const q = (customQuery || healthQuery).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealthAssist(q, undefined, context);
      setHealthAssist(data);
      if (data.response_metadata?.provider_used) {
        setLastUsedProvider(data.response_metadata.provider_used);
      }
      setActiveTab("health");
    } catch (err: any) {
      setError(err.message || "Health assist inquiry failed.");
    } finally {
      setLoading(false);
    }
  };

  const badge = getProviderBadge();

  return (
    <div
      className={`flex flex-col bg-slate-950/95 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-lg ${className}`}
    >
      {/* 1. Header & ROVERSE System Status */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-700/80 flex items-center justify-center text-red-400 font-bold text-sm shadow-inner">
            ROV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wide text-white uppercase">
                ROVERSE Tactical AI
              </h2>
              <span
                className={`text-[10px] font-semibold border px-2.5 py-0.5 rounded-full transition-all shadow-sm ${badge.color}`}
              >
                {badge.label}
              </span>
              {health?.demo_mode && (
                <span className="text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">
                  DEMO MODE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Gale Crater / Mount Sharp • Boxwork Discovery Expedition (Simulation)
            </p>
          </div>
        </div>

        {/* Generate Briefing CTA Button */}
        <button
          type="button"
          onClick={handleGenerateBriefing}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-lg text-xs font-semibold tracking-wide shadow-md transition-all flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Synthesizing...</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Generate Mission Briefing</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Educational Simulation Notice Bar */}
      <div className="bg-slate-900/40 border-b border-slate-800/80 px-4 py-1.5 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-amber-400/90 font-medium">
          <span>⚠️</span> Educational Simulation (Not certified NASA flight operations)
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          Core Rule: Numbers strictly from supplied data
        </span>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-2 overflow-x-auto text-xs font-medium no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("commander")}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "commander"
              ? "border-orange-500 text-orange-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🎖️</span>
          <span>Mission Control</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("briefing")}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "briefing"
              ? "border-red-400 text-red-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🛡️</span>
          <span>Briefing</span>
          {briefing && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
              {briefing.go_no_go}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!targetExplanation) handleExplainTarget();
            else setActiveTab("targets");
          }}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "targets"
              ? "border-cyan-400 text-cyan-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🔬</span>
          <span>Science Targets</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!routeInsights) handleFetchRouteInsights();
            else setActiveTab("insights");
          }}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "insights"
              ? "border-amber-400 text-amber-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🧭</span>
          <span>Route Insights</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!terrainSummary) handleFetchTerrainSummary();
            else setActiveTab("terrain");
          }}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "terrain"
              ? "border-emerald-400 text-emerald-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🗺️</span>
          <span>Terrain & Layers</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!report) handleGenerateReport();
            else setActiveTab("report");
          }}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "report"
              ? "border-indigo-400 text-indigo-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>📑</span>
          <span>Mission Report</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("health")}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "health"
              ? "border-rose-400 text-rose-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>❤️</span>
          <span>Health & Safety</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "chat"
              ? "border-blue-400 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>💬</span>
          <span>Tactical Chat</span>
        </button>
      </div>

      {/* 4. Panel Content Area */}
      <div className="p-4 overflow-y-auto max-h-[620px]">
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 0: AI Mission Commander (Master Orchestrator) */}
        {activeTab === "commander" && (
          <MissionCommanderView
            context={context}
            onWaypointSelect={onWaypointSelect}
          />
        )}

        {/* TAB 1: Mission Briefing */}
        {activeTab === "briefing" && (
          <div className="space-y-4">
            {!briefing && !loading && (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
                <span className="text-3xl block">🪐</span>
                <h4 className="text-sm font-semibold text-slate-200">
                  Ready for Gale Crater / Mount Sharp Analysis
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Evaluate the <strong className="text-red-400">Boxwork Discovery Expedition</strong>{" "}
                  against MOLA slopes, HiRISE optical ridges, THEMIS thermal inertia, and MSL RAD data.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateBriefing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Run Briefing on Gale Crater Traverse
                </button>
              </div>
            )}

            {briefing && (
              <BriefingCard
                briefing={briefing}
                onWaypointSelect={onWaypointSelect}
              />
            )}
          </div>
        )}

        {/* TAB 2: Science Targets Explanation */}
        {activeTab === "targets" && (
          <div className="space-y-4 text-xs">
            {targetExplanation ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider block">
                      Target Dossier [{targetExplanation.target_id}]
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {targetExplanation.target_name}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Gale Crater
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Geological Significance</h4>
                  <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded border border-slate-800">
                    {targetExplanation.geological_significance}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Scientific Hypothesis</h4>
                  <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded border border-slate-800">
                    {targetExplanation.scientific_hypothesis}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Sampling Protocol</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                    {targetExplanation.sampling_recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>

                {targetExplanation.data_limitations && (
                  <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded text-[11px] text-amber-200/80">
                    <strong>Caveats & Limitations:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {targetExplanation.data_limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl">
                <button
                  onClick={() => handleExplainTarget()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-semibold"
                >
                  Explain Boxwork Science Target
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Route Insights */}
        {activeTab === "insights" && (
          <div className="space-y-4 text-xs">
            {routeInsights ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">
                      Traverse Assessment
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {routeInsights.route_name}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    Metrics Verified
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
                  <p className="text-slate-300 leading-relaxed">
                    {routeInsights.summary_of_metrics}
                  </p>
                </div>

                {/* Per-Segment Breakdown */}
                {routeInsights.segment_insights && routeInsights.segment_insights.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-amber-300">Segment Inspections</h4>
                    <div className="space-y-2">
                      {routeInsights.segment_insights.map((seg, i) => (
                        <div
                          key={i}
                          className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-white font-bold">{seg.from_to}</span>
                            <div className="flex items-center gap-2">
                              {seg.steepness_flag && (
                                <span className="bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.2 rounded text-[10px]">
                                  STEEP SLOPE
                                </span>
                              )}
                              {seg.long_segment_flag && (
                                <span className="bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded text-[10px]">
                                  LONG LEG
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-1">
                            {seg.planning_insights}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-300">Return-Trip Safety Margin</h4>
                  <p className="text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                    {routeInsights.return_trip_considerations}
                  </p>
                </div>

                {routeInsights.data_limitations && (
                  <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded text-[11px] text-amber-200/80">
                    <strong>Caveats & Limitations:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {routeInsights.data_limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl">
                <button
                  onClick={handleFetchRouteInsights}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-white font-semibold"
                >
                  Analyze Route Traverse Metrics
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Terrain Summary */}
        {activeTab === "terrain" && (
          <div className="space-y-4 text-xs">
            {terrainSummary ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">
                    Gale Crater / Mount Sharp
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Regional Terrain & NASA Layers
                  </h3>
                  <p className="text-slate-300 mt-1">{terrainSummary.region_overview}</p>
                </div>

                {/* Core Layers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(terrainSummary.layer_summaries).map(([layer, text]) => (
                    <div
                      key={layer}
                      className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1"
                    >
                      <span className="font-mono text-cyan-300 uppercase font-semibold text-[11px] block">
                        {layer}
                      </span>
                      <p className="text-slate-300 text-[11px]">{text}</p>
                    </div>
                  ))}
                </div>

                {/* Terrain Roughness & Environmental */}
                <div className="space-y-2">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    <span className="font-semibold text-slate-200 block mb-1">
                      Surface Roughness & Slopes
                    </span>
                    <p className="text-slate-300">{terrainSummary.terrain_roughness_and_slopes}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    <span className="font-semibold text-slate-200 block mb-1">
                      Thermal & Radiation Context
                    </span>
                    <p className="text-slate-300">{terrainSummary.environmental_considerations}</p>
                  </div>
                </div>

                {terrainSummary.data_limitations && (
                  <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded text-[11px] text-amber-200/80">
                    <strong>Caveats & Limitations:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {terrainSummary.data_limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl">
                <button
                  onClick={handleFetchTerrainSummary}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-semibold"
                >
                  Generate Terrain Summary
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Downloadable Mission Report */}
        {activeTab === "report" && (
          <div className="space-y-4 text-xs">
            {report ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block">
                      Downloadable Mission Dossier
                    </span>
                    <h3 className="text-base font-bold text-white">{report.mission_name}</h3>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(report.full_report_markdown);
                      alert("Report Markdown copied to clipboard!");
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>Copy Markdown</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[360px] overflow-y-auto whitespace-pre-wrap">
                  {report.full_report_markdown}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl">
                <button
                  onClick={handleGenerateReport}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-semibold"
                >
                  Generate Complete Mission Report
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Astronaut Health & Safety Assistant */}
        {activeTab === "health" && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 text-lg">❤️</span>
                  <h3 className="text-base font-bold text-white">
                    Astronaut Health & Safety Assistant
                  </h3>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Deterministic Red-Flag Triage & operational EVA safety protocols.
                  Not medical advice.
                </p>
              </div>

              {/* Quick Query Triggers */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">
                  Simulate Incident / Health Check:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHealthQuery("Astronaut reports sudden chest pain and shortness of breath during ridge climb.");
                      handleHealthAssist("Astronaut reports sudden chest pain and shortness of breath during ridge climb.");
                    }}
                    className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 rounded text-[11px] transition-all"
                  >
                    🚨 Test Red-Flag (Chest Pain)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHealthQuery("Suit telemetry indicates secondary suit pressure loss alarm.");
                      handleHealthAssist("Suit telemetry indicates secondary suit pressure loss alarm.");
                    }}
                    className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800 text-amber-300 rounded text-[11px] transition-all"
                  >
                    ⚠️ Test Suit Pressure Alarm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHealthQuery("What is the nominal hydration and electrolyte protocol for a 4-hour boxwork traverse?");
                      handleHealthAssist("What is the nominal hydration and electrolyte protocol for a 4-hour boxwork traverse?");
                    }}
                    className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 rounded text-[11px] transition-all"
                  >
                    💧 Hydration & Electrolytes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHealthQuery("Recommendations for managing quadriceps fatigue on 15° basaltic scree ascent.");
                      handleHealthAssist("Recommendations for managing quadriceps fatigue on 15° basaltic scree ascent.");
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-[11px] transition-all"
                  >
                    ⚡ Muscle Fatigue Protocol
                  </button>
                </div>
              </div>

              {/* Custom Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={healthQuery}
                  onChange={(e) => setHealthQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleHealthAssist()}
                  placeholder="Enter astronaut symptom or EVA health query..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() => handleHealthAssist()}
                  disabled={loading || !healthQuery.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  Consult
                </button>
              </div>

              {/* Result Area */}
              {healthAssist && (
                <div className="mt-4 space-y-3">
                  {/* Red-Flag Banner */}
                  {healthAssist.is_emergency && (
                    <div className="p-4 bg-red-950/90 border-2 border-red-600 rounded-xl text-white space-y-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🚨</span>
                        <h4 className="font-black text-sm tracking-wide text-red-200 uppercase">
                          CRITICAL EVA EMERGENCY ACTION REQUIRED
                        </h4>
                      </div>
                      <p className="text-xs text-red-100 font-semibold">
                        {healthAssist.recommended_action}
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Category: <strong className="text-white">{healthAssist.triaged_category}</strong>
                      </span>
                      {healthAssist.response_metadata && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Provider: {healthAssist.response_metadata.provider_used} ({healthAssist.response_metadata.latency_ms}ms)
                        </span>
                      )}
                    </div>

                    <div>
                      <h5 className="font-semibold text-rose-300 mb-1">Operational Guidance:</h5>
                      <p className="text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-800">
                        {healthAssist.guidance}
                      </p>
                    </div>

                    {!healthAssist.is_emergency && (
                      <div>
                        <h5 className="font-semibold text-rose-300 mb-1">Recommended Action:</h5>
                        <p className="text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800">
                          {healthAssist.recommended_action}
                        </p>
                      </div>
                    )}

                    {healthAssist.emergency_steps && healthAssist.emergency_steps.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-rose-300 mb-1">Immediate Actions:</h5>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800">
                          {healthAssist.emergency_steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="bg-amber-950/20 border border-amber-900/40 p-2.5 rounded text-[10px] text-amber-200/80">
                      <strong>Educational Simulation Notice:</strong> {healthAssist.simulation_notice}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Tactical Chat */}
        {activeTab === "chat" && <ChatWindow context={context} />}
      </div>
    </div>
  );
};
