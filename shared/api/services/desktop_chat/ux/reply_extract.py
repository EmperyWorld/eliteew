# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parse the optional legacy JSON envelope from Desktop AI Chat solo replies.
# Invariants:
# - Never raises; malformed JSON falls back to the full user-visible text.
# - The current expert-document instruction remains backwards-compatible with callers of the legacy helper.
# Related:
# - api/services/desktop_chat/service.py
# - api/services/desktop_chat/ux/expert_reply_contract.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any

from api.services.desktop_chat.ux.expert_reply_contract import expert_reply_contract_instruction
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

logger = logging.getLogger(__name__)


def structured_solo_reply_instruction() -> str:
    """Compatibility entrypoint for the current solo expert-answer contract."""
    return expert_reply_contract_instruction(mode="solo")


def extract_visible_solo_reply(reply_raw: str) -> str:
    if not isinstance(reply_raw, str):
        return ""
    trimmed = strip_llm_thinking_prefix(strip_llm_channel_markup(reply_raw)).strip()
    if trimmed.startswith("{") and trimmed.endswith("}"):
        try:
            parsed: Any = json.loads(trimmed)
            if isinstance(parsed, Mapping) and isinstance(parsed.get("visible_reply"), str):
                visible = str(parsed.get("visible_reply") or "").strip()
                return strip_llm_thinking_prefix(strip_llm_channel_markup(visible)).strip()
        except json.JSONDecodeError:
            logger.debug("desktop_solo_reply_json_probe_failed chars=%s", len(trimmed))
    return trimmed
