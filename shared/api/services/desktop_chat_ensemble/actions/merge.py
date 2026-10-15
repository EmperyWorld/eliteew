# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compact findings markdown + merge public context_sources for citations.
# Invariants:
# - Never invent facts; empty/error rows stay explicit.
# - Inject stays under MAX_FINDINGS_CHARS.
# - Findings detail is citation-clean: no RAG/vault dump headers (source=, score=, content_id).
# Related:
# - api/services/desktop_chat/context_evidence.py
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Merge ensemble action results into prompt findings + citation registry."""

from __future__ import annotations

import re
from typing import Any

from api.services.desktop_chat.context_evidence import merge_public_context_sources
from api.services.desktop_chat_ensemble.actions.budget import (
    MAX_FINDINGS_CHARS,
)
from api.services.desktop_chat_ensemble.actions.types import ActionPackResult, ActionResult

# Dump styles that models echo into the artifact → raw_source_label / raw_rag_marker.
_RAW_FINDINGS_LINE_RE = re.compile(
    r"(?i)(?:"
    r"\[\s*[^\]]{0,160}\bsource\s*="
    r"|\[\s*[^\]]{0,160}\bRAG\b"
    r"|\[\s*[^\]]{0,160}\bvault\b"
    r"|\bНиже\s+[—\-]\s+релевантные\s+выдержки"
    r"|\bСсылки\s+в\s+пользовательском\s+ответе"
    r"|\b(?:source_)?label\s*[=:]"
    r"|\bcontent_id\s*[=:]"
    r"|\bchunk(?:_index)?\s*[=:№#]?"
    r"|\bscore\s*[=:]\s*\d"
    r"|никогда\s+не\s+показывай\s+слова\s+RAG"
    r")"
)


def _clip(text: str, limit: int) -> str:
    raw = (text or "").strip()
    if len(raw) <= limit:
        return raw
    return raw[: limit - 1].rstrip() + "…"


def _clean_findings_detail_lines(detail: str, *, max_lines: int = 6) -> list[str]:
    """Keep readable snippets; drop internal RAG/vault dump headers and meta lines."""
    out: list[str] = []
    for part in (detail or "").splitlines():
        part = part.strip()
        if not part:
            continue
        if _RAW_FINDINGS_LINE_RE.search(part):
            continue
        # Strip leftover bracket headers that start with source=
        if part.startswith("[") and "source=" in part.casefold():
            continue
        out.append(part[:220])
        if len(out) >= max_lines:
            break
    return out


def format_findings_markdown(results: list[ActionResult]) -> str:
    if not results:
        return "### Findings from execution\n\nПроверки не выполнялись: нет доступных источников для этого хода.\n"
    ok_n = sum(1 for r in results if r.status == "ok")
    empty_n = sum(1 for r in results if r.status == "empty")
    error_n = sum(1 for r in results if r.status == "error")
    ungrounded = ok_n == 0 and (empty_n + error_n) > 0
    lines = [
        "### Findings from execution",
        "",
        "Ниже — результаты реальных mid-turn проверок. Опирайся на них; "
        "не выдумывай факты, если статус empty/error. "
        "Для каждого web/RAG/vault результата со статусом ok обязательно "
        "вставь в документ соответствующие цитаты вида 【W1】 / 【C1】 / 【P1】.",
        "",
    ]
    if ungrounded:
        lines.extend(
            [
                "> **Ungrounded:** mid-turn checks returned no successful hits "
                f"(ok=0 empty={empty_n} error={error_n}). "
                "Do not invent citations; mark uncertainty and prefer catalog/user facts.",
                "",
            ]
        )
    for row in results:
        status = row.status
        cite = ""
        cids = [
            str(s.get("citation_id") or "").strip()
            for s in row.context_sources
            if isinstance(s, dict) and str(s.get("citation_id") or "").strip()
        ]
        if cids:
            cite = " " + " ".join(f"【{c}】" for c in cids[:4])
        lines.append(f"- **{row.kind}** `{row.query[:120]}` — {status}.{cite}")
        summary = _clip(row.summary or row.error or "", 320)
        if not summary and row.detail:
            clean_bits = _clean_findings_detail_lines(row.detail, max_lines=1)
            summary = _clip(clean_bits[0] if clean_bits else "", 320)
        if summary:
            lines.append(f"  - {summary}")
        detail_lines = _clean_findings_detail_lines(row.detail, max_lines=6)
        for part in detail_lines:
            if part == summary:
                continue
            lines.append(f"  - {part}")
    text = "\n".join(lines).strip() + "\n"
    if len(text) > MAX_FINDINGS_CHARS:
        text = text[: MAX_FINDINGS_CHARS - 40].rstrip() + "\n\n… (findings truncated; see citations)\n"
    return text


def collect_context_sources(results: list[ActionResult]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in results:
        for src in row.context_sources:
            if not isinstance(src, dict):
                continue
            cid = str(src.get("citation_id") or "").strip()
            key = cid or f"{src.get('kind')}:{src.get('title')}:{src.get('url')}"
            if key in seen:
                continue
            seen.add(key)
            merged.append(dict(src))
    return merged


def merge_action_sources_into_rag_ctx(
    rag_ctx: dict[str, Any],
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    if not sources:
        return rag_ctx
    return merge_public_context_sources(dict(rag_ctx), sources)


def build_pack_result(
    *,
    ran: bool,
    mode: str,
    skipped_reason: str | None,
    results: list[ActionResult],
) -> ActionPackResult:
    findings = format_findings_markdown(results) if ran or results else ""
    sources = collect_context_sources(results)
    return ActionPackResult(
        ran=ran,
        mode=mode,  # type: ignore[arg-type]
        skipped_reason=skipped_reason,
        results=results,
        findings_markdown=findings,
        context_sources=sources,
    )
