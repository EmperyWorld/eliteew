# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Server-only** companion augmentation: when the user asks to **translate the open document and replace** editor text,
# load unified file bytes, translate via the same HTTP LLM as companion chat, and emit a ``doc_editor_set_body`` action
# (never echo the full translation in chat — see ``coerce_companion_chat_reply_when_doc_body_action``).
# Resolving **which** open DocEditor document to target uses ``active_window_id`` and ``surface_excerpt`` length when
# several editors are open (see ``resolve_doc_editor_unified_id_for_shell``).
# Invariants:
# - Opt-out ``EWA_COMPANION_DOC_BODY_TRANSLATE=0``; caps on download/translation/output via env (see module constants).
# - ``doc_editor_set_body`` is **never** accepted from model ``<<ACTIONS>>`` tails — only injected here after owner read.
# - Uses **main** Postgres + ``ContentStorageService.read_file_bytes_for_owner`` (owner-only); shared-only files skip.
#   Text-like bytes pass through the shared DocEditor normalizer before translation.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/services/ewa_companion/actions.py (``MAX_ACTIONS_PER_TURN``)
# ---
"""Companion **full-document translate → replace editor body** (server-injected action)."""

from __future__ import annotations

import html
import logging
import os
import re
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import httpx

from api.ewa_platform.companion.actions import MAX_ACTIONS_PER_TURN
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    _sorted_shell_windows,
    parse_surface_listing_line,
)
from api.services.doc_editor_text_normalizer import normalize_text_document
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_DOC_BODY_TRANSLATE_ENV = "EWA_COMPANION_DOC_BODY_TRANSLATE"
_MAX_DOWNLOAD_BYTES_ENV = "EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES"
_MAX_ACTION_HTML_CHARS_ENV = "EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS"
_TRANSLATE_CHUNK_CHARS_ENV = "EWA_COMPANION_DOC_TRANSLATE_CHUNK_CHARS"

_NA_TO_LANG_TAIL_RE = re.compile(
    r"(?is)(?:на|to|into)\s*(?:язык\w*\s*)?([^\n.!?;:]{2,72})(?:[\n.!?;:]|$)",
)

_LANG_ALIASES: dict[str, str] = {
    "английский": "English",
    "английском": "English",
    "english": "English",
    "немецкий": "German",
    "немецком": "German",
    "german": "German",
    "французский": "French",
    "франция": "French",
    "french": "French",
    "испанский": "Spanish",
    "spanish": "Spanish",
    "итальянский": "Italian",
    "italian": "Italian",
    "китайский": "Chinese",
    "chinese": "Chinese",
    "японский": "Japanese",
    "japanese": "Japanese",
    "украинский": "Ukrainian",
    "ukrainian": "Ukrainian",
    "польский": "Polish",
    "polish": "Polish",
    "турецкий": "Turkish",
    "turkish": "Turkish",
}


def _env_truthy(raw: str | None, default: bool = True) -> bool:
    if raw is None:
        return default
    s = raw.strip().lower()
    if s in {"0", "false", "no", "off"}:
        return False
    if s in {"1", "true", "yes", "on"}:
        return True
    return default


def _env_int(raw: str | None, default: int, *, lo: int, hi: int) -> int:
    try:
        v = int((raw or "").strip() or str(default))
    except ValueError:
        return default
    return max(lo, min(hi, v))


def companion_doc_body_translate_enabled() -> bool:
    return _env_truthy(os.getenv(_DOC_BODY_TRANSLATE_ENV), True)


def resolve_doc_editor_unified_id_for_shell(shell_norm: Mapping[str, Any] | None) -> str | None:
    """Pick ``uc=`` from **active** DocEditor ``surface_listing`` when possible; else best-effort among others.

    Multi-window: z-order alone targets the topmost editor, which may not be the one the user is editing. The shell
    sends ``active_window_id`` — when it matches a DocEditor with ``uc=…`` in ``surface_listing``, use that. Otherwise
    choose the candidate with the longest ``surface_excerpt`` (then higher ``z_index``) so an empty tab above does not
    steal edits while the user types in EWA chat with a substantive document open behind.
    """

    wins = _sorted_shell_windows(shell_norm)
    if not wins:
        return None
    doc_wins = [w for w in wins if str(w.get("app_component") or "").strip() == "DocEditor"]
    if not doc_wins:
        return None

    def first_uc_in_listing(w: Mapping[str, Any]) -> str | None:
        raw_listing = str(w.get("surface_listing") or "")
        for line in raw_listing.splitlines():
            _name, uc = parse_surface_listing_line(line)
            if uc:
                return str(uc).strip()
        return None

    aw = ""
    if isinstance(shell_norm, Mapping):
        aw = str(shell_norm.get("active_window_id") or "").strip()

    if aw:
        for w in doc_wins:
            if str(w.get("window_id") or "").strip() != aw:
                continue
            hit = first_uc_in_listing(w)
            if hit:
                return hit
            break

    candidates: list[tuple[Mapping[str, Any], str]] = []
    for w in doc_wins:
        if aw and str(w.get("window_id") or "").strip() == aw:
            continue
        hit = first_uc_in_listing(w)
        if hit:
            candidates.append((w, hit))
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda pair: (
            len(str(pair[0].get("surface_excerpt") or "").strip()),
            int(pair[0].get("z_index") or 0),
        ),
    )[1]


