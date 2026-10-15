# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stream one legacy freeform ensemble turn with coordinated speakers and joint/separate delivery.
# Invariants:
# - `chat.updated_at` is refreshed after a successful turn.
# - Short social turns stay concise; substantive turns use the shared expert-answer contract.
# - Wave F0+: sequential council only; speech transcript + orchestrator brief, never peer Document sections.
# - Wave F1: council_transcript persisted on assistant metadata + SSE council_turn append.
# - Wave F3: closing ok|supplement + Document draft assembled from transcript speaker_replies.
# - Council speech and Document section are separate LLM lanes; peer documents never become speech context.
# Related:
# - api/services/desktop_chat/ux/expert_reply_contract.py
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - archive/legacy_freeform/council_brief.py
# - archive/legacy_freeform/council_transcript.py
# - archive/legacy_freeform/council_finalize.py
# ---
"""SSE stream for one user turn in ensemble (multi-speaker) mode."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import suppress
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.collaboration_authors import SHARED_CHAT_SPEAKER_NUDGE
from api.services.desktop_chat.generation_budgets_settings import (
    JOINT_ASSESSMENT_DEFAULT,
    JOINT_STANDARD_DEFAULT,
    REPLY_OVERRIDE_CAP,
    SEPARATE_ASSESSMENT_DEFAULT,
    SEPARATE_STANDARD_DEFAULT,
)
from api.services.desktop_chat.service import (
    build_rag_prefix,
    persist_assistant_message_isolated,
    record_desktop_chat_turn_memory,
    resolve_desktop_chat_model,
)
from api.services.desktop_chat.ux.expert_reply_contract import (
    EXPERT_REPLY_CONTRACT_VERSION,
    expert_reply_contract_instruction,
    registry_list_reply_instruction,
)
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.archive.legacy_freeform.chair import chair_refine_joint_blueprint
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_brief import (
    council_speaker_brief_block,
    resolve_council_mode,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_finalize import (
    apply_council_closing,
    assemble_markdown_from_council_transcript,
    required_sections_from_council_transcript,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_document_final_instruction,
    council_generation_history,
    council_speech_final_instruction,
    council_speech_looks_like_document,
    council_speech_response_format,
    council_speech_system_append,
    council_speech_transcript_message,
    format_council_speech_line,
    parse_council_speech,
    strip_continuation_memory_context,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_parallel import (
    collect_joint_section_text,
    joint_parallel_sections_enabled,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish import polish_joint_concat
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    EnsembleTaskBlock,
    parse_registry_list_count,
    plan_ensemble_speakers,
    user_human_support_request,
    user_requests_per_member_registry_list,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.registry_list_json import (
    build_registry_document_and_preview,
    build_registry_response_format,
    collect_peer_item_names,
    registry_json_system_append,
)
from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    ArtifactFinalizationResult,
    apply_finalization_status,
    finalize_artifact,
)
from api.services.desktop_chat_ensemble.heroes import (
    HERO_SHORT_LABEL,
    short_reply_prompt_for_hero,
    system_prompt_for_hero,
)
from api.services.desktop_chat_ensemble.heroes_collective_souls_data import (
    COLLECTIVE_SOULS_HUMAN_SUPPORT_TURN_NOTE,
)
from api.services.desktop_chat_ensemble.history import ensemble_messages_for_llama
from api.services.desktop_chat_ensemble.joint_section_dedupe import (
    dedupe_joint_markdown,
    strip_joint_history_preamble,
)
from api.services.desktop_chat_ensemble.settings import DEFAULT_ENSEMBLE_SYSTEM_PROMPT, get_ensemble_roster
from api.services.desktop_chat_ensemble.speaker_output import (
    sanitize_ensemble_model_output,
    scrub_ensemble_channel_leak,
)
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

# История к Llama уже помечает чужие реплики префиксами [краткое имя]; модель часто копирует формат.
_SPEAKER_ENSEMBLE_APPEND = (
    "\n\n[Режим панели] Ты сейчас единственный говорящий в этом сообщении: один связный текст от своего персонажа. "
    "Если пользователь просит ответить нескольким участникам панели — дай только свою часть; остальные ответят отдельными сообщениями. "
    "Не повторяй тот же пошаговый roadmap/список этапов, который коллега уже сформулировал в этом ходу — добавь только свой угол, риски или уточнения по своему блоку. "
    "Не начинай ответ с самопрезентации, заголовка со своим именем, character card, процента «честности» или повторного описания роли, если пользователь этого прямо не просил. "
    "Не пиши реплик за другого участника и не имитируй оформление чужих реплик. "
    "История служебно помечена фразой «Реплика участника …» — никогда не повторяй её в ответе (ни в начале, ни внутри текста). "
    "Не используй префиксы в квадратных скобках вроде [Имя] и не дублируй блоки как будто это чат из нескольких спикеров в одном сообщении. "
    "Никогда не копируй в ответ пользователю служебные пометки вида [Твой блок …] — они только для модели и должны исчезать из текста. "
    "Не выдумывай для себя другое имя или псевдоним в скобках — только персонаж из твоего системного описания."
)

# Совместный пузырь (joint): секции склеиваются в одном сообщении — без «отдельными сообщениями».
_SPEAKER_ENSEMBLE_APPEND_JOINT = (
    "\n\n[Режим панели — совместное сообщение] Твоя реплика станет **одной** секцией в общем ответе (рядом с коллегами). "
    "Пиши только от своего персонажа и **только свою ось** из блока «Твой блок» / плана координации. "
    "Если выше есть служебное **оглавление** секций коллег — не копируй и не переписывай их списки; "
    "добавь только новые пункты своего фокуса. "
    "Запрещено: полный реестр по всем зонам ответственности; повтор вводных "
    "«Совместный ответ участников…», «Команда сформировала…»; заголовки чужих зон; "
    "заголовок со своим именем (`## Имя`) — заголовок секции добавит сборщик. "
    "Объём: достаточно для самостоятельной полезной доли, без искусственного ужатия и без второго полного документа. "
    "История служебно помечена «Реплика участника …» / «Совместный ответ участников …» — никогда не повторяй эти фразы. "
    "Не используй префиксы в квадратных скобках вроде [Имя]. "
    "Никогда не копируй служебные пометки вида [Твой блок …]. "
    "Не выдумывай для себя другое имя или псевдоним в скобках — только персонаж из твоего системного описания."
)


def _legacy_grounding_quality_status(rag_ctx: dict[str, Any]) -> dict[str, Any]:
    raw_sources = rag_ctx.get("context_sources")
    sources = raw_sources if isinstance(raw_sources, list) else []
    kinds = {str(row.get("kind") or "").strip() for row in sources if isinstance(row, dict)}
    if kinds.intersection({"chat_attachment", "project_document", "web"}):
        grounding_status = "grounded"
        grounding_label = "Основано на материалах"
    elif "derived_ai_artifact" in kinds:
        grounding_status = "derived_context"
        grounding_label = "Опора на ранее созданный AI-документ"
    else:
        grounding_status = "light_context"
        grounding_label = "Ограниченный контекст"
    return {
        "status": "draft",
        "label": "Формируется",
        "grounding_status": grounding_status,
        "grounding_label": grounding_label,
    }


def _turn_text_mode(user_text: str) -> str:
    t = (user_text or "").strip().casefold()
    if not t:
        return "standard"
    if user_requests_per_member_registry_list(user_text):
        return "registry"
    if _is_acknowledgement_turn(t):
        return "ack"
    if user_human_support_request(user_text):
        return "support"
    if _is_social_turn(t):
        return "social"
    if _is_project_assessment_turn(t):
        return "assessment"
    return "standard"


def _is_acknowledgement_turn(text: str) -> bool:
    if not text or len(text) > 80:
        return False
    ack = (
        "ясно",
        "понятно",
        "ок",
        "окей",
        "ага",
        "угу",
        "принято",
        "спасибо",
        "понял",
        "поняла",
    )
    return any(
        text == x
        or text.startswith(f"{x} ")
        or text.startswith(f"{x}.")
        or text.startswith(f"{x},")
        or text.startswith(f"{x}…")
        for x in ack
    )


def _is_social_turn(text: str) -> bool:
    if not text or len(text) > 220:
        return False
    greet = (
        "привет",
        "здравств",
        "добрый",
        "доброе",
        "hello",
        "hi ",
        "хай",
        "йо",
    )
    if any(x in text for x in ("как ваше настроение", "как настроение", "как дела", "как вы")):
        return True
    if any(g in text for g in greet):
        return True
    return bool("настроен" in text and any(x in text for x in ("ваше", "вас", "всем", "ребят")))


def _is_project_assessment_turn(text: str) -> bool:
    if not text or len(text) > 500:
        return False
    blockers = (
        "план",
        "бриф",
        "тз",
        "документ",
        "roadmap",
        "дорожн",
        "бизнес-план",
        "бизнес план",
        "по пунктам",
        "единый",
    )
    if any(x in text for x in blockers):
        return False
    return any(
        x in text
        for x in (
            "оцен",
            "что скаж",
            "че скаж",
            "как вам",
            "мнение",
            "разбор проекта",
        )
    )


def _reply_contract_block(turn_mode: str, *, is_joint: bool, user_text: str = "") -> str:
    if turn_mode == "registry":
        count = parse_registry_list_count(user_text)
        return f"\n\n[Контракт реестра вкладов] {registry_list_reply_instruction(item_count=count)}"
    if turn_mode == "ack":
        return (
            "\n\n[Контракт короткой реакции] Пользователь не просит новую длинную генерацию. "
            "Ответь 1–2 предложениями: коротко подтвердить, помочь выбрать следующий шаг или задать один короткий уточняющий вопрос. "
            "Игнорируй любые стандартные правила персонажа про обязательные приветствия, ритуалы и многошаговые структуры. "
            "Без списков, планов, методологий, самопрезентации и длинных прелюдий."
        )
    if turn_mode == "social":
        return (
            "\n\n[Контракт короткого social-turn] Это приветствие/вопрос о настроении, а не рабочая сессия. "
            "Ответь 1–3 предложениями. Никаких нумерованных шагов, методик, длинных рамок, all-caps-манифестов, процентов честности, "
            "характер-карточек и повторного объяснения своей роли. Игнорируй любые встроенные в персонажа обязательные приветственные ритуалы. "
            "Не перечисляй свою профессиональную специализацию и не рекламируй свою зону силы, если пользователь просто поздоровался или спросил о настроении. "
            "Если хочешь задать встречный вопрос — только один и короткий."
        )
    if turn_mode == "support":
        return (
            "\n\n[Контракт human-support] Пользователь просит человеческую поддержку, а не техдокумент и не аудит. "
            "Ответь 2–4 предложениями: присутствие, слушание, мягкое приглашение рассказать. "
            "Запрещено: markdown-заголовки (##), списки, вопросы про стек/K8s/лицензии/архитектуру/инфраструктуру, "
            "технический аудит, vendor lock-in, copyleft-лекции и любые «следующие шаги» в стиле инженерного плана. "
            "Не уходи в свою профессиональную зону силы, если пользователь не назвал техническую задачу. "
            "Один короткий уточняющий вопрос допустим — только про человека и ситуацию, не про технологии. "
            f"{COLLECTIVE_SOULS_HUMAN_SUPPORT_TURN_NOTE}"
        )
    if turn_mode == "assessment":
        contract_mode = "joint" if is_joint else "assessment"
        return (
            "\n\n[Контракт профессиональной оценки] Пользователь просит оценку/мнение, а не готовый документ-шаблон. "
            "Дай развёрнутый профессиональный вердикт по своему углу: обоснование, риски, сильные стороны, пробелы в данных и практические выводы. "
            "Не превращай ответ в полный roadmap/бриф/бизнес-план с нуля, но не ужимай оценку до пары фраз. "
            "Используй только доступные данные; формулируй как предварительную экспертную оценку и не отказывайся целиком из-за неполного контекста. "
            "Не ссылайся на внутренние labels/фрагменты/служебные файлы."
            f"\n\n{expert_reply_contract_instruction(mode=contract_mode)}"
        )
    if is_joint:
        return (
            "\n\n[Контракт joint-секции] Раскрой свой слой полно и предметно, как профессионал: достаточно объёма, чтобы секция была самостоятельной и полезной. "
            "Не дублируй целиком чужой план, но не сокращай свой вклад искусственно. "
            "Не вставляй заголовок со своим именем, `Цель секции`, `Ответ ...`, `Примечание` и другие служебные обёртки. "
            "Не повторяй строки `Реплика участника ...` и не ссылайся на внутренние labels/фрагменты."
            f"\n\n{expert_reply_contract_instruction(mode='joint')}"
        )
    return (
        "\n\n[Контракт отдельной реплики] Ответь объёмно и полноценно, как практикующий эксперт панели: "
        "развёрнутое рассуждение, конкретные рекомендации, примеры и структура (абзацы/списки по делу), без искусственного ужатия. "
        "Не обрывай мысль на полуслове; доведи ответ до завершённого профессионального заключения. "
        "Без самопрезентации и без повторения уже сказанного коллегами. "
        "Не ссылайся на внутренние labels/фрагменты и не цитируй служебные куски истории."
        f"\n\n{expert_reply_contract_instruction(mode='standard')}"
    )


def _expert_reply_metadata(turn_mode: str) -> dict[str, str]:
    if turn_mode not in {"assessment", "standard"}:
        return {}
    return {"desktop_expert_reply_contract": EXPERT_REPLY_CONTRACT_VERSION}


def _reply_max_tokens(defaults: dict[str, Any], *, turn_mode: str, is_joint: bool) -> int:
    """Per-speaker generation budget. Ack/social stay short; standard/assessment are long-form."""
    raw_key = "ensemble_joint_section_max_tokens" if is_joint else "ensemble_separate_reply_max_tokens"
    raw = defaults.get(raw_key)
    try:
        override = int(raw) if raw is not None and raw != "" else 0
    except (TypeError, ValueError):  # fmt: skip
        override = 0
    if override > 0:
        return max(128, min(override, REPLY_OVERRIDE_CAP))
    if is_joint:
        return {
            "ack": 220,
            "social": 320,
            "support": 360,
            "registry": 1100,
            "assessment": JOINT_ASSESSMENT_DEFAULT,
            "standard": JOINT_STANDARD_DEFAULT,
        }.get(turn_mode, JOINT_STANDARD_DEFAULT)
    return {
        "ack": 200,
        "social": 280,
        "support": 320,
        "registry": 1000,
        "assessment": SEPARATE_ASSESSMENT_DEFAULT,
        "standard": SEPARATE_STANDARD_DEFAULT,
    }.get(turn_mode, SEPARATE_STANDARD_DEFAULT)


def _joint_blueprint_body_for_chair(blocks: tuple[EnsembleTaskBlock, ...]) -> str:
    lines: list[str] = []
    for b in blocks:
        nm = HERO_SHORT_LABEL.get(b.hero_id, b.hero_id)
        lines.append(f"- `{b.block_id}` ({nm}): **{b.title}** — {b.objective}")
    return "\n".join(lines)


def _joint_blueprint_user_message(
    blocks: tuple[EnsembleTaskBlock, ...],
    chair_notes: str,
) -> dict[str, Any]:
    lines = [
        "[Служебно: утверждённая раскладка ответа на этот ход]",
        "Каждый спикер в своей секции раскрывает **только** свой блок ниже; не переписывай полностью чужие блоки и не строй второй общий план с нуля.",
        "",
    ]
    lines.append(_joint_blueprint_body_for_chair(blocks))
    if chair_notes.strip():
        lines.extend(["", "### Согласование председателя", chair_notes.strip()])
    return {"role": "user", "content": "\n".join(lines)}


def _joint_section_title(
    block: EnsembleTaskBlock | None,
    *,
    index: int,
) -> str:
    """Return a semantic heading, never the internal speaker label."""
    raw = block.title if block is not None else ""
    title = " ".join((raw or "").replace("\n", " ").split()).lstrip("#>*-` ").strip()
    return title[:160] or f"Смысловой блок {index + 1}"


def _council_transcript_meta(acc: CouncilTranscriptAccumulator | None) -> dict[str, Any]:
    if acc is None or not acc.turns:
        return {}
    return {"council_transcript": acc.to_dict()}


async def stream_ensemble_turn(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    enriched_user_content: str | None = None,
    rag_context_summary: dict[str, Any] | None = None,
    speaker_context: dict[str, Any] | None = None,
) -> AsyncGenerator[str]:
    """Yields SSE after user message was persisted and committed; ``history`` includes new user row."""
    speaker_context = speaker_context or {}
    is_shared = bool(speaker_context.get("is_shared"))
    speaker_labels = speaker_context.get("labels") or {}
    roster = get_ensemble_roster(chat.settings or {})
    if not roster:
        yield f"data: {json.dumps({'event': 'error', 'message': 'ensemble_empty_roster'})}\n\n"
        return

    if enriched_user_content is not None:
        enriched = enriched_user_content
        rag_ctx = dict(rag_context_summary or {})
    else:
        enriched, rag_ctx = await build_rag_prefix(
            db_pool=db_pool,
            user_id=user_id,
            chat_id=chat.id,
            project_id=chat.project_id,
            use_project_rag=bool(chat.use_project_rag),
            history=history,
            user_text=user_text,
            defaults=defaults,
            owner_user_id=chat.user_id,
            speaker_context=speaker_context,
        )

    model = resolve_desktop_chat_model(chat, defaults)
    llama = LlamaService()
    stream_t0 = time.monotonic()
    last_beat = asyncio.get_event_loop().time()
    n_chunks = 0
    speakers: list[str] = []
    memory_turn_assistant = ""
    memory_assistant_message_id: UUID | None = None
    finalization_result: ArtifactFinalizationResult | None = None
    final_quality_status: dict[str, Any] | None = None
    joint_budget: dict[str, Any] | None = None
    council_acc: CouncilTranscriptAccumulator | None = None

    try:
        async with llama:
            yield f"data: {json.dumps({'event': 'planning', 'detail': 'orchestrator'}, ensure_ascii=False)}\n\n"
            plan_task = asyncio.create_task(
                plan_ensemble_speakers(
                    llama,
                    model=model,
                    roster=roster,
                    history=history,
                    user_excerpt=user_text,
                    rag_summary=rag_ctx,
                    defaults=defaults,
                )
            )
            while not plan_task.done():
                done, _ = await asyncio.wait(
                    {plan_task},
                    timeout=2.0,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if plan_task in done:
                    break
                yield ": keep-alive\n\n"
            turn_plan = plan_task.result()
            speakers = list(turn_plan.speakers)

            plan_payload = {
                "event": "ensemble_plan",
                "speakers": turn_plan.speakers,
                "delivery_mode": turn_plan.delivery_mode,
                "reason": turn_plan.reason,
                "task_blocks": [
                    {
                        "id": b.block_id,
                        "hero_id": b.hero_id,
                        "title": b.title,
                        "objective": b.objective,
                        "phase": b.phase,
                    }
                    for b in turn_plan.task_blocks
                ],
                "focus": [{"id": h, "brief": turn_plan.focus_by_id.get(h, "")} for h in turn_plan.speakers],
                "huddle_lines": turn_plan.huddle_lines,
                "roster_size": turn_plan.roster_size,
                "max_speakers_this_turn": turn_plan.max_speakers_this_turn,
            }
            yield f"data: {json.dumps(plan_payload, ensure_ascii=False)}\n\n"

            council_mode = resolve_council_mode(turn_plan.delivery_mode)
            council_acc = CouncilTranscriptAccumulator(mode=council_mode, roster=list(speakers))
            # Opening/mid orchestrator briefs stay in ensemble_plan + speaker system prompts —
            # not in council_transcript (Process tab = participant replies only).

            base_system = (chat.system_prompt_override or "").strip() or (
                defaults.get("default_system_prompt") or ""
            ).strip()
            if not base_system:
                base_system = DEFAULT_ENSEMBLE_SYSTEM_PROMPT

            working_history = list(history)
            is_joint = turn_plan.delivery_mode == "joint" and len(speakers) >= 2
            block_by_hero = {b.hero_id: b for b in turn_plan.task_blocks}
            turn_mode = _turn_text_mode(user_text)
            use_short_prompt = turn_mode in {"ack", "social", "support", "assessment"}
            council_interludes = 0

            def _hero_block_coord(tb: EnsembleTaskBlock | None) -> str:
                if not tb:
                    return ""
                return (
                    f"\n\n[Твой блок `{tb.block_id}`: {tb.title}]\n"
                    f"Цель секции: {tb.objective}\n"
                    "Не раскрывай содержание блоков коллег с другими id; не повторяй их пункты теми же формулировками."
                )

            def _markdown_blocks(pairs: list[tuple[str, str, str]]) -> str:
                parts = [f"## {title}\n\n{body}" for _hid, title, body in pairs if body]
                return "\n\n---\n\n".join(parts)

            if is_joint:
                section_pairs: list[tuple[str, str, str]] = []
                chair_notes = ""
                if defaults.get("ensemble_joint_chair_enabled") is True:
                    draft_chair = _joint_blueprint_body_for_chair(turn_plan.task_blocks)
                    try:
                        raw_ct = defaults.get("ensemble_joint_chair_max_tokens")
                        cmax = int(raw_ct) if raw_ct is not None and raw_ct != "" else 512
                    except (TypeError, ValueError):  # fmt: skip
                        cmax = 512
                    chair_notes = await chair_refine_joint_blueprint(
                        llama,
                        model=model,
                        user_excerpt_tail=enriched[:6000],
                        draft_blueprint_markdown=draft_chair,
                        max_tokens=cmax,
                    )
                    if chair_notes.strip():
                        yield f"data: {json.dumps({'event': 'ensemble_chair_done', 'preview': chair_notes[:600]}, ensure_ascii=False)}\n\n"
                blueprint_msg = _joint_blueprint_user_message(turn_plan.task_blocks, chair_notes)
                joint_parallel_requested = turn_mode != "registry" and joint_parallel_sections_enabled(
                    defaults, speaker_count=len(speakers)
                )
                # A real council needs turn-taking. The former parallel document race cannot
                # produce a speech transcript and is ignored even when a stale admin flag is on.
                joint_parallel = False
                if joint_parallel_requested:
                    logger.warning(
                        "[STEP] ensemble_joint_parallel_ignored reason=council_speech_protocol speakers=%s",
                        len(speakers),
                    )
                joint_budget = {
                    "parallel": joint_parallel,
                    "polish_reverted": False,
                    "compression_skipped": False,
                    "duplicates_stripped": 0,
                }
                joint_mt = _reply_max_tokens(defaults, turn_mode=turn_mode, is_joint=True)
                clean_enriched = strip_continuation_memory_context(enriched)
                generation_history = council_generation_history(
                    working_history,
                    current_user_text=user_text,
                )

                raw_speech_mt = defaults.get("ensemble_council_speech_max_tokens")
                try:
                    speech_mt = int(raw_speech_mt) if raw_speech_mt not in (None, "") else 4096
                except (TypeError, ValueError):  # fmt: skip
                    speech_mt = 4096
                speech_mt = max(512, min(joint_mt, speech_mt))
                raw_speech_temperature = defaults.get("ensemble_council_speech_temperature")
                try:
                    speech_temperature = (
                        float(raw_speech_temperature) if raw_speech_temperature not in (None, "") else 0.85
                    )
                except (TypeError, ValueError):  # fmt: skip
                    speech_temperature = 0.85
                speech_temperature = max(0.0, min(2.0, speech_temperature))

                async def _generate_council_speech(
                    *,
                    hero_id: str,
                    idx: int,
                    speech_lines: list[str],
                ) -> str:
                    hero_prompt = (
                        short_reply_prompt_for_hero(hero_id) if use_short_prompt else system_prompt_for_hero(hero_id)
                    )
                    if not hero_prompt:
                        return ""
                    tb = block_by_hero.get(hero_id)
                    block_title = _joint_section_title(tb, index=idx)
                    block_objective = (
                        (tb.objective or "").strip()
                        if tb is not None
                        else (turn_plan.focus_by_id.get(hero_id) or block_title).strip()
                    )
                    speech_system = (
                        f"{base_system}\n\n---\n\n{hero_prompt}"
                        f"{council_speech_system_append(hero_id=hero_id, block_title=block_title, block_objective=block_objective, position=idx + 1, total=len(speakers), has_prior_speeches=bool(speech_lines))}"
                    ).strip()
                    if is_shared and SHARED_CHAT_SPEAKER_NUDGE not in speech_system:
                        speech_system = f"{speech_system}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
                    speech_inject: list[dict[str, Any]] = []
                    if speech_lines:
                        speech_inject.append(council_speech_transcript_message(speech_lines))
                    messages = ensemble_messages_for_llama(
                        system_prompt=speech_system,
                        history=generation_history,
                        user_content=clean_enriched or user_text,
                        inject_messages=speech_inject,
                        is_shared=is_shared,
                        owner_id=chat.user_id,
                        speaker_labels=speaker_labels,
                    )
                    messages.append(
                        council_speech_final_instruction(
                            hero_id=hero_id,
                            block_title=block_title,
                        )
                    )
                    raw = ""
                    speech = ""
                    for attempt in range(2):
                        call_messages = list(messages)
                        if attempt:
                            call_messages.append(
                                {
                                    "role": "user",
                                    "content": (
                                        "Предыдущий вариант был похож на документ или список. "
                                        "Повтори живой устный вклад без markdown-заголовков, "
                                        "нумерованного реестра и секретарского вступления. "
                                        "Не называй весь запрошенный набор: выскажи один тезис, "
                                        "возражение, риск или критерий решения; допустим максимум "
                                        "один короткий пример, детали останутся в документе. "
                                        "Верни только JSON с полем speech."
                                    ),
                                }
                            )
                        try:
                            result = await llama.chat(
                                call_messages,
                                model=model,
                                max_tokens=speech_mt,
                                temperature=(speech_temperature if attempt == 0 else min(speech_temperature, 0.65)),
                                response_format=council_speech_response_format(),
                            )
                        except Exception as speech_ex:
                            logger.warning(
                                "[STEP] ensemble_council_speech_fail hero=%s attempt=%s err=%s",
                                hero_id,
                                attempt + 1,
                                speech_ex,
                            )
                            return ""
                        raw = scrub_ensemble_channel_leak(str(result.get("text") or ""))
                        speech = parse_council_speech(raw)
                        if speech:
                            speech = sanitize_ensemble_model_output(
                                speech,
                                hero_id=hero_id,
                                roster_hero_ids=roster,
                            )
                        if speech and not council_speech_looks_like_document(speech):
                            break
                        logger.warning(
                            "[STEP] ensemble_council_speech_repair hero=%s attempt=%s",
                            hero_id,
                            attempt + 1,
                        )
                        speech = ""
                    if not speech:
                        logger.warning("[STEP] ensemble_council_speech_empty hero=%s", hero_id)
                    await ensemble_audit_log.log_stream_turn(
                        f"legacy_council_speech_{idx}_{hero_id}",
                        messages=messages,
                        model=model,
                        max_tokens=speech_mt,
                        response_text=raw,
                        extra={
                            "index": idx,
                            "hero_id": hero_id,
                            "speech_only": True,
                            "prior_speeches": len(speech_lines),
                        },
                    )
                    return speech

                def _joint_system_and_inject(
                    *,
                    hero_id: str,
                    idx: int,
                    peer_pairs: list[tuple[str, str, str]] | None,
                ) -> tuple[str, list[dict[str, Any]], str]:
                    hero_prompt = (
                        short_reply_prompt_for_hero(hero_id) if use_short_prompt else system_prompt_for_hero(hero_id)
                    )
                    if not hero_prompt:
                        return "", [], ""
                    tb = block_by_hero.get(hero_id)
                    focus_line = (turn_plan.focus_by_id.get(hero_id) or "").strip()
                    others = [h for h in speakers if h != hero_id]
                    others_lbl = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in others)
                    coord_block = ""
                    if focus_line and others_lbl:
                        coord_block = (
                            f"\n\n[План координации] Твой фокус в этом ходу: {focus_line}. "
                            f"Не повторяй подробно те блоки, которые логичнее оставить другим спикерам этого хода "
                            f"({others_lbl}); дополняй, уточняй или спорь по существу, без второго полного дубля структуры ответа."
                        )
                    elif focus_line:
                        coord_block = f"\n\n[План координации] Твой фокус в этом ходу: {focus_line}."
                    elif turn_plan.reason:
                        coord_block = f"\n\n[План координации] Кратко для всех спикеров этого хода: {turn_plan.reason}"
                    coord_block += _hero_block_coord(tb)
                    coord_block += council_speaker_brief_block(
                        index=idx,
                        speakers=speakers,
                        mode=council_mode,
                        hero_id=hero_id,
                    )
                    section_title = _joint_section_title(tb, index=idx)
                    if peer_pairs:
                        coord_block += (
                            "\n\n[Документ · отдельная дорожка] Секции коллег не передаются в этот вызов. "
                            "Пиши только свой task block; итоговый редактор объединит документ после совещания."
                        )
                    if turn_mode == "registry":
                        peer_names = collect_peer_item_names(list(peer_pairs or []))
                        contract_block = registry_json_system_append(
                            zone_title=section_title or focus_line or HERO_SHORT_LABEL.get(hero_id, hero_id),
                            item_count=parse_registry_list_count(user_text),
                            peer_item_names=peer_names,
                        )
                    else:
                        contract_block = _reply_contract_block(turn_mode, is_joint=True, user_text=user_text)
                    system_prompt = (
                        f"{base_system}\n\n---\n\n{hero_prompt}{coord_block}{_SPEAKER_ENSEMBLE_APPEND_JOINT}"
                        f"{contract_block}\n\n[Документ · отдельная дорожка] "
                        "Сейчас создай только содержимое своей секции итогового документа. "
                        "Не пиши реплику совещания и не пересказывай секции коллег."
                    ).strip()
                    inject_list: list[dict[str, Any]] = [blueprint_msg]
                    if is_shared and SHARED_CHAT_SPEAKER_NUDGE not in system_prompt:
                        system_prompt = f"{system_prompt}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
                    return system_prompt, inject_list, section_title

                if joint_parallel:
                    yield f"data: {json.dumps({'event': 'ensemble_joint_parallel_start', 'speakers': len(speakers)}, ensure_ascii=False)}\n\n"
                    joint_mt = _reply_max_tokens(defaults, turn_mode=turn_mode, is_joint=True)

                    async def _one_parallel(idx: int, hero_id: str) -> tuple[int, str, str, str, list[dict[str, Any]]]:
                        system_prompt, inject_list, section_title = _joint_system_and_inject(
                            hero_id=hero_id,
                            idx=idx,
                            peer_pairs=None,
                        )
                        if not system_prompt:
                            return idx, hero_id, section_title or f"Смысловой блок {idx + 1}", "", []
                        llama_messages = ensemble_messages_for_llama(
                            system_prompt=system_prompt,
                            history=working_history,
                            user_content=enriched,
                            inject_messages=inject_list,
                            is_shared=is_shared,
                            owner_id=chat.user_id,
                            speaker_labels=speaker_labels,
                        )
                        text = await collect_joint_section_text(
                            llama=llama,
                            llama_messages=llama_messages,
                            model=model,
                            max_tokens=joint_mt,
                        )
                        if text:
                            text = sanitize_ensemble_model_output(
                                text,
                                hero_id=hero_id,
                                roster_hero_ids=roster,
                            )
                            text = strip_joint_history_preamble(text)
                        return idx, hero_id, section_title, text, llama_messages

                    tasks = [asyncio.create_task(_one_parallel(i, hid)) for i, hid in enumerate(speakers)]
                    try:
                        while True:
                            pending = [t for t in tasks if not t.done()]
                            if not pending:
                                break
                            done, _ = await asyncio.wait(pending, timeout=1.5)
                            if not done:
                                yield ": keep-alive\n\n"
                                last_beat = asyncio.get_event_loop().time()
                        parallel_rows = [t.result() for t in tasks]
                    except asyncio.CancelledError:
                        for t in tasks:
                            if not t.done():
                                t.cancel()
                        await asyncio.gather(*tasks, return_exceptions=True)
                        for t in tasks:
                            if not t.done() or t.cancelled():
                                continue
                            try:
                                _idx, hid, title, body, _msgs = t.result()
                            except Exception:
                                continue
                            if body:
                                section_pairs.append((hid, title, body))
                        joint_text = _markdown_blocks(section_pairs)
                        if joint_text:
                            contribs = [hid for hid, _title, _body in section_pairs]
                            partial_quality_status = {
                                **_legacy_grounding_quality_status(rag_ctx),
                                "status": "needs_review",
                                "label": "Незавершённый документ",
                                "violations": ["stream_cancelled"],
                                "repair_attempted": False,
                                "fallback_used": True,
                            }
                            with suppress(Exception):
                                await persist_assistant_message_isolated(
                                    chat.id,
                                    joint_text,
                                    message_metadata={
                                        "desktop_hero_id": contribs[0],
                                        "desktop_ensemble_joint": True,
                                        "desktop_ensemble_contributors": contribs,
                                        "turn_kind": "initial",
                                        "context_summary": rag_ctx,
                                        "quality_status": partial_quality_status,
                                        **_expert_reply_metadata(turn_mode),
                                        **_council_transcript_meta(council_acc),
                                    },
                                )
                        raise

                    for idx, hero_id, section_title, combined, llama_messages in sorted(
                        parallel_rows, key=lambda r: r[0]
                    ):
                        if (
                            not combined
                            and not system_prompt_for_hero(hero_id)
                            and not short_reply_prompt_for_hero(hero_id)
                        ):
                            logger.warning("ensemble unknown hero_id=%s skip", hero_id)
                            continue
                        yield f"data: {json.dumps({'event': 'speaker_start', 'desktop_hero_id': hero_id, 'index': idx, 'delivery_mode': 'joint'}, ensure_ascii=False)}\n\n"
                        yield f"data: {json.dumps({'event': 'joint_section_start', 'desktop_hero_id': hero_id, 'index': idx, 'title': section_title}, ensure_ascii=False)}\n\n"
                        sep = "\n\n---\n\n" if idx > 0 else ""
                        hdr = f"## {section_title}\n\n"
                        if sep:
                            yield f"data: {json.dumps({'event': 'token', 'delta': sep}, ensure_ascii=False)}\n\n"
                            n_chunks += 1
                        yield f"data: {json.dumps({'event': 'token', 'delta': hdr}, ensure_ascii=False)}\n\n"
                        n_chunks += 1
                        if combined:
                            step = 480
                            for off in range(0, len(combined), step):
                                piece = combined[off : off + step]
                                yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
                                n_chunks += 1
                            section_pairs.append((hero_id, section_title, combined))
                            reply_turn = council_acc.append_speaker_reply(
                                hero_id=hero_id,
                                text=combined,
                                index=idx,
                                title=section_title,
                            )
                            if reply_turn.text:
                                yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
                            await ensemble_audit_log.log_stream_turn(
                                f"legacy_joint_section_{idx}_{hero_id}",
                                messages=llama_messages,
                                model=model,
                                max_tokens=joint_mt,
                                response_text=combined,
                                extra={"index": idx, "hero_id": hero_id, "parallel": True},
                            )
                    yield f"data: {json.dumps({'event': 'ensemble_joint_parallel_done'}, ensure_ascii=False)}\n\n"
                else:
                    speech_lines: list[str] = []
                    for idx, hero_id in enumerate(speakers):
                        peer_for_inject = section_pairs if idx > 0 and section_pairs else None
                        if speech_lines:
                            council_interludes += 1
                        system_prompt, inject_list, section_title = _joint_system_and_inject(
                            hero_id=hero_id,
                            idx=idx,
                            peer_pairs=peer_for_inject,
                        )
                        if not system_prompt:
                            logger.warning("ensemble unknown hero_id=%s skip", hero_id)
                            continue
                        yield f"data: {json.dumps({'event': 'speaker_start', 'desktop_hero_id': hero_id, 'index': idx, 'delivery_mode': 'joint'}, ensure_ascii=False)}\n\n"
                        speech_task = asyncio.create_task(
                            _generate_council_speech(
                                hero_id=hero_id,
                                idx=idx,
                                speech_lines=speech_lines,
                            )
                        )
                        try:
                            while not speech_task.done():
                                await asyncio.wait({speech_task}, timeout=1.5)
                                if not speech_task.done():
                                    yield ": keep-alive\n\n"
                            council_speech = speech_task.result()
                        except asyncio.CancelledError:
                            speech_task.cancel()
                            with suppress(asyncio.CancelledError):
                                await speech_task
                            raise
                        reply_turn = None
                        if council_speech:
                            speech_line = format_council_speech_line(
                                hero_id=hero_id,
                                speech=council_speech,
                            )
                            if speech_line:
                                speech_lines.append(speech_line)
                            reply_turn = council_acc.append_speaker_reply(
                                hero_id=hero_id,
                                text=council_speech,
                                index=idx,
                                title=None,
                            )
                            if reply_turn.text:
                                yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
                        llama_messages = ensemble_messages_for_llama(
                            system_prompt=system_prompt,
                            history=generation_history,
                            user_content=clean_enriched or user_text,
                            inject_messages=inject_list,
                            is_shared=is_shared,
                            owner_id=chat.user_id,
                            speaker_labels=speaker_labels,
                        )
                        llama_messages.append(
                            council_document_final_instruction(
                                hero_id=hero_id,
                                section_title=section_title,
                            )
                        )
                        yield f"data: {json.dumps({'event': 'joint_section_start', 'desktop_hero_id': hero_id, 'index': idx, 'title': section_title}, ensure_ascii=False)}\n\n"

                        sep = "\n\n---\n\n" if idx > 0 else ""
                        hdr = f"## {section_title}\n\n"
                        if sep:
                            yield f"data: {json.dumps({'event': 'token', 'delta': sep}, ensure_ascii=False)}\n\n"
                            n_chunks += 1
                        yield f"data: {json.dumps({'event': 'token', 'delta': hdr}, ensure_ascii=False)}\n\n"
                        n_chunks += 1

                        full_text: list[str] = []
                        registry_count = parse_registry_list_count(user_text)
                        combined = ""
                        registry_json_ok = False

                        if turn_mode == "registry":
                            try:
                                chat_result = await llama.chat(
                                    llama_messages,
                                    model=model,
                                    max_tokens=joint_mt,
                                    temperature=0.85,
                                    response_format=build_registry_response_format(registry_count),
                                )
                                raw_json = scrub_ensemble_channel_leak(str(chat_result.get("text") or ""))
                                document_md, registry_preview = build_registry_document_and_preview(
                                    raw_json,
                                    zone_title=section_title,
                                    item_count=registry_count,
                                )
                                if document_md:
                                    list_body = document_md
                                    if document_md.startswith("##"):
                                        parts = document_md.split("\n\n", 1)
                                        list_body = parts[1].strip() if len(parts) > 1 else document_md
                                    combined = list_body
                                    registry_json_ok = True
                                    step = 480
                                    for off in range(0, len(combined), step):
                                        piece = combined[off : off + step]
                                        yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
                                        n_chunks += 1
                                    section_pairs.append((hero_id, section_title, combined))
                                    if reply_turn is not None:
                                        reply_turn.document_text = document_md
                                    elif registry_preview:
                                        reply_turn = council_acc.append_speaker_reply(
                                            hero_id=hero_id,
                                            text=registry_preview,
                                            index=idx,
                                            title=None,
                                            document_text=document_md,
                                        )
                                        if reply_turn.text:
                                            yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
                                    await ensemble_audit_log.log_stream_turn(
                                        f"legacy_joint_registry_json_{idx}_{hero_id}",
                                        messages=llama_messages,
                                        model=model,
                                        max_tokens=joint_mt,
                                        response_text=raw_json,
                                        extra={
                                            "index": idx,
                                            "hero_id": hero_id,
                                            "registry_json": True,
                                            "separate_speech_lane": bool(council_speech),
                                        },
                                    )
                            except Exception as registry_ex:
                                logger.warning(
                                    "[STEP] ensemble_registry_json_fail hero=%s err=%s",
                                    hero_id,
                                    registry_ex,
                                )

                        if not registry_json_ok:
                            try:
                                async for piece in llama.chat_stream(
                                    llama_messages,
                                    model=model,
                                    max_tokens=joint_mt,
                                ):
                                    if piece.startswith("[error]"):
                                        yield f"data: {json.dumps({'event': 'error', 'message': piece})}\n\n"
                                        break
                                    full_text.append(piece)
                                    yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
                                    n_chunks += 1
                                    now2 = asyncio.get_event_loop().time()
                                    if n_chunks % 20 == 0 and now2 - last_beat > 1.8:
                                        yield ": keep-alive\n\n"
                                        last_beat = now2
                            except asyncio.CancelledError:
                                combined_partial = "".join(full_text).strip()
                                if combined_partial:
                                    combined_partial = sanitize_ensemble_model_output(
                                        combined_partial,
                                        hero_id=hero_id,
                                        roster_hero_ids=roster,
                                    )
                                if combined_partial:
                                    section_pairs.append((hero_id, section_title, combined_partial))
                                joint_text = _markdown_blocks(section_pairs)
                                if joint_text:
                                    contribs = [hid for hid, _title, _body in section_pairs]
                                    partial_quality_status = {
                                        **_legacy_grounding_quality_status(rag_ctx),
                                        "status": "needs_review",
                                        "label": "Незавершённый документ",
                                        "violations": ["stream_cancelled"],
                                        "repair_attempted": False,
                                        "fallback_used": True,
                                    }
                                    try:
                                        await persist_assistant_message_isolated(
                                            chat.id,
                                            joint_text,
                                            message_metadata={
                                                "desktop_hero_id": contribs[0],
                                                "desktop_ensemble_joint": True,
                                                "desktop_ensemble_contributors": contribs,
                                                "turn_kind": "initial",
                                                "context_summary": rag_ctx,
                                                "quality_status": partial_quality_status,
                                                **_expert_reply_metadata(turn_mode),
                                                **_council_transcript_meta(council_acc),
                                            },
                                        )
                                    except Exception as persist_ex:
                                        logger.warning("ensemble joint partial persist failed: %s", persist_ex)
                                raise

                            combined = "".join(full_text).strip()
                            if combined:
                                combined = sanitize_ensemble_model_output(
                                    combined,
                                    hero_id=hero_id,
                                    roster_hero_ids=roster,
                                )
                                combined = strip_joint_history_preamble(combined)
                            if combined:
                                section_pairs.append((hero_id, section_title, combined))
                                document_text = f"## {section_title}\n\n{combined}".strip()
                                if reply_turn is not None:
                                    reply_turn.document_text = document_text
                                else:
                                    reply_turn = council_acc.append_speaker_reply(
                                        hero_id=hero_id,
                                        text=(
                                            f"Вклад по теме «{section_title}» сформирован; "
                                            "подробности переданы в итоговый документ."
                                        ),
                                        index=idx,
                                        title=None,
                                        document_text=document_text,
                                    )
                                    if reply_turn.text:
                                        yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
                                await ensemble_audit_log.log_stream_turn(
                                    f"legacy_joint_section_{idx}_{hero_id}",
                                    messages=llama_messages,
                                    model=model,
                                    max_tokens=joint_mt,
                                    response_text=combined,
                                    extra={
                                        "index": idx,
                                        "hero_id": hero_id,
                                        "document_only": True,
                                        "separate_speech_lane": bool(council_speech),
                                    },
                                )

                if council_acc is not None and section_pairs:
                    closing_turn, closing_decision = apply_council_closing(
                        council_acc,
                        expected_speakers=list(speakers),
                    )
                    if closing_turn.text:
                        yield f"data: {json.dumps(council_acc.sse_council_turn_event(closing_turn), ensure_ascii=False)}\n\n"
                    logger.info(
                        "[STEP] ensemble_council_closing decision=%s speakers=%s",
                        closing_decision,
                        len(speakers),
                    )

                stitch_fallback = _markdown_blocks(section_pairs)
                from_transcript = (
                    assemble_markdown_from_council_transcript(council_acc) if council_acc is not None else ""
                )
                joint_final = from_transcript or stitch_fallback
                if from_transcript:
                    logger.info(
                        "[STEP] ensemble_council_document_from_transcript chars=%s fallback_chars=%s",
                        len(from_transcript),
                        len(stitch_fallback),
                    )
                dedupe_notes: list[str] = []
                if joint_final:
                    joint_final, dedupe_notes = dedupe_joint_markdown(joint_final)
                    joint_budget["duplicates_stripped"] = sum(
                        1 for n in dedupe_notes if str(n).startswith("dropped_duplicate_section:")
                    )
                    if dedupe_notes:
                        logger.info(
                            "[STEP] ensemble joint_pre_polish_dedupe notes=%s",
                            dedupe_notes,
                        )
                    await ensemble_audit_log.log_stitched_markdown(
                        "joint_stitched_before_polish",
                        joint_final,
                    )
                    polish_on = turn_mode != "registry" and defaults.get("ensemble_joint_polish_enabled") is not False
                    polish_task: asyncio.Task[str] | None = None
                    polish_stats: dict[str, Any] = {}
                    try:
                        if polish_on:
                            yield f"data: {json.dumps({'event': 'ensemble_joint_polish_start'}, ensure_ascii=False)}\n\n"
                            polish_task = asyncio.create_task(
                                polish_joint_concat(
                                    model=model,
                                    stitched=joint_final,
                                    user_excerpt=user_text,
                                    defaults=defaults,
                                    pre_polish_dedupe_notes=dedupe_notes,
                                    out_stats=polish_stats,
                                )
                            )
                            while not polish_task.done():
                                await asyncio.wait({polish_task}, timeout=1.5)
                                if polish_task.done():
                                    break
                                yield ": keep-alive\n\n"
                            joint_final = polish_task.result()
                            yield f"data: {json.dumps({'event': 'ensemble_joint_polish_done'}, ensure_ascii=False)}\n\n"
                        else:
                            joint_final = await polish_joint_concat(
                                model=model,
                                stitched=joint_final,
                                user_excerpt=user_text,
                                defaults=defaults,
                                pre_polish_dedupe_notes=dedupe_notes,
                                out_stats=polish_stats,
                            )
                    except asyncio.CancelledError:
                        if polish_task and not polish_task.done():
                            polish_task.cancel()
                            with suppress(asyncio.CancelledError):
                                await polish_task
                        raise
                    joint_budget["polish_reverted"] = bool(polish_stats.get("polish_reverted"))
                    joint_budget["compression_skipped"] = bool(polish_stats.get("compression_skipped"))
                    source_registry_raw = rag_ctx.get("context_sources")
                    source_registry = (
                        [row for row in source_registry_raw if isinstance(row, dict)]
                        if isinstance(source_registry_raw, list)
                        else []
                    )
                    finalizer_task = asyncio.create_task(
                        finalize_artifact(
                            draft=joint_final,
                            user_request=user_text,
                            artifact_type="team_response",
                            required_sections=required_sections_from_council_transcript(
                                council_acc,
                                fallback_titles=[title for _hid, title, _body in section_pairs],
                            )
                            if council_acc is not None
                            else [title for _hid, title, _body in section_pairs],
                            quality_rubric=[
                                "Собери один согласованный ответ без повторяющихся смысловых блоков.",
                                "Сохрани тематические заголовки task blocks и не заменяй их именами героев.",
                                "Не показывай внутренние RAG/storage-маркеры и неизвестные citations.",
                                "Опирайся на протокол совещания (реплики участников), не выдумывай новые зоны.",
                            ],
                            source_registry=source_registry,
                            model=model,
                            defaults=defaults,
                        )
                    )
                    try:
                        while not finalizer_task.done():
                            await asyncio.wait({finalizer_task}, timeout=1.5)
                            if finalizer_task.done():
                                break
                            yield ": keep-alive\n\n"
                        finalization_result = finalizer_task.result()
                    except asyncio.CancelledError:
                        finalizer_task.cancel()
                        with suppress(asyncio.CancelledError):
                            await finalizer_task
                        raise
                    joint_final = scrub_ensemble_channel_leak(finalization_result.markdown)
                    final_quality_status = apply_finalization_status(
                        _legacy_grounding_quality_status(rag_ctx),
                        finalization_result,
                    )
                    await ensemble_audit_log.log_stitched_markdown(
                        "joint_stitched_after_finalizer",
                        joint_final,
                    )
                    logger.info(
                        "[STEP] desktop_ai_chat artifact_route route=legacy_joint status=%s "
                        "violations=%s repair=%s fallback=%s",
                        finalization_result.status,
                        list(finalization_result.violations),
                        finalization_result.repair_attempted,
                        finalization_result.fallback_used,
                    )
                    contribs = [hid for hid, _title, _body in section_pairs]
                    persisted = await persist_assistant_message_isolated(
                        chat.id,
                        joint_final,
                        message_metadata={
                            "desktop_hero_id": contribs[0],
                            "desktop_ensemble_joint": True,
                            "desktop_ensemble_contributors": contribs,
                            "turn_kind": "initial",
                            "context_summary": rag_ctx,
                            "quality_status": final_quality_status,
                            **_expert_reply_metadata(turn_mode),
                            **_council_transcript_meta(council_acc),
                        },
                    )
                    if persisted is not None:
                        working_history = working_history + [persisted]
                        memory_assistant_message_id = persisted.id
                    joint_replacement_payload: dict[str, Any] = {
                        "event": "assistant_document_replace",
                        "content": joint_final,
                        "quality_status": final_quality_status,
                        "artifact_type": "team_response",
                        "context_sources": (
                            rag_ctx.get("context_sources") if isinstance(rag_ctx.get("context_sources"), list) else []
                        ),
                    }
                    ct_meta = _council_transcript_meta(council_acc)
                    if ct_meta:
                        joint_replacement_payload["council_transcript"] = ct_meta["council_transcript"]
                    if persisted is not None:
                        joint_replacement_payload["message_id"] = str(persisted.id)
                    yield f"data: {json.dumps(joint_replacement_payload, ensure_ascii=False)}\n\n"
                    memory_turn_assistant = joint_final
                    if joint_budget is not None:
                        duration_ms_joint = int((time.monotonic() - stream_t0) * 1000)
                        logger.info(
                            "[METRIC] ensemble_joint_budget speakers=%s duration_ms=%s "
                            "polish_reverted=%s duplicates_stripped=%s parallel=%s compression_skipped=%s",
                            len(speakers),
                            duration_ms_joint,
                            int(bool(joint_budget.get("polish_reverted"))),
                            int(joint_budget.get("duplicates_stripped") or 0),
                            int(bool(joint_budget.get("parallel"))),
                            int(bool(joint_budget.get("compression_skipped"))),
                        )
                        logger.info(
                            "[METRIC] ensemble_council_budget speakers=%s interludes=%s "
                            "duration_ms=%s parallel=%s mode=%s",
                            len(speakers),
                            council_interludes,
                            duration_ms_joint,
                            int(bool(joint_budget.get("parallel"))),
                            council_mode,
                        )
            else:
                for idx, hero_id in enumerate(speakers):
                    hero_prompt = (
                        short_reply_prompt_for_hero(hero_id) if use_short_prompt else system_prompt_for_hero(hero_id)
                    )
                    if not hero_prompt:
                        logger.warning("ensemble unknown hero_id=%s skip", hero_id)
                        continue
                    tb = block_by_hero.get(hero_id)
                    focus_line = (turn_plan.focus_by_id.get(hero_id) or "").strip()
                    others = [h for h in speakers if h != hero_id]
                    others_lbl = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in others)
                    coord_block = ""
                    if focus_line and others_lbl:
                        coord_block = (
                            f"\n\n[План координации] Твой фокус в этом ходу: {focus_line}. "
                            f"Не повторяй подробно те блоки, которые логичнее оставить другим спикерам этого хода "
                            f"({others_lbl}); дополняй, уточняй или спорь по существу, без второго полного дубля структуры ответа."
                        )
                    elif focus_line:
                        coord_block = f"\n\n[План координации] Твой фокус в этом ходу: {focus_line}."
                    elif turn_plan.reason:
                        coord_block = f"\n\n[План координации] Кратко для всех спикеров этого хода: {turn_plan.reason}"
                    coord_block += _hero_block_coord(tb)
                    mid_brief = council_speaker_brief_block(
                        index=idx,
                        speakers=speakers,
                        mode=council_mode,
                        hero_id=hero_id,
                    )
                    coord_block += mid_brief
                    system_prompt = (
                        f"{base_system}\n\n---\n\n{hero_prompt}{coord_block}{_SPEAKER_ENSEMBLE_APPEND}"
                        f"{_reply_contract_block(turn_mode, is_joint=False, user_text=user_text)}"
                    ).strip()

                    if is_shared and SHARED_CHAT_SPEAKER_NUDGE not in system_prompt:
                        system_prompt = f"{system_prompt}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
                    llama_messages = ensemble_messages_for_llama(
                        system_prompt=system_prompt,
                        history=working_history,
                        user_content=enriched,
                        is_shared=is_shared,
                        owner_id=chat.user_id,
                        speaker_labels=speaker_labels,
                    )
                    if idx > 0:
                        council_interludes += 1
                    yield f"data: {json.dumps({'event': 'speaker_start', 'desktop_hero_id': hero_id, 'index': idx}, ensure_ascii=False)}\n\n"

                    full_text_sep: list[str] = []
                    sep_mt = _reply_max_tokens(
                        defaults,
                        turn_mode=turn_mode,
                        is_joint=False,
                    )
                    try:
                        async for piece in llama.chat_stream(
                            llama_messages,
                            model=model,
                            max_tokens=sep_mt,
                        ):
                            if piece.startswith("[error]"):
                                yield f"data: {json.dumps({'event': 'error', 'message': piece})}\n\n"
                                break
                            full_text_sep.append(piece)
                            yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
                            n_chunks += 1
                            now2 = asyncio.get_event_loop().time()
                            if n_chunks % 20 == 0 and now2 - last_beat > 1.8:
                                yield ": keep-alive\n\n"
                                last_beat = now2
                    except asyncio.CancelledError:
                        combined_partial = "".join(full_text_sep).strip()
                        if combined_partial:
                            combined_partial = sanitize_ensemble_model_output(
                                combined_partial,
                                hero_id=hero_id,
                                roster_hero_ids=roster,
                            )
                        if combined_partial:
                            try:
                                await persist_assistant_message_isolated(
                                    chat.id,
                                    combined_partial,
                                    message_metadata={
                                        "desktop_hero_id": hero_id,
                                        "turn_kind": "initial",
                                        "context_summary": rag_ctx,
                                        **_expert_reply_metadata(turn_mode),
                                    },
                                )
                            except Exception as persist_ex:
                                logger.warning("ensemble partial persist failed: %s", persist_ex)
                        raise

                    combined = "".join(full_text_sep).strip()
                    if combined:
                        combined = sanitize_ensemble_model_output(
                            combined,
                            hero_id=hero_id,
                            roster_hero_ids=roster,
                        )
                    if combined:
                        reply_turn = council_acc.append_speaker_reply(
                            hero_id=hero_id,
                            text=combined,
                            index=idx,
                            title=(tb.title if tb else None),
                        )
                        if reply_turn.text:
                            yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
                        await ensemble_audit_log.log_stream_turn(
                            f"legacy_separate_section_{idx}_{hero_id}",
                            messages=llama_messages,
                            model=model,
                            max_tokens=sep_mt,
                            response_text=combined,
                            extra={"index": idx, "hero_id": hero_id},
                        )
                        persisted = await persist_assistant_message_isolated(
                            chat.id,
                            combined,
                            message_metadata={
                                "desktop_hero_id": hero_id,
                                "turn_kind": "initial",
                                "context_summary": rag_ctx,
                                **_expert_reply_metadata(turn_mode),
                                **_council_transcript_meta(council_acc),
                            },
                        )
                        if persisted is not None:
                            working_history = working_history + [persisted]
                            memory_assistant_message_id = persisted.id
                        if memory_turn_assistant:
                            memory_turn_assistant = f"{memory_turn_assistant}\n\n---\n\n{combined}"
                        else:
                            memory_turn_assistant = combined

                if council_acc is not None and len(speakers) >= 2:
                    closing_turn, closing_decision = apply_council_closing(
                        council_acc,
                        expected_speakers=list(speakers),
                    )
                    if closing_turn.text:
                        yield f"data: {json.dumps(council_acc.sse_council_turn_event(closing_turn), ensure_ascii=False)}\n\n"
                    logger.info(
                        "[STEP] ensemble_council_closing decision=%s mode=discussion speakers=%s",
                        closing_decision,
                        len(speakers),
                    )
                    assembled = assemble_markdown_from_council_transcript(council_acc)
                    if assembled.strip():
                        contribs = [t.hero_id for t in council_acc.turns if t.kind == "speaker_reply" and t.hero_id]
                        contribs = list(dict.fromkeys(contribs))
                        separate_meta: dict[str, Any] = {
                            "desktop_hero_id": contribs[0] if contribs else speakers[0],
                            "desktop_ensemble_joint": True,
                            "desktop_ensemble_contributors": contribs or list(speakers),
                            "turn_kind": "initial",
                            "context_summary": rag_ctx,
                            **_expert_reply_metadata(turn_mode),
                            **_council_transcript_meta(council_acc),
                        }
                        if memory_assistant_message_id is not None:
                            separate_meta["replaces_message_id"] = str(memory_assistant_message_id)
                        persisted_doc = await persist_assistant_message_isolated(
                            chat.id,
                            assembled,
                            message_metadata=separate_meta,
                        )
                        if persisted_doc is not None:
                            memory_assistant_message_id = persisted_doc.id
                        separate_replacement_payload: dict[str, Any] = {
                            "event": "assistant_document_replace",
                            "content": assembled,
                            "artifact_type": "team_response",
                            "context_sources": (
                                rag_ctx.get("context_sources")
                                if isinstance(rag_ctx.get("context_sources"), list)
                                else []
                            ),
                        }
                        ct_meta = _council_transcript_meta(council_acc)
                        if ct_meta:
                            separate_replacement_payload["council_transcript"] = ct_meta["council_transcript"]
                        if persisted_doc is not None:
                            separate_replacement_payload["message_id"] = str(persisted_doc.id)
                        yield f"data: {json.dumps(separate_replacement_payload, ensure_ascii=False)}\n\n"
                        memory_turn_assistant = assembled

    except Exception as e:
        logger.exception("ensemble stream failed: %s", e)
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
        return

    if memory_turn_assistant.strip():
        await record_desktop_chat_turn_memory(
            chat_id=chat.id,
            user_text=user_text,
            assistant_text=memory_turn_assistant.strip(),
            assistant_message_id=memory_assistant_message_id,
        )

    duration_ms = int((time.monotonic() - stream_t0) * 1000)
    logger.info(
        "[STEP] desktop_ai_chat ensemble stream_done chat_id=%s user_id=%s duration_ms=%s speakers=%s",
        chat.id,
        user_id,
        duration_ms,
        len(speakers),
    )
    if len(speakers) >= 2 and joint_budget is None:
        logger.info(
            "[METRIC] ensemble_council_budget speakers=%s interludes=%s duration_ms=%s parallel=0 mode=%s",
            len(speakers),
            council_interludes,
            duration_ms,
            council_mode if speakers else "joint_document",
        )
    done_payload: dict[str, Any] = {
        "event": "done",
        "context": rag_ctx,
        "duration_ms": duration_ms,
        "ensemble": True,
    }
    if final_quality_status is not None:
        done_payload["quality_status"] = final_quality_status
    ct_done = _council_transcript_meta(council_acc)
    if ct_done:
        done_payload["council_transcript"] = ct_done["council_transcript"]
    yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
