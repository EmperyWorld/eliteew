# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fact-grounding for EWRP: entity-focused web queries and LLM instructions that forbid invented specifics.
# Invariants:
# - Concrete numbers/addresses only from web slice or user extra_context when search is on.
# Related:
# - api.services.ewrp_service
# - api.services.marketing_web_search_context
# ---

"""EWRP anti-hallucination: search query shaping and prompt grounding rules."""

from __future__ import annotations

import re

from api.schemas.marketing_web_search import WebSearchQuality
from api.services.marketing_web_search_quality import WEB_SEARCH_QUALITY_TIERS
from api.services.search_service import BEZ_SEARX_QUERY_MAX_CHARS, _condense_search_query

# Marketing / task fluff — drop from search queries so entity+place survive condensation.
EWRP_QUERY_FLUFF_WORDS = frozenset(
    {
        "положительная",
        "положительный",
        "положительное",
        "оценка",
        "оценки",
        "рекомендация",
        "рекомендации",
        "эксперт",
        "эксперта",
        "экспертная",
        "экспертной",
        "экспертный",
        "презентация",
        "презентации",
        "анализ",
        "обзор",
        "стратегия",
        "стратегический",
        "инвестиционный",
        "инвестиционная",
        "потенциал",
        "рекомендую",
        "рекомендуем",
        "недвижимости",
        "недвижимость",
        "коммерческой",
        "коммерческая",
        "коммерческую",
        "объекта",
        "объект",
        "объекте",
        "вашего",
        "ваш",
        "вашим",
        "бизнеса",
        "бизнес",
        "города",
        "город",
        "городе",
        "рынка",
        "рынок",
        "рынке",
        "данные",
        "данных",
        "материал",
        "материалы",
        "тема",
        "теме",
        "тему",
        "слайдов",
        "слайд",
        "слайда",
    }
)

_EWRP_ENTITY_PATTERNS = (
    re.compile(r"\b([a-zа-яё0-9-]{1,24})\s+(?:бизнес[-\s]?центр|бц)\b", re.I),
    re.compile(r"\b(?:бизнес[-\s]?центр|бц)\s+([a-zа-яё0-9-]{1,24})\b", re.I),
    re.compile(r"\b([a-zа-яё]{0,3}\d+[a-zа-яё0-9-]*)\b", re.I),
    re.compile(r"«([^»]{2,80})»"),
    re.compile(r'"([^"]{2,80})"'),
)

EWRP_FACT_GROUNDING_WITH_SEARCH = """
ПРАВИЛА ДОСТОВЕРНОСТИ (обязательны, выше креативности):
- Любая конкретика (числа, даты, адреса, имена, цены, проценты, статусы, технические параметры) — ТОЛЬКО если явно есть в блоке «Срез из веб-поиска» или в «Дополнительных вводных» пользователя.
- Запрещено выдумывать цифры «для убедительности». Нет факта в источниках — формулируй нейтрально («уточняется у заказчика», «по открытым данным — см. источники») без чисел.
- Не смешивай разные сущности: если в источниках разные объекты, адреса или противоречивые факты — не склеивай в одно утверждение. При конфликте опиши расхождение или выбери одну сущность по официальному URL из среза.
- Запрещено выдумывать URL, телефоны, e-mail и названия компаний.
- На одном из последних слайдов добавь блок «Источники» с 3–6 URL из среза (как есть, без выдуманных ссылок).
- Маркетинговые обобщения без цифр допустимы, если не противоречат источникам.
""".strip()

EWRP_FACT_GROUNDING_SEARCH_EMPTY = """
ПРАВИЛА ДОСТОВЕРНОСТИ (веб-поиск не дал проверенных фактов):
- Не указывай конкретные цифры, адреса, даты, цены, площади и проценты.
- Строй презентацию как структурный план, вопросы для уточнения у заказчика и качественные тезисы без ложной точности.
- Явно не выдавай непроверенные утверждения за установленные факты.
""".strip()

EWRP_FACT_GROUNDING_NO_SEARCH = """
ПРАВИЛА ДОСТОВЕРНОСТИ (без веб-поиска):
- Не выдумывай конкретные цифры, адреса, даты и имена компаний — только то, что следует из темы и вводных пользователя.
- При нехватке данных используй нейтральные формулировки и пункты «уточнить у заказчика».
""".strip()


