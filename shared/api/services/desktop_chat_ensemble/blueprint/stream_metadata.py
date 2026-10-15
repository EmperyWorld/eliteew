# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Blueprint stream helpers: step token budgets, outline/steps preview, quality status,
# step user blocks, plan SSE payload, and per-step scope fences (shared by phase modules).
# Invariants:
# - Quality grounding labels stay honest (hypothesis vs grounded vs derived).
# - Cross-module helpers stay listed in ``__all__`` (basedpyright ignores external uses of _*).
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
# ---
"""Metadata and prompt helpers for blueprint ensemble SSE."""

from __future__ import annotations

from typing import Any

from api.services.desktop_chat.generation_budgets_settings import (
    BLUEPRINT_STEP_DEFAULT,
    REPLY_OVERRIDE_CAP,
)
from api.services.desktop_chat_ensemble.blueprint.assign import StepAssignment
from api.services.desktop_chat_ensemble.blueprint.catalog import PlanTemplate
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

# Package-shared helpers (imported by stream_planning / stream_step_loop / stream_finalize /
# stream_turn facade). Listed in __all__ so basedpyright reportUnusedFunction treats
# _-prefixed names as exported even when not referenced inside this file.
__all__ = (
    "_SPEAKER_BLUEPRINT_APPEND",
    "_STEP_SCOPE_FENCE",
    "_blueprint_quality_status",
    "_inject_completed_steps",
    "_outline_metadata",
    "_plan_sse_payload",
    "_quality_guard_instruction",
    "_step_max_tokens",
    "_step_user_block",
    "_steps_preview_metadata",
)

_SPEAKER_BLUEPRINT_APPEND = (
    "\n\n[Режим структурированного плана] Заголовки уровня `##` задаёт только сборщик — не дублируй. Пиши тело секции: `###`, списки, жирный текст. "
    "Если в инструкции шага явно требуется mermaid — вставь ровно один корректный fenced-блок ```mermaid … ``` с валидным синтаксисом (обычно flowchart LR или TB). "
    "Если в инструкции сказано без диаграмм — не добавляй mermaid. "
    "Не выходи за границу текущего шага (см. блок «Граница шага» выше). "
    "Не добавляй `Резюме`, `Введение`, `Заключение`, `Примечание` ко всему документу, итоги всех шагов, извинения и метакомментарии про структуру ответа. "
    "Не повторяй строки вида `Реплика участника ...`, не ссылайся на внутренние labels/фрагменты/файлы (`pl1.txt`, `[label=...]`) и не говори, что у тебя нет доступа к данным — вместо этого явно отделяй допущения от фактов. "
    "Никогда не вставляй в тело документа редакторские маркеры из инструкций: `Формат вывода`, `Запрещено`, `Контекст запроса`, `ИСХОДНИК`, `С уважением`. "
    "Не начинай шаг блоками `Запрос пользователя`, `План дальнейших действий`, `Введение данных для дополнительного анализа` и не пиши, что текст был упрощен, сокращен или очищен."
)

