# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Server-side** grounding for companion ``open_app`` → **DocEditor** and helpers for **Content Manager** merges: resolve
# ``unified_content_id`` via ``ContentQueryService.list_content`` when the user names a document for the editor; expose
# **flattened shell listing** traversal and **`merge_contentmanager_open_for_companion`** for other augment passes.
# Invariants:
# - Lines from ``surface_listing`` (``- name [type] uc=…``) anchor **deictic** follow-ups («его», «this file») on the
#   focused window’s listing when present; else **file focus** stack (recent discuss/list/open) and the current turn
#   catalogue prefetch rows.
# - **`merge_contentmanager_open_for_companion`** allows **`bare_catalog_open`** so companion browse‑all can insert CM
#   without a search filter when no row is focused; companion catalogue merges pass **`content_manager_folder_item_id`**
#   (**``ewa_file``**) so Content Manager opens on the **EwaFile** workspace folder.
# - Uses **main** Postgres (``get_asyncpg_pool``), **not** ``EWA_DATABASE_URL``; failures are non-fatal (skip augmentation).
# - Catalogue ``ILIKE`` is **one contiguous** substring — companion merges extra **token-shaped** queries and scores overlaps
#   so spaced phrases vs hyphenated filenames (e.g. ``finance audit`` vs ``finance-audit``) can still resolve.
# - Opt-out via ``EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH=0``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/storage/catalog_find.py
# - api/ewa_platform/companion/sidecar/shell_listing_ordinals.py
# - api/ewa_platform/companion/sidecar/file_focus.py
# - api/services/unified_content/content_query_service.py
# ---
"""Resolve DocEditor ``open_app.unified_content_id`` from unified_content search (companion chat)."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Any
from uuid import UUID

from api.ewa_platform.companion.actions import MAX_ACTIONS_PER_TURN, _normalize_action, _opaque_id
from api.utils.ewa_companion_folder import companion_list_content_kwargs

logger = logging.getLogger(__name__)


async def companion_content_query_service_optional() -> Any | None:
    """Build ``ContentQueryService`` on the **main** API pool; ``None`` if storage stack is unavailable."""

    try:
        import asyncpg  # type: ignore[import-not-found]

        from api.core.database_manager import get_asyncpg_pool
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_query_service import ContentQueryService
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory

        pool = await get_asyncpg_pool()
        if pool is None or not isinstance(pool, asyncpg.Pool):
            return None
        storage_factory = get_storage_factory(pool)
        storage = ContentStorageService(pool, storage_factory, AuditLogger(pool))
        return ContentQueryService(storage)
    except Exception as exc:  # noqa: BLE001 — optional path; never break chat.
        logger.warning("companion_content_query_service_unavailable err=%s", exc)
        return None


_DOCISH_TYPES: frozenset[str] = frozenset({"document", "presentation", "spreadsheet", "other"})

_DOC_CTX_RE = re.compile(
    r"(?:редактор[аеоу]?\s+документ"
    r"|(?:\bв\s+)?редактор(?:е|а|у|ом|)\b"
    r"|ultimate\s*doc\b"
    r"|doc\s*editor\b"
    r"|document\s+editor\b"
    r"|doceditor\b"
    r"|(?:\bin\s+the\s+)?editor\b)",
    re.IGNORECASE,
)
_OPEN_VERB_RE = re.compile(
    r"(?:^|[\s,.;:])(?:открой|открыть|откроем|покажи|запусти"
    r"|open|show|launch|bring\s+up)\b",
    re.IGNORECASE,
)
_NON_EXECUTION_QUESTION_RE = re.compile(
    r"(?ix)^\s*(?:как|почему|зачем|how|why|what)\b",
)

_QUOTED_RE = re.compile(r"«([^»]{1,240})»|\"([^\"]{1,240})\"|'([^']{1,240})'")

_BRIDGE_RE = re.compile(
    r"(?:открой|открыть|покажи|open|show|launch)\s+"
    r"(?:me\s+|мне\s+|the\s+|a\s+|an\s+|файл\s+)?"
    r"(.+?)"
    r"(?:\s+в\s+редактор(?:е|а|у|ом|)\b"
    r"|\s+в\s+(?:ultimate\s*doc|doc\s*editor)\b"
    r"|\s+in\s+(?:the\s+)?(?:doc|document|ultimate)\s*editor\b)",
    re.IGNORECASE | re.DOTALL,
)

_TAIL_RU_AFTER_VERB_RE = re.compile(
    r"(?:открой|открыть|покажи|запусти|откроем)\s+(?:мне\s+)?(?:файл\s+)?(.+?)\s*$",
    re.IGNORECASE | re.DOTALL,
)
_TAIL_EN_AFTER_VERB_RE = re.compile(
    r"(?:open|show|launch)\s+(?:me\s+|the\s+|my\s+|a\s+|an\s+)?(?:file\s+)?(.+?)\s*$",
    re.IGNORECASE | re.DOTALL,
)

_EXT_RE = re.compile(
    r"\b([\w\-.][\w\-. ]{0,118}\.(?:docx?|rtf|md|txt|pdf|odt|pptx?|xlsx?))\b",
    re.IGNORECASE,
)

_EDITOR_SPLIT_RE = re.compile(
    r"(?i)\s+(?:в\s+редактор(?:е|а|у|ом|)|in\s+(?:the\s+)?(?:doc|document|ultimate)\s*editor\b)",
)


def _strip_trailing_editor_clause(phrase: str) -> str:
    """Keep only the portion before ``в редактор …`` / ``in document editor …``."""

    chunk = phrase.strip()
    if not chunk:
        return chunk
    m = _EDITOR_SPLIT_RE.search(chunk)
    if m:
        return chunk[: m.start()].strip()
    return chunk


def _env_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def user_intent_doceditor_open_with_file(user_line: str) -> bool:
    """True when the line both requests opening/showing and references the document editor."""

    u = user_line.strip()
    if len(u) < 8:
        return False
    if _NON_EXECUTION_QUESTION_RE.search(u):
        return False
    return bool(_DOC_CTX_RE.search(u) and _OPEN_VERB_RE.search(u))


def user_line_may_probe_file_open(user_line: str) -> bool:
    """True when the ``file_open`` orchestrator branch should run (cheap pre-gate).

    Covers explicit editor phrases, post-rewrite open tails, and plain catalogue opens
    such as «открой файл notes.md» without requiring the word «редактор» in the line.
    """

    u = (user_line or "").strip()
    if len(u) < 4:
        return False
    if _NON_EXECUTION_QUESTION_RE.search(u):
        return False
    from api.ewa_platform.companion.server_first.v2 import user_line_requests_open_after_server_first_v2

    if user_line_requests_open_after_server_first_v2(u):
        return True
    if user_intent_doceditor_open_with_file(u):
        return True
    if not _OPEN_VERB_RE.search(u):
        return False
    phrase = extract_doc_search_phrase(u)
    if not phrase:
        return False
    return _EXT_RE.search(phrase) is not None


def extract_doc_search_phrase(user_line: str) -> str | None:
    """Prefer quoted names, then bridge ``open X in editor``, then a filename-like token."""

    u = user_line.strip()
    if len(u) < 2:
        return None
    m = _QUOTED_RE.search(u)
    if m:
        inner = next((g for g in m.groups() if g), "").strip()
        if len(inner) >= 2:
            return inner[:500]
    mb = _BRIDGE_RE.search(u)
    if mb:
        phrase = _strip_trailing_editor_clause(re.sub(r"\s+", " ", mb.group(1).strip(" \t,.;:")))
        if len(phrase) >= 2:
            return phrase[:500]
    me = _EXT_RE.search(u)
    if me:
        return me.group(1).strip()[:500]
    mt_ru = _TAIL_RU_AFTER_VERB_RE.search(u.strip())
    if mt_ru:
        tail = re.sub(r"\s+", " ", mt_ru.group(1).strip(" \t,.;:!?«»"))
        tail = _strip_trailing_editor_clause(tail)
        if len(tail) >= 2:
            return tail[:500]
    mt_en = _TAIL_EN_AFTER_VERB_RE.search(u.strip())
    if mt_en:
        tail = re.sub(r"\s+", " ", mt_en.group(1).strip(" \t,.;:!?'\""))
        tail = _strip_trailing_editor_clause(tail)
        if len(tail) >= 2:
            return tail[:500]
    return None


def _content_type_str(obj: Any) -> str:
    ct = getattr(obj, "content_type", None)
    if ct is None:
        return ""
    if hasattr(ct, "value"):
        return str(ct.value)
    return str(ct)


def dedupe_catalog_rows_by_id(rows: Iterable[Any]) -> list[Any]:
    """Stable dedupe preserving first occurrence."""

    seen: set[str] = set()
    out: list[Any] = []
    for r in rows:
        rid = getattr(r, "id", None)
        if rid is None:
            continue
        key = str(rid).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


_NOISE_NEEDLE_WORDS_EN_RU: frozenset[str] = frozenset(
    {
        "the",
        "and",
        "for",
        "with",
        "from",
        "this",
        "that",
        "file",
        "document",
        "txt",
        "pdf",
        "ppt",
        "pptx",
        "docx",
        "xlsx",
        "файл",
        "документ",
        "этот",
        "этой",
        "опен",
    }
)


def needle_tokens_meaningful(needle: str) -> list[str]:
    """Split into word-ish tokens excluding very short/noise Russian+English fragments."""

    out: list[str] = []
    for raw in re.split(r"[^\w.+-]+", needle.strip(), flags=re.UNICODE):
        t = raw.strip().lower().strip(".")
        if len(t) < 3:
            continue
        if t in _NOISE_NEEDLE_WORDS_EN_RU:
            continue
        if t not in out:
            out.append(t)
    return out


def companion_catalog_search_variants(seed_phrase: str) -> list[str]:
    """First full phrase then longest discriminative tokens — multiple ``ILIKE`` rounds."""

    s = seed_phrase.strip()
    uniq: list[str] = []
    if s:
        uniq.append(s)
    for tok in sorted(needle_tokens_meaningful(s.lower()), key=len, reverse=True):
        if tok not in uniq:
            uniq.append(tok)
        if len(uniq) >= 6:
            break
    return uniq[:6]


def _docish_subset(items: list[Any]) -> list[Any]:
    typed = [c for c in items if _content_type_str(c) in _DOCISH_TYPES]
    return typed if typed else list(items)


def _row_name_blob_low(c: Any) -> str:
    n = str(getattr(c, "name", None) or "").strip().lower()
    o = str(getattr(c, "original_filename", None) or "").strip().lower()
    return (n + " " + o).strip()


def _token_overlap_score(blob: str, tokens: list[str]) -> int:
    return sum(len(t) for t in tokens if t and t in blob)


def pick_content_row_for_doc_open(candidates: list[Any], phrase: str) -> Any | None:
    """Pick a single unified_content row when the catalogue search returns overlapping matches."""

    if not candidates or not phrase or not phrase.strip():
        return None
    needle = phrase.strip().lower()
    pool = _docish_subset(candidates)
    tokens = needle_tokens_meaningful(needle)

    def _name_low(x: Any) -> str:
        return str(getattr(x, "name", None) or "").strip().lower()

    def _orig_low(x: Any) -> str:
        return str(getattr(x, "original_filename", None) or "").strip().lower()

    if len(tokens) >= 2:
        narrowed_token = [c for c in pool if all(t in _row_name_blob_low(c) for t in tokens)]
        if len(narrowed_token) == 1:
            return narrowed_token[0]
        if len(narrowed_token) >= 2:

            def _score_overlap_row(c: Any) -> float:
                blob_r = _row_name_blob_low(c)
                sco = float(_token_overlap_score(blob_r, tokens))
                if needle in blob_r:
                    sco += 500.0
                return sco

            ranked_ov = sorted(narrowed_token, key=lambda c: -_score_overlap_row(c))
            if len(ranked_ov) == 1 or _score_overlap_row(ranked_ov[0]) > _score_overlap_row(ranked_ov[1]):
                return ranked_ov[0]
            pool = narrowed_token

    exact_name = [c for c in pool if _name_low(c) == needle]
    if len(exact_name) == 1:
        return exact_name[0]
    exact_ofn = [c for c in pool if _orig_low(c) == needle]
    if len(exact_ofn) == 1:
        return exact_ofn[0]

    needle_path = needle.rsplit("/", maxsplit=1)[-1]
    if needle_path != needle:
        bn = [c for c in pool if _name_low(c) == needle_path or _orig_low(c) == needle_path]
        if len(bn) == 1:
            return bn[0]

    sub = [
        c
        for c in pool
        if needle and ((_name_low(c) and needle in _name_low(c)) or (_orig_low(c) and needle in _orig_low(c)))
    ]
    if len(sub) == 1:
        return sub[0]

    if len(sub) > 1 and tokens:
        scored = sorted(
            sub,
            key=lambda c: (
                -_token_overlap_score(_row_name_blob_low(c), tokens),
                len(_row_name_blob_low(c)),
            ),
        )
        blob0 = _row_name_blob_low(scored[0])
        blob1 = _row_name_blob_low(scored[1])
        sco0 = _token_overlap_score(blob0, tokens)
        sco1 = _token_overlap_score(blob1, tokens)
        if sco0 > sco1:
            return scored[0]
        needle_in_0 = needle in blob0
        needle_in_1 = needle in blob1
        if needle_in_0 != needle_in_1:
            return scored[0] if needle_in_0 else scored[1]

    if len(pool) == 1:
        return pool[0]
    return None


_UC_LISTING_SUFFIX_RE = re.compile(r"(?i)\s+uc=(?P<uc>[^\s]+)\s*$")

_RU_EDITOR_JUNK_PREFIX_RE = re.compile(
    r"(?i)^(?:в\s+)?редактор[а-я]{0,8}\s+документ[а-я]{0,16}\s+",
)

_DEICTIC_TOKENS_LOWER: frozenset[str] = frozenset(
    {
        "его",
        "ее",
        "её",
        "это",
        "этот",
        "эта",
        "эти",
        "эту",
        "тот",
        "та",
        "то",
        "те",
        "их",
        "it",
        "this",
        "that",
        "those",
        "them",
        "him",
        "her",
    }
)


def normalize_doc_open_phrase_after_extract(raw: str | None) -> str | None:
    """Trim leading RU «в редакторе документов» noise so ``его`` / file names stay usable."""

    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    s2 = _RU_EDITOR_JUNK_PREFIX_RE.sub("", s).strip()
    return s2 if s2 else None


def is_deictic_doc_reference(phrase: str | None) -> bool:
    """True for short anaphora («его», «this», …) resolved from the last ``surface_listing`` line."""

    if phrase is None:
        return False
    t = phrase.strip().lower().strip(".,!?\"'«»")
    if not t:
        return True
    if t in _DEICTIC_TOKENS_LOWER:
        return True
    return t in {
        "this file",
        "that file",
        "the file",
        "этот файл",
        "этот файлик",
        "этот документ",
        "эту штуку",
        "этот",
        "эту",
        "open it",
        "show it",
    }


def resolve_deictic_file_anchor(
    shell_norm: Mapping[str, Any] | None,
    *,
    file_focus_stack: Sequence[tuple[str | None, str | None]] | None = None,
    turn_catalog_rows: Sequence[Any] | None = None,
) -> tuple[str | None, str | None]:
    """Resolve «его/it» to ``(name, uc)``: shell listing → file-focus ring → current-turn catalogue rows."""

    anchors = collect_surface_listing_anchors(shell_norm)
    if anchors:
        return anchors[-1]
    stack = list(file_focus_stack or [])
    if stack:
        return stack[-1]
    rows = list(turn_catalog_rows or [])
    if rows:
        row = rows[0]
        raw_id = getattr(row, "id", None)
        if raw_id is None and isinstance(row, dict):
            raw_id = row.get("id")
        uc_val = str(raw_id).strip() if raw_id is not None else ""
        if uc_val:
            nm_raw = getattr(row, "name", None) or getattr(row, "title", None)
            if nm_raw is None and isinstance(row, dict):
                nm_raw = row.get("name") or row.get("title")
            nm = str(nm_raw).strip()[:200] if nm_raw else None
            return nm, uc_val
    return None, None


def user_line_implies_deictic_doc_open(user_line: str) -> bool:
    """True when DocEditor open is requested without a concrete filename (pronoun / implicit «it»)."""

    if not user_intent_doceditor_open_with_file(user_line):
        return False
    raw_extract = extract_doc_search_phrase(user_line)
    phrase_norm = normalize_doc_open_phrase_after_extract(raw_extract)
    if not phrase_norm:
        return True
    if is_deictic_doc_reference(phrase_norm):
        return True
    return len(phrase_norm.strip()) < 2


def parse_surface_listing_line(line: str) -> tuple[str | None, str | None]:
    """Parse ``- name [kind] uc=id`` (``[kind]`` / ``uc`` optional)."""

    s = line.strip()
    if not s.startswith("-"):
        return None, None
    body = s[1:].strip()
    if not body:
        return None, None
    uc_val: str | None = None
    m_uc = _UC_LISTING_SUFFIX_RE.search(body)
    if m_uc:
        raw_uc = (m_uc.group("uc") or "").strip()
        body = body[: m_uc.start()].strip()
        uc_val = _opaque_id(raw_uc)
    if body.endswith("]") and "[" in body:
        lb = body.rfind("[")
        if lb > 0:
            body = body[:lb].rstrip()
    name = body.strip()
    return (name if name else None), uc_val


def _sorted_shell_windows(norm: Mapping[str, Any] | None) -> list[Mapping[str, Any]]:
    wins = norm.get("windows") if isinstance(norm, Mapping) else None
    if not isinstance(wins, list):
        return []
    decoded: list[Mapping[str, Any]] = []
    for w in wins:
        if isinstance(w, Mapping):
            decoded.append(w)
    return sorted(
        decoded,
        key=lambda x: (-int(x.get("z_index", 0) or 0), str(x.get("window_id", ""))),
    )


def flat_surface_listing_entries(norm: Mapping[str, Any] | None) -> list[tuple[str | None, str | None]]:
    """Flatten ``surface_listing`` lines across windows in deterministic order."""

    if not isinstance(norm, Mapping):
        return []
    ordered_out: list[tuple[str | None, str | None]] = []

    wins = _sorted_shell_windows(norm)
    aw = str(norm.get("active_window_id") or "").strip()

    def _consume_window_listing(rows: Sequence[Mapping[str, Any]]) -> None:
        for w in rows:
            raw = str(w.get("surface_listing") or "")
            if not raw.strip():
                continue
            for line in raw.splitlines():
                n, uc = parse_surface_listing_line(line)
                if n or uc:
                    ordered_out.append((n, uc))

    focused = [w for w in wins if str(w.get("window_id") or "").strip() == aw]
    if aw and focused:
        _consume_window_listing(focused)
        if ordered_out:
            return ordered_out
        ordered_out = []
    _consume_window_listing(wins)
    return ordered_out


def collect_surface_listing_anchors(norm: Mapping[str, Any] | None) -> list[tuple[str | None, str | None]]:
    """`(display_name, uc)` tuples in traversal order — focused window first, then descending z."""

    return flat_surface_listing_entries(norm)


def _already_has_doceditor_with_id(actions: list[dict[str, Any]]) -> bool:
    for row in actions:
        if row.get("type") != "open_app":
            continue
        if str(row.get("app_component") or "").strip() != "DocEditor":
            continue
        uc = str(row.get("unified_content_id") or "").strip()
        if uc:
            return True
    return False


def companion_already_has_doceditor_unified(actions: list[dict[str, Any]]) -> bool:
    """Guard for augmentation — True if DocEditor ``open_app`` already carries ``unified_content_id``."""

    return _already_has_doceditor_with_id(actions)


def merge_doceditor_open_with_unified_id(
    actions: list[dict[str, Any]],
    *,
    unified_id: str,
    rationale: str | None = None,
) -> list[dict[str, Any]]:
    """Insert or upgrade a DocEditor ``open_app`` with ``unified_content_id`` (allowlist-normalized)."""

    uid = unified_id.strip()
    if not uid:
        return actions
    out: list[dict[str, Any]] = []
    upgraded = False
    for row in actions:
        if not isinstance(row, dict):
            continue
        if (
            (not upgraded)
            and row.get("type") == "open_app"
            and str(row.get("app_component") or "").strip() == "DocEditor"
            and not str(row.get("unified_content_id") or "").strip()
        ):
            merged_row = dict(row)
            merged_row["unified_content_id"] = uid
            if rationale and not merged_row.get("rationale"):
                merged_row["rationale"] = rationale[:200]
            norm = _normalize_action(merged_row)
            if norm is not None:
                out.append(norm)
                upgraded = True
                continue
        out.append(row)

    if not upgraded:
        raw_row: dict[str, Any] = {
            "type": "open_app",
            "app_component": "DocEditor",
            "unified_content_id": uid,
        }
        if rationale:
            raw_row["rationale"] = rationale[:200]
        row = _normalize_action(raw_row)
        if row is not None:
            out.insert(0, row)

    return out[:MAX_ACTIONS_PER_TURN]


def _already_has_contentmanager_focus_or_filter(actions: list[dict[str, Any]]) -> bool:
    for row in actions:
        if row.get("type") != "open_app":
            continue
        if str(row.get("app_component") or "").strip() != "ContentManagerPro":
            continue
        if str(row.get("content_manager_focus_unified_content_id") or "").strip():
            return True
        cif = row.get("content_manager_initial_filter")
        if isinstance(cif, Mapping) and str(cif.get("search_query") or "").strip():
            return True
    return False


def companion_already_has_cm_focus_or_filter(actions: list[dict[str, Any]]) -> bool:
    """Guard for augmentation — True if Content Manager ``open_app`` already has focus or search filter."""

    return _already_has_contentmanager_focus_or_filter(actions)


def merge_contentmanager_open_for_companion(
    actions: list[dict[str, Any]],
    *,
    focus_unified_content_id: str | None = None,
    initial_filter_search_query: str | None = None,
    content_manager_folder_item_id: str | None = None,
    rationale: str | None = None,
    bare_catalog_open: bool = False,
) -> list[dict[str, Any]]:
    """Insert or upgrade a ContentManagerPro ``open_app`` with optional focus/filter/folder (normalized)."""

    uid = focus_unified_content_id.strip() if focus_unified_content_id else ""
    qs = initial_filter_search_query.strip() if initial_filter_search_query else ""
    folder_id = content_manager_folder_item_id.strip() if content_manager_folder_item_id else ""
    if not uid and not qs and not bare_catalog_open and not folder_id:
        return actions
    cif_dict: dict[str, str] = {}
    if qs:
        cif_dict["search_query"] = qs[:500]

    out: list[dict[str, Any]] = []
    upgraded = False
    for row in actions:
        if not isinstance(row, dict):
            continue
        if (
            (not upgraded)
            and row.get("type") == "open_app"
            and str(row.get("app_component") or "").strip() == "ContentManagerPro"
        ):
            merged_row = dict(row)
            if uid and not str(merged_row.get("content_manager_focus_unified_content_id") or "").strip():
                merged_row["content_manager_focus_unified_content_id"] = uid
            if cif_dict and not isinstance(merged_row.get("content_manager_initial_filter"), Mapping):
                merged_row["content_manager_initial_filter"] = dict(cif_dict)
            elif (
                cif_dict
                and isinstance(merged_row.get("content_manager_initial_filter"), Mapping)
                and not str(
                    merged_row["content_manager_initial_filter"].get("search_query")  # type: ignore[index]
                    or "",
                ).strip()
            ):
                mf = dict(merged_row["content_manager_initial_filter"])  # type: ignore[arg-type]
                mf["search_query"] = cif_dict["search_query"]
                merged_row["content_manager_initial_filter"] = mf
            if folder_id and not str(merged_row.get("content_manager_folder_item_id") or "").strip():
                merged_row["content_manager_folder_item_id"] = folder_id
            if rationale and not merged_row.get("rationale"):
                merged_row["rationale"] = rationale[:200]
            norm = _normalize_action(merged_row)
            if norm is not None:
                out.append(norm)
                upgraded = True
                continue
        out.append(row)

    if not upgraded:
        raw_cm: dict[str, Any] = {"type": "open_app", "app_component": "ContentManagerPro"}
        if uid:
            raw_cm["content_manager_focus_unified_content_id"] = uid
        if cif_dict:
            raw_cm["content_manager_initial_filter"] = cif_dict
        if folder_id:
            raw_cm["content_manager_folder_item_id"] = folder_id
        if rationale:
            raw_cm["rationale"] = rationale[:200]
        row_norm = _normalize_action(raw_cm)
        if row_norm is not None:
            out.insert(0, row_norm)

    return out[:MAX_ACTIONS_PER_TURN]


async def augment_actions_doceditor_via_content_search(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    query_svc: Any,
    shell_norm: Mapping[str, Any] | None = None,
    file_focus_stack: Sequence[tuple[str | None, str | None]] | None = None,
    turn_catalog_rows: Sequence[Any] | None = None,
) -> list[dict[str, Any]]:
    """
    If the user asked to open a file in DocEditor, resolve ``unified_content_id``.

    Prefer **direct ``uc=``** from ``surface_listing``, **file focus**, or this turn's catalogue prefetch when the
    phrase is deictic («его»); else ``list_content`` search on a concrete filename / title phrase.
    """

    if not _env_enabled():
        return actions
    if not isinstance(user_line, str) or not user_line.strip():
        return actions
    uid_ctx = (content_catalog_user_id or "").strip()
    if not uid_ctx:
        return actions
    if _already_has_doceditor_with_id(actions):
        return actions
    if not user_intent_doceditor_open_with_file(user_line):
        return actions

    raw_extract = extract_doc_search_phrase(user_line)
    phrase_norm = normalize_doc_open_phrase_after_extract(raw_extract)

    deictic_open = user_line_implies_deictic_doc_open(user_line)
    anchor_n, anchor_u = resolve_deictic_file_anchor(
        shell_norm,
        file_focus_stack=file_focus_stack,
        turn_catalog_rows=turn_catalog_rows,
    )

    alternate = (oauth2_sub or "").strip()
    if alternate == uid_ctx:
        alternate = None

    resolved_uc: str | None = None
    search_phrase: str | None = None
    resolved_label = anchor_n

    phrase_deictic = bool(phrase_norm) and (
        is_deictic_doc_reference(phrase_norm)
        or bool(
            re.search(
                r"(?i)\b(?:it|this|that|its|его|её|ее|этот|эту|эта|тот|ту)\b",
                phrase_norm,
            )
        )
    )

    if deictic_open or phrase_deictic:
        if anchor_u:
            resolved_uc = anchor_u
        elif anchor_n:
            search_phrase = anchor_n.strip()
        else:
            logger.info("[STEP] companion_doc_open_deictic_no_anchor")
            return actions
    elif phrase_norm and len(phrase_norm) >= 2:
        search_phrase = phrase_norm.strip()
    else:
        anchors = collect_surface_listing_anchors(shell_norm)
        if not anchors:
            return actions
        if len(anchors) == 1:
            only_n, only_u = anchors[0]
            resolved_label = only_n
            if only_u:
                resolved_uc = only_u
            elif only_n:
                search_phrase = only_n.strip()
            else:
                return actions
        else:
            return actions

    if resolved_uc:
        label = (resolved_label or "document")[:80]
        src = "desktop listing" if collect_surface_listing_anchors(shell_norm) else "file focus"
        rationale = f"Opened in DocEditor (from {src}): {label}"
        out = merge_doceditor_open_with_unified_id(actions, unified_id=resolved_uc, rationale=rationale)
        logger.info("[STEP] companion_doc_open_from_anchor_uc unified_content_id=%s", resolved_uc[:80])
        return out

    if not search_phrase or len(search_phrase) < 2:
        return actions

    merged_items: list[Any] = []
    picked_row: Any | None = None
    try:
        for q_variant in companion_catalog_search_variants(search_phrase):
            v = q_variant.strip()
            if len(v) < 2:
                continue
            batch, _ignored_total = await query_svc.list_content(
                user_id=uid_ctx,
                search_query=v,
                limit=45,
                offset=0,
                alternate_user_id=alternate,
                list_profile="compact",
                **companion_list_content_kwargs(),
            )
            merged_items = dedupe_catalog_rows_by_id(list(merged_items) + list(batch or []))
            picked_row = pick_content_row_for_doc_open(merged_items, search_phrase)
            if picked_row is not None:
                break
    except Exception as exc:  # noqa: BLE001 — DB/storage layer; never break the chat turn.
        logger.warning("companion_doc_open_list_content_failed phrase=%r err=%s", search_phrase[:80], exc)
        return actions

    if picked_row is None:
        logger.info(
            "[STEP] companion_doc_open_no_unique_match phrase=%r merged_hits=%s",
            search_phrase[:120],
            len(merged_items),
        )
        return actions

    raw_id = getattr(picked_row, "id", None)
    if raw_id is None:
        return actions
    uc_out = str(raw_id).strip() if isinstance(raw_id, UUID) else str(raw_id).strip()
    if not uc_out:
        return actions

    label = (getattr(picked_row, "name", None) or search_phrase or "").strip()[:80]
    rationale = f"Opened in DocEditor: {label}" if label else "Opened in DocEditor"
    merged = merge_doceditor_open_with_unified_id(actions, unified_id=uc_out, rationale=rationale)
    logger.info("[STEP] companion_doc_open_resolved unified_content_id=%s phrase=%r", uc_out, search_phrase[:120])
    return merged


__all__: tuple[str, ...] = (
    "augment_actions_doceditor_via_content_search",
    "companion_already_has_cm_focus_or_filter",
    "companion_already_has_doceditor_unified",
    "collect_surface_listing_anchors",
    "companion_catalog_search_variants",
    "companion_content_query_service_optional",
    "dedupe_catalog_rows_by_id",
    "extract_doc_search_phrase",
    "flat_surface_listing_entries",
    "is_deictic_doc_reference",
    "merge_contentmanager_open_for_companion",
    "merge_doceditor_open_with_unified_id",
    "needle_tokens_meaningful",
    "normalize_doc_open_phrase_after_extract",
    "parse_surface_listing_line",
    "pick_content_row_for_doc_open",
    "resolve_deictic_file_anchor",
    "user_intent_doceditor_open_with_file",
    "user_line_implies_deictic_doc_open",
    "user_line_may_probe_file_open",
)
