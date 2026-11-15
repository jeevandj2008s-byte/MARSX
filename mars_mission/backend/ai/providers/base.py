"""Base provider interface for ROVERSE multi-provider chain."""

from __future__ import annotations

import abc
from typing import Any, AsyncGenerator, Dict, List, Optional

from ..schemas import (
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
    TerrainSummaryResponse,
)


class BaseAIProvider(abc.ABC):
    """Abstract base class for all AI providers in the fallback chain."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        pass

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """Whether the provider has necessary keys or URLs configured."""
        pass

    @abc.abstractmethod
    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        pass

    @abc.abstractmethod
    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        pass

    @abc.abstractmethod
    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        pass

    @abc.abstractmethod
    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        pass

    @abc.abstractmethod
    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        pass

    @abc.abstractmethod
    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        pass

    @abc.abstractmethod
    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        pass

    @abc.abstractmethod
    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        pass

    @abc.abstractmethod
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        pass
