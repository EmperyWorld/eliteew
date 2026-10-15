# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Detect «сделай пост …» companion turns (Telegram, VK, LinkedIn, blog, generic social, etc.) and compose a
# ready-to-publish post via sidecar LLM, optionally grounding on a named catalogue document.
# Invariants:
# - Output is terminal ``ToolResult(status=ok)`` with formatted post in ``reply`` (no background run).
# - Catalogue reads reuse ``catalog_file_discuss`` storage paths; no DocEditor required.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

import asyncpg
import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.settings.access import ewa_getenv, ewa_getenv_float, ewa_getenv_int
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

if TYPE_CHECKING:
    from api.ewa_platform.companion.orchestration.tool_registry import ToolContext, ToolResult

logger = logging.getLogger(__name__)

_ENV_ENABLED = "EWA_COMPANION_SOCIAL_POST_COMPOSE_ENABLED"

_VERB_LEAD = r"(?:сделай|напиши|составь|подготовь|сгенерируй|сформируй|оформи|create|write|compose|draft|make)"
_CONTENT_NOUN = (
    r"(?:post|пост|публикаци\w*|announc\w*|лонгрид\w*|long[\s-]?reads?|"
    r"стать[ияюе]\w*|articles?|текст\s+д(?:ля|l)\s+(?:пост|публикац|соц|канал))"
)
_SOCIAL_CHANNELS = (
    r"telegram|телеграм|tg|vk|вк|вконтакте|instagram|инстаграм|insta|social|соц\s*сет\w*|"
    r"linkedin|линкedin|facebook|фейсбук|fb|twitter|твиттер|x\.com|threads|"
    r"dzen|дзен|блог|blog|newsletter|рассылк|tiktok|тик\s*ток|medium|habr|хабр|vc\.ru"
)

_SOCIAL_POST_INTENT_RE = re.compile(
    rf"(?is)(?:"
    rf"{_VERB_LEAD}\s+(?:мне\s+)?(?:{_CONTENT_NOUN})|"
    rf"(?:{_CONTENT_NOUN})\s+(?:for|для|в|to|on|in)\s+(?:{_SOCIAL_CHANNELS})|"
    rf"(?:{_SOCIAL_CHANNELS})\s+(?:{_CONTENT_NOUN})|"
    rf"{_VERB_LEAD}\s+(?:мне\s+)?(?:развернут\w*|подробн\w*)\s+(?:post|пост|текст|стать\w*)"
    rf")",
)

_LONG_FORM_POST_RE = re.compile(
    r"(?i)(?:"
    r"лонгрид|long[\s-]?read|"
    r"развернут\w*\s+(?:post|пост|текст|стать\w*)|"
    r"подробн\w*\s+(?:post|пост|стать\w*)|"
    r"article[-\s]?(?:length|style|scale)"
    r")",
)

_CHANNEL_DETECTORS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("telegram", re.compile(r"(?i)telegram|телеграм|\btg\b")),
    ("vk", re.compile(r"(?i)\bvk\b|вконтакте|\bвк\b")),
    ("instagram", re.compile(r"(?i)instagram|инстаграм|\binsta\b")),
    ("linkedin", re.compile(r"(?i)linkedin|линкedin|линкедин")),
    ("facebook", re.compile(r"(?i)facebook|фейсбук|\bfb\b")),
    ("twitter", re.compile(r"(?i)twitter|твиттер|\bx\.com\b")),
    ("threads", re.compile(r"(?i)\bthreads\b")),
    ("dzen", re.compile(r"(?i)dzen|дзен|яндекс\.?\s*дзен")),
    ("blog", re.compile(r"(?i)\bblog\b|блог(?:ов)?\s*post|пост\s+для\s+блог")),
    ("newsletter", re.compile(r"(?i)newsletter|email\s+post|рассылк|пост\s+для\s+рассыл")),
)

