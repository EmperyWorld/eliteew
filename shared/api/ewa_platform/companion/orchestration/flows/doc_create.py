# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared doc-create / ``file_create`` flow: parse user line, build confirmation task run, localized replies.
# Used by ``tool_registry._handle_file_create`` and intent-planner dispatch in ``task_orchestrator``.
# Invariants:
# - Creates ``awaiting_confirmation`` task runs only; storage write happens on confirm in ``_resume_pending_task``.
# - Literal body via ``с текстом:`` / tool args; generative asks (``напиши в нём…``) compose markdown via sidecar LLM first.
# - Research/long compose uses ``LLAMA_DEEP_URL`` when ``EWA_DEEP_LLM_ENABLED`` (Phase 4); missing deep → interactive.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md
# ---

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any, Literal

import asyncpg
import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.storage.catalog_pipeline import sanitize_companion_new_filename
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.settings.access import ewa_getenv_float, ewa_getenv_int
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_doc_create_filename_now: ContextVar[datetime | None] = ContextVar("doc_create_filename_now", default=None)

_DOC_CREATE_RE = re.compile(
    r"(?is)(?:"
    r"(?:создай|создать|сделай|сгенерируй|create|make|new).{0,80}"
    r"(?:файл|документ|заметк|document|file|note)"
    r"|(?:новый|новую|новое)\s+(?:файл|документ|заметк|document|file|note)"
    r")"
)
_EXPLICIT_TEXT_RE = re.compile(
    r"(?is)(?:с\s+текстом|текст|содержим(?:ым|ое)?|content|body)\s*[:—-]?\s*[«\"']?(.+?)[»\"']?\s*$"
)
_NAMED_FILE_RE = re.compile(
    r"(?is)(?:файл|документ|заметк|document|file|note)(?:\s+(?:с\s+названием|под\s+названием|named|called))?"
    r"\s*[«\"']?([^«»\"'\n,:]{1,120}?\.(?:txt|md|html))"
)
_GENERATIVE_DOC_BODY_RE = re.compile(
    r"(?is)(?:"
    r"напиш(?:и|ите|ать|у)|"
    r"запиш(?:и|ите|ать)|"
    r"заполни(?:ть)?|"
    r"сформируй(?:те)?|"
    r"включ(?:и|ите|ать)|"
    r"опиш(?:и|ите|ать)|"
    r"расскаж(?:и|ите|ать)|"
    r"сочини(?:\s+(?:текст|text))?|"
    r"write\s+(?:in|into|about|down)|"
    r"put\s+.+\s+in\s+(?:it|the\s+(?:file|document))"
    r")"
)
_TOPIC_CONNECTORS = frozenset({"a", "an", "about", "for", "in", "it", "on", "the", "о", "об", "обо", "про"})
_FILENAME_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "create",
        "document",
        "file",
        "for",
        "in",
        "it",
        "make",
        "me",
        "new",
        "note",
        "of",
        "on",
        "the",
        "to",
        "with",
        "а",
        "в",
        "всё",
        "все",
        "для",
        "документ",
        "заметка",
        "заметку",
        "и",
        "мне",
        "на",
        "напиши",
        "новое",
        "новую",
        "новый",
        "о",
        "об",
        "обо",
        "с",
        "сделай",
        "создай",
        "создать",
        "про",
        "текст",
        "текстом",
        "ты",
        "файл",
        "что",
        "это",
        "я",
        "меня",
        "нём",
        "нем",
        "себе",
        "себя",
    }
)


def looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in text)


def _filename_context_words(user_line: str, *, max_words: int = 2) -> list[str]:
    """Up to two meaningful words from the user line for default doc filenames."""

    s = (user_line or "").strip()
    s = _NAMED_FILE_RE.sub("", s)
    s = _EXPLICIT_TEXT_RE.sub("", s)
    s = _DOC_CREATE_RE.sub(" ", s)
    s = _GENERATIVE_DOC_BODY_RE.sub(" ", s)
    words = re.findall(r"[\w\u0400-\u04ff]+", s, flags=re.UNICODE)
    picked: list[str] = []
    for raw in words:
        low = raw.lower()
        if len(low) < 2 or low in _FILENAME_STOPWORDS or low.isdigit():
            continue
        safe = re.sub(r"[^\w\u0400-\u04ff-]+", "", low)[:32]
        if not safe:
            continue
        picked.append(safe)
        if len(picked) >= max_words:
            break
    return picked


