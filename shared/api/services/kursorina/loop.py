# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Курсорина investigation loop — decide → tool → evidence → terminal.
# Invariants:
# - Does not invoke Desktop ensemble or EWA agentic expert paths.
# - ToolRuntime carries DB+user for library ACL and Yandex web_search.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import logging

from api.services.kursorina.decide import (
    decide_next,
    goal_wants_external,
    goal_wants_library_save,
    has_substantive_evidence,
)
from api.services.kursorina.models import MissionSnapshot, StepItem
from api.services.kursorina.plan import requested_md_filename
from api.services.kursorina.runtime import ToolRuntime
from api.services.kursorina.store import save_mission
from api.services.kursorina.synthesize import synthesize_answer
from api.services.kursorina.tools import run_tool

logger = logging.getLogger(__name__)


async def _maybe_save_answer_to_library(
    mission: MissionSnapshot,
    *,
    runtime: ToolRuntime,
) -> None:
    """Optional export when goal asked to save a file — once per mission."""
    named = requested_md_filename(mission.goal)
    if not goal_wants_library_save(mission.goal) and not named:
        return
    if any(s.tool == "save_to_library" for s in mission.steps):
        return
    answer = (mission.answer or "").strip()
    if not answer:
        return
    from api.services.kursorina.plan import goal_topic_query

    clean_topic = goal_topic_query(mission.goal, max_chars=80)
    title = named or (f"Аналитический отчет — {clean_topic}" if clean_topic else "Курсорина — Аналитический отчет")
    obs, evidence, ok = await run_tool(
        "save_to_library",
        {"title": title, "text": answer, "mission_id": mission.id},
        runtime=runtime,
    )
    mission.steps.append(
        StepItem(
            index=len(mission.steps),
            tool="save_to_library",
            args={"title": title[:200], "mission_id": mission.id},
            observation=obs[:2_000],
            ok=ok,
        )
    )
    mission.evidence.extend(evidence)
    if ok and evidence:
        cid = evidence[0].ref
        png_ids = [
            e.ref
            for e in mission.evidence
            if e.kind == "library" and e.ref != cid and ".png" in (e.extract or "").casefold()
        ]
        files_line = f"Файл в вашей библиотеке: {title} (ID: {cid})"
        if png_ids:
            files_line += f"\nГрафик(и): {', '.join(png_ids[:5])}"
        mission.answer = f"{answer.rstrip()}\n\n{files_line}"


