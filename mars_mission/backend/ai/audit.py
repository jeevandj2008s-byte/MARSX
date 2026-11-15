"""ROVERSE Mission Commander Decision Audit Trail.

Maintains an immutable in-memory and persistent structured record of every
orchestrated decision:
- UUID
- Timestamp
- Event Type & Origin
- Inputs Hash
- Tools / Engines Called
- Tool Outputs Hash
- Safety Rules Evaluated & Fired
- Verdict (GO / CAUTION / NO-GO / ABORT)
- Provider Used & Latency (ms)
- Data Limitations

Strictly scrubs all secrets, API tokens, and private credentials before logging.
"""

from __future__ import annotations

import collections
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger("roverse.ai.audit")

# Scrubbing regexes for API keys
API_KEY_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z-_]{35}"),
    re.compile(r"gsk_[a-zA-Z0-9]{32,}"),
    re.compile(r"sk-or-v1-[a-zA-Z0-9]{64}"),
    re.compile(r"(?:api[_-]?key|secret|token)[\"']?\s*[:=]\s*[\"']?([a-zA-Z0-9_\-]{8,})[\"']?", re.IGNORECASE),
]

AUDIT_LOG_FILE = Path(__file__).resolve().parent / "decisions_audit.jsonl"


def scrub_secrets(obj: Any) -> Any:
    """Recursively scrub any potential API keys or secrets from logged payloads."""
    if isinstance(obj, str):
        sanitized = obj
        for pattern in API_KEY_PATTERNS:
            sanitized = pattern.sub("[REDACTED_SECRET]", sanitized)
        return sanitized
    elif isinstance(obj, dict):
        cleaned = {}
        for k, v in obj.items():
            if any(term in k.lower() for term in ["key", "token", "secret", "password", "authorization"]):
                cleaned[k] = "[REDACTED_SECRET]"
            else:
                cleaned[k] = scrub_secrets(v)
        return cleaned
    elif isinstance(obj, (list, tuple, set)):
        return [scrub_secrets(x) for x in obj]
    return obj


def compute_inputs_hash(data: Any) -> str:
    """Deterministic SHA-256 hash of inputs."""
    try:
        raw = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    except Exception:
        return "hash_error"


class DecisionAudit:
    def __init__(self, capacity: int = 200):
        self._capacity = capacity
        self._history: collections.deque = collections.deque(maxlen=capacity)

    def record_decision(
        self,
        event_type: str,
        inputs: dict[str, Any],
        tools_called: list[str],
        tool_outputs: dict[str, Any],
        rules_fired: list[dict[str, Any]],
        verdict: str,
        provider_used: str,
        latency_ms: float,
        data_limitations: list[str],
        decision_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Record an orchestrated decision into the audit trail."""
        dec_id = decision_id or str(uuid.uuid4())
        record = {
            "decision_id": dec_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "inputs_hash": compute_inputs_hash(inputs),
            "tools_called": tools_called,
            "tool_outputs_hash": compute_inputs_hash(tool_outputs),
            "rules_fired_count": len(rules_fired),
            "rules_fired": scrub_secrets(rules_fired),
            "verdict": verdict,
            "provider_used": provider_used,
            "latency_ms": round(latency_ms, 2),
            "data_limitations_count": len(data_limitations),
            "data_limitations": data_limitations,
        }

        self._history.append(record)

        # Write to JSONL
        try:
            with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            logger.error("Failed to append to decision audit log: %s", e)

        return record

    def list_decisions(self, limit: int = 50) -> list[dict[str, Any]]:
        """Return the most recent decisions in reverse chronological order."""
        items = list(self._history)
        items.reverse()
        return items[:limit]


decision_audit = DecisionAudit()
