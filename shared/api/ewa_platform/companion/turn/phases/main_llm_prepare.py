# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared main LLM path context preparation: catalog prefetch, HCM memory, system prompt, HTTP messages payload.
# Invariants:
# - Sync and stream call one prepare helper before the HTTP LLM request.
# - ``build_companion_system_prompt`` preserves legacy ``chat_turn._build_system_prompt`` contract for tests.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py (re-exports for legacy tests)
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.actions import actions_emit_instruction
from api.ewa_platform.companion.affective.persona_style import (
    get_persona_style,
    persona_style_prompt_directive,
    persona_style_prompt_directive_for_arlika_quarrel,
)
from api.ewa_platform.companion.config import (
    get_arlika_quarrel_role_prefix,
    get_arlika_quarrel_strict_block,
    get_arlika_quarrel_turn_block,
    get_arlika_strict_output_block,
    get_arlika_system_prompt_tail,
    get_arlika_v2_system_prompt_tail,
    get_character_arlika_v1_quarrel_directive_snippet,
    get_character_feminine_ru_grammar_snippet,
    get_companion_global_chit_chat_tail,
    get_seed_persona_role_prompt,
)
from api.ewa_platform.companion.context.anchor import merged_anchor_for_prompt
from api.ewa_platform.companion.context.controller import run_context_controller_for_turn
from api.ewa_platform.companion.context.noise import sanitize_context_block_for_llm
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.memory import (
    MEMORY_NS,
    clamp_companion_memory_prompt_block,
    get_memory,
    memory_emit_instruction,
    memory_emit_instruction_arlika,
    memory_prompt_section,
)
from api.ewa_platform.companion.memory.chat_condense import companion_condensed_block_from_profile
from api.ewa_platform.companion.memory.ground_truth import fetch_companion_ground_truth_markdown
from api.ewa_platform.companion.memory.memory_phase import compose_memory_for_chat_turn
from api.ewa_platform.companion.memory.retrieval import MemoryWindow
from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.persona.character import (
    CHARACTER_NS,
    character_prompt_section,
    character_style_directive,
    get_character,
)
from api.ewa_platform.companion.persona.continuity import (
    companion_continuity_v1_enabled,
    continuity_prompt_section,
    get_continuity,
)
from api.ewa_platform.companion.sidecar.arlika_quarrel import (
    drop_quarrel_poison_context_lines,
    sanitize_context_anchor_for_arlika_quarrel,
)
from api.ewa_platform.companion.sidecar.file_focus import file_focus_prompt_section
from api.ewa_platform.companion.sidecar.llm_bandwidth import ARLIKA_SEED as _ARLIKA_SEED
from api.ewa_platform.companion.sidecar.llm_bandwidth import (
    companion_llm_user_assistant_slice_for_http,
)
from api.ewa_platform.companion.sidecar.lp_llm_slim import slim_learned_preferences_for_llm_prompt
from api.ewa_platform.companion.sidecar.recent_server_actions import recent_server_actions_prompt_section
from api.ewa_platform.companion.sidecar.shell_context import shell_context_prompt_section
from api.ewa_platform.companion.sidecar.trust_state import ARLIKA_V2_SEED
from api.ewa_platform.companion.storage.catalog_find import CompanionCatalogFindBundle
from api.ewa_platform.companion.turn.companion_image_ocr_analyze import build_llm_user_line_with_image_ocr
from api.ewa_platform.companion.turn.phases.catalog_prefetch import prefetch_catalog_find_bundle_for_turn
from api.ewa_platform.companion.turn.phases.memory_merge import merge_memory_section_append
from api.ewa_platform.companion.turn.system_budget import (
    apply_persona_boundary_scope_guard,
    get_system_max_chars,
)
from api.ewa_platform.companion.turn.vision_attachment import inject_turn_vision_into_llm_messages
from api.ewa_platform.companion.ux.reply_extract import structured_turn_instruction
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.services.llm_runtime.turn_contract import TurnPhaseTracker
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt

logger = logging.getLogger(__name__)

CHAT_NS = "desktop_friend_chat_v1"


@dataclass(frozen=True, slots=True)
class MainLlmPrepareResult:
    """Prepared HTTP LLM context for one main-LLM companion turn."""

    profile_prompt: dict[str, Any]
    memory_section_override: str | None
    catalog_bundle: CompanionCatalogFindBundle | None
    catalog_facts: str
    system_prompt: str
    llm_messages: list[dict[str, Any]]