# Жёсткое разделение тем между шагами (смысл «один шаг — одна глава»).
_STEP_SCOPE_FENCE: dict[str, str] = {
    "s1": (
        "Граница шага s1 — соблюдай строго: только цели, границы (что в/out scope), сроки/горизонт, критерии успеха. "
        "Запрещено в этом ответе: архитектура и компоненты, потоки данных, Docker/сервисы детально, mermaid, отдельный раздел рисков, роли команды длинным списком, "
        "повтор заголовков будущих секций документа («Целевая архитектура», «Риски»)."
    ),
    "s2": (
        "Граница шага s2: связный текст про архитектуру/модули/потоки + ровно один mermaid по инструкции. "
        "Запрещено: снова расписывать «цели и границы» целиком, отдельный блок «риски и проверки», заключение на весь проект, примечания редактору."
    ),
    "s3": (
        "Граница шага s3: только риски и проверки/мирации. Запрещено: повторять цели и архитектуру, вставлять mermaid, пересказывать диаграмму словами."
    ),
    "m1": (
        "Граница m1: только краткая формулировка того, что известно о запросе, и гипотеза ценности. "
        "Можно коротко отделить факты от гипотез. "
        "Запрещено: action plan, roadmap, SWOT, 4P, сегментация/JTBD подробно, позиционирование, mermaid и блок `Запрос пользователя`. "
        "Запрещено: «учебник» с перечислением SEO/SMM/контент-маркетинга/соцсетей/операционки как стандартных пяти пунктов, если этого не было во входных данных."
    ),
    "m2": (
        "Граница m2: сегмент и JTBD + один mermaid. "
        "Не дублируй гипотезу ценности целиком из m1; без блока позиционирования, без юридических тезисов, без action plan и без `Плана дальнейших действий`."
    ),
    "m3": (
        "Граница m3: позиционирование и риски формулировок. "
        "Без нового mermaid; без повторного полного JTBD и ценности; без action plan, roadmap, product backlog и блока `Следующие шаги`, если пользователь этого не просил."
    ),
    "bp1": (
        "Граница bp1: только краткое резюме проекта, допущения и что известно/неизвестно. "
        "Запрещено: детальный go-to-market, 30/60/90, экономика, география/регионы/рынки/партнёры, если их нет в фактах, длинный список рисков, повтор будущих разделов, общий title документа и заключение."
    ),
    "bp2": (
        "Граница bp2: рынок, сегменты, JTBD и ценность предложения. "
        "Запрещено: повторять резюме bp1 целиком, уходить в финансовую модель, операционный план, 30/60/90, SEO/SMM/инфлюенсеров/PR без фактов и подробные риски."
    ),
    "bp3": (
        "Граница bp3: go-to-market, продажи, пилот и операционный запуск. "
        "Если пользователь просит 30/60/90, структурируй именно в три блока `30 дней`, `60 дней`, `90 дней`. "
        "Запрещено: подробно пересказывать рынок и ценность из bp2, писать финмодель и длинный риск-реестр, добавлять общий title документа, заключение, APAC/PR/инфлюенсеров/SEO без фактов."
    ),
    "bp4": (
        "Граница bp4: монетизация, экономические гипотезы, риски и следующие шаги. "
        "Запрещено: заново расписывать рынок, продуктовую постановку и операционный план из прошлых шагов, делать `Заключение`, `Введение данных для дополнительного анализа` и придумывать точные финансовые числа."
    ),
}


def _step_max_tokens(defaults: dict[str, Any]) -> int:
    """Tokens per blueprint template step — long enough for a full professional section."""
    raw = defaults.get("ensemble_blueprint_step_max_tokens")
    try:
        v = int(raw) if raw is not None and raw != "" else 0
    except (TypeError, ValueError):  # fmt: skip
        v = 0
    if v > 0:
        return max(512, min(v, REPLY_OVERRIDE_CAP))
    raw2 = defaults.get("ensemble_joint_section_max_tokens")
    try:
        v2 = int(raw2) if raw2 is not None and raw2 != "" else 0
    except (TypeError, ValueError):  # fmt: skip
        v2 = 0
    if v2 <= 0:
        return BLUEPRINT_STEP_DEFAULT
    return max(512, min(v2, REPLY_OVERRIDE_CAP))


def _outline_metadata(template: PlanTemplate) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for sec in template.document_outline:
        out.append(
            {
                "id": sec.id or sec.heading,
                "heading": sec.heading,
                "step_ids": list(sec.step_ids),
                "subsections": [{"heading": sub.heading, "step_id": sub.step_id} for sub in sec.subsections],
            }
        )
    return out


def _steps_preview_metadata(assignments: list[StepAssignment]) -> list[dict[str, Any]]:
    return [
        {
            "step_id": a.step.step_id,
            "title": a.step.title,
            "hero_id": a.hero_id,
            "fallback": a.fallback,
            "slot_distance": a.slot_distance,
        }
        for a in assignments
    ]