def default_doc_create_filename(user_line: str, *, now: datetime | None = None) -> str:
    """Context prefix (≤2 words) + ``DD.MM.HH.MM`` when the user did not name the file."""

    if now is not None:
        _doc_create_filename_now.set(now)
    moment = now if now is not None else (_doc_create_filename_now.get() or datetime.now(tz=UTC))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    stamp = moment.astimezone(UTC).strftime("%d.%m.%H.%M")
    words = _filename_context_words(user_line)
    prefix = "-".join(words) if words else ("файл" if looks_cyrillic(user_line) else "file")
    return sanitize_companion_new_filename(f"{prefix}-{stamp}.md")[:255]


def _doc_create_topic_tail(user_line: str) -> str:
    """Text left after stripping create-intent boilerplate — implicit topic for generative compose."""

    s = (user_line or "").strip()
    s = _NAMED_FILE_RE.sub("", s)
    s = _EXPLICIT_TEXT_RE.sub("", s)
    s = _DOC_CREATE_RE.sub(" ", s)
    s = _GENERATIVE_DOC_BODY_RE.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip(" «»\"'.,:;!?-")


def user_line_has_implicit_doc_create_topic(user_line: str) -> bool:
    """True when user named a topic/subject after «создай документ …» without pasting literal body."""

    if _EXPLICIT_TEXT_RE.search(user_line or ""):
        return False
    tail = _doc_create_topic_tail(user_line)
    if len(tail) < 4:
        return False
    words = re.findall(r"[\w\u0400-\u04ff]+", tail, flags=re.UNICODE)
    substantive = [
        w for w in words if len(w) >= 3 and w.lower() not in _FILENAME_STOPWORDS and w.lower() not in _TOPIC_CONNECTORS
    ]
    return len(substantive) >= 1


def user_line_requests_generative_doc_body(user_line: str) -> bool:
    """True when user asks to create a file and have the companion **write** the content (not paste literal text)."""

    s = (user_line or "").strip()
    if len(s) < 8 or not _DOC_CREATE_RE.search(s):
        return False
    if _GENERATIVE_DOC_BODY_RE.search(s):
        return True
    return user_line_has_implicit_doc_create_topic(s)


