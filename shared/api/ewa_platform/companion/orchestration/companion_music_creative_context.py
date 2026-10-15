# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build ``ewa_companion_context`` for Music Generator wizard (Turbo + XL Base): user intent, deictic prior
# reply, tool-router slots, persona — capped for ``/lyrics``, ``/generate-style``, ``/suggest-production-params``.
# Invariants:
# - Transcript is not embedded wholesale; deictic body comes from ``resolve_deictic_turn_context`` only.
# - When deictic source material is present, it outranks the short wizard ``theme`` line in LLM prompts.
# - ``companion_chat_condensed_v1`` is never embedded in music wizard context — it mixes unrelated older topics.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/companion_music_xl_base.py
# - documentation/product/ewa/EWA-COMPANION-MUSIC-GENERATION.md
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.companion_deictic_turn_context import DeicticTurnContext
from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS, MAX_WIZARD_THEME_CHARS
from api.services.music_song_mood import source_text_negates_sadness

DEICTIC_SOURCE_MATERIAL_HEADING_RU = "Исходный материал для текста песни"
DEICTIC_SOURCE_MATERIAL_HEADING_EN = "Source material for lyrics"

_DEICTIC_PRESET_TAIL_RE = re.compile(
    r"(?is)\s*[—–-]\s*"
    r"(?:"
    r"возьми\s+тему\s+и\s+контекст\s+из\s+моего\s+последнего\s+ответа\s+спутника.*|"
    r"take\s+the\s+topic\s+and\s+context\s+from\s+my\s+last\s+companion\s+reply.*"
    r")$"
)
_EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002600-\U000027bf\U0000fe00-\U0000fe0f\U0001f900-\U0001f9ff]+",
    flags=re.UNICODE,
)
_MD_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_STANDALONE_II_RE = re.compile(
    r"(?:^|[\s,.:;«»\"—-])ии(?:[\s,.:;«»\"—-]|$)",
    flags=re.IGNORECASE,
)


def strip_deictic_music_preset_tail(text: str) -> str:
    """Remove quick-chip boilerplate so wizard ``theme`` is not polluted when deictic resolve fails."""

    s = (text or "").strip()
    if not s:
        return ""
    return _DEICTIC_PRESET_TAIL_RE.sub("", s).strip()


