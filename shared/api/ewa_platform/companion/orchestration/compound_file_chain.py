# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse and execute **compound file utterances** in one turn (e.g. «прочитай notes.md и открой в редакторе») by
# chaining server tools without shell snapshot.
# Invariants:
# - Scope **EwaFile** only (via existing catalog_discuss / file_open / catalog_list handlers).
# - Returns ``continue_main_llm`` when discuss injects memory + optional sidecar DocEditor ``open_app`` actions.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final, Literal

from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    record_branch_probe,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict

logger = logging.getLogger(__name__)

CompoundKind = Literal["discuss_then_open", "list_then_open"]

_COMPOUND_SPLIT_RE: Final = re.compile(
    r"(?ix)\s+(?:,\s*)?(?:и|and|потом|then|,\s*then)\s+",
)

_OPEN_EDITOR_TAIL_RE: Final = re.compile(
    r"(?ix)(?:"
    r"открой(?:\s+(?:его|её|it|this))?\s+(?:в\s+)?(?:редактор(?:е| документов)?|doc\s*editor)"
    r"|open(?:\s+(?:it|this))?\s+(?:in\s+)?(?:the\s+)?(?:doc\s*editor|document\s+editor|editor)"
    r")",
)

_DISCUSS_HEAD_RE: Final = re.compile(
    r"(?ix)(?:"
    r"обсуди|прочитай|перескажи|изучи|расскажи\s+про|discuss|read\s+(?:the\s+)?file|summar(?:y|ize)"
    r")",
)

_LIST_HEAD_RE: Final = re.compile(
    r"(?ix)(?:"
    r"покажи\s+(?:список\s+)?(?:файл|файлов|документ)"
    r"|список\s+файл"
    r"|show\s+(?:me\s+)?(?:the\s+)?files"
    r"|list\s+(?:my\s+)?files"
    r")",
)


@dataclass(frozen=True, slots=True)
class CompoundFileChain:
    """One parsed compound file chain from a single user line."""

    kind: CompoundKind
    head_line: str
    tail_line: str
    defer_tail: bool = False


def parse_compound_file_chain(user_line: str) -> CompoundFileChain | None:
    """Return a compound chain when the line joins two file intents with «и / потом / then»."""

    raw = str(user_line or "").strip()
    if len(raw) < 12:
        return None
    if not _COMPOUND_SPLIT_RE.search(raw):
        return None
    parts = [p.strip() for p in _COMPOUND_SPLIT_RE.split(raw, maxsplit=1) if p.strip()]
    if len(parts) != 2:
        return None
    head, tail = parts[0], parts[1]
    if not _OPEN_EDITOR_TAIL_RE.search(tail):
        return None
    defer = bool(re.search(r"(?ix)(?:,\s*)?(?:потом|then)\s+", raw))
    if _DISCUSS_HEAD_RE.search(head):
        return CompoundFileChain(
            kind="discuss_then_open",
            head_line=head,
            tail_line=tail,
            defer_tail=defer,
        )
    if _LIST_HEAD_RE.search(head):
        return CompoundFileChain(
            kind="list_then_open",
            head_line=head,
            tail_line=tail,
            defer_tail=defer,
        )
    return None