def _doc_create_llm_runtime(
    *,
    user_line: str = "",
) -> tuple[str, str, int, float, int | None]:
    from api.services.llm_runtime.deep_client import deep_llm_enabled
    from api.services.llm_runtime.job_class import DeepLlmUnavailableError, resolve_llm_base_url
    from api.utils.llm_openai_compat_http import LLAMA_COMPAT_MAX_NUM_CTX

    line = user_line or ""
    want_deep = deep_llm_enabled() and (
        "Research context:" in line or "Document request:" in line or _doc_create_scale_for_request(line) == "long"
    )
    jc = "deep" if want_deep else "interactive"
    try:
        base = resolve_llm_base_url(job_class=jc).strip().rstrip("/")
    except DeepLlmUnavailableError:
        logger.info("[STEP] companion_doc_create_deep_fallback reason=url_unavailable")
        base = unified_settings.llama_url.strip().rstrip("/")
        jc = "interactive"
    if not base:
        base = unified_settings.llama_url.strip().rstrip("/")
    model = (
        os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()
    if jc == "deep":
        model = os.getenv("LLAMA_DEEP_MODEL", "").strip() or model
    num_predict = max(
        2048,
        min(ewa_getenv_int("EWA_COMPANION_DOC_CREATE_NUM_PREDICT", default=16_384), 65_536),
    )
    timeout_sec = ewa_getenv_float("EWA_COMPANION_DOC_CREATE_TIMEOUT_SEC", default=90.0)
    timeout_sec = max(20.0, min(timeout_sec, 300.0))
    if jc == "deep":
        timeout_sec = max(timeout_sec, 180.0)
        timeout_sec = min(timeout_sec, 600.0)
        logger.info("[STEP] companion_doc_create_llm_job_class=deep base=%s", base)
    num_ctx: int | None = None
    num_ctx_raw = ewa_getenv_int(
        "EWA_COMPANION_DOC_CREATE_NUM_CTX",
        default=ewa_getenv_int("EWA_COMPANION_CHAT_NUM_CTX", default=262_144),
    )
    if num_ctx_raw > 0:
        num_ctx = max(2048, min(num_ctx_raw, LLAMA_COMPAT_MAX_NUM_CTX))
    return base, model, num_predict, timeout_sec, num_ctx


def _doc_create_request_locale_slice(user_line: str) -> str:
    line = (user_line or "").strip()
    if "Document request:" in line:
        return line.split("Document request:", 1)[-1]
    if "\n\nMission context:" in line:
        return line.split("\n\nMission context:", 1)[0]
    return line


def _doc_create_scale_for_request(user_line: str) -> Literal["brief", "standard", "long"]:
    """Pick compose depth from the ask — avoid one padded template for every request."""

    request = _doc_create_request_locale_slice(user_line).casefold()
    long_markers = (
        "подробн",
        "развернут",
        "полный доклад",
        "detailed",
        "comprehensive",
        "whitepaper",
        "white paper",
        "исследов",
        "максимально полн",
        "long form",
        "long-form",
        "раздел за разделом",
    )
    brief_markers = (
        "кратко",
        "коротко",
        "brief",
        "short note",
        "коротк",
        "заметк",
        "чеклист",
        "checklist",
        "outline",
        "тезисно",
        "в двух словах",
        "email",
        "e-mail",
        "письм",
        "sms",
        "3 пункта",
        "пять пунктов",
        "5 пунктов",
    )
    if any(m in request for m in long_markers):
        return "long"
    if any(m in request for m in brief_markers):
        return "brief"
    return "standard"


def _doc_create_output_limits(*, user_line: str = "") -> tuple[int, int, int]:
    """Return validated ``(target_min_chars, target_max_chars, max_passes)`` for this ask."""

    scale = _doc_create_scale_for_request(user_line)
    env_max = max(
        4_000,
        min(ewa_getenv_int("EWA_COMPANION_DOC_CREATE_TARGET_MAX_CHARS", default=48_000), 48_000),
    )
    env_min = max(
        400,
        min(ewa_getenv_int("EWA_COMPANION_DOC_CREATE_TARGET_MIN_CHARS", default=24_000), env_max),
    )
    max_passes = max(1, min(ewa_getenv_int("EWA_COMPANION_DOC_CREATE_MAX_PASSES", default=4), 6))
    if scale == "brief":
        target_max = min(3_500, env_max)
        target_min = min(400, target_max)
        return target_min, target_max, min(max_passes, 2)
    if scale == "standard":
        target_max = min(12_000, env_max)
        target_min = min(1_200, target_max)
        return target_min, target_max, min(max_passes, 3)
    # long: honor env floors (legacy substantial reports)
    target_max = max(24_000, min(env_max, 48_000))
    target_min = max(8_000, min(env_min, target_max))
    return target_min, target_max, max_passes


def _doc_create_accept_floor(*, scale: str, target_min: int) -> int:
    """Soft floor so brief/standard docs are not rejected for missing padding."""

    if scale == "brief":
        return min(target_min, 200)
    if scale == "standard":
        return min(target_min, 400)
    return target_min


def _strip_doc_create_fence(body: str) -> str:
    cleaned = body.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"(?is)^```(?:markdown|md|text)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned).strip()
    return cleaned


def doc_create_draft_fingerprint(user_line: str, *, name: str = "") -> str:
    """Stable fingerprint so resume only continues the same generative request."""

    import hashlib

    raw = f"{(user_line or '').strip()}\n{(name or '').strip()}".encode()
    return hashlib.sha1(raw).hexdigest()[:16]


def parse_doc_create_draft(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, Mapping):
        return None
    body = str(raw.get("body") or "")
    if len(body) < 8:
        return None
    return {
        "body": body,
        "pass_index": max(0, int(raw.get("pass_index") or 0)),
        "fingerprint": str(raw.get("fingerprint") or "").strip(),
        "target_min": int(raw.get("target_min") or 0),
        "target_max": int(raw.get("target_max") or 0),
    }


async def compose_generative_doc_body_markdown(
    *,
    user_line: str,
    principal_id: str,
    profile: Mapping[str, Any] | None = None,
    companion_pool: asyncpg.Pool | None = None,
    draft: Mapping[str, Any] | None = None,
    max_passes_this_slice: int | None = None,
    filename: str = "",
) -> str | dict[str, Any] | None:
    """Sidecar LLM: draft markdown/plain document body for a generative ``file_create`` turn.

    When ``max_passes_this_slice`` is set (agentic path), returns either a completed body ``str``
    or a dict ``{"status": "continue", "doc_create_draft_v1": {...}}`` for scheduler resume.
    Legacy callers (no slice limit) still receive ``str | None``.
    """

    line = (user_line or "").strip()
    if not line:
        return None
    persona = str((profile or {}).get("seed_persona_id") or "parent").strip()
    memory_blob = ""
    if companion_pool is not None and principal_id.strip():
        try:
            from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_recent_for_principal

            rows = await episodes_recent_for_principal(
                companion_pool,
                principal_id=principal_id.strip(),
                limit=6,
            )
            snippets = [str(r.get("body") or "").strip()[:400] for r in rows if str(r.get("body") or "").strip()]
            if snippets:
                memory_blob = "\n".join(f"- {s}" for s in snippets[:6])
        except Exception as exc:  # noqa: BLE001 — compose degrades without episodic shading
            logger.debug("[STEP] companion_doc_create_compose_memory_skip err=%s", exc)

    # Language lock: Document request segment wins over Research context language.
    request_for_locale = _doc_create_request_locale_slice(line)
    ru = looks_cyrillic(request_for_locale) or looks_cyrillic(line)
    lang_rule = (
        "Output language MUST be Russian. If Research context is English, translate findings "
        "into Russian; do not switch the document language to English.\n"
        if ru
        else "Output language MUST match the Document request language (English when the request is English).\n"
    )
    scale = _doc_create_scale_for_request(line)
    target_min, target_max, max_passes = _doc_create_output_limits(user_line=line)
    accept_floor = _doc_create_accept_floor(scale=scale, target_min=target_min)
    if scale == "brief":
        length_rule = (
            f"Keep the document concise (about {target_min}-{target_max} characters). "
            "Stop when the ask is satisfied — do not pad with filler.\n"
        )
        structure_rule = (
            "Choose a short form that fits the ask (note, checklist, email, memo). "
            "Do not force a multi-section report template.\n"
        )
    elif scale == "standard":
        length_rule = (
            f"Aim for roughly {target_min}-{target_max} characters. "
            "Prefer finishing early when the deliverable is complete; never invent filler to hit a quota.\n"
        )
        structure_rule = (
            "Use a clear structure with only the sections the request needs "
            "(for example memo, plan, FAQ, or short guide). "
            "Avoid a generic identical outline for every document.\n"
        )
    else:
        length_rule = (
            f"The complete document should contain between {target_min} and {target_max} characters. "
            "Fully develop every promised section while avoiding filler and repetition.\n"
        )
        structure_rule = (
            "Produce a substantial structured document with clear Markdown headings (##), "
            "developed sections, examples and bullet lists where useful.\n"
        )
    system = (
        "You draft the body of a new personal document for EliteEW companion file_create.\n"
        "Output ONLY the document text (Markdown allowed). No preamble, no JSON, no code fences.\n"
        "Follow the user's Document request literally — match topic, tone, and requested format.\n"
        f"{lang_rule}"
        "Write in first person as the companion persona when the user asks about 'you' and the user.\n"
        f"{structure_rule}"
        f"{length_rule}"
        "Do not reuse the same boilerplate section titles across unrelated asks. "
        "Prefer concrete, useful content over padded summaries.\n"
        "If Research context is provided, ground the document in that material for the Document "
        "request topic only; do not invent sources and do not replace the requested deliverable "
        "topic with the research title. If the request lacks enough substance even with research, "
        "still produce a useful draft and mark gaps honestly.\n"
    )
    user_blob = f"Persona seed: {persona}\nUser request:\n{line}\n"
    if memory_blob:
        user_blob += f"\nRecent memory snippets (may inform tone/facts, do not invent secrets):\n{memory_blob}\n"

    base, model, num_predict, timeout_sec, num_ctx = _doc_create_llm_runtime(user_line=line)
    if not base:
        return None
    timeout = httpx.Timeout(timeout_sec)
    base_messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_blob},
    ]
    options: dict[str, Any] = {"temperature": 0.55, "num_predict": num_predict}
    if num_ctx is not None:
        options["num_ctx"] = num_ctx

    fingerprint = doc_create_draft_fingerprint(line, name=filename)
    parsed_draft = parse_doc_create_draft(draft)
    body = ""
    start_pass = 1
    if parsed_draft and parsed_draft.get("fingerprint") == fingerprint:
        body = str(parsed_draft.get("body") or "")
        start_pass = max(1, int(parsed_draft.get("pass_index") or 0) + 1)
        logger.info(
            "[STEP] companion_doc_create_compose_resume fingerprint=%s chars=%s next_pass=%s",
            fingerprint,
            len(body),
            start_pass,
        )

    slice_limit = max_passes if max_passes_this_slice is None else max(1, int(max_passes_this_slice))
    passes_this_slice = 0
    last_finish_reason = ""
    last_pass_index = max(0, start_pass - 1)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for pass_index in range(start_pass, max_passes + 1):
            if passes_this_slice >= slice_limit:
                break
            if pass_index == 1 or not body:
                messages = base_messages
            else:
                remaining = max(0, target_min - len(body))
                cont = (
                    "Continue the same document from the exact stopping point. "
                    "Do not repeat headings, paragraphs, or the introduction. "
                    f"Add useful content (about {remaining} characters if still needed) unless the "
                    f"document already reaches the hard maximum of {target_max} characters. "
                    "Output continuation text only."
                )
                if scale != "long":
                    cont += (
                        " If the Document request is already satisfied, reply with a single short closing line only."
                    )
                messages = [
                    *base_messages,
                    {"role": "assistant", "content": body},
                    {"role": "user", "content": cont},
                ]
            try:
                out = await httpx_compat_chat_completion_json(
                    client,
                    base,
                    model=model,
                    messages=messages,
                    options=options,
                    timeout=timeout,
                )
            except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
                logger.warning(
                    "[STEP] companion_doc_create_compose_pass_failed pass=%s chars=%s err=%s",
                    pass_index,
                    len(body),
                    exc,
                )
                break

            chunk = _strip_doc_create_fence(str(out.get("response") or ""))
            last_finish_reason = str(out.get("finish_reason") or "").strip()
            if len(chunk) < 8:
                logger.info(
                    "[STEP] companion_doc_create_compose_pass_empty pass=%s chars=%s",
                    pass_index,
                    len(body),
                )
                break
            body = (f"{body.rstrip()}\n\n{chunk.lstrip()}" if body else chunk)[:target_max]
            last_pass_index = pass_index
            passes_this_slice += 1
            logger.info(
                "[STEP] companion_doc_create_compose_pass_ok pass=%s chunk_chars=%s total_chars=%s "
                "scale=%s target_min=%s target_max=%s finish_reason=%s",
                pass_index,
                len(chunk),
                len(body),
                scale,
                target_min,
                target_max,
                last_finish_reason or "-",
            )
            if len(body) >= target_min:
                break
            # Brief/standard: stop early when the model finished and we already have a usable draft.
            if scale != "long" and last_finish_reason == "stop" and len(body) >= accept_floor:
                break

    draft_payload = {
        "body": body,
        "pass_index": last_pass_index,
        "fingerprint": fingerprint,
        "target_min": target_min,
        "target_max": target_max,
        "scale": scale,
    }

    if len(body) >= accept_floor and (len(body) >= target_min or scale != "long"):
        logger.info(
            "[STEP] companion_doc_create_compose_ok chars=%s ru=%s scale=%s target_min=%s target_max=%s",
            len(body),
            ru,
            scale,
            target_min,
            target_max,
        )
        return body

    # Agentic sliced compose: keep draft and ask scheduler to continue.
    if max_passes_this_slice is not None and len(body) >= 8 and last_pass_index < max_passes:
        logger.info(
            "[STEP] companion_doc_create_compose_need_continue chars=%s pass=%s target_min=%s",
            len(body),
            last_pass_index,
            target_min,
        )
        return {"status": "continue", "doc_create_draft_v1": draft_payload}

    logger.warning(
        "[STEP] companion_doc_create_compose_below_min chars=%s scale=%s target_min=%s accept_floor=%s "
        "passes=%s finish_reason=%s",
        len(body),
        scale,
        target_min,
        accept_floor,
        max_passes,
        last_finish_reason or "-",
    )
    return None


