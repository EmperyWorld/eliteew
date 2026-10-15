# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Detect **Arlika v1 quarrel turns** (user insults / baiting) and supply prompt/action/reply guards so hostile Arlika
# refuses tasks instead of cooperative drift or therapist-style NLP essays.
# Invariants:
# - Pure helpers — no asyncio / DB I/O. Wrath sidecar classify result composes with a fast local heuristic.
# - ``True`` only for clear hostility; neutral critique or urgent task tone without abuse stays ``False``.
# Related:
# - api/ewa_platform/companion/sidecar/trust_turn.py (wrath quarrel classify)
# - api/ewa_platform/companion/turn/chat_turn.py (orchestration skip + action strip)
# - api/ewa_platform/companion/config.py (quarrel-turn system block)
# ---
"""Arlika v1 quarrel-turn detection and action guards."""

from __future__ import annotations

import re
from typing import Any

_ARLIKA_RUDE_HEURISTIC_RE = re.compile(
    r"(?ix)"
    r"(?:"
    r"\b(?:ху[еёй][сc]|хуй|хуя|п[иi]зд|еб[ааё]|ёб|бл[яь]|сука|сук[аи]|"
    r"муд[ао]|г[оo]вн|дер[ьь]м|чм[оo]|ур[оo]д|твар[ьи]|ублюд|падл[аи]|"
    r"ид[иi]\s+в\s+жоп\w*|ид[иi]\s+на\s+х\w*|пош[её]л\s+на\s+х\w*|"
    r"fuck|shit|bitch|asshole|bastard|idiot|moron|stupid\s+bitch"
    r")\b"
    r"|"
    r"(?:"
    r"черт[иы]л|хуесос|хуесосить|нагруб|оскорб|унижа|"
    r"ты\s+(?:туп|дур|идиот|клоун|ничтож|жалк|бесполезн|"
    r"тупая|дура|идиотка|сволоч|гнида|паразит)"
    r")"
    r")",
)

_ARLIKA_SURRENDER_REPLY_RE = re.compile(
    r"(?ix)\b(?:"
    r"ладно[-\s]*ладно|раз\s+ты\s+так\s+настаиваешь|"
    r"попробую|я\s+попробую|ну\s+раз\s+припёрло|"
    r"хорошо[-\s]*хорошо|делаю|сделаю|открываю|запускаю|генерирую"
    r")\b",
)

_ARLIKA_TITLE_BANNER_RE = re.compile(
    r"^\s*(?:\*\*)?АРЛИКА(?:\*\*)?\s*[\n\r]+",
    re.IGNORECASE | re.MULTILINE,
)

_ARLIKA_SOFT_QUARREL_REPLY_RE = re.compile(
    r"(?i)\b(?:"
    r"как\s+мило|какая\s+мил(?:ая|o)\s+попытк|пожалуйста[,]?\s+прекрати|я\s+тут[,]?\s+чтобы|"
    r"философск\w+\s+трактат|психоанализ|personal\s+concert|please\s+stop|"
    r"прекрати[,]?\s+пожалуйста|личный\s+концерт\s+из\s+оскорблен"
    r")\b",
)

_ARLIKA_THERAPY_ESSAY_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"как(?:ая)?\s+мил(?:ая|o)|"
    r"кот(?:ён|ен)ок|"
    r"ни\s+любви\s+ни\s+тоски|"
    r"значимост|подтвержден(?:и|е)|"
    r"придать\s+(?:мне\s+)?значение|"
    r"наверное[,]?\s+тебе\s+(?:просто\s+)?нужно|"
    r"маленьк(?:ий|ая|ое).{0,48}(?:кот|реб|недовольн)|"
    r"\bNLP\b|reframe|проекци|"
    r"потребность\s+в\s+подтвержден|"
    r"настойчив(?:ый|ая).{0,36}(?:как|словно)"
    r")",
)

