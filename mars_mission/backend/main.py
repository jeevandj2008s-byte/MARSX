"""Main entry point for the Mars Mission Backend FastAPI application.

NASA Space Apps Challenge 2026: Interplanetary Survival Guide: Martian Map
Mounts the AI integration router under /api/ai.
Features resilient multi-provider AI fallback with zero-crash guarantee.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai import ai_router, provider_router, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mars_mission.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context: starts non-blocking model validation in background."""
    logger.info("Initializing ROVERSE Mars Mission backend services...")
    # Background validation of configured models without blocking startup
    asyncio.create_task(provider_router.validate_configured_models())
    yield
    logger.info("ROVERSE backend shutdown complete.")


app = FastAPI(
    title="ROVERSE - Mars Surface Exploration Planning System",
    description=(
        "Backend server powering ROVERSE for NASA Space Apps 2026 challenge. "
        "Demo Region: Gale Crater / Mount Sharp. Demo Mission: Boxwork Discovery Expedition. "
        "Proposed educational simulation - not a real NASA astronaut mission."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

# Configure CORS restricted to CORS_ORIGINS from env (never wildcard with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the Gemini & Multi-Provider AI Integration Router
app.include_router(ai_router)

# Mount the EVA Route Planner Engine Router (/api/eva/*)
try:
    from fastapi import APIRouter
    from eva_planner import load as load_eva_scenario, plan as plan_eva, run_scenarios as run_eva_scenarios, verify as verify_eva

    eva_router = APIRouter(prefix="/api/eva", tags=["ROVERSE EVA Route Planner"])

    @eva_router.get("/scenario")
    def get_eva_scenario():
        sc = load_eva_scenario()
        return {k: v for k, v in sc.items() if k != "reference"}

    @eva_router.post("/plan")
    def plan_eva_route(body: dict = None):
        sc = load_eva_scenario()
        return plan_eva(sc, body or {})

    @eva_router.get("/scenarios")
    def get_eva_scenarios():
        sc = load_eva_scenario()
        return run_eva_scenarios(sc)

    @eva_router.get("/verify")
    def verify_eva_route():
        sc = load_eva_scenario()
        return verify_eva(plan_eva(sc), sc["reference"], sc)

    app.include_router(eva_router)
    logger.info("ROVERSE EVA Planner endpoints mounted under /api/eva")
except Exception as e:
    logger.warning("Could not mount /api/eva endpoints: %s", e)


@app.get("/")
async def root():
    """Root info endpoint verifying server status and available AI endpoints."""
    return {
        "project": "ROVERSE - Mars Surface Exploration Planning System",
        "challenge": "NASA Space Apps Challenge 2026 - Interplanetary Survival Guide: Martian Map",
        "region": "Gale Crater / Mount Sharp",
        "demo_mission": "Boxwork Discovery Expedition",
        "simulation_notice": "Proposed educational simulation, not a real NASA astronaut mission.",
        "provider_chain": settings.AI_PROVIDER_ORDER,
        "endpoints": {
            "status": "GET /api/ai/status",
            "health": "GET /api/ai/health",
            "health_assist": "POST /api/ai/health-assist",
            "briefing": "POST /api/ai/briefing",
            "explain_target": "POST /api/ai/explain-target",
            "terrain_summary": "POST /api/ai/terrain-summary",
            "route_insights": "POST /api/ai/route-insights",
            "report": "POST /api/ai/report",
            "chat_sse": "POST /api/ai/chat",
            "route_advice": "POST /api/ai/route-advice",
            "terrain_vision": "POST /api/ai/analyze-terrain-image",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting Mars Mission backend on {settings.HOST}:{settings.PORT}")
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