async def maybe_handle_compound_file_chain(
    pool: Any,
    *,
    tool_ctx: Any,
    user_line: str,
) -> dict[str, Any] | None:
    """Execute discuss+open or list+open compound chains; optional defer tail via TurnPlan v1."""

    chain = parse_compound_file_chain(user_line)
    if chain is None:
        return None

    uid = str(getattr(tool_ctx, "content_catalog_user_id", None) or "").strip()
    if not uid:
        return None

    from api.ewa_platform.companion.orchestration.flows.file_open import propose_file_open
    from api.ewa_platform.companion.orchestration.tool_registry import (
        ToolContext,
        _handle_catalog_list,
    )
    from api.ewa_platform.companion.orchestration.turn_plan_v1 import (
        TurnPlanStep,
        companion_turn_plan_enqueue,
    )

    ctx: ToolContext = tool_ctx
    memory_append = ""
    catalog_appendix = ""
    sidecar_actions: list[dict[str, Any]] = []
    resolved_uc: str | None = None
    resolved_label: str | None = None

    if chain.kind == "discuss_then_open":
        from api.ewa_platform.companion.orchestration.tool_registry import resolve_catalog_discuss_memory_inject

        discuss_result = await resolve_catalog_discuss_memory_inject(ctx, user_line=chain.head_line)
        if discuss_result is None:
            return None
        memory_append, resolved_uc, resolved_label = discuss_result
        memory_append = memory_append.strip()
        if not memory_append:
            return None
    elif chain.kind == "list_then_open":
        list_result = await _handle_catalog_list({"user_line": chain.head_line}, ctx)
        if list_result is None:
            return None
        data = as_mapping_dict(list_result.get("data"))
        catalog_appendix = str(data.get("catalog_appendix") or "").strip()
        sidecar_actions.extend(list(list_result.get("actions") or []))

    if chain.defer_tail:
        queued_plan = False
        queue_failure = ""
        companion_pool = ctx.companion_pool
        if companion_pool is None:
            queue_failure = "companion_pool_missing"
        else:
            queued_plan = await companion_turn_plan_enqueue(
                companion_pool,
                principal_id=ctx.principal_id,
                steps=[
                    TurnPlanStep(
                        tool="file_open",
                        args={
                            "user_line": chain.tail_line,
                            "unified_content_id": resolved_uc,
                            "file_query": resolved_label,
                        },
                    ),
                ],
                source=f"compound_{chain.kind}",
            )
            if not queued_plan:
                queue_failure = "turn_plan_enqueue_failed"
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        logger.info("[STEP] companion_compound_file_chain defer_tail kind=%s", chain.kind)
        out = {
            "continue_main_llm": True,
            "memory_section_append": memory_append,
            "catalog_appendix": catalog_appendix,
            "orchestration_sidecar_actions": sidecar_actions,
            "orchestration_branch": "compound_file_chain",
            "reply": "",
            "actions": [],
            "task_run": None,
        }
        if queued_plan:
            hint = (
                "Прочитала файл. Когда будешь готов — напиши «открой в редакторе», и я выполню следующий шаг."
                if ru
                else "I loaded the file. Say 'open in the editor' when ready and I will run the next queued step."
            )
            out["turn_plan_hint"] = hint
            out["turn_plan_next_tool"] = "file_open"
            out["turn_plan_source"] = f"compound_{chain.kind}"
        else:
            logger.warning(
                "[STEP] companion_compound_file_chain_not_queued kind=%s reason=%s",
                chain.kind,
                queue_failure or "unknown",
            )
            out["turn_plan_hint"] = (
                "Файл прочитан, но очередь следующего шага недоступна. "
                "Напиши «открой в редакторе» отдельным сообщением — выполню сразу."
                if ru
                else "The file is loaded, but the queued next step is unavailable right now. "
                "Send 'open in the editor' as a separate message and I will run it immediately."
            )
            out["turn_plan_source"] = f"compound_{chain.kind}_not_queued"
            report = record_branch_probe(
                "compound_file_chain",
                "not_started",
                reason_code="turn_plan_not_queued",
                reason_message_ru=out["turn_plan_hint"],
                reason_message_en=out["turn_plan_hint"],
                resume_conditions=[
                    "Напиши «открой в редакторе» отдельным сообщением."
                    if ru
                    else "Send 'open in the editor' as a separate message.",
                ],
                refs={"chain_kind": chain.kind, "queue_failure": queue_failure or "unknown"},
            )
            if report is not None:
                attach_reports_to_response(out, [report], orchestrated=out)
        return out

    open_inner = await propose_file_open(
        user_line=chain.tail_line,
        content_catalog_user_id=uid,
        oauth2_sub=ctx.oauth2_sub_for_content_alternate,
        profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
        unified_content_id=resolved_uc,
        file_query=resolved_label,
    )
    if open_inner is None:
        return None
    open_actions = list(open_inner.get("actions") or [])
    sidecar_actions.extend(open_actions)

    companion_pool = ctx.companion_pool
    if companion_pool is not None and resolved_uc:
        try:
            from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

            await companion_pg.companion_record_file_focus(
                companion_pool,
                principal_id=ctx.principal_id,
                unified_content_id=resolved_uc,
                name=resolved_label,
                source="compound_discuss_open",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("[STEP] companion_compound_file_focus_failed err=%s", exc)

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    ack = (
        f"Прочитала «{resolved_label or 'файл'}» и открываю в редакторе."
        if ru and chain.kind == "discuss_then_open"
        else (
            "Listed EwaFile and opening in DocEditor."
            if chain.kind == "list_then_open"
            else f'Opening "{resolved_label or "file"}" in DocEditor.'
        )
    )
    logger.info(
        "[STEP] companion_compound_file_chain kind=%s memory_chars=%s actions=%s",
        chain.kind,
        len(memory_append),
        len(sidecar_actions),
    )
    return {
        "continue_main_llm": True,
        "memory_section_append": memory_append,
        "catalog_appendix": catalog_appendix,
        "orchestration_sidecar_actions": sidecar_actions,
        "orchestration_branch": "compound_file_chain",
        "reply": "",
        "actions": [],
        "task_run": None,
        "compound_ack": ack,
    }


__all__ = (
    "CompoundFileChain",
    "maybe_handle_compound_file_chain",
    "parse_compound_file_chain",
)
