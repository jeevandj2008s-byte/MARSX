"""ROVERSE Mars Surface Exploration Planning AI Package.

Exports:
- ai_router: FastAPI APIRouter under /api/ai
- gemini_client: Facade client
- provider_router: Multi-provider resilient fallback router
- All Pydantic models for context contracts and structured responses
"""

from .circuit_breaker import circuit_manager
from .config import settings
from .gemini_client import GeminiMarsClient, gemini_client
from .router import ProviderRouter, provider_router
from .routes import router as ai_router
from .schemas import (
    BriefingRequest,
    ChatMessage,
    ChatRequest,
    ExplainTargetRequest,
    ExplainTargetResponse,
    HazardItem,
    HealthAssistRequest,
    HealthAssistResponse,
    HealthStatus,
    LayerData,
    LocationContext,
    MapContext,
    MissionBriefing,
    MissionContext,
    MissionLayers,
    ProviderStatus,
    ReportRequest,
    ReportResponse,
    ResponseMetadata,
    RouteAdviceRequest,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsRequest,
    RouteInsightsResponse,
    RouteSegment,
    RouteTotals,
    ScienceTarget,
    SegmentInsight,
    SystemStatusResponse,
    TerrainAnalysisRequest,
    TerrainSummaryRequest,
    TerrainSummaryResponse,
    Waypoint,
)

__all__ = [
    "ai_router",
    "gemini_client",
    "GeminiMarsClient",
    "provider_router",
    "ProviderRouter",
    "circuit_manager",
    "settings",
    "MapContext",
    "MissionContext",
    "LocationContext",
    "Waypoint",
    "RouteSegment",
    "RouteTotals",
    "RouteContext",
    "ScienceTarget",
    "LayerData",
    "MissionLayers",
    "MissionBriefing",
    "ExplainTargetResponse",
    "TerrainSummaryResponse",
    "RouteInsightsResponse",
    "ReportResponse",
    "RouteAdviceResponse",
    "HealthAssistRequest",
    "HealthAssistResponse",
    "SystemStatusResponse",
    "ProviderStatus",
    "ResponseMetadata",
    "HealthStatus",
    "ChatRequest",
    "BriefingRequest",
    "ExplainTargetRequest",
    "TerrainSummaryRequest",
    "RouteInsightsRequest",
    "ReportRequest",
]
