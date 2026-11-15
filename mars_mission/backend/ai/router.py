"""Provider Router & Fallback Chain Orchestrator for ROVERSE.

Orchestrates multi-provider AI resilience:
1. Order defined by AI_PROVIDER_ORDER (gemini, groq, openrouter, mistral, ollama, offline).
2. Tries each configured provider in order.
3. Circuit breaker guards:
   - Skips open circuits (3 failures -> 60s cooldown).
   - Skips disabled circuits (401/403 auth failures).
4. Overall request budget (20s) prevents client timeouts.
5. In-memory caching for briefings and deterministic outputs.
6. Absolute fallback: OfflineProvider NEVER fails and requires zero network/keys.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from .circuit_breaker import circuit_manager
from .config import settings
from .providers.base import BaseAIProvider
from .providers.gemini_provider import GeminiProvider
from .providers.offline_provider import OfflineProvider
from .providers.openai_compat import OpenAICompatProvider
from .schemas import (
    ChatMessage,
    ExplainTargetResponse,
    HealthAssistRequest,
    HealthAssistResponse,
    MapContext,
    MissionBriefing,
    ProviderStatus,
    ReportResponse,
    ResponseMetadata,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsResponse,
    ScienceTarget,
    SystemStatusResponse,
    TerrainSummaryResponse,
)

logger = logging.getLogger("roverse.ai.router")


class ProviderRouter:
    """Manages the fallback chain across all configured AI providers."""

    def __init__(self) -> None:
        self.providers: Dict[str, BaseAIProvider] = {}
        self.offline_provider = OfflineProvider()
        self._cache: Dict[str, tuple[float, Any]] = {}
        self._init_providers()

    def _init_providers(self) -> None:
        """Instantiate all supported providers lazily and register with circuit breaker."""
        # 1. Gemini
        try:
            self.providers["gemini"] = GeminiProvider()
        except Exception as e:
            logger.warning(f"Could not initialize GeminiProvider: {e}")

        # 2. Groq
        try:
            self.providers["groq"] = OpenAICompatProvider(
                name="groq",
                base_url=settings.GROQ_BASE_URL,
                api_key=settings.GROQ_API_KEY,
                models=settings.GROQ_MODELS,
            )
        except Exception as e:
            logger.warning(f"Could not initialize Groq provider: {e}")

        # 3. OpenRouter
        try:
            self.providers["openrouter"] = OpenAICompatProvider(
                name="openrouter",
                base_url=settings.OPENROUTER_BASE_URL,
                api_key=settings.OPENROUTER_API_KEY,
                models=settings.OPENROUTER_MODELS,
                extra_headers={
                    "HTTP-Referer": settings.APP_HTTP_REFERER,
                    "X-Title": settings.APP_TITLE,
                },
            )
        except Exception as e:
            logger.warning(f"Could not initialize OpenRouter provider: {e}")

        # 4. Mistral (Optional)
        try:
            mistral_models = [settings.MISTRAL_MODEL] if settings.MISTRAL_MODEL else []
            self.providers["mistral"] = OpenAICompatProvider(
                name="mistral",
                base_url=settings.MISTRAL_BASE_URL,
                api_key=settings.MISTRAL_API_KEY,
                models=mistral_models,
            )
        except Exception as e:
            logger.warning(f"Could not initialize Mistral provider: {e}")

        # 5. Ollama (Optional Local)
        try:
            ollama_url = settings.OLLAMA_BASE_URL
            if not ollama_url.endswith("/v1"):
                ollama_url = f"{ollama_url.rstrip('/')}/v1"
            ollama_models = [settings.OLLAMA_MODEL] if settings.OLLAMA_MODEL else []
            self.providers["ollama"] = OpenAICompatProvider(
                name="ollama",
                base_url=ollama_url,
                api_key="ollama",
                models=ollama_models,
            )
        except Exception as e:
            logger.warning(f"Could not initialize Ollama provider: {e}")

        # 6. Offline
        self.providers["offline"] = self.offline_provider

        logger.info(
            f"ProviderRouter initialized. Order: {self.provider_order}. "
            f"Configured providers: {[name for name, p in self.providers.items() if p.is_configured]}"
        )

    @property
    def provider_order(self) -> List[str]:
        """Provider order ensuring offline is always available at the end."""
        order = list(settings.AI_PROVIDER_ORDER)
        if "offline" not in order:
            order.append("offline")
        return order

    def _cache_key(self, prefix: str, data: Any) -> str:
        dumped = json.dumps(data, sort_keys=True, default=str)
        return f"{prefix}:{hashlib.sha256(dumped.encode('utf-8')).hexdigest()}"

    def _get_cached(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < settings.CACHE_TTL_SECONDS:
                return val
            del self._cache[key]
        return None

    def _set_cached(self, key: str, val: Any) -> None:
        self._cache[key] = (time.time(), val)

    async def _execute_with_fallback(
        self,
        method_name: str,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Execute a provider method traversing the provider chain with strict timeouts and error isolation."""
        deadline = time.time() + settings.OVERALL_REQUEST_BUDGET_SECONDS
        last_error = None
        chain = self.provider_order

        # Presentation DEMO_MODE: Jump directly to offline provider if forced
        if settings.DEMO_MODE:
            logger.info("DEMO_MODE active: servicing request via deterministic OfflineProvider.")
            offline_method = getattr(self.offline_provider, method_name)
            return await offline_method(*args, **kwargs)

        for provider_name in chain:
            if provider_name == "offline":
                break

            provider = self.providers.get(provider_name)
            if not provider:
                continue

            if not provider.is_configured:
                logger.debug(f"Skipping '{provider_name}': not configured.")
                continue

            if not circuit_manager.is_available(provider_name):
                logger.warning(f"Skipping '{provider_name}': circuit open or disabled.")
                continue

            remaining_budget = deadline - time.time()
            if remaining_budget <= 1.0:
                logger.warning(f"Request budget depleted ({remaining_budget:.2f}s remaining). Skipping to offline.")
                break

            timeout = min(settings.REQUEST_TIMEOUT_SECONDS, remaining_budget)
            target_method = getattr(provider, method_name, None)
            if not target_method:
                continue

            logger.info(f"Invoking '{provider_name}' for {method_name} (timeout={timeout:.1f}s)...")
            start_time = time.time()
            try:
                result = await asyncio.wait_for(target_method(*args, **kwargs), timeout=timeout)
                latency_ms = int((time.time() - start_time) * 1000)
                circuit_manager.record_success(provider_name)

                # Attach / update ResponseMetadata
                is_primary = (provider_name == chain[0])
                if hasattr(result, "response_metadata"):
                    meta = getattr(result, "response_metadata")
                    if not meta:
                        result.response_metadata = ResponseMetadata(
                            provider_used=provider_name,
                            model_used=getattr(provider, "model_name", provider_name),
                            degraded=not is_primary,
                            fallback_reason=None if is_primary else f"Served by fallback provider '{provider_name}'",
                            latency_ms=latency_ms,
                        )
                return result

            except asyncio.TimeoutError:
                err_msg = f"Timeout after {timeout:.1f}s"
                logger.warning(f"Provider '{provider_name}' timed out on {method_name}.")
                circuit_manager.record_failure(provider_name, err_msg)
                last_error = err_msg

            except Exception as e:
                err_msg = str(e)
                logger.warning(f"Provider '{provider_name}' failed on {method_name}: {err_msg}")
                circuit_manager.record_failure(provider_name, err_msg)
                last_error = err_msg

        # Ultimate fallback: OfflineProvider
        logger.info(f"Falling back to OfflineProvider for {method_name}. Reason: {last_error or 'Chain exhausted'}")
        offline_method = getattr(self.offline_provider, method_name)
        result = await offline_method(*args, **kwargs)
        if hasattr(result, "response_metadata"):
            result.response_metadata = ResponseMetadata(
                provider_used="offline",
                model_used="offline-templates",
                degraded=True,
                fallback_reason=f"All remote providers failed or timed out ({last_error or 'unavailable'}). Operating in offline guide mode.",
                latency_ms=0,
            )
        return result

    # --------------------------------------------------------------------------
    # API Methods
    # --------------------------------------------------------------------------

    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream chat with seamless multi-provider fallback."""
        if settings.DEMO_MODE:
            async for chunk in self.offline_provider.stream_chat(message, history, map_context):
                yield chunk
            return

        stream_succeeded = False
        last_error = None

        for provider_name in self.provider_order:
            if provider_name == "offline":
                break

            provider = self.providers.get(provider_name)
            if not provider or not provider.is_configured:
                continue

            if not circuit_manager.is_available(provider_name):
                continue

            try:
                generator = provider.stream_chat(message, history, map_context)
                first_chunk = True
                async for chunk in generator:
                    if first_chunk:
                        stream_succeeded = True
                        first_chunk = False
                        circuit_manager.record_success(provider_name)
                    yield chunk

                if stream_succeeded:
                    return

            except Exception as e:
                err_msg = str(e)
                logger.warning(f"Chat streaming error on '{provider_name}': {err_msg}")
                circuit_manager.record_failure(provider_name, err_msg)
                last_error = err_msg
                if stream_succeeded:
                    yield f"\n\n[ROVERSE Communication Warning: Provider connection interrupted. Switched to offline backup.]"
                    return

        # If no stream started, fall back to offline
        logger.info("Falling back to OfflineProvider for chat streaming.")
        async for chunk in self.offline_provider.stream_chat(message, history, map_context):
            yield chunk

    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        context_dict = map_context.model_dump() if map_context else {}
        if candidate_route:
            context_dict["route"] = candidate_route.model_dump()

        cache_key = self._cache_key("briefing", context_dict)
        cached = self._get_cached(cache_key)
        if cached:
            return MissionBriefing.model_validate(cached)

        res = await self._execute_with_fallback("generate_briefing", map_context, candidate_route)
        self._set_cached(cache_key, res.model_dump())
        return res

    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        return await self._execute_with_fallback("explain_target", target, target_id, map_context)

    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        context_dict = map_context.model_dump() if map_context else {}
        cache_key = self._cache_key("terrain_summary", context_dict)
        cached = self._get_cached(cache_key)
        if cached:
            return TerrainSummaryResponse.model_validate(cached)

        res = await self._execute_with_fallback("terrain_summary", map_context)
        self._set_cached(cache_key, res.model_dump())
        return res

    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        return await self._execute_with_fallback("route_insights", route, map_context)

    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        return await self._execute_with_fallback("generate_report", map_context)

    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        return await self._execute_with_fallback("generate_route_advice", candidate_routes, map_context)

    async def health_assist(
        self,
        request: HealthAssistRequest,
    ) -> HealthAssistResponse:
        """Route astronaut health assist queries.
        
        Red-flag emergencies are intercepted deterministically by the health assistant
        inside each provider or right here before any network call.
        """
        return await self._execute_with_fallback("health_assist", request)

    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        return await self._execute_with_fallback("analyze_terrain_image", image_base64, mime_type, map_context)

    def get_system_status(self) -> SystemStatusResponse:
        """Produce real-time system status report without exposing secrets."""
        provider_statuses: Dict[str, ProviderStatus] = {}
        circuit_breakers_active: List[str] = []

        for name in ["gemini", "groq", "openrouter", "mistral", "ollama", "offline"]:
            provider = self.providers.get(name)
            circuit = circuit_manager.get_circuit(name)

            configured = provider.is_configured if provider else False
            healthy = circuit.is_available and configured if name != "offline" else True

            c_state = circuit.circuit_state
            if c_state in ("open", "disabled"):
                circuit_breakers_active.append(f"{name}:{c_state}")

            provider_statuses[name] = ProviderStatus(
                name=name,
                configured=configured,
                healthy=healthy,
                circuit_state=c_state,
                configured_models=circuit.configured_models,
                verified_models=circuit.verified_models,
                last_error=circuit.last_error,
            )

        return SystemStatusResponse(
            status="operational",
            project="ROVERSE - Mars Surface Exploration Planning System",
            active_provider_order=self.provider_order,
            providers=provider_statuses,
            demo_mode=settings.DEMO_MODE,
            circuit_breakers_active=circuit_breakers_active,
            timestamp=time.time(),
        )

    async def validate_configured_models(self) -> None:
        """Non-blocking validation of models against providers' /models endpoints.
        
        Runs at startup or on-demand. Never blocks server startup or raises exceptions.
        """
        import httpx
        logger.info("Starting background validation of configured models...")

        # 1. Offline is always verified
        circuit_manager.get_circuit("offline").verified_models = ["offline-templates"]

        # 2. Gemini
        gemini_circuit = circuit_manager.get_circuit("gemini")
        if self.providers.get("gemini") and self.providers["gemini"].is_configured:
            gemini_circuit.verified_models = [settings.GEMINI_MODEL]
            if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL != settings.GEMINI_MODEL:
                gemini_circuit.verified_models.append(settings.GEMINI_FALLBACK_MODEL)

        # 3. OpenAI-compatible providers: groq, openrouter, mistral, ollama
        for name in ["groq", "openrouter", "mistral", "ollama"]:
            provider = self.providers.get(name)
            circuit = circuit_manager.get_circuit(name)
            if not provider or not provider.is_configured:
                continue

            base_url = getattr(provider, "base_url", "")
            headers = getattr(provider, "_get_headers", lambda: {})()
            configured_models = circuit.configured_models

            try:
                models_endpoint = f"{base_url}/models"
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(models_endpoint, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        remote_models = {m.get("id") for m in data.get("data", []) if isinstance(m, dict)}
                        if not remote_models and "models" in data:
                            remote_models = {m.get("name") or m.get("model") for m in data.get("models", [])}

                        verified = [m for m in configured_models if m in remote_models]
                        if not verified and remote_models:
                            for cm in configured_models:
                                cm_base = cm.split(":")[0]
                                if any(cm in rm or cm_base in rm for rm in remote_models):
                                    verified.append(cm)
                        circuit.verified_models = verified or configured_models
                        logger.info(f"Validated models for '{name}': {circuit.verified_models}")
                    elif resp.status_code in (401, 403):
                        logger.warning(f"Validation for '{name}' failed with {resp.status_code}. Key invalid.")
                        circuit_manager.record_failure(name, f"HTTP {resp.status_code} during model validation")
                    else:
                        circuit.verified_models = configured_models
            except Exception as e:
                logger.debug(f"Background model check for '{name}' skipped: {e}")
                circuit.verified_models = configured_models


# Global singleton router
provider_router = ProviderRouter()