def parse_doc_create_payload(user_line: str) -> tuple[str, str] | None:
    """Return ``(filename, body)`` when the line matches doc-create intent, else ``None``."""

    if not _DOC_CREATE_RE.search(user_line):
        return None
    name_match = _NAMED_FILE_RE.search(user_line)
    name = (name_match.group(1).strip() if name_match else "").strip(" «»\"'.,:;!?")
    body_match = _EXPLICIT_TEXT_RE.search(user_line)
    body = (body_match.group(1).strip() if body_match else "").strip(" «»\"'")
    if not name:
        name = default_doc_create_filename(user_line)
    elif "." not in name:
        name = sanitize_companion_new_filename(f"{name}.md")[:255]
    else:
        name = sanitize_companion_new_filename(name)[:255]
    return name, body[:240_000]


def friendly_create_confirm_reply(user_line: str, name: str) -> str:
    return (
        f"Подготовила новый документ «{name}». Подтверди: создать файл сейчас?"
        if looks_cyrillic(user_line)
        else f"I prepared a new document “{name}”. Confirm: create the file now?"
    )


def friendly_create_need_body_reply(user_line: str, name: str) -> str:
    return (
        f"Могу создать «{name}», но мне нужен текст файла. Напиши содержание после «с текстом: …»."
        if looks_cyrillic(user_line)
        else f"I can create “{name}”, but I need the file text. Add it after “with text: …”."
    )