def _blueprint_quality_status(
    template: PlanTemplate,
    rag_ctx: dict[str, Any],
    *,
    user_text: str,
) -> dict[str, Any]:
    chat_chunks = int(rag_ctx.get("chat_rag_chunks") or 0)
    vault_chunks = int(rag_ctx.get("project_vault_chunks") or 0)
    total_chunks = chat_chunks + vault_chunks
    web_sources = rag_ctx.get("web_search_sources")
    web_source_count = len(web_sources) if isinstance(web_sources, list) else 0
    web_used = bool(rag_ctx.get("web_search_used")) or web_source_count > 0
    context_sources = rag_ctx.get("context_sources")
    source_rows = context_sources if isinstance(context_sources, list) else []
    source_kind_counts: dict[str, int] = {}
    for row in source_rows:
        if not isinstance(row, dict):
            continue
        kind = str(row.get("kind") or "").strip()
        if kind:
            source_kind_counts[kind] = source_kind_counts.get(kind, 0) + 1
    primary_evidence_count = sum(
        source_kind_counts.get(kind, 0) for kind in ("chat_attachment", "project_document", "web")
    )
    derived_evidence_count = source_kind_counts.get("derived_ai_artifact", 0)
    required_context = list(template.required_context or [])
    business_like = (template.artifact_type or "").strip() in {
        "marketing_brief",
        "campaign_plan",
        "project_audit",
        "sales_onepager",
        "research_plan",
        "business_plan",
        "strategy_options",
    }
    short_input = len((user_text or "").strip()) < 900
    if primary_evidence_count > 0 or web_used:
        grounding_status = "grounded"
        if web_used and total_chunks == 0:
            grounding_label = "Основано на веб-поиске"
        elif web_used:
            grounding_label = "Основано на материалах и веб-поиске"
        else:
            grounding_label = "Основано на материалах"
    elif derived_evidence_count > 0:
        grounding_status = "derived_context"
        grounding_label = "Опора на ранее созданный AI-документ"
    elif business_like and (required_context or short_input):
        grounding_status = "hypothesis_only"
        grounding_label = "Гипотеза без независимых оснований"
    else:
        grounding_status = "light_context"
        grounding_label = "Ограниченный контекст"
    return {
        "status": "draft",
        "label": "Формируется",
        "grounding_status": grounding_status,
        "grounding_label": grounding_label,
        "chat_chunks": chat_chunks,
        "project_vault_chunks": vault_chunks,
        "web_search_sources": web_source_count,
        "web_search_used": web_used,
        "source_kind_counts": source_kind_counts,
        "required_context": required_context,
        "artifact_type": template.artifact_type,
    }


def _quality_guard_instruction(quality_status: dict[str, Any]) -> str:
    status = str(quality_status.get("grounding_status") or quality_status.get("status") or "")
    required = quality_status.get("required_context")
    required_context = ", ".join(str(x) for x in required if str(x).strip()) if isinstance(required, list) else ""
    web_used = bool(quality_status.get("web_search_used"))
    web_count = int(quality_status.get("web_search_sources") or 0)
    web_note = ""
    if web_used:
        web_note = (
            " В запросе пользователя есть блок «Срез из веб-поиска» — это уже выполненный desktop_web_search "
            f"({web_count} источн. с URL); используй эти факты, не пиши что поиск не выполнялся и не проси прислать ссылки."
        )
    if status == "hypothesis_only":
        suffix = f" Требуемый контекст: {required_context}." if required_context else ""
        return (
            "[Контекст качества] Для этого бизнес/маркетингового артефакта нет извлечённых RAG-фактов "
            "из вложений или проектного vault. Не выдавай текст как финальный документ, основанный на данных. "
            "Оформи результат как preliminary brief: явно разделяй `Факты`, `Гипотезы`, `Нужно добрать` и "
            "`Что можно осторожно рекомендовать сейчас`. Не придумывай рынок, цифры, каналы, бюджеты и proof."
            f"{suffix}{web_note}"
        )
    if status == "grounded":
        return (
            "[Контекст качества] Используй найденный контекст как источник фактов. Если делаешь вывод сверх источников, "
            "помечай его как гипотезу и называй, какая проверка нужна."
            f"{web_note}"
        )
    if status == "derived_context":
        return (
            "[Контекст качества] Найден только ранее созданный AI-артефакт. Используй его для continuity, "
            "но не называй независимым исследованием или доказанным фактом; явно отмечай гипотезы и нужные проверки."
        )
    return (
        "[Контекст качества] Входных данных немного: держи выводы короткими, отделяй факты от предположений "
        "и не добавляй незаказанные цифры, каналы и источники."
        f"{web_note}"
    )


