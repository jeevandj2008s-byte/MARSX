# ROVERSE AI Context Contract: Martian Map Integration Specification
**NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
**System**: ROVERSE (Mars Surface Exploration Planning System)  
**Demo Region**: Gale Crater / Mount Sharp  
**Demo Mission**: "Boxwork Discovery Expedition" (Base -> Boxwork Formation -> Sulfate-Clay Contact -> Base Return)  
**Status**: Proposed Educational Simulation (Not a real NASA astronaut mission)

---

## 1. Executive Summary & Core Rules

This contract defines the flexible JSON payload that the Map UI, Data Layer engineers, and Route logic developers send to the ROVERSE AI Integration module (`/backend/ai` and `/frontend/src/ai`).

### Fundamental Directives:
1. **Core Rule — Zero Numerical Invention or Calculation**: Distance, duration, slope, elevation, and radiation values MUST come strictly from supplied data. The AI never calculates or invents numbers; it only explains, summarizes, and derives operational insights from them.
2. **100% Optional Fields**: Every single property in the contract is optional. Missing or partial data will **never** crash the AI service.
3. **Graceful Degradation ("Data Not Available")**: If specific mission layers are absent or have `available: false`, the AI explicitly states `"data not available"` or `"unmapped"` and flags it in `data_limitations`.
4. **Mandatory Scientific Caveats**:
   - **Thermal Caveat**: Orbital thermal data (THEMIS) reflects thermal inertia / rock abundance, **not** a live surface weather or temperature forecast.
   - **Radiation Caveat**: Historical surface measurements (MSL RAD) provide baseline environmental context, but **do not** establish future human astronaut exposure or predict acute Solar Particle Events.
5. **Simulation Disclaimer**: Every response clearly states that ROVERSE is a proposed educational simulation.

---

## 2. Complete Context Schema (TypeScript / JSON)

