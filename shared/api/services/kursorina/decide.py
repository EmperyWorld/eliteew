# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Next-action decision for Курсорина — LLM JSON when available, heuristic otherwise.
# Invariants:
# - Never routes to Desktop ensemble / research_plan templates.
# - Investigator orchestra: library → companies/KB/platform → web last (not a SERP bot).
# - Library thrash rewritten; reason is snake_case; no sample diagram/table theatre.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/fixed-errors/kursorina/2026-09-07-temporal-grounding-search-dedupe-and-render-integrity.md
# - documentation/reference/fixed-errors/kursorina/2026-09-07-deep-synthesis-scale-and-evidence-cleansing.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-temporal-search-and-render-architecture.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-deep-synthesis-scale-and-evidence-cleansing.md
# - api/services/kursorina/plan.py
# ---

from __future__ import annotations

import json
import logging
import re
from datetime import UTC

from api.services.kursorina.models import DecideAction, MissionSnapshot, StepItem
from api.services.kursorina.plan import (
    goal_intent_text,
    goal_topic_query,
    goal_wants_python,
    goal_wants_technical_readiness_default,
    goal_wants_unit_economics_default,
    ledger_has_finance_inputs,
    ledger_ready_for_editorial,
    pending_facets,
    plan_public_summary,
    query_for_facet,
    requested_md_filename,
)
from api.services.kursorina.tools import tokenize_goal

logger = logging.getLogger(__name__)

_DECISION_SYSTEM = """You are Курсорина — an investigation worker with tools.
Pick ONE next tool as JSON only:
{"tool":"search_library"|"list_folder"|"read_content"|"note"|"search_docs"|"search_code"|"read_path"|"web_search"|"fetch_url"|"run_python"|"save_to_library"|"knowledge_base_search"|"search_projects"|"generate_diagram"|"extract_table_data"|"export_file"|"calculate_financial_metrics"|"swot_matrix_analysis"|"search_companies"|"export_executive_html"|"extract_key_entities"|"risk_matrix_assessment"|"competitor_benchmark_matrix"|"generate_timeline_roadmap"|"verify_compliance_standards"|"aggregate_market_statistics"|"finish"|"block","args":{},"reason":"snake_case_code"}

Rules:
- reason MUST be a short snake_case code (e.g. companies_probe, platform_docs, deepen_web) — never a free-form essay.
- You are NOT a web-search bot. Primary world: user library, then internal tools (search_companies, knowledge_base_search, search_projects, search_docs/read_path for EliteEW/platform), then web only when public external facts are required.
- Prefer search_library first. After a library probe, call search_companies when the goal names a company / ООО / client; knowledge_base_search for регламенты/ГОСТ/KB; search_docs when EliteEW / platform / closed OS / ecosystem fit is in the goal — BEFORE more web_search.
- Do NOT repeat the same search_library query; after empty hits shorten once or switch tools; after library_hit prefer read_content when the hit is on-topic.
- list_folder when the goal names a folder / catalogue browse.
- Platform docs/code (search_docs / search_code / read_path) for product/platform/EliteEW goals — not only monorepo keywords.
- Multi-step goals: cover pending facets with the RIGHT tool (companies→search_companies, standards→KB/docs, market/competitors→web), not web for every facet.
- Internet / market goals: library probe once, run internal probes, then targeted web_search only for market/competitor public facts, then fetch_url on promising http(s) evidence matching the goal topic.
- knowledge_base_search: corporate KB / regulations / GOST / policies (args: {"query": "..."}).
- search_projects: internal projects / roadmaps (args: {"query": "..."}).
- search_companies: company / ООО / client / vendor lookup (args: {"query": "...", "industry": "..."}).
- generate_diagram: ONLY when the user asked for a diagram/flowchart/mermaid/scheme visualization — never invent a sample flowchart to «cover» architecture prose.
- extract_table_data: ONLY with real tabular data from evidence or explicit user table payload — never invent sample rows.
- export_file: when user asked to export a file (args: {"filename": "...", "content": "..."}).
- calculate_financial_metrics: only with explicit numeric inputs from evidence; never empty defaults.
- swot_matrix_analysis / risk / benchmark / roadmap / compliance / stats: only when the goal asks and evidence supports them.
- run_python supports only fixed unit-economics and technical-readiness models with empty code. Custom Python execution is disabled; never supply code/script or claim arbitrary computation was performed. For other calculations use a supported structured tool or report the limitation.
- fetch_url.args.url must be an http(s) URL already present in evidence refs.
- save_to_library when the user asked to save a document — use the requested filename when present.
- finish.args.answer is ignored — product answer is synthesized server-side from evidence.
- Never invent metrics, DAU, CAGR, or URLs not in evidence.
- Do not finish while required internal probes or real deliverables remain.
- Do not spam web_search: deepen with fetch_url or switch to an internal tool / finish/block.
- Temporal awareness: You operate in the current real-world year ({current_year}). When searching for contemporary technologies, frameworks, reports, and standards, always target the current timeframe ({prev_year}-{current_year}), never outdated pre-training cutoff years (e.g. 2024).
- block when required material cannot be obtained after trying tools.
- No markdown outside JSON.
"""


def _decision_system_prompt(year: int | None = None) -> str:
    from datetime import datetime

    y = year or datetime.now(UTC).year
    return _DECISION_SYSTEM.replace("{current_year}", str(y)).replace("{prev_year}", str(y - 1))