def _inject_completed_steps(done: list[tuple[str, str, str]]) -> list[dict[str, Any]]:
    if not done:
        return []
    lines: list[str] = []
    for step_id, hero_id, body in done:
        nm = HERO_SHORT_LABEL.get(hero_id, hero_id)
        b = (body or "").strip()
        snippet = b.replace("\n", " ")
        if len(snippet) > 800:
            snippet = snippet[:800] + "…"
        lines.append(f"- Шаг `{step_id}` ({nm}): {snippet}")
    text = (
        "[Итоги предыдущих шагов — опорный контекст для связности документа; следующий шаг — новая тема.] "
        "Уже написано выше — не повторяй JTBD, цели, сегменты и ключевые тезисы дословно. "
        "Не копируй заголовки и списки из прошлых шагов; не пересказывай их целиком; добавь только свою ось.\n"
        + "\n".join(lines)
    )
    return [{"role": "user", "content": text}]


def _step_user_block(template: PlanTemplate, step_assign: StepAssignment) -> str:
    allow_diag = "разрешены mermaid/диаграммы" if template.allow_mermaid else "не используй mermaid и блок-диаграммы"
    sid = step_assign.step.step_id
    fence = (step_assign.step.scope_fence or "").strip() or _STEP_SCOPE_FENCE.get(sid, "")
    min_roster = int(getattr(step_assign.step, "min_roster", 1) or 1)
    parts = [
        f"[Шаг плана `{sid}`]",
        f"Тема шага: {step_assign.step.title}",
        "",
        fence,
        "",
    ]
    if min_roster >= 4:
        parts.extend(
            [
                "Расширение ростера: пиши только приращение своей оси поверх ядра документа. "
                "Запрещено заново пересказывать JTBD / goal / audience / positioning из ранних шагов.",
                "",
            ]
        )
    if (template.artifact_type or "").strip().casefold() in {
        "business_plan",
        "campaign_plan",
        "marketing_brief",
        "sales_onepager",
        "strategy_options",
    }:
        parts.extend(
            [
                "Имена брендов: не выдумывай бренд/торговую марку, если её нет во входе пользователя или RAG. "
                "Используй `[Brand TBD]`.",
                "",
            ]
        )
    parts.extend(
        [
            "Инструкция:",
            step_assign.step.instruction_for_model,
            "",
            f"Оформление: {allow_diag}.",
        ]
    )
    return "\n".join(p for p in parts if p)


def _plan_sse_payload(
    template: PlanTemplate,
    assignments: list[StepAssignment],
    *,
    roster: list[str],
    quality_status: dict[str, Any],
    deferred_templates: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    speakers: list[str] = []
    seen: set[str] = set()
    for a in assignments:
        if a.hero_id not in seen:
            seen.add(a.hero_id)
            speakers.append(a.hero_id)
    steps_preview = _steps_preview_metadata(assignments)
    task_blocks = [
        {
            "id": a.step.step_id,
            "hero_id": a.hero_id,
            "title": a.step.title,
            "objective": a.step.instruction_for_model[:500],
            "phase": "blueprint",
        }
        for a in assignments
    ]
    payload: dict[str, Any] = {
        "event": "ensemble_plan",
        "blueprint": True,
        "plan_template_id": template.id,
        "plan_template_title": template.title,
        "artifact_type": template.artifact_type,
        "quality_status": quality_status,
        "document_outline": _outline_metadata(template),
        "delivery_mode": "joint",
        "speakers": speakers,
        "reason": (template.description or "").strip()[:500],
        "task_blocks": task_blocks,
        "steps_preview": steps_preview,
        "focus": [{"id": h, "brief": ""} for h in speakers],
        "huddle_lines": [],
        "roster_size": len(roster),
        "max_speakers_this_turn": len(speakers),
    }
    if deferred_templates:
        payload["deferred_plan_templates"] = deferred_templates
        payload["huddle_lines"] = [
            "В запросе ещё другие артефакты — запустите их отдельным сообщением (не смешиваем в один документ)."
        ]
    return payload
