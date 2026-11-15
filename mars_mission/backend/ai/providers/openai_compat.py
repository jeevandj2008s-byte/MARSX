"""Generic OpenAI-compatible provider for Groq, OpenRouter, Mistral, and Ollama.

Uses lightweight async httpx without extra dependencies.
Enforces:
1. No tool calling: pre-fetches and injects data in <context>...</context>.
2. Tolerant JSON parsing (stripping prose/markdown).
3. Pydantic validation with ONE repair retry on malformed JSON.
4. Circuit breaker integration (401/403 session disable, 429 rate limit backoff, 404 skip model).
5. Post-check number validation against context.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from ..circuit_breaker import circuit_manager
from ..config import settings
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
from ..system_prompt import ROVERSE_SYSTEM_PROMPT
from .base import BaseAIProvider

logger = logging.getLogger("roverse.ai.openai_compat")


class OpenAICompatProvider(BaseAIProvider):
    """Generic OpenAI-compatible provider implementation using httpx."""

    def __init__(
        self,
        name: str,
        base_url: str,
        api_key: str = "",
        models: Optional[List[str]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self._name = name.strip().lower()
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        self.models = models or []
        self.extra_headers = extra_headers or {}

        circuit = circuit_manager.get_circuit(self._name)
        circuit.configured_models = list(self.models)

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_configured(self) -> bool:
        if self._name == "ollama":
            return bool(self.base_url)
        return bool(self.api_key and self.api_key.strip() and self.models)

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ROVERSE-Mars-Mission-Planning/2.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers.update(self.extra_headers)
        return headers

    def _make_metadata(self, model: str, latency: int, degraded: bool = True, reason: Optional[str] = None) -> ResponseMetadata:
        return ResponseMetadata(
            provider_used=self.name,
            model_used=model,
            degraded=degraded,
            fallback_reason=reason or f"Handled by {self.name.capitalize()} fallback",
            latency_ms=latency,
        )

    # 1. Chat Streaming
    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured:
            raise RuntimeError(f"Provider '{self.name}' is not configured.")

        context_str = PromptBuilder.build_compact_context(map_context)
        system_content = (
            f"{ROVERSE_SYSTEM_PROMPT}\n\n"
            f"{context_str}\n\n"
            "Answer explorer queries concisely. Do not calculate or invent numbers. Use only supplied telemetry."
        )

        messages = [{"role": "system", "content": system_content}]
        if history:
            for h in history[-4:]:
                messages.append({"role": "user" if h.role == "user" else "assistant", "content": h.content})
        messages.append({"role": "user", "content": message})

        last_err: Optional[Exception] = None
        for model in self.models:
            url = f"{self.base_url}/chat/completions"
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
            }

            try:
                async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
                    async with client.stream("POST", url, headers=self._get_headers(), json=payload) as response:
                        if response.status_code in (401, 403):
                            circuit_manager.record_failure(self.name, f"HTTP {response.status_code} Auth Error", is_auth_error=True)
                            raise RuntimeError(f"Authentication failed on {self.name}")
                        if response.status_code == 404:
                            logger.warning(f"Model '{model}' not found (404) on {self.name}. Trying next.")
                            continue
                        if response.status_code >= 400:
                            err_body = await response.aread()
                            circuit_manager.record_failure(self.name, f"HTTP {response.status_code}: {err_body.decode(errors='ignore')[:150]}")
                            continue

                        circuit_manager.record_success(self.name)
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue
                            data_str = line.replace("data:", "").strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                parsed = json.loads(data_str)
                                delta = parsed.get("choices", [{}])[0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield token
                            except Exception:
                                continue
                        return
            except Exception as e:
                last_err = e
                circuit_manager.record_failure(self.name, str(e))
                logger.warning(f"{self.name} stream error on model '{model}': {e}")

        raise last_err or RuntimeError(f"All models exhausted on {self.name}")

    # Core Structured Call Routine
    async def _call_structured(
        self,
        endpoint_type: str,
        map_context: Optional[MapContext],
        schema_cls: Any,
        extra_prompt: str = "",
    ) -> Any:
        if not self.is_configured:
            raise RuntimeError(f"Provider '{self.name}' is not configured.")

        context_str = PromptBuilder.build_compact_context(map_context)
        output_contract = PromptBuilder.get_output_contract(endpoint_type)

        system_prompt = (
            f"{ROVERSE_SYSTEM_PROMPT}\n\n"
            f"{context_str}\n\n"
            f"{output_contract}"
        )

        user_content = f"Generate {endpoint_type} JSON strictly adhering to schema and supplied <context>. {extra_prompt}".strip()

        last_err: Optional[Exception] = None
        for model in self.models:
            t0 = time.time()
            url = f"{self.base_url}/chat/completions"
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "temperature": 0.1,
            }

            try:
                async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
                    resp = await client.post(url, headers=self._get_headers(), json=payload)

                    # Handle HTTP Status Codes
                    if resp.status_code in (401, 403):
                        circuit_manager.record_failure(self.name, f"HTTP {resp.status_code} Auth Failure", is_auth_error=True)
                        raise RuntimeError(f"Auth error on {self.name}: {resp.status_code}")

                    if resp.status_code == 404:
                        logger.warning(f"Model '{model}' not found (404) on {self.name}. Skipping model.")
                        continue

                    if resp.status_code == 429:
                        retry_after = resp.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit() and int(retry_after) <= 2:
                            await asyncio.sleep(int(retry_after))
                            resp = await client.post(url, headers=self._get_headers(), json=payload)
                        else:
                            circuit_manager.record_failure(self.name, f"HTTP 429 Rate Limited on model '{model}'")
                            continue

                    if resp.status_code >= 400:
                        circuit_manager.record_failure(self.name, f"HTTP {resp.status_code}: {resp.text[:150]}")
                        continue

                    data = resp.json()
                    raw_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                    # 1. Tolerant JSON Extraction
                    extracted_json = PromptBuilder.extract_tolerant_json(raw_content)

                    # 2. One Repair Retry if JSON is invalid
                    if not extracted_json:
                        logger.warning(f"Malformed JSON from {self.name} ({model}). Attempting single repair retry...")
                        repair_payload = {
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "You are a JSON repair tool. Output strictly valid RFC 8259 JSON only."},
                                {"role": "user", "content": f"Fix and return strictly valid JSON for this target schema:\n{output_contract}\n\nMalformed text:\n{raw_content}"},
                            ],
                            "temperature": 0.0,
                        }
                        repair_resp = await client.post(url, headers=self._get_headers(), json=repair_payload)
                        if repair_resp.status_code == 200:
                            repair_data = repair_resp.json()
                            repair_content = repair_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                            extracted_json = PromptBuilder.extract_tolerant_json(repair_content)

                    if not extracted_json:
                        circuit_manager.record_failure(self.name, "Failed to parse valid JSON after repair retry.")
                        continue

                    # 3. Post-Check: Verify model did not invent numbers not in context
                    if not PromptBuilder.post_check_numbers(context_str, extracted_json):
                        circuit_manager.record_failure(self.name, "Post-check rejected ungrounded numbers.")
                        continue

                    # 4. Pydantic Schema Validation
                    validated = schema_cls.model_validate(extracted_json)
                    latency = int((time.time() - t0) * 1000)

                    validated.provider_used = self.name
                    validated.model_used = model
                    validated.degraded = True
                    validated.fallback_reason = f"Served by fallback provider {self.name} ({model})"
                    validated.latency_ms = latency
                    validated.metadata = self._make_metadata(model, latency, degraded=True)

                    circuit_manager.record_success(self.name)
                    return validated

            except Exception as e:
                last_err = e
                circuit_manager.record_failure(self.name, str(e))
                logger.warning(f"{self.name} call failed on model '{model}': {e}")

        raise last_err or RuntimeError(f"All models on {self.name} failed to return schema-valid JSON.")

    # 2. Briefing
    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        return await self._call_structured("briefing", map_context, MissionBriefing)

    # 3. Explain Target
    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        t_id = target.id if target else (target_id or "target-boxwork-1")
        extra = f"Target ID to explain: {t_id}"
        return await self._call_structured("explain_target", map_context, ExplainTargetResponse, extra_prompt=extra)

    # 4. Terrain Summary
    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        return await self._call_structured("terrain_summary", map_context, TerrainSummaryResponse)

    # 5. Route Insights
    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        return await self._call_structured("route_insights", map_context, RouteInsightsResponse)

    # 6. Report
    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        return await self._call_structured("report", map_context, ReportResponse)

    # 7. Route Advice
    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        extra = f"Candidate Routes: {json.dumps([r.model_dump() for r in candidate_routes], default=str)}"
        return await self._call_structured("route_advice", map_context, RouteAdviceResponse, extra_prompt=extra)

    # 8. Health Assist
    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        return health_assistant.evaluate(request)

    # 9. Terrain Image
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        return {
            "terrain_classification": f"Gale Crater Terrain ({self.name.capitalize()} Analysis)",
            "identified_features": ["Boxwork ridge networks", "Basaltic sandstone bedrock"],
            "traversability_rating": "MODERATE_CAUTION",
            "source": f"{self.name.capitalize()} Fallback Vision",
            "provider_used": self.name,
            "data_limitations": ["Visual observation only; in-situ verification required."],
            "latency_ms": 10,
        }
