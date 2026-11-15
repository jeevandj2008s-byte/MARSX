"""AI Client Facade for ROVERSE Mars Mission Planning.

Delegates all AI interactions to the multi-provider ProviderRouter.
Guarantees zero-crash execution with automated multi-tier fallback.
"""

from __future__ import annotations

import re
from typing import Any, AsyncGenerator, Dict, List, Optional

from .config import settings
from .router import provider_router
from .schemas import (
    ChatMessage,
    ExplainTargetResponse,
    HealthAssistRequest,
    HealthAssistResponse,
    MapContext,
    MissionBriefing,
    ReportResponse,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsResponse,
    ScienceTarget,
    SystemStatusResponse,
    TerrainSummaryResponse,
)


class GeminiMarsClient:
    """Facade delegating all operations to the resilient multi-provider router."""

    def __init__(self) -> None:
        self.router = provider_router

    @property
    def provider(self) -> Any:
        # For backwards compatibility with status checks
        return self.router.providers.get("gemini") or self.router.offline_provider

    @property
    def model_name(self) -> str:
        return settings.GEMINI_MODEL

    @property
    def api_key(self) -> str:
        return settings.GEMINI_API_KEY

    @property
    def demo_mode(self) -> bool:
        return settings.DEMO_MODE

    def sanitize_input(self, text: str) -> str:
        if not text:
            return ""
        clean = text[: settings.MAX_INPUT_LENGTH].strip()
        return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", clean)

    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        async for chunk in self.router.stream_chat(message, history, map_context):
            yield chunk

    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        return await self.router.generate_briefing(map_context, candidate_route)

    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        return await self.router.explain_target(target, target_id, map_context)

    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        return await self.router.terrain_summary(map_context)

    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        return await self.router.route_insights(route, map_context)

    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        return await self.router.generate_report(map_context)

    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        return await self.router.generate_route_advice(candidate_routes, map_context)

    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        return await self.router.health_assist(request)

    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        return await self.router.analyze_terrain_image(image_base64, mime_type, map_context)

    def get_system_status(self) -> SystemStatusResponse:
        return self.router.get_system_status()


gemini_client = GeminiMarsClient()