def slim_profile_for_wire(profile: Mapping[str, Any]) -> dict[str, Any]:
    """Drop transcript/character/memory subtrees before LLM wire JSON snapshot."""

    lp_raw = profile.get("learned_preferences")
    lp_sl = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
    lp_sl.pop(CHAT_NS, None)
    lp_sl.pop(CHARACTER_NS, None)
    lp_sl.pop(MEMORY_NS, None)
    lp_sl = slim_learned_preferences_for_llm_prompt(lp_sl)
    return {
        "schema_version": profile.get("schema_version"),
        "seed_persona_id": profile.get("seed_persona_id"),
        "baseline": profile.get("baseline"),
        "learned_preferences": lp_sl,
        "style_parameters": profile.get("style_parameters"),
        "companion_revision": profile.get("companion_revision"),
    }


def companion_meta_prompt_block(profile: Mapping[str, Any]) -> str:
    """Inject ``learned_preferences.companion_meta_v1`` when present (server evolution)."""

    from api.ewa_platform.companion.plans.config import companion_meta_preferences_key

    prefs = profile.get("learned_preferences")
    if not isinstance(prefs, Mapping):
        return ""
    meta = prefs.get(companion_meta_preferences_key())
    if not isinstance(meta, Mapping):
        return ""
    digest = meta.get("goals_digest")
    lines = ["Companion_meta (from evolution, authoritative):"]
    if isinstance(digest, list) and digest:
        for item in digest[:5]:
            s = str(item).strip()
            if s:
                lines.append(f"- goal_digest: {s}")
    last_plan = str(meta.get("last_plan_id") or "").strip()
    if last_plan:
        lines.append(f"- last_plan_id: {last_plan}")
    return "\n".join(lines) + "\n" if len(lines) > 1 else ""


async def active_task_runs_prompt_block(pool: Any, *, principal_id: str) -> str:
    """Load in-flight durable task runs for system prompt (best-effort)."""

    from api.ewa_platform.companion.orchestration.active_task_runs_prompt import (
        load_active_task_runs_prompt_block,
    )

    try:
        return await load_active_task_runs_prompt_block(pool, principal_id=principal_id)
    except Exception as exc:  # noqa: BLE001
        companion_degrade_debug(
            logger,
            "active_task_runs_prompt_block",
            "active task runs prompt block load failed",
            exc=exc,
            principal_id=principal_id,
        )
        return ""


async def active_calendar_prompt_block(*, principal_id: str) -> str:
    """Load upcoming personal CalendarApp events from main Postgres (best-effort)."""

    from api.ewa_platform.companion.calendar.prompt import format_user_calendar_unavailable_block
    from api.ewa_platform.companion.calendar.service import load_user_calendar_prompt_block

    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        return await load_user_calendar_prompt_block(pool, principal_id=principal_id)
    except Exception as exc:  # noqa: BLE001
        companion_degrade_debug(
            logger,
            "active_calendar_prompt_block",
            "personal calendar prompt block load failed",
            exc=exc,
            principal_id=principal_id,
        )
        return format_user_calendar_unavailable_block()


async def active_plan_prompt_block(pool: Any, *, principal_id: str) -> str:
    """Load active plan digest from EWA Postgres for system prompt (best-effort)."""

    from api.ewa_platform.companion.plans.config import companion_plan_enabled
    from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg

    if not companion_plan_enabled():
        return ""
    try:
        bundle = await plans_pg.plan_get_active(pool, principal_id=principal_id)
        return plans_pg.format_active_plan_prompt_block(bundle)
    except Exception as exc:  # noqa: BLE001
        companion_degrade_debug(
            logger,
            "active_plan_prompt_block",
            "active plan prompt block load failed",
            exc=exc,
            principal_id=principal_id,
        )
        return ""


