# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared OpenAPI response helpers for StreamingResponse routes so text/event-stream
# documents named payload schemas (Wave B5) instead of opaque {}.
# Invariants:
# - Registers Pydantic models into components via FastAPI ``responses[].model``.
# - Does not change wire framing (SSE ``event:`` / ``data:``).
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (Wave B5)
# ---
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


def event_stream_openapi_responses(
    *,
    model: type[BaseModel],
    description: str,
) -> dict[int | str, dict[str, Any]]:
    """Build FastAPI ``responses=`` so OpenAPI keeps ``text/event-stream`` + named $ref."""

    name = model.__name__
    return {
        200: {
            "model": model,
            "description": description,
            "content": {
                "text/event-stream": {
                    "schema": {"$ref": f"#/components/schemas/{name}"},
                }
            },
        }
    }
