# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Default** companion branch (2026-05 onwards): full **storage** replace of a user document (catalog search →
# owner read → HTTP LLM → format-specific sanitize → ``replace_file_content``). Output format follows the
# **catalogue file name**: ``.html`` → TipTap-safe HTML; ``.md`` → Markdown; ``.txt`` → plain text.
# Matches narrow **full-replace** verbs, **named-file edit** intents (same idea as orchestrator ``_DOC_EDIT_RE`` without requiring
# an open DocEditor ``uc``), or **write/compose** into a file when a concrete filename/query is in the line.
# If the catalogue is empty and the line names a new **md / txt / html** file, creates a placeholder document first
# (body includes a random suffix so **hash dedup** does not return an unrelated existing file; filename parsed with
# narrow regexes so RU prose is not mistaken for the basename), then runs the same pipeline.
# Optional ``open_app`` DocEditor only when the same line clearly asks to open after editing.
# Invariants:
# - If the line does not match any server-first intent gate or no file phrase resolves, return ``None`` (next branch
#   in the orchestrator is tried; eventual LLM chat-fallback is the last resort).
# - Auto-create is limited to **.md / .txt / .html** (no PDF/office through this path).
# - Before autocreate, exact-name lookup in EwaFile reuses the existing UC id (no second file).
# - ``replace_file_content`` snapshots previous body into ``content_versions`` before overwrite (SSOT in storage).
# - Never executes when ``EWA_COMPANION_SERVER_FIRST_V2=0``. As of 2026-05-12 the per-user **learned preference** is
#   **deprecated** — see ``documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md``; the branch fires whenever
#   ``content_catalog_user_id`` is present and the master env flag is on. ``server_first_v2_enabled_from_learned_preferences``
#   is kept readable for backward compat but is **ignored** in routing.
# - ``pool`` argument to ``maybe_handle_server_first_v2_turn`` is the **main** app asyncpg pool (same DB as
#   ``unified_content``); orchestration passes ``get_asyncpg_pool()``, not the EWA companion DB pool.
# - That main DB must contain ``unified_content`` (migrations applied); otherwise the user gets an explicit hint.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/storage/catalog_file_discuss.py (shared ``companion_catalog_line_names_file`` gate)
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/ewa_platform/companion/storage/doceditor_edit_body.py (HTML / Markdown / plain sanitizers)
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# ---
"""Companion **server-first v2**: narrow full-document rewrite persisted to unified storage."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import asyncpg
import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.storage.catalog_pipeline import (
    FILE_EXT_IN_LINE_RE as _FILE_EXT_IN_LINE_RE,
)
from api.ewa_platform.companion.storage.catalog_pipeline import (
    catalog_pick_owner_row,
    env_int_clamped,
    make_content_storage_service,
    reply_unified_content_schema_missing,
    server_first_body_format,
    server_first_target_filename,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    extract_doc_search_phrase,
    merge_doceditor_open_with_unified_id,
    normalize_doc_open_phrase_after_extract,
)
from api.ewa_platform.companion.storage.doceditor_edit_body import (
    sanitize_companion_doc_body_html,
    sanitize_companion_server_first_markdown,
    sanitize_companion_server_first_plaintext,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)


LEARNED_PREF_SERVER_FIRST_V2_KEY = "ewa_companion_server_first_v2"
_SERVER_FIRST_V2_ENV = "EWA_COMPANION_SERVER_FIRST_V2"
# Deprecated 2026-05 (server-only migration): the catalog-rollout env knob is no longer required because the branch
# is the default. Kept as a name constant to avoid breaking external references / docs; ``server_first_v2_branch_enabled_for_turn``
# does **not** consult it any more.
_SERVER_FIRST_WITH_CATALOG_ENV_DEPRECATED = "EWA_COMPANION_SERVER_FIRST_V2_WITH_CATALOG"

_MAX_DOWNLOAD_BYTES_ENV = "EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES"
_MAX_ACTION_HTML_CHARS_ENV = "EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS"
_MAX_EDIT_PROMPT_BODY_ENV = "EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS"


_FULL_REPLACE_INTENT_RE = re.compile(
    r"(?is)(?:"
    r"полностью\s+перепиш|полностью\s+перепис|"
    r"(?:полностью\s+)?замени\s+содержим|"
    r"перепиши\s+(?:весь|всё|все)\s+|"
    r"замени\s+(?:всё|все|полный|полное)\s+содержим|"
    r"замен\w*\s+содержим\w*\s+(?:файл|документ|целиком)|"
    r"перезапис\w*\s+(?:файл|документ|содержим)|"
    r"полная\s+замен\w*\s+(?:содержим|текст|файл)|"
    r"replace\s+(?:the\s+)?entire\s+(?:file\s+)?(?:content|body|text|document)|"
    r"rewrite\s+(?:the\s+)?(?:whole|entire)\s+(?:file\s+)?(?:content|body|document)|"
    r"full(?:\s+body)?\s+replac\w*"
    r")",
)

# “Open after save” on the same user line (RU / EN).
_OPEN_AFTER_EDIT_RE = re.compile(
    r"(?is)(?:"
    r"(?:и\s+|а\s+)?(?:потом\s+|затем\s+)?(?:открой|покажи)\s+(?:в\s+)?(?:редактор|ultimate|doc)"
    r"|открой\s+(?:в\s+)?(?:редактор\w*\s+документ|ultimate\s*doc|doc\s*editor)"
    r"|(?:and\s+)?(?:then\s+)?open\s+(?:it\s+)?(?:in\s+)?(?:the\s+)?(?:doc|document|ultimate)\s*editor"
    r"|\bopen\s+in\s+(?:the\s+)?(?:doc|document|ultimate)\s*editor\b"
    r")",
)


# ``_FILE_EXT_IN_LINE_RE`` comes from ``storage.catalog_pipeline`` (imported above).

# For **auto-create** when the catalogue is empty: only types server-first can safely rewrite as text.
# Order matters: ``\w``-based patterns swallow RU prose (e.g. «Полностью перепиши 888.md» → wrong span).
_SERVER_FIRST_AUTOC_FILENAMES: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b[0-9]+\.(?:md|txt|html?)\b", re.IGNORECASE),
    re.compile(
        r"\b[A-Za-z0-9](?:[A-Za-z0-9._\-]| (?=[A-Za-z0-9._\-])){0,118}\.(?:md|txt|html?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b[А-Яа-яЁёЇїІіЄєҐґ](?:[А-Яа-яЁёЇїІіЄєҐґ0-9._\-]| (?=[А-Яа-яЁёЇїІіЄєҐґ0-9._\-])){0,118}\.(?:md|txt|html?)\b",
    ),
)


def _first_autocreate_filename_in_line(user_line: str) -> str | None:
    for rx in _SERVER_FIRST_AUTOC_FILENAMES:
        m = rx.search(user_line)
        if m:
            return m.group(0).strip()
    return None


# Named-file **edit** without requiring an open editor shell (aligned with ``task_orchestrator._DOC_EDIT_RE``).
_DOC_EDIT_NAMED_FILE_RE = re.compile(
    r"(?is)(?:отредактиру|редактир|исправ|поправ|перепиш|переформатир|измени|edit|rewrite|reformat|fix).{0,120}"
    r"(?:документ|файл|редактор|document|file|editor)"
)

# User asks to **write/compose** body content into a file they name in the same line (still owner storage rewrite).
_WRITE_OR_COMPOSE_IN_FILE_RE = re.compile(
    r"(?is)(?:"
    r"напиши|написать|запиши|записать|сочини|сочинить|вставь|добавь|напечатай|"
    r"write|compose|author|fill"
    r")\b"
)


def companion_catalog_line_names_file(user_line: str) -> bool:
    """True when the line names or searches a catalogue file (extension / extract_doc_search_phrase heuristics)."""

    return _has_resolvable_named_file_reference(user_line)


def _has_resolvable_named_file_reference(user_line: str) -> bool:
    """True when ``extract_doc_search_phrase`` / extension heuristics yield a concrete file hint."""

    raw_phrase = extract_doc_search_phrase(user_line)
    norm = normalize_doc_open_phrase_after_extract(raw_phrase)
    if norm and len(norm.strip()) >= 2:
        return True
    return bool(_FILE_EXT_IN_LINE_RE.search(user_line))


def server_first_v2_env_enabled() -> bool:
    raw = os.getenv(_SERVER_FIRST_V2_ENV)
    if raw is None:
        return True
    return str(raw).strip().lower() not in {"0", "false", "no", "off"}


def server_first_v2_enabled_from_learned_preferences(lp: Mapping[str, Any] | None) -> bool:
    """Read toggle from ``learned_preferences``; default **off**."""

    if not isinstance(lp, Mapping):
        return False
    raw = lp.get(LEARNED_PREF_SERVER_FIRST_V2_KEY)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return bool(raw)
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(raw, Mapping):
        inner = raw.get("enabled")
        if isinstance(inner, bool):
            return inner
        if isinstance(inner, str):
            return inner.strip().lower() in {"1", "true", "yes", "on"}
    return False


def server_first_v2_branch_enabled_for_turn(
    lp: Mapping[str, Any] | None,
    *,
    content_catalog_user_id: str | None,
) -> bool:
    """Whether the orchestrator should run ``maybe_handle_server_first_v2_turn`` before generic chat fallback.

    Server-first v2 is the **default** branch (2026-05). The per-user learned preference
    ``ewa_companion_server_first_v2`` is **kept for read-only backward compatibility** but ignored in routing —
    see ``documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md``. Operators can fully disable the branch
    cluster-wide via ``EWA_COMPANION_SERVER_FIRST_V2=0`` (master kill-switch).

    Args:
        lp: legacy ``learned_preferences`` mapping; **not read** for the routing decision. Kept for stable signature
            and to avoid touching every chat_turn callsite while phasing out the toggle.
        content_catalog_user_id: required — the branch is meaningful only when a catalog owner is resolvable.
    """

    _ = lp  # deprecated 2026-05; intentionally unused
    if not server_first_v2_env_enabled():
        return False
    return bool((content_catalog_user_id or "").strip())


def user_line_requests_open_after_server_first_v2(user_line: str) -> bool:
    return bool(isinstance(user_line, str) and _OPEN_AFTER_EDIT_RE.search(user_line))


def companion_user_intent_server_first_v2_full_replace(user_line: str) -> bool:
    """Gate server-first v2: full-replace verbs, named-file edit, or write/compose into a named file."""

    if not isinstance(user_line, str) or not user_line.strip():
        return False
    if _FULL_REPLACE_INTENT_RE.search(user_line):
        return _has_resolvable_named_file_reference(user_line)
    if not _has_resolvable_named_file_reference(user_line):
        return False
    return bool(_DOC_EDIT_NAMED_FILE_RE.search(user_line) or _WRITE_OR_COMPOSE_IN_FILE_RE.search(user_line))


def _explicit_creatable_filename_for_server_first(
    search_phrase: str | None,
    user_line: str,
) -> str | None:
    """Return a bare filename if the user named a **new** text document we may create (md/txt/html)."""

    fn_line = _first_autocreate_filename_in_line(user_line)
    if fn_line:
        return fn_line
    sp = (search_phrase or "").strip()
    if sp and re.search(r"\.(?:md|txt|html?)$", sp, re.IGNORECASE):
        return sp
    return None


async def _try_create_missing_named_file_for_server_first(
    *,
    pool: asyncpg.Pool,
    content_catalog_user_id: str,
    user_line: str,
    search_phrase: str | None,
    ru: bool,
) -> tuple[UUID | None, str | None, str | None]:
    """Create an owner placeholder document when catalogue search returned zero rows.

    Returns ``(new_uc, sanitized_name, error_reply)``. ``(None, None, None)`` means “cannot / should not auto-create”.
    """

    raw_name = _explicit_creatable_filename_for_server_first(search_phrase, user_line)
    if not raw_name:
        return None, None, None

    from api.ewa_platform.companion.storage.catalog_pipeline import (
        create_unified_companion_document,
        find_owner_ewa_file_by_exact_name,
        sanitize_companion_new_filename,
    )

    name_s = sanitize_companion_new_filename(raw_name)
    storage = make_content_storage_service(pool)
    want_key = name_s.strip().lower()

    existing = await find_owner_ewa_file_by_exact_name(
        content_user_id=content_catalog_user_id,
        name=name_s,
    )
    if existing is not None:
        raw_cid = getattr(existing, "id", None)
        if raw_cid is not None:
            try:
                logger.info(
                    "companion_server_first_v2_autocreate_reuse_existing name=%r uc=%s",
                    name_s,
                    raw_cid,
                )
                return UUID(str(raw_cid).strip()), name_s, None
            except ValueError:
                pass

    def _row_matches_expected(created_obj: Any) -> bool:
        cand = (
            (getattr(created_obj, "name", None) or "")
            or (getattr(created_obj, "original_filename", None) or "")
            or (getattr(created_obj, "title", None) or "")
        )
        return str(cand).strip().lower() == want_key

    _quota_ru = "Квота хранилища заполнена — освободите место в каталоге или удалите лишние файлы."
    _quota_en = "Storage quota is full — free space in your catalogue or remove files."
    _generic_ru = "Не удалось создать новый файл в каталоге (квота, лимит или ошибка хранилища)."
    _generic_en = "Could not create a new catalogue file (quota, limits, or storage error)."

    for attempt in range(1, 5):
        placeholder_body = f"ewa-companion-draft:{name_s}:{uuid4().hex}"
        try:
            created = await create_unified_companion_document(
                storage,
                content_user_id=content_catalog_user_id,
                name=name_s,
                body=placeholder_body,
            )
        except asyncpg.exceptions.UndefinedTableError as exc:
            logger.error(
                "companion_server_first_v2_unified_content_missing_on_create name=%s err=%s",
                name_s,
                exc,
            )
            return None, None, reply_unified_content_schema_missing(ru=ru)
        except ValueError as exc:
            es = str(exc).lower()
            if "quota" in es:
                logger.info("companion_server_first_v2_create_missing_quota name=%s err=%s", name_s, exc)
                return None, None, (_quota_ru if ru else _quota_en)
            logger.warning(
                "companion_server_first_v2_create_missing_failed name=%s err=%s",
                name_s,
                exc,
            )
            return None, None, (_generic_ru if ru else _generic_en)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "companion_server_first_v2_create_missing_failed name=%s type=%s err=%s",
                name_s,
                type(exc).__name__,
                exc,
            )
            return None, None, (_generic_ru if ru else _generic_en)

        if not _row_matches_expected(created):
            logger.info(
                "companion_server_first_v2_autocreate_dedup_name_mismatch wanted=%r attempt=%s",
                name_s,
                attempt,
            )
            continue

        raw_cid = getattr(created, "id", None)
        if raw_cid is None:
            msg = (
                "Создала черновик, но не смогла прочитать идентификатор файла."
                if ru
                else "Created a draft but could not read the file identifier."
            )
            return None, None, msg
        try:
            return UUID(str(raw_cid).strip()), name_s, None
        except ValueError:
            msg = "Идентификатор нового файла повреждён." if ru else "The new file id is invalid."
            return None, None, msg

    logger.warning("companion_server_first_v2_autocreate_gave_wrong_row_after_retries name=%s", name_s)
    return None, None, (_generic_ru if ru else _generic_en)


async def maybe_handle_server_first_v2_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    write_mode: str = "replace",
) -> dict[str, Any] | None:
    """Handle one v2 turn or return ``None`` to fall through to classic orchestration + LLM.

    Args:
        pool: **Main** application asyncpg pool (``DATABASE_URL`` / ``unified_content``). Do **not** pass the EWA
            orchestration pool (``EWA_DATABASE_URL``).
    """

    _ = principal_id
    if not server_first_v2_env_enabled():
        return None
    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None
    if not companion_user_intent_server_first_v2_full_replace(user_line):
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)

    picked_row, search_phrase, merged_items = await catalog_pick_owner_row(
        content_catalog_user_id=uid,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        user_line=user_line,
    )

    created_fresh_name: str | None = None
    uc: UUID

    if not merged_items:
        uc_try, created_name, err_create = await _try_create_missing_named_file_for_server_first(
            pool=pool,
            content_catalog_user_id=uid,
            user_line=user_line,
            search_phrase=search_phrase,
            ru=ru,
        )
        if err_create:
            return {"reply": err_create, "actions": [], "task_run": None}
        if uc_try is None:
            msg = (
                "Не нашла такой файл в твоём каталоге — уточни имя или добавь расширение ``.md`` / ``.txt`` / ``.html``, "
                "если нужен **новый** файл."
                if ru
                else "I could not find that file in your catalogue — clarify the name, or use a **new** ``.md`` / ``.txt`` "
                "/ ``.html`` filename if you want me to create it."
            )
            return {"reply": msg, "actions": [], "task_run": None}
        uc = uc_try
        created_fresh_name = created_name
        picked = SimpleNamespace(id=uc, name=created_name or "")
        logger.info(
            "companion_server_first_v2_autocreated_file name=%r uc=%s",
            created_name,
            uc,
        )
    else:
        picked = picked_row
        if picked is None and len(merged_items) == 1:
            picked = merged_items[0]
        if picked is None:
            msg = (
                "Нашла несколько совпадений — напиши точнее, какой файл (имя целиком или коротко что выбрать)."
                if ru
                else "Several files matched — please specify which one (full name or a clearer hint)."
            )
            return {"reply": msg, "actions": [], "task_run": None}

        raw_id = getattr(picked, "id", None)
        if raw_id is None:
            msg = "Не удалось прочитать идентификатор файла." if ru else "Could not read the file identifier."
            return {"reply": msg, "actions": [], "task_run": None}
        try:
            uc = UUID(str(raw_id).strip())
        except ValueError:
            msg = "Идентификатор файла повреждён." if ru else "The file id looks invalid."
            return {"reply": msg, "actions": [], "task_run": None}

    max_dl = env_int_clamped(os.getenv(_MAX_DOWNLOAD_BYTES_ENV), 4_000_000, lo=10_000, hi=20_000_000)
    max_html_out = env_int_clamped(os.getenv(_MAX_ACTION_HTML_CHARS_ENV), 250_000, lo=5_000, hi=1_000_000)
    max_body_prompt = env_int_clamped(os.getenv(_MAX_EDIT_PROMPT_BODY_ENV), 180_000, lo=2_000, hi=420_000)

    storage = make_content_storage_service(pool)
    content_version: int | None = None
    try:
        content_meta = await storage.get_content(uc, uid)
        content_version = int(content_meta.version or 0)
        logger.info(
            "[STEP] file_rewrite_version_fetch content_id=%s version=%s",
            uc,
            content_version,
        )
    except (ValueError, PermissionError) as exc:
        logger.info("companion_server_first_v2_meta_denied content_id=%s err=%s", uc, exc)
        msg = (
            "Нет доступа к этому файлу — только владелец может перезаписать его так."
            if ru
            else "No access to overwrite this file like that — owner-only."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_server_first_v2_meta_failed content_id=%s err=%s", uc, exc)
        msg = "Не удалось прочитать метаданные файла." if ru else "Could not read file metadata."
        return {"reply": msg, "actions": [], "task_run": None}

    try:
        file_data, _meta = await storage.read_file_bytes_for_owner(uc, uid)
    except asyncpg.exceptions.UndefinedTableError as exc:
        logger.error(
            "companion_server_first_v2_unified_content_missing_on_read content_id=%s err=%s",
            uc,
            exc,
        )
        return {
            "reply": reply_unified_content_schema_missing(ru=ru),
            "actions": [],
            "task_run": None,
        }
    except (ValueError, PermissionError) as exc:
        logger.info("companion_server_first_v2_read_denied content_id=%s err=%s", uc, exc)
        msg = (
            "Нет доступа к этому файлу — только владелец может перезаписать его так."
            if ru
            else "No access to overwrite this file like that — owner-only."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_server_first_v2_read_failed content_id=%s err=%s", uc, exc)
        msg = "Не удалось прочитать файл из хранилища." if ru else "Could not read the file from storage."
        return {"reply": msg, "actions": [], "task_run": None}

    if not file_data or len(file_data) > max_dl:
        logger.info("companion_server_first_v2_skip size=%s max=%s", len(file_data or b""), max_dl)
        msg = (
            "Файл слишком большой для этой операции — разбейте задачу или сократите документ."
            if ru
            else "The file is too large for this operation — shorten it or split the task."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    if b"\x00" in file_data[:4096]:
        msg = (
            "Похоже на двоичный файл — полную замену текста здесь не сделаю."
            if ru
            else "This looks binary — cannot replace text here."
        )
        return {"reply": msg, "actions": [], "task_run": None}

    try:
        stored = file_data.decode("utf-8")
    except UnicodeDecodeError:
        stored = file_data.decode("utf-8", errors="replace")

    stored = stored.strip()
    if not stored or len(stored) < 2:
        msg = "Файл пустой или слишком короткий." if ru else "The file is empty or too short."
        return {"reply": msg, "actions": [], "task_run": None}

    doc_blob = stored if len(stored) <= max_body_prompt else stored[: max_body_prompt - 1].rstrip() + "…"

    target_fn = server_first_target_filename(
        created_fresh_name=created_fresh_name,
        picked=picked,
        search_phrase=search_phrase,
    )
    body_fmt = server_first_body_format(target_fn)

    base = unified_settings.llama_url.strip().rstrip("/")
    if not base:
        msg = "Сервис генерации недоступен на этой среде." if ru else "The generation service is not configured."
        return {"reply": msg, "actions": [], "task_run": None}

    model_raw = (
        os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()

    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_CHAT_TIMEOUT_SEC", "180").strip() or "180")
    except ValueError:
        timeout_sec = 180.0
    timeout_sec = max(30.0, min(timeout_sec, 600.0))
    timeout = httpx.Timeout(timeout_sec)

    if body_fmt == "markdown":
        system = (
            "You rewrite **Markdown** (.md) documents stored in the user's EliteEW content catalogue.\n"
            "The user wants a **full replacement** of the file body following their instruction.\n"
            "- Output ONLY the **complete new document** as CommonMark-friendly Markdown (no preamble).\n"
            "- Do **not** wrap the entire answer in a markdown code fence.\n"
            "- Prefer headings (#/##), lists (-/1.), **bold**, *italic*, blockquotes (>), fenced code blocks only for "
            "real code or verbatim data.\n"
            "- Do **not** emit raw HTML tags unless the user explicitly asks for HTML samples in the document.\n"
            "- Preserve factual meaning unless they explicitly ask to fictionalize or replace with new content.\n"
            "- If CURRENT_DOCUMENT is HTML, convert its structure faithfully into Markdown.\n"
        )
        user_blob = (
            f"User instruction (match chat language for tone; **output = Markdown only**):\n{user_line.strip()}\n\n"
            f"CURRENT_DOCUMENT:\n{doc_blob}\n"
        )
    elif body_fmt == "plaintext":
        system = (
            "You rewrite **plain text** (.txt) files in the user's EliteEW content catalogue.\n"
            "The user wants a **full replacement** of the file body following their instruction.\n"
            "- Output ONLY the **complete new file** as plain UTF-8 text (no preamble).\n"
            "- **No HTML tags**, no Markdown (no # headings, no **bold**, no lists with - or *, no backtick fences) "
            "unless the user explicitly asks to store those characters verbatim as content.\n"
            "- Use blank lines between paragraphs; Unicode punctuation is allowed.\n"
            "- Preserve factual meaning unless they explicitly ask to fictionalize or replace with new content.\n"
            "- If CURRENT_DOCUMENT is HTML or Markdown, convert to readable plain text (drop markup).\n"
        )
        user_blob = (
            "User instruction (match chat language for tone; **plain text only**):\n"
            f"{user_line.strip()}\n\n"
            f"CURRENT_DOCUMENT:\n{doc_blob}\n"
        )
    else:
        system = (
            "You rewrite documents for EliteEW Ultimate Doc Editor (TipTap-compatible HTML).\n"
            "The user wants a **full replacement** of the stored file body following their instruction.\n"
            "- Output ONLY the **full new document body** as HTML fragments (no preamble, no markdown fences).\n"
            "- Preserve factual meaning unless they explicitly ask to fictionalize or replace with new content.\n"
            "- Allowed tags: p, br, hr, strong, b, em, i, u, s, ul, ol, li, h1–h4, blockquote, pre, code, div, span (no "
            "inline styles/events), a[href http/https/mailto/#/relative path only].\n"
            "- Do not emit script, style, iframes, inline JS, SVG, forms, base64 blobs, event handlers.\n"
            "- If CURRENT_DOCUMENT looks like Markdown/plain, convert it faithfully into semantic HTML headings/lists/etc.\n"
        )
        user_blob = (
            f"User instruction (same chat language matters for tone, structure is HTML):\n{user_line.strip()}\n\n"
            f"CURRENT_DOCUMENT:\n{doc_blob}\n"
        )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_blob},
    ]

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            data = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model_raw,
                messages=messages,
                options={"temperature": 0.35, "num_predict": 12000},
                timeout=timeout,
            )
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("companion_server_first_v2_llm_failed content_id=%s err=%s", uc, exc)
        msg = (
            "Не удалось получить новый текст от сервиса генерации."
            if ru
            else "Could not get new text from the generation service."
        )
        return {"reply": msg, "actions": [], "task_run": None}

    piece_raw = str(data.get("response", "") or "").strip()
    if body_fmt == "markdown":
        piece = sanitize_companion_server_first_markdown(piece_raw)
    elif body_fmt == "plaintext":
        piece = sanitize_companion_server_first_plaintext(piece_raw)
    else:
        piece = sanitize_companion_doc_body_html(piece_raw)
    if not piece:
        logger.warning("companion_server_first_v2_empty_after_sanitize content_id=%s", uc)
        msg = (
            "Модель вернула пустой текст после проверки безопасности."
            if ru
            else "The model returned empty text after safety checks."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    if len(piece) > max_html_out:
        piece = piece[:max_html_out].rstrip()

    mime_write = "text/markdown" if body_fmt == "markdown" else "text/plain" if body_fmt == "plaintext" else "text/html"
    mode = str(write_mode or "replace").strip().lower()

    try:
        from api.services.unified_content.content_blocks import new_content_block
        from api.services.unified_content.content_storage_service import ContentVersionConflictError

        if mode == "append":
            block_type = "markdown" if body_fmt == "markdown" else "plaintext" if body_fmt == "plaintext" else "text"
            author_role = str(os.getenv("EWA_COMPANION_FILE_REWRITE_AUTHOR_ROLE", "agent")).strip() or "agent"
            block = new_content_block(
                content=piece,
                block_type=block_type,
                author_role=author_role,
            )
            await storage.append_to_content(
                uc,
                uid,
                [block.model_dump(mode="json")],
                expected_version=int(content_version or 0),
            )
            logger.info(
                "[STEP] file_rewrite_append_block content_id=%s block_id=%s role=%s expected_version=%s result=success",
                uc,
                block.id,
                author_role,
                content_version,
            )
        else:
            await storage.replace_file_content(
                uc,
                uid,
                piece.encode("utf-8"),
                mime_type=mime_write,
                expected_version=content_version,
                change_description="EWA companion file_rewrite (previous body snapshot)",
            )
            logger.info(
                "[STEP] file_rewrite_version_write content_id=%s expected_version=%s result=success",
                uc,
                content_version,
            )
    except ContentVersionConflictError as exc:
        logger.info(
            "[STEP] file_rewrite_version_conflict content_id=%s expected_version=%s current_version=%s",
            uc,
            exc.expected_version,
            exc.current_version,
        )
        msg = (
            "Файл изменился, пока готовился новый текст — открой документ и повтори запрос."
            if ru
            else "The file changed while new text was being prepared — open the document and try again."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    except (PermissionError, ValueError) as exc:
        logger.info("companion_server_first_v2_write_denied content_id=%s err=%s", uc, exc)
        msg = (
            "Не удалось записать файл (нет прав или файл недоступен)."
            if ru
            else "Could not write the file (permissions or access)."
        )
        return {"reply": msg, "actions": [], "task_run": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_server_first_v2_write_failed content_id=%s err=%s", uc, exc)
        msg = "Не удалось сохранить новый текст в хранилище." if ru else "Could not save the new text to storage."
        return {"reply": msg, "actions": [], "task_run": None}

    label = (getattr(picked, "name", None) or search_phrase or "").strip()[:80]
    if mode == "append":
        ok_msg = (
            f"Готово: добавила новый блок в «{label}» без перезаписи остального документа."
            if ru
            else f"Done: appended a new block to «{label}» without rewriting the rest."
        )
    else:
        ok_msg = (
            f"Готово: сохранила новую версию «{label}»; предыдущее тело можно вернуть во вкладке «Версии»."
            if ru
            else f"Done: saved a new version of «{label}»; you can restore the previous body in the Versions tab."
        )
    if created_fresh_name:
        ok_msg += (
            " Файл в каталоге был создан как новый (или переиспользован по имени)."
            if ru
            else " Catalogue file was created as new (or reused by exact name)."
        )

    actions: list[dict[str, Any]] = []
    if user_line_requests_open_after_server_first_v2(user_line):
        rationale = f"Opened after server rewrite: {label}" if label else "Opened after server rewrite"
        actions = merge_doceditor_open_with_unified_id([], unified_id=str(uc), rationale=rationale)
        if ru and actions:
            ok_msg += " Открываю в редакторе."
        elif actions:
            ok_msg += " Opening in the editor."

    logger.info(
        "[STEP] companion_server_first_v2 ok content_id=%s format=%s chars=%s open=%s",
        uc,
        body_fmt,
        len(piece),
        bool(actions),
    )
    return {"reply": ok_msg, "actions": actions, "task_run": None}


__all__ = (
    "LEARNED_PREF_SERVER_FIRST_V2_KEY",
    "companion_catalog_line_names_file",
    "companion_user_intent_server_first_v2_full_replace",
    "maybe_handle_server_first_v2_turn",
    "server_first_v2_branch_enabled_for_turn",
    "server_first_v2_enabled_from_learned_preferences",
    "server_first_v2_env_enabled",
    "user_line_requests_open_after_server_first_v2",
)