_SOURCE_DOC_RE = re.compile(
    r"(?is)(?:"
    r"на\s+основ(?:е|ы)\s+(?:документ|файл)|"
    r"использ(?:уя|уй)\s+(?:документ|файл|файл\s+из\s+каталог)|"
    r"из\s+(?:документ|файл)|"
    r"по\s+(?:документ|файл)|"
    r"based\s+on\s+(?:the\s+)?(?:document|file)|"
    r"using\s+(?:the\s+)?(?:document|file|catalog)"
    r")",
)

_CHANNEL_STRIP_RE = re.compile(
    rf"(?is)(?:"
    rf"\b(?:{_SOCIAL_CHANNELS}|social\s+media|соц\s*сет\w*)\b|"
    rf"\b(?:лонгрид\w*|long[\s-]?reads?|стать[ияюе]\w*|articles?)\b|"
    r"(?:for|для|в|to|on|in)\s+(?:channel|канал|площадк\w*)"
    r")",
)

_POST_BOILERPLATE_RE = re.compile(
    rf"(?is)(?:"
    rf"{_VERB_LEAD}\s+(?:мне\s+)?(?:{_CONTENT_NOUN})|"
    rf"(?:{_CONTENT_NOUN})\s+(?:for|для|в|to|on|in)|"
    rf"{_VERB_LEAD}\s+(?:мне\s+)?(?:развернут\w*|подробн\w*)\s+(?:post|пост|текст|стать\w*)"
    rf")",
)

_ENV_NUM_PREDICT = "EWA_COMPANION_SOCIAL_POST_NUM_PREDICT"
_ENV_TIMEOUT_SEC = "EWA_COMPANION_SOCIAL_POST_TIMEOUT_SEC"
_ENV_MAX_OUTPUT_CHARS = "EWA_COMPANION_SOCIAL_POST_MAX_OUTPUT_CHARS"
_ENV_MODEL = "EWA_COMPANION_SOCIAL_POST_MODEL"
_ENV_POLISH_RETRY = "EWA_COMPANION_SOCIAL_POST_POLISH_RETRY"

# MBA / purple-prose patterns — trigger optional polish pass when too many hit.
_CLICHE_PATTERN = re.compile(
    r"(?i)"
    r"уникальн\w+\s+(?:инвестицион\w+|кейс)|"
    r"пропитан|"
    r"игрок\w*\s+рынк|"
    r"\bдрайвер\w*\b|"
    r"на\s+опережени|"
    r"\bмарж\w*\b|"
    r"невозможно\s+оценивать|"
    r"по\s+стандартным\s+меркам|"
    r"заложен\s+в\s+цену|"
    r"маркетингов\w*\s+буклет"
)

_TELEGRAM_EXAMPLE_RU = (
    "Пример хорошего Telegram-поста (только формат и тон — **не** копируй тему, если пользователь просил другое):\n"
    "🚀 **EliteEW 2.4: что изменилось для тех, кто живёт на рабочем столе**\n\n"
    "Если вы давно не заходили в приложение, кажется, что «просто мелкие правки». "
    "Но **три вещи** реально меняют ежедневный сценарий.\n\n"
    "• **Ассистент** — быстрее открывает файлы и не теряет контекст между окнами\n"
    "• **DocEditor** — черновики не исчезают при переключении задач\n"
    "• **Desktop** — меньше лагов при нескольких окнах сразу\n\n"
    "Главная ошибка: ждать «идеального релиза», вместо того чтобы попробовать **одну** новую фичу сегодня.\n\n"
    "Какую из трёх вы проверите первой? Напишите в комментариях 👇\n\n"
    "#EliteEW #Обновление"
)

_FORMAT_RULES_COMMON = (
    "Global rules (MANDATORY):\n"
    "- Output ONLY the post body — no preamble, no «here is your post».\n"
    "- Write like a **top channel editor**, not a corporate consultant or MBA deck.\n"
    "- Concrete facts, numbers, names, and examples **from the user's topic only** — "
    "never substitute another subject (e.g. do not write about real estate unless the user asked).\n"
    "- Separate EVERY block with a blank line (`\\n\\n`). Never one wall of text.\n"
    "- **Bold** the hook line and 3–6 key phrases using Telegram markdown `**…**`.\n"
    "- One block with `•` bullet lines (3–5 items) when the topic allows lists.\n"
    "- Emoji: hook line starts with 1 topic-relevant emoji; each **bold subhead** gets 1 emoji prefix "
    "(different emojis across sections — e.g. 📍 🎯 💡 ⚡ 🧭); CTA may end with 👇 or ❓; "
    "2–4 emojis per 1000 characters in long-form — never spam every sentence.\n"
    "- End with a direct question/CTA; hashtags on the last line only.\n"
    "- BANNED tone: «уникальный инвестиционный кейс», «пропитан ветром», «игроки рынка», "
    "«драйвер роста», «на опережение», «маржа», «невозможно оценивать по меркам Москвы», purple metaphors.\n"
)