def friendly_create_empty_body_reply(user_line: str, name: str) -> str:
    return (
        f"Могу создать «{name}», но нужен непустой текст документа."
        if looks_cyrillic(user_line)
        else f"I can create “{name}”, but I need non-empty document text."
    )


def friendly_create_compose_failed_reply(user_line: str) -> str:
    return (
        "Не смогла сгенерировать текст документа. Попробуй ещё раз или задай текст после «с текстом: …»."
        if looks_cyrillic(user_line)
        else "I could not generate the document text. Try again or paste text after “with text: …”."
    )


def resolve_doc_create_filename(user_line: str, args: Mapping[str, Any] | None = None) -> str:
    """Safe filename for doc_create / generate_body (never subscripts a ``None`` payload)."""

    arg_map = args if isinstance(args, Mapping) else {}
    explicit_name = str(arg_map.get("name") or arg_map.get("doc_file_name") or "").strip()
    if explicit_name:
        name = explicit_name
    else:
        payload = parse_doc_create_payload(user_line)
        name = payload[0] if payload is not None else default_doc_create_filename(user_line)
    if "." not in name:
        name = f"{name}.md"
    return sanitize_companion_new_filename(name)[:255]


async def begin_doc_create_flow(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    name: str,
    body: str,
    task_key: str | None = None,
    folder_label: str | None = None,
    folder_item_id: str | None = None,
) -> dict[str, Any]:
    """Create confirmation task run + step; return orchestrator-shaped dict.

    Nested ``EwaFile`` folders are opt-in: pass ``task_key`` and/or ``folder_item_id`` only when
    the user explicitly asked to create or reuse a folder. Default is EwaFile root.
    """

    uid = (content_catalog_user_id or "").strip()
    name_s = sanitize_companion_new_filename(name)
    body_s = (body or "").strip()
    if not body_s:
        return {
            "reply": friendly_create_empty_body_reply(user_line, name_s),
            "actions": [],
            "task_run": None,
        }
    plan: dict[str, Any] = {
        "kind": "doc_create",
        "name": name_s,
        "body": body_s[:240_000],
        "content_user_id": uid,
    }
    key = (task_key or "").strip()
    if key:
        plan["task_key"] = key
    folder_id = (folder_item_id or "").strip()
    if folder_id:
        plan["folder_item_id"] = folder_id
    label = (folder_label or "").strip()
    if label and (key or folder_id):
        plan["folder_label"] = label[:80]
    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=principal_id,
        intent_kind="doc_create",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={"question": "confirm_create"},
        status="awaiting_confirmation",
    )
    await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run["id"]),
        step_index=1,
        step_kind="doc_create_proposal",
        title="Create Unified Content document",
        input_payload={"name": name_s, "chars": len(body_s)},
        status="awaiting_confirmation",
    )
    return {
        "reply": friendly_create_confirm_reply(user_line, name_s),
        "actions": [],
        "task_run": run,
    }


