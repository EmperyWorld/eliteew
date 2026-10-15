# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lightweight investigation plan for Курсорина — goal facets → coverage → next query.
# Invariants:
# - Deterministic; no Desktop ensemble / research_plan templates.
# - Query / facet cues from **user intent** only — not pasted prior reports.
# - Non-deliverable facet coverage needs topic-overlapping evidence (not cue theatre).
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/fixed-errors/kursorina/2026-09-07-temporal-grounding-search-dedupe-and-render-integrity.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-temporal-search-and-render-architecture.md
# - documentation/reference/solution-readiness/2026-09-06-kursorina-intent-web-grounding.md
# ---

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC

from api.services.kursorina.models import MissionSnapshot

# Split markers: instruction prefix vs pasted attachment / prior report body.
_ATTACHMENT_SPLIT_RE = re.compile(
    r"(?is)(?:^|\n)\s*(?:"
    r"сам\s+отч[её]т\s*:|"
    r"ниже\s+(?:отч[её]т|report)\s*:|"
    r"отч[её]т\s+ниже\s*:|"
    r"ниже\s+привед[её]н\w*\s+отч[её]т\s*:|"
    r"attached\s+report\s*:|"
    r"report\s+below\s*:"
    r")\s*"
)
# Long markdown dump after a short instruction (no explicit marker).
_MARKDOWN_DUMP_RE = re.compile(r"(?s)^(.{40,480}?)\n{2,}#{1,3}\s+\S")


def goal_intent_text(goal: str, *, max_chars: int = 8000) -> str:
    """User instruction only — strip pasted reports / markdown dumps from the goal blob."""
    raw = (goal or "").strip()
    if not raw:
        return ""
    parts = _ATTACHMENT_SPLIT_RE.split(raw, maxsplit=1)
    head = (parts[0] if parts else raw).strip()
    if len(raw) > 900 and len(head) > 400:
        # Prefer explicit split; else cut before a large ATX dump.
        m = _MARKDOWN_DUMP_RE.match(raw)
        if m:
            head = m.group(1).strip()
    head = re.sub(r"\s+", " ", head).strip()
    return head[:max_chars]


