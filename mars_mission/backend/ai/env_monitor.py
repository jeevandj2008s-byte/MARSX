"""ROVERSE Environmental Continuous Monitor.

Monitors atmospheric, thermal, dust optical depth, radiation, and comms telemetry.
Detects significant changes, alerts the orchestrator, and powers both the
GET /api/ai/environment/snapshot and GET /api/ai/environment/stream endpoints.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

from .engines.comms import comms_engine
from .engines.environment import env_engine
from .engines.radiation import radiation_engine

logger = logging.getLogger("roverse.ai.env_monitor")

# Event subscribers for SSE
_SUBSCRIBERS: list[asyncio.Queue] = []


class EnvironmentMonitor:
    def __init__(self):
        self._last_snapshot: dict[str, Any] = {}
        self._thresholds = {
            "temp_change_c": 5.0,
            "wind_change_ms": 3.0,
            "dust_tau_change": 0.20,
            "radiation_rate_change_usvh": 10.0,
        }

    def get_snapshot(self, lat: float = -4.68, lon: float = 137.38, site: str = "gale") -> dict[str, Any]:
        """Produce an immediate comprehensive environmental telemetry snapshot."""
        env_data = env_engine.get_environment_at(lat, lon)
        rad_data = radiation_engine.get_radiation_summary(lat, lon)
        comms_data = comms_engine.get_comms_status(lat, lon)

        # Measures to follow
        measures = env_engine.get_curated_measures(env_data)

        # Calculate composite staleness and confidence
        staleness_seconds = env_data.get("staleness_seconds", 0)
        confidence = 0.95
        if staleness_seconds > 86400:
            confidence = 0.70
        elif staleness_seconds > 43200:
            confidence = 0.85

        snapshot = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "site": site,
            "coordinates": {"lat": lat, "lon": lon},
            "confidence": confidence,
            "temperature": {
                "air_c": env_data.get("temperature_c"),
                "ground_c": env_data.get("ground_temp_c"),
                "status": "Observed",
                "source": env_data.get("source"),
                "date": env_data.get("timestamp"),
                "age_hours": round(staleness_seconds / 3600.0, 1),
            },
            "wind": {
                "speed_ms": env_data.get("wind_speed_ms"),
                "status": "Observed",
                "source": env_data.get("source"),
                "date": env_data.get("timestamp"),
            },
            "dust": {
                "optical_depth_tau": env_data.get("dust_optical_depth_tau"),
                "status": "Derived",
                "source": env_data.get("source"),
            },
            "pressure": {
                "kpa": env_data.get("pressure_kpa"),
                "status": "Observed",
                "source": env_data.get("source"),
            },
            "radiation": {
                "dose_rate_usvh": rad_data.get("dose_rate_usvh"),
                "status": rad_data.get("status"),
                "instrument": rad_data.get("instrument"),
                "historical_caveat": rad_data.get("historical_caveat"),
            },
            "comms": {
                "dte_visible": comms_data.get("dte_visible"),
                "active_relays": comms_data.get("active_relays"),
                "next_pass_min": comms_data.get("next_pass_min"),
                "light_delay_sec": comms_data.get("light_delay_sec"),
            },
            "measures_to_follow": measures,
            "caveats": env_data.get("caveats", []) + [rad_data.get("historical_caveat", "")],
            "data_limitations": [
                "Orbital thermal data is not a real-time weather forecast.",
                "Historical RAD measurements do not predict instantaneous solar particle events (SPE).",
                "Direct line-of-sight to Earth (DTE) requires planetary orientation alignment.",
            ],
            "simulation_notice": "Simulation data only. Not certified for flight operations.",
        }

        self._last_snapshot = snapshot
        return snapshot

    async def broadcast_alert(self, alert_type: str, message: str, payload: dict[str, Any]):
        """Broadcast an alert event to all SSE subscribers."""
        event = {
            "type": alert_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "data": payload,
        }
        dead_queues = []
        for q in _SUBSCRIBERS:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead_queues.append(q)
            except Exception:
                dead_queues.append(q)

        for dq in dead_queues:
            if dq in _SUBSCRIBERS:
                _SUBSCRIBERS.remove(dq)

    async def event_generator(self) -> AsyncGenerator[str, None]:
        """Async generator yielding SSE formatted strings to a connected client."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        _SUBSCRIBERS.append(queue)

        # Send initial snapshot immediately
        snapshot = self.get_snapshot()
        init_event = json.dumps({"type": "snapshot", "data": snapshot})
        yield f"data: {init_event}\n\n"

        try:
            while True:
                try:
                    # Wait for next event or send ping every 15s to keep connection alive
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    heartbeat = json.dumps({
                        "type": "heartbeat",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    yield f"data: {heartbeat}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in _SUBSCRIBERS:
                _SUBSCRIBERS.remove(queue)


env_monitor = EnvironmentMonitor()