async def tick_mission(
    mission: MissionSnapshot,
    *,
    max_steps: int = 5,
    runtime: ToolRuntime | None = None,
) -> MissionSnapshot:
    if mission.status in {"completed", "blocked", "cancelled"}:
        return mission
    if mission.status == "queued":
        mission.status = "running"

    rt = runtime or ToolRuntime()
    steps_left = max(1, min(int(max_steps), 10))
    for _ in range(steps_left):
        if mission.cancel_requested:
            mission.status = "cancelled"
            mission.block_reason = mission.block_reason or "cancelled by user"
            await save_mission(mission)
            break
        if mission.status != "running":
            await save_mission(mission)
            break
        if len(mission.steps) >= mission.step_budget:
            # Soft overrun: drain one unread library/platform hit so budget does not strand refs.
            # External/market goals skip library megabyte drain (mission 83b73754).
            wants_net = goal_wants_external(mission.goal)
            if len(mission.steps) < mission.step_budget + 2:
                unread_lib = []
                if not wants_net:
                    unread_lib = [
                        e
                        for e in mission.evidence
                        if e.kind in {"library_hit", "folder"}
                        and not any(
                            s.tool == "read_content" and str(s.args.get("content_id") or "") == e.ref
                            for s in mission.steps
                        )
                    ]
                unread_path = [
                    e
                    for e in mission.evidence
                    if e.kind in {"doc_hit", "code_hit"}
                    and not any(s.tool == "read_path" and str(s.args.get("path") or "") == e.ref for s in mission.steps)
                ]
                if unread_lib:
                    cid = unread_lib[0].ref
                    obs, evidence, ok = await run_tool(
                        "read_content",
                        {"content_id": cid},
                        runtime=rt,
                    )
                    mission.steps.append(
                        StepItem(
                            index=len(mission.steps),
                            tool="read_content",
                            args={"content_id": cid},
                            observation=obs[:2_000],
                            ok=ok,
                        )
                    )
                    mission.evidence.extend(evidence)
                    await save_mission(mission)
                elif unread_path:
                    path = unread_path[0].ref
                    obs, evidence, ok = await run_tool(
                        "read_path",
                        {"path": path},
                        runtime=rt,
                    )
                    mission.steps.append(
                        StepItem(
                            index=len(mission.steps),
                            tool="read_path",
                            args={"path": path},
                            observation=obs[:2_000],
                            ok=ok,
                        )
                    )
                    mission.evidence.extend(evidence)
                    await save_mission(mission)

            if has_substantive_evidence(mission) or any(e.kind in {"doc_hit", "code_hit"} for e in mission.evidence):
                mission.answer = await synthesize_answer(mission)
                mission.status = "completed"
                mission.steps.append(
                    StepItem(
                        index=len(mission.steps),
                        tool="finish",
                        args={"answer_chars": len(mission.answer or "")},
                        observation="completed_on_budget",
                        ok=True,
                    )
                )
                await _maybe_save_answer_to_library(mission, runtime=rt)
                await save_mission(mission)
                break
            mission.status = "blocked"
            mission.block_reason = mission.block_reason or "step budget exceeded"
            await save_mission(mission)
            break

        action = await decide_next(mission)
        logger.info(
            "[STEP] kursorina_decide tool=%s reason=%s mission_id=%s",
            action.tool,
            (action.reason or "")[:80],
            mission.id[:48],
        )

        if action.tool == "finish":
            # Product answer: grounded synthesize — never ledger dump dialect.
            answer = await synthesize_answer(mission)
            mission.answer = answer
            mission.status = "completed"
            mission.steps.append(
                StepItem(
                    index=len(mission.steps),
                    tool="finish",
                    args={"answer_chars": len(answer)},
                    observation="completed",
                    ok=True,
                )
            )
            await _maybe_save_answer_to_library(mission, runtime=rt)
            await save_mission(mission)
            break

        if action.tool == "run_python":
            args = dict(action.args or {})
            args.setdefault("mission_id", mission.id)
            args.setdefault("goal", mission.goal)
            blob_parts = [f"{e.kind} {e.ref} {e.extract or ''}" for e in mission.evidence[-20:]]
            args.setdefault("evidence_blob", "\n".join(blob_parts)[:12_000])
            obs, evidence, ok = await run_tool("run_python", args, runtime=rt)
            mission.steps.append(
                StepItem(
                    index=len(mission.steps),
                    tool="run_python",
                    args={"code_chars": len(str(args.get("code") or ""))},
                    observation=obs[:2_000],
                    ok=ok,
                )
            )
            mission.evidence.extend(evidence)
            await save_mission(mission)
            continue

        if action.tool == "save_to_library":
            # Ensure mission_id for provenance; fill empty text after synthesize if needed later.
            args = dict(action.args or {})
            args.setdefault("mission_id", mission.id)
            if not str(args.get("text") or args.get("body") or "").strip() and mission.answer:
                args["text"] = mission.answer
            obs, evidence, ok = await run_tool("save_to_library", args, runtime=rt)
            mission.steps.append(
                StepItem(
                    index=len(mission.steps),
                    tool="save_to_library",
                    args={"title": str(args.get("title") or "")[:200], "mission_id": mission.id},
                    observation=obs[:2_000],
                    ok=ok,
                )
            )
            mission.evidence.extend(evidence)
            await save_mission(mission)
            continue

        if action.tool == "block":
            reason = str(action.args.get("reason") or action.reason or "blocked").strip()
            mission.block_reason = reason
            mission.status = "blocked"
            mission.steps.append(
                StepItem(
                    index=len(mission.steps),
                    tool="block",
                    args={},
                    observation=reason[:500],
                    ok=True,
                )
            )
            await save_mission(mission)
            break

        tool_args = dict(action.args or {})
        tool_args.setdefault("mission_id", mission.id)
        obs, evidence, ok = await run_tool(action.tool, tool_args, runtime=rt)
        # Strip huge query bodies from persisted args
        safe_args = dict(tool_args)
        if "query" in safe_args:
            safe_args["query"] = str(safe_args["query"])[:400]
        if "url" in safe_args:
            safe_args["url"] = str(safe_args["url"])[:500]
        if "code" in safe_args:
            safe_args["code"] = str(safe_args["code"])[:200]
        if "content" in safe_args:
            safe_args["content"] = str(safe_args["content"])[:200]
        if "data" in safe_args:
            safe_args["data"] = str(safe_args["data"])[:200]
        if "text" in safe_args:
            safe_args["text"] = str(safe_args["text"])[:200]
        if "inputs" in safe_args and isinstance(safe_args["inputs"], dict):
            safe_args["inputs"] = {k: str(v)[:60] for k, v in list(safe_args["inputs"].items())[:10]}
        if "risks" in safe_args and isinstance(safe_args["risks"], list):
            safe_args["risks"] = [str(r)[:60] for r in safe_args["risks"][:5]]
        if "criteria" in safe_args and isinstance(safe_args["criteria"], list):
            safe_args["criteria"] = [str(c)[:60] for c in safe_args["criteria"][:5]]
        if "phases" in safe_args and isinstance(safe_args["phases"], list):
            safe_args["phases"] = [str(p)[:60] for p in safe_args["phases"][:5]]
        if "numbers" in safe_args and isinstance(safe_args["numbers"], list):
            safe_args["numbers"] = safe_args["numbers"][:10]
        mission.steps.append(
            StepItem(
                index=len(mission.steps),
                tool=action.tool,
                args=safe_args,
                observation=obs[:2_000],
                ok=ok,
            )
        )
        mission.evidence.extend(evidence)
        await save_mission(mission)

    await save_mission(mission)
    return mission


__all__ = ("tick_mission",)
