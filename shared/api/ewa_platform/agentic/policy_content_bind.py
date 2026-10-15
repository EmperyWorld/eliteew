# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bind created unified_content_id into agentic session policy so the driver
# READ/observe path sees blocks after direct (non-HITL) file_create success.
# Invariants:
# - Same policy key as HITL finalize: ``policy_json.unified_content_id``.
# Related:
# - api/ewa_platform/agentic/hitl_companion_finalize.py
# - api/ewa_platform/agentic/driver/ewa_agentic_driver.py
# - documentation/product/ewa/EWA-COMPANION-MEMORY-EFFECTIVENESS-PLAN.md (Wave F2)
# ---
"""Patch session policy after agentic document create."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def policy_json_with_created_content(
    policy_json: Mapping[str, Any] | None,
    *,
    created_content_id: str,
) -> dict[str, Any]:
    """Return a copy of policy with ``unified_content_id`` set for driver targeting."""

    cid = str(created_content_id or "").strip()
    out = dict(policy_json) if isinstance(policy_json, Mapping) else {}
    if cid:
        out["unified_content_id"] = cid
    return out


__all__ = ("policy_json_with_created_content",)
