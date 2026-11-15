"""Google Gemini provider via official google-genai SDK for ROVERSE.

Supports:
- Model fallback (GEMINI_MODEL -> GEMINI_FALLBACK_MODEL).
- Native function calling with Martian data adapter tools.
- Strict Pydantic response_schema structured outputs.
- Streaming SSE chat.
- Circuit breaker error reporting.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from google import genai
from google.genai import types
from google.genai.errors import APIError

from ..circuit_breaker import circuit_manager
from ..config import settings
from ..data_adapter import GEMINI_MARS_TOOLS
from ..health_assist import health_assistant
from ..prompt_builder import PromptBuilder
from ..schemas import (
    ChatMessage,
    ExplainTargetResponse,
    HealthAssistRequest,
    HealthAssistResponse,
    MapContext,
    MissionBriefing,
    ReportResponse,
    ResponseMetadata,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsResponse,
    ScienceTarget,
    TerrainSummaryResponse,
)
from ..system_prompt import (
    ROVERSE_SYSTEM_PROMPT,
    format_roverse_context_for_prompt,
)
from .base import BaseAIProvider

logger = logging.getLogger("roverse.ai.gemini_provider")


class GeminiProvider(BaseAIProvider):
    """Primary provider using Google GenAI SDK."""

    def __init__(self) -> None:
        self.primary_model = settings.GEMINI_MODEL
        self.fallback_model = settings.GEMINI_FALLBACK_MODEL
        self.api_key = settings.GEMINI_API_KEY
        self._client: Optional[genai.Client] = None
        self._init_client()

        circuit = circuit_manager.get_circuit(self.name)
        circuit.configured_models = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            circuit.configured_models.append(self.fallback_model)

    def _init_client(self) -> None:
        if self.is_configured:
            try:
                self._client = genai.Client(api_key=self.api_key)
                logger.info(f"GeminiProvider client initialized with primary model '{self.primary_model}'.")
            except Exception as e:
                logger.warning(f"Failed to initialize live GenAI client: {e}")
                self._client = None

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _make_metadata(self, model: str, latency: int, degraded: bool = False, reason: Optional[str] = None) -> ResponseMetadata:
        return ResponseMetadata(
            provider_used="gemini",
            model_used=model,
            degraded=degraded,
            fallback_reason=reason,
            latency_ms=latency,
        )

    # 1. Chat
    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        if not self._client:
            raise RuntimeError("Gemini client not initialized")

        context_dict = map_context.model_dump() if map_context else None
        context_str = format_roverse_context_for_prompt(context_dict)

        user_content = (
            f"{context_str}\n\n"
            f"=== EXPLORER TRANSMISSION ===\n"
            f"{message}\n"
            f"=== END TRANSMISSION ===\n"
            f"Reminder: You never invent or calculate numbers. Ground all statements in supplied layers."
        )

        contents: List[Any] = []
        if history:
            for h in history[-6:]:
                contents.append(
                    types.Content(
                        role="user" if h.role == "user" else "model",
                        parts=[types.Part.from_text(text=h.content)],
                    )
                )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_content)])
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            tools=GEMINI_MARS_TOOLS,
        )

        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        last_err: Optional[Exception] = None
        for m in models_to_try:
            try:
                response_stream = self._client.models.generate_content_stream(
                    model=m,
                    contents=contents,
                    config=config,
                )
                circuit_manager.record_success(self.name)
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
                return
            except APIError as api_err:
                last_err = api_err
                is_auth = api_err.code in (401, 403)
                circuit_manager.record_failure(self.name, str(api_err), is_auth_error=is_auth)
                logger.warning(f"Gemini API error on model '{m}': {api_err}")
                if is_auth:
                    break
            except Exception as e:
                last_err = e
                circuit_manager.record_failure(self.name, str(e))
                logger.warning(f"Gemini general error on model '{m}': {e}")

        raise last_err or RuntimeError("Gemini chat streaming failed")

    # Helper for structured calls
    async def _call_structured(self, prompt: str, schema_cls: Any) -> Any:
        if not self._client:
            raise RuntimeError("Gemini client not initialized")

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=schema_cls,
            tools=GEMINI_MARS_TOOLS,
        )

        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        last_err: Optional[Exception] = None
        for i, m in enumerate(models_to_try):
            t0 = time.time()
            try:
                resp = self._client.models.generate_content(
                    model=m, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    result = schema_cls.model_validate(parsed)
                    latency = int((time.time() - t0) * 1000)
                    degraded = i > 0
                    reason = f"Used fallback model '{m}'" if degraded else None
                    result.provider_used = "gemini"
                    result.model_used = m
                    result.degraded = degraded
                    result.fallback_reason = reason
                    result.latency_ms = latency
                    result.metadata = self._make_metadata(m, latency, degraded, reason)
                    circuit_manager.record_success(self.name)
                    return result
            except APIError as api_err:
                last_err = api_err
                is_auth = api_err.code in (401, 403)
                circuit_manager.record_failure(self.name, str(api_err), is_auth_error=is_auth)
                logger.warning(f"Gemini structured error on model '{m}': {api_err}")
                if is_auth:
                    break
            except Exception as e:
                last_err = e
                circuit_manager.record_failure(self.name, str(e))
                logger.warning(f"Gemini structured general error on model '{m}': {e}")

        raise last_err or RuntimeError("Gemini structured call failed")

    # 2. Briefing
    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        context_dict = map_context.model_dump() if map_context else {}
        if candidate_route:
            context_dict["route"] = candidate_route.model_dump()
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Generate a structured Mission Briefing for ROVERSE in Gale Crater / Mount Sharp.\n"
            f"Rule: Never calculate or invent numbers. Use distance, duration, and slopes from supplied data.\n"
            f"Cite source layers for all claims. Flag missing layers as 'data not available'.\n"
            f"Always include data_limitations (noting thermal is not a live forecast, historical RAD is not future exposure)."
        )
        return await self._call_structured(prompt, MissionBriefing)

    # 3. Explain Target
    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        context_dict = map_context.model_dump() if map_context else {}
        target_dict = target.model_dump() if target else {"target_id": target_id or "target-boxwork-1"}
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"=== TARGET TO EXPLAIN ===\n"
            f"{json.dumps(target_dict, indent=2)}\n\n"
            f"Explain this science target for ROVERSE. Detail its geological significance, "
            f"scientific hypothesis, and sampling recommendations grounded in the cited layers (CRISM, HiRISE). "
            f"Include data_limitations. Do NOT invent numbers."
        )
        return await self._call_structured(prompt, ExplainTargetResponse)

    # 4. Terrain Summary
    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        context_dict = map_context.model_dump() if map_context else {}
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Summarize the Gale Crater / Mount Sharp terrain and all supplied multi-mission layers for ROVERSE.\n"
            f"For each layer (optical, elevation, slope, thermal, mineralogy, radiation), summarize the observation.\n"
            f"If a layer is unavailable, explicitly report 'data not available'. Do NOT invent numbers.\n"
            f"Include data_limitations (mentioning that thermal is not a live forecast and historical RAD is not future exposure)."
        )
        return await self._call_structured(prompt, TerrainSummaryResponse)

    # 5. Route Insights
    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        context_dict = map_context.model_dump() if map_context else {}
        if route:
            context_dict["route"] = route.model_dump()
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Analyze the supplied ROVERSE traverse route segments and totals.\n"
            f"Rule: Never calculate or invent numbers. Distance, duration, slope, and elevation change must come strictly from supplied data.\n"
            f"Flag steep segments, long segments, return-trip considerations (fatigue, turn-around), and planning insights.\n"
            f"Include data_limitations."
        )
        return await self._call_structured(prompt, RouteInsightsResponse)

    # 6. Report
    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        context_dict = map_context.model_dump() if map_context else {}
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Synthesize a report-ready exploration report for the ROVERSE downloadable mission dossier.\n"
            f"Grounded strictly in supplied Gale Crater data (HiRISE, MOLA, THEMIS, CRISM, RAD).\n"
            f"Provide executive summary, geological context, route assessment, hazards, and full markdown report.\n"
            f"Include data_limitations."
        )
        return await self._call_structured(prompt, ReportResponse)

    # 7. Route Advice
    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        context_dict = map_context.model_dump() if map_context else {}
        routes_dict = [r.model_dump() for r in candidate_routes]
        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Candidate Routes:\n{json.dumps(routes_dict, indent=2)}\n\n"
            f"Evaluate and rank candidate routes based strictly on supplied segment slopes, distance, and duration.\n"
            f"Return ranked comparison with data_limitations."
        )
        return await self._call_structured(prompt, RouteAdviceResponse)

    # 8. Health Assist
    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        # Deterministic check runs first
        return health_assistant.evaluate(request)

    # 9. Terrain Image
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        if not self._client:
            raise RuntimeError("Gemini client not initialized")
        import base64
        image_bytes = base64.b64decode(image_base64)
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        context_str = format_roverse_context_for_prompt(
            map_context.model_dump() if map_context else None
        )
        prompt = (
            f"{context_str}\n\n"
            f"Analyze this terrain image of Gale Crater / Mount Sharp.\n"
            f"Identify boxwork features, slopes, and surface traversability without inventing measurements."
        )
        resp = self._client.models.generate_content(
            model=self.primary_model,
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(system_instruction=ROVERSE_SYSTEM_PROMPT),
        )
        circuit_manager.record_success(self.name)
        return {
            "analysis_text": resp.text or "Analysis completed.",
            "model": self.primary_model,
            "provider_used": "gemini",
            "data_limitations": ["Visual inspection only; ground truth required."],
        }