def build_companion_system_prompt(
    profile: Mapping[str, Any],
    shell_norm: Mapping[str, Any] | None,
    *,
    catalog_server_facts_markdown: str = "",
    memory_section_override: str | None = None,
    condensed_context_block: str = "",
    ground_truth_block: str = "",
    context_anchor_block: str = "",
    active_plan_block: str = "",
    user_calendar_block: str = "",
    active_task_runs_block: str = "",
    companion_meta_block: str = "",
    arlika_quarrel_turn: bool = False,
) -> str:
    """Compose the main companion chat system prompt (sync + SSE)."""

    seed = str(profile.get("seed_persona_id") or "parent").strip().lower()
    persona = get_seed_persona_role_prompt(seed)
    if seed == _ARLIKA_SEED and arlika_quarrel_turn:
        persona = f"{get_arlika_quarrel_role_prefix()}\n\n{persona}"
    wire = companion_pg.companion_profile_llm_wire(slim_profile_for_wire(profile))
    blob = wire.get("companion_profile_json", "")
    style = profile.get("style_parameters")
    style_txt = ""
    if isinstance(style, Mapping) and style:
        style_txt = json.dumps(dict(style), ensure_ascii=False)[:1200]

    character_block = get_character(profile)
    character_section = character_prompt_section(character_block, seed_persona_id=seed)
    continuity_lines = ""
    if companion_continuity_v1_enabled():
        continuity_section = continuity_prompt_section(get_continuity(profile))
        if continuity_section:
            continuity_lines = continuity_section + "\n\n"
    if seed == _ARLIKA_SEED and arlika_quarrel_turn:
        style_directive = (
            "Style directive for this turn: "
            + get_character_arlika_v1_quarrel_directive_snippet()
            + " "
            + get_character_feminine_ru_grammar_snippet()
        )
    else:
        style_directive = character_style_directive(character_block, seed_persona_id=seed)
    if seed == _ARLIKA_SEED and arlika_quarrel_turn:
        persona_style_directive = persona_style_prompt_directive_for_arlika_quarrel()
    else:
        persona_style_directive = persona_style_prompt_directive(get_persona_style(seed))

    if memory_section_override is not None and memory_section_override.strip():
        memory_section = memory_section_override
    else:
        memory_section = memory_prompt_section(get_memory(profile))
    memory_lines = (memory_section + "\n\n") if memory_section else ""

    recent_actions_section = recent_server_actions_prompt_section(profile)
    recent_actions_lines = (recent_actions_section + "\n\n") if recent_actions_section else ""

    file_focus_section = file_focus_prompt_section(profile)
    file_focus_lines = (file_focus_section + "\n\n") if file_focus_section else ""

    active_plan_lines = ""
    apb = (active_plan_block or "").strip()
    if apb and not (seed == _ARLIKA_SEED and arlika_quarrel_turn):
        active_plan_lines = apb + "\n\n"

    user_calendar_lines = ""
    ucb = (user_calendar_block or "").strip()
    if ucb and not (seed == _ARLIKA_SEED and arlika_quarrel_turn):
        user_calendar_lines = ucb + "\n\n"

    active_ops_lines = ""
    atb = (active_task_runs_block or "").strip()
    if atb and not (seed == _ARLIKA_SEED and arlika_quarrel_turn):
        active_ops_lines = atb + "\n\n"

    meta_plan_lines = ""
    cmb = (companion_meta_block or "").strip()
    if cmb:
        meta_plan_lines = cmb + "\n\n"

    mem_inst = memory_emit_instruction_arlika() if seed == _ARLIKA_SEED else memory_emit_instruction()
    shell_lines = ""
    sec = shell_context_prompt_section(shell_norm) if shell_norm else ""
    if sec:
        shell_lines = sec + "\n\n"

    catalog_ground = ""
    csf = (catalog_server_facts_markdown or "").strip()
    if csf:
        catalog_ground = (
            "Server_catalog_snapshot (authoritative for this turn — **EwaFile workspace only** "
            "(desktop folder ``ewa_file``); unified_content ``list_content`` browse/keyword scoped to that folder; "
            "default ordering is ``created_at`` descending unless keyword search; the block is truncated to a small "
            "number of rows and is **not** the user's full Content Manager library).\n"
            "CRITICAL when this block is present: do NOT output a second bullet list of files from memory, from "
            "Desktop_shell_snapshot ``listing``, or guessed from the user’s words; do NOT copy-paste this markdown "
            "block into your reply — the **server** will append the same catalog once at the end of the message. "
            "Either write one or two short sentences pointing to the **EwaFile** catalog below, OR name only files that appear "
            "verbatim in this snapshot. "
            "Never claim the snapshot is the user’s complete account library or that it «matches Content Manager» "
            "pixel‑for‑pixel; do NOT invent ``uc=`` ids.\n"
            f"{csf}\n\n"
        )

    catalogue_read_override = ""
    mem_for_marker = memory_section_override or ""
    if mem_for_marker.strip() and (
        "Server-fetched catalogue document" in mem_for_marker or "Сервер: текст файла из каталога" in mem_for_marker
    ):
        catalogue_read_override = (
            "\n\nFINAL_REMINDER__catalogue_body_in_memory (overrides missing DocEditor lines in Desktop_shell_snapshot):\n"
            "The **Memory** section above includes **Server-fetched catalogue document** / **Сервер: текст файла из каталога** "
            "— the API already injected the document body from unified storage for this turn. "
            "Answer from that text. Do **not** claim you cannot «see» the file or ask to open DocEditor **only** because "
            "the shell snapshot lists ``EwaApp`` and no DocEditor window — server-side reads do not create a window line.\n"
        )

    arlika_strict = ""
    if seed == _ARLIKA_SEED:
        arlika_strict = get_arlika_quarrel_strict_block() if arlika_quarrel_turn else get_arlika_strict_output_block()

    arlika_quarrel_sec = ""
    if seed == _ARLIKA_SEED and arlika_quarrel_turn:
        arlika_quarrel_sec = get_arlika_quarrel_turn_block()

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block
    from api.ewa_platform.companion.prompt_blocks.tool_catalog_md import (
        format_server_tool_catalog_markdown,
    )

    if seed == _ARLIKA_SEED and arlika_quarrel_turn:
        action_fulfillment_rules = get_prompt_block("system.action_fulfillment_rules_quarrel")
    else:
        action_fulfillment_rules = get_prompt_block("system.action_fulfillment_rules")
        if seed == _ARLIKA_SEED:
            action_fulfillment_rules += (
                "Arlika v1 addendum: when the user is **respectful or neutral**, honor fulfillment rules above; "
                "when they insult or bait you, switch to quarrel mode — **no tasks**, verbal dominance only.\n\n"
            )
    tool_catalog_sec = (
        format_server_tool_catalog_markdown() + "\n" + get_prompt_block("system.tool_catalog_capability_rule")
    )
    identity_preamble = get_prompt_block("system.identity_preamble")

    gt = (ground_truth_block or "").strip()
    gt_sec = ""
    if gt:
        gt_sec = (
            "Operator_ground_truth (authoritative facts for this deployment — do not contradict in substance):\n"
            f"{gt}\n\n"
        )
    cd = sanitize_context_block_for_llm(
        (condensed_context_block or "").strip(), max_chars=24_000, apply_episode_sanitizer=True
    )
    if seed == _ARLIKA_SEED and arlika_quarrel_turn and cd:
        cd = drop_quarrel_poison_context_lines(cd)
    cd_sec = ""
    if cd:
        cd_sec = (
            "Earlier_conversation_condensed (archived facts from older transcript rows outside the HTTP LLM tail; "
            "if newer user/assistant lines disagree, prefer the message list):\n"
            f"{cd}\n\n"
        )
    anch_raw = sanitize_context_block_for_llm(
        (context_anchor_block or "").strip(), max_chars=16_000, apply_episode_sanitizer=True
    )
    if seed == _ARLIKA_SEED and arlika_quarrel_turn and anch_raw:
        anch_raw = sanitize_context_anchor_for_arlika_quarrel(anch_raw)
    anchor_sec = ""
    if anch_raw:
        anchor_sec = (
            "Context_anchor (persistent structured summary — prefer over duplicating the same facts in condensed):\n"
            f"{anch_raw}\n\n"
        )

    raw_system_prompt = (
        f"{persona}\n\n"
        f"{gt_sec}"
        f"{anchor_sec}"
        f"{cd_sec}"
        f"{memory_lines}"
        f"{recent_actions_lines}"
        f"{file_focus_lines}"
        f"{active_plan_lines}"
        f"{user_calendar_lines}"
        f"{active_ops_lines}"
        f"{meta_plan_lines}"
        f"{arlika_strict}"
        f"{arlika_quarrel_sec}"
        f"{identity_preamble}"
        f"{tool_catalog_sec}"
        f"{action_fulfillment_rules}"
        f"{character_section}\n\n"
        f"{continuity_lines}"
        f"{style_directive}\n\n"
        f"{persona_style_directive}\n\n"
        f"{mem_inst}\n\n"
        f"{structured_turn_instruction()}\n\n"
        f"{actions_emit_instruction()}\n\n"
        f"{shell_lines}"
        f"{catalog_ground}"
        f"{catalogue_read_override}"
        f"Companion_profile_json (truncated server snapshot, includes learned traits):\n{blob}\n\n"
        f"Style_parameters (truncated):\n{style_txt}"
        f"{'' if seed == _ARLIKA_SEED and arlika_quarrel_turn else get_arlika_system_prompt_tail() if seed == _ARLIKA_SEED else get_arlika_v2_system_prompt_tail() + get_companion_global_chit_chat_tail() if seed == ARLIKA_V2_SEED else get_companion_global_chit_chat_tail()}"
    )
    cap = get_system_max_chars()
    guarded = apply_persona_boundary_scope_guard(raw_system_prompt)
    if len(guarded) > cap:
        logger.info(
            "[STEP] companion_system_budget_truncated len=%s cap=%s",
            len(guarded),
            cap,
        )
        guarded = guarded[: cap - len("\n…[truncated for budget]")] + "\n…[truncated for budget]"
    return append_llm_wall_clock_to_system_prompt(guarded)


