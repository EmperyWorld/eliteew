# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Neutral i18n rewrite package (stdlib-only stack2 batch tooling); not EliteEW or DEWA.
# Invariants:
# - No imports from api.* / EliteEW / DEWA application trees.
# Related:
# - stack2_service.py, documentation/platform/I18N-REWRITE-STACK2.md
# ---
from i18n_rewriter.stack2_service import (
    PRESET_SPECS,
    PRESET_TARGETS,
    admin_meta,
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
    resolve_preset_path,
    resolve_repo_root,
    run_single_batch,
    validate_batch,
)

__all__ = [
    "PRESET_SPECS",
    "PRESET_TARGETS",
    "admin_meta",
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
    "resolve_preset_path",
    "resolve_repo_root",
    "run_single_batch",
    "validate_batch",
]