```typescript
export interface MapContext {
  // 1. Mission Metadata
  mission?: {
    name?: string;                       // e.g. "Boxwork Discovery Expedition (SAMPLE)"
    region?: string;                     // e.g. "Gale Crater / Mount Sharp (SAMPLE)"
    objective?: string;                  // e.g. "Survey polygonal boxwork ridge networks and return to base"
  };

  // 2. Focused Location / Basecamp
  location?: {
    lat?: number;                        // Martian latitude (-90 to +90)
    lon?: number;                        // Martian longitude (-180 to +180 or 0 to 360)
    site_name?: string;                  // e.g. "Base Camp Curiosity Ridge"
    elevation_m?: number;                // Elevation relative to Mars Datum (MOLA)
    geological_unit?: string;            // e.g. "Lower Mount Sharp Fractured Bedrock"
    description?: string;                // Context note from map click or search
  };

  // 3. Planned Traverse Route
  route?: {
    route_id: string;                    // e.g. "EVA-ROVERSE-01"
    name?: string;                       // e.g. "Boxwork Discovery Loop"
    
    // Ordered Waypoints
    waypoints?: Array<{
      id: string;                        // e.g. "wp-base", "wp-boxwork", "wp-contact", "wp-return"
      name: string;                      // e.g. "Mount Sharp Boxwork Formation"
      lat: number;
      lon: number;
      type: "base" | "science" | "return" | "checkpoint" | "hazard";
      elevation_m?: number;              // Supplied elevation
      sequence?: number;                 // 1-based order
      reason?: string;                   // Exploration rationale
    }>;

    // Segments Connecting Waypoints (Supplied by Route Logic)
    segments?: Array<{
      from_waypoint_id: string;          // e.g. "wp-base"
      to_waypoint_id: string;            // e.g. "wp-boxwork"
      distance_km: number;               // Supplied distance (AI does not calculate)
      elevation_change_m: number;        // Supplied elevation change (+/-)
      max_slope_deg: number;             // Supplied maximum slope gradient
      estimated_minutes: number;         // Supplied duration estimate
      notes?: string;                    // e.g. "Steep ascent on scree ramp"
    }>;

    // Route Totals (Supplied by Route Logic)
    totals?: {
      distance_km: number;               // Total supplied distance (e.g. 7.2)
      elevation_change_m: number;        // Total supplied elevation change (e.g. 170.0)
      max_slope_deg: number;             // Maximum slope along traverse (e.g. 14.2)
      estimated_minutes: number;         // Total supplied duration (e.g. 172.0)
    };
  };

  // 4. Designated Science Targets
  science_targets?: Array<{
    id: string;                          // e.g. "target-boxwork-1"
    name: string;                        // e.g. "Mount Sharp Boxwork Network"
    lat?: number;
    lon?: number;
    description?: string;                // Morphological description
    geology_notes?: string;              // Geological hypothesis or mineralogy
  }>;

  // 5. Multi-Mission Data Layers (optical, elevation, slope, thermal, mineralogy, radiation)
  layers?: {
    // Optical Imagery: HiRISE / CTX (MRO)
    optical?: {
      available: boolean;                // true / false
      source?: string;                   // e.g. "HiRISE (Mars Reconnaissance Orbiter)"
      observation_date?: string;         // e.g. "2024-02-18"
      resolution?: string;               // e.g. "0.25 m/pixel"
      units?: string;                    // e.g. "radiance/reflectance"
      value?: string;                    // Visual observation summary
    };

    // Elevation / Topography: MOLA / HRSC
    elevation?: {
      available: boolean;
      source?: string;                   // e.g. "MOLA / HRSC Blended DTM"
      observation_date?: string;
      resolution?: string;               // e.g. "50 m/pixel"
      units?: string;                    // e.g. "meters"
      value?: string | number;           // Absolute elevation reading
    };

    // Slope Gradient: HRSC / MOLA
    slope?: {
      available: boolean;
      source?: string;                   // e.g. "HRSC Slope Map"
      observation_date?: string;
      resolution?: string;               // e.g. "50 m/pixel"
      units?: string;                    // e.g. "degrees"
      value?: string | number;           // Slope reading
    };

    // Surface Thermal Inertia: THEMIS (Mars Odyssey)
    thermal?: {
      available: boolean;
      source?: string;                   // e.g. "THEMIS (Mars Odyssey)"
      observation_date?: string;
      resolution?: string;               // e.g. "100 m/pixel"
      units?: string;                    // e.g. "J m^-2 K^-1 s^-1/2"
      value?: string;                    // Thermal inertia reading
    };

    // Spectroscopy & Mineralogy: CRISM (MRO)
    mineralogy?: {
      available: boolean;
      source?: string;                   // e.g. "CRISM (Mars Reconnaissance Orbiter)"
      observation_date?: string;
      resolution?: string;               // e.g. "18 m/pixel"
      units?: string;                    // e.g. "absorption band depth"
      value?: string;                    // Identified minerals (e.g. sulfates, clays)
    };

    // Historical Surface Radiation: RAD (Curiosity / MSL)
    radiation?: {
      available: boolean;
      source?: string;                   // e.g. "RAD (MSL / Curiosity Archive)"
      observation_date?: string;
      resolution?: string;               // e.g. "Point sensor on rover deck"
      units?: string;                    // e.g. "μSv/hr"
      value?: string | number;           // Historical background dose rate
    };
  };

  // 6. Astronaut Simulation Constraints
  astronaut_constraints?: {
    crew_size?: number;
    suit_oxygen_capacity_hours?: number; // default 8.0
    suit_power_capacity_hours?: number;  // default 7.0
    nominal_walking_speed_kmh?: number;  // default 2.5
    rover_supported?: boolean;
  };
}
```

---

## 3. Full Gale Crater Sample Payload (`Boxwork Discovery Expedition`)

This exact file is provided in `backend/ai/sample_gale_crater_context.json`:

```json
{
  "mission": {
    "name": "Boxwork Discovery Expedition (SAMPLE - replace with real data)",
    "region": "Gale Crater / Mount Sharp (SAMPLE - replace with real data)",
    "objective": "Traverse from Base Camp Curiosity Ridge across Mount Sharp lower slopes to investigate spiderweb boxwork fracture fills, proceed to the Sulfate-Clay contact zone, and safely return to base (SAMPLE - replace with real data)."
  },
  "location": {
    "lat": -4.6821,
    "lon": 137.3812,
    "site_name": "Base Camp Curiosity Ridge (SAMPLE)",
    "elevation_m": -4120.0
  },
  "route": {
    "route_id": "EVA-ROVERSE-01 (SAMPLE)",
    "name": "Boxwork Discovery Loop (SAMPLE)",
    "waypoints": [
      { "id": "wp-base", "name": "Base Camp Curiosity Ridge [SAMPLE]", "lat": -4.6821, "lon": 137.3812, "type": "base", "sequence": 1 },
      { "id": "wp-boxwork", "name": "Mount Sharp Boxwork Formation [SAMPLE]", "lat": -4.6954, "lon": 137.3945, "type": "science", "sequence": 2 },
      { "id": "wp-contact", "name": "Sulfate-Clay Transition Outcrop [SAMPLE]", "lat": -4.7088, "lon": 137.4082, "type": "science", "sequence": 3 },
      { "id": "wp-return", "name": "Base Camp Return Airlock [SAMPLE]", "lat": -4.6821, "lon": 137.3812, "type": "return", "sequence": 4 }
    ],
    "segments": [
      { "from_waypoint_id": "wp-base", "to_waypoint_id": "wp-boxwork", "distance_km": 2.4, "elevation_change_m": 85.0, "max_slope_deg": 14.2, "estimated_minutes": 58.0 },
      { "from_waypoint_id": "wp-boxwork", "to_waypoint_id": "wp-contact", "distance_km": 1.6, "elevation_change_m": -30.0, "max_slope_deg": 8.5, "estimated_minutes": 38.0 },
      { "from_waypoint_id": "wp-contact", "to_waypoint_id": "wp-return", "distance_km": 3.2, "elevation_change_m": -55.0, "max_slope_deg": 11.0, "estimated_minutes": 76.0 }
    ],
    "totals": {
      "distance_km": 7.2,
      "elevation_change_m": 170.0,
      "max_slope_deg": 14.2,
      "estimated_minutes": 172.0
    }
  },
  "science_targets": [
    {
      "id": "target-boxwork-1",
      "name": "Mount Sharp Boxwork Network (SAMPLE)",
      "description": "Intersecting mineralized veins protruding 1-5m above bedrock.",
      "geology_notes": "Mineralized groundwater circulated through fractured lakebed mudstones."
    }
  ],
  "layers": {
    "optical": { "available": true, "source": "HiRISE (MRO) [SAMPLE]", "value": "Blade-like ridges and local sand ripples" },
    "elevation": { "available": true, "source": "MOLA/HRSC [SAMPLE]", "value": "-4120m to -4035m" },
    "slope": { "available": true, "source": "HRSC [SAMPLE]", "value": "Max 14.2° on Boxwork ascent; mean 7.8°" },
    "thermal": { "available": true, "source": "THEMIS [SAMPLE]", "value": "Thermal inertia ~340 units (cemented duricrust). Not a live temperature forecast." },
    "mineralogy": { "available": true, "source": "CRISM [SAMPLE]", "value": "Hydrated magnesium sulfates and iron smectites" },
    "radiation": { "available": true, "source": "MSL RAD [SAMPLE]", "value": "Historical surface rate ~25.2 μSv/hr. Does not establish future astronaut exposure." }
  }
}
```

---

## 4. How Teammates Send This Payload

1. **In the React Component**:
   ```tsx
   import { MarsAIPanel } from './ai';

   <MarsAIPanel 
     context={activeMapContext}
     onWaypointSelect={(lat, lon) => {
       // Pan Leaflet map
       mapRef.current.flyTo([lat, lon], 14);
     }}
   />
   ```

2. **Direct Backend Endpoints**:
   - `POST /api/ai/briefing`: Send `{ "map_context": <MapContext> }` -> structured mission briefing.
   - `POST /api/ai/explain-target`: Send `{ "target_id": "...", "map_context": <MapContext> }` -> science target analysis.
   - `POST /api/ai/terrain-summary`: Send `{ "map_context": <MapContext> }` -> layer & roughness summary.
   - `POST /api/ai/route-insights`: Send `{ "route": <RouteContext>, "map_context": <MapContext> }` -> segment flags & return analysis.
   - `POST /api/ai/report`: Send `{ "map_context": <MapContext> }` -> complete report-ready dossier text and markdown.
   - `POST /api/ai/chat`: Send `{ "message": "...", "map_context": <MapContext> }` -> SSE streaming response.