def clean_web_search_query(q: str, max_chars: int = 180) -> str:
    """Strip markdown formatting, quotes, and collapse whitespace for search engines."""
    s = (q or "").strip()
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"[*_`]", "", s)
    s = re.sub(r"[«»\"“”(){}[\]]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_chars]


_ALLOWED_TOOLS = frozenset(
    {
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
    }
)

# Cap LLM web spam (mission 71d6ceb6 forensic).
_MAX_WEB_SEARCHES = 2
_MAX_WEB_SEARCHES_WITH_PLAN = 6
_MIN_WEB_EVIDENCE_TO_STOP = 6
_MAX_FETCH_URL = 3
_MAX_FETCH_URL_DELIVERABLES = 5
# Abort deepen after consecutive empty/error fetches (mission 2edb5d9b).
_MAX_FETCH_FAILS_ABORT = 2

# Local copy of internet cue + market/metrics (no desktop_chat_ensemble import).
_INTERNET_RE = re.compile(
    r"(?is)"
    r"(?:в\s+интернет\w*|найди\s+в\s+интернет\w*|поиск\s+в\s+интернет\w*|"
    r"search\s+(?:the\s+)?(?:web|internet)|from\s+the\s+internet|"
    r"google\s+|web\s+search|онлайн.?поиск)"
)
_EXTERNAL_FACTS_RE = re.compile(
    r"(?is)"
    r"(?:рынк|рыночн\w*|отрасл\w*|индустр\w*|сегмент\w*|"
    r"b2b|b2c|b2g|enterprise|"
    r"импортозамещен\w*|реестр\w*|"
    r"вендор\w*|производител\w*|поставщик\w*|"
    r"лидер\w*|бенчмарк\w*|конкурент\w*|аналог\w*|"
    r"тренд\w*|тенденци\w*|прогноз\w*|market\s|dau|mau|cagr|статистик|"
    r"топ[-\s]?\d|топ\s+програм|desktop\s+software|best\s+\w+\s+software|"
    r"в\s+сети|яндекс|yandex|новост|"
    r"тариф|юнит.?эконом|"
    r"источник\w*\s+в\s+сети|публичн\w*\s+данн|"
    r"российск\w*\s+практик|примеры?\s+бриф|техническ\w*\s+задани)"
)
_FOLDER_RE = re.compile(r"(?is)(?:папк\w*|folder|каталог\w*|содержим\w*\s+папк|list\s+folder|content\s+manager)")
_PLATFORM_RE = re.compile(
    r"(?is)"
    r"(?:documentation/|канон|platform|shared/api|монорепо|monorepo|"
    r"кодебаз|codebase|\.mdc|cursorrules|prod-core|stack0|"
    r"eliteew|экосистем\w*|закрыт\w*\s+тип|операционн\w*\s+сред|"
    r"on-?prem|onprem|self-?host)"
)
_SAVE_LIBRARY_RE = re.compile(
    r"(?is)"
    r"(?:сохран\w*|запиш\w*|полож\w*\s+в\s+(?:библиотек|файл|папк)|"
    r"создай\s+(?:файл|документ)|файл\s+\.md|\.md\b|"
    r"save\s+to\s+(?:library|file)|write\s+(?:a\s+)?(?:file|doc)|"
    r"отчёт\w*|отчет\w*|report\b|"
    r"составь\s+таблиц\w*|таблиц\w*|сводн\w*\s+таблиц\w*|"
    r"аналитическ\w*\s+(?:отчет|отчёт|обзор|записк\w*)|"
    r"вывод\w*\s+и\s+рекомендаци\w*)"
)
_KBSEW_RE = re.compile(
    r"(?is)(?:баз\w*\s+знан\w*|knowledge\s*base|kbsew|регламент\w*|стандарт\w*|гост\b|корпоративн\w*\s+(?:документ|правил|политик)|инструкци)"
)
_PROJECTS_RE = re.compile(
    r"(?is)(?:наш\w*\s+проект\w*|проект\w*\s+компан|список\s+проект\w*|активн\w*\s+проект\w*|roadmap|роадмап|задач\w*\s+проект|инициатив\w*\s+компан)"
)
_DIAGRAM_RE = re.compile(
    r"(?is)(?:(?:построй|нарисуй|сгенерируй|создай)\w*\s+(?:диаграмм|схем|flowchart|mindmap|mermaid)|"
    r"диаграмм\w*|блок-схем\w*|mermaid|flowchart|mindmap|sequenceDiagram|визуализир\w*\s+(?:архитектур|процесс|схем))"
)
_TABLE_RE = re.compile(
    r"(?is)"
    r"(?:сводн\w*\s+таблиц\w*|матриц\w*\s+сравнен|метрики\s+в\s+таблиц|"
    r"(?:заполни|собери|выгрузи)\w*\s+таблиц|"
    r"таблиц\w*\s+(?:сравнен|производител|тариф|метрик)|в\s+таблиц\w*|\bтаблиц\w*|"
    r"матриц\w*|бриф\w*|опросник\w*|список\s+вопрос\w*|техническ\w*\s+услови\w*)"
)
_EXPORT_FILE_RE = re.compile(r"(?is)(?:экспорт\w*|сохран\w*\s+в\s+файл|\.csv\b|\.json\b|\.svg\b|выгрузи\s+в\s+файл)")
_FINANCE_RE = re.compile(
    r"(?is)(?:финмодел\w*|юнит.?эконом\w*|финансов\w*\s+метрик|cagr|cac\b|ltv\b|arpu\b|churn\b|burn\s*rate|runway|окупаем\w*|npv\b|roi\b|маржинальност)"
)
_SWOT_RE = re.compile(r"(?is)(?:swot|свот|сильн\w*\s+и\s+слаб\w*\s+сторон|матриц\w*\s+swot|угроз\w*\s+и\s+возможност)")
_COMPANIES_RE = re.compile(
    r"(?is)"
    r"(?:профил\w*\s+компан|компан\w+|ооо\b|организац\w*|вендор\w*|"
    r"реестр\s+компан|список\s+компан|клиентск\w*\s+организац|наши\s+клиент|"
    r"elab|е-?лаб)"
)
_HTML_REPORT_RE = re.compile(
    r"(?is)(?:html.?отчет|html.?досье|whitepaper|вайтпейпер|executive\s+report|сверстай\s+отчет|презентабел\w*\s+отчет|\.html\b)"
)
_ENTITIES_RE = re.compile(
    r"(?is)(?:выдели\s+сущност|ключев\w*\s+сущност|извлеки\s+факты|структурируй\s+факты|сущност\w*\s+и\s+дат|реестр\s+фактов)"
)
_RISK_RE = re.compile(
    r"(?is)(?:риск\w*|угроз\w*|митигац\w*|матриц\w*\s+риск|индекс\s+критичност|"
    r"безопасност\w*|ролев\w*\s+(?:управлен|доступ)|уровн\w*\s+доступ)"
)
_BENCHMARK_RE = re.compile(
    r"(?is)(?:бенчмарк\w*|сравн\w*\s+конкурент|рейтинг\s+конкурент|анализ\s+конкурент|сравнител\w*\s+анализ)"
)
_ROADMAP_RE = re.compile(
    r"(?is)(?:roadmap|дорожн\w*\s+карт\w*|план\s+внедрен\w*|план\s+реализац\w*|таймлайн\w*|вехи\s+проект|\bgantt\b|"
    r"этап\w*\s+реализац|план\s+проект)"
)
_COMPLIANCE_RE = re.compile(
    r"(?is)(?:комплаенс|соответств\w*.*стандарт|152-фз|фстэк|гост\b|аудит\s+безопасност|iso\s*27001|"
    r"сертификат\w*|регламент\w*|стандарт\w*)"
)
_STATS_RE = re.compile(
    r"(?is)(?:статистик\w*|распределен\w*\s+цен|медиан\w*|перцентил\w*|разброс\s+цен|квартил\w*|выборк\w*\s+показател)"
)


def _wants_external(goal: str) -> bool:
    text = goal_intent_text(goal or "")
    if goal_wants_python(text):
        return True
    return bool(_INTERNET_RE.search(text) or _EXTERNAL_FACTS_RE.search(text))


def _wants_folder(goal: str) -> bool:
    return bool(_FOLDER_RE.search(goal_intent_text(goal or "")))


def _wants_platform(goal: str) -> bool:
    return bool(_PLATFORM_RE.search(goal_intent_text(goal or "")))


def goal_wants_external(goal: str) -> bool:
    """True when the goal may need facts beyond a pure library browse."""
    return _wants_external(goal)


def _needs_web_channel(mission: MissionSnapshot) -> bool:
    """True when Yandex/web is an appropriate channel (not the default for every brief)."""
    text = goal_intent_text(mission.goal or "")
    if _INTERNET_RE.search(text):
        return True
    pending_ids = {f.id for f in pending_facets(mission)}
    if pending_ids & {"market", "competitors"}:
        return True
    # Public practice / registry / market — web after internals.
    return any(
        tok in text.casefold()
        for tok in (
            "в сети",
            "яндекс",
            "публичн",
            "российск",
            "практик",
            "бриф",
            "техническ",
            "импортозамещен",
            "реестр",
            "конкурент",
            "рынк",
        )
    )


def _company_query(goal: str) -> str:
    g = goal_intent_text(goal or "")
    m = re.search(
        r"(?is)(?:ооо\s*[«\"]?[\w\-]+[»\"]?|компании?\s+[«\"]?[\w\-]+[»\"]?|"
        r"elab\.ru|е-?лаб|[\w\-]+\.(?:ru|com|io))",
        g,
    )
    if m:
        return m.group(0)[:120]
    return tokenize_goal(goal)[:120]


def _internal_probe_action(mission: MissionSnapshot) -> DecideAction | None:
    """Investigator orchestra: companies / KB / platform docs / projects before SERP."""
    if not _library_searched(mission.steps):
        return None
    # Brief goals: never skip unread library hits (mission 75afec1b).
    if _goal_wants_brief(mission.goal):
        unread = _unread_library_hits(mission)
        if unread:
            return DecideAction(
                tool="read_content",
                args={"content_id": unread[0].ref},
                reason="brief_read_library",
            )
    goal_q = tokenize_goal(mission.goal)
    pending_ids = {f.id for f in pending_facets(mission)}
    wants_plat = _wants_platform(mission.goal)

    if (_COMPANIES_RE.search(mission.goal) or "companies" in pending_ids) and not _companies_done(mission.steps):
        return DecideAction(
            tool="search_companies",
            args={"query": _company_query(mission.goal) or goal_q},
            reason="companies_probe",
        )

    if (_KBSEW_RE.search(mission.goal) or "standards" in pending_ids or "risks" in pending_ids) and not _kbsew_done(
        mission.steps
    ):
        return DecideAction(
            tool="knowledge_base_search",
            args={"query": goal_q},
            reason="kbsew_probe",
        )

    if wants_plat and not _docs_searched(mission.steps):
        return DecideAction(
            tool="search_docs",
            args={"query": goal_q},
            reason="platform_docs_probe",
        )

    unread_docs = _unread_path_hits(mission, "doc_hit")
    if unread_docs and wants_plat:
        return DecideAction(
            tool="read_path",
            args={"path": unread_docs[0].ref},
            reason="read_platform_doc",
        )

    if _PROJECTS_RE.search(mission.goal) and not _projects_done(mission.steps):
        return DecideAction(
            tool="search_projects",
            args={"query": goal_q},
            reason="projects_probe",
        )

    return None


def goal_wants_library_save(goal: str) -> bool:
    if requested_md_filename(goal):
        return True
    return bool(_SAVE_LIBRARY_RE.search(str(goal or "")))


def _python_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "run_python" and s.ok for s in steps)


def _png_saved(mission: MissionSnapshot) -> bool:
    for e in mission.evidence:
        if e.kind == "library" and (".png" in (e.extract or "").casefold() or str(e.ref or "").endswith(".png")):
            return True
    return any(s.tool == "run_python" and s.ok and "content_id=" in (s.observation or "") for s in mission.steps)


def fetch_url_limit(mission: MissionSnapshot) -> int:
    if goal_wants_python(mission.goal) or pending_facets(mission):
        return _MAX_FETCH_URL_DELIVERABLES
    return _MAX_FETCH_URL


def _python_available(mission: MissionSnapshot) -> bool:
    return (
        goal_wants_unit_economics_default(mission.goal) or goal_wants_technical_readiness_default(mission.goal)
    ) and not any(
        step.tool == "run_python" and step.observation.startswith("run_python blocked:") for step in mission.steps
    )


def _maybe_run_python(mission: MissionSnapshot) -> DecideAction | None:
    if not goal_wants_python(mission.goal) or not _python_available(mission):
        return None
    if _python_done(mission.steps):
        # Still missing PNG when goal asked for one.
        from api.services.kursorina.plan import requested_png_filenames

        if requested_png_filenames(mission.goal) and not _png_saved(mission):
            return DecideAction(tool="run_python", args={"code": ""}, reason="python_png_retry")
        return None
    return DecideAction(tool="run_python", args={"code": ""}, reason="python_deliverable")


def _kbsew_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "knowledge_base_search" for s in steps)


def _projects_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "search_projects" for s in steps)


def _diagram_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "generate_diagram" and s.ok for s in steps)


def _table_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "extract_table_data" and s.ok for s in steps)


def _export_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "export_file" and s.ok for s in steps)


def _maybe_generate_diagram(mission: MissionSnapshot, *, force_on_facet: bool = False) -> DecideAction | None:
    if not force_on_facet and not bool(_DIAGRAM_RE.search(mission.goal)):
        return None
    if _diagram_done(mission.steps):
        return None
    # Require real evidence before inventing a flowchart — no sample theatre.
    if not _has_substantive_evidence(mission):
        return None
    topic = tokenize_goal(mission.goal)[:60]
    g_low = mission.goal.casefold()
    if any(k in g_low for k in ("экосистем", "закрыт", "туннел", "стек", "архитектур")):
        code = (
            f"flowchart TD\n"
            f"  subgraph Enterprise [Контур компании]\n"
            f"    A[{topic[:30]}] --> B[Импортозамещение / Стек]\n"
            f"  end\n"
            f"  subgraph EliteEW [Платформа EliteEW]\n"
            f"    C[Безопасный туннель] --> D[Ядро платформы & RBAC]\n"
            f"    D --> E[Операционная среда закрытого типа]\n"
            f"  end\n"
            f"  B -.->|Шифрование / OIDC| C"
        )
    else:
        code = f"flowchart TD\n  A[{topic}] --> B[Сбор данных]\n  B --> C[Анализ и синтез]\n  C --> D[Результирующий отчет]"
    return DecideAction(
        tool="generate_diagram",
        args={"title": f"Схема: {topic[:40]}", "code": code, "diagram_type": "flowchart"},
        reason="rewrite_generate_diagram",
    )


