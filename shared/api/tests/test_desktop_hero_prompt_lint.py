# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prompt lint gate for Desktop AI hero kernels and composed mode prompts.
# Invariants:
# - Every catalog hero kernel includes truth/boundary guard blocks.
# - Composed solo prompts stay within max-size budget.
# Related:
# - api/services/desktop_chat_ensemble/heroes_prompt_data.py
# - api/services/desktop_chat/prompt_compose.py
# ---
"""Regression lint for desktop hero prompts (CI-friendly pytest gate)."""

from __future__ import annotations

import re

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat.prompt_compose import compose_desktop_system_prompt_with_meta
from api.services.desktop_chat_ensemble.heroes_prompt_data import (
    HERO_PROMPT_KERNEL,
    HERO_PROMPT_VERSION,
)
from api.services.desktop_chat_ensemble.settings import ALLOWED_DESKTOP_HERO_IDS

_FORBIDDEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"#\s*TODO\b", re.IGNORECASE),
    re.compile(r"FIXME", re.IGNORECASE),
    re.compile(r"pass\s*#\s*implement", re.IGNORECASE),
)

_MAX_COMPOSED_SOLO_PROMPT_CHARS = 12_000


@pytest.mark.parametrize("hero_id", ALLOWED_DESKTOP_HERO_IDS)
def test_hero_kernel_has_required_guard_blocks(hero_id: str) -> None:
    kernel = HERO_PROMPT_KERNEL.get(hero_id, "")
    assert kernel.strip(), f"missing kernel for {hero_id}"
    assert "Правда:" in kernel
    assert "Границы:" in kernel
    for pattern in _FORBIDDEN_PATTERNS:
        assert not pattern.search(kernel), f"{hero_id} kernel matches {pattern.pattern}"


@pytest.mark.parametrize("hero_id", ALLOWED_DESKTOP_HERO_IDS)
def test_hero_has_prompt_version(hero_id: str) -> None:
    assert hero_id in HERO_PROMPT_VERSION
    assert HERO_PROMPT_VERSION[hero_id] >= 1


@pytest.mark.parametrize("hero_id", ALLOWED_DESKTOP_HERO_IDS)
def test_composed_solo_prompt_within_size_budget(hero_id: str) -> None:
    prompt, meta = compose_desktop_system_prompt_with_meta(
        hero_id=hero_id,
        mode="solo",
        defaults={"default_system_prompt": "fallback", "tools_image_enabled": True},
        use_tools=True,
    )
    assert len(prompt) <= _MAX_COMPOSED_SOLO_PROMPT_CHARS
    assert meta.get("desktop_prompt_hash")
    assert meta.get("desktop_prompt_mode") == "solo"