def _truncate_query(text: str) -> str:
    q = str(text or "").strip()
    if len(q) <= BEZ_SEARX_QUERY_MAX_CHARS:
        return q
    cut = q[:BEZ_SEARX_QUERY_MAX_CHARS]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0].strip()
    return cut or q[:BEZ_SEARX_QUERY_MAX_CHARS]


def _tokenize_for_entity(text: str) -> list[str]:
    tokens = re.findall(r"[A-Za-zА-Яа-яЁё0-9-]{2,}", str(text or "").lower())
    selected: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        if token in EWRP_QUERY_FLUFF_WORDS:
            continue
        if len(token) < 2:
            continue
        if token in seen:
            continue
        seen.add(token)
        selected.append(token)
    return selected


def extract_ewrp_entity_focus(*, topic: str, title: str) -> str:
    """Short entity phrase from user topic/title for search (not the full marketing paragraph)."""
    combined = " ".join(part for part in (str(title or "").strip(), str(topic or "").strip()) if part)
    entity_bits: list[str] = []
    for pattern in _EWRP_ENTITY_PATTERNS:
        for match in pattern.finditer(combined):
            chunk = str(match.group(1) if match.lastindex else match.group(0)).strip().lower()
            if len(chunk) >= 2 and chunk not in EWRP_QUERY_FLUFF_WORDS:
                entity_bits.append(chunk)

    tokens = _tokenize_for_entity(combined)

    parts: list[str] = []
    if entity_bits:
        parts.extend(entity_bits[:2])
    parts.extend(tokens[:8])

    deduped: list[str] = []
    seen: set[str] = set()
    for part in parts:
        key = part.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(part)

    focus = " ".join(deduped).strip()
    if len(focus) >= 8:
        return focus
    return _condense_search_query(combined)


def build_ewrp_web_search_queries(
    *,
    topic: str,
    title: str,
    extra_context: str | None,
    quality: WebSearchQuality,
) -> list[str]:
    """Entity-focused Yandex queries for EWRP (avoid generic marketing paragraph noise)."""
    tier = WEB_SEARCH_QUALITY_TIERS[quality]
    if tier.max_queries <= 0:
        return []

    entity_focus = extract_ewrp_entity_focus(topic=topic, title=title)
    queries: list[str] = []

    primary = _truncate_query(entity_focus)
    if len(primary) >= 8:
        queries.append(primary)

    if tier.max_queries >= 2 and entity_focus:
        secondary = _truncate_query(f"{entity_focus} официальный сайт характеристики")
        if secondary not in queries and len(secondary) >= 8:
            queries.append(secondary)

    if tier.max_queries >= 3 and entity_focus:
        tertiary = _truncate_query(f"{entity_focus} ключевые факты обзор")
        if tertiary not in queries and len(tertiary) >= 8:
            queries.append(tertiary)

    if not queries:
        head = " ".join(part for part in (str(title or "").strip(), str(topic or "").strip()) if part).strip()
        fallback = _truncate_query(_condense_search_query(head))
        if len(fallback) >= 8:
            queries.append(fallback)

    return queries[: tier.max_queries]


def build_ewrp_fact_grounding_block(*, web_search_enabled: bool, web_block: str) -> str:
    """LLM instructions block appended to EWRP additional_context."""
    if web_search_enabled:
        if web_block.strip():
            return EWRP_FACT_GROUNDING_WITH_SEARCH
        return EWRP_FACT_GROUNDING_SEARCH_EMPTY
    return EWRP_FACT_GROUNDING_NO_SEARCH


def build_ewrp_web_search_prompt_section(web_block: str) -> str:
    """Wrap formatted search hits with strict usage header."""
    body = web_block.strip()
    if not body:
        return ""
    return (
        "Срез из веб-поиска (единственный источник внешних фактов для outline; "
        "каждый URL — отдельный источник; при конфликте фактов не объединяй разные сущности):\n" + body
    )


def ewrp_grounded_llm_temperatures(*, web_search_enabled: bool) -> tuple[float, float]:
    """Lower slide temperature when facts must follow search slice."""
    if web_search_enabled:
        return 0.35, 0.25
    return 0.4, 0.7