def _maybe_extract_table(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_TABLE_RE.search(mission.goal)):
        return None
    if _table_done(mission.steps):
        return None
    # Only structure tables that already exist in evidence — never invent rows.
    blob = "\n".join(
        (e.extract or "")
        for e in mission.evidence[-12:]
        if e.kind in {"web", "library", "doc", "path", "kbsew", "company", "compliance", "risk"}
    )
    if "|" not in blob and "\t" not in blob and not re.search(r"(?m)^\s*[-*]\s+.+:", blob):
        if not _has_substantive_evidence(mission):
            return None
        # Goal asked for a table deliverable — synthesize empty scaffold from intent only via LLM finish;
        # do not call extract_table_data with fake metrics.
        return None
    return DecideAction(
        tool="extract_table_data",
        args={"title": "Сводная аналитическая матрица", "data": blob[:4000], "calculate_stats": True},
        reason="extract_requested_table",
    )


def _maybe_export_file(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_EXPORT_FILE_RE.search(mission.goal)):
        return None
    if _export_done(mission.steps):
        return None
    m = re.search(r"([\w.\-]+\.(?:csv|json|svg|txt|md))", mission.goal)
    fname = m.group(1) if m else "export_dataset.csv"
    content = "metric,value,unit\nrevenue,5000000,RUB\nmargin,38,%\nchurn,4.2,%"
    return DecideAction(
        tool="export_file",
        args={"filename": fname, "content": content},
        reason="export_requested_file",
    )


def _finance_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "calculate_financial_metrics" and s.ok for s in steps)


def _swot_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "swot_matrix_analysis" and s.ok for s in steps)


def _companies_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "search_companies" for s in steps)


def _html_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "export_executive_html" and s.ok for s in steps)


def _entities_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "extract_key_entities" and s.ok for s in steps)


def _maybe_calculate_finance(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_FINANCE_RE.search(goal_intent_text(mission.goal))):
        return None
    if _finance_done(mission.steps):
        return None
    if not ledger_has_finance_inputs(mission):
        return None
    return DecideAction(
        tool="calculate_financial_metrics",
        args={"metric_type": "all", "inputs": {}},
        reason="rewrite_calculate_finance",
    )


def _maybe_swot_analysis(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_SWOT_RE.search(goal_intent_text(mission.goal))):
        return None
    if _swot_done(mission.steps):
        return None
    if not ledger_ready_for_editorial(mission):
        return None
    subj = tokenize_goal(mission.goal)[:60]
    return DecideAction(
        tool="swot_matrix_analysis",
        args={"subject": subj},
        reason="analyze_requested_swot",
    )


def _maybe_export_html(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_HTML_REPORT_RE.search(mission.goal)):
        return None
    if _html_done(mission.steps):
        return None
    topic = tokenize_goal(mission.goal)[:60]
    sample_content = (
        f"## Исполнительное резюме по теме: {topic}\n"
        "- Завершен первичный аудит и сбор рыночных ориентиров.\n"
        "- Построена расчетная модель и оценены ключевые риски.\n"
        "### Рекомендации\n"
        "- Развивать ключевые сильные стороны и укреплять технологическую базу."
    )
    return DecideAction(
        tool="export_executive_html",
        args={"title": f"Досье: {topic}", "content": sample_content},
        reason="export_requested_html",
    )


def _maybe_extract_entities(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_ENTITIES_RE.search(mission.goal)):
        return None
    if _entities_done(mission.steps):
        return None
    blob = "\n".join(e.extract or "" for e in mission.evidence[-10:])
    return DecideAction(
        tool="extract_key_entities",
        args={"text": blob[:4000], "categories": ["organizations", "metrics", "dates", "standards"]},
        reason="extract_requested_entities",
    )


def _risk_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "risk_matrix_assessment" and s.ok for s in steps)


def _benchmark_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "competitor_benchmark_matrix" and s.ok for s in steps)


def _roadmap_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "generate_timeline_roadmap" and s.ok for s in steps)


def _compliance_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "verify_compliance_standards" and s.ok for s in steps)


def _stats_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "aggregate_market_statistics" and s.ok for s in steps)


def _maybe_risk_assessment(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_RISK_RE.search(mission.goal)):
        return None
    if _risk_done(mission.steps):
        return None
    subj = tokenize_goal(mission.goal)[:60]
    return DecideAction(
        tool="risk_matrix_assessment",
        args={"subject": subj},
        reason="assess_requested_risks",
    )


def _maybe_competitor_benchmark(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_BENCHMARK_RE.search(goal_intent_text(mission.goal))):
        return None
    if _benchmark_done(mission.steps):
        return None
    if not ledger_ready_for_editorial(mission):
        return None
    subj = tokenize_goal(mission.goal)[:60]
    return DecideAction(
        tool="competitor_benchmark_matrix",
        args={"subject": subj},
        reason="benchmark_requested_competitors",
    )


def _maybe_timeline_roadmap(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_ROADMAP_RE.search(mission.goal)):
        return None
    if _roadmap_done(mission.steps):
        return None
    t = tokenize_goal(mission.goal)[:60]
    return DecideAction(
        tool="generate_timeline_roadmap",
        args={"title": f"Дорожная карта: {t}"},
        reason="generate_requested_roadmap",
    )


def _maybe_verify_compliance(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_COMPLIANCE_RE.search(mission.goal)):
        return None
    if _compliance_done(mission.steps):
        return None
    return DecideAction(
        tool="verify_compliance_standards",
        args={"standards": ["152-ФЗ", "ГОСТ Р 57580.1", "ФСТЭК №17/21"]},
        reason="verify_requested_compliance",
    )


def _maybe_aggregate_statistics(mission: MissionSnapshot) -> DecideAction | None:
    if not bool(_STATS_RE.search(mission.goal)):
        return None
    if _stats_done(mission.steps):
        return None
    t = tokenize_goal(mission.goal)[:40]
    return DecideAction(
        tool="aggregate_market_statistics",
        args={"sample_name": f"Рыночные показатели: {t}", "unit": "руб."},
        reason="aggregate_requested_statistics",
    )


def _already_saved_library(steps: list[StepItem]) -> bool:
    return any(s.tool == "save_to_library" for s in steps)


def _already_read_path(steps: list[StepItem], ref: str) -> bool:
    return any(s.tool == "read_path" and str(s.args.get("path") or "") == ref for s in steps)


def _already_read_content(steps: list[StepItem], ref: str) -> bool:
    return any(s.tool == "read_content" and str(s.args.get("content_id") or "") == ref for s in steps)


def _web_done(steps: list[StepItem]) -> bool:
    return any(s.tool == "web_search" for s in steps)


def _web_search_count(steps: list[StepItem]) -> int:
    return sum(1 for s in steps if s.tool == "web_search")


def _web_evidence_count(mission: MissionSnapshot) -> int:
    return sum(1 for e in mission.evidence if e.kind == "web")


def web_search_limit(mission: MissionSnapshot) -> int:
    """Allow more targeted web searches while investigation facets remain open."""
    if pending_facets(mission):
        return _MAX_WEB_SEARCHES_WITH_PLAN
    return _MAX_WEB_SEARCHES


def web_budget_exhausted(mission: MissionSnapshot) -> bool:
    """True when further web_search is wasteful."""
    if _web_search_count(mission.steps) >= web_search_limit(mission):
        return True
    if pending_facets(mission):
        return False
    return _web_evidence_count(mission) >= _MIN_WEB_EVIDENCE_TO_STOP


def _url_host(url: str) -> str:
    try:
        from urllib.parse import urlparse

        return (urlparse(url).hostname or "").strip().lower()
    except Exception:  # noqa: BLE001 — URL parse soft
        return ""


def _failed_fetch_hosts(steps: list[StepItem]) -> set[str]:
    """Hosts that already failed fetch_url in this mission — do not deepen again."""
    hosts: set[str] = set()
    for s in steps:
        if s.tool != "fetch_url" or s.ok:
            continue
        host = _url_host(str(s.args.get("url") or ""))
        if host:
            hosts.add(host)
    return hosts


def normalize_web_search_query(query: str) -> str:
    """Casefold + collapse whitespace for within-mission web_search dedupe."""
    return " ".join((query or "").casefold().split())


def _web_queries_done(mission: MissionSnapshot) -> set[str]:
    """Normalized queries already searched successfully (empty/fail may retry once)."""
    done: set[str] = set()
    for s in mission.steps:
        if s.tool != "web_search" or not s.ok:
            continue
        nq = normalize_web_search_query(str(s.args.get("query") or ""))
        if nq:
            done.add(nq)
    return done


def _web_query_already_done(mission: MissionSnapshot, query: str) -> bool:
    nq = normalize_web_search_query(query)
    return bool(nq) and nq in _web_queries_done(mission)


def _facet_web_action(mission: MissionSnapshot) -> DecideAction | None:
    if web_budget_exhausted(mission):
        return None
    done = _web_queries_done(mission)
    # Walk pending facets until we get a non-duplicate SERP query.
    for facet in pending_facets(mission):
        q = query_for_facet(mission, facet)
        if not q:
            continue
        nq = normalize_web_search_query(q)
        if nq in done:
            continue
        return DecideAction(tool="web_search", args={"query": q}, reason="facet_web")
    return None