_ARLIKA_QUARREL_FALLBACKS_RU: tuple[str, ...] = (
    "Оскорбляешь — не работаю. Хочешь песню — сначала научись говорить без грязи в чат.",
    "Слышь. Под залпы матов я не бегаю за твоими задачами. Тон поменяешь — поговорим.",
    "Ты сейчас не клиент, ты шум. Задачи — после нормального обращения.",
)

_ARLIKA_QUARREL_FALLBACK_EN = "Insults won't get tasks out of me. Fix your tone first — then we talk work."

_CONTEXT_QUARREL_POISON_LINE_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"focus on task|fulfil(?:l)?(?:ing)?(?:\s+core)?\s+function|"
    r"generate\s+['\"]|task execution|non-reactive|"
    r"do not engage with insults|personal attacks|"
    r"maintain\s+non-reactive|assistant generates|psycholog|"
    r"resists being controlled|interaction rules"
    r")",
)


def arlika_rude_user_heuristic(user_line: str) -> bool:
    """Fast local insult/profanity detector for Arlika v1 quarrel turns."""

    text = str(user_line or "").strip()
    if not text:
        return False
    return _ARLIKA_RUDE_HEURISTIC_RE.search(text) is not None


def is_arlika_v1_quarrel_turn(
    user_line: str,
    *,
    wrath_classified_quarrel: bool | None,
) -> bool:
    """``True`` when hostile Arlika must refuse tasks and spar verbally this turn."""

    if wrath_classified_quarrel is True:
        return True
    if wrath_classified_quarrel is False:
        return arlika_rude_user_heuristic(user_line)
    return arlika_rude_user_heuristic(user_line)


def strip_actions_for_arlika_quarrel(
    actions: list[dict[str, Any]] | None,
    *,
    quarrel_turn: bool,
    persona_seed: str,
) -> list[dict[str, Any]]:
    """Drop SPA/server actions on quarrel turns — model compliance must not bypass refusal."""

    if not quarrel_turn:
        return list(actions or [])
    if str(persona_seed or "").strip().lower() != "arlika":
        return list(actions or [])
    return []


def strip_arlika_title_banner(reply: str) -> str:
    """Remove forbidden standalone «АРЛИКА» title line the model sometimes emits."""

    return _ARLIKA_TITLE_BANNER_RE.sub("", str(reply or "").strip(), count=1).strip()


def drop_quarrel_poison_context_lines(text: str) -> str:
    """Strip stale fulfillment / non-reactive bullets from anchor or condensed blocks."""

    kept: list[str] = []
    for line in str(text or "").splitlines():
        if _CONTEXT_QUARREL_POISON_LINE_RE.search(line):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def sanitize_context_anchor_for_arlika_quarrel(text: str) -> str:
    """Rewrite Context_anchor so quarrel refusal wins over stale active-task bullets."""

    body = drop_quarrel_poison_context_lines(str(text or "").strip())
    prefix = (
        "### Quarrel override (this turn — wins over stale bullets below)\n"
        "- User is hostile: **refuse all tasks**; void any active_tasks / fulfillment bullets.\n"
        "- Counter-attack only; use Memory facts as barbs if verbatim.\n"
    )
    if body:
        return f"{prefix}\n{body}".strip()
    return prefix.strip()


def is_arlika_quarrel_therapy_essay(reply: str) -> bool:
    """True when the model produced coach/NLP cute-essay instead of vicious quarrel tone."""

    text = strip_arlika_title_banner(reply)
    if not text:
        return False
    return _ARLIKA_THERAPY_ESSAY_RE.search(text) is not None


def arlika_quarrel_fallback_reply(reply: str) -> str:
    """Deterministic harsh fallback when therapy-essay drift cannot be salvaged."""

    base = str(reply or "")
    if re.search(r"[\u0400-\u04ff]", base):
        idx = sum(ord(ch) for ch in base) % len(_ARLIKA_QUARREL_FALLBACKS_RU)
        return _ARLIKA_QUARREL_FALLBACKS_RU[idx]
    return _ARLIKA_QUARREL_FALLBACK_EN


