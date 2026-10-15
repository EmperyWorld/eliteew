# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA companion prompt-block plane: code canon defaults, Postgres-backed overrides, and turn-time loader.
# Invariants:
# - Resolution: non-empty DB body → else code canon. Empty/missing DB never raises for chat path.
# - Computed blocks (tool catalog) are never stored as free prose edits.
# Related:
# - documentation/product/ewa/EWA-COMPANION-PROMPT-BLOCKS.md
# ---
"""EWA companion prompt blocks package."""

from api.ewa_platform.companion.prompt_blocks.service import (
    bootstrap_prompt_blocks,
    clear_prompt_block_cache,
    get_prompt_block,
    list_prompt_block_specs,
    reload_prompt_blocks,
    update_prompt_block,
)
from api.ewa_platform.companion.prompt_blocks.tool_catalog_md import format_server_tool_catalog_markdown

__all__ = (
    "bootstrap_prompt_blocks",
    "clear_prompt_block_cache",
    "format_server_tool_catalog_markdown",
    "get_prompt_block",
    "list_prompt_block_specs",
    "reload_prompt_blocks",
    "update_prompt_block",
)