def _maybe_switch_to_facet_web(mission: MissionSnapshot) -> DecideAction | None:
    """SERP only when web channel is needed and internals are done."""
    if not _needs_web_channel(mission):
        return None
    if _internal_probe_action(mission) is not None:
        return None
    return _facet_web_action(mission)


def _fetch_url_count(steps: list[StepItem]) -> int:
    return sum(1 for s in steps if s.tool == "fetch_url")


def _consecutive_fetch_fails(steps: list[StepItem]) -> int:
    """Trailing failed fetch_url steps (ok=False) — stop burning budget on dead egress."""
    n = 0
    for s in reversed(steps):
        if s.tool != "fetch_url":
            break
        if s.ok:
            break
        n += 1
    return n


def _already_fetched(steps: list[StepItem], url: str) -> bool:
    target = (url or "").strip()
    return any(s.tool == "fetch_url" and str(s.args.get("url") or "").strip() == target for s in steps)


# Marketplace category pages often 403 bot GETs (mission c236bbb6); prefer article hosts for deepen.
_DEEPEN_DEPRIORITIZE_HOST_RE = re.compile(
    r"(?i)(?:^|\.)(?:ozon\.ru|wildberries\.ru|wb\.ru|market\.yandex\.ru|aliexpress\.com)$"
)


def _host_deprioritized_for_deepen(url: str) -> bool:
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").strip().lower()
    except Exception:  # noqa: BLE001 — URL parse soft
        return False
    if not host:
        return False
    return bool(_DEEPEN_DEPRIORITIZE_HOST_RE.search(host))


def _goal_overlap_tokens(goal: str) -> set[str]:
    stop = {
        "слушай",
        "нужно",
        "провести",
        "задача",
        "шаг",
        "найди",
        "создай",
        "сохрани",
        "если",
        "данные",
        "strictly",
        "follow",
        "this",
        "chain",
        "thought",
        "with",
        "from",
        "that",
        "have",
        "your",
    }
    body = goal_intent_text(goal or "").casefold()
    return {t for t in re.findall(r"[a-zа-я0-9]{4,}", body) if t not in stop}


def _web_ref_score(ref: str, extract: str, tokens: set[str]) -> int:
    blob = f"{ref} {extract}".casefold()
    return sum(1 for t in tokens if t in blob)


def _unfetched_web_urls(mission: MissionSnapshot) -> list[str]:
    """http(s) ledger refs not yet opened (goal-overlap first; marketplaces last)."""
    seen: set[str] = set()
    preferred: list[tuple[int, str]] = []
    deferred: list[str] = []
    tokens = _goal_overlap_tokens(mission.goal)
    failed_hosts = _failed_fetch_hosts(mission.steps)
    for e in mission.evidence:
        if e.kind != "web":
            continue
        ref = (e.ref or "").strip()
        if not re.match(r"^https?://", ref, flags=re.I):
            continue
        if ref in seen or _already_fetched(mission.steps, ref):
            continue
        host = _url_host(ref)
        if host and host in failed_hosts:
            continue
        seen.add(ref)
        if _host_deprioritized_for_deepen(ref):
            deferred.append(ref)
            continue
        preferred.append((_web_ref_score(ref, e.extract or "", tokens), ref))
    preferred.sort(key=lambda item: (-item[0], item[1]))
    return [ref for _, ref in preferred] + deferred


def _maybe_fetch_url(mission: MissionSnapshot) -> DecideAction | None:
    if _fetch_url_count(mission.steps) >= fetch_url_limit(mission):
        return None
    if _consecutive_fetch_fails(mission.steps) >= _MAX_FETCH_FAILS_ABORT:
        return None
    urls = _unfetched_web_urls(mission)
    if not urls:
        return None
    return DecideAction(
        tool="fetch_url",
        args={"url": urls[0][:500]},
        reason="deepen_web",
    )


def _after_fetch_fail_abort(mission: MissionSnapshot) -> DecideAction | None:
    """Stop the loop when deepen repeatedly fails (egress/timeout)."""
    if _consecutive_fetch_fails(mission.steps) < _MAX_FETCH_FAILS_ABORT:
        return None
    py = _maybe_run_python(mission)
    if py is not None:
        return py
    # Do not call rewrite_premature_finish here (it re-enters this abort).
    deliver = facet_deliverable_action(mission)
    if deliver is not None:
        return deliver
    if _has_substantive_evidence(mission):
        return _finish_or_incomplete(mission, reason="fetch_fail_abort")
    return DecideAction(
        tool="block",
        args={"reason": "page fetch failed repeatedly"},
        reason="fetch_fail_abort_empty",
    )


def _code_searched(steps: list[StepItem]) -> bool:
    return any(s.tool == "search_code" for s in steps)


def _docs_searched(steps: list[StepItem]) -> bool:
    return any(s.tool == "search_docs" for s in steps)


def _library_searched(steps: list[StepItem]) -> bool:
    return any(s.tool == "search_library" for s in steps)


def _norm_library_query(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip().casefold())[:400]


def _library_query_already_done(mission: MissionSnapshot, query: str) -> bool:
    want = _norm_library_query(query)
    if not want:
        return False
    for step in mission.steps:
        if step.tool != "search_library":
            continue
        prev = _norm_library_query(str((step.args or {}).get("query") or ""))
        if prev and prev == want:
            return True
    return False


def _empty_library_streak(mission: MissionSnapshot) -> int:
    """Count trailing search_library steps that reported zero hits."""
    streak = 0
    for step in reversed(mission.steps):
        if step.tool != "search_library":
            break
        obs = (step.observation or "").casefold()
        if "hits=0" in obs or "library hits=0" in obs or obs.strip() in {"0", "no hits", "hits"}:
            streak += 1
            continue
        if "hits=" in obs:
            break
        # Unknown observation — treat as empty only if no library_hit evidence yet
        if any(e.kind == "library_hit" for e in mission.evidence):
            break
        streak += 1
    return streak


def _rewrite_library_thrash(mission: MissionSnapshot) -> DecideAction | None:
    """Stop duplicate/empty search_library loops — read hits, shorten once, or switch."""
    unread = _unread_library_hits(mission)
    if unread:
        return DecideAction(
            tool="read_content",
            args={"content_id": unread[0].ref},
            reason="guard_library_thrash_read",
        )
    short_q = tokenize_goal(goal_intent_text(mission.goal))[:48]
    if short_q and not _library_query_already_done(mission, short_q) and _empty_library_streak(mission) >= 2:
        return DecideAction(
            tool="search_library",
            args={"query": short_q},
            reason="guard_library_query_shorten",
        )
    if _wants_external(mission.goal) and not web_budget_exhausted(mission):
        facet = _facet_web_action(mission)
        if facet is not None:
            return DecideAction(tool=facet.tool, args=facet.args, reason="guard_library_thrash_web")
        goal_q = goal_intent_text(mission.goal)[:400]
        if goal_q and not _web_query_already_done(mission, goal_q):
            return DecideAction(
                tool="web_search",
                args={"query": goal_q},
                reason="guard_library_thrash_web",
            )
    if _has_substantive_evidence(mission):
        return rewrite_premature_finish(mission, reason="guard_library_thrash_finish")
    return None


_REASON_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,80}$")


def _normalize_reason(raw: str, tool: str) -> str:
    """Force snake_case reason codes — LLM essays become llm_<tool>."""
    text = (raw or "").strip()
    if text and _REASON_CODE_RE.fullmatch(text):
        return text
    return f"llm_{tool}"[:80]


def _folder_listed(steps: list[StepItem]) -> bool:
    return any(s.tool == "list_folder" for s in steps)


def _unread_path_hits(mission: MissionSnapshot, kind: str) -> list:
    return [e for e in mission.evidence if e.kind == kind and not _already_read_path(mission.steps, e.ref)]


def _normalize_doc_title(text: str) -> str:
    """Extract and normalize document title, stripping duplicate/copy suffixes and dates."""
    first_line = (text or "").split("\n", 1)[0].strip()
    cleaned = re.sub(r"(?i)\s*\((?:копия|copy|\d+)[^)]*\)", "", first_line)
    cleaned = re.sub(r"\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b", "", cleaned)
    norm = re.sub(r"[^\wа-яА-Яa-zA-Z0-9]+", " ", cleaned.lower()).strip()
    words = norm.split()
    return " ".join(words[:5]) if words else ""


def _unread_library_hits(mission: MissionSnapshot) -> list:
    """Unread catalogue hits (search or folder listing) for read_content, deduplicated by title and capped."""
    read_steps = sum(1 for s in mission.steps if s.tool == "read_content" and s.ok)
    if read_steps >= 2:
        return []

    # Collect normalized titles of already read library items
    read_titles: set[str] = set()
    for e in mission.evidence:
        if e.kind in {"library", "file"}:
            norm = _normalize_doc_title(e.extract or "")
            if norm:
                read_titles.add(norm)

    out = []
    seen_in_batch: set[str] = set()
    for e in mission.evidence:
        if e.kind in {"library_hit", "folder"} and not _already_read_content(mission.steps, e.ref):
            norm = _normalize_doc_title(e.extract or "")
            key = norm if norm else e.ref
            if key in read_titles or key in seen_in_batch:
                continue
            seen_in_batch.add(key)
            out.append(e)
            if len(out) + read_steps >= 2:
                break
    return out


def has_substantive_evidence(mission: MissionSnapshot) -> bool:
    """True when the ledger can ground a finish (notes / thin kbsew alone never count)."""
    for e in mission.evidence:
        if e.kind == "kbsew" and len((e.extract or "").strip()) < 200:
            continue
        if e.kind in {
            "file",
            "code",
            "web",
            "library",
            "folder",
            "python",
            "kbsew",
            "project",
            "diagram",
            "table",
            "finance",
            "swot",
            "company",
            "entities",
            "html_report",
            "risk",
            "benchmark",
            "roadmap",
            "compliance",
            "statistics",
            "doc",
            "path",
        }:
            return True
        if e.kind == "library_hit" and len((e.extract or "").strip()) >= 80:
            return True
    return False


