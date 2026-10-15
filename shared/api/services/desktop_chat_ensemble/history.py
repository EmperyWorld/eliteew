"""Build Llama message lists for ensemble turns (speaker-labeled history)."""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID


class _HistoryMessageLike(Protocol):
    """Минимальный контракт сообщения для history shaping (без жёсткой привязки к ORM)."""

    role: str
    content: str
    message_metadata: dict[str, Any] | None
    tool_calls: dict[str, Any] | list[Any] | None


from api.services.desktop_chat.collaboration_authors import format_user_turn_for_llm, speaker_role_label
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.services.desktop_chat_ensemble.speaker_output import assistant_turn_for_prompt_history


def _label_for_assistant(meta: dict[str, Any] | None) -> str | None:
    if not meta:
        return None
    hid = meta.get("desktop_hero_id")
    if isinstance(hid, str) and hid.strip():
        return HERO_SHORT_LABEL.get(hid.strip()) or hid.strip()
    return None


def content_for_history_message(m: _HistoryMessageLike) -> str:
    raw = m.content or ""
    if m.role != "assistant":
        return raw
    meta = getattr(m, "message_metadata", None)
    if isinstance(meta, dict) and meta.get("desktop_ensemble_joint"):
        raw_c = meta.get("desktop_ensemble_contributors")
        names: list[str] = []
        if isinstance(raw_c, list):
            names = [
                HERO_SHORT_LABEL.get(str(x).strip(), str(x).strip()) for x in raw_c if isinstance(x, str) and x.strip()
            ]
        who = ", ".join(names) if names else "панель"
        body = (raw or "").strip().replace("\n", " ")
        # Длиннее превью, чтобы follow-up к совместному плану не терял структуру в LLM.
        cap = 2000
        preview = body[:cap]
        if len(body) > cap:
            preview += "…"
        return f"Совместный ответ участников [{who}]: {preview}"
    label = _label_for_assistant(meta if isinstance(meta, dict) else None)
    if label:
        return assistant_turn_for_prompt_history(raw, label)
    return raw


def ensemble_messages_for_llama(
    *,
    system_prompt: str,
    history: list[_HistoryMessageLike],
    user_content: str,
    inject_messages: list[dict[str, Any]] | None = None,
    is_shared: bool = False,
    owner_id: UUID | None = None,
    speaker_labels: dict[UUID, str] | None = None,
) -> list[dict[str, Any]]:
    from api.services.desktop_chat.service import MAX_HISTORY_MESSAGES

    labels = speaker_labels or {}
    out: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    for m in history[-MAX_HISTORY_MESSAGES:]:
        role = m.role
        if role not in ("user", "assistant", "system", "tool"):
            continue
        if role == "assistant":
            text = content_for_history_message(m)
        elif role == "user" and is_shared:
            text = m.content or ""
            aid = getattr(m, "author_user_id", None) or owner_id
            label = labels.get(aid) if aid else None
            meta = getattr(m, "message_metadata", None)
            if not label and isinstance(meta, dict):
                cached = meta.get("author_display_name")
                if isinstance(cached, str) and cached.strip():
                    is_own = bool(meta.get("author_is_owner"))
                    label = speaker_role_label(is_owner=is_own, display_name=cached.strip())
            text = format_user_turn_for_llm(text, is_shared=True, speaker_label=label)
        else:
            text = m.content or ""
        entry: dict[str, Any] = {"role": role, "content": text}
        if role == "assistant" and m.tool_calls:
            entry["tool_calls"] = m.tool_calls
        out.append(entry)
    if inject_messages:
        out.extend(inject_messages)
    out.append({"role": "user", "content": user_content})
    return out
