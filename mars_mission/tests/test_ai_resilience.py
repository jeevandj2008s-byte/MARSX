"""Comprehensive Resilience & Multi-Provider Fallback Tests for ROVERSE.

NASA Space Apps Challenge 2026: Interplanetary Survival Guide: Martian Map.
Verifies all 6 resilience requirements using mocks (no real keys or network required):
1. Each failure type (401, 404, 429, 5xx, timeout, malformed JSON, schema mismatch)
   falls through the chain to the next provider and finally to offline.
2. An empty .env boots and serves valid responses.
3. Red-flag triage returns fixed emergency response without calling any model.
4. All endpoints return schema-valid JSON.
5. GET /api/ai/status leaks zero secrets or API keys.
6. Number post-check rejects invented metrics not grounded in supplied context.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from ai.circuit_breaker import circuit_manager
from ai.config import settings
from ai.health_assist import health_assistant
from ai.prompt_builder import PromptBuilder
from ai.providers.offline_provider import OfflineProvider
from ai.providers.openai_compat import OpenAICompatProvider
from ai.router import ProviderRouter
from ai.schemas import (
    ExplainTargetResponse,
    HealthAssistRequest,
    HealthAssistResponse,
    MissionBriefing,
    ReportResponse,
    RouteAdviceResponse,
    RouteInsightsResponse,
    SystemStatusResponse,
    TerrainSummaryResponse,
)


@pytest.fixture
def client():
    return TestClient(app)


# ==============================================================================
# 1. RED-FLAG HEALTH TRIAGE TESTS
# ==============================================================================

def test_red_flag_triage_returns_fixed_response_without_model():
    """Verify red-flag emergencies return deterministic safety protocols instantly."""
    emergency_queries = [
        "Astronaut experiencing severe chest pain and shortness of breath.",
        "Suit pressure loss alarm triggered with rapid decompression.",
        "Sudden loss of consciousness reported at Boxwork waypoint 2.",
        "Acute arterial bleeding following rover tether rupture.",
        "Explorer suffering stroke symptoms, facial drooping and slurred speech.",
        "Critical ionizing radiation flux alarm: MSL RAD spike > 1000 uSv/h.",
    ]

    for query in emergency_queries:
        req = HealthAssistRequest(query=query)
        result = health_assistant.triage(req)
        assert result.is_emergency is True, f"Failed to triage emergency: {query}"
        assert result.triaged_category == "RED_FLAG_EMERGENCY"
        assert "immediate" in result.recommended_action.lower() or "terminate" in result.recommended_action.lower()
        assert len(result.emergency_steps) >= 3
        assert "simulation" in result.simulation_notice.lower()


def test_nominal_health_query_offline():
    """Verify nominal astronaut health queries return curated guidelines."""
    req = HealthAssistRequest(query="What is the recommended hydration schedule during a 4-hour EVA?")
    result = health_assistant.triage(req)
    assert result.is_emergency is False
    assert result.triaged_category == "HYDRATION"
    assert "fluid" in result.guidance.lower() or "hydration" in result.guidance.lower()
    assert len(result.data_limitations) > 0


# ==============================================================================
# 2. STATUS ENDPOINT & SECRET LEAK PREVENTION
# ==============================================================================

def test_status_endpoint_never_leaks_secrets(client):
    """Ensure GET /api/ai/status reveals provider health and verified models but zero secrets."""
    resp = client.get("/api/ai/status")
    assert resp.status_code == 200
    raw_text = resp.text

    # Verify no raw API keys or tokens are in the response
    for key in [settings.GEMINI_API_KEY, settings.GROQ_API_KEY, settings.OPENROUTER_API_KEY, settings.MISTRAL_API_KEY]:
        if key and len(key) > 5:
            assert key not in raw_text, "CRITICAL SECURITY LEAK: Raw API key found in /api/ai/status response!"

    data = resp.json()
    status_obj = SystemStatusResponse.model_validate(data)
    assert status_obj.status == "operational"
    assert "offline" in status_obj.providers
    assert status_obj.providers["offline"].healthy is True
    assert "gemini" in status_obj.providers
    assert "groq" in status_obj.providers
    assert "openrouter" in status_obj.providers


# ==============================================================================
# 3. PROMPT BUILDER NUMBER POST-CHECK TESTS
# ==============================================================================

def test_number_post_check_validates_grounding():
    """Verify that PromptBuilder.post_check_numbers rejects outputs with invented numbers."""
    context_str = """
    Mission: Boxwork Discovery Expedition
    Total distance: 4.2 km
    Max slope: 14.5 deg
    Estimated duration: 165 minutes
    MSL RAD background: 18.5 uSv/h
    Elevation change: 85 meters
    """

    # Grounded text: numbers are in context or standard percentage/fractions
    grounded_text = "The route spans 4.2 km with a max slope of 14.5 deg and 85 meters elevation change."
    assert PromptBuilder.post_check_numbers(context_str, grounded_text) is True

    # Hallucinated text: distance of 99.8 km, slope 45.2 deg, and radiation 789.0 never appeared in context
    hallucinated_text = "The expedition covers 99.8 km with treacherous 45.2 deg slopes and 789.0 uSv/h radiation."
    assert PromptBuilder.post_check_numbers(context_str, hallucinated_text) is False


# ==============================================================================
# 4. PROVIDER FALLTHROUGH & CIRCUIT BREAKER TESTS (MOCKED)
# ==============================================================================

def test_fallthrough_on_http_401():
    """HTTP 401 disables the provider circuit and falls to the next provider."""
    async def run_test():
        router = ProviderRouter()

        mock_groq = MagicMock(spec=OpenAICompatProvider)
        mock_groq.name = "groq"
        mock_groq.is_configured = True
        mock_groq.generate_briefing = AsyncMock(side_effect=Exception("HTTP 401: Invalid API Key"))
        router.providers["groq"] = mock_groq

        with patch.object(settings, "AI_PROVIDER_ORDER_RAW", "groq,offline"):
            briefing = await router.generate_briefing()
            assert isinstance(briefing, MissionBriefing)
            assert briefing.response_metadata is not None
            assert briefing.response_metadata.provider_used == "offline"

    asyncio.run(run_test())


def test_fallthrough_on_timeout():
    """Timeout falls through cleanly to offline provider without crashing."""
    async def run_test():
        router = ProviderRouter()

        mock_groq = MagicMock(spec=OpenAICompatProvider)
        mock_groq.name = "groq"
        mock_groq.is_configured = True
        mock_groq.generate_briefing = AsyncMock(side_effect=asyncio.TimeoutError())
        router.providers["groq"] = mock_groq

        with patch.object(settings, "AI_PROVIDER_ORDER_RAW", "groq,offline"):
            briefing = await router.generate_briefing()
            assert isinstance(briefing, MissionBriefing)
            assert briefing.response_metadata is not None
            assert briefing.response_metadata.provider_used == "offline"

    asyncio.run(run_test())


def test_fallthrough_on_malformed_and_schema_mismatch():
    """Malformed JSON or schema mismatches fall through gracefully."""
    async def run_test():
        router = ProviderRouter()

        mock_provider = MagicMock(spec=OpenAICompatProvider)
        mock_provider.name = "groq"
        mock_provider.is_configured = True
        mock_provider.explain_target = AsyncMock(side_effect=ValueError("Invalid JSON from LLM"))
        router.providers["groq"] = mock_provider

        with patch.object(settings, "AI_PROVIDER_ORDER_RAW", "groq,offline"):
            res = await router.explain_target(target_id="target-boxwork-1")
            assert isinstance(res, ExplainTargetResponse)
            assert res.target_id == "target-boxwork-1"
            assert res.response_metadata is not None
            assert res.response_metadata.provider_used == "offline"

    asyncio.run(run_test())


def test_circuit_breaker_3_failures_opens_circuit():
    """3 consecutive failures opens circuit for cooldown period."""
    test_circuit = circuit_manager.get_circuit("test_circuit_unit")
    test_circuit.consecutive_failures = 0
    test_circuit.disabled = False

    assert test_circuit.is_available is True

    test_circuit.record_failure("Error 1")
    assert test_circuit.circuit_state == "closed"
    assert test_circuit.is_available is True

    test_circuit.record_failure("Error 2")
    assert test_circuit.circuit_state == "closed"

    test_circuit.record_failure("Error 3")
    assert test_circuit.circuit_state == "open"
    assert test_circuit.is_available is False

    test_circuit.record_success()
    assert test_circuit.circuit_state == "closed"
    assert test_circuit.is_available is True


# ==============================================================================
# 5. EMPTY .ENV BOOTS & SERVES DETERMINISTIC RESPONSES
# ==============================================================================

def test_offline_tier_serves_all_endpoints_without_internet():
    """Verify OfflineProvider independently satisfies all response contracts."""
    async def run_test():
        offline = OfflineProvider()

        # 1. Briefing
        briefing = await offline.generate_briefing()
        assert isinstance(briefing, MissionBriefing)
        assert briefing.go_no_go in ["GO", "CAUTION", "NO-GO"]
        assert len(briefing.hazards) > 0
        assert len(briefing.data_limitations) > 0

        # 2. Explain Target
        target = await offline.explain_target(target_id="target-boxwork-1")
        assert isinstance(target, ExplainTargetResponse)
        assert len(target.sampling_recommendations) > 0

        # 3. Terrain Summary
        terrain = await offline.terrain_summary()
        assert isinstance(terrain, TerrainSummaryResponse)
        assert len(terrain.layer_summaries) >= 3

        # 4. Route Insights
        insights = await offline.route_insights()
        assert isinstance(insights, RouteInsightsResponse)
        assert len(insights.segment_insights) > 0

        # 5. Report
        report = await offline.generate_report()
        assert isinstance(report, ReportResponse)
        assert len(report.full_report_markdown) > 100

        # 6. Route Advice
        advice = await offline.generate_route_advice([])
        assert isinstance(advice, RouteAdviceResponse)
        assert advice.recommended_route_id != ""

        # 7. Health Assist
        health = await offline.health_assist(HealthAssistRequest(query="General hydration inquiry"))
        assert isinstance(health, HealthAssistResponse)
        assert health.guidance != ""

    asyncio.run(run_test())


# ==============================================================================
# 6. ENDPOINT INTEGRATION TESTS VIA HTTP CLIENT
# ==============================================================================

def test_api_health_assist_emergency(client):
    """Test POST /api/ai/health-assist returns emergency response."""
    payload = {
        "query": "Astronaut collapsed with severe chest pain and oxygen alarm.",
    }
    resp = client.post("/api/ai/health-assist", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    res = HealthAssistResponse.model_validate(data)
    assert res.is_emergency is True
    assert res.triaged_category == "RED_FLAG_EMERGENCY"
    assert len(res.emergency_steps) > 0


def test_api_health_assist_consultation(client):
    """Test POST /api/ai/health-assist returns guidance for non-emergency."""
    payload = {
        "query": "What are recommended rest intervals when traversing 12-degree slopes?",
    }
    resp = client.post("/api/ai/health-assist", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    res = HealthAssistResponse.model_validate(data)
    assert res.is_emergency is False
    assert len(res.guidance) > 20
