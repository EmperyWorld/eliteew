# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stable JSON digests and weak ETags for desktop shell config and shell-state.
# Invariants:
# - Deterministic serialization for ETag comparison.
# Related:
# - api/routers/desktop_shell_config_routes.py
# - api/routers/desktop_shell_state_routes.py
# ---
"""Desktop shell ETag helpers."""

import hashlib
import json
from typing import Any

from pydantic import BaseModel


def _stable_json_digest(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _weak_etag_for_pydantic_model(payload: BaseModel) -> str:
    digest = hashlib.sha256(payload.model_dump_json().encode("utf-8")).hexdigest()
    return f'"{digest}"'


def _if_none_match_matches(header_value: str | None, etag_quoted: str) -> bool:
    if not header_value:
        return False
    stripped = header_value.strip()
    if stripped == "*":
        return True
    inner = etag_quoted.strip('"')
    for part in stripped.split(","):
        token = part.strip()
        if token.startswith("W/"):
            token = token[2:].strip()
        if token.startswith('"') and token.endswith('"'):
            token = token[1:-1]
        if token == inner:
            return True
    return False
