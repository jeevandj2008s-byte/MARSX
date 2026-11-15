"""Curated knowledge base loader for offline deterministic generation in ROVERSE.

Loads JSON files from /backend/ai/knowledge/*.json.
Guaranteed to never fail or throw unhandled exceptions.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("roverse.ai.knowledge_base")

KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"


class KnowledgeBase:
    """In-memory repository of curated Mars scientific and operational knowledge."""

    def __init__(self) -> None:
        self._gale_crater: Dict[str, Any] = {}
        self._boxwork: Dict[str, Any] = {}
        self._health: Dict[str, Any] = {}
        self._layers: Dict[str, Any] = {}
        self._loaded = False
        self._load()

    def _load(self) -> None:
        try:
            p_gale = KNOWLEDGE_DIR / "gale_crater.json"
            if p_gale.exists():
                with open(p_gale, "r", encoding="utf-8") as f:
                    self._gale_crater = json.load(f)

            p_box = KNOWLEDGE_DIR / "boxwork_formation.json"
            if p_box.exists():
                with open(p_box, "r", encoding="utf-8") as f:
                    self._boxwork = json.load(f)

            p_health = KNOWLEDGE_DIR / "astronaut_health.json"
            if p_health.exists():
                with open(p_health, "r", encoding="utf-8") as f:
                    self._health = json.load(f)

            p_layers = KNOWLEDGE_DIR / "layers_reference.json"
            if p_layers.exists():
                with open(p_layers, "r", encoding="utf-8") as f:
                    self._layers = json.load(f)

            self._loaded = True
        except Exception as e:
            logger.error(f"Error loading knowledge base: {e}")

    @property
    def gale_crater(self) -> Dict[str, Any]:
        return self._gale_crater

    @property
    def boxwork(self) -> Dict[str, Any]:
        return self._boxwork

    @property
    def health(self) -> Dict[str, Any]:
        return self._health

    @property
    def layers(self) -> Dict[str, Any]:
        return self._layers


kb = KnowledgeBase()
