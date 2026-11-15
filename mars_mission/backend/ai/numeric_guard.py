"""Numeric Grounding Guard.

Enforces Core Rule 2:
Every number in LLM-generated narrative text must be grounded in the deterministic
tool/engine outputs for that request (tolerating minor rounding, units, formatting).
If any ungrounded/invented number is detected, the LLM text is discarded and the
deterministic template text is used instead.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any, Iterable

logger = logging.getLogger("roverse.ai.numeric_guard")

# Regex to match floating point and integer numbers in text, including negative signs,
# percentages, and degree symbols, but ignoring ISO timestamps (e.g. 2026-11-15T...).
NUMBER_REGEX = re.compile(
    r"(?<![a-zA-Z0-9_\-\:])"              # Not preceded by word chars or dashes (like in dates or IDs)
    r"([+\-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)" # Matches 1,234.56 or 1234.56 or -4.68
    r"(?:%|°|deg|km|m|m/s|min|h|hr|hrs|kPa|µSv/hr|uSv/hr|bpm)?" # optional units
    r"(?![a-zA-Z0-9_\-\:])"
)

# Harmless numbers that frequently appear as structural or grammar tokens (e.g. "step 1", "2 waypoints", "zero")
TRIVIAL_NUMBERS = {0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 2026.0}


def extract_numbers_from_text(text: str) -> list[float]:
    """Extract all candidate numeric values from plain narrative text."""
    if not text:
        return []
    
    # Strip known markdown/ISO dates like 2026-11-15 or Sol-1234
    sanitized = re.sub(r"\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?\b", " ", text)
    sanitized = re.sub(r"\b(?:Sol|sol)[\-\s]\d+\b", " ", sanitized)
    # Strip waypoint IDs like WP-1, WP01, Segment 1
    sanitized = re.sub(r"\b(?:WP|wp|WP-|wp-)\d+\b", " ", sanitized)
    
    found: list[float] = []
    for match in NUMBER_REGEX.finditer(sanitized):
        val_str = match.group(1).replace(",", "")
        try:
            val = float(val_str)
            if math.isfinite(val):
                found.append(val)
        except ValueError:
            continue
    return found


def extract_numbers_from_data(data: Any) -> set[float]:
    """Recursively collect all numeric values present in tool/engine outputs.
    
    Includes standard unit variants (e.g. m <-> km, hours <-> minutes, fractions <-> percents).
    """
    numbers: set[float] = set()

    def _traverse(item: Any):
        if item is None:
            return
        if isinstance(item, (int, float)):
            if math.isfinite(item):
                f = float(item)
                numbers.add(f)
                # Expand standard unit transformations to avoid false positives:
                # 1. km <-> m
                numbers.add(f * 1000.0)
                numbers.add(f / 1000.0)
                # 2. hours <-> minutes
                numbers.add(f * 60.0)
                numbers.add(f / 60.0)
                # 3. fraction <-> percentage
                numbers.add(f * 100.0)
                numbers.add(f / 100.0)
                # 4. absolute value
                numbers.add(abs(f))
        elif isinstance(item, str):
            # Also extract numbers explicitly embedded in data strings (e.g. "14.2°", "6.57 km")
            for sub_val in extract_numbers_from_text(item):
                _traverse(sub_val)
        elif isinstance(item, dict):
            for k, v in item.items():
                # Avoid treating object IDs or keys as ground truth numbers unless they are metrics
                _traverse(v)
        elif isinstance(item, (list, tuple, set)):
            for v in item:
                _traverse(v)

    _traverse(data)
    return numbers


def is_number_grounded(
    candidate: float,
    ground_truth_numbers: set[float],
    abs_tol: float = 0.5,
    rel_tol: float = 0.05,
) -> bool:
    """Check if candidate matches any number in ground truth within tolerance."""
    if candidate in TRIVIAL_NUMBERS:
        return True
    
    cand_abs = abs(candidate)
    for gt in ground_truth_numbers:
        gt_abs = abs(gt)
        # Direct match or absolute tolerance for small values
        if math.isclose(cand_abs, gt_abs, rel_tol=rel_tol, abs_tol=abs_tol):
            return True
        # Check rounded to integer or 1 decimal place
        if round(cand_abs, 1) == round(gt_abs, 1):
            return True
        if round(cand_abs) == round(gt_abs):
            return True

    return False


def validate_numeric_grounding(
    narrative_text: str,
    tool_outputs: Any,
    deterministic_fallback: str,
    abs_tol: float = 0.5,
    rel_tol: float = 0.05,
) -> tuple[str, bool, list[str]]:
    """Validate that every number in narrative_text is grounded in tool_outputs.
    
    Returns:
        (text, passed, violations)
        If passed is False, returns (deterministic_fallback, False, violations).
    """
    if not narrative_text:
        return (deterministic_fallback, True, [])

    gt_numbers = extract_numbers_from_data(tool_outputs)
    cand_numbers = extract_numbers_from_text(narrative_text)

    violations: list[str] = []
    for num in cand_numbers:
        if not is_number_grounded(num, gt_numbers, abs_tol=abs_tol, rel_tol=rel_tol):
            violations.append(f"Ungrounded number in LLM text: {num}")

    if violations:
        logger.warning(
            "Numeric grounding guard triggered! %d ungrounded numbers found. Discarding LLM text and falling back to deterministic template.",
            len(violations),
        )
        for v in violations[:5]:
            logger.warning("  - %s", v)
        return (deterministic_fallback, False, violations)

    return (narrative_text, True, [])
