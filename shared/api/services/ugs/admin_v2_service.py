# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Import-stable facade for UGS Admin v2 service helpers; implementation lives in admin_v2_* modules.
# Invariants:
# - Public async entrypoints remain importable from this module for routers and tests.
# Related:
# - shared/api/routers/ugs_admin.py (v2 endpoints)
# - shared/api/schemas/ugs_admin.py (v2 DTOs)
# ---

from __future__ import annotations

from api.services.ugs.admin_v2_apply import apply_operations
from api.services.ugs.admin_v2_autofix import build_autofix_recommendations
from api.services.ugs.admin_v2_dry_run import apply_ops_dry_run
from api.services.ugs.admin_v2_snapshot import build_snapshot
from api.services.ugs.admin_v2_state import (
    ApplyOperationsResult,
    _merge_model_routes,
    _model_routes_patch_result_entries,
    _setting_natural_key,
    _State,
)
from api.services.ugs.admin_v2_validate_ops import validate_operations
from api.services.ugs.admin_v2_validation import validate_model_routes, validate_state

__all__ = [
    "ApplyOperationsResult",
    "_State",
    "_merge_model_routes",
    "_model_routes_patch_result_entries",
    "_setting_natural_key",
    "apply_ops_dry_run",
    "apply_operations",
    "build_autofix_recommendations",
    "build_snapshot",
    "validate_model_routes",
    "validate_operations",
    "validate_state",
]
