# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve deictic follow-ups («на эту тему», «from this post») from the last assistant reply in companion chat.
# Used by presentation generation, music generation, and similar tools that need prior-turn content.
# Invariants:
# - Reads ``desktop_friend_chat_v1`` from profile only — no LLM call.
# - Copy block between ``---`` (social_post_compose) preferred over full assistant bubble.
# Related:
# - api/ewa_platform/companion/orchestration/companion_presentation_generation.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS

CHAT_NS = "desktop_friend_chat_v1"

_DEICTIC_TOPIC_PHRASE_RE = re.compile(
    r"(?is)^(?:"
    r"на\s+(?:эту|этой|данную)\s+тем(?:у|е|ы)|"
    r"по\s+(?:эту|этой|этому|этим)\s+(?:тем(?:е|у|ы)|текст(?:у|а)?|ответ(?:у|а)?|лонгрид(?:у|а)?|пост(?:у|а)?)|"
    r"из\s+(?:этого|этой|этого\s+ответа|этого\s+текста|этого\s+лонгрида|этого\s+поста)|"
    r"(?:эту|эта|этот)\s+тем(?:у|а|ы|е)|"
    r"это(?:\s+же)?|"
    r"(?:on|about|for|from)\s+this(?:\s+topic|\s+text|\s+post|\s+answer|\s+longread)?|"
    r"this\s+topic|that\s+topic|the\s+above|from\s+(?:that|the\s+above)"
    r")(?:\s|[.,:;!?—-]|$)"
)

_DEICTIC_TOPIC_HINT_RE = re.compile(
    r"(?is)(?:"
    r"на\s+(?:эту|этой)\s+тем|"
    r"по\s+(?:этому|этой|эту)\s+(?:тем|текст|ответ|лонгрид|пост)|"
    r"из\s+этого|"
    r"\bthis\s+topic\b|\bthat\s+topic\b|\bthe\s+above\b"
    r")"
)

_COPY_BLOCK_RE = re.compile(r"(?ms)\n---\n([\s\S]*?)\n---\n")
_STRIP_COPY_HINT_RE = re.compile(
    r"(?is)^_\s*(?:скопируй|copy).*?_\s*$",
)
_STRIP_LONGREAD_HEADER_RE = re.compile(
    r"(?is)^\*\*(?:лонгрид|long-form|готовый\s+(?:пост|текст)|ready-to-publish\s+post)[^*]*\*\*[^\n]*\n+"
)


@dataclass(frozen=True, slots=True)
class DeicticTurnContext:
    topic: str
    extra_context: str


def is_deictic_topic_phrase(text: str) -> bool:
    s = (text or "").strip()
    if not s:
        return False
    return _DEICTIC_TOPIC_PHRASE_RE.match(s) is not None


def user_line_implies_prior_assistant_context(user_line: str, *, stripped_topic: str) -> bool:
    line = (user_line or "").strip()
    topic = (stripped_topic or "").strip()
    return (
        is_deictic_topic_phrase(topic)
        or _DEICTIC_TOPIC_HINT_RE.search(line) is not None
        or (len(topic) < 20 and re.search(r"(?i)(?:эту|этой|этого|this|that|above)", topic) is not None)
    )


def read_chat_messages_from_profile(profile: Mapping[str, Any] | None) -> list[dict[str, str]]:
    if not isinstance(profile, Mapping):
        return []
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return []
    chat_blob = lp.get(CHAT_NS)
    if not isinstance(chat_blob, Mapping):
        return []
    raw = chat_blob.get("messages")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            out.append({"role": str(role), "content": content.strip()})
    return out


def last_assistant_message_from_profile(profile: Mapping[str, Any] | None) -> str | None:
    for item in reversed(read_chat_messages_from_profile(profile)):
        if item.get("role") == "assistant":
            return str(item.get("content") or "").strip() or None
    return None


def extract_copyable_assistant_body(content: str) -> str:
    s = (content or "").replace("\r\n", "\n").strip()
    if not s:
        return ""
    block = _COPY_BLOCK_RE.search(f"\n{s}\n" if not s.startswith("---") else s)
    if block is not None:
        body = block.group(1).strip()
        if len(body) >= 24:
            return body
    s = _STRIP_LONGREAD_HEADER_RE.sub("", s).strip()
    lines = [ln for ln in s.splitlines() if not _STRIP_COPY_HINT_RE.match(ln.strip())]
    return "\n".join(lines).strip()


def derive_short_topic_label(context: str, *, max_len: int = 200) -> str:
    s = (context or "").replace("\r\n", "\n").strip()
    if not s:
        return ""
    for raw_line in s.splitlines():
        line = raw_line.strip()
        if not line or line == "---":
            continue
        line = re.sub(r"^\*\*|\*\*$", "", line).strip()
        line = re.sub(r"^#+\s*", "", line).strip()
        line = re.sub(r"^[\W_]+", "", line).strip()
        if len(line) >= 8:
            return line[:max_len]
    compact = re.sub(r"\s+", " ", s)
    return compact[:max_len]


def resolve_deictic_turn_context(
    user_line: str,
    profile: Mapping[str, Any] | None,
    *,
    stripped_topic: str,
) -> DeicticTurnContext | None:
    """When the user refers to «this topic», return topic label + body from last assistant reply."""

    if not user_line_implies_prior_assistant_context(user_line, stripped_topic=stripped_topic):
        return None
    prior = last_assistant_message_from_profile(profile)
    if not prior:
        return None
    body = extract_copyable_assistant_body(prior)
    if len(body) < 40:
        return None
    topic = derive_short_topic_label(body)
    if len(topic) < 8:
        topic = derive_short_topic_label(stripped_topic) or topic
    if len(topic) < 4:
        return None
    return DeicticTurnContext(topic=topic[:2000], extra_context=body[:MAX_EWA_COMPANION_CONTEXT_CHARS])


__all__ = (
    "DeicticTurnContext",
    "derive_short_topic_label",
    "extract_copyable_assistant_body",
    "is_deictic_topic_phrase",
    "last_assistant_message_from_profile",
    "read_chat_messages_from_profile",
    "resolve_deictic_turn_context",
    "user_line_implies_prior_assistant_context",
)
