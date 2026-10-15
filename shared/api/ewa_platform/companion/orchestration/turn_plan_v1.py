# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# **TurnPlan v1** — durable queue of server-tool steps in ``learned_preferences`` for cross-turn chains
# (e.g. «прочитай X, потом открой в редакторе» with deferred tail).
# Invariants:
# - Max ``TURN_PLAN_MAX_STEPS`` steps; cleared on explicit cancel or successful drain.
# - Steps run through ``tool_registry`` dispatch — no shell snapshot.
# - Enqueue/resume failures emit ``CompanionExecutionReportV1`` when protocol flag is ON.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final

from api.ewa_platform.companion.orchestration.execution_ledger import (
    record_persist_failure,
    record_turn_plan_failure,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict

logger = logging.getLogger(__name__)

COMPANION_TURN_PLAN_KEY: Final[str] = "companion_turn_plan_v1"
TURN_PLAN_MAX_STEPS: Final[int] = 4

_CANCEL_RE: Final = re.compile(
    r"(?ix)^\s*(?:"
    r"отмена|отмени|стоп|cancel|stop|не\s+надо|пропусти\s+шаг|skip\s+step|clear\s+plan"
    r")\b",
)

_PROCEED_RE: Final = re.compile(
    r"(?ix)(?:"
    r"^(?:да|ok|ок|"
    r"продолж(?:ай|и|ите|ить|ение)?|"
    r"continue|next\s+step|следующий\s+шаг|"
    r"запускай|запусти|дальше|go\s+on)\b"
    r"|(?:открой|open).{0,30}(?:редактор|editor)"
    r")",
)


@dataclass(frozen=True, slots=True)
class TurnPlanStep:
    tool: str
    args: Mapping[str, Any]


def turn_plan_from_profile(profile: Mapping[str, Any] | None) -> list[TurnPlanStep]:
    if not isinstance(profile, Mapping):
        return []
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return []
    raw = lp.get(COMPANION_TURN_PLAN_KEY)
    if not isinstance(raw, Mapping):
        return []
    steps_raw = raw.get("steps")
    if not isinstance(steps_raw, list):
        return []
    out: list[TurnPlanStep] = []
    for row in steps_raw[:TURN_PLAN_MAX_STEPS]:
        if not isinstance(row, Mapping):
            continue
        tool = str(row.get("tool") or "").strip()
        args = as_mapping_dict(row.get("args"))
        if tool:
            out.append(TurnPlanStep(tool=tool, args=dict(args)))
    return out


def user_line_cancels_turn_plan(user_line: str) -> bool:
    return bool(_CANCEL_RE.search(str(user_line or "")))


def user_line_proceeds_turn_plan(user_line: str) -> bool:
    s = str(user_line or "").strip()
    if not s:
        return False
    return bool(_PROCEED_RE.search(s))


async def companion_turn_plan_enqueue(
    pool: Any,
    *,
    principal_id: str,
    steps: list[TurnPlanStep],
    source: str,
    turn_reports: list | None = None,
) -> bool:
    if not steps:
        return False
    capped = steps[:TURN_PLAN_MAX_STEPS]
    payload = {
        "steps": [{"tool": s.tool, "args": dict(s.args)} for s in capped],
        "source": source[:120],
        "created_at": datetime.now(UTC).isoformat(),
    }
    try:
        from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

        await companion_pg.companion_turn_plan_upsert(
            pool,
            principal_id=principal_id,
            plan_payload=payload,
        )
        logger.info(
            "[STEP] companion_turn_plan_enqueue principal=%s steps=%s source=%s",
            principal_id,
            len(capped),
            source,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_turn_plan_enqueue_failed principal=%s err=%s", principal_id, exc)
        report = record_persist_failure(
            "persist",
            "turn_plan_enqueue_failed",
            reason_message_ru="Не удалось сохранить очередь следующих шагов.",
            reason_message_en="Could not persist the queued next steps.",
            resume_conditions=[
                "Повторите команду или выполните следующий шаг отдельным сообщением.",
            ],
            refs={"principal_id": principal_id, "source": source[:120]},
        )
        if report is not None and turn_reports is not None:
            turn_reports.append(report)
        return False


async def companion_turn_plan_clear(pool: Any, *, principal_id: str) -> None:
    try:
        from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

        await companion_pg.companion_turn_plan_clear(pool, principal_id=principal_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_turn_plan_clear_failed principal=%s err=%s", principal_id, exc)


async def maybe_resume_turn_plan_v1(
    pool: Any,
    *,
    tool_ctx: Any,
    user_line: str,
    run_tool_branch: Any,
    turn_reports: list | None = None,
) -> dict[str, Any] | None:
    """Drain the next queued tool step when the user proceeds or sends a matching open line."""

    profile = tool_ctx.profile if isinstance(getattr(tool_ctx, "profile", None), Mapping) else None
    steps = turn_plan_from_profile(profile)
    if not steps:
        return None

    if user_line_cancels_turn_plan(user_line):
        await companion_turn_plan_clear(pool, principal_id=str(getattr(tool_ctx, "principal_id", "") or ""))
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return {
            "reply": "Ок, отменила запланированные шаги." if ru else "OK, cancelled the queued plan steps.",
            "actions": [],
            "task_run": None,
            "orchestration_branch": "turn_plan_cancel",
        }

    if not user_line_proceeds_turn_plan(user_line):
        return None

    step = steps[0]
    args = dict(step.args)
    args.setdefault("user_line", user_line)
    args.setdefault("_tool_router_bypass_line_match", True)
    short = await run_tool_branch(step.tool, args, tool_ctx, user_line=user_line)
    if short is None:
        logger.warning(
            "[STEP] companion_turn_plan_resume_tool_failed principal=%s tool=%s stored_user_line_chars=%s",
            str(getattr(tool_ctx, "principal_id", "") or ""),
            step.tool,
            len(str(args.get("user_line") or "")),
        )
        report = record_turn_plan_failure(
            "turn_plan_resume_tool_failed",
            tool=step.tool,
            reason_message_ru=f"Шаг «{step.tool}» не запустился — уточните команду или напишите «продолжай».",
            reason_message_en=f"Step «{step.tool}» did not start — clarify or say 'continue'.",
            resume_conditions=["Напишите «продолжай» или повторите шаг явнее."],
        )
        if report is not None and turn_reports is not None:
            turn_reports.append(report)
        return None

    remaining = steps[1:]
    principal_id = str(getattr(tool_ctx, "principal_id", "") or "")
    if remaining:
        persisted = await companion_turn_plan_enqueue(
            pool,
            principal_id=principal_id,
            steps=remaining,
            source="turn_plan_drain",
            turn_reports=turn_reports,
        )
        if not persisted:
            logger.warning(
                "[STEP] companion_turn_plan_resume_enqueue_failed principal=%s remaining=%s",
                principal_id,
                len(remaining),
            )
            report = record_turn_plan_failure(
                "turn_plan_resume_enqueue_failed",
                tool=remaining[0].tool if remaining else None,
                reason_message_ru="Следующие шаги не сохранились — повторите «продолжай».",
                reason_message_en="Remaining steps were not saved — say 'continue' again.",
                resume_conditions=["Напишите «продолжай» для повторной попытки."],
            )
            if report is not None and turn_reports is not None:
                turn_reports.append(report)
    else:
        await companion_turn_plan_clear(pool, principal_id=principal_id)

    branch = str(short.get("orchestration_branch") or step.tool).strip() or step.tool
    short["orchestration_branch"] = f"turn_plan_{branch}"
    logger.info("[STEP] companion_turn_plan_resume tool=%s remaining=%s", step.tool, len(remaining))
    return short


__all__ = (
    "COMPANION_TURN_PLAN_KEY",
    "TurnPlanStep",
    "companion_turn_plan_clear",
    "companion_turn_plan_enqueue",
    "maybe_resume_turn_plan_v1",
    "turn_plan_from_profile",
    "user_line_cancels_turn_plan",
    "user_line_proceeds_turn_plan",
)