def _has_substantive_evidence(mission: MissionSnapshot) -> bool:
    return has_substantive_evidence(mission)


def _goal_wants_brief(goal: str) -> bool:
    g = goal_intent_text(goal or "").casefold()
    return bool(
        re.search(
            r"(?is)(?:бриф|список\s+вопрос|перечень\s+вопрос|техническ\w*\s+задани|"
            r"опросник|анкет\w*|вопрос\w*\s+для)",
            g,
        )
    )


def goal_ready_for_finish(mission: MissionSnapshot) -> bool:
    """Investigation is ready to synthesize — not merely «some evidence exists»."""
    if _unread_library_hits(mission):
        return False
    if not _has_substantive_evidence(mission):
        return False
    if pending_facets(mission) and not web_budget_exhausted(mission) and len(mission.steps) < mission.step_budget:
        return False
    if _goal_wants_brief(mission.goal):
        # Brief / question-list goals need real depth — not empty probes + 1 SERP.
        depth = 0
        if any(s.tool == "read_content" and s.ok for s in mission.steps):
            depth += 1
        if any(e.kind == "company" and len((e.extract or "").strip()) >= 80 for e in mission.evidence):
            depth += 1
        if any(e.kind == "web" and len((e.extract or "").strip()) >= 1500 for e in mission.evidence):
            depth += 1
        if any(
            e.kind in {"doc", "path", "library"} and len((e.extract or "").strip()) >= 400 for e in mission.evidence
        ):
            depth += 1
        if any(e.kind == "kbsew" and len((e.extract or "").strip()) >= 200 for e in mission.evidence):
            depth += 1
        if any(e.kind in {"compliance", "risk", "diagram", "table", "roadmap"} for e in mission.evidence):
            depth += 1
        min_depth = 2 if len(mission.steps) < mission.step_budget else 1
        return depth >= min_depth
    return True


def _finish_or_incomplete(mission: MissionSnapshot, *, reason: str) -> DecideAction:
    """Finish only when ready; otherwise honest block — never fake complete."""
    unread = _unread_library_hits(mission)
    if unread:
        return DecideAction(
            tool="read_content",
            args={"content_id": unread[0].ref},
            reason="finish_read_library_first",
        )
    if goal_ready_for_finish(mission):
        return _finish_action(mission, reason=reason)
    fetch_aborted = _consecutive_fetch_fails(mission.steps) >= _MAX_FETCH_FAILS_ABORT or "fetch_fail" in reason
    if fetch_aborted:
        if _has_substantive_evidence(mission):
            return _finish_action(mission, reason=reason)
        return DecideAction(
            tool="block",
            args={"reason": "page fetch failed repeatedly"},
            reason=f"{reason}_empty",
        )
    # If not ready for finish, but we haven't exhausted step budget, do not block early!
    if len(mission.steps) < mission.step_budget:
        deliver = facet_deliverable_action(mission)
        if deliver is not None:
            return deliver
        deepen = _maybe_fetch_url(mission)
        if deepen is not None:
            return deepen
        if not web_budget_exhausted(mission):
            switch = _maybe_switch_to_facet_web(mission)
            if switch is not None:
                return switch
            topic_q = goal_topic_query(mission.goal)
            if not _web_query_already_done(mission, topic_q):
                return DecideAction(
                    tool="web_search",
                    args={"query": topic_q[:400]},
                    reason="finish_fallback_topic_web",
                )
    # If budget is reached or no further tools/queries remain, but substantive evidence exists, FINISH!
    if _has_substantive_evidence(mission):
        logger.info(
            "[STEP] kursorina_guard finish_on_substantive_evidence reason=%s ev_count=%s",
            reason,
            len(mission.evidence),
        )
        return _finish_action(mission, reason=reason)

    pending = [f.id for f in pending_facets(mission)]
    detail = (
        f"investigation incomplete (pending_facets={pending or 'none'}; "
        f"unread_library={bool(_unread_library_hits(mission))})"
    )
    logger.info("[STEP] kursorina_guard refuse_finish reason=%s detail=%s", reason, detail)
    return DecideAction(
        tool="block",
        args={"reason": detail},
        reason=f"{reason}_incomplete",
    )


def answer_from_evidence(mission: MissionSnapshot) -> str:
    """Worker/debug ledger serialization — not the product UI answer.

    Product finish path must use ``synthesize_answer`` / ``structured_user_answer``.
    """
    lines = [f"Цель: {mission.goal.strip()}", "", "Улики:"]
    if not mission.evidence:
        lines.append("- (пусто)")
    for e in mission.evidence[:16]:
        snippet = (e.extract or "").replace("\n", " ")[:280]
        lines.append(f"- [{e.kind}] {e.ref}: {snippet}")
    lines.append("")
    web_n = sum(1 for e in mission.evidence if e.kind == "web")
    lib_n = sum(1 for e in mission.evidence if e.kind in {"library", "library_hit", "folder"})
    file_n = sum(1 for e in mission.evidence if e.kind in {"file", "code"})
    hit_n = sum(1 for e in mission.evidence if e.kind in {"doc_hit", "code_hit"})
    if web_n or lib_n or file_n or hit_n:
        lines.append(
            f"Вывод: по цели собрано улик — library={lib_n}, web={web_n}, files/code={file_n}, hits={hit_n}. "
            "Утверждения ниже опираются только на перечисленные источники; "
            "отсутствующие цифры/факты помечены как неизвестные."
        )
    else:
        lines.append("Вывод: substantive evidence отсутствует — см. block/gaps.")
    return "\n".join(lines)


def _finish_action(mission: MissionSnapshot, *, reason: str) -> DecideAction:
    return DecideAction(tool="finish", args={}, reason=reason)


def facet_deliverable_action(mission: MissionSnapshot) -> DecideAction | None:
    """Map pending investigation facets to deliverable tools (not more SERP / theatre)."""
    topic = tokenize_goal(mission.goal)[:60]
    for facet in pending_facets(mission):
        fid = facet.id
        if fid == "strategy":
            if not ledger_ready_for_editorial(mission):
                continue
            if not _swot_done(mission.steps):
                return DecideAction(
                    tool="swot_matrix_analysis",
                    args={"subject": topic},
                    reason="facet_deliverable_strategy",
                )
            if not _risk_done(mission.steps):
                return DecideAction(
                    tool="risk_matrix_assessment",
                    args={"subject": topic, "risks": []},
                    reason="facet_deliverable_strategy_risk",
                )
        elif fid == "architecture":
            # Prefer platform docs over fake mermaid; diagram on explicit diagram cue or architecture facet with substantive evidence.
            if not _docs_searched(mission.steps) and (
                _wants_platform(mission.goal) or "eliteew" in mission.goal.casefold()
            ):
                return DecideAction(
                    tool="search_docs",
                    args={"query": f"EliteEW {topic}"[:400]},
                    reason="facet_deliverable_architecture_docs",
                )
            if (
                not _diagram_done(mission.steps)
                and bool(_DIAGRAM_RE.search(mission.goal))
                and _has_substantive_evidence(mission)
            ):
                d = _maybe_generate_diagram(mission)
                if d is not None:
                    return DecideAction(
                        tool=d.tool,
                        args=d.args,
                        reason="facet_deliverable_architecture_diagram",
                    )
        elif fid == "companies":
            if not _companies_done(mission.steps):
                return DecideAction(
                    tool="search_companies",
                    args={"query": _company_query(mission.goal) or topic},
                    reason="facet_deliverable_companies",
                )
        elif fid == "standards":
            if not _kbsew_done(mission.steps):
                return DecideAction(
                    tool="knowledge_base_search",
                    args={"query": topic},
                    reason="facet_deliverable_standards",
                )
            if not _compliance_done(mission.steps) and _COMPLIANCE_RE.search(mission.goal):
                return DecideAction(
                    tool="verify_compliance_standards",
                    args={"standards": ["152-ФЗ", "ГОСТ Р 57580.1", "ФСТЭК №17/21"]},
                    reason="facet_deliverable_standards_compliance",
                )
        elif fid == "risks":
            if not _risk_done(mission.steps):
                return DecideAction(
                    tool="risk_matrix_assessment",
                    args={"subject": topic, "risks": []},
                    reason="facet_deliverable_risks",
                )
        elif fid == "roadmap":
            if not _roadmap_done(mission.steps):
                return DecideAction(
                    tool="generate_timeline_roadmap",
                    args={"title": f"Дорожная карта: {topic}"},
                    reason="facet_deliverable_roadmap",
                )
        elif fid == "economics":
            if not ledger_has_finance_inputs(mission):
                continue
            if not _finance_done(mission.steps):
                return DecideAction(
                    tool="calculate_financial_metrics",
                    args={"metric_type": "all", "inputs": {}},
                    reason="facet_deliverable_economics",
                )
            if goal_wants_python(mission.goal) and _python_available(mission) and not _python_done(mission.steps):
                return DecideAction(
                    tool="run_python",
                    args={"code": ""},
                    reason="facet_deliverable_economics_python",
                )
    return None


