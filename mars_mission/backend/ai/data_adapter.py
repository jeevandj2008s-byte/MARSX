"""Martian Data Adapter and Tool Function Providers for ROVERSE.

Single point of access for all Martian terrain, mission layers, and EVA calculations.
Connects directly to the underlying calculation engines:
- Terrain Engine (terrain_grid.json & layers_metadata.json)
- Environment Engine (atmospheric, thermal, dust)
- Radiation Engine (MSL/RAD baseline, GCR/SPE models)
- Comms Engine (Mars Relay Network & DTE)
- EVA Planner Engine (standardized time/consumables/50% turn-around)

Maintains backward-compatible tool signatures for Gemini and Multi-Provider AI calls.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from .config import settings
from .engines.comms import comms_engine
from .engines.environment import env_engine
from .engines.eva import calculate_haversine_distance, eva_engine, MARS_RADIUS_METERS
from .engines.radiation import radiation_engine
from .engines.terrain import terrain_engine


class MartianDataAdapter:
    """Adapter bridging raw Martian mission data sources to the AI engine."""

    # Pre-defined known zones
    ZONES = {
        "gale_crater": {
            "name": "Gale Crater / Mount Sharp (Boxwork Discovery Region)",
            "site": "gale",
            "bounds": {"lat_min": -5.5, "lat_max": -3.5, "lon_min": 137.0, "lon_max": 138.5},
            "elevation_m": -4120.0,
            "slope_deg": 14.2,
            "roughness": 0.55,
            "air_temp_c": -62.0,
            "ground_temp_c": -18.0,
            "wind_speed_mps": 5.4,
            "radiation_uSv_hr": 25.2,
            "tau": 0.45,
            "terrain_type": "Polygonal boxwork ridges, basaltic sandstone pediment, and sulfate yardangs",
            "hazards": [
                {
                    "type": "Steep Ridge Ascent (Max 14.2°)",
                    "severity": "MODERATE",
                    "lat": -4.6850,
                    "lon": 137.3850,
                    "location": "Segment 1 (Base Camp -> Mount Sharp Boxwork Ridge)",
                    "source_layer": "HRSC Slope Map",
                    "mitigation": "Traverse diagonally along switchbacks; avoid direct vertical ascent on scarp face.",
                },
                {
                    "type": "Blade-Like Boxwork Vein Relief",
                    "severity": "MODERATE",
                    "lat": -4.6954,
                    "lon": 137.3945,
                    "location": "Waypoint 2 (Mount Sharp Boxwork Formation)",
                    "source_layer": "HiRISE (Mars Reconnaissance Orbiter)",
                    "mitigation": "Boxwork ridges stand 1-5m tall; navigate through natural erosional passes to avoid suit puncture.",
                },
            ],
        },
        "jezero_delta": {
            "name": "Jezero Crater Western Delta",
            "site": "jezero",
            "bounds": {"lat_min": 18.0, "lat_max": 19.0, "lon_min": 77.0, "lon_max": 78.0},
            "elevation_m": -2530.0,
            "slope_deg": 11.4,
            "roughness": 0.42,
            "air_temp_c": -64.2,
            "ground_temp_c": -19.5,
            "wind_speed_mps": 6.8,
            "radiation_uSv_hr": 24.8,
            "tau": 0.48,
            "terrain_type": "Fluvial deltaic mudstones with layered cross-bedding and sand ripples",
            "hazards": [
                {
                    "type": "Steep Slope",
                    "severity": "MODERATE",
                    "lat": 18.4480,
                    "lon": 77.4520,
                    "location": "Delta Scarp Face (18.448°N, 77.452°E)",
                    "source_layer": "MOLA (Mars Global Surveyor)",
                    "mitigation": "Traverse diagonally along switchbacks; avoid direct vertical ascent.",
                },
            ],
        },
    }

    KNOWN_ROUTES = {
        "eva-roverse-01": {
            "route_id": "EVA-ROVERSE-01",
            "name": "Boxwork Discovery Loop",
            "distance_km": 7.2,
            "estimated_duration_hours": 2.87,
            "estimated_minutes": 172.0,
            "max_slope_deg": 14.2,
            "elevation_gain_m": 85.0,
            "elevation_loss_m": 85.0,
            "safety_verdict": "VIABLE_WITH_CAUTION",
            "waypoints": [
                {"sequence": 1, "lat": -4.6821, "lon": 137.3812, "label": "Base Camp Curiosity Ridge"},
                {"sequence": 2, "lat": -4.6954, "lon": 137.3945, "label": "Mount Sharp Boxwork Formation"},
                {"sequence": 3, "lat": -4.7088, "lon": 137.4082, "label": "Sulfate-Clay Transition Outcrop"},
                {"sequence": 4, "lat": -4.6821, "lon": 137.3812, "label": "Base Camp Return Airlock"},
            ],
            "segments": [
                {"from_waypoint_id": "wp-base", "to_waypoint_id": "wp-boxwork", "distance_km": 2.4, "max_slope_deg": 14.2, "estimated_minutes": 58.0},
                {"from_waypoint_id": "wp-boxwork", "to_waypoint_id": "wp-contact", "distance_km": 1.6, "max_slope_deg": 8.5, "estimated_minutes": 38.0},
                {"from_waypoint_id": "wp-contact", "to_waypoint_id": "wp-return", "distance_km": 3.2, "max_slope_deg": 11.0, "estimated_minutes": 76.0},
            ],
            "totals": {
                "distance_km": 7.2,
                "elevation_change_m": 170.0,
                "max_slope_deg": 14.2,
                "estimated_minutes": 172.0,
            },
        },
        "route-delta-science": {
            "route_id": "route-delta-science",
            "name": "Delta Front Astrobiology Traverse",
            "distance_km": 3.8,
            "estimated_duration_hours": 1.8,
            "max_slope_deg": 9.5,
            "elevation_gain_m": 45.0,
            "elevation_loss_m": 12.0,
            "safety_verdict": "RECOMMENDED",
            "waypoints": [
                {"sequence": 1, "lat": 18.4447, "lon": 77.4508, "label": "Hab Base Alpha"},
                {"sequence": 2, "lat": 18.4475, "lon": 77.4532, "label": "Kodiak Mesa Viewpoint"},
                {"sequence": 3, "lat": 18.4510, "lon": 77.4580, "label": "Delta Mudstone Sample Site"},
            ],
        },
    }

    def _resolve_zone(self, lat: float, lon: float) -> Optional[dict[str, Any]]:
        """Resolves region strictly by site bounds; never conflates Gale and Jezero."""
        for zone in self.ZONES.values():
            b = zone["bounds"]
            if b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]:
                return zone
        
        # DEMO_MODE fallback explicitly tagged as SAMPLE
        if settings.DEMO_MODE:
            demo_zone = dict(self.ZONES["gale_crater"])
            demo_zone["name"] = demo_zone["name"] + " [SAMPLE - DEMO_MODE]"
            return demo_zone
        
        return None


adapter = MartianDataAdapter()


# ==============================================================================
# GEMINI TOOL CALLABLE FUNCTIONS
# ==============================================================================

def get_layer_data(layer: str, lat: float, lon: float) -> dict[str, Any]:
    """Retrieve environmental and scientific data from a specific NASA mission layer.

    Args:
        layer: Layer name ('optical', 'elevation', 'slope', 'thermal', 'mineralogy', 'radiation', 'weather', 'dust', 'comms').
        lat: Martian latitude (-90.0 to 90.0).
        lon: Martian longitude (-180.0 to 180.0 or 0.0 to 360.0).

    Returns:
        A dictionary containing the mission layer measurements, units, resolution, and source citation.
    """
    layer_clean = layer.lower().strip()
    zone = adapter._resolve_zone(lat, lon)

    if zone is None:
        return {
            "layer": layer,
            "available": False,
            "status": "outside mapped regions",
            "message": f"Requested coordinates [{lat:.4f}, {lon:.4f}] lie outside mapped regions.",
        }

    # 1. Optical / Imagery
    if layer_clean in ("optical", "imagery", "hirise"):
        t_sample = terrain_engine.sample_point(lat, lon)
        return {
            "layer": "optical",
            "available": True,
            "source": "HiRISE (Mars Reconnaissance Orbiter)",
            "observation_date": "2024-02-18",
            "resolution": "0.25 m/pixel",
            "units": "radiance/reflectance",
            "value": t_sample.get("terrain_class", zone["terrain_type"]),
            "boulder_hazard": "moderate" if zone.get("roughness", 0.5) > 0.5 else "low",
        }

    # 2. Elevation / Topography
    if layer_clean in ("elevation", "mola", "topography"):
        t_sample = terrain_engine.sample_point(lat, lon)
        elev = t_sample.get("elevation_m") if t_sample.get("available") else zone["elevation_m"]
        return {
            "layer": "elevation",
            "available": True,
            "source": "MOLA / HRSC Blended DTM",
            "observation_date": "2021-09-10",
            "resolution": "50 m/pixel",
            "units": "meters relative to Martian datum",
            "value": f"Elevation {elev} m at [{lat:.4f}, {lon:.4f}]",
            "elevation_m": elev,
        }

    # 3. Slope / Gradient
    if layer_clean in ("slope", "hrsc", "gradient"):
        t_sample = terrain_engine.sample_point(lat, lon)
        slope = t_sample.get("slope_deg") if t_sample.get("available") else zone["slope_deg"]
        return {
            "layer": "slope",
            "available": True,
            "source": "HRSC Slope Map",
            "observation_date": "2021-09-10",
            "resolution": "50 m/pixel",
            "units": "degrees",
            "value": f"Maximum slope {slope}°",
            "slope_deg": slope,
            "slope_classification": "steep" if slope > 12.0 else "gentle",
        }

    # 4. Thermal
    if layer_clean in ("thermal", "themis", "thermal_inertia"):
        return {
            "layer": "thermal",
            "available": True,
            "source": "THEMIS (Mars Odyssey)",
            "observation_date": "2023-10-14",
            "resolution": "100 m/pixel",
            "units": "J m^-2 K^-1 s^-1/2",
            "value": "Thermal inertia ~340 units, characteristic of cemented duricrust rather than loose drift dust",
            "caveat": "Orbital thermal data reflects surface density and thermal inertia; it is NOT a live temperature forecast.",
        }

    # 5. Mineralogy / CRISM
    if layer_clean in ("mineralogy", "crism", "spectroscopy"):
        return {
            "layer": "mineralogy",
            "available": True,
            "source": "CRISM (Mars Reconnaissance Orbiter)",
            "observation_date": "2019-07-22",
            "resolution": "18 m/pixel",
            "units": "Spectral absorption band depth",
            "value": "Hydrated magnesium sulfates and iron smectite clays detected in Mount Sharp strata",
        }

    # 6. Radiation
    if layer_clean in ("radiation", "rad"):
        rad = radiation_engine.get_radiation_summary(lat, lon)
        return {
            "layer": "radiation",
            "available": True,
            "source": rad.get("instrument", "MSL / RAD Surface Detector"),
            "observation_date": "2022-05-30",
            "resolution": "Point detector on rover deck",
            "units": "μSv/hr",
            "value": f"Historical background surface rate ~{rad.get('dose_rate_usvh', zone['radiation_uSv_hr'])} μSv/hr",
            "dose_rate_uSv_hr": rad.get("dose_rate_usvh", zone["radiation_uSv_hr"]),
            "caveat": rad.get("historical_caveat", "Historical measurements do not predict instantaneous SPE events."),
        }

    # 7. Weather / Telemetry
    if layer_clean in ("weather", "meda", "rems"):
        env = env_engine.get_environment_at(lat, lon)
        return {
            "layer": "weather",
            "available": True,
            "source": env.get("source", "REMS / MEDA Surface Telemetry"),
            "air_temperature_c": env.get("temperature_c", zone["air_temp_c"]),
            "ground_temperature_c": env.get("ground_temp_c", zone["ground_temp_c"]),
            "wind_speed_mps": env.get("wind_speed_ms", zone["wind_speed_mps"]),
        }

    # 8. Comms
    if layer_clean in ("comms", "relay"):
        comms = comms_engine.get_comms_status(lat, lon)
        return {
            "layer": "comms",
            "available": True,
            "source": "Mars Relay Network (MRO / Odyssey)",
            "relay_satellite_visible": comms.get("dte_visible", True),
            "active_relay_name": "Mars Reconnaissance Orbiter",
        }

    return {
        "layer": layer,
        "available": False,
        "status": "data not available",
        "message": f"Requested layer '{layer}' is unmapped at [{lat}, {lon}].",
    }


def get_route_stats(route_id: str) -> dict[str, Any]:
    """Retrieve telemetry, slope analysis, and waypoint metrics for a planned EVA route.

    Args:
        route_id: Route identifier string (e.g. 'EVA-ROVERSE-01' or 'route-delta-science').
    """
    clean_id = route_id.strip().lower()
    for key, val in adapter.KNOWN_ROUTES.items():
        if key in clean_id or clean_id in key:
            return val

    # Strict error when route is not found
    return {
        "available": False,
        "error": "route not found",
        "requested_route_id": route_id,
    }


def list_hazards_near(lat: float, lon: float, radius_km: float = 5.0) -> list[dict[str, Any]]:
    """Search for environmental and topographical hazards within a given radius on Mars.
    
    Filters by true haversine distance using standardized Mars radius R = 3,389,500 m.
    """
    zone = adapter._resolve_zone(lat, lon)
    if not zone:
        return []

    hazards = zone.get("hazards", [])
    filtered: list[dict[str, Any]] = []

    for h in hazards:
        h_lat = h.get("lat")
        h_lon = h.get("lon")
        if h_lat is not None and h_lon is not None:
            dist_m = calculate_haversine_distance(lat, lon, h_lat, h_lon)
            dist_km = dist_m / 1000.0
            if dist_km <= radius_km:
                h_copy = dict(h)
                h_copy["distance_km"] = round(dist_km, 2)
                filtered.append(h_copy)
        else:
            # If coordinates are unspecified on hazard, include if within the zone
            filtered.append(h)

    return filtered


def calculate_eva_budget(
    distance_km: float,
    speed_kmh: float = 2.5,
    oxygen_hours: float = 8.0,
    power_hours: float = 7.0,
) -> dict[str, Any]:
    """Calculate reference life-support consumables based on supplied distance.
    
    Delegates to the EVA Planner engine with standardized 20% contingency,
    EVA limit, and 50% turn-around rule.
    """
    speed_ms = (speed_kmh * 1000.0) / 3600.0 if speed_kmh > 0 else 0.70
    dist_m = distance_km * 1000.0

    # Walking time (minutes)
    walk_min = (dist_m / speed_ms) / 60.0 if speed_ms > 0 else 0.0
    # Standard 20% contingency
    contingency_min = walk_min * 0.20
    total_minutes = walk_min + contingency_min
    total_hours = total_minutes / 60.0

    # Consumables
    o2_pct_consumed = round((total_hours / max(1.0, oxygen_hours)) * 100.0, 1)
    power_pct_consumed = round((total_hours / max(1.0, power_hours)) * 100.0, 1)
    o2_reserve = round(max(0.0, 100.0 - o2_pct_consumed), 1)

    # 50% Turn-around rule based on minimum available supply
    max_safe_hours = min(oxygen_hours, power_hours) * 0.50
    turn_around_mins = int(max_safe_hours * 60.0)

    return {
        "planned_distance_km": round(distance_km, 2),
        "assumed_speed_kmh": round(speed_kmh, 2),
        "walking_minutes": round(walk_min, 1),
        "contingency_minutes": round(contingency_min, 1),
        "estimated_duration_hours": round(total_hours, 2),
        "estimated_duration_minutes": round(total_minutes, 1),
        "oxygen_consumed_percent": min(100.0, o2_pct_consumed),
        "oxygen_reserve_margin_percent": o2_reserve,
        "power_consumed_percent": min(100.0, power_pct_consumed),
        "safe_turn_around_deadline_minutes": turn_around_mins,
        "simulation_disclaimer": "Reference envelope calculated via ROVERSE standardized EVA model (R=3,389,500 m).",
    }


GEMINI_MARS_TOOLS = [
    get_layer_data,
    get_route_stats,
    list_hazards_near,
    calculate_eva_budget,
]
