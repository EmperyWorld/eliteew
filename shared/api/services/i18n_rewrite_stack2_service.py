# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Backward-compatible re-export shim for stack0 admin API and legacy imports.
# Invariants:
# - Canonical implementation lives in shared/tools/i18n_rewriter/stack2_service.py.
# Related:
# - shared/tools/i18n_rewriter/stack2_service.py
# - api/routers/desktop_admin_i18n_rewrite.py
# ---

from __future__ import annotations

from api.shared_tools_path import ensure_shared_tools_import_path

ensure_shared_tools_import_path()

from i18n_rewriter.stack2_service import (  # noqa: E402
    PRESET_SPECS,
    PRESET_TARGETS,
    SingleBatchResult,
    admin_meta,
    align_rewrite_keys,
    apply_rewrites,
    build_cli_command,
    build_preview,
    build_system_prompt,
    build_user_prompt,
    call_stack2_chat,
    chunk_items,
    default_stack2_url,
    flatten_string_leaves,
    http_json,
    load_spec,
    parse_rewrites,
    placeholders_preserved,
    probe_stack2_health,
    resolve_model,
    resolve_preset_path,
    resolve_repo_root,
    run_single_batch,
    set_by_path,
    split_batch_accepted,
    validate_batch,
)

__all__ = [
    "PRESET_SPECS",
    "PRESET_TARGETS",
    "SingleBatchResult",
    "admin_meta",
    "align_rewrite_keys",
    "apply_rewrites",
    "build_cli_command",
    "build_preview",
    "build_system_prompt",
    "build_user_prompt",
    "call_stack2_chat",
    "chunk_items",
    "default_stack2_url",
    "flatten_string_leaves",
    "http_json",
    "load_spec",
    "parse_rewrites",
    "placeholders_preserved",
    "probe_stack2_health",
    "resolve_model",
    "resolve_preset_path",
    "resolve_repo_root",
    "run_single_batch",
    "set_by_path",
    "split_batch_accepted",
    "validate_batch",
]
