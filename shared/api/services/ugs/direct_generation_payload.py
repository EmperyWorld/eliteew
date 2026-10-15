# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Payload guard helpers for UGS direct provider execution — fail closed on empty provider output.
# Invariants:
# - Metadata-only keys must not satisfy payload presence checks.
# Related:
# - api/services/ugs/direct_generation_execute.py
# - api/services/ugs/direct_generation_execution.py
# ---
"""UGS direct generation — provider payload guards."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

_EMPTY_PROVIDER_METADATA_KEYS = frozenset(
    {
        "debug",
        "error",
        "id",
        "message",
        "metadata",
        "ok",
        "observability",
        "provider",
        "provider_resolution",
        "request_id",
        "status",
        "success",
        "timings",
        "usage",
        "xl_base",
    }
)


def provider_result_has_payload(value: Any) -> bool:
    """Return True only when provider output contains user-visible payload data."""
    if value is None or isinstance(value, bool):
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, bytes | bytearray):
        return bool(value)
    if isinstance(value, int | float | Decimal):
        return True
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key) in _EMPTY_PROVIDER_METADATA_KEYS:
                continue
            if provider_result_has_payload(item):
                return True
        return False
    if isinstance(value, list | tuple | set):
        return any(provider_result_has_payload(item) for item in value)
    return True


# Stable alias for callers that still import the underscore name.
_provider_result_has_payload = provider_result_has_payload