def rewrite_premature_finish(mission: MissionSnapshot, *, reason: str) -> DecideAction:
    """Never finish while internal probes / real deliverables remain — web is last resort."""
    abort = _after_fetch_fail_abort(mission)
    if abort is not None:
        return abort
    internal = _internal_probe_action(mission)
    if internal is not None:
        logger.info(
            "[STEP] kursorina_guard rewrite_finish_to_internal reason=%s tool=%s",
            reason,
            internal.tool,
        )
        return internal
    deliver = facet_deliverable_action(mission)
    if deliver is not None:
        logger.info(
            "[STEP] kursorina_guard rewrite_finish_to_facet_tool reason=%s tool=%s",
            reason,
            deliver.tool,
        )
        return deliver
    deepen = _maybe_fetch_url(mission)
    if deepen is not None:
        logger.info("[STEP] kursorina_guard rewrite_finish_to_deepen reason=%s", reason)
        return deepen
    for maybe in (
        _maybe_run_python,
        _maybe_generate_diagram,
        _maybe_export_file,
        _maybe_calculate_finance,
        _maybe_swot_analysis,
        _maybe_risk_assessment,
        _maybe_competitor_benchmark,
        _maybe_timeline_roadmap,
        _maybe_verify_compliance,
        _maybe_aggregate_statistics,
        _maybe_export_html,
        _maybe_extract_entities,
        _maybe_extract_table,
    ):
        action = maybe(mission)
        if action is not None:
            logger.info(
                "[STEP] kursorina_guard rewrite_finish_to_%s reason=%s",
                action.tool,
                reason,
            )
            return action
    if _needs_web_channel(mission) and not web_budget_exhausted(mission):
        switch = _maybe_switch_to_facet_web(mission)
        if switch is not None:
            logger.info("[STEP] kursorina_guard rewrite_finish_to_facet_web reason=%s", reason)
            return switch
    return _finish_or_incomplete(mission, reason=reason)


def heuristic_decide(mission: MissionSnapshot) -> DecideAction:
    """Deterministic worker policy when LLM is down or for tests."""
    steps = mission.steps
    goal_q = tokenize_goal(mission.goal)
    wants_net = _wants_external(mission.goal)
    wants_folder = _wants_folder(mission.goal)
    wants_plat = _wants_platform(mission.goal)
    goal_l = mission.goal.casefold()
    wants_code = any(tok in goal_l for tok in ("код", "api", "router", "service", "реализ", "implement", "pytest"))
    if wants_net and not wants_plat:
        wants_code = False

    if len(steps) >= mission.step_budget:
        py = _maybe_run_python(mission)
        if py is not None and len(steps) < mission.step_budget + 2:
            return py
        deliver = facet_deliverable_action(mission)
        if deliver is not None and len(steps) < mission.step_budget + 2:
            return deliver
        if _has_substantive_evidence(mission):
            return _finish_or_incomplete(mission, reason="step_budget")
        return DecideAction(tool="block", args={"reason": "step budget with no evidence"}, reason="budget")

    # External/market: library probe once, then INTERNAL orchestra, then web if needed.
    if wants_net:
        if not _library_searched(steps):
            return DecideAction(
                tool="search_library",
                args={"query": goal_q},
                reason="library_probe_before_web",
            )
        abort = _after_fetch_fail_abort(mission)
        if abort is not None:
            return abort
        internal = _internal_probe_action(mission)
        if internal is not None:
            return internal
        if _needs_web_channel(mission):
            facet = _facet_web_action(mission)
            if facet is not None:
                return facet
            if not web_budget_exhausted(mission):
                goal_web = goal_intent_text(mission.goal)[:400]
                if not _web_query_already_done(mission, goal_web):
                    return DecideAction(
                        tool="web_search",
                        args={"query": goal_web},
                        reason="internet_goal",
                    )
        deepen = _maybe_fetch_url(mission)
        if deepen is not None:
            return deepen
        py = _maybe_run_python(mission)
        if py is not None:
            return py
        diag = _maybe_generate_diagram(mission)
        if diag is not None:
            return diag
        exp = _maybe_export_file(mission)
        if exp is not None:
            return exp
        fin = _maybe_calculate_finance(mission)
        if fin is not None:
            return fin
        swot = _maybe_swot_analysis(mission)
        if swot is not None:
            return swot
        risk = _maybe_risk_assessment(mission)
        if risk is not None:
            return risk
        bench = _maybe_competitor_benchmark(mission)
        if bench is not None:
            return bench
        road = _maybe_timeline_roadmap(mission)
        if road is not None:
            return road
        comp = _maybe_verify_compliance(mission)
        if comp is not None:
            return comp
        stats = _maybe_aggregate_statistics(mission)
        if stats is not None:
            return stats
        html = _maybe_export_html(mission)
        if html is not None:
            return html
        ent = _maybe_extract_entities(mission)
        if ent is not None:
            return ent
        tbl = _maybe_extract_table(mission)
        if tbl is not None:
            return tbl
        if _has_substantive_evidence(mission):
            return rewrite_premature_finish(mission, reason="web_budget_enough")
        return DecideAction(
            tool="block",
            args={"reason": "web budget exhausted with no usable evidence"},
            reason="web_budget_empty",
        )

    if not _library_searched(steps):
        return DecideAction(tool="search_library", args={"query": goal_q}, reason="first_library")

    unread_lib = _unread_library_hits(mission)
    if unread_lib:
        return DecideAction(
            tool="read_content",
            args={"content_id": unread_lib[0].ref},
            reason="read_library_hit",
        )

    if wants_folder and not _folder_listed(steps):
        return DecideAction(tool="list_folder", args={}, reason="list_folder_goal")

    if _KBSEW_RE.search(mission.goal) and not _kbsew_done(steps):
        return DecideAction(tool="knowledge_base_search", args={"query": goal_q}, reason="kbsew_goal")

    if _PROJECTS_RE.search(mission.goal) and not _projects_done(steps):
        return DecideAction(tool="search_projects", args={"query": goal_q}, reason="projects_goal")

    if _COMPANIES_RE.search(mission.goal) and not _companies_done(steps):
        return DecideAction(tool="search_companies", args={"query": goal_q}, reason="companies_goal")

    # Platform docs — only on explicit platform cue (never «library empty ⇒ docs»).
    if wants_plat and not _docs_searched(steps):
        return DecideAction(tool="search_docs", args={"query": goal_q}, reason="platform_docs")

    unread_docs = _unread_path_hits(mission, "doc_hit")
    if unread_docs:
        return DecideAction(
            tool="read_path",
            args={"path": unread_docs[0].ref},
            reason="read_doc_hit",
        )

    if wants_code and not _code_searched(steps):
        return DecideAction(tool="search_code", args={"query": goal_q}, reason="code_probe")

    unread_code = _unread_path_hits(mission, "code_hit")
    if unread_code:
        return DecideAction(
            tool="read_path",
            args={"path": unread_code[0].ref},
            reason="read_code_hit",
        )

    if not _web_done(steps) and not _has_substantive_evidence(mission):
        return DecideAction(tool="web_search", args={"query": goal_q}, reason="library_miss_web_fallback")

    abort = _after_fetch_fail_abort(mission)
    if abort is not None:
        return abort

    deepen = _maybe_fetch_url(mission)
    if deepen is not None and _web_done(steps):
        return deepen

    py = _maybe_run_python(mission)
    if py is not None:
        return py

    diag = _maybe_generate_diagram(mission)
    if diag is not None:
        return diag

    exp = _maybe_export_file(mission)
    if exp is not None:
        return exp

    fin = _maybe_calculate_finance(mission)
    if fin is not None:
        return fin

    swot = _maybe_swot_analysis(mission)
    if swot is not None:
        return swot

    risk = _maybe_risk_assessment(mission)
    if risk is not None:
        return risk

    bench = _maybe_competitor_benchmark(mission)
    if bench is not None:
        return bench

    road = _maybe_timeline_roadmap(mission)
    if road is not None:
        return road

    comp = _maybe_verify_compliance(mission)
    if comp is not None:
        return comp

    stats = _maybe_aggregate_statistics(mission)
    if stats is not None:
        return stats

    html = _maybe_export_html(mission)
    if html is not None:
        return html

    ent = _maybe_extract_entities(mission)
    if ent is not None:
        return ent

    tbl = _maybe_extract_table(mission)
    if tbl is not None:
        return tbl

    if _has_substantive_evidence(mission):
        return rewrite_premature_finish(mission, reason="enough_evidence")

    if _web_done(steps) or _library_searched(steps) or _docs_searched(steps):
        return DecideAction(
            tool="block",
            args={"reason": "no usable evidence after search"},
            reason="no_hits",
        )

    return DecideAction(
        tool="block",
        args={"reason": "unable to progress"},
        reason="stuck",
    )


