# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for Курсорина missions (worker ledger + user-facing view).
# Invariants:
# - Worker statuses: queued|running|completed|blocked|cancelled.
# - MissionPublicView never exposes tool steps to the product UI.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field

MissionStatus = Literal["queued", "running", "completed", "blocked", "cancelled"]
ToolName = Literal[
    "search_library",
    "list_folder",
    "read_content",
    "note",
    "search_docs",
    "search_code",
    "read_path",
    "web_search",
    "fetch_url",
    "run_python",
    "save_to_library",
    "knowledge_base_search",
    "search_projects",
    "generate_diagram",
    "extract_table_data",
    "export_file",
    "calculate_financial_metrics",
    "swot_matrix_analysis",
    "search_companies",
    "export_executive_html",
    "extract_key_entities",
    "risk_matrix_assessment",
    "competitor_benchmark_matrix",
    "generate_timeline_roadmap",
    "verify_compliance_standards",
    "aggregate_market_statistics",
    "finish",
    "block",
]
_ACTIVE = frozenset({"queued", "running"})
_TERMINAL = frozenset({"completed", "blocked", "cancelled"})


class EvidenceItem(BaseModel):
    id: str
    kind: str
    ref: str = ""
    extract: str = ""


class StepItem(BaseModel):
    index: int
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    observation: str = ""
    ok: bool = True


class MissionSnapshot(BaseModel):
    """Internal / worker snapshot (includes steps)."""

    id: str
    principal_id: str
    goal: str
    status: MissionStatus
    steps: list[StepItem] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    answer: str | None = None
    block_reason: str | None = None
    step_budget: int = 16
    cancel_requested: bool = False
    celery_task_id: str | None = None
    created_at: str
    updated_at: str


class MissionResultItem(BaseModel):
    """User-visible finding (not a tool observation)."""

    kind: str
    title: str = ""
    ref: str = ""
    snippet: str = ""


class MissionPublicView(BaseModel):
    """Product API shape — progress + results, no tool kitchen."""

    id: str
    goal: str
    status: MissionStatus
    progress: str = ""
    results: list[MissionResultItem] = Field(default_factory=list)
    answer: str | None = None
    block_reason: str | None = None
    created_at: str
    updated_at: str


class MissionCreateBody(BaseModel):
    goal: str = Field(..., min_length=3, max_length=8000)


class MissionTickBody(BaseModel):
    """Legacy/debug sync tick — not used by product UI."""

    max_steps: int = Field(default=5, ge=1, le=10)


class DecideAction(BaseModel):
    tool: ToolName
    args: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""


def is_active_status(status: str) -> bool:
    return status in _ACTIVE


def is_terminal_status(status: str) -> bool:
    return status in _TERMINAL


def _clean_title(raw: str) -> str:
    s = (raw or "").strip()
    s = re.sub(r"^#+\s*", "", s)
    s = re.sub(r"^[*_`]+\s*", "", s)
    s = re.sub(r"[*_`]+$", "", s)
    return s.strip()


def progress_message(mission: MissionSnapshot) -> str:
    if mission.status == "queued":
        return "В очереди — скоро начну работу"
    if mission.status == "completed":
        return "Готово"
    if mission.status == "blocked":
        return "Остановка — не удалось закрыть цель"
    if mission.status == "cancelled":
        return "Отменено"
    if mission.status == "running":
        n = len(mission.evidence)
        if not mission.steps:
            return "Ищу материалы…" if n <= 0 else f"Собираю результаты… найдено источников: {n}"
        last = mission.steps[-1]
        tool = last.tool
        if tool == "verify_compliance_standards":
            action = "Аудит стандартов (152-ФЗ, ГОСТ, ФСТЭК)"
        elif tool == "risk_matrix_assessment":
            action = "Оценка матрицы рисков и мер безопасности"
        elif tool == "extract_table_data":
            action = "Формирование аналитической таблицы"
        elif tool == "generate_diagram":
            action = "Построение архитектурной схемы"
        elif tool == "generate_timeline_roadmap":
            action = "Формирование дорожной карты"
        elif tool == "calculate_financial_metrics":
            action = "Расчет экономических показателей"
        elif tool == "swot_matrix_analysis":
            action = "Проведение SWOT-анализа"
        elif tool == "search_companies":
            q = str(last.args.get("query") or "").strip()
            action = f"Анализ профиля компании: {q[:35]}" if q else "Анализ профиля компании"
        elif tool == "read_content":
            action = "Изучен документ из библиотеки"
        elif tool == "search_library":
            action = "Поиск в корпоративной библиотеке"
        elif tool == "fetch_url":
            u = str(last.args.get("url") or "")
            host = re.sub(r"^https?://(?:www\.)?", "", u).split("/")[0] if u else ""
            action = f"Изучение материалов: {host[:35]}" if host else "Изучение веб-источника"
        elif tool == "web_search":
            q = str(last.args.get("query") or "").strip()
            action = f"Поиск в сети: {q[:35]}…" if len(q) > 35 else (f"Поиск в сети: {q}" if q else "Поиск в сети")
        elif tool == "run_python":
            action = "Аналитическая обработка данных"
        elif tool in {"search_docs", "read_path"}:
            action = "Анализ архитектурной документации"
        elif tool == "knowledge_base_search":
            action = "Поиск по базе знаний"
        elif tool == "save_to_library":
            action = "Сохранение отчета в библиотеку"
        else:
            action = "Сбор материалов и фактов"

        return f"Собираю результаты · {action} (источников: {n})" if n > 0 else f"Собираю результаты · {action}…"
    return ""


