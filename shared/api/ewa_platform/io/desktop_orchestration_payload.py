# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional **backward-compatible extensions** inside ``ewa_desktop_orchestration_v1`` ``payload``
# (e.g. ``metadata.companion``) for client hints tied to companion profile versioning.
# Invariants:
# - Unknown keys tolerated at ``metadata`` top-level except ``companion``.
# - Malformed companion blocks never fail the HTTP turn — they are dropped with diagnostics only via ``warnings``.
# Related:
# - api/ewa_platform/schemas/json/desktop_orchestration_companion_metadata_v1.json (`$defs` wire shape)
# - api/ewa_platform/gateways/desktop_http.py
# - shared/api/ewa_platform/desktop/runtime.py
# - api/ewa_platform/schemas/pydantic/companion.py (canonical seed catalogue)
# ---
"""Desktop orchestration turn payload normalization (safe extensions)."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.schemas.pydantic.companion import validate_seed

logger = logging.getLogger(__name__)


def normalize_desktop_orchestration_turn_companion_hints(
    payload: Mapping[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Extract ``payload.metadata.companion`` hints for SSE / persistence echo.

    Returns ``(hints, warnings)`` where hints may be empty dict.
    Accepted keys inside ``metadata.companion``:

    - ``seed_persona_id`` (alias ``client_seed_persona_id``), catalog id only.

    - ``expect_companion_revision`` — positive integer; ignored when malformed.
    """

    warnings: list[str] = []
    raw_meta = payload.get("metadata")
    if raw_meta is None:
        return {}, warnings
    if not isinstance(raw_meta, Mapping):
        warnings.append("metadata_not_object_skipped")
        return {}, warnings
    companion = raw_meta.get("companion")
    if companion is None:
        return {}, warnings
    if not isinstance(companion, Mapping):
        warnings.append("metadata.companion_not_object_skipped")
        return {}, warnings

    out: dict[str, Any] = {}

    sid_raw = companion.get("seed_persona_id")
    if sid_raw is None:
        sid_raw = companion.get("client_seed_persona_id")
    if sid_raw is not None:
        if isinstance(sid_raw, str):
            sid = sid_raw.strip()
            if sid:
                try:
                    out["seed_persona_id"] = validate_seed(sid)
                except ValueError:
                    warnings.append("metadata.companion_invalid_seed_persona_id")
        else:
            warnings.append("metadata.companion_seed_persona_id_not_string")

    exp_raw = companion.get("expect_companion_revision")
    if exp_raw is not None:
        if isinstance(exp_raw, bool):
            warnings.append("metadata.companion_expect_revision_bool_skipped")
        elif isinstance(exp_raw, int) and exp_raw >= 1:
            out["expect_companion_revision"] = int(exp_raw)
        else:
            try:
                n = int(str(exp_raw).strip())
            except ValueError:
                warnings.append("metadata.companion_expect_revision_not_int_skipped")
            else:
                if n >= 1:
                    out["expect_companion_revision"] = n
                else:
                    warnings.append("metadata.companion_expect_revision_not_positive_skipped")

    allowed_cm_keys = frozenset({"seed_persona_id", "client_seed_persona_id", "expect_companion_revision"})
    extra_cm = set(companion) - allowed_cm_keys
    if extra_cm:
        logger.debug(
            "[EWA orch] ignoring unknown companion metadata keys: %s",
            sorted(extra_cm),
        )
    return out, warnings