def normalize_music_source_body(text: str) -> str:
    """Strip emoji/markdown noise from assistant longread before wizard LLM stages."""

    s = (text or "").replace("\r\n", "\n").strip()
    if not s:
        return ""
    s = _EMOJI_RE.sub("", s)
    s = _MD_BOLD_RE.sub(r"\1", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def companion_context_has_deictic_source_material(companion_ctx: str) -> bool:
    ctx = (companion_ctx or "").strip()
    if not ctx:
        return False
    return DEICTIC_SOURCE_MATERIAL_HEADING_RU in ctx or DEICTIC_SOURCE_MATERIAL_HEADING_EN in ctx


def _extract_deictic_source_body(companion_ctx: str) -> str:
    body = companion_ctx or ""
    for marker in (DEICTIC_SOURCE_MATERIAL_HEADING_RU, DEICTIC_SOURCE_MATERIAL_HEADING_EN):
        idx = body.find(marker)
        if idx >= 0:
            return body[idx + len(marker) :].strip()
    return body.strip()


def companion_source_requests_tone_balance(text: str) -> bool:
    """True when the longread rejects pure grief or asks for vibe/survival with uplift."""
    low = (text or "").strip().lower()
    if not low:
        return False
    if source_text_negates_sadness(low):
        return True
    return any(
        k in low
        for k in (
            "вайб",
            "выживан",
            "надежд",
            "энерг",
            "бодр",
            "радост",
            "не траур",
            "не баллад",
        )
    )


def companion_music_tone_balance_block(text: str, *, ru: bool) -> str:
    if not companion_source_requests_tone_balance(text):
        return ""
    if ru:
        return (
            "БАЛАНС ТОНА: исходник допускает атмосферу (осень, туман, город), но это не траурная funeral-ballad. "
            "Куплет может быть созерцательным; припев обязан нести свет, энергию, иронию, надежду или силу выживания. "
            "Не whisper-only меланхолия; финал — бодрый, тёплый или triumphant, если исходник не про страдание.\n\n"
        )
    return (
        "TONE BALANCE: moody verses are OK, but this is not a funeral ballad. "
        "The chorus must carry light, energy, wit, hope, or resilient survival — not whisper-only grief.\n\n"
    )


def companion_music_tone_balance_block_from_context(companion_ctx: str, *, ru: bool) -> str:
    return companion_music_tone_balance_block(_extract_deictic_source_body(companion_ctx), ru=ru)


def _text_mentions_ai_tools(low: str) -> bool:
    if _STANDALONE_II_RE.search(low):
        return True
    return any(
        k in low
        for k in (
            "искусственн",
            "нейросет",
            " chatgpt",
            "соавтор",
            "автоматизац",
            "цифров",
            " ai ",
        )
    )


def _infer_deictic_subject_hint(body: str, *, ru: bool) -> str:
    low = (body or "").lower()
    if any(
        k in low
        for k in (
            "бизнес-центр",
            "класс «а»",
            'класс "а"',
            "застройк",
            "недвижим",
            "офисн",
            "логистическ",
            "инвестицион",
            "урбан",
        )
    ):
        return (
            "Деловая урбанистика и архитектура — не love song"
            if ru
            else "Business / urban development — not a love song"
        )
    if _text_mentions_ai_tools(low):
        return "Технологии и ИИ как инструмент — не романтика" if ru else "Technology / AI as tools — not romance"
    if any(
        k in low
        for k in (
            "владивосток",
            "осен",
            "сентябрь",
            "туман",
            "выживан",
            "вайб",
            "городск",
            "набережн",
        )
    ):
        return (
            "Город и сезон — контраст тона: атмосфера + позитив в припеве, не только траур"
            if ru
            else "City / season — contrast tone: atmosphere plus uplift in chorus, not funeral-only"
        )
    return ""


def companion_deictic_wizard_theme(deictic: DeicticTurnContext, *, ru: bool) -> str:
    """Short wizard ``theme`` for /lyrics: subject hint + headline within studio limit."""

    body = normalize_music_source_body(deictic.extra_context)
    topic = deictic.topic.strip()
    hint = _infer_deictic_subject_hint(body, ru=ru)
    line = f"{hint}. {topic}" if hint else topic
    return line[:MAX_WIZARD_THEME_CHARS]


def companion_music_deictic_lyrics_priority_block(*, ru: bool) -> str:
    if ru:
        return (
            "ПРИОРИТЕТ (deictic «на эту тему»): блок «Исходный материал для текста песни» — "
            "главный источник фактов, образов и посыла. Строка «Тема-заголовок» — только краткий заголовок лонгрида.\n"
            "Не подменяй тему универсальной pop/R&B love song, «притяжением» или club-клише, "
            "если исходник про бизнес, город, технологии или информационный пост."
        )
    return (
        "PRIORITY (deictic follow-up): the «Source material for lyrics» block is the primary factual and thematic source. "
        "The headline theme line is only a short title.\n"
        "Do not replace the topic with a generic pop/R&B love song or club clichés when the source is business, "
        "urban, technology, or informational content."
    )


def companion_music_deictic_style_guard_from_context(companion_ctx: str, *, ru: bool) -> str:
    body = _extract_deictic_source_body(companion_ctx)
    hint = _infer_deictic_subject_hint(body, ru=ru)
    tone_block = companion_music_tone_balance_block(body, ru=ru)
    if not hint and not tone_block:
        return ""
    guard = ""
    if hint:
        if ru:
            guard = (
                f"STYLE GUARD ({hint}): теги ACE Step — modern pop / cinematic / corporate anthem / clean futurism; "
                "избегай sultry R&B, seductive whisper, breathy romance, «attraction» как центрального образа, "
                "если это не love story по исходнику.\n\n"
            )
        else:
            guard = (
                f"STYLE GUARD ({hint}): ACE tags — modern pop / cinematic / corporate anthem / clean futurism; "
                "avoid sultry R&B, seductive whisper, breathy romance, or «attraction» as the core unless the source is a love story.\n\n"
            )
    if tone_block:
        guard += (
            "STYLE GUARD (tone balance): avoid funeral ballad, solo whisper piano, 70 BPM-only tags; "
            "include modern pop energy, brighter chorus production, min ~95 BPM feel unless source demands slow.\n\n"
            if not ru
            else (
                "STYLE GUARD (баланс тона): не funeral ballad, не solo whisper piano, не только 70 BPM; "
                "добавь modern pop energy, brighter chorus, BPM feel от ~95, если исходник не просит медленную балладу.\n\n"
            )
        )
    return guard + tone_block


def build_music_companion_creative_context(
    *,
    user_line: str,
    args: Mapping[str, Any],
    profile: Mapping[str, Any] | None,
    deictic: DeicticTurnContext | None,
    ru: bool,
) -> str:
    """Assemble companion creative brief for music wizard LLM stages."""

    parts: list[str] = []
    line = (user_line or "").strip()
    if line:
        label = "User request" if not ru else "Запрос пользователя"
        parts.append(f"{label}: {line[:2000]}")

    if deictic is not None:
        body = normalize_music_source_body(deictic.extra_context)[:30000]
        subject_hint = _infer_deictic_subject_hint(body, ru=ru)
        if subject_hint:
            hint_label = "Subject domain" if not ru else "Предметная область"
            parts.append(f"{hint_label}: {subject_hint}")
        body_label = DEICTIC_SOURCE_MATERIAL_HEADING_EN if not ru else DEICTIC_SOURCE_MATERIAL_HEADING_RU
        parts.append(f"{body_label} (PRIMARY):\n{body}")
        topic_label = (
            "Headline only (from prior assistant reply)"
            if not ru
            else "Только заголовок (из прошлого ответа Ассистента)"
        )
        parts.append(f"{topic_label}: {deictic.topic.strip()[:2000]}")

    deictic_slots = deictic is not None
    for key, heading_ru, heading_en in (
        ("creative_brief", "Творческий бриф", "Creative brief"),
        ("mood", "Настроение", "Mood"),
        ("understood_summary_ru", "Суть запроса (RU)", "Request summary (RU)"),
        ("understood_summary_en", "Request summary (EN)", "Request summary (EN)"),
        *(
            ()
            if deictic_slots
            else (
                ("dialog_context", "Контекст диалога", "Dialog context"),
                ("conversation_context", "Контекст беседы", "Conversation context"),
                ("extra_context", "Доп. контекст", "Extra context"),
            )
        ),
    ):
        raw = str(args.get(key) or "").strip()
        if raw:
            heading = heading_ru if ru else heading_en
            parts.append(f"{heading}: {raw[:4000]}")

    if isinstance(profile, Mapping):
        persona_id = str(profile.get("seed_persona_id") or "parent").strip()
        if persona_id:
            persona_line = f"Persona Ассистента: {persona_id}." if ru else f"Assistant persona: {persona_id}."
            parts.append(persona_line)

    tone_balance = ""
    if deictic is not None:
        tone_balance = companion_music_tone_balance_block(normalize_music_source_body(deictic.extra_context), ru=ru)

    directive = (
        "EWA companion music: текст песни и production-теги должны отражать PRIMARY исходный материал и его посыл; "
        "не подменяй тему generic pop/R&B love song или club-клише."
        if ru
        else "EWA companion music: lyrics and production tags must reflect the PRIMARY source material; "
        "do not replace the topic with generic pop/R&B love songs or club clichés."
    )
    merged_parts = [p for p in parts if p]
    if tone_balance:
        merged_parts.append(tone_balance.strip())
    merged = "\n\n".join(merged_parts) + f"\n\n{directive}"
    return merged.strip()[:MAX_EWA_COMPANION_CONTEXT_CHARS]


__all__ = (
    "DEICTIC_SOURCE_MATERIAL_HEADING_EN",
    "DEICTIC_SOURCE_MATERIAL_HEADING_RU",
    "build_music_companion_creative_context",
    "companion_context_has_deictic_source_material",
    "companion_deictic_wizard_theme",
    "companion_music_deictic_lyrics_priority_block",
    "companion_music_deictic_style_guard_from_context",
    "companion_music_tone_balance_block",
    "companion_music_tone_balance_block_from_context",
    "companion_source_requests_tone_balance",
    "normalize_music_source_body",
    "strip_deictic_music_preset_tail",
)