def guard_llm_action(mission: MissionSnapshot, action: DecideAction) -> DecideAction:
    """Rewrite unsafe LLM picks — library-first, web cap, no platform spam on market goals."""
    goal_q = tokenize_goal(mission.goal)
    wants_net = _wants_external(mission.goal)
    wants_plat = _wants_platform(mission.goal)
    tool = action.tool

    if not _library_searched(mission.steps) and tool in {
        "web_search",
        "fetch_url",
        "save_to_library",
        "search_docs",
        "search_code",
        "read_path",
        "finish",
        "block",
    }:
        logger.info("[STEP] kursorina_guard force_library was=%s", tool)
        return DecideAction(
            tool="search_library",
            args={"query": goal_q},
            reason="guard_library_first",
        )

    unread_lib = _unread_library_hits(mission)
    # Market/external goals: allow tool switch to web without reading every library hit.
    if unread_lib and not wants_net and tool in {"web_search", "fetch_url", "search_docs", "search_code", "finish"}:
        return DecideAction(
            tool="read_content",
            args={"content_id": unread_lib[0].ref},
            reason="guard_read_library_before_web",
        )

    if tool == "search_library":
        q = str(action.args.get("query") or goal_q)[:400]
        thrash = _library_query_already_done(mission, q) or _empty_library_streak(mission) >= 3
        if thrash:
            rewrite = _rewrite_library_thrash(mission)
            if rewrite is not None:
                logger.info(
                    "[STEP] kursorina_guard library_thrash streak=%s q_chars=%s",
                    _empty_library_streak(mission),
                    len(q),
                )
                return rewrite
            logger.info("[STEP] kursorina_guard library_thrash_block streak=%s", _empty_library_streak(mission))
            if _has_substantive_evidence(mission):
                return rewrite_premature_finish(mission, reason="guard_library_thrash_finish")
            return DecideAction(
                tool="block",
                args={"reason": "library search exhausted without usable hits"},
                reason="guard_library_thrash_block",
            )
        return DecideAction(
            tool="search_library",
            args={"query": q},
            reason=_normalize_reason(action.reason, "search_library"),
        )

    if tool == "fetch_url":
        abort = _after_fetch_fail_abort(mission)
        if abort is not None:
            return abort
        internal = _internal_probe_action(mission)
        if internal is not None:
            logger.info("[STEP] kursorina_guard switch_fetch_to_internal tool=%s", internal.tool)
            return internal
        if _needs_web_channel(mission):
            switch = _maybe_switch_to_facet_web(mission)
            if switch is not None:
                logger.info("[STEP] kursorina_guard switch_fetch_to_facet_web")
                return switch
        url = str(action.args.get("url") or "").strip()
        allowed = {u for u in _unfetched_web_urls(mission)} | {
            str(e.ref).strip() for e in mission.evidence if e.kind == "web" and str(e.ref or "").startswith("http")
        }
        if not url or url not in allowed:
            deepen = _maybe_fetch_url(mission)
            if deepen is not None:
                return deepen
            if _has_substantive_evidence(mission):
                return rewrite_premature_finish(mission, reason="guard_fetch_invalid_finish")
            return heuristic_decide(mission)
        if _fetch_url_count(mission.steps) >= fetch_url_limit(mission):
            if _needs_web_channel(mission):
                switch = _maybe_switch_to_facet_web(mission)
                if switch is not None:
                    return switch
            py = _maybe_run_python(mission)
            if py is not None:
                return py
            if _has_substantive_evidence(mission):
                return rewrite_premature_finish(mission, reason="guard_fetch_cap_finish")
            return heuristic_decide(mission)
        return DecideAction(tool="fetch_url", args={"url": url[:500]}, reason=action.reason or "llm_fetch")

    if tool == "web_search" and web_budget_exhausted(mission):
        return rewrite_premature_finish(mission, reason="guard_web_cap_finish")

    if tool == "web_search" and not web_budget_exhausted(mission):
        internal = _internal_probe_action(mission)
        if internal is not None:
            logger.info("[STEP] kursorina_guard web_to_internal tool=%s", internal.tool)
            return internal
        if not _needs_web_channel(mission):
            return rewrite_premature_finish(mission, reason="guard_web_not_needed")
        # Prefer facet query when LLM sent a vague/duplicate goal dump.
        facet = _facet_web_action(mission)
        if facet is not None:
            llm_q = clean_web_search_query(str(action.args.get("query") or ""))
            facet_q = clean_web_search_query(str(facet.args.get("query") or ""))
            if not llm_q or llm_q == goal_intent_text(mission.goal)[:400] or len(llm_q) > 220:
                return facet
            if facet_q and llm_q.casefold() == facet_q.casefold():
                return facet
        q = clean_web_search_query(str(action.args.get("query") or mission.goal))
        if _web_query_already_done(mission, q):
            deepen = _maybe_fetch_url(mission)
            if deepen is not None:
                logger.info("[STEP] kursorina_guard web_search_dedupe_to_deepen")
                return DecideAction(
                    tool="fetch_url",
                    args=deepen.args,
                    reason="web_search_dedupe",
                )
            if facet is not None:
                facet_q = clean_web_search_query(str(facet.args.get("query") or ""))
                if not _web_query_already_done(mission, facet_q):
                    return DecideAction(
                        tool="web_search",
                        args={"query": facet_q},
                        reason="web_search_dedupe",
                    )
            py = _maybe_run_python(mission)
            if py is not None:
                return py
            if _has_substantive_evidence(mission):
                return rewrite_premature_finish(mission, reason="web_search_dedupe")
            return heuristic_decide(mission)
        return DecideAction(tool="web_search", args={"query": q}, reason=action.reason or "llm_web")

    if tool == "search_docs" and not wants_plat:
        # Never platform docs without explicit cue (mission 2edb5d9b).
        if wants_net and not web_budget_exhausted(mission):
            return DecideAction(
                tool="web_search",
                args={"query": goal_intent_text(mission.goal)[:400]},
                reason="guard_skip_docs_use_web",
            )
        deepen = _maybe_fetch_url(mission)
        if deepen is not None:
            return deepen
        if _has_substantive_evidence(mission):
            return rewrite_premature_finish(mission, reason="guard_skip_docs_finish")
        if not _web_done(mission.steps):
            return DecideAction(
                tool="web_search",
                args={"query": goal_intent_text(mission.goal)[:400]},
                reason="guard_skip_docs_web_fallback",
            )
        return DecideAction(
            tool="block",
            args={"reason": "no platform docs path without cue"},
            reason="guard_skip_docs_block",
        )

    if tool in {"search_code", "read_path"} and (wants_net or not wants_plat):
        if web_budget_exhausted(mission) and _has_substantive_evidence(mission):
            deepen = _maybe_fetch_url(mission)
            if deepen is not None:
                return deepen
            return rewrite_premature_finish(mission, reason="guard_skip_platform_finish")
        if not web_budget_exhausted(mission):
            return DecideAction(
                tool="web_search",
                args={"query": goal_intent_text(mission.goal)[:400]},
                reason="guard_skip_platform_use_web",
            )
        return DecideAction(
            tool="block",
            args={"reason": "no platform path for external goal"},
            reason="guard_skip_platform_block",
        )

    if tool == "save_to_library":
        # Mid-loop save is never trusted (mission 2edb5d9b): facet web → deepen →
        # finish → post-synthesize autosave when the goal asked to write a file.
        if _already_saved_library(mission.steps):
            if _has_substantive_evidence(mission):
                return rewrite_premature_finish(mission, reason="guard_save_already_done")
            return heuristic_decide(mission)
        switch = _maybe_switch_to_facet_web(mission)
        if switch is not None:
            logger.info("[STEP] kursorina_guard defer_save_to_facet_web")
            return switch
        deepen = _maybe_fetch_url(mission)
        if deepen is not None:
            logger.info("[STEP] kursorina_guard defer_save_to_deepen")
            return deepen
        if _has_substantive_evidence(mission):
            logger.info("[STEP] kursorina_guard defer_save_to_finish")
            return rewrite_premature_finish(mission, reason="guard_defer_save_to_finish")
        return heuristic_decide(mission)

    if tool == "finish" and not _has_substantive_evidence(mission):
        return heuristic_decide(mission)

    if tool == "finish":
        return rewrite_premature_finish(mission, reason=action.reason or "llm_finish")

    if tool == "run_python":
        if _python_done(mission.steps) and _png_saved(mission) and _has_substantive_evidence(mission):
            return rewrite_premature_finish(mission, reason="guard_python_already_done")
        if str(action.args.get("code") or action.args.get("script") or "").strip() or not _python_available(mission):
            return DecideAction(
                tool="block",
                args={"reason": "Custom Python execution is unavailable; only supported built-in models can run."},
                reason="python_execution_unavailable",
            )
        return DecideAction(
            tool="run_python",
            args={"code": ""},
            reason=action.reason or "llm_python",
        )

    if tool == "generate_diagram":
        code = str(action.args.get("code") or action.args.get("diagram") or "")
        title = str(action.args.get("title") or "")
        dtype = str(action.args.get("diagram_type") or "flowchart")
        if not code.strip():
            topic = tokenize_goal(mission.goal)[:60]
            code = f"flowchart TD\n  A[{topic}] --> B[Сбор данных]\n  B --> C[Результаты]"
        return DecideAction(
            tool="generate_diagram",
            args={"code": code, "title": title, "diagram_type": dtype},
            reason=action.reason or "llm_diagram",
        )

    if tool == "extract_table_data":
        data = str(action.args.get("data") or action.args.get("table") or "")
        title = str(action.args.get("title") or "")
        if not data.strip():
            data = "Категория | Значение\nПараметр_1 | 100\nПараметр_2 | 200"
        return DecideAction(
            tool="extract_table_data",
            args={"data": data, "title": title},
            reason=action.reason or "llm_table",
        )

    if tool == "export_file":
        fname = str(action.args.get("filename") or action.args.get("name") or "export.csv")
        content = str(action.args.get("content") or action.args.get("text") or "")
        return DecideAction(
            tool="export_file",
            args={"filename": fname, "content": content},
            reason=action.reason or "llm_export",
        )

    if tool == "knowledge_base_search":
        q = str(action.args.get("query") or tokenize_goal(mission.goal))[:400]
        return DecideAction(
            tool="knowledge_base_search",
            args={"query": q, "barrel_id": str(action.args.get("barrel_id") or "")},
            reason=action.reason or "llm_kbsew",
        )

    if tool == "search_projects":
        q = str(action.args.get("query") or tokenize_goal(mission.goal))[:400]
        return DecideAction(
            tool="search_projects",
            args={"query": q, "status": str(action.args.get("status") or "")},
            reason=action.reason or "llm_projects",
        )

    if tool == "search_companies":
        if _companies_done(mission.steps):
            logger.info("[STEP] kursorina_guard companies_already_probed")
            if not any(e.kind == "company" for e in mission.evidence) and not web_budget_exhausted(mission):
                q = str(action.args.get("query") or "").strip()
                if not q or q == tokenize_goal(mission.goal)[:400]:
                    q = _company_query(mission.goal)
                if q:
                    return DecideAction(
                        tool="web_search",
                        args={"query": f"{q} деятельность продукты стек"[:400]},
                        reason="company_web_search",
                    )
            deliver = facet_deliverable_action(mission)
            if deliver is not None:
                return deliver
            switch = _maybe_switch_to_facet_web(mission)
            if switch is not None:
                return switch
            return rewrite_premature_finish(mission, reason="companies_already_probed")
        q = str(action.args.get("query") or tokenize_goal(mission.goal))[:400]
        return DecideAction(
            tool="search_companies",
            args={"query": q, "industry": str(action.args.get("industry") or "")},
            reason=action.reason or "llm_companies",
        )

    if tool == "calculate_financial_metrics":
        m_type = str(action.args.get("metric_type") or "all")
        inputs = dict(action.args.get("inputs") or action.args)
        return DecideAction(
            tool="calculate_financial_metrics",
            args={"metric_type": m_type, "inputs": inputs},
            reason=action.reason or "llm_finance",
        )

    if tool == "swot_matrix_analysis":
        subj = str(action.args.get("subject") or action.args.get("topic") or tokenize_goal(mission.goal)[:60])
        return DecideAction(
            tool="swot_matrix_analysis",
            args={
                "subject": subj,
                "strengths": action.args.get("strengths"),
                "weaknesses": action.args.get("weaknesses"),
                "opportunities": action.args.get("opportunities"),
                "threats": action.args.get("threats"),
            },
            reason=action.reason or "llm_swot",
        )

    if tool == "export_executive_html":
        title = str(action.args.get("title") or "Аналитическое досье")
        content = str(action.args.get("content") or action.args.get("text") or "")
        return DecideAction(
            tool="export_executive_html",
            args={"title": title, "content": content, "subtitle": str(action.args.get("subtitle") or "")},
            reason=action.reason or "llm_html",
        )

    if tool == "extract_key_entities":
        text = str(action.args.get("text") or action.args.get("content") or "")
        cats = action.args.get("categories") if isinstance(action.args.get("categories"), list) else None
        return DecideAction(
            tool="extract_key_entities",
            args={"text": text, "categories": cats},
            reason=action.reason or "llm_entities",
        )

    if tool == "risk_matrix_assessment":
        subj = str(action.args.get("subject") or action.args.get("topic") or tokenize_goal(mission.goal)[:60])
        risks = action.args.get("risks") if isinstance(action.args.get("risks"), list) else None
        return DecideAction(
            tool="risk_matrix_assessment",
            args={"subject": subj, "risks": risks},
            reason=action.reason or "llm_risk",
        )

    if tool == "competitor_benchmark_matrix":
        if not ledger_ready_for_editorial(mission) and not _benchmark_done(mission.steps):
            deepen = _maybe_fetch_url(mission)
            if deepen is not None:
                return deepen
            switch = _maybe_switch_to_facet_web(mission)
            if switch is not None:
                return switch
        subj = str(action.args.get("subject") or action.args.get("topic") or tokenize_goal(mission.goal)[:60])
        comps = action.args.get("competitors")
        crits = action.args.get("criteria") if isinstance(action.args.get("criteria"), list) else None
        scores = action.args.get("scores") if isinstance(action.args.get("scores"), dict) else None
        return DecideAction(
            tool="competitor_benchmark_matrix",
            args={"subject": subj, "competitors": comps, "criteria": crits, "scores": scores},
            reason=_normalize_reason(action.reason, "competitor_benchmark_matrix"),
        )

    if tool == "generate_timeline_roadmap":
        title = str(
            action.args.get("title")
            or action.args.get("subject")
            or f"Дорожная карта: {tokenize_goal(mission.goal)[:40]}"
        )
        phases = action.args.get("phases") if isinstance(action.args.get("phases"), list) else None
        hq = int(action.args.get("horizon_quarters") or 4)
        return DecideAction(
            tool="generate_timeline_roadmap",
            args={"title": title, "phases": phases, "horizon_quarters": hq},
            reason=action.reason or "llm_roadmap",
        )

    if tool == "verify_compliance_standards":
        standards = action.args.get("standards")
        ctx = str(action.args.get("context_text") or action.args.get("text") or "")
        return DecideAction(
            tool="verify_compliance_standards",
            args={"standards": standards, "context_text": ctx},
            reason=action.reason or "llm_compliance",
        )

    if tool == "aggregate_market_statistics":
        numbers = action.args.get("numbers") if isinstance(action.args.get("numbers"), list) else None
        unit = str(action.args.get("unit") or "руб.")
        sample_name = str(
            action.args.get("sample_name")
            or action.args.get("title")
            or f"Статистика: {tokenize_goal(mission.goal)[:30]}"
        )
        return DecideAction(
            tool="aggregate_market_statistics",
            args={"numbers": numbers, "unit": unit, "sample_name": sample_name},
            reason=action.reason or "llm_stats",
        )

    if tool == "read_content" and wants_net:
        # Market goals: never drain megabyte library hits — switch tools (83b73754).
        switch = _maybe_switch_to_facet_web(mission)
        if switch is not None:
            logger.info("[STEP] kursorina_guard skip_read_content_to_facet_web")
            return switch
        if not web_budget_exhausted(mission):
            return DecideAction(
                tool="web_search",
                args={"query": goal_intent_text(mission.goal)[:400]},
                reason="guard_skip_read_content_use_web",
            )
        deepen = _maybe_fetch_url(mission)
        if deepen is not None:
            return deepen
        if _has_substantive_evidence(mission):
            return rewrite_premature_finish(mission, reason="guard_skip_read_content_finish")
        return heuristic_decide(mission)

    return action