_CHANNEL_GUIDANCE: dict[str, str] = {
    "telegram": (
        "Channel: Telegram channel post (copy-paste ready).\n"
        "Length: **2200–5500 characters** unless user asked for short.\n"
        "Structure (follow this shape):\n"
        "1) Hook line: emoji optional + **bold headline** (standalone line)\n"
        "2) 1–2 teaser lines\n"
        "3) Body: 3–5 paragraphs, each 2–3 sentences\n"
        "4) One `•` bullet block (3–5 bullets) with **bold lead-ins**\n"
        "5) Closing question + 👇 optional\n"
        "6) Hashtags on final line\n"
        f"{_TELEGRAM_EXAMPLE_RU}\n"
    ),
    "vk": (
        "Channel: VK long-read post (article in the feed).\n"
        "Length: **10000–25000 characters** — full article, not a caption.\n"
        "Structure:\n"
        "- Hook: 1 emoji + **bold headline** (standalone line)\n"
        "- 7–11 major blocks; each **bold subhead** starts with its own emoji\n"
        "- Multiple • bullet lists with concrete examples from the user's topic\n"
        "- Scenarios, mistakes, numbers; warm expert voice; visual rhythm via emoji + blank lines\n"
        "- CTA question + hashtags on the last line\n"
    ),
    "instagram": (
        "Channel: Instagram caption.\n"
        "Length: aim **800–2200 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Hook first line; micro-paragraphs with blank lines.\n"
        "- Hashtags grouped on the last line (5–12 max).\n"
    ),
    "linkedin": (
        "Channel: LinkedIn.\n"
        "Length: aim **1200–3500 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Professional but human; hook + 4–6 paragraphs with blank lines.\n"
        "- 3–5 hashtags on the last line; minimal emoji.\n"
    ),
    "facebook": (
        "Channel: Facebook.\n"
        "Length: aim **1200–3500 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Friendly tone; hook + 4–6 paragraphs with blank lines; CTA at the end.\n"
    ),
    "twitter": (
        "Channel: X (Twitter).\n"
        "Length: single tweet ~280 chars OR numbered thread 3–8 parts if user asks for a thread.\n"
        "Format:\n"
        "- Each tweet/part on its own line block; blank line between thread parts.\n"
    ),
    "threads": (
        "Channel: Threads.\n"
        "Length: aim **600–2000 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Conversational; short paragraphs with blank lines.\n"
    ),
    "dzen": (
        "Channel: Yandex Dzen / Дзен.\n"
        "Length: aim **2000–6000 characters** — article-style lead for the feed.\n"
        "Format:\n"
        "- Headline hook; 5–10 paragraphs with blank lines.\n"
    ),
    "blog": (
        "Channel: blog / site announcement.\n"
        "Length: aim **2000–8000 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Title-like hook; intro + 5–10 paragraphs with blank lines.\n"
    ),
    "newsletter": (
        "Channel: email newsletter excerpt.\n"
        "Length: aim **800–2500 characters**.\n"
        "Format:\n"
        "- Subject-line hook; scannable paragraphs; bullets allowed.\n"
    ),
    "generic": (
        "Channel: infer from the user line or write a versatile long-form social post.\n"
        "Length: aim **1500–4500 characters** unless the user asks for short.\n"
        "Format:\n"
        "- Strong opening; 4–8 paragraphs with blank lines; CTA when appropriate.\n"
    ),
}


def looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in text)


