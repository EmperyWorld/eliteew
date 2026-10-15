# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Aggregator mounts desktop shell config + shell-state child routers; re-exports for desktop_shell.py and tests.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop`` router via ``desktop_shell.py``.
# - No route handlers in this module — pure orchestration layer.
# Related:
# - api/routers/desktop_shell_config_routes.py
# - api/routers/desktop_shell_state_routes.py
# - api/routers/desktop_shell.py (parent aggregator)
# ---
"""Desktop shell config + shell-state aggregator."""

from fastapi import APIRouter
from sqlalchemy.orm.attributes import flag_modified

from api.routers import desktop_shell_config_routes as _config_routes
from api.routers import desktop_shell_state_routes as _state_routes
from api.services.desktop_shell_state_idempotency import (
    claim_shell_state_idempotency_key,
    get_shell_state_idempotent_response,
    normalize_shell_state_idempotency_key,
    release_shell_state_idempotency_claim,
    remember_shell_state_idempotent_response,
)

router = APIRouter(tags=["desktop"])
router.include_router(_config_routes.router)
router.include_router(_state_routes.router)

from api.routers.desktop_shell_config_routes import (  # noqa: E402
    DesktopConfigCreate,
    DesktopConfigResponse,
    DesktopConfigUpdate,
    Position,
    _get_desktop_user_id,
    _get_or_create_desktop_config_row,
    load_desktop_config_response,
    validate_window_instance_policy,
)
from api.routers.desktop_shell_etag import (  # noqa: E402
    _if_none_match_matches,
    _weak_etag_for_pydantic_model,
)
from api.routers.desktop_shell_state_routes import (  # noqa: E402
    SHELL_STATE_FIELD_ETAGS_HEADER,
    SHELL_STATE_IF_MATCH_FIELDS_HEADER,
    DesktopShellStateOut,
    DesktopShellStatePatch,
    _lock_desktop_config_row_for_update,
    _normalize_shell_state,
    _raise_if_shell_state_etag_conflict,
    _set_shell_state_etag_headers,
    _shell_state_field_etags,
    _shell_state_to_out,
    get_shell_state,
    patch_shell_state,
)
from api.routers.desktop_shell_state_sanitize import MAX_WINDOWS_SNAPSHOT_WINDOWS  # noqa: E402

__all__ = [
    "MAX_WINDOWS_SNAPSHOT_WINDOWS",
    "SHELL_STATE_FIELD_ETAGS_HEADER",
    "SHELL_STATE_IF_MATCH_FIELDS_HEADER",
    "DesktopConfigCreate",
    "DesktopConfigResponse",
    "DesktopConfigUpdate",
    "DesktopShellStateOut",
    "DesktopShellStatePatch",
    "Position",
    "_get_or_create_desktop_config_row",
    "_get_desktop_user_id",
    "_if_none_match_matches",
    "_lock_desktop_config_row_for_update",
    "_normalize_shell_state",
    "_raise_if_shell_state_etag_conflict",
    "_set_shell_state_etag_headers",
    "_shell_state_field_etags",
    "_shell_state_to_out",
    "_weak_etag_for_pydantic_model",
    "claim_shell_state_idempotency_key",
    "flag_modified",
    "get_shell_state",
    "get_shell_state_idempotent_response",
    "load_desktop_config_response",
    "normalize_shell_state_idempotency_key",
    "patch_shell_state",
    "release_shell_state_idempotency_claim",
    "remember_shell_state_idempotent_response",
    "router",
    "validate_window_instance_policy",
]
