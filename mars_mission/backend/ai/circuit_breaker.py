"""Circuit breaker and provider health state management for ROVERSE.

Tracks:
1. Consecutive failures (3 failures -> circuit opens for 60s).
2. Session disabled flag (e.g. on 401/403 invalid API keys).
3. Configured and verified model lists.
4. Error masking: never logs or exposes API keys or raw secrets.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Dict, List, Literal, Optional

from .config import settings
from .schemas import ProviderStatus

logger = logging.getLogger("roverse.ai.circuit_breaker")


def mask_secret(secret: str) -> str:
    """Mask a secret showing only the first 4 and last 4 characters."""
    if not secret:
        return "[NOT CONFIGURED]"
    if len(secret) <= 8:
        return "***"
    return f"{secret[:4]}...{secret[-4:]}"



class ProviderCircuit:
    """State tracker for an individual AI provider."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.consecutive_failures: int = 0
        self.last_failure_time: float = 0.0
        self.disabled: bool = False  # e.g. 401/403 invalid key
        self.last_error: Optional[str] = None
        self.configured_models: List[str] = []
        self.verified_models: List[str] = []

    @property
    def circuit_state(self) -> Literal["closed", "open", "disabled"]:
        if self.disabled:
            return "disabled"
        if self.consecutive_failures >= settings.CIRCUIT_BREAKER_FAILURES:
            elapsed = time.time() - self.last_failure_time
            if elapsed < settings.CIRCUIT_BREAKER_RESET_SECONDS:
                return "open"
            # Cooldown passed, allow probe (half-open)
            return "closed"
        return "closed"

    @property
    def state(self) -> Literal["closed", "open", "disabled"]:
        return self.circuit_state

    @property
    def is_available(self) -> bool:
        """Returns True if the provider is eligible to be called."""
        if self.disabled:
            return False
        if self.circuit_state == "open":
            return False
        return True

    def record_success(self) -> None:
        """Resets consecutive failures on successful response."""
        self.consecutive_failures = 0
        self.last_error = None

    def record_failure(self, error_message: str, is_auth_error: bool = False) -> None:
        """Records a failure. If auth error (401/403), disables provider for session."""
        self.consecutive_failures += 1
        self.last_failure_time = time.time()
        self.last_error = self._sanitize_error(error_message)

        if is_auth_error:
            self.disabled = True
            logger.warning(
                f"Provider '{self.name}' disabled for session due to authentication error: {self.last_error}"
            )
        else:
            logger.warning(
                f"Provider '{self.name}' failure #{self.consecutive_failures}: {self.last_error}"
            )

    def _sanitize_error(self, err: str) -> str:
        """Strip possible keys, tokens, or raw paths from error text."""
        # Mask any string resembling an API key (e.g. gsk_..., sk-or-..., AIza...)
        import re
        sanitized = re.sub(r"(gsk_[A-Za-z0-9_-]{20,})", "gsk_***", str(err))
        sanitized = re.sub(r"(sk-or-[A-Za-z0-9_-]{20,})", "sk-or-***", sanitized)
        sanitized = re.sub(r"(sk-[A-Za-z0-9_-]{20,})", "sk-***", sanitized)
        sanitized = re.sub(r"(AIza[A-Za-z0-9_-]{20,})", "AIza***", sanitized)
        return sanitized[:300]


class CircuitBreakerManager:
    """Central registry of circuit states for all configured providers."""

    def __init__(self) -> None:
        self.circuits: Dict[str, ProviderCircuit] = {}

    def get_circuit(self, name: str) -> ProviderCircuit:
        clean_name = name.strip().lower()
        if clean_name not in self.circuits:
            self.circuits[clean_name] = ProviderCircuit(clean_name)
        return self.circuits[clean_name]

    def is_available(self, name: str) -> bool:
        return self.get_circuit(name).is_available

    def record_success(self, name: str) -> None:
        self.get_circuit(name).record_success()

    def record_failure(self, name: str, error_msg: str, is_auth_error: bool = False) -> None:
        self.get_circuit(name).record_failure(error_msg, is_auth_error=is_auth_error)

    def get_all_status(self, configured_providers: Dict[str, bool]) -> Dict[str, ProviderStatus]:
        status_dict: Dict[str, ProviderStatus] = {}
        for name, circuit in self.circuits.items():
            status_dict[name] = ProviderStatus(
                name=name,
                configured=configured_providers.get(name, False),
                healthy=circuit.circuit_state == "closed",
                circuit_state=circuit.circuit_state,
                configured_models=circuit.configured_models,
                verified_models=circuit.verified_models,
                last_error=circuit.last_error,
            )
        return status_dict


circuit_manager = CircuitBreakerManager()