def companion_social_post_compose_enabled() -> bool:
    raw = ewa_getenv(_ENV_ENABLED, "").strip().lower()
    return raw not in ("0", "false", "off", "no")


def user_line_requests_social_post_compose(user_line: str) -> bool:
    s = (user_line or "").strip()
    if len(s) < 10:
        return False
    return _SOCIAL_POST_INTENT_RE.search(s) is not None


def resolve_social_post_channel(user_line: str) -> str:
    s = user_line or ""
    for channel, pattern in _CHANNEL_DETECTORS:
        if pattern.search(s):
            return channel
    return "generic"


def extract_social_post_brief(user_line: str) -> str:
    s = (user_line or "").strip()
    s = _POST_BOILERPLATE_RE.sub(" ", s)
    s = _CHANNEL_STRIP_RE.sub(" ", s)
    s = _SOURCE_DOC_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip(" «»\"'.,:;!?-")
    return s


def _channel_display_label(channel: str, *, ru: bool) -> str:
    labels_ru = {
        "telegram": "Telegram",
        "vk": "VK",
        "instagram": "Instagram",
        "linkedin": "LinkedIn",
        "facebook": "Facebook",
        "twitter": "X (Twitter)",
        "threads": "Threads",
        "dzen": "Дзен",
        "blog": "блога",
        "newsletter": "рассылки",
        "generic": "",
    }
    labels_en = {
        "telegram": "Telegram",
        "vk": "VK",
        "instagram": "Instagram",
        "linkedin": "LinkedIn",
        "facebook": "Facebook",
        "twitter": "X (Twitter)",
        "threads": "Threads",
        "dzen": "Dzen",
        "blog": "blog",
        "newsletter": "newsletter",
        "generic": "",
    }
    table = labels_ru if ru else labels_en
    return table.get(channel, channel)


def _user_line_requests_source_document(user_line: str, profile: Mapping[str, Any] | None) -> bool:
    s = (user_line or "").strip()
    if not s:
        return False
    if _SOURCE_DOC_RE.search(s):
        return True
    from api.ewa_platform.companion.server_first.v2 import companion_catalog_line_names_file
    from api.ewa_platform.companion.storage.catalog_file_discuss import (
        user_intent_catalog_file_discuss_deictic,
    )

    if companion_catalog_line_names_file(s):
        return True
    return user_intent_catalog_file_discuss_deictic(s, profile)


async def _resolve_main_pool(ctx: ToolContext) -> asyncpg.Pool:
    if ctx.main_pool is not None:
        return ctx.main_pool
    from api.core.database_manager import get_asyncpg_pool

    return await get_asyncpg_pool()


def _extract_fenced_body_from_memory_block(block: str) -> str:
    m = re.search(r"```\n(.*)\n```", block, re.DOTALL)
    return m.group(1).strip() if m else ""


async def _resolve_post_source_document(
    ctx: ToolContext,
    user_line: str,
) -> tuple[str, str] | None:
    """Return ``(plain_text_excerpt, file_label)`` when a catalogue document is referenced."""

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    if not _user_line_requests_source_document(user_line, ctx.profile):
        return None

    from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
    from api.ewa_platform.companion.server_first.v2 import companion_catalog_line_names_file
    from api.ewa_platform.companion.storage.catalog_file_discuss import (
        augment_memory_section_with_catalog_file_discuss,
        augment_memory_section_with_file_focus_discuss,
        user_intent_catalog_file_discuss_deictic,
    )

    main_pool = await _resolve_main_pool(ctx)
    discuss_result = None
    try:
        if companion_catalog_line_names_file(user_line) or _SOURCE_DOC_RE.search(user_line):
            discuss_result = await augment_memory_section_with_catalog_file_discuss(
                main_pool,
                principal_id=ctx.principal_id,
                user_line=user_line,
                content_catalog_user_id=uid,
                oauth2_sub_for_content_alternate=ctx.oauth2_sub_for_content_alternate,
            )
        elif user_intent_catalog_file_discuss_deictic(user_line, ctx.profile):
            discuss_result = await augment_memory_section_with_file_focus_discuss(
                main_pool,
                principal_id=ctx.principal_id,
                user_line=user_line,
                content_catalog_user_id=uid,
                profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_social_post_source_doc_failed principal=%s err=%s",
            ctx.principal_id,
            exc,
        )
        companion_degrade_debug(
            logger,
            "social_post_compose",
            "source_doc_read_failed",
            principal_id=ctx.principal_id,
            exc=exc,
        )
        return None

    if discuss_result is None:
        return None
    block, _uc_str, file_label = discuss_result
    text = _extract_fenced_body_from_memory_block(block.strip())
    if len(text) < 8:
        return None
    return text, (file_label or "document")[:200]


