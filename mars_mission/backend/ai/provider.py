"""AI Provider Abstraction for ROVERSE Mars Mission Planning.

Supports:
1. 'gemini' (Default): Google Gemini via the official google-genai SDK.
2. 'local': Optional local endpoint (e.g. Ollama, Gemma 4, or OpenAI-compatible endpoint).

Gemini remains fully functional even if local is not configured or running.
Both providers cleanly fall back to high-fidelity demo data when offline or in DEMO_MODE.
"""

from __future__ import annotations

import abc
import asyncio
import base64
import hashlib
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
from google import genai
from google.genai import types
from google.genai.errors import APIError

from .config import settings
from .data_adapter import GEMINI_MARS_TOOLS
from .demo_data import (
    DEMO_CHAT_RESPONSES,
    DEMO_EXPLAIN_TARGET,
    DEMO_GALE_CRATER_BRIEFING,
    DEMO_REPORT,
    DEMO_ROUTE_ADVICE,
    DEMO_ROUTE_INSIGHTS,
    DEMO_TERRAIN_SUMMARY,
)
from .schemas import (
    BriefingRequest,
    ChatMessage,
    ExplainTargetResponse,
    MapContext,
    MissionBriefing,
    ReportResponse,
    RouteAdviceResponse,
    RouteContext,
    RouteInsightsResponse,
    ScienceTarget,
    TerrainSummaryResponse,
)
from .system_prompt import (
    ROVERSE_SYSTEM_PROMPT,
    format_roverse_context_for_prompt,
)

logger = logging.getLogger("roverse.ai.provider")


class BaseAIProvider(abc.ABC):
    """Abstract base class for ROVERSE AI providers."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Provider name ('gemini' or 'local')."""
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
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        pass