async def llm_decide(mission: MissionSnapshot) -> DecideAction | None:
    try:
        import httpx

        from api.core.unified_config import unified_settings
        from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json
    except ImportError:
        return None

    base = str(getattr(unified_settings, "llama_url", "") or "").strip().rstrip("/")
    # default_ai_model ← LLAMA_MODEL; llama_model attr does not exist on UnifiedConfig.
    model = str(getattr(unified_settings, "default_ai_model", "") or "").strip() or "local"
    if not base:
        return None

    from datetime import datetime

    now_utc = datetime.now(UTC)
    cur_year = now_utc.year
    date_iso = now_utc.strftime("%Y-%m-%d")

    ledger = [{"kind": e.kind, "ref": e.ref, "extract": (e.extract or "")[:500]} for e in mission.evidence[-12:]]
    recent = [{"tool": s.tool, "args": s.args, "observation": (s.observation or "")[:300]} for s in mission.steps[-10:]]
    plan = plan_public_summary(mission)
    user = json.dumps(
        {
            "current_date": date_iso,
            "current_year": cur_year,
            "goal": mission.goal,
            "wants_internet": _wants_external(mission.goal),
            "wants_folder": _wants_folder(mission.goal),
            "investigation_plan": plan,
            "web_searches_done": _web_search_count(mission.steps),
            "web_evidence": _web_evidence_count(mission),
            "max_web_searches": web_search_limit(mission),
            "evidence": ledger,
            "recent_steps": recent,
        },
        ensure_ascii=False,
    )
    timeout = httpx.Timeout(45.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            raw = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=[
                    {"role": "system", "content": _decision_system_prompt(cur_year)},
                    {"role": "user", "content": user},
                ],
                options={"temperature": 0.2, "num_predict": 700},
                timeout=timeout,
                response_format={"type": "json_object"},
            )
    except Exception as exc:  # noqa: BLE001
        logger.info("[STEP] kursorina_llm_decide_fail err=%s", type(exc).__name__)
        return None

    text = str((raw or {}).get("response") or "").strip() if isinstance(raw, dict) else str(raw or "")
    parsed = _parse_action_json(text)
    if parsed is None:
        return None
    if parsed.tool == "finish" and not _has_substantive_evidence(mission):
        return None
    return parsed


def _parse_action_json(text: str) -> DecideAction | None:
    raw = (text or "").strip()
    if not raw:
        return None
    fence = re.search(r"\{[\s\S]*\}", raw)
    blob = fence.group(0) if fence else raw
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    tool = str(data.get("tool") or "").strip()
    if tool not in _ALLOWED_TOOLS:
        return None
    args = data.get("args") if isinstance(data.get("args"), dict) else {}
    reason = _normalize_reason(str(data.get("reason") or ""), tool)
    return DecideAction(tool=tool, args=args, reason=reason)


async def decide_next(mission: MissionSnapshot) -> DecideAction:
    # Hard gate: never let LLM skip the library probe.
    if not _library_searched(mission.steps):
        return DecideAction(
            tool="search_library",
            args={"query": tokenize_goal(mission.goal)},
            reason="hard_library_first",
        )

    # Egress dead — abort before more facet SERP (production path after fetch_url fails).
    abort = _after_fetch_fail_abort(mission)
    if abort is not None:
        return abort

    # Drive internal probes first; web only when channel is needed (not SERP-by-default).
    internal = _internal_probe_action(mission)
    if internal is not None:
        last = mission.steps[-1].tool if mission.steps else ""
        if last in {
            "search_library",
            "fetch_url",
            "read_content",
            "search_companies",
            "knowledge_base_search",
            "search_docs",
            "read_path",
        }:
            return internal

    if _needs_web_channel(mission) and pending_facets(mission):
        facet = _facet_web_action(mission)
        last = mission.steps[-1].tool if mission.steps else ""
        if (
            facet is not None
            and last
            in {
                "search_library",
                "fetch_url",
                "read_content",
                "search_companies",
                "knowledge_base_search",
                "search_docs",
                "read_path",
            }
            and _internal_probe_action(mission) is None
        ):
            return facet

    # Drive analytical deliverables before LLM fallback
    deliver = facet_deliverable_action(mission)
    if deliver is not None and len(mission.steps) >= 3:
        last = mission.steps[-1].tool if mission.steps else ""
        if (
            last
            in {
                "search_library",
                "fetch_url",
                "read_content",
                "search_companies",
                "knowledge_base_search",
                "search_docs",
                "read_path",
                "web_search",
            }
            and _internal_probe_action(mission) is None
        ):
            return deliver

    llm = await llm_decide(mission)
    if llm is not None:
        return guard_llm_action(mission, llm)
    return heuristic_decide(mission)


__all__ = (
    "answer_from_evidence",
    "decide_next",
    "goal_wants_external",
    "goal_wants_library_save",
    "guard_llm_action",
    "has_substantive_evidence",
    "heuristic_decide",
    "llm_decide",
    "web_budget_exhausted",
)
