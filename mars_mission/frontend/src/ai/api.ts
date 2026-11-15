/**
 * API client and Server-Sent Events (SSE) streaming reader for ROVERSE Mars Mission Planning.
 */

import {
  ExplainTargetResponse,
  HealthAssistResponse,
  HealthStatus,
  MapContext,
  MissionBriefing,
  ReportResponse,
  RouteAdviceResponse,
  RouteContext,
  RouteInsightsResponse,
  ScienceTarget,
  SystemStatusResponse,
  TerrainSummaryResponse,
  ChatMessage,
} from "./types";

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  "http://localhost:8000";

/**
 * Health check to verify backend status, active provider (gemini/local), and DEMO_MODE flag.
 */
export async function checkAIHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/ai/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch real-time system status and multi-provider circuit diagnostics.
 */
export async function fetchSystemStatus(): Promise<SystemStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/status`);
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request astronaut health and safety assistance (with deterministic red-flag triage).
 */
export async function fetchHealthAssist(
  query: string,
  vitalSigns?: Record<string, any>,
  mapContext?: MapContext
): Promise<HealthAssistResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/health-assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      vital_signs: vitalSigns,
      map_context: mapContext,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Health assist failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request structured mission briefing.
 */
export async function fetchMissionBriefing(
  mapContext?: MapContext,
  candidateRoute?: RouteContext
): Promise<MissionBriefing> {
  const res = await fetch(`${API_BASE_URL}/api/ai/briefing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      map_context: mapContext,
      candidate_route: candidateRoute,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Briefing request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request explanation of a designated science target.
 */
export async function fetchExplainTarget(
  targetId?: string,
  target?: ScienceTarget,
  mapContext?: MapContext
): Promise<ExplainTargetResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/explain-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_id: targetId,
      target: target,
      map_context: mapContext,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Explain target failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request regional terrain and multi-mission layer summary.
 */
export async function fetchTerrainSummary(
  mapContext?: MapContext
): Promise<TerrainSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/terrain-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ map_context: mapContext }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Terrain summary failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request route metric analysis, steep segment flags, and return-trip considerations.
 */
export async function fetchRouteInsights(
  route?: RouteContext,
  mapContext?: MapContext
): Promise<RouteInsightsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/route-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route: route, map_context: mapContext }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Route insights failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request report-ready dossier text and markdown.
 */
export async function fetchMissionReport(
  mapContext?: MapContext
): Promise<ReportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ map_context: mapContext }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Mission report failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Request multi-route comparative analysis.
 */
export async function fetchRouteAdvice(
  candidateRoutes: RouteContext[],
  mapContext?: MapContext
): Promise<RouteAdviceResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/route-advice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidate_routes: candidateRoutes,
      map_context: mapContext,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Route advice failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Stream conversational responses from the ROVERSE Guide using SSE.
 */
export function streamChat({
  message,
  history,
  mapContext,
  onChunk,
  onError,
  onDone,
}: {
  message: string;
  history?: ChatMessage[];
  mapContext?: MapContext;
  onChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onDone: () => void;
}): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history || [],
          map_context: mapContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response stream body available from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              onChunk(parsed.text);
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch {
            onChunk(dataStr);
          }
        }
      }

      onDone();
    } catch (err: any) {
      if (err.name === "AbortError") {
        onDone();
      } else {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return () => controller.abort();
}


// ==============================================================================
// MISSION COMMANDER ORCHESTRATION CLIENT
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  OrchestrateEvent,
  OrchestrateResponse,
  EnvironmentSnapshot,
  DecisionAuditRecord,
} from "./types";

/**
 * Dispatch an event to the unified AI Mission Commander orchestrator.
 */
export async function orchestrate(event: OrchestrateEvent): Promise<OrchestrateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/orchestrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Orchestration error: ${res.status}`);
  }
  return res.json();
}

/**
 * Retrieve current environmental snapshot.
 */
export async function getEnvironmentSnapshot(
  lat: number = -4.68,
  lon: number = 137.38,
  site: string = "gale"
): Promise<EnvironmentSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/ai/environment/snapshot?lat=${lat}&lon=${lon}&site=${site}`);
  if (!res.ok) {
    throw new Error(`Environment snapshot failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Subscribe to the real-time Server-Sent Events (SSE) environmental change stream.
 */
export function subscribeEnvironmentStream(
  onEvent: (data: any) => void,
  onError?: (err: Error) => void
): () => void {
  let eventSource: EventSource | null = null;
  let active = true;

  const connect = () => {
    if (!active) return;
    eventSource = new EventSource(`${API_BASE_URL}/api/ai/environment/stream`);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.warn("SSE json parse error:", err);
      }
    };

    eventSource.onerror = (e) => {
      if (onError) onError(new Error("Environment stream disconnected"));
      eventSource?.close();
      if (active) {
        setTimeout(connect, 3000); // Reconnect backoff
      }
    };
  };

  connect();

  return () => {
    active = false;
    eventSource?.close();
  };
}

/**
 * Retrieve immutable decision audit trail.
 */
export async function getDecisionAuditTrail(
  limit: number = 50
): Promise<{ total: number; decisions: DecisionAuditRecord[] }> {
  const res = await fetch(`${API_BASE_URL}/api/ai/decisions?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load decision trail: ${res.status}`);
  }
  return res.json();
}

/**
 * Unified React hook connecting any section to the AI Mission Commander.
 */
export function useMissionCommander(initialContext?: MapContext) {
  const [activeVerdict, setActiveVerdict] = useState<"GO" | "CAUTION" | "NO-GO" | "ABORT">("GO");
  const [lastResponse, setLastResponse] = useState<OrchestrateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [dataLimitations, setDataLimitations] = useState<string[]>([]);
  const contextRef = useRef<MapContext | undefined>(initialContext);

  useEffect(() => {
    contextRef.current = initialContext;
  }, [initialContext]);

  const emitEvent = useCallback(
    async (
      eventType: OrchestrateEvent["event_type"],
      payload?: Record<string, any>
    ): Promise<OrchestrateResponse> => {
      setLoading(true);
      try {
        const resp = await orchestrate({
          event_type: eventType,
          payload: payload || {},
          map_context: contextRef.current,
        });
        setActiveVerdict(resp.verdict);
        setLastResponse(resp);
        setDegraded(resp.degraded);
        if (resp.data_limitations) {
          setDataLimitations(resp.data_limitations);
        }
        return resp;
      } catch (err: any) {
        setDegraded(true);
        console.error("Mission Commander event failed:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    activeVerdict,
    lastResponse,
    loading,
    degraded,
    dataLimitations,
    emitEvent,
  };
}
