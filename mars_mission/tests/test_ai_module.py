"""Unit and integration tests for ROVERSE Mars Mission Planning AI module.

Run with: pytest tests/
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from main import app
from ai.data_adapter import (
    calculate_eva_budget,
    get_layer_data,
    get_route_stats,
    list_hazards_near,
)
from ai.schemas import (
    ExplainTargetResponse,
    MissionBriefing,
    ReportResponse,
    RouteAdviceResponse,
    RouteInsightsResponse,
    TerrainSummaryResponse,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_missing_data_resilience(client):
    """Ensure sending empty map context never crashes and returns data_limitations."""
    empty_payload = {"map_context": {}}
    resp = client.post("/api/ai/briefing", json=empty_payload)
    assert resp.status_code == 200
    briefing = MissionBriefing.model_validate(resp.json())
    assert briefing.go_no_go in ["GO", "CAUTION", "NO-GO"]
    assert "data_limitations" in resp.json()


def test_explain_target_endpoint(client):
    """Test explain target endpoint with data_limitations."""
    payload = {"target_id": "target-boxwork-1"}
    resp = client.post("/api/ai/explain-target", json=payload)
    assert resp.status_code == 200
    res = ExplainTargetResponse.model_validate(resp.json())
    assert res.target_id == "target-boxwork-1"
    assert len(res.data_limitations) > 0


def test_terrain_summary_endpoint(client):
    """Test terrain summary endpoint."""
    resp = client.post("/api/ai/terrain-summary", json={})
    assert resp.status_code == 200
    res = TerrainSummaryResponse.model_validate(resp.json())
    assert len(res.layer_summaries) > 0
    assert len(res.data_limitations) > 0


def test_route_insights_endpoint(client):
    """Test route insights endpoint."""
    resp = client.post("/api/ai/route-insights", json={})
    assert resp.status_code == 200
    res = RouteInsightsResponse.model_validate(resp.json())
    assert len(res.data_limitations) > 0


def test_report_endpoint(client):
    """Test report generation endpoint."""
    resp = client.post("/api/ai/report", json={})
    assert resp.status_code == 200
    res = ReportResponse.model_validate(resp.json())
    assert len(res.full_report_markdown) > 50
    assert len(res.data_limitations) > 0


def test_data_adapter_tools():
    """Verify tool functions return valid shapes and handle unknowns gracefully."""
    # Test optical
    opt = get_layer_data("optical", -4.68, 137.38)
    assert opt["layer"] == "optical"
    assert opt["available"] is True

    # Test thermal
    therm = get_layer_data("thermal", -4.68, 137.38)
    assert therm["layer"] == "thermal"
    assert "thermal inertia" in therm["value"].lower()

    # Test unknown layer
    unknown = get_layer_data("antigravity_quantum_flux", -4.68, 137.38)
    assert unknown["status"] == "data not available"
    assert unknown["available"] is False

    # Test route stats
    route_stats = get_route_stats("EVA-ROVERSE-01")
    assert "roverse" in route_stats["route_id"].lower()
    assert len(route_stats["waypoints"]) > 0

    # Test hazards
    hazards = list_hazards_near(-4.68, 137.38, radius_km=5.0)
    assert isinstance(hazards, list)
    assert len(hazards) > 0

    # Test EVA budget calculation
    budget = calculate_eva_budget(distance_km=7.2, speed_kmh=2.5, oxygen_hours=8.0)
    assert budget["oxygen_consumed_percent"] > 0
    assert budget["safe_turn_around_deadline_minutes"] > 0


def test_route_advice_endpoint(client):
    """Test candidate route evaluation endpoint."""
    payload = {
        "candidate_routes": [
            {
                "route_id": "r1",
                "name": "Route 1",
                "distance_km": 2.0,
                "waypoints": [{"lat": -4.68, "lon": 137.38}],
            }
        ]
    }
    resp = client.post("/api/ai/route-advice", json=payload)
    assert resp.status_code == 200
    advice = RouteAdviceResponse.model_validate(resp.json())
    assert advice.recommended_route_id != ""


def test_chat_empty_message_validation(client):
    """Test validation of bad chat requests."""
    resp = client.post("/api/ai/chat", json={"message": "   "})
    assert resp.status_code == 400
