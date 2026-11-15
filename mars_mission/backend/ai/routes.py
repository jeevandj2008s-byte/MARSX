"""FastAPI routes for ROVERSE Mars Mission Planning.

Mounted under /api/ai:
- POST /api/ai/briefing (Structured JSON Mission Briefing)
- POST /api/ai/explain-target (Explains one science target)
- POST /api/ai/terrain-summary (Summarizes terrain and layer data)
- POST /api/ai/route-insights (Explains route metrics, steep/long segments, return considerations)
- POST /api/ai/report (Report-ready text for downloadable mission report)
- POST /api/ai/chat (Streaming Q&A SSE)
- POST /api/ai/route-advice (Multi-route comparison)
- POST /api/ai/health-assist (Astronaut health and safety assistant with deterministic triage)
- POST /api/ai/analyze-terrain-image (Multimodal vision analysis)
- GET  /api/ai/status (System resilience, circuit breakers, and provider status)
- GET  /api/ai/health (Module status & active provider diagnostics)

CRITICAL RESILIENCE RULE:
No unhandled exception may escape an endpoint. An AI failure is never a 500 error.
Every endpoint always returns valid JSON conforming to its schema.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from .config import settings
from .gemini_client import gemini_client
from .router import provider_router
from .schemas import (
    BriefingRequest,
    ChatRequest,
    ExplainTargetRequest,
    ExplainTargetResponse,
    HealthAssistRequest,
    HealthAssistResponse,
    HealthStatus,
    MissionBriefing,
    ReportRequest,
    ReportResponse,
    ResponseMetadata,
    RouteAdviceRequest,
    RouteAdviceResponse,
    RouteInsightsRequest,
    RouteInsightsResponse,
    SystemStatusResponse,
    TerrainAnalysisRequest,
    TerrainSummaryRequest,
    TerrainSummaryResponse,
)

logger = logging.getLogger("roverse.ai.routes")

router = APIRouter(prefix="/api/ai", tags=["ROVERSE Mars Mission Planning"])


@router.get("/status", response_model=SystemStatusResponse)
async def system_status() -> SystemStatusResponse:
    """Return real-time status of all providers, circuit breaker states, and verified models."""
    return provider_router.get_system_status()


@router.get("/health", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    """Return health diagnostic and active provider configuration."""
    return HealthStatus(
        status="operational",
        project="ROVERSE - Mars Surface Exploration Planning System",
        provider="multi-provider-resilient",
        gemini_model=gemini_client.model_name,
        local_model=settings.LOCAL_AI_MODEL if settings.AI_PROVIDER == "local" else None,
        demo_mode=gemini_client.demo_mode,
        api_key_configured=bool(gemini_client.api_key),
        version="2.1.0",
    )


@router.post("/chat")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Streaming Q&A Server-Sent Events (SSE) guide grounded in supplied context."""
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message field cannot be empty.",
        )
    user_msg = request.message.strip()

    async def sse_event_stream():
        try:
            async for token in gemini_client.stream_chat(
                message=user_msg,
                history=request.history,
                map_context=request.map_context,
            ):
                payload = json.dumps({"text": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error streaming chat tokens: {e}", exc_info=True)
            # Never crash: stream fallback response to client
            async for token in provider_router.offline_provider.stream_chat(
                message=user_msg,
                history=request.history,
                map_context=request.map_context,
            ):
                payload = json.dumps({"text": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/briefing", response_model=MissionBriefing)
async def generate_mission_briefing(request: BriefingRequest) -> MissionBriefing:
    """Generate structured JSON mission briefing grounded in supplied data layers."""
    try:
        return await gemini_client.generate_briefing(
            map_context=request.map_context,
            candidate_route=request.candidate_route,
        )
    except Exception as e:
        logger.error(f"Endpoint error generating briefing: {e}", exc_info=True)
        res = await provider_router.offline_provider.generate_briefing(
            map_context=request.map_context,
            candidate_route=request.candidate_route,
        )
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/explain-target", response_model=ExplainTargetResponse)
async def explain_science_target(request: ExplainTargetRequest) -> ExplainTargetResponse:
    """Explain a specific science target using supplied context."""
    try:
        return await gemini_client.explain_target(
            target=request.target,
            target_id=request.target_id,
            map_context=request.map_context,
        )
    except Exception as e:
        logger.error(f"Endpoint error explaining target: {e}", exc_info=True)
        res = await provider_router.offline_provider.explain_target(
            target=request.target,
            target_id=request.target_id,
            map_context=request.map_context,
        )
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/terrain-summary", response_model=TerrainSummaryResponse)
async def summarize_terrain_and_layers(request: TerrainSummaryRequest) -> TerrainSummaryResponse:
    """Summarize regional terrain and all supplied multi-mission layers."""
    try:
        return await gemini_client.terrain_summary(map_context=request.map_context)
    except Exception as e:
        logger.error(f"Endpoint error generating terrain summary: {e}", exc_info=True)
        res = await provider_router.offline_provider.terrain_summary(map_context=request.map_context)
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/route-insights", response_model=RouteInsightsResponse)
async def explain_route_insights(request: RouteInsightsRequest) -> RouteInsightsResponse:
    """Explain route metrics, flagging steep or long segments and return-trip considerations."""
    try:
        return await gemini_client.route_insights(
            route=request.route,
            map_context=request.map_context,
        )
    except Exception as e:
        logger.error(f"Endpoint error generating route insights: {e}", exc_info=True)
        res = await provider_router.offline_provider.route_insights(
            route=request.route,
            map_context=request.map_context,
        )
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/report", response_model=ReportResponse)
async def generate_mission_report(request: ReportRequest) -> ReportResponse:
    """Generate report-ready text and markdown for the downloadable mission dossier."""
    try:
        return await gemini_client.generate_report(map_context=request.map_context)
    except Exception as e:
        logger.error(f"Endpoint error generating mission report: {e}", exc_info=True)
        res = await provider_router.offline_provider.generate_report(map_context=request.map_context)
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/route-advice", response_model=RouteAdviceResponse)
async def evaluate_candidate_routes(request: RouteAdviceRequest) -> RouteAdviceResponse:
    """Evaluate and rank 2-3 candidate traverse routes."""
    try:
        return await gemini_client.generate_route_advice(
            candidate_routes=request.candidate_routes,
            map_context=request.map_context,
        )
    except Exception as e:
        logger.error(f"Endpoint error evaluating routes: {e}", exc_info=True)
        res = await provider_router.offline_provider.generate_route_advice(
            candidate_routes=request.candidate_routes,
            map_context=request.map_context,
        )
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/health-assist", response_model=HealthAssistResponse)
async def astronaut_health_assist(request: HealthAssistRequest) -> HealthAssistResponse:
    """Astronaut Health and Safety Assistant with deterministic Red-Flag Triage.
    
    Critical red-flag symptoms (chest pain, acute dyspnea, suit pressure drop, acute radiation)
    are intercepted immediately and return deterministic emergency protocols without calling any model.
    """
    try:
        return await gemini_client.health_assist(request)
    except Exception as e:
        logger.error(f"Endpoint error in health-assist: {e}", exc_info=True)
        res = await provider_router.offline_provider.health_assist(request)
        res.response_metadata = ResponseMetadata(
            provider_used="offline",
            model_used="offline-templates",
            degraded=True,
            fallback_reason=f"Recovery from unexpected endpoint error: {e}",
            latency_ms=0,
        )
        return res


@router.post("/analyze-terrain-image")
async def analyze_terrain_image(request: TerrainAnalysisRequest) -> Dict[str, Any]:
    """Multimodal Stretch: Analyze a terrain screenshot or HiRISE image."""
    if not request.image_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_base64 field is required.",
        )
    try:
        return await gemini_client.analyze_terrain_image(
            image_base64=request.image_base64,
            mime_type=request.mime_type or "image/jpeg",
            map_context=request.map_context,
        )
    except Exception as e:
        logger.error(f"Error during terrain image analysis: {e}", exc_info=True)
        return {
            "error": str(e),
            "fallback": "Visual analysis unavailable. Proceed with orbital data layers.",
            "data_limitations": ["Visual sensor stream offline."],
            "response_metadata": {
                "provider_used": "offline",
                "model_used": "offline-templates",
                "degraded": True,
                "fallback_reason": str(e),
                "latency_ms": 0,
            },
        }


# ==============================================================================
# MISSION COMMANDER ORCHESTRATION ENDPOINTS
# ==============================================================================

from .audit import decision_audit
from .env_monitor import env_monitor
from .orchestrator import mission_commander
from .schemas import (
    AreaAnalysisRequest,
    HealthStateRequest,
    OrchestrateEvent,
    RouteOptimizeRequest,
)


@router.post("/orchestrate")
async def orchestrate(event: OrchestrateEvent) -> Dict[str, Any]:
    """Central orchestration entrypoint for all ROVERSE sections.
    
    Coordinates terrain, environment, EVA planner, health triage, and safety gate.
    """
    event_dict = event.dict()
    return mission_commander.handle(event_dict)


@router.post("/area-analysis")
async def area_analysis(request: AreaAnalysisRequest) -> Dict[str, Any]:
    """Analyze a selected point or polygon in Explorer/mapping section."""
    payload = request.dict(exclude_none=True)
    map_ctx = payload.pop("map_context", None)
    return mission_commander.handle({
        "event_type": "area_selected",
        "payload": payload,
        "map_context": map_ctx or {},
    })


@router.post("/route-optimize")
async def route_optimize(request: RouteOptimizeRequest) -> Dict[str, Any]:
    """Evaluate and rank candidate traverse routes using deterministic EVA planner engine."""
    payload = request.dict(exclude_none=True)
    map_ctx = payload.pop("map_context", None)
    return mission_commander.handle({
        "event_type": "route_changed",
        "payload": payload,
        "map_context": map_ctx or {},
    })


@router.get("/environment/snapshot")
async def environment_snapshot(lat: float = -4.68, lon: float = 137.38, site: str = "gale") -> Dict[str, Any]:
    """Retrieve instant comprehensive environmental, radiation, and comms snapshot."""
    return env_monitor.get_snapshot(lat=lat, lon=lon, site=site)


@router.get("/environment/stream")
async def environment_stream():
    """Server-Sent Events (SSE) continuous stream of environmental and telemetry changes."""
    return StreamingResponse(
        env_monitor.event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/health-state")
async def health_state(request: HealthStateRequest) -> Dict[str, Any]:
    """Update astronaut vitals and evaluate fatigue pacing or emergency abort status."""
    payload = request.dict(exclude_none=True)
    map_ctx = payload.pop("map_context", None)
    return mission_commander.handle({
        "event_type": "vitals_updated",
        "payload": payload,
        "map_context": map_ctx or {},
    })


@router.get("/decisions")
async def get_decision_audit_trail(limit: int = 50) -> Dict[str, Any]:
    """Retrieve decision audit log showing UUID, timestamp, inputs hash, tools called, and verdict."""
    records = decision_audit.list_decisions(limit=limit)
    return {
        "status": "success",
        "total": len(records),
        "decisions": records,
    }
