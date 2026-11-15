# ROVERSE AI Integration Module — Mars Mission Planning Guide
**NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
**System**: ROVERSE (Mars Surface Exploration Planning System)  
**Demo Region**: Gale Crater / Mount Sharp  
**Demo Mission**: "Boxwork Discovery Expedition"  
**Status**: Proposed Educational Simulation (Not a real NASA astronaut mission)

---

## 1. Overview & Core Rules

ROVERSE provides surface exploration planning, hazard synthesis, and EVA walk guidance for human explorers on Mars. It ingests layered multi-mission NASA datasets (HiRISE, MOLA, HRSC, THEMIS, CRISM, MSL RAD) and translates them into actionable intelligence.

### The ROVERSE Core Rule
> **The AI never calculates or invents numbers.**  
> Distance, duration, slope, elevation, and radiation metrics come strictly from supplied data. The AI only explains, summarizes, and gives planning insights from them.

### Mandatory Scientific Disclaimers:
1. **Simulation Notice**: ROVERSE is a proposed educational simulation prototype for mission planning and scientific education, not certified NASA flight operations.
2. **Thermal Caveat**: Orbital thermal inertia from THEMIS reflects surface density and duricrust compaction; it is **NOT** a live temperature forecast.
3. **Radiation Caveat**: Historical Curiosity RAD surface measurements (~25.2 μSv/hr) provide baseline context but **do NOT** establish future astronaut biological exposure or predict acute Solar Particle Events.
4. **All endpoints include an explicit `data_limitations` list.**

---

## 2. Architecture & File Structure

```text
mars_mission/
├── docs/
│   ├── ai-context-contract.md    # Complete JSON schema specification
│   └── ai-README.md              # This document
├── backend/
│   ├── main.py                   # FastAPI server entry point
│   ├── requirements.txt          # Python dependencies (google-genai, fastapi, etc.)
│   ├── smoke_test.py             # 8-part automated smoke test suite
│   └── ai/
│       ├── config.py             # Server settings & provider configuration
│       ├── provider.py           # Provider abstraction (GeminiProvider & LocalAIProvider)
│       ├── gemini_client.py      # Facade client delegating to active provider
│       ├── schemas.py            # Pydantic schemas with data_limitations
│       ├── system_prompt.py      # ROVERSE persona & NASA grounding rules
│       ├── data_adapter.py       # Single adapter file & tool provider (Gale Crater & tools)
│       ├── routes.py             # FastAPI routes mounted at /api/ai
│       ├── demo_data.py          # Gale Crater precomputed mock datasets
│       └── sample_gale_crater_context.json # Standalone sample payload
└── frontend/
    └── src/
        └── ai/                   # Modular React + TypeScript AI UI components
            ├── types.ts          # TypeScript interfaces matching context contract
            ├── api.ts            # Client library with SSE stream reader
            ├── MarsAIPanel.tsx   # Master ROVERSE composite panel (6 tabs)
            ├── BriefingCard.tsx  # Checklist card with clickable waypoints & caveats
            ├── ChatWindow.tsx    # Live streaming SSE tactical chat
            ├── RouteAdvisorCard.tsx # Multi-route comparison & ranking card
            └── index.ts          # Barrel export
```

---

## 3. Setup & Provider Configuration

### Environment Variables (`.env`)

Copy `.env.example` to `.env`:

```dotenv
# Provider Selection: 'gemini' (default, google-genai SDK) or 'local' (Ollama / local endpoint)
AI_PROVIDER=gemini

# Google Gemini API Configuration (server-side ONLY)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash

# Optional Local Provider (e.g. Ollama or Gemma 4)
LOCAL_AI_BASE_URL=http://localhost:11434/v1
LOCAL_AI_MODEL=gemma-4-mars

# Hackathon / Presentation Reliability Flag
# Set to 'true' to use instant offline Gale Crater briefings (fail-safe for presentations)
DEMO_MODE=false
```

### Running the Backend

```bash
# Activate virtual environment
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # Linux/macOS

# Run FastAPI server
cd backend
python main.py
```