async def prepare_main_llm_turn_context(
    pool: asyncpg.Pool,
    *,
    profile: Mapping[str, Any],
    lp: dict[str, Any],
    history: list[dict[str, Any]],
    principal_id: str,
    user_line: str,
    intent_plan: CompanionIntentPlan | None,
    shell_norm: Mapping[str, Any] | None,
    skip_heavy_steps: bool,
    orchestrated_memory_append: str | None,
    orchestration_branch: str | None,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    arlika_quarrel_turn: bool,
    vision_data_url: str | None,
    image_ocr_context: str | None = None,
    telemetry_channel: Literal["sync", "stream"] = "sync",
) -> MainLlmPrepareResult:
    """Prefetch catalog, run context controller + HCM, build system prompt and HTTP messages."""

    stream = telemetry_channel == "stream"
    # Phase 3: retrieve before answer (answer happens in chat_turn after this prepare).
    # Lightweight/arlika skip path intentionally omits HCM retrieve — do not fake the phase.
    turn_phases = TurnPhaseTracker(
        surface="ewa_companion",
        require_retrieve_before_answer=not skip_heavy_steps,
    )
    turn_phases.mark("route")
    catalog_bundle = await prefetch_catalog_find_bundle_for_turn(
        user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        profile=profile,
        orchestrated_memory_append=orchestrated_memory_append,
        orchestration_branch=orchestration_branch,
    )
    catalog_facts = catalog_bundle.appendix if catalog_bundle else ""

    est_weight = sum(len(str(m.get("content") or "")) for m in history)
    fake_sys = "x" * min(max(2000, est_weight + 8000), 120_000)
    ctx_tag = "companion_context_controller_stream" if stream else "companion_context_controller"
    ctx_fail_tag = f"{ctx_tag}_failed" if stream else "companion_context_controller_failed"
    try:
        ctx_telem = await run_context_controller_for_turn(
            lp,
            profile=profile,
            history=history,
            principal_id=principal_id,
            user_line=user_line,
            intent_plan=intent_plan,
            pool=pool,
            system_prompt_for_estimate=fake_sys,
            last_retrieval_ms=None,
        )
        if ctx_telem.get("anchor_refresh_attempted") or ctx_telem.get("condense_pruned"):
            logger.info("[STEP] %s principal=%s detail=%s", ctx_tag, principal_id, ctx_telem)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] %s principal=%s err=%s", ctx_fail_tag, principal_id, exc)

    profile_prompt: dict[str, Any] = dict(profile)
    profile_prompt["learned_preferences"] = lp

    if skip_heavy_steps:
        skip_tag = "companion_memory_window_stream_skipped" if stream else "companion_memory_window_skipped"
        logger.info("[STEP] %s principal=%s reason=arlika_lightweight", skip_tag, principal_id)
        mem_window: MemoryWindow | None = None
    else:
        mem_window = await compose_memory_for_chat_turn(
            profile=profile_prompt,
            principal_id=principal_id,
            current_user_text=user_line,
            persona=str(profile.get("seed_persona_id") or "parent"),
            pool=pool,
            intent_plan=intent_plan,
        )
        turn_phases.mark("retrieve")
    if mem_window is not None and getattr(mem_window, "layer_telemetry", None):
        layer_tag = "companion_memory_layer_telemetry_stream" if stream else "companion_memory_layer_telemetry"
        logger.info("[STEP] %s principal=%s %s", layer_tag, principal_id, mem_window.layer_telemetry)
    if mem_window is not None and (mem_window.episodic_hits or "episodic" in " ".join(mem_window.used_layers)):
        window_tag = "companion_memory_window_stream" if stream else "companion_memory_window"
        logger.info(
            "[STEP] %s principal=%s layers=%s episodic_hits=%s fallback=%s",
            window_tag,
            principal_id,
            ",".join(mem_window.used_layers),
            mem_window.episodic_hits,
            mem_window.fallback_used,
        )
    memory_section_override = mem_window.prompt_section if mem_window is not None else None
    memory_section_override = merge_memory_section_append(memory_section_override, orchestrated_memory_append)
    memory_section_override = clamp_companion_memory_prompt_block(memory_section_override)

    gt_block = await fetch_companion_ground_truth_markdown(pool, principal_id=principal_id)
    condensed_block = sanitize_context_block_for_llm(
        companion_condensed_block_from_profile(profile_prompt),
        max_chars=24_000,
        apply_episode_sanitizer=True,
    )
    anchor_block, _anchor_model = merged_anchor_for_prompt(profile_prompt)
    active_plan_block = await active_plan_prompt_block(pool, principal_id=principal_id)
    user_calendar_block = "" if arlika_quarrel_turn else await active_calendar_prompt_block(principal_id=principal_id)
    active_task_runs_block = await active_task_runs_prompt_block(pool, principal_id=principal_id)
    companion_meta_block = companion_meta_prompt_block(profile_prompt)
    system_prompt = build_companion_system_prompt(
        profile_prompt,
        shell_norm,
        catalog_server_facts_markdown=catalog_facts,
        memory_section_override=memory_section_override,
        condensed_context_block=condensed_block,
        ground_truth_block=gt_block,
        context_anchor_block=anchor_block,
        active_plan_block=active_plan_block,
        user_calendar_block=user_calendar_block,
        active_task_runs_block=active_task_runs_block,
        companion_meta_block=companion_meta_block,
        arlika_quarrel_turn=arlika_quarrel_turn,
    )
    llm_messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(companion_llm_user_assistant_slice_for_http(profile, history))
    if vision_data_url:
        inject_turn_vision_into_llm_messages(
            llm_messages,
            user_text=user_line,
            data_url=vision_data_url,
        )
        vision_directive = (
            "\n\n**Vision turn:** the user's latest message includes a **new attached image**. "
            "Answer about **this** image (describe, read visible text, interpret). "
            "Do not recycle OCR or descriptions from earlier turns unless the user explicitly "
            "asks to compare or refers to a previous image."
        )
        llm_messages[0] = {
            "role": "system",
            "content": str(llm_messages[0].get("content") or "") + vision_directive,
        }
    elif image_ocr_context:
        effective_user_line = build_llm_user_line_with_image_ocr(
            user_line=user_line,
            image_ocr_context=image_ocr_context,
        )
        for idx in range(len(llm_messages) - 1, -1, -1):
            if llm_messages[idx].get("role") == "user":
                llm_messages[idx] = {"role": "user", "content": effective_user_line}
                break
        else:
            llm_messages.append({"role": "user", "content": effective_user_line})
        ocr_directive = (
            "\n\n**Image turn (OCR mode):** The user attached an image; OCR text is in the latest user "
            "message block. Answer using that text. If OCR found nothing, explain that pixel-level vision "
            "is unavailable on this stack and suggest a clearer photo or the dedicated OCR tool for raw text."
        )
        llm_messages[0] = {
            "role": "system",
            "content": str(llm_messages[0].get("content") or "") + ocr_directive,
        }
    turn_phases.assert_ready_for_answer()
    return MainLlmPrepareResult(
        profile_prompt=profile_prompt,
        memory_section_override=memory_section_override,
        catalog_bundle=catalog_bundle,
        catalog_facts=catalog_facts,
        system_prompt=system_prompt,
        llm_messages=llm_messages,
    )


__all__ = (
    "CHAT_NS",
    "MainLlmPrepareResult",
    "active_calendar_prompt_block",
    "active_plan_prompt_block",
    "active_task_runs_prompt_block",
    "build_companion_system_prompt",
    "companion_meta_prompt_block",
    "prepare_main_llm_turn_context",
    "slim_profile_for_wire",
)