def companion_user_intent_translate_replace_editor(user_line: str) -> bool:
    """Heuristic: translate + document/editor scope + direction (на/to/into …)."""

    if not isinstance(user_line, str) or not user_line.strip():
        return False
    return bool(
        re.search(r"(перевед|перевод|translate|translation)", user_line, re.I)
        and re.search(r"(\bна\b|\bto\b|\binto\b)", user_line, re.I)
        and re.search(
            r"(документ|редактор|editor|содержим|контент|content|текст|text|файл|file"
            r"|весь|whole|entire|открыт|opened|замен|replace|обнови|update)",
            user_line,
            re.I,
        )
    )


def parse_target_language_label(user_line: str) -> str:
    """Best-effort target language phrase for translation prompts."""

    raw = user_line.strip()
    m = _NA_TO_LANG_TAIL_RE.search(raw)
    cand = (m.group(1).strip().lower().rstrip(" ,)") if m else "").strip()
    if not cand:
        return (os.getenv("EWA_COMPANION_DOC_TRANSLATE_DEFAULT_TARGET_LANG", "English").strip() or "English").strip()
    cand_norm = cand.replace("языке", "").replace("языку", "").replace("языка", "").strip()
    lowered = cand_norm.lower().strip("\"'«»„“")
    for key, lbl in sorted(_LANG_ALIASES.items(), key=lambda kv: len(kv[0]), reverse=True):
        if lowered == key or lowered.startswith(key + " ") or key in lowered:
            return lbl
    return cand_norm[:48].strip() or "English"


def _plain_to_chunk_paragraphs(plain: str, chunk_chars: int) -> list[str]:
    parts = [p.strip() for p in re.split(r"\n\s*\n+", plain) if p.strip()]
    if not parts:
        s = plain.strip()
        return [s] if s else []
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for p in parts:
        sep_len = 2 if current else 0
        add_len = len(p) + sep_len
        if current and size + add_len > chunk_chars:
            chunks.append("\n\n".join(current))
            current = [p]
            size = len(p)
        else:
            current.append(p)
            size += add_len
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def _reassemble_translated_units(units: list[str]) -> str:
    esc_blocks: list[str] = []
    for u in units:
        t = html.escape(u.strip())
        if not t:
            continue
        inner = t.replace("\n", "<br />")
        esc_blocks.append(f"<p>{inner}</p>")
    return "".join(esc_blocks) if esc_blocks else "<p></p>"


def _sanitize_body_html_for_action(raw: str, max_chars: int) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    s = raw.replace("\x00", " ").strip()
    if len(s) > max_chars:
        s = s[:max_chars].rstrip()
    return s if s else None


def build_doc_editor_set_body_action(
    *, body_html: str, unified_content_id: str | None, rationale: str
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "type": "doc_editor_set_body",
        "app_component": "DocEditor",
        "body_html": body_html,
        "rationale": rationale[:200],
    }
    uc = (unified_content_id or "").strip()
    if uc:
        row["unified_content_id"] = uc
    return row


def merge_actions_prepend_doc_editor_set_body(
    server_row: dict[str, Any],
    model_actions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    tail: list[dict[str, Any]] = []
    for a in model_actions:
        if not isinstance(a, dict):
            continue
        if str(a.get("type") or "").strip().lower() == "doc_editor_set_body":
            continue
        tail.append(a)
    out = [server_row] + tail
    return out[:MAX_ACTIONS_PER_TURN]


def coerce_companion_chat_reply_when_doc_body_action(
    reply: str,
    user_line: str,
    actions: list[dict[str, Any]],
) -> str:
    if not any(isinstance(a, dict) and str(a.get("type") or "").strip() == "doc_editor_set_body" for a in actions):
        return reply
    del reply
    cy = any("\u0400" <= ch <= "\u04ff" for ch in (user_line or ""))
    if companion_user_intent_translate_replace_editor(user_line):
        return (
            "Готово: полный текст в открытом редакторе заменён переводом. "
            "Проверь результат и сохрани документ при необходимости."
            if cy
            else (
                "Done: the open editor document was fully replaced with the translation. "
                "Review the result and save if needed."
            )
        )
    return (
        "Готово: текст в редакторе заменён по твоей просьбе. Проверь форматирование и сохрани документ при необходимости."
        if cy
        else ("Done: the editor document body was replaced per your request. Review formatting and save if needed.")
    )


async def _translate_plain_chunks(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model: str,
    timeout: httpx.Timeout,
    chunks: list[str],
    target_lang: str,
) -> list[str] | None:
    out: list[str] = []
    for i, ch in enumerate(chunks):
        from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": get_prompt_block("workflow.doceditor_translate"),
            },
            {
                "role": "user",
                "content": f"Target language: {target_lang}\n\nChunk {i + 1}/{len(chunks)}:\n\n{ch}",
            },
        ]
        try:
            data = await httpx_compat_chat_completion_json(
                client,
                base_url,
                model=model,
                messages=messages,
                options={"temperature": 0.2, "num_predict": 8192},
                timeout=timeout,
            )
        except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
            logger.warning("companion_doc_translate_chunk_failed idx=%s err=%s", i, exc)
            return None
        piece = str(data.get("response", "") or "").strip()
        if not piece:
            logger.warning("companion_doc_translate_chunk_empty idx=%s", i)
            return None
        out.append(piece)
    return out


