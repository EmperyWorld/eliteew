# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared shape contract for Desktop AI Chat SSE done.context summaries (metadata only).
# Invariants:
# - Quality sub-objects always include chunks/scored/unique_content_ids keys.
# - Wave D honesty: history_messages_used, chat_attachment_chunks, chat_memory_hits required.
# - Additive context_sources records contain display metadata only, never chunk bodies or storage ids.
# Related:
# - api/services/desktop_chat/service.py (build_rag_prefix)
# - shared/web/frontend/src/features/desktop-ai-chat/api/desktopChatClient.ts
# ---

"""Done-event context summary contract for desktop AI chat."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

DONE_CONTEXT_TOP_LEVEL_KEYS: frozenset[str] = frozenset(
    {
        "chat_rag_chunks",
        "chat_attachment_chunks",
        "chat_rag_requested",
        "chat_rag_cap",
        "chat_rag_quality",
        "project_vault_chunks",
        "project_vault_requested",
        "project_vault_cap",
        "project_vault_max_per_content_id",
        "project_vault_quality",
        "context_policy_applied",
        "chat_memory_hits",
        "history_messages_used",
        "kbsew_prefetch_applied",
        "kbsew_prefetch_status",
        "kbsew_prefetch_barrels_ok",
        "kbsew_prefetch_barrels_stale",
        "kbsew_prefetch_barrels_failed",
        "kbsew_prefetch_barrels_empty",
        "memory_cell_chunks",
        "memory_cell_requested",
        "memory_cell_cap",
        "memory_cell_id",
        "memory_cell_quality",
    }
)

DONE_CONTEXT_QUALITY_KEYS: frozenset[str] = frozenset(
    {
        "chunks",
        "scored",
        "unique_content_ids",
    }
)

DONE_CONTEXT_KBSEW_STATUSES: frozenset[str] = frozenset(
    {
        "disabled",
        "empty",
        "ok",
        "stale",
        "error",
        "partial_stale",
    }
)

DONE_CONTEXT_SOURCE_KINDS: frozenset[str] = frozenset(
    {
        "chat_attachment",
        "project_document",
        "derived_ai_artifact",
        "web",
    }
)
_CONTEXT_SOURCE_CITATION_RE = re.compile(r"^[CPDW][1-9]\d{0,3}$")
_CONTEXT_SOURCE_FORBIDDEN_KEYS = frozenset(
    {
        "body",
        "chunk",
        "chunk_index",
        "content_id",
        "fragment",
        "score",
        "text",
        "uuid",
    }
)


def validate_done_context_summary(summary: dict[str, Any]) -> list[str]:
    """Return human-readable contract violations; empty list means OK."""
    errors: list[str] = []
    missing = sorted(DONE_CONTEXT_TOP_LEVEL_KEYS - summary.keys())
    if missing:
        errors.append(f"missing keys: {', '.join(missing)}")
    for quality_key in ("chat_rag_quality", "project_vault_quality", "memory_cell_quality"):
        raw = summary.get(quality_key)
        if not isinstance(raw, dict):
            errors.append(f"{quality_key} must be object")
            continue
        q_missing = sorted(DONE_CONTEXT_QUALITY_KEYS - raw.keys())
        if q_missing:
            errors.append(f"{quality_key} missing: {', '.join(q_missing)}")
    if "memory_cell_requested" in summary and not isinstance(summary["memory_cell_requested"], bool):
        errors.append("memory_cell_requested must be bool")
    if (
        "memory_cell_id" in summary
        and summary["memory_cell_id"] is not None
        and (not isinstance(summary["memory_cell_id"], str) or not str(summary["memory_cell_id"]).strip())
    ):
        errors.append("memory_cell_id must be null or non-empty string")
    if "context_policy_applied" in summary and not isinstance(summary["context_policy_applied"], bool):
        errors.append("context_policy_applied must be bool")
    if "kbsew_prefetch_applied" in summary and not isinstance(summary["kbsew_prefetch_applied"], bool):
        errors.append("kbsew_prefetch_applied must be bool")
    kbsew_status = summary.get("kbsew_prefetch_status")
    if kbsew_status is not None and kbsew_status not in DONE_CONTEXT_KBSEW_STATUSES:
        errors.append("kbsew_prefetch_status invalid")
    for count_key in (
        "kbsew_prefetch_barrels_ok",
        "kbsew_prefetch_barrels_stale",
        "kbsew_prefetch_barrels_failed",
        "kbsew_prefetch_barrels_empty",
        "chat_attachment_chunks",
        "chat_memory_hits",
        "history_messages_used",
        "chat_rag_chunks",
        "project_vault_chunks",
    ):
        if count_key in summary and not isinstance(summary[count_key], int):
            errors.append(f"{count_key} must be int")
    raw_sources = summary.get("context_sources")
    if raw_sources is not None:
        if not isinstance(raw_sources, list):
            errors.append("context_sources must be array")
        else:
            seen_ids: set[str] = set()
            for index, source in enumerate(raw_sources):
                prefix = f"context_sources[{index}]"
                if not isinstance(source, dict):
                    errors.append(f"{prefix} must be object")
                    continue
                leaked = sorted(_CONTEXT_SOURCE_FORBIDDEN_KEYS.intersection(source))
                if leaked:
                    errors.append(f"{prefix} exposes forbidden keys: {', '.join(leaked)}")
                citation_id = source.get("citation_id")
                if not isinstance(citation_id, str) or not _CONTEXT_SOURCE_CITATION_RE.fullmatch(citation_id):
                    errors.append(f"{prefix}.citation_id invalid")
                elif citation_id in seen_ids:
                    errors.append(f"{prefix}.citation_id duplicated")
                else:
                    seen_ids.add(citation_id)
                if source.get("kind") not in DONE_CONTEXT_SOURCE_KINDS:
                    errors.append(f"{prefix}.kind invalid")
                title = source.get("title")
                if not isinstance(title, str) or not title.strip():
                    errors.append(f"{prefix}.title missing")
                raw_url = source.get("url")
                if raw_url is not None:
                    if not isinstance(raw_url, str):
                        errors.append(f"{prefix}.url must be string")
                    else:
                        try:
                            parsed = urlsplit(raw_url)
                        except ValueError:
                            parsed = None
                        if (
                            parsed is None
                            or parsed.scheme not in {"http", "https"}
                            or not parsed.netloc
                            or parsed.username
                            or parsed.password
                        ):
                            errors.append(f"{prefix}.url unsafe")
    return errors


def iter_sse_data_payloads(text: str) -> list[dict[str, Any]]:
    """Parse `data: {...}` JSON payloads from an SSE capture (metadata lines only)."""
    payloads: list[dict[str, Any]] = []
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        raw = line[len("data: ") :].strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            payloads.append(payload)
    return payloads


def validate_done_context_in_sse_file(
    path: Path | str,
    *,
    case_label: str = "",
) -> dict[str, Any]:
    """Validate the last done.context object in an SSE file; raise ValueError on failure."""
    prefix = f"{case_label}: " if case_label else ""
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    done_events = [p for p in iter_sse_data_payloads(text) if p.get("event") == "done"]
    if not done_events:
        raise ValueError(f"{prefix}missing done event")
    ctx = done_events[-1].get("context")
    if not isinstance(ctx, dict):
        raise ValueError(f"{prefix}done.context missing or not object")
    errors = validate_done_context_summary(ctx)
    if errors:
        raise ValueError(f"{prefix}done.context contract: {'; '.join(errors)}")
    return ctx
