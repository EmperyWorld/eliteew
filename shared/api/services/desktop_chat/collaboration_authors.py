# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Display-name labels for multi-human Desktop AI Chat turns (LLM + metadata).
# Invariants:
# - Labels are stable for a turn; duplicate display names get @username / short-id suffix.
# - Solo / non-shared chats keep legacy «Пользователь» wording (no prefix noise).
# Related:
# - api/services/desktop_chat/service.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---

from __future__ import annotations

from uuid import UUID

SHARED_CHAT_SPEAKER_NUDGE = (
    "[Служебная инструкция приложения EliteEW] В этом чате несколько людей. "
    "Реплики людей помечены как «Автор чата · …» или «Участник · …». "
    "Не путай, кто что сказал; при обращении используй имена из подписей. "
    "Герои Команды — AI; люди — только с подписями Автор/Участник."
)


def resolve_author_display_name(
    *,
    full_name: str | None,
    username: str | None,
    user_id: UUID,
) -> str:
    name = (full_name or "").strip() or (username or "").strip()
    if name:
        return name
    return f"user-{str(user_id).replace('-', '')[:8]}"


def disambiguate_display_names(
    labels: dict[UUID, str],
    *,
    usernames: dict[UUID, str] | None = None,
) -> dict[UUID, str]:
    """Ensure two people with the same display name get distinct LLM labels."""
    usernames = usernames or {}
    counts: dict[str, int] = {}
    for name in labels.values():
        key = name.casefold()
        counts[key] = counts.get(key, 0) + 1
    if all(v <= 1 for v in counts.values()):
        return dict(labels)

    out: dict[UUID, str] = {}
    for uid, name in labels.items():
        if counts.get(name.casefold(), 0) <= 1:
            out[uid] = name
            continue
        uname = (usernames.get(uid) or "").strip()
        if uname and uname.casefold() != name.casefold():
            out[uid] = f"{name} (@{uname})"
        else:
            out[uid] = f"{name} ({str(uid)[:8]})"
    return out


def speaker_role_label(*, is_owner: bool, display_name: str) -> str:
    role = "Автор чата" if is_owner else "Участник"
    return f"{role} · {display_name}"


def format_user_turn_for_llm(
    content: str,
    *,
    is_shared: bool,
    speaker_label: str | None,
) -> str:
    body = (content or "").strip()
    if not body:
        return ""
    if not is_shared or not speaker_label:
        return body
    return f"[Сообщение от {speaker_label}]: {body}"


def dialog_line_role_for_user(*, is_shared: bool, speaker_label: str | None) -> str:
    if is_shared and speaker_label:
        return speaker_label
    return "Пользователь"