class GeminiProvider(BaseAIProvider):
    """Official Google GenAI SDK Provider (Gemini 3.6 Flash / Gemini 2.5 Flash)."""

    def __init__(self) -> None:
        self.model_name = settings.GEMINI_MODEL
        self.api_key = settings.GEMINI_API_KEY
        self.demo_mode = settings.DEMO_MODE or not bool(self.api_key)
        self._cache: Dict[str, tuple[float, Any]] = {}
        self._client: Optional[genai.Client] = None

        if not self.demo_mode:
            try:
                self._client = genai.Client(api_key=self.api_key)
                logger.info(f"GeminiProvider initialized with model '{self.model_name}'.")
            except Exception as e:
                logger.warning(f"Failed to initialize live GenAI client: {e}. Defaulting to DEMO_MODE.")
                self.demo_mode = True
        else:
            logger.info("GeminiProvider operating in DEMO_MODE.")

    @property
    def name(self) -> str:
        return "gemini"

    # --- Cache and Sanitization ---
    def _sanitize(self, text: str) -> str:
        if not text:
            return ""
        clean = text[: settings.MAX_INPUT_LENGTH].strip()
        return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", clean)

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

    # 1. Chat
    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        sanitized_msg = self._sanitize(message)

        if self.demo_mode or not self._client:
            lower = sanitized_msg.lower()
            if "hazard" in lower or "slope" in lower or "danger" in lower:
                resp = DEMO_CHAT_RESPONSES["hazards"]
            elif "budget" in lower or "oxygen" in lower or "time" in lower or "duration" in lower:
                resp = DEMO_CHAT_RESPONSES["budget"]
            else:
                resp = DEMO_CHAT_RESPONSES["default"]

            for i, word in enumerate(resp.split(" ")):
                yield word + (" " if i < len(resp.split(" ")) - 1 else "")
                await asyncio.sleep(0.02)
            return

        context_dict = map_context.model_dump() if map_context else None
        context_str = format_roverse_context_for_prompt(context_dict)

        user_content = (
            f"{context_str}\n\n"
            f"=== EXPLORER TRANSMISSION ===\n"
            f"{sanitized_msg}\n"
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

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                response_stream = self._client.models.generate_content_stream(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                logger.warning(f"Gemini chat error (attempt {attempt}): {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)
                else:
                    yield f"\n[ROVERSE Telemetry Notice: Switched to offline backup]. {DEMO_CHAT_RESPONSES['default']}"

    # 2. Briefing
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

        if self.demo_mode or not self._client:
            b = MissionBriefing.model_validate(DEMO_GALE_CRATER_BRIEFING)
            self._set_cached(cache_key, b.model_dump())
            return b

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Generate a structured Mission Briefing for ROVERSE in Gale Crater / Mount Sharp.\n"
            f"Rule: Never calculate or invent numbers. Use distance, duration, and slopes from supplied data.\n"
            f"Cite source layers for all claims. Flag missing layers as 'data not available'.\n"
            f"Always include data_limitations (noting thermal is not a live forecast, historical RAD is not future exposure)."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=MissionBriefing,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    briefing = MissionBriefing.model_validate(parsed)
                    self._set_cached(cache_key, briefing.model_dump())
                    return briefing
            except Exception as e:
                logger.warning(f"Briefing generation error ({attempt}/{settings.MAX_RETRIES}): {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.2 * attempt)

        return MissionBriefing.model_validate(DEMO_GALE_CRATER_BRIEFING)

    # 3. Explain Target
    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        context_dict = map_context.model_dump() if map_context else {}
        resolved_target = target

        if not resolved_target and target_id and map_context and map_context.science_targets:
            for st in map_context.science_targets:
                if st.id == target_id:
                    resolved_target = st
                    break

        target_dict = resolved_target.model_dump() if resolved_target else {"target_id": target_id or "target-boxwork-1"}
        cache_key = self._cache_key("explain_target", {"target": target_dict, "context": context_dict})
        cached = self._get_cached(cache_key)
        if cached:
            return ExplainTargetResponse.model_validate(cached)

        if self.demo_mode or not self._client:
            res = ExplainTargetResponse.model_validate(DEMO_EXPLAIN_TARGET)
            self._set_cached(cache_key, res.model_dump())
            return res

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"=== TARGET TO EXPLAIN ===\n"
            f"{json.dumps(target_dict, indent=2)}\n\n"
            f"Explain this science target for ROVERSE. Detail its geological significance, "
            f"scientific hypothesis, and sampling recommendations grounded in the cited layers (CRISM, HiRISE). "
            f"Include data_limitations. Do NOT invent numbers."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ExplainTargetResponse,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    res = ExplainTargetResponse.model_validate(parsed)
                    self._set_cached(cache_key, res.model_dump())
                    return res
            except Exception as e:
                logger.warning(f"Explain target error: {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)

        return ExplainTargetResponse.model_validate(DEMO_EXPLAIN_TARGET)

    # 4. Terrain Summary
    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        context_dict = map_context.model_dump() if map_context else {}
        cache_key = self._cache_key("terrain_summary", context_dict)
        cached = self._get_cached(cache_key)
        if cached:
            return TerrainSummaryResponse.model_validate(cached)

        if self.demo_mode or not self._client:
            res = TerrainSummaryResponse.model_validate(DEMO_TERRAIN_SUMMARY)
            self._set_cached(cache_key, res.model_dump())
            return res

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Summarize the Gale Crater / Mount Sharp terrain and all supplied multi-mission layers for ROVERSE.\n"
            f"For each layer (optical, elevation, slope, thermal, mineralogy, radiation), summarize the observation.\n"
            f"If a layer is unavailable, explicitly report 'data not available'. Do NOT invent numbers.\n"
            f"Include data_limitations (mentioning that thermal is not a live forecast and historical RAD is not future exposure)."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=TerrainSummaryResponse,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    res = TerrainSummaryResponse.model_validate(parsed)
                    self._set_cached(cache_key, res.model_dump())
                    return res
            except Exception as e:
                logger.warning(f"Terrain summary error: {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)

        return TerrainSummaryResponse.model_validate(DEMO_TERRAIN_SUMMARY)

    # 5. Route Insights
    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        context_dict = map_context.model_dump() if map_context else {}
        if route:
            context_dict["route"] = route.model_dump()

        cache_key = self._cache_key("route_insights", context_dict)
        cached = self._get_cached(cache_key)
        if cached:
            return RouteInsightsResponse.model_validate(cached)

        if self.demo_mode or not self._client:
            res = RouteInsightsResponse.model_validate(DEMO_ROUTE_INSIGHTS)
            self._set_cached(cache_key, res.model_dump())
            return res

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Analyze the supplied ROVERSE traverse route segments and totals.\n"
            f"Rule: Never calculate or invent numbers. Distance, duration, slope, and elevation change must come strictly from supplied data.\n"
            f"Flag steep segments, long segments, return-trip considerations (fatigue, turn-around), and planning insights.\n"
            f"Include data_limitations."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=RouteInsightsResponse,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    res = RouteInsightsResponse.model_validate(parsed)
                    self._set_cached(cache_key, res.model_dump())
                    return res
            except Exception as e:
                logger.warning(f"Route insights error: {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)

        return RouteInsightsResponse.model_validate(DEMO_ROUTE_INSIGHTS)

    # 6. Report
    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        context_dict = map_context.model_dump() if map_context else {}
        cache_key = self._cache_key("report", context_dict)
        cached = self._get_cached(cache_key)
        if cached:
            return ReportResponse.model_validate(cached)

        if self.demo_mode or not self._client:
            res = ReportResponse.model_validate(DEMO_REPORT)
            self._set_cached(cache_key, res.model_dump())
            return res

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Synthesize a report-ready exploration report for the ROVERSE downloadable mission dossier.\n"
            f"Grounded strictly in supplied Gale Crater data (HiRISE, MOLA, THEMIS, CRISM, RAD).\n"
            f"Provide executive summary, geological context, route assessment, hazards, and full markdown report.\n"
            f"Include data_limitations."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ReportResponse,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    res = ReportResponse.model_validate(parsed)
                    self._set_cached(cache_key, res.model_dump())
                    return res
            except Exception as e:
                logger.warning(f"Report error: {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)

        return ReportResponse.model_validate(DEMO_REPORT)

    # 7. Route Advice
    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        context_dict = map_context.model_dump() if map_context else {}
        routes_dict = [r.model_dump() for r in candidate_routes]

        cache_key = self._cache_key("route_advice", {"context": context_dict, "routes": routes_dict})
        cached = self._get_cached(cache_key)
        if cached:
            return RouteAdviceResponse.model_validate(cached)

        if self.demo_mode or not self._client:
            res = RouteAdviceResponse.model_validate(DEMO_ROUTE_ADVICE)
            self._set_cached(cache_key, res.model_dump())
            return res

        context_str = format_roverse_context_for_prompt(context_dict)
        prompt = (
            f"{context_str}\n\n"
            f"Candidate Routes:\n{json.dumps(routes_dict, indent=2)}\n\n"
            f"Evaluate and rank candidate routes based strictly on supplied segment slopes, distance, and duration.\n"
            f"Return ranked comparison with data_limitations."
        )

        config = types.GenerateContentConfig(
            system_instruction=ROVERSE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=RouteAdviceResponse,
            tools=GEMINI_MARS_TOOLS,
        )

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                resp = self._client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    res = RouteAdviceResponse.model_validate(parsed)
                    self._set_cached(cache_key, res.model_dump())
                    return res
            except Exception as e:
                logger.warning(f"Route advice error: {e}")
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0 * attempt)

        return RouteAdviceResponse.model_validate(DEMO_ROUTE_ADVICE)

    # 8. Terrain Image
    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        if self.demo_mode or not self._client:
            return {
                "terrain_classification": "Gale Crater Mount Sharp lower pediment (SAMPLE)",
                "identified_features": [
                    "Boxwork polygonal mineral veins protruding 1-5m above bedrock",
                    "Lower slope dark sand ripple patches",
                    "Basaltic scree float boulders"
                ],
                "traversability_rating": "MODERATE_CAUTION",
                "recommended_footpath": "Ascend along northern scree corridor; avoid direct vertical climbs over boxwork blades.",
                "data_limitations": [
                    "ROVERSE Educational Simulation.",
                    "Orbital image interpretation requires in-situ rover or suited astronaut validation."
                ],
                "source": "DEMO_MODE Multimodal Simulation"
            }

        try:
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
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(system_instruction=ROVERSE_SYSTEM_PROMPT),
            )
            return {
                "analysis_text": resp.text or "Analysis completed.",
                "model": self.model_name,
                "data_limitations": [
                    "ROVERSE Educational Simulation.",
                    "Visual inspection only; ground truth required."
                ]
            }
        except Exception as e:
            logger.error(f"Image analysis error: {e}")
            return {
                "error": str(e),
                "fallback": "Visual analysis unavailable. Ensure image format is PNG/JPEG.",
                "data_limitations": ["Sensor analysis failed."]
            }


class LocalAIProvider(BaseAIProvider):
    """Optional Local AI Provider (e.g. Ollama, Gemma 4, or OpenAI-compatible endpoint).
    
    If the local server is not running or unreachable, gracefully falls back to demo data
    so execution never crashes.
    """

    def __init__(self) -> None:
        self.base_url = settings.LOCAL_AI_BASE_URL.rstrip("/")
        self.model = settings.LOCAL_AI_MODEL
        logger.info(f"LocalAIProvider configured at '{self.base_url}' with model '{self.model}'.")

    @property
    def name(self) -> str:
        return "local"

    async def _call_local(self, prompt: str, system: str = ROVERSE_SYSTEM_PROMPT) -> Optional[str]:
        """Post prompt to local OpenAI-compatible /chat/completions endpoint."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.2,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"Local AI endpoint unreachable at {self.base_url}: {e}. Falling back to demo data.")
        return None

    async def stream_chat(
        self,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        map_context: Optional[MapContext] = None,
    ) -> AsyncGenerator[str, None]:
        context_str = format_roverse_context_for_prompt(map_context.model_dump() if map_context else None)
        prompt = f"{context_str}\n\nExplorer: {message}\nROVERSE:"
        local_reply = await self._call_local(prompt)

        if not local_reply:
            lower = message.lower()
            if "hazard" in lower:
                local_reply = DEMO_CHAT_RESPONSES["hazards"]
            elif "budget" in lower or "oxygen" in lower:
                local_reply = DEMO_CHAT_RESPONSES["budget"]
            else:
                local_reply = DEMO_CHAT_RESPONSES["default"]

        for word in local_reply.split(" "):
            yield word + " "
            await asyncio.sleep(0.02)

    async def generate_briefing(
        self,
        map_context: Optional[MapContext] = None,
        candidate_route: Optional[RouteContext] = None,
    ) -> MissionBriefing:
        context_str = format_roverse_context_for_prompt(map_context.model_dump() if map_context else None)
        prompt = f"{context_str}\n\nGenerate JSON MissionBriefing conforming strictly to schema."
        reply = await self._call_local(prompt)
        if reply:
            try:
                # Extract JSON block
                clean_json = re.search(r"\{.*\}", reply, re.DOTALL)
                if clean_json:
                    return MissionBriefing.model_validate_json(clean_json.group(0))
            except Exception:
                pass
        return MissionBriefing.model_validate(DEMO_GALE_CRATER_BRIEFING)

    async def explain_target(
        self,
        target: Optional[ScienceTarget] = None,
        target_id: Optional[str] = None,
        map_context: Optional[MapContext] = None,
    ) -> ExplainTargetResponse:
        return ExplainTargetResponse.model_validate(DEMO_EXPLAIN_TARGET)

    async def terrain_summary(
        self,
        map_context: Optional[MapContext] = None,
    ) -> TerrainSummaryResponse:
        return TerrainSummaryResponse.model_validate(DEMO_TERRAIN_SUMMARY)

    async def route_insights(
        self,
        route: Optional[RouteContext] = None,
        map_context: Optional[MapContext] = None,
    ) -> RouteInsightsResponse:
        return RouteInsightsResponse.model_validate(DEMO_ROUTE_INSIGHTS)

    async def generate_report(
        self,
        map_context: Optional[MapContext] = None,
    ) -> ReportResponse:
        return ReportResponse.model_validate(DEMO_REPORT)

    async def generate_route_advice(
        self,
        candidate_routes: List[RouteContext],
        map_context: Optional[MapContext] = None,
    ) -> RouteAdviceResponse:
        return RouteAdviceResponse.model_validate(DEMO_ROUTE_ADVICE)

    async def analyze_terrain_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        map_context: Optional[MapContext] = None,
    ) -> Dict[str, Any]:
        return {
            "terrain_classification": "Gale Crater Mount Sharp (Local Simulation)",
            "identified_features": ["Polygonal boxwork ridges", "Basaltic sandstone bedrock"],
            "traversability_rating": "MODERATE_CAUTION",
            "source": "Local AI Provider Simulation",
            "data_limitations": ["Local AI simulation context only."]
        }


# ==============================================================================
# PROVIDER FACTORY & SINGLETON INSTANCE
# ==============================================================================

def get_ai_provider() -> BaseAIProvider:
    """Instantiate the active provider based on AI_PROVIDER setting."""
    provider_name = settings.AI_PROVIDER.lower().strip()
    if provider_name == "local":
        return LocalAIProvider()
    return GeminiProvider()


# Global active provider
active_provider: BaseAIProvider = get_ai_provider()
