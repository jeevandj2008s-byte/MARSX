"""Configuration settings for ROVERSE Mars Mission Planning AI Integration.

Loads settings from environment variables and .env file.
API keys and secrets remain strictly server-side.
Never crashes on missing keys or unconfigured providers.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load .env file from the repo root and backend directory
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent

root_env = ROOT_DIR / ".env"
backend_env = BACKEND_DIR / ".env"

if root_env.exists():
    load_dotenv(dotenv_path=root_env)
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
load_dotenv()


class AISettings:
    """Comprehensive settings for Multi-Provider AI Fallback Chain."""

    # --------------------------------------------------------------------------
    # Provider Chain Order
    # --------------------------------------------------------------------------
    AI_PROVIDER_ORDER_RAW: str = os.getenv(
        "AI_PROVIDER_ORDER", "gemini,groq,openrouter,ollama,offline"
    )

    @property
    def AI_PROVIDER_ORDER(self) -> List[str]:
        return [
            p.strip().lower()
            for p in self.AI_PROVIDER_ORDER_RAW.split(",")
            if p.strip()
        ]

    # Legacy provider flag
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "gemini").strip().lower()

    # --------------------------------------------------------------------------
    # 1. Google Gemini
    # --------------------------------------------------------------------------
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
    GEMINI_FALLBACK_MODEL: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash").strip()

    # --------------------------------------------------------------------------
    # 2. Groq (OpenAI-compatible)
    # --------------------------------------------------------------------------
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()
    GROQ_MODEL_2: str = os.getenv("GROQ_MODEL_2", "openai/gpt-oss-20b").strip()

    @property
    def GROQ_MODELS(self) -> List[str]:
        models = []
        if self.GROQ_MODEL:
            models.append(self.GROQ_MODEL)
        if self.GROQ_MODEL_2 and self.GROQ_MODEL_2 != self.GROQ_MODEL:
            models.append(self.GROQ_MODEL_2)
        return models or ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    # --------------------------------------------------------------------------
    # 3. OpenRouter (OpenAI-compatible)
    # --------------------------------------------------------------------------
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "").strip()
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip()
    OPENROUTER_MODELS_RAW: str = os.getenv(
        "OPENROUTER_MODELS",
        "openai/gpt-oss-120b:free,google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,openrouter/free",
    )

    @property
    def OPENROUTER_MODELS(self) -> List[str]:
        return [
            m.strip()
            for m in self.OPENROUTER_MODELS_RAW.split(",")
            if m.strip()
        ]

    # OpenRouter App-attribution headers
    APP_HTTP_REFERER: str = os.getenv(
        "APP_HTTP_REFERER", "https://github.com/nasa-spaceapps-2026/roverse"
    )
    APP_TITLE: str = os.getenv(
        "APP_TITLE", "ROVERSE Mars Exploration Planning System"
    )

    # --------------------------------------------------------------------------
    # 4. Mistral (Optional OpenAI-compatible)
    # --------------------------------------------------------------------------
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "").strip()
    MISTRAL_BASE_URL: str = os.getenv("MISTRAL_BASE_URL", "https://api.mistral.ai/v1").strip()
    MISTRAL_MODEL: str = os.getenv("MISTRAL_MODEL", "mistral-small-latest").strip()

    # --------------------------------------------------------------------------
    # 5. Ollama (Optional Local Offline)
    # --------------------------------------------------------------------------
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4").strip()

    # Legacy local compatibility
    LOCAL_AI_BASE_URL: str = os.getenv("LOCAL_AI_BASE_URL", "http://localhost:11434/v1").strip()
    LOCAL_AI_MODEL: str = os.getenv("LOCAL_AI_MODEL", "gemma-4-mars").strip()

    # --------------------------------------------------------------------------
    # Server & Operational Settings
    # --------------------------------------------------------------------------
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]

    # Presentation / Hackathon Reliability Mode
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

    # --------------------------------------------------------------------------
    # Reliability, Budgets & Circuit Breaker Settings
    # --------------------------------------------------------------------------
    REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "15.0"))
    OVERALL_REQUEST_BUDGET_SECONDS: float = float(os.getenv("OVERALL_REQUEST_BUDGET_SECONDS", "20.0"))
    CIRCUIT_BREAKER_FAILURES: int = int(os.getenv("CIRCUIT_BREAKER_FAILURES", "3"))
    CIRCUIT_BREAKER_RESET_SECONDS: float = float(os.getenv("CIRCUIT_BREAKER_RESET_SECONDS", "60.0"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "1"))
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
    MAX_INPUT_LENGTH: int = int(os.getenv("MAX_INPUT_LENGTH", "5000"))


settings = AISettings()