def results_from_evidence(mission: MissionSnapshot) -> list[MissionResultItem]:
    out: list[MissionResultItem] = []
    # Identify read library refs to supersede unread search hit stubs
    read_library_refs = {e.ref for e in mission.evidence if e.kind == "library" and e.ref}

    for e in mission.evidence:
        if e.kind in {"doc_hit", "code_hit", "dir"}:
            continue
        # Deduplicate unread library_hit if the content has been read
        if e.kind == "library_hit" and e.ref in read_library_refs:
            continue

        raw_extract = (e.extract or "").strip()
        first_line = raw_extract.split("\n", 1)[0].strip() if raw_extract else ""
        first = _clean_title(first_line)

        snippet = raw_extract.replace("\n", " ")[:280]

        if e.kind in {"library", "library_hit", "folder", "note"}:
            title = first or e.ref or e.kind
        elif e.kind == "web":
            if raw_extract.startswith("%PDF"):
                file_name = e.ref.split("/")[-1].split("?")[0] if e.ref else "document.pdf"
                title = f"Документ PDF: {file_name[:80]}"
                snippet = "PDF-документ загружен и проанализирован в ходе исследования."
            else:
                title = first[:160] if first else e.ref
        elif e.kind == "kbsew":
            title = f"База знаний: {first[:140]}" if first else f"KBSEW: {e.ref}"
        elif e.kind == "project":
            title = f"Проект: {first[:140]}" if first else f"Проект {e.ref}"
        elif e.kind == "diagram":
            title = f"Диаграмма: {first[:140]}" if first else "Схема / Диаграмма"
        elif e.kind == "table":
            title = f"Таблица: {first[:140]}" if first else "Табличные данные"
        elif e.kind == "finance":
            title = f"Финансы: {first[:140]}" if first else "Финансовые расчеты"
        elif e.kind == "swot":
            title = f"SWOT: {first[:140]}" if first else "SWOT-анализ"
        elif e.kind == "company":
            title = f"Компания: {first[:140]}" if first else f"Организация {e.ref}"
        elif e.kind == "entities":
            title = f"Сущности: {first[:140]}" if first else "Ключевые сущности"
        elif e.kind == "html_report":
            title = f"HTML-досье: {first[:140]}" if first else "Представительский HTML-отчет"
        elif e.kind == "risk":
            title = f"Риск-матрица: {first[:140]}" if first else "Оценка рисков"
        elif e.kind == "benchmark":
            title = f"Конкуренты: {first[:140]}" if first else "Конкурентный анализ"
        elif e.kind == "roadmap":
            title = f"Дорожная карта: {first[:140]}" if first else "План реализации"
        elif e.kind == "compliance":
            title = f"Комплаенс: {first[:140]}" if first else "Проверка стандартов"
        elif e.kind == "statistics":
            title = f"Статистика: {first[:140]}" if first else "Рыночная статистика"
        else:
            title = e.ref.split("/")[-1] if e.ref else e.kind

        out.append(
            MissionResultItem(
                kind=e.kind,
                title=title[:200],
                ref=e.ref[:500],
                snippet=snippet,
            )
        )
        if len(out) >= 64:
            break
    return out


def _normalize_iso(ts: str | None) -> str:
    if not ts:
        return ""
    s = str(ts).strip()
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    return s


def to_public_view(mission: MissionSnapshot) -> MissionPublicView:
    return MissionPublicView(
        id=mission.id,
        goal=mission.goal,
        status=mission.status,
        progress=progress_message(mission),
        results=results_from_evidence(mission),
        answer=mission.answer,
        block_reason=mission.block_reason,
        created_at=_normalize_iso(mission.created_at),
        updated_at=_normalize_iso(mission.updated_at),
    )


__all__ = (
    "DecideAction",
    "EvidenceItem",
    "MissionCreateBody",
    "MissionPublicView",
    "MissionResultItem",
    "MissionSnapshot",
    "MissionStatus",
    "MissionTickBody",
    "StepItem",
    "ToolName",
    "is_active_status",
    "is_terminal_status",
    "progress_message",
    "results_from_evidence",
    "to_public_view",
)