def resolve_file_create_inputs(
    user_line: str,
    args: Mapping[str, Any],
) -> tuple[str, str] | None | str:
    """Resolve filename + body for ``file_create``.

    Returns:
        ``None`` — tool does not apply (fall through).
        ``"need_body"`` — matched intent but body missing (caller surfaces reply; chat only).
        ``"generate_body"`` — user wants companion-authored content (caller runs compose LLM).
        ``(name, body)`` — ready to propose create.

    When structured ``tool_args`` include ``name`` without ``body`` (agentic plan nodes), always
    returns ``"generate_body"`` — never ``"need_body"``.
    """

    explicit_name = str(args.get("name") or args.get("doc_file_name") or "").strip()
    explicit_body = str(args.get("body") or args.get("doc_body_text") or "").strip()
    if explicit_name or explicit_body:
        name = explicit_name or default_doc_create_filename(user_line)
        if "." not in name:
            name = f"{name}.md"
        if not explicit_body:
            # Structured tool_args (agentic plan / registry): name without body → compose at runtime.
            return "generate_body"
        return name[:255], explicit_body[:240_000]

    payload = parse_doc_create_payload(user_line)
    if payload is None:
        return None
    name, body = payload
    if not body:
        if user_line_requests_generative_doc_body(user_line):
            return "generate_body"
        return "need_body"
    return name, body


__all__ = (
    "begin_doc_create_flow",
    "compose_generative_doc_body_markdown",
    "default_doc_create_filename",
    "doc_create_draft_fingerprint",
    "friendly_create_compose_failed_reply",
    "friendly_create_confirm_reply",
    "friendly_create_empty_body_reply",
    "friendly_create_need_body_reply",
    "looks_cyrillic",
    "parse_doc_create_draft",
    "parse_doc_create_payload",
    "resolve_doc_create_filename",
    "resolve_file_create_inputs",
    "user_line_has_implicit_doc_create_topic",
    "user_line_requests_generative_doc_body",
)