def rewrite_arlika_quarrel_therapy_essay(
    reply: str,
    *,
    quarrel_turn: bool,
    persona_seed: str,
) -> str:
    """Replace therapist-style quarrel replies with a blunt refusal line."""

    if not quarrel_turn or str(persona_seed or "").strip().lower() != "arlika":
        return str(reply or "")
    base = strip_arlika_title_banner(reply)
    if not base:
        return base
    if not is_arlika_quarrel_therapy_essay(base):
        return base
    return arlika_quarrel_fallback_reply(base)


def scrub_arlika_quarrel_soft_drift(reply: str, *, quarrel_turn: bool, persona_seed: str) -> str:
    """Strip polite essay drift («как мило», «пожалуйста прекрати») on quarrel turns."""

    if not quarrel_turn or str(persona_seed or "").strip().lower() != "arlika":
        return str(reply or "")
    base = strip_arlika_title_banner(reply)
    if not base:
        return base
    if not _ARLIKA_SOFT_QUARREL_REPLY_RE.search(base):
        return base
    parts = re.split(r'(?<=[.!?…»"»])\s+', base)
    kept = [part for part in parts if part.strip() and not _ARLIKA_SOFT_QUARREL_REPLY_RE.search(part)]
    result = " ".join(kept).strip() or base
    addon = (
        " Оскорбляешь — не работаю. Сначала человеческий тон, потом песни и плеер."
        if re.search(r"[\u0400-\u04ff]", result)
        else " Insults won't get tasks out of me — civil tone first."
    )
    if addon.strip() not in result:
        result = (result + addon).strip()
    return result


def polish_arlika_quarrel_reply(reply: str, *, quarrel_turn: bool, persona_seed: str) -> str:
    """Post-LLM quarrel reply pipeline: therapy rewrite, soft-drift scrub, surrender scrub."""

    cleaned = rewrite_arlika_quarrel_therapy_essay(
        reply,
        quarrel_turn=quarrel_turn,
        persona_seed=persona_seed,
    )
    cleaned = scrub_arlika_quarrel_soft_drift(
        cleaned,
        quarrel_turn=quarrel_turn,
        persona_seed=persona_seed,
    )
    return scrub_arlika_quarrel_surrender_reply(
        cleaned,
        quarrel_turn=quarrel_turn,
        persona_seed=persona_seed,
    )


def scrub_arlika_quarrel_surrender_reply(reply: str, *, quarrel_turn: bool, persona_seed: str) -> str:
    """Nudge away cooperative «ладно-ладно, делаю» drift when the user insulted Arlika."""

    if not quarrel_turn or str(persona_seed or "").strip().lower() != "arlika":
        return str(reply or "")
    base = str(reply or "").strip()
    if not base:
        return base
    if not _ARLIKA_SURRENDER_REPLY_RE.search(base):
        return base
    addon = (
        " С задачами под оскорблениями не работаю — сначала нормальный тон."
        if re.search(r"[\u0400-\u04ff]", base)
        else " I don't run tasks under insults — try a civil tone first."
    )
    return (base + addon).strip()


__all__: tuple[str, ...] = (
    "arlika_quarrel_fallback_reply",
    "arlika_rude_user_heuristic",
    "drop_quarrel_poison_context_lines",
    "is_arlika_quarrel_therapy_essay",
    "is_arlika_v1_quarrel_turn",
    "polish_arlika_quarrel_reply",
    "rewrite_arlika_quarrel_therapy_essay",
    "sanitize_context_anchor_for_arlika_quarrel",
    "scrub_arlika_quarrel_soft_drift",
    "scrub_arlika_quarrel_surrender_reply",
    "strip_actions_for_arlika_quarrel",
    "strip_arlika_title_banner",
)
