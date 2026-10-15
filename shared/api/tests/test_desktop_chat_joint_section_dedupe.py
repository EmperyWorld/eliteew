#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave A joint section dedupe / preamble strip / finalizer fail-closed path.
# Invariants:
# - Near-duplicate top-level ## sections are dropped keep-first.
# - Finalizer with repair disabled still persists deduped markdown.
# Related:
# - api.services.desktop_chat_ensemble.joint_section_dedupe
# - api.services.desktop_chat_ensemble.blueprint.artifact_finalizer
# ---
"""Wave A: joint markdown dedupe and finalizer fallback."""

from __future__ import annotations

import pytest

from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    finalize_artifact,
    validate_artifact_markdown,
)
from api.services.desktop_chat_ensemble.joint_section_dedupe import (
    dedupe_joint_markdown,
    outline_joint_section_body,
    strip_joint_history_preamble,
)


def _long_section_body(seed: str) -> str:
    # Enough meaningful tokens (>18) for overlap detection.
    items = [
        f"{seed} calculator module for finance ops",
        f"{seed} calendar sync with external providers",
        f"{seed} notes autosave into secure cloud vault",
        f"{seed} clipboard isolation from host operating system",
        f"{seed} file viewer without local downloads",
        f"{seed} task checklist for session control",
        f"{seed} quick search across open documents",
        f"{seed} dark light theme toggle accessibility",
        f"{seed} timer tracker for meeting sessions",
        f"{seed} currency converter for operational deals",
    ]
    return "\n".join(f"{i}. **Item:** {t}." for i, t in enumerate(items, start=1))


def test_strip_joint_history_preamble() -> None:
    raw = (
        "Совместный ответ участников [Макс, Виктор]: ## Реестр модулей\n\n"
        "Команда сформировала расширенный перечень из 60 уникальных позиций.\n"
        "Body stays."
    )
    out = strip_joint_history_preamble(raw)
    assert "Совместный ответ участников" not in out
    assert "Body stays" in out


def test_strip_joint_history_preamble_allows_markdown_bold() -> None:
    raw = "**Совместный ответ участников [Макс, Виктор]:**\n\n## Реестр\n\nBody stays."
    out = strip_joint_history_preamble(raw)
    assert "Совместный ответ участников" not in out
    assert out.startswith("## Реестр")
    assert "Body stays" in out


def test_outline_joint_section_body_caps_bullets() -> None:
    body = "\n".join(f"{i}. **Tool {i}:** description {i} alpha beta gamma" for i in range(1, 20))
    outline = outline_joint_section_body(body, max_bullets=5)
    assert outline.count("\n") + 1 <= 5
    assert "Tool 1" in outline
    assert "Tool 19" not in outline


def test_dedupe_joint_markdown_drops_near_duplicate_h2() -> None:
    shared = _long_section_body("shared")
    # Third section must be semantically distinct (not the same template with a new seed word).
    unique_ops = "\n".join(
        [
            "1. **Runbook:** nightly Postgres vacuum window for ai_services.",
            "2. **Alert:** Celery queue depth threshold on stack0 workers.",
            "3. **Checkpoint:** WireGuard peer parity verify before mobile OTA.",
            "4. **Rollback:** baked image tag pin when NFS line B is active.",
            "5. **Quota:** SeaweedFS bucket soft limit for chat attachments.",
            "6. **Probe:** Keycloak realm harden script after mapper change.",
            "7. **Ledger:** SSO session registry class mobile versus browser.",
            "8. **Drain:** RabbitMQ consumer restart without losing UGS jobs.",
            "9. **Shadow:** Qdrant collection recreate only after embed cutover.",
            "10. **Canary:** frontend build id mismatch forces hard reload.",
        ]
    )
    md = (
        f"## User Experience & MVP\n\n{shared}\n\n---\n\n"
        f"## System & Integration\n\n{shared}\n\n---\n\n"
        f"## Operational Discipline\n\n{unique_ops}"
    )
    cleaned, notes = dedupe_joint_markdown(md)
    assert any(n.startswith("dropped_duplicate_section:") for n in notes)
    assert cleaned.count("## ") == 2
    assert "User Experience" in cleaned
    assert "Operational Discipline" in cleaned
    assert "System & Integration" not in cleaned
    assert "Postgres vacuum" in cleaned


@pytest.mark.asyncio
async def test_finalize_artifact_dedupes_when_repair_disabled() -> None:
    shared = _long_section_body("panel")
    draft = f"## Alpha Zone\n\n{shared}\n\n---\n\n## Beta Zone\n\n{shared}"
    # Confirm validator would flag duplicates without dedupe.
    pre = validate_artifact_markdown(
        draft,
        artifact_type="team_response",
        required_sections=[],
        source_registry=[],
        user_request="list apps",
    )
    assert any(v.startswith("duplicate_sections:") for v in pre)

    result = await finalize_artifact(
        draft=draft,
        user_request="list apps",
        artifact_type="team_response",
        required_sections=[],
        quality_rubric=[],
        source_registry=[],
        model="test-model",
        defaults={"ensemble_artifact_repair_enabled": False},
    )
    assert result.markdown.count("## ") == 1
    assert "Alpha Zone" in result.markdown
    assert "Beta Zone" not in result.markdown
    assert not any(str(v).startswith("duplicate_sections:") for v in result.violations)