def strip_markdown_decorations(text: str) -> str:
    """Strip markdown headers, bold, bullets, links to get plain semantic text."""
    s = re.sub(r"^#{1,6}\s+", "", text or "", flags=re.MULTILINE)
    s = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", s)
    s = re.sub(r"`{1,3}([^`]+)`{1,3}", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"^[-*+]\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"^\d+\.\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"[«»\"“”(){}[\]]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokenize_goal(goal: str) -> str:
    """Local copy — avoid import cycle with tools.py. Uses clean intent body."""
    clean = strip_markdown_decorations(goal_intent_text(goal or ""))
    text = re.sub(r"\s+", " ", clean.strip())
    return text[:400]


@dataclass(frozen=True)
class InvestigationFacet:
    id: str
    label: str
    goal_cues: tuple[str, ...]
    evidence_cues: tuple[str, ...]
    query_suffix: str


# Ordered investigation lanes for multi-step market / strategy goals (domain-agnostic).
_FACETS: tuple[InvestigationFacet, ...] = (
    InvestigationFacet(
        id="market",
        label="рынок и тренды",
        goal_cues=(
            "рынк",
            "рынок",
            "тренд",
            "cagr",
            "барьер",
            "прогноз",
            "объем рынка",
            "динамика рынка",
            "сегмент рынка",
        ),
        evidence_cues=("cagr", "тренд", "барьер", "market", "billion", "млрд", "прогноз", "рынк", "рынок"),
        query_suffix="размер рынка тренды барьеры отчет market size CAGR trends",
    ),
    InvestigationFacet(
        id="competitors",
        label="конкуренты",
        goal_cues=("конкурент", "лидер", "value proposition", "ценов", "тариф", "сегмент", "аналог"),
        evidence_cues=("лидер", "competitor", "pricing", "value proposition", "сегмент", "тариф"),
        query_suffix="market leaders competitors value proposition target segment pricing",
    ),
    InvestigationFacet(
        id="economics",
        label="юнит-экономика",
        goal_cues=(
            "прибыл",
            "математик",
            "расчёт",
            "расчет",
            "ltv",
            "cac",
            "churn",
            "unit",
            "burn",
            "runway",
            "arpu",
            "окупаем",
            "маржа",
            "юнит",
            "бюджет",
            "стоимост",
            "затрат",
        ),
        evidence_cues=("cac", "ltv", "churn", "arpu", "burn", "runway", "break-even", "безубыточ"),
        query_suffix="B2B SaaS CAC LTV ARPU churn benchmarks",
    ),
    InvestigationFacet(
        id="strategy",
        label="синтез и стратегия",
        goal_cues=("swot", "стратег", "вердикт", "синтез", "рекоменд"),
        evidence_cues=("swot", "strength", "weakness", "threat", "opportun", "риск"),
        query_suffix="SWOT risks opportunities critical analysis",
    ),
    InvestigationFacet(
        id="architecture",
        label="архитектура и схема",
        goal_cues=(
            "архитектур",
            "схем",
            "блок-схем",
            "диаграмм",
            "mermaid",
            "структур",
            "процесс",
            "пайплайн",
            "стек",
            "субд",
            "компонент",
            "туннел",
            "экосистем",
            "среда",
            "операционн",
            "платформ",
            "интеграц",
        ),
        evidence_cues=("flowchart", "sequence", "graph", "mermaid", "architecture", "компонент", "схема"),
        query_suffix="архитектура стек интеграция компоненты схема",
    ),
    InvestigationFacet(
        id="standards",
        label="регламенты и база знаний",
        goal_cues=(
            "регламент",
            "стандарт",
            "гост",
            "база знаний",
            "kbsew",
            "инструкци",
            "политик",
            "сертификат",
            "качества",
            "фстэк",
            "152-фз",
            "комплаенс",
            "нормативы",
            "требования",
            "импортозамещен",
            "реестр",
            "минцифр",
            "отечественн",
        ),
        evidence_cues=(
            "регламент",
            "стандарт",
            "гост",
            "kbsew",
            "положение",
            "инструкция",
            "сертификат",
            "фстэк",
            "152-фз",
        ),
        query_suffix="стандарты сертификаты ГОСТ 152-ФЗ ФСТЭК требования",
    ),
    InvestigationFacet(
        id="companies",
        label="профили организаций и вендоров",
        goal_cues=(
            "компан",
            "организац",
            "вендор",
            "поставщик",
            "холдинг",
            "клиент",
            "ооо",
            "elab",
            "е-лаб",
            "заказчик",
            "бизнес",
        ),
        evidence_cues=("компан", "организац", "отрасль", "масштаб", "юрлиц", "company", "е-лаб", "elab"),
        query_suffix="деятельность стек технологии продукты профиль",
    ),
    InvestigationFacet(
        id="risks",
        label="оценка рисков и комплаенс",
        goal_cues=(
            "риск",
            "угроз",
            "митигац",
            "безопасност",
            "комплаенс",
            "152-фз",
            "фстэк",
            "доступ",
            "ролев",
            "уязвимост",
            "надежност",
            "отказоустойчивост",
        ),
        evidence_cues=(
            "риск",
            "угроза",
            "вероятность",
            "влияние",
            "комплаенс",
            "152-фз",
            "фстэк",
            "гост",
            "безопасность",
        ),
        query_suffix="информационная безопасность риски ролевой доступ оценка",
    ),
    InvestigationFacet(
        id="roadmap",
        label="дорожная карта и сроки",
        goal_cues=(
            "roadmap",
            "дорожн",
            "карт",
            "вех",
            "этап",
            "таймлайн",
            "gantt",
            "план реализац",
            "план внедрен",
            "календарн",
        ),
        evidence_cues=("roadmap", "фаза", "квартал", "веха", "срок", "gantt", "этап"),
        query_suffix="дорожная карта этапы внедрения вехи сроки roadmap",
    ),
)

_STOP = frozenset(
    {
        "слушай",
        "нужно",
        "провести",
        "глубокое",
        "исследование",
        "для",
        "запуска",
        "твоя",
        "задача",
        "выполнить",
        "следующий",
        "алгоритм",
        "действий",
        "шаг",
        "найди",
        "выпиши",
        "представь",
        "напиши",
        "создай",
        "сохрани",
        "выдай",
        "если",
        "данные",
        "strictly",
        "follow",
        "this",
        "chain",
        "thought",
        "the",
        "and",
        "for",
        "with",
        "from",
    }
)


_TOPIC_STOP = frozenset(
    {
        "проведи",
        "провести",
        "исследуй",
        "изучи",
        "сделай",
        "построй",
        "нужно",
        "также",
        "включая",
        "подробную",
        "подробный",
        "комплексную",
        "комплексный",
        "отчет",
        "отчёт",
        "отчета",
        "отчёта",
        "анализ",
        "оценку",
        "оценка",
        "основе",
        "ниже",
        "сформируй",
        "сформировать",
        "который",
        "которые",
        "ready",
        "with",
        "from",
        "that",
        "this",
        "have",
        "your",
        "сам",
    }
)


def intent_topic_tokens(goal: str, *, max_n: int = 24) -> list[str]:
    """Meaningful tokens from intent (for overlap / synthesize filters)."""
    body = goal_intent_text(goal or "").casefold()
    raw = re.findall(r"[a-zа-яё0-9]{4,}", body, flags=re.IGNORECASE)
    out: list[str] = []
    seen: set[str] = set()
    for tok in raw:
        t = tok.casefold()
        if t in _STOP or t in _TOPIC_STOP or t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= max_n:
            break
    return out


def goal_topic_query(goal: str, *, max_chars: int = 180) -> str:
    """Compact topic string from **intent** (not pasted report / scaffolding)."""
    intent = strip_markdown_decorations(goal_intent_text(goal or ""))
    raw = tokenize_goal(intent)
    # Prefer Latin tech tokens only when the intent itself is Latin-heavy.
    cyr = len(re.findall(r"[а-яёА-ЯЁ]", intent))
    lat = len(re.findall(r"[A-Za-z]", intent))
    parts: list[str] = []
    if lat >= cyr and lat >= 8:
        tech = re.findall(
            r"(?i)\b(?:AI[\w\-]*|SaaS|logistics|supply[\s\-]?chain|autonomous|"
            r"[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){0,3})\b",
            intent,
        )
        for t in tech:
            t = re.sub(r"\s+", " ", t).strip()
            if t.casefold() not in _STOP and t not in parts:
                parts.append(t)
            if len(" ".join(parts)) >= max_chars:
                break
        if parts:
            return " ".join(parts)[:max_chars]
    toks = [t for t in re.split(r"\s+", raw) if t and t.casefold() not in _STOP]
    return " ".join(toks[:18])[:max_chars]


def facets_for_goal(goal: str) -> list[InvestigationFacet]:
    """Facets implied by **intent** text — never wipe company/standards hits with a market pack.

    Bare «бизнес» / «исследован» alone must NOT replace a company-brief plan with
    market+competitors+economics (mission e7811f9a forensic: web-bot theatre).
    """
    g = goal_intent_text(goal or "").casefold()
    hit = [f for f in _FACETS if any(cue in g for cue in f.goal_cues)]
    if hit:
        return hit
    marketish = any(
        tok in g
        for tok in (
            "рынк",
            "рынок",
            "конкурент",
            "cagr",
            "бенчмарк",
            "сегмент",
            "стартап",
            "вендор",
        )
    )
    if marketish or any(tok in g for tok in ("исследован", "исследуй", "аудит")):
        return list(_FACETS[:3])
    return hit


def _evidence_blob(mission: MissionSnapshot) -> str:
    parts: list[str] = []
    for e in mission.evidence[-24:]:
        parts.append(f"{e.kind} {e.ref} {e.extract or ''}")
    for s in mission.steps[-16:]:
        parts.append(f"{s.tool} {s.observation or ''}")
    return "\n".join(parts).casefold()


def max_intent_overlap(mission: MissionSnapshot, *, kinds: frozenset[str] | None = None) -> int:
    """Best single-evidence token overlap with intent topic tokens."""
    toks = intent_topic_tokens(mission.goal)
    if not toks:
        return 0
    allow = kinds or frozenset({"web", "library", "library_hit", "folder", "file", "kbsew"})
    best = 0
    for e in mission.evidence:
        if e.kind not in allow:
            continue
        blob = f"{e.ref or ''} {e.extract or ''}".casefold()
        hits = sum(1 for t in toks if t in blob)
        if hits > best:
            best = hits
    return best


_FINANCE_LEDGER_RE = re.compile(
    r"(?is)(?:"
    r"(?:cagr|ltv|cac\b|arpu|churn|burn\s*rate|runway|npv|roi|"
    r"выручк\w*|оборот\w*|марж\w*|стоимост\w*|бюджет\w*)"
    r".{0,40}?"
    r"(?:\d+[.,]\d+|\d{2,})"
    r"|"
    r"(?:\d+[.,]\d+|\d{2,})\s*"
    r"(?:млрд|млн|тыс\.?|₽|\brub\b|\busd\b|\$|%)"
    r")"
)


def ledger_has_finance_inputs(mission: MissionSnapshot) -> bool:
    """True when ledger has finance-context numbers — not bare years like 2024 alone."""
    return bool(_FINANCE_LEDGER_RE.search(_evidence_blob(mission)))


def ledger_ready_for_editorial(mission: MissionSnapshot) -> bool:
    """Enough on-topic substance for SWOT/risk editorial tools."""
    return max_intent_overlap(mission) >= 2


def facet_covered(mission: MissionSnapshot, facet: InvestigationFacet) -> bool:
    """True when the facet has real coverage — not SERP keyword theatre alone.

    strategy / architecture / economics / roadmap / risks require deliverable tools
    (or matching evidence kinds). market / competitors / companies / standards need
    intent-overlapping web/library evidence (not cue-hit theatre on junk SERP).
    """
    steps = mission.steps

    def _tool_ok(*names: str) -> bool:
        return any(s.tool in names and s.ok for s in steps)

    def _kind(*names: str) -> bool:
        return any(e.kind in names for e in mission.evidence)

    if facet.id == "strategy":
        return _tool_ok("swot_matrix_analysis", "risk_matrix_assessment") or _kind("swot", "risk")
    if facet.id == "architecture":
        # Real diagram or read platform docs — empty search_docs must not cover.
        if _tool_ok("generate_diagram") or _kind("diagram", "doc", "path"):
            return True
        for e in mission.evidence:
            if (
                e.kind in {"web", "table"}
                and any(
                    tok in (e.extract or "").casefold()
                    for tok in ("архитектур", "компонент", "стек", "экосистем", "туннел")
                )
                and len((e.extract or "").strip()) >= 500
            ):
                return True
        return False
    if facet.id == "economics":
        if _tool_ok("calculate_financial_metrics") or _kind("finance"):
            return True
        return goal_wants_unit_economics_default(mission.goal) and _tool_ok("run_python")
    if facet.id == "roadmap":
        return _tool_ok("generate_timeline_roadmap") or _kind("roadmap")
    if facet.id == "risks":
        return _tool_ok("risk_matrix_assessment", "verify_compliance_standards") or _kind("risk", "compliance")
    if facet.id == "companies":
        # CRM probe hit/miss covers; SERP keyword theatre alone never does.
        # Empty search_companies with ok=True = honest miss (mission 50ad606e).
        return _tool_ok("search_companies") or _kind("company")
    if facet.id == "standards":
        if _kind("compliance"):
            return True
        for e in mission.evidence:
            if e.kind == "kbsew" and len((e.extract or "").strip()) >= 200:
                return True
            if e.kind in {"doc", "path"} and len((e.extract or "").strip()) >= 200:
                return True
        return False

    # market / competitors — require topic overlap (not companies/standards)
    need = 2
    if max_intent_overlap(mission) < need:
        return False
    blob = _evidence_blob(mission)
    if not blob.strip():
        return False
    hits = sum(1 for cue in facet.evidence_cues if cue in blob)
    if facet.id == "competitors":
        return hits >= 2
    # Soft cue check: at least one facet cue OR strong overlap (≥3)
    return hits >= 1 or max_intent_overlap(mission) >= 3


def goal_wants_unit_economics_default(goal: str) -> bool:
    """True when empty run_python may use the SaaS cashflow default model."""
    return bool(
        re.search(
            r"(?is)(?:unit[\s\-]?эконом|ltv|cac\b|burn\s*rate|runway|"
            r"break[\s\-]?even|arpu|cash[\s_\-]?flow|безубыточ)",
            goal_intent_text(goal or ""),
        )
    )


def goal_wants_technical_readiness_default(goal: str) -> bool:
    """True when empty run_python should use the enterprise technical readiness & architecture scoring model."""
    if goal_wants_unit_economics_default(goal):
        return False
    return bool(
        re.search(
            r"(?is)(?:соответств\w*|техническ\w*\s+услови\w*|аудит\w*|готовност\w*|индекс\w*|"
            r"архитектур\w*|стек\w*|экосистем\w*|безопасност\w*|нагрузк\w*|tps\b|rps\b|импортозамещен\w*)",
            goal_intent_text(goal or ""),
        )
    )


def pending_facets(mission: MissionSnapshot) -> list[InvestigationFacet]:
    return [f for f in facets_for_goal(mission.goal) if not facet_covered(mission, f)]


def _extract_company_query_token(goal: str) -> str:
    m = re.search(r"(?i)(?:ооо|зао|пао|компани[яи]|организаци[яи])\s+[«\"]?([^»\"\n,;]+)[»\"]?", goal or "")
    if m:
        return m.group(0).strip('«»" ')
    m2 = re.search(r"(?i)\b([a-z0-9\-]+\.(?:ru|com|io|ai|net|org))\b", goal or "")
    if m2:
        return m2.group(1).strip()
    m3 = re.search(r"(?i)\b(?:е-лаб|elab)\b", goal or "")
    if m3:
        return "ООО Е-лаб elab.ru"
    return ""


def query_for_facet(mission: MissionSnapshot, facet: InvestigationFacet) -> str:
    from datetime import datetime

    cur_year = datetime.now(UTC).year
    recent_years = f"{cur_year - 1} {cur_year}"
    topic = goal_topic_query(mission.goal)
    if facet.id == "companies":
        comp = _extract_company_query_token(mission.goal)
        if comp:
            if any(k in mission.goal.casefold() for k in ("стек", "технолог", "субд", "язык", "ваканс", "архитектур")):
                return f"{comp} стек технологий ИТ вакансии СУБД архитектура".strip()[:400]
            return f"{comp} {facet.query_suffix}".strip()[:400]
    elif facet.id == "standards":
        return f"стандарты регламенты ГОСТ ФСТЭК 152-ФЗ {topic}".strip()[:400]
    elif facet.id == "roadmap":
        return f"дорожная карта этапы реализации вехи {topic}".strip()[:400]
    elif facet.id == "market":
        return f"{topic} {facet.query_suffix} {recent_years}".strip()[:400]
    elif facet.id == "competitors":
        return f"{topic} {facet.query_suffix} {cur_year}".strip()[:400]
    q = f"{topic} {facet.query_suffix}".strip()
    return q[:400]


def next_facet_web_query(mission: MissionSnapshot) -> str | None:
    """SERP query for the first uncovered facet, or None if plan empty/done."""
    pending = pending_facets(mission)
    if not pending:
        return None
    return query_for_facet(mission, pending[0]) or None


def plan_public_summary(mission: MissionSnapshot) -> dict[str, object]:
    facets = facets_for_goal(mission.goal)
    return {
        "facets": [
            {
                "id": f.id,
                "label": f.label,
                "covered": facet_covered(mission, f),
            }
            for f in facets
        ],
        "pending": [f.id for f in pending_facets(mission)],
        "topic": goal_topic_query(mission.goal),
    }


def requested_md_filename(goal: str) -> str | None:
    m = re.search(r"(?i)\b([A-Za-z][\w\-]*\.md)\b", goal or "")
    return m.group(1) if m else None


def requested_png_filenames(goal: str) -> list[str]:
    return re.findall(r"(?i)\b([\w\-]+\.png)\b", goal or "")


def goal_wants_python(goal: str) -> bool:
    g = goal_intent_text(goal or "").casefold()
    if requested_png_filenames(goal):
        return True
    return bool(
        re.search(
            r"(?is)(?:python|моделирован|unit[\s\-]?эконом|ltv|cac|burn\s*rate|"
            r"runway|break[\s\-]?even|график|matplotlib|скрипт|"
            r"соответств\w*|техническ\w*\s+услови\w*|аудит\w*|готовност\w*|индекс\w*|"
            r"архитектур\w*|tps\b|rps\b|бенчмарк\w*)",
            g,
        )
    )


def goal_wants_named_files(goal: str) -> bool:
    from api.services.kursorina.decide import goal_wants_library_save

    return bool(
        requested_md_filename(goal)
        or requested_png_filenames(goal)
        or goal_wants_python(goal)
        or goal_wants_library_save(goal)
    )


__all__ = (
    "InvestigationFacet",
    "facet_covered",
    "facets_for_goal",
    "goal_intent_text",
    "goal_topic_query",
    "goal_wants_named_files",
    "goal_wants_python",
    "goal_wants_technical_readiness_default",
    "goal_wants_unit_economics_default",
    "intent_topic_tokens",
    "ledger_has_finance_inputs",
    "ledger_ready_for_editorial",
    "max_intent_overlap",
    "next_facet_web_query",
    "pending_facets",
    "plan_public_summary",
    "query_for_facet",
    "requested_md_filename",
    "requested_png_filenames",
    "tokenize_goal",
)