async def augment_companion_doc_editor_translate_actions(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model: str,
    timeout: httpx.Timeout,
    user_line: str,
    actions: list[dict[str, Any]],
    content_catalog_user_id: str | None,
    shell_norm: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    """Optionally prepend ``doc_editor_set_body`` when translate+replace intent matches and load succeeds."""

    if not companion_doc_body_translate_enabled():
        return actions
    uid_str = (content_catalog_user_id or "").strip()
    if not uid_str:
        return actions
    if not companion_user_intent_translate_replace_editor(user_line):
        return actions
    uc_raw = resolve_doc_editor_unified_id_for_shell(shell_norm)
    if not uc_raw:
        logger.info("[STEP] companion_doc_body_translate skipped no_uc_in_shell")
        return actions
    try:
        uc = UUID(str(uc_raw).strip())
    except ValueError:
        return actions

    max_dl = _env_int(os.getenv(_MAX_DOWNLOAD_BYTES_ENV), 4_000_000, lo=10_000, hi=20_000_000)
    max_html = _env_int(os.getenv(_MAX_ACTION_HTML_CHARS_ENV), 250_000, lo=5_000, hi=1_000_000)
    chunk_sz = _env_int(os.getenv(_TRANSLATE_CHUNK_CHARS_ENV), 5_000, lo=500, hi=30_000)

    try:
        import asyncpg  # type: ignore[import-not-found]

        from api.core.database_manager import get_asyncpg_pool
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_translate_import_failed err=%s", exc)
        return actions

    pool = await get_asyncpg_pool()
    if pool is None or not isinstance(pool, asyncpg.Pool):
        return actions

    storage_factory = get_storage_factory(pool)
    storage = ContentStorageService(pool, storage_factory, AuditLogger(pool))

    try:
        file_data, meta = await storage.read_file_bytes_for_owner(uc, uid_str)
    except (ValueError, PermissionError) as exc:
        logger.info("companion_doc_body_translate_read_denied content_id=%s err=%s", uc, exc)
        return actions
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_translate_read_failed content_id=%s err=%s", uc, exc)
        return actions

    if not file_data or len(file_data) > max_dl:
        logger.info(
            "companion_doc_body_translate_skip size=%s max=%s",
            len(file_data or b""),
            max_dl,
        )
        return actions

    # Heuristic: skip obvious binaries
    if b"\x00" in file_data[:4096]:
        logger.info("companion_doc_body_translate_skip binary_nulls")
        return actions

    normalized = normalize_text_document(
        file_data,
        filename=str(meta.get("original_filename") or meta.get("name") or ""),
        mime_type=str(meta.get("mime_type") or ""),
    )
    plain = normalized.plain_text.strip()
    if not plain or len(plain) < 3:
        return actions

    target = parse_target_language_label(user_line)
    units = _plain_to_chunk_paragraphs(plain, chunk_sz)
    if not units:
        return actions

    translated = await _translate_plain_chunks(
        client,
        base_url=base_url,
        model=model,
        timeout=timeout,
        chunks=units,
        target_lang=target,
    )
    if translated is None:
        return actions

    body_html = _reassemble_translated_units(translated)
    safe_html = _sanitize_body_html_for_action(body_html, max_html)
    if not safe_html:
        return actions

    rationale = f"DocEditor: translated to {target[:40]}"
    row = build_doc_editor_set_body_action(
        body_html=safe_html,
        unified_content_id=str(uc),
        rationale=rationale,
    )
    logger.info(
        "[STEP] companion_doc_body_translate ok content_id=%s chunks=%s out_chars=%s",
        uc,
        len(units),
        len(safe_html),
    )
    return merge_actions_prepend_doc_editor_set_body(row, actions)


__all__ = (
    "augment_companion_doc_editor_translate_actions",
    "build_doc_editor_set_body_action",
    "coerce_companion_chat_reply_when_doc_body_action",
    "companion_doc_body_translate_enabled",
    "companion_user_intent_translate_replace_editor",
    "merge_actions_prepend_doc_editor_set_body",
    "parse_target_language_label",
    "resolve_doc_editor_unified_id_for_shell",
)
