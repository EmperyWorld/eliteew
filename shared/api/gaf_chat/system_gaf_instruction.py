# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# System GAF instruction template: DB row validation plus safe desktop open-app component metadata.
# Invariants:
# - `ALLOWED_DESKTOP_APP_COMPONENTS` is loaded from EliteEW/shared/assistant_desktop_link_components.json.
# - Only known desktop app components can be embedded into service-message metadata.
# Related:
# - EliteEW/shared/assistant_desktop_link_components.json
# - shared/web/frontend/src/pages/Desktop/utils/assistantDesktopLinkComponents.ts
# ---
"""System GAF instruction template: DB row, validation, body + metadata for service messages."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.gaf_chat.assistant_desktop_link_manifest import (
    assistant_app_components,
    assistant_shell_link_components,
)

ALLOWED_DESKTOP_APP_COMPONENTS: frozenset[str] = assistant_app_components()
ASSISTANT_SHELL_LINK_COMPONENTS: frozenset[str] = assistant_shell_link_components()

_MAX_WELCOME_THANKS = 8000
_MAX_STEP_TITLE = 500
_MAX_STEP_BODY = 8000
_MAX_STEPS = 30


def normalize_instruction_locale(locale: str | None) -> str:
    """Map admin/UI locale tag to a ``system_gaf_instruction`` row key."""
    if locale and locale.strip().lower().startswith("en"):
        return "en"
    return "ru"


def instruction_locale_from_user_preferences(preferences: Any) -> str:
    """Map ``users.preferences`` JSON (``language`` field) to ru/en template row."""
    if preferences is None:
        return "ru"
    if isinstance(preferences, str):
        try:
            preferences = json.loads(preferences)
        except json.JSONDecodeError:
            return "ru"
    if not isinstance(preferences, dict):
        return "ru"
    lang = preferences.get("language")
    if isinstance(lang, str) and lang.strip().lower().startswith("en"):
        return "en"
    return "ru"


def _reject_html(s: str, field: str) -> None:
    if "<" in s or ">" in s:
        msg = f"{field} must not contain angle brackets (HTML not allowed)"
        raise ValueError(msg)


def validate_instruction_payload(
    welcome_text: str,
    thanks_text: str,
    steps: list[dict[str, Any]],
) -> None:
    """Raise ValueError if template fields are invalid."""
    w = welcome_text or ""
    t = thanks_text or ""
    if len(w) > _MAX_WELCOME_THANKS or len(t) > _MAX_WELCOME_THANKS:
        msg = "welcome_text/thanks_text too long"
        raise ValueError(msg)
    _reject_html(w, "welcome_text")
    _reject_html(t, "thanks_text")
    if len(steps) > _MAX_STEPS:
        msg = "too many steps"
        raise ValueError(msg)
    for i, raw in enumerate(steps):
        if not isinstance(raw, dict):
            msg = f"steps[{i}] must be an object"
            raise ValueError(msg)
        title = str(raw.get("title") or "").strip()
        body = str(raw.get("body") or "").strip()
        comp = raw.get("open_app_component")
        if len(title) > _MAX_STEP_TITLE or len(body) > _MAX_STEP_BODY:
            msg = f"steps[{i}] title/body too long"
            raise ValueError(msg)
        _reject_html(title, f"steps[{i}].title")
        _reject_html(body, f"steps[{i}].body")
        if comp is not None and str(comp).strip():
            c = str(comp).strip()
            if c not in ALLOWED_DESKTOP_APP_COMPONENTS:
                msg = f"Invalid open_app_component: {c!r}"
                raise ValueError(msg)
        bl = raw.get("button_label")
        if bl is not None and str(bl).strip():
            b = str(bl).strip()
            if len(b) > 120:
                msg = f"steps[{i}].button_label too long"
                raise ValueError(msg)
            _reject_html(b, f"steps[{i}].button_label")


def normalize_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw in steps:
        title = str(raw.get("title") or "").strip()
        body = str(raw.get("body") or "").strip()
        comp_raw = raw.get("open_app_component")
        comp = str(comp_raw).strip() if comp_raw else None
        if comp == "":
            comp = None
        bl_raw = raw.get("button_label")
        button_label = str(bl_raw).strip() if bl_raw else None
        if button_label == "":
            button_label = None
        step: dict[str, Any] = {"title": title, "body": body}
        if comp:
            step["open_app_component"] = comp
        if button_label:
            step["button_label"] = button_label
        out.append(step)
    return out


def build_instruction_body_and_metadata(
    welcome_text: str,
    thanks_text: str,
    steps: list[dict[str, Any]],
) -> tuple[str, dict[str, Any]]:
    """Build plaintext body and client metadata (kind + steps with app actions)."""
    lines: list[str] = []
    w = (welcome_text or "").strip()
    t = (thanks_text or "").strip()
    if w:
        lines.append(w)
    if t:
        if lines:
            lines.append("")
        lines.append(t)

    meta_steps: list[dict[str, Any]] = []
    for i, step in enumerate(steps, start=1):
        title = str(step.get("title") or "").strip()
        body = str(step.get("body") or "").strip()
        comp = step.get("open_app_component")
        bl = step.get("button_label")
        if lines:
            lines.append("")
        if title:
            lines.append(f"{i}. {title}")
        elif body:
            lines.append(f"{i}.")
        if body:
            lines.append(body)
        ms: dict[str, Any] = {"title": title, "body": body}
        if comp:
            ms["open_app_component"] = str(comp)
            ms["button_label"] = str(bl).strip() if bl else (f"Открыть: {title}" if title else "Открыть приложение")
        meta_steps.append(ms)

    body = "\n".join(lines).strip()
    metadata: dict[str, Any] = {
        "kind": "onboarding_instruction",
        # Lets clients render welcome / thanks / each step with a button under the step (not all at end).
        "welcome_text": w,
        "thanks_text": t,
        "steps": meta_steps,
    }
    return body, metadata


async def fetch_instruction_row(conn: asyncpg.Connection, locale: str = "ru") -> dict[str, Any] | None:
    locale = normalize_instruction_locale(locale)
    row = await conn.fetchrow(
        """
        SELECT locale, welcome_text, thanks_text, steps, updated_at, updated_by
        FROM system_gaf_instruction
        WHERE locale = $1
        """,
        locale,
    )
    if row is None:
        return None
    steps = row["steps"]
    if isinstance(steps, str):
        steps = json.loads(steps)
    return {
        "locale": row["locale"],
        "welcome_text": row["welcome_text"] or "",
        "thanks_text": row["thanks_text"] or "",
        "steps": steps if isinstance(steps, list) else [],
        "updated_at": row["updated_at"],
        "updated_by": str(row["updated_by"]) if row.get("updated_by") else None,
    }


async def upsert_instruction(
    pool: asyncpg.Pool,
    *,
    locale: str,
    welcome_text: str,
    thanks_text: str,
    steps: list[dict[str, Any]],
    admin_user_id: str,
) -> dict[str, Any]:
    validate_instruction_payload(welcome_text, thanks_text, steps)
    norm = normalize_steps(steps)
    uid = UUID(str(admin_user_id).strip())
    steps_json = json.dumps(norm, ensure_ascii=False, default=str)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO system_gaf_instruction (locale, welcome_text, thanks_text, steps, updated_at, updated_by)
            VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
            ON CONFLICT (locale) DO UPDATE SET
                welcome_text = EXCLUDED.welcome_text,
                thanks_text = EXCLUDED.thanks_text,
                steps = EXCLUDED.steps,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            """,
            locale,
            welcome_text.strip(),
            thanks_text.strip(),
            steps_json,
            uid,
        )
        row = await fetch_instruction_row(conn, locale)
    assert row is not None
    return row