### Running the Test Suite

```bash
# Standalone smoke test:
python backend/smoke_test.py

# Full pytest suite:
pytest -v
```

---

## 4. API Endpoints Reference

All endpoints are hosted under `/api/ai`.

### 1. Health Diagnostic
- **`GET /api/ai/health`**
- Returns server status, active provider (`gemini` or `local`), model, and `demo_mode` flag.

```bash
curl -X GET http://127.0.0.1:8000/api/ai/health
```

### 2. Structured Mission Briefing
- **`POST /api/ai/briefing`**
- **Input**: `{ "map_context": { ... } }`
- **Output**: JSON containing `summary`, `risk_level`, `go_no_go`, `hazards`, `waypoints`, `eva_timeline`, `consumables`, `science_opportunities`, `data_limitations`, `simulation_notice`.

```bash
curl -X POST http://127.0.0.1:8000/api/ai/briefing \
  -H "Content-Type: application/json" \
  -d '{"map_context": {"location": {"lat": -4.68, "lon": 137.38, "site_name": "Base Camp Curiosity Ridge"}}}'
```

### 3. Explain Science Target
- **`POST /api/ai/explain-target`**
- **Input**: `{ "target_id": "target-boxwork-1", "map_context": { ... } }`
- **Output**: JSON containing `target_name`, `geological_significance`, `scientific_hypothesis`, `sampling_recommendations`, `source_layer_citations`, `data_limitations`.

```bash
curl -X POST http://127.0.0.1:8000/api/ai/explain-target \
  -H "Content-Type: application/json" \
  -d '{"target_id": "target-boxwork-1"}'
```

### 4. Terrain & Layer Summary
- **`POST /api/ai/terrain-summary`**
- **Input**: `{ "map_context": { ... } }`
- **Output**: JSON summarizing optical, elevation, slope, thermal, mineralogy, and radiation layers.

```bash
curl -X POST http://127.0.0.1:8000/api/ai/terrain-summary \
  -H "Content-Type: application/json" \
  -d '{"map_context": {}}'
```

### 5. Route Insights
- **`POST /api/ai/route-insights`**
- **Input**: `{ "route": { ... }, "map_context": { ... } }`
- **Output**: JSON flagging steep segments, long segments, return-trip considerations (fatigue and turn-around margins), and `data_limitations`.

```bash
curl -X POST http://127.0.0.1:8000/api/ai/route-insights \
  -H "Content-Type: application/json" \
  -d '{"route": {"name": "Boxwork Loop", "totals": {"distance_km": 7.2, "max_slope_deg": 14.2, "estimated_minutes": 172}}}'
```

### 6. Downloadable Mission Report
- **`POST /api/ai/report`**
- **Input**: `{ "map_context": { ... } }`
- **Output**: JSON containing `executive_summary`, `geological_context`, `route_assessment`, `full_report_markdown`, and `data_limitations`.

```bash
curl -X POST http://127.0.0.1:8000/api/ai/report \
  -H "Content-Type: application/json" \
  -d '{"map_context": {}}'
```

### 7. Conversational Tactical Chat (SSE Stream)
- **`POST /api/ai/chat`**
- **Input**: `{ "message": "Check our slope limit on Segment 1", "map_context": { ... } }`
- **Output**: Server-Sent Events stream (`data: {"text": "..."}\n\n`).

```bash
curl -N -X POST http://127.0.0.1:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the maximum slope on Segment 1?"}'
```

---

## 5. How Teammates Plug In Real NASA Data

All data access is centralized in **`backend/ai/data_adapter.py`**:
1. To connect real raster / GIS layers (MOLA GeoTIFF, HiRISE tiles, THEMIS thermal inertia, HRSC slopes, CRISM spectral cubes):
   - Edit `get_layer_data(layer: str, lat: float, lon: float) -> dict` in `data_adapter.py`.
2. To connect the routing engine:
   - Edit `get_route_stats(route_id: str) -> dict` in `data_adapter.py`.
Gemini invokes these functions through function calling, automatically integrating real values into briefings and chat responses!
