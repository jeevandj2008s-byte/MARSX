import React from "react";
import { RouteAdviceResponse, RouteEvaluation } from "./types";

interface RouteAdvisorCardProps {
  advice: RouteAdviceResponse;
  onSelectRoute?: (routeId: string) => void;
}

export const RouteAdvisorCard: React.FC<RouteAdvisorCardProps> = ({
  advice,
  onSelectRoute,
}) => {
  const getVerdictStyle = (verdict: RouteEvaluation["verdict"]) => {
    switch (verdict) {
      case "RECOMMENDED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
      case "VIABLE_WITH_CAUTION":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      case "NOT_RECOMMENDED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/50";
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-2xl backdrop-blur-md space-y-5">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>🧭</span> Route Comparison & Tactical Recommendation
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Gemini multi-route trade-off analysis evaluated against MOLA slopes & life support limits.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
          Recommended: {advice.recommended_route_id}
        </span>
      </div>

      {/* Strategic Advice */}
      <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1">
        <h4 className="font-semibold text-cyan-400 flex items-center gap-1">
          <span>🎯</span> Commander's Strategic Directive
        </h4>
        <p className="text-slate-300 leading-relaxed">{advice.strategic_advice}</p>
      </div>

      {/* Ranked Routes Cards */}
      <div className="space-y-3.5">
        {advice.routes_ranked.map((route) => {
          const isPrimary = route.route_id === advice.recommended_route_id;
          return (
            <div
              key={route.route_id}
              className={`p-4 rounded-xl border text-xs transition-all ${
                isPrimary
                  ? "bg-slate-950/80 border-cyan-500/50 shadow-md shadow-cyan-950/30"
                  : "bg-slate-950/50 border-slate-800/80 opacity-90"
              }`}
            >
              {/* Card Title */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold font-mono text-[11px] text-cyan-400">
                    #{route.rank}
                  </span>
                  <span className="font-bold text-sm text-slate-100">{route.route_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Score:{" "}
                    <strong
                      className={
                        route.score_out_of_100 >= 80
                          ? "text-emerald-400"
                          : route.score_out_of_100 >= 60
                          ? "text-amber-400"
                          : "text-rose-400"
                      }
                    >
                      {route.score_out_of_100}/100
                    </strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getVerdictStyle(
                      route.verdict
                    )}`}
                  >
                    {route.verdict.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Rationale */}
              <p className="text-slate-300 mb-3 bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                {route.recommendation_rationale}
              </p>

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded">
                  <span className="font-semibold text-emerald-400 block mb-1">
                    ✓ Advantages
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                    {route.pros.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded">
                  <span className="font-semibold text-rose-400 block mb-1">
                    ✕ Hazards & Risks
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                    {route.cons.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Select button */}
              {onSelectRoute && (
                <button
                  type="button"
                  onClick={() => onSelectRoute(route.route_id)}
                  className={`w-full py-1.5 rounded text-xs font-semibold tracking-wide transition-all ${
                    isPrimary
                      ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  }`}
                >
                  {isPrimary ? "Active Recommended Route" : "Select Alternative Route"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