def user_line_requests_short_post(user_line: str) -> bool:
    s = (user_line or "").strip()
    if user_line_requests_long_form_post(s):
        return False
    return bool(re.search(r"(?i)(?:\bкоротк|\bshort\b|\bbrief\b|\bлаконич|\bв\s+двух\s+словах)", s))


def user_line_requests_long_form_post(user_line: str) -> bool:
    """Explicit long-read / article-scale post (any channel, any topic)."""

    s = (user_line or "").strip()
    if not s:
        return False
    return _LONG_FORM_POST_RE.search(s) is not None


def _build_topic_anchor(*, user_line: str, brief: str) -> str:
    topic = (brief or user_line or "").strip()
    if not topic:
        return ""
    return (
        "PRIMARY TOPIC (mandatory — write ONLY about this subject; "
        "do not default to real estate, finance, or any other template topic):\n"
        f"{topic}\n"
    )


def _split_trailing_hashtags(text: str) -> tuple[str, str]:
    m = re.search(r"(?<=\s)(#\w[\w\d_]*(?:\s+#\w[\w\d_]*)+)\s*$", text)
    if not m:
        return text.strip(), ""
    body = text[: m.start()].strip()
    tags = m.group(1).strip()
    return body, tags


def _split_into_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?…])\s+(?=[«\"(A-ZА-ЯЁ0-9*—-])", text.strip())
    return [p.strip() for p in parts if p.strip()]


def format_social_post_body(text: str, *, channel: str = "generic") -> str:
    """Normalize LLM output: paragraph breaks, hashtags on their own line, no wall-of-text."""

    s = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not s:
        return s

    body, hashtags = _split_trailing_hashtags(s)
    body = re.sub(r"\n{3,}", "\n\n", body)

    if body.count("\n\n") >= 2:
        out = body
    else:
        sentences = _split_into_sentences(body)
        if len(sentences) <= 1:
            out = body
        else:
            per_para = 2 if channel in {"twitter", "threads"} else 3
            paragraphs: list[str] = []
            chunk: list[str] = []
            for sent in sentences:
                chunk.append(sent)
                joined = " ".join(chunk)
                if len(chunk) >= per_para and len(joined) >= 180:
                    paragraphs.append(joined)
                    chunk = []
            if chunk:
                tail = " ".join(chunk)
                if paragraphs and len(tail) < 140:
                    paragraphs[-1] = f"{paragraphs[-1]} {tail}"
                else:
                    paragraphs.append(tail)
            out = "\n\n".join(paragraphs) if paragraphs else body

    if hashtags:
        out = f"{out}\n\n{hashtags}"
    return out.strip()


def post_quality_needs_polish(text: str, *, channel: str) -> bool:
    """True when output looks like generic MBA prose or ignores Telegram formatting rules."""

    s = (text or "").strip()
    if len(s) < 80:
        return False
    cliche_hits = len(_CLICHE_PATTERN.findall(s))
    if cliche_hits >= 2:
        return True
    if channel in {"telegram", "vk", "generic"}:
        if "**" not in s:
            return True
        if len(s) > 1200 and "•" not in s and not re.search(r"(?m)^\s*[-*]\s+", s):
            return True
        if len(s) > 2500 and not re.search(
            r"[\U0001F300-\U0001FAFF\U00002700-\U000027BF\u2600-\u26FF\u2700-\u27BF]",
            s,
        ):
            return True
    return False


def _build_social_post_system_prompt(*, channel: str, ru: bool, short_mode: bool) -> str:
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    guidance = _CHANNEL_GUIDANCE.get(channel) or _CHANNEL_GUIDANCE["generic"]
    identity = get_prompt_block("workflow.social_post.identity") or (
        "You are an elite social copywriter for EliteEW Assistant users.\n"
    )
    lang = get_prompt_block("workflow.social_post.lang_ru" if ru else "workflow.social_post.lang_en")
    format_rules = get_prompt_block("workflow.social_post.format_rules") or _FORMAT_RULES_COMMON
    length = get_prompt_block("workflow.social_post.length_short" if short_mode else "workflow.social_post.length_long")
    return f"{identity}{lang}{format_rules}\n{guidance}\n{length}"


def _social_post_polish_retry_enabled() -> bool:
    raw = ewa_getenv(_ENV_POLISH_RETRY, "1").strip().lower()
    return raw not in ("0", "false", "off", "no")


def _social_post_model_name() -> str:
    return (
        ewa_getenv(_ENV_MODEL, "").strip()
        or ewa_getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or ewa_getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()


async def _invoke_social_post_llm(
    *,
    client: httpx.AsyncClient,
    base: str,
    model: str,
    messages: list[dict[str, str]],
    num_predict: int,
    timeout: httpx.Timeout,
    temperature: float,
) -> str:
    out = await httpx_compat_chat_completion_json(
        client,
        base,
        model=model,
        messages=messages,
        options={"temperature": temperature, "num_predict": num_predict},
        timeout=timeout,
    )
    return str(out.get("response") or "").strip()


def _strip_llm_fences(text: str) -> str:
    post = (text or "").strip()
    if post.startswith("```"):
        post = re.sub(r"(?is)^```(?:markdown|md|text)?\s*", "", post)
        post = re.sub(r"\s*```\s*$", "", post).strip()
    return post


def _social_post_llm_runtime() -> tuple[str, str, int, float, int]:
    base = unified_settings.llama_url.strip().rstrip("/")
    model = _social_post_model_name()
    num_predict = ewa_getenv_int(_ENV_NUM_PREDICT, default=32000)
    num_predict = max(512, min(num_predict, 32000))
    timeout_sec = ewa_getenv_float(_ENV_TIMEOUT_SEC, default=300.0)
    timeout_sec = max(20.0, min(timeout_sec, 600.0))
    max_output_chars = ewa_getenv_int(_ENV_MAX_OUTPUT_CHARS, default=96000)
    max_output_chars = max(2000, min(max_output_chars, 120000))
    return base, model, num_predict, timeout_sec, max_output_chars


async def _compose_social_post_single_shot(
    *,
    line: str,
    brief: str,
    channel: str,
    source_text: str | None,
    source_label: str | None,
    ru: bool,
    persona: str,
    memory_blob: str,
    short_mode: bool,
    max_output_chars: int,
) -> str | None:
    system = _build_social_post_system_prompt(channel=channel, ru=ru, short_mode=short_mode)
    topic_anchor = _build_topic_anchor(user_line=line, brief=brief)
    user_blob = f"Persona seed: {persona}\nUser request:\n{line}\n"
    if topic_anchor:
        user_blob += f"\n{topic_anchor}"
    if brief and brief.lower() != line.lower():
        user_blob += f"\nTopic/brief (after stripping boilerplate):\n{brief}\n"
    if source_text:
        label = (source_label or "document").strip()
        user_blob += (
            f"\nSource document from the user's catalogue ({label}) — ground facts and tone here, "
            f"do not invent details beyond it:\n---\n{source_text[:48_000]}\n---\n"
        )
    if memory_blob:
        user_blob += f"\nRecent chat snippets (tone only, do not invent secrets):\n{memory_blob}\n"

    base, model, num_predict, timeout_sec, _max_out = _social_post_llm_runtime()
    if not base:
        return None
    timeout = httpx.Timeout(timeout_sec)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_blob},
    ]
    temperature = 0.55 if short_mode else 0.62
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            post = _strip_llm_fences(
                await _invoke_social_post_llm(
                    client=client,
                    base=base,
                    model=model,
                    messages=messages,
                    num_predict=num_predict,
                    timeout=timeout,
                    temperature=temperature,
                )
            )
            if (
                post
                and _social_post_polish_retry_enabled()
                and not short_mode
                and post_quality_needs_polish(post, channel=channel)
            ):
                logger.info(
                    "[STEP] companion_social_post_compose_polish_retry channel=%s chars=%s",
                    channel,
                    len(post),
                )
                polish_user = (
                    f"The draft below reads like corporate MBA fluff or ignores {channel} formatting. "
                    f"REWRITE it completely:\n"
                    "- Remove clichés and purple prose; use plain expert voice.\n"
                    "- Add **bold** hook + 3–6 bold key phrases.\n"
                    "- Add one • bullet block (3–5 bullets).\n"
                    "- Keep \\n\\n between blocks; concrete details from the user's topic; end with a question.\n"
                    "- Output ONLY the rewritten post.\n\n"
                    f"DRAFT:\n{post[:16000]}"
                )
                polished = _strip_llm_fences(
                    await _invoke_social_post_llm(
                        client=client,
                        base=base,
                        model=model,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": polish_user},
                        ],
                        num_predict=min(num_predict, 16000),
                        timeout=timeout,
                        temperature=0.48,
                    )
                )
                if polished and len(polished) >= max(12, len(post) // 3):
                    post = polished
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("[STEP] companion_social_post_compose_failed err=%s", exc)
        return None

    post = format_social_post_body(post, channel=channel)
    if len(post) < 12:
        return None
    logger.info(
        "[STEP] companion_social_post_compose_ok chars=%s channel=%s ru=%s pipeline=single",
        len(post),
        channel,
        ru,
    )
    return post[:max_output_chars]


async def compose_social_post_text(
    *,
    user_line: str,
    brief: str,
    channel: str,
    source_text: str | None = None,
    source_label: str | None = None,
    principal_id: str,
    profile: Mapping[str, Any] | None = None,
    companion_pool: asyncpg.Pool | None = None,
) -> str | None:
    """Sidecar LLM: draft a ready-to-publish social post."""

    line = (user_line or "").strip()
    if not line:
        return None
    ru = looks_cyrillic(line)
    persona = str((profile or {}).get("seed_persona_id") or "parent").strip()
    short_mode = user_line_requests_short_post(line)

    memory_blob = ""
    if companion_pool is not None and principal_id.strip():
        try:
            from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_recent_for_principal

            rows = await episodes_recent_for_principal(
                companion_pool,
                principal_id=principal_id.strip(),
                limit=4,
            )
            snippets = [str(r.get("body") or "").strip()[:300] for r in rows if str(r.get("body") or "").strip()]
            if snippets:
                memory_blob = "\n".join(f"- {s}" for s in snippets[:4])
        except Exception as exc:  # noqa: BLE001 — tone shading only
            logger.debug("[STEP] companion_social_post_compose_memory_skip err=%s", exc)

    _base, _model, _num_predict, _timeout_sec, max_output_chars = _social_post_llm_runtime()

    from api.ewa_platform.companion.orchestration.companion_social_post_constructor import (
        compose_social_post_via_constructor,
        uses_constructor_pipeline,
    )

    long_form = user_line_requests_long_form_post(line)
    if uses_constructor_pipeline(channel=channel, short_mode=short_mode, long_form=long_form):
        return await compose_social_post_via_constructor(
            user_line=line,
            brief=brief,
            channel=channel,
            source_text=source_text,
            source_label=source_label,
            principal_id=principal_id,
            profile=profile,
            companion_pool=companion_pool,
            ru=ru,
            persona=persona,
            memory_blob=memory_blob,
        )

    return await _compose_social_post_single_shot(
        line=line,
        brief=brief,
        channel=channel,
        source_text=source_text,
        source_label=source_label,
        ru=ru,
        persona=persona,
        memory_blob=memory_blob,
        short_mode=short_mode,
        max_output_chars=max_output_chars,
    )


async def handle_social_post_compose(
    args: Mapping[str, Any],
    ctx: ToolContext,
) -> ToolResult | None:
    """Compose a channel post when the user line matches social-post intent."""

    from api.ewa_platform.companion.orchestration.tool_registry import ToolResult

    if not companion_social_post_compose_enabled():
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    bypass_raw = args.get("_tool_router_bypass_line_match")
    router_bypass = bypass_raw is True or str(bypass_raw or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    brief_arg = str(args.get("brief") or "").strip()
    if not router_bypass and not user_line_requests_social_post_compose(user_line):
        return None
    if router_bypass and not user_line and not brief_arg:
        return None

    ru = looks_cyrillic(user_line or brief_arg)
    channel_raw = str(args.get("channel") or "").strip()
    channel = resolve_social_post_channel(user_line) if user_line else "generic"
    if channel_raw:
        channel = channel_raw
    brief = brief_arg or extract_social_post_brief(user_line) or user_line

    source_text: str | None = None
    source_label: str | None = None
    source_pair = await _resolve_post_source_document(ctx, user_line)
    if source_pair is not None:
        source_text, source_label = source_pair

    from api.ewa_platform.companion.orchestration.companion_social_post_constructor import (
        uses_constructor_pipeline,
    )

    short_mode = user_line_requests_short_post(user_line)
    long_form = user_line_requests_long_form_post(user_line)
    pipeline = (
        "constructor"
        if uses_constructor_pipeline(channel=channel, short_mode=short_mode, long_form=long_form)
        else "single"
    )

    post = await compose_social_post_text(
        user_line=user_line,
        brief=brief,
        channel=channel,
        source_text=source_text,
        source_label=source_label,
        principal_id=ctx.principal_id,
        profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
        companion_pool=ctx.companion_pool,
    )

    channel_label = _channel_display_label(channel, ru=ru)
    if not post:
        return ToolResult(
            tool="social_post_compose",
            status="error",
            reply=(
                "Не получилось составить пост — переформулируй тему или уточни площадку (соцсети, Telegram, VK, LinkedIn…)."
                if ru
                else "I couldn't compose the post — try rephrasing the topic or naming the channel (social, Telegram, VK, LinkedIn…)."
            ),
            data={"channel": channel},
        )

    if ru:
        if pipeline == "constructor":
            header = f"**Лонгрид для {channel_label}**" if channel_label else "**Лонгрид**"
        elif channel == "generic":
            header = "**Готовый пост** — можно копировать:"
        elif channel in {"blog", "newsletter"}:
            header = f"**Готовый текст для {channel_label}**"
        else:
            header = f"**Готовый пост для {channel_label}**"
        if source_label:
            header += f" (на основе «{source_label}»)"
        if pipeline == "constructor" or channel != "generic":
            header += " — можно копировать:"
    else:
        if pipeline == "constructor":
            header = f"**Long-form post for {channel_label}**" if channel_label else "**Long-form post**"
        elif channel == "generic":
            header = "**Ready-to-publish post** — copy below:"
        elif channel in {"blog", "newsletter"}:
            header = f"**Ready text for {channel_label}**"
        else:
            header = f"**Ready-to-publish post for {channel_label}**"
        if source_label:
            header += f" (based on «{source_label}»)"
        if pipeline == "constructor" or channel != "generic":
            header += " — copy below:"
    copy_hint = (
        "_Скопируй текст между линиями — абзацы, **жирный** и эмодзи сохранятся при вставке._"
        if ru
        else "_Copy the text between the lines — paragraph breaks, **bold**, and emoji are preserved._"
    )
    reply = f"{header}\n\n---\n\n{post}\n\n---\n\n{copy_hint}"

    return ToolResult(
        tool="social_post_compose",
        status="ok",
        reply=reply,
        data={
            "channel": channel,
            "pipeline": pipeline,
            "source_file": source_label or "",
            "orchestration_branch": "social_post_compose",
        },
    )


__all__ = (
    "companion_social_post_compose_enabled",
    "compose_social_post_text",
    "extract_social_post_brief",
    "format_social_post_body",
    "handle_social_post_compose",
    "post_quality_needs_polish",
    "resolve_social_post_channel",
    "user_line_requests_long_form_post",
    "user_line_requests_short_post",
    "user_line_requests_social_post_compose",
)
