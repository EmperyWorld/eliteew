# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Quota-aware web-search context blocks for marketing cabinet LLM and research paths.
# Invariants:
# - No search unless web_search_quality != off (or legacy use_web_search) with user/db.
# Related:
# - api.services.marketing_web_search_quality
# - api.services.ugs.providers.imc_rag_research_provider
# ---

"""Shared marketing-cabinet web search prompt augmentation."""

from __future__ import annotations

import logging
from typing import Any

from api.schemas.marketing_web_search import WebSearchQuality
from api.services.marketing_web_search_quality import (
    WEB_SEARCH_QUALITY_TIERS,
    normalize_web_search_quality,
    web_search_enabled,
)
from api.services.search_service import (
    BEZ_SEARX_QUERY_MAX_CHARS,
    WebSearchQuotaExceededError,
    _condense_search_query,
    format_search_results_for_prompt,
    web_search,
)

logger = logging.getLogger(__name__)

_IMC_BOILERPLATE_MARKERS = (
    "опирайся только на переданные фрагменты",
    "не проси пользователя прислать файлы",
    "дополнительные вложения или url от пользователя не требуются",
    "заполнение разделов маркетингового кабинета",
)

IMC_WEB_SEARCH_TYPE_INTENT: dict[str, str] = {
    "imc_rag_competitive": "конкуренты рынок игроки бренды",
    "imc_rag_trends_signals": "тренды рынка новости регулирование",
    "imc_rag_swot": "рынок SWOT конкуренты угрозы",
    "imc_rag_jtbd": "потребители продукт альтернативы",
    "imc_rag_cabinet_analysis": "рынок отрасль компания обзор",
    "imc_rag_cx_journey": "клиентский опыт сервис touchpoints",
    "imc_rag_voice_of_customer": "отзывы потребители VoC",
    "imc_rag_positioning_messaging": "позиционирование конкуренты сообщения",
    "imc_rag_pricing_packaging_rf": "цены тарифы конкуренты упаковка",
    "imc_rag_channel_partner_rf": "каналы дистрибуция партнёры",
    "imc_rag_marketing_gtm_plan": "go-to-market конкуренты каналы запуск",
    "imc_rag_campaign_retrospective": "рекламная кампания результаты кейсы",
    "imc_rag_customer_diagnostic": "клиент диагностика потребности",
    "imc_rag_target_audience": "целевая аудитория сегменты",
    "imc_rag_value_proposition": "ценностное предложение конкуренты",
}

IMC_WEB_SEARCH_SECONDARY: dict[str, list[str]] = {
    "imc_rag_competitive": ["конкуренты Россия рынок", "аналоги продукт компании"],
    "imc_rag_trends_signals": ["тренды отрасли 2025", "регулирование рынок РФ"],
    "imc_rag_swot": ["угрозы рынка отрасль", "конкуренты сильные стороны"],
    "imc_rag_jtbd": ["альтернативы продукт потребитель", "Jobs to be done рынок"],
    "imc_rag_cabinet_analysis": ["обзор рынка отрасль", "ключевые игроки"],
    "imc_rag_cx_journey": ["customer journey best practices", "сервис стандарты отрасли"],
    "imc_rag_voice_of_customer": ["отзывы продукт рынок", "жалобы потребителей отрасль"],
    "imc_rag_positioning_messaging": ["позиционирование бренды конкуренты", "УТП рынок"],
    "imc_rag_pricing_packaging_rf": ["цены конкуренты тарифы", "прайс рынок РФ"],
    "imc_rag_channel_partner_rf": ["дистрибуция каналы партнёры", "маркетплейсы отрасль"],
    "imc_rag_marketing_gtm_plan": ["стратегия выхода на рынок", "GTM кейсы"],
    "imc_rag_campaign_retrospective": ["рекламные кампании кейсы", "медиамикс отрасль"],
    "imc_rag_customer_diagnostic": ["потребности клиентов отрасль", "боли сегмента"],
    "imc_rag_target_audience": ["целевая аудитория сегменты рынок", "портрет потребителя"],
    "imc_rag_value_proposition": ["ценностное предложение конкуренты", "дифференциация рынок"],
}

IMC_WEB_SEARCH_PROMPT_HINTS: dict[str, str] = {
    "imc_rag_competitive": (
        "Разделы про конкурентов заполняй **именами компаний/брендов из веб-среза**, если их нет во фрагментах проекта. "
        "Не пиши «конкурентов нет в материалах», пока веб-срез не пуст."
    ),
    "imc_rag_trends_signals": (
        "Тренды и риски: внешние сигналы и новости — из веб-среза; внутренние планы — из контекста проекта. "
        "Разделяй «Глобальный» и «РФ/локальный» по источнику."
    ),
    "imc_rag_swot": (
        "Угрозы и возможности рынка дополняй фактами из веб-среза; сильные/слабые стороны компании — из контекста проекта."
    ),
    "imc_rag_jtbd": (
        "Альтернативы и конкурирующие решения для клиента — из веб-среза, если нет во фрагментах; формулировки работ — из контекста."
    ),
    "imc_rag_cabinet_analysis": (
        "Внешний контекст рынка и отрасли — из веб-среза; факты о проекте/компании — только из контекста."
    ),
    "imc_rag_cx_journey": (
        "Бенчмарки сервиса и типовые touchpoints — из веб-среза; факты о текущем пути клиента — из материалов проекта."
    ),
    "imc_rag_voice_of_customer": (
        "Публичные отзывы и темы VoC с рынка — из веб-среза; интервью/опросы проекта — из контекста."
    ),
    "imc_rag_positioning_messaging": (
        "Как позиционируются конкуренты на рынке — из веб-среза; ваши сообщения и бренд — из контекста."
    ),
    "imc_rag_pricing_packaging_rf": (
        "Ориентиры цен и упаковки конкурентов — из веб-среза; ваши прайсы/КП — из контекста."
    ),
    "imc_rag_channel_partner_rf": ("Каналы и партнёры на рынке — из веб-среза; ваши договорённости — из контекста."),
    "imc_rag_marketing_gtm_plan": (
        "Кейсы GTM и каналы конкурентов — из веб-среза; ваш план и ограничения — из контекста."
    ),
    "imc_rag_campaign_retrospective": (
        "Референсы кампаний и форматов — из веб-среза; ваши метрики и материалы — из контекста."
    ),
    "imc_rag_customer_diagnostic": (
        "Отраслевой контекст потребностей — из веб-среза; ответы диагностики — из контекста."
    ),
    "imc_rag_target_audience": ("Сегменты и портреты рынка — из веб-среза; ваши гипотезы ЦА — из контекста."),
    "imc_rag_value_proposition": ("Как конкуренты формулируют ценность — из веб-среза; ваше UVP — из контекста."),
}

_IMC_WEB_SEARCH_GENERIC_HINT = (
    "Внешние факты рынка — из блока «Срез из веб-поиска»; факты о проекте — из «Контекст проекта»."
)


def imc_web_search_prompt_hint(imc_type_key: str) -> str:
    key = str(imc_type_key or "").strip()
    return IMC_WEB_SEARCH_PROMPT_HINTS.get(key, _IMC_WEB_SEARCH_GENERIC_HINT)


def is_imc_boilerplate_research_text(text: str) -> bool:
    low = str(text or "").strip().casefold()
    if not low:
        return True
    return any(marker in low for marker in _IMC_BOILERPLATE_MARKERS)


def _project_prefix(
    *,
    company_name: str,
    project_name: str,
    industry: str,
) -> str:
    tokens: list[str] = []
    company = str(company_name or "").strip()
    project = str(project_name or "").strip()
    if company:
        tokens.append(company)
    if project and project.casefold() != company.casefold():
        tokens.append(project)
    ind = str(industry or "").strip()
    if ind and ind.casefold() not in {"не указана", "—", "-", "n/a"}:
        tokens.append(ind)
    return " ".join(tokens).strip()


def build_imc_web_search_query(
    *,
    imc_type_key: str,
    project_name: str = "",
    company_name: str = "",
    industry: str = "",
    project_description: str = "",
    brief: str | None = None,
    secondary_suffix: str | None = None,
) -> str:
    prefix = _project_prefix(
        company_name=company_name,
        project_name=project_name,
        industry=industry,
    )
    parts: list[str] = []
    if prefix:
        parts.append(prefix)
    desc = " ".join(str(project_description or "").split())
    if desc:
        parts.append(desc[:140])
    if secondary_suffix:
        parts.append(secondary_suffix.strip())
    else:
        intent = IMC_WEB_SEARCH_TYPE_INTENT.get(str(imc_type_key or "").strip(), "рынок отрасль")
        parts.append(intent)
    if brief and not is_imc_boilerplate_research_text(brief):
        parts.append(brief[:120])
    query = " ".join(part for part in parts if part).strip()
    return query[:BEZ_SEARX_QUERY_MAX_CHARS]


def build_imc_web_search_queries(
    *,
    imc_type_key: str,
    quality: WebSearchQuality,
    project_name: str = "",
    company_name: str = "",
    industry: str = "",
    project_description: str = "",
    brief: str | None = None,
) -> list[str]:
    tier = WEB_SEARCH_QUALITY_TIERS[quality]
    if tier.max_queries <= 0:
        return []
    type_key = str(imc_type_key or "").strip()
    queries: list[str] = [
        build_imc_web_search_query(
            imc_type_key=type_key,
            project_name=project_name,
            company_name=company_name,
            industry=industry,
            project_description=project_description,
            brief=brief,
        )
    ]
    prefix = _project_prefix(
        company_name=company_name,
        project_name=project_name,
        industry=industry,
    )
    for suffix in IMC_WEB_SEARCH_SECONDARY.get(type_key, ["рынок отрасль обзор"]):
        if len(queries) >= tier.max_queries:
            break
        q = build_imc_web_search_query(
            imc_type_key=type_key,
            project_name=project_name,
            company_name=company_name,
            industry=industry,
            project_description="",
            brief=None,
            secondary_suffix=f"{prefix} {suffix}".strip() if prefix else suffix,
        )
        if q and q not in queries:
            queries.append(q)
    return queries[: tier.max_queries]


def build_ewrp_web_search_queries(
    *,
    topic: str,
    title: str,
    extra_context: str | None,
    quality: WebSearchQuality,
) -> list[str]:
    """Build Yandex queries for EWRP outline generation from topic/title/context."""
    from api.services.ewrp_fact_grounding import build_ewrp_web_search_queries as _build

    return _build(
        topic=topic,
        title=title,
        extra_context=extra_context,
        quality=quality,
    )


def _normalize_search_query(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    sq = _condense_search_query(text)
    if len(sq) < 6:
        sq = text[:BEZ_SEARX_QUERY_MAX_CHARS].strip()
    return sq[:BEZ_SEARX_QUERY_MAX_CHARS]


async def resolve_marketing_web_search_context(
    *,
    query: str,
    use_web_search: bool = False,
    web_search_quality: str | None = None,
    queries: list[str] | None = None,
    user_id: str | None,
    db: Any | None,
    log_prefix: str = "marketing.web_search",
    max_chars: int | None = None,
    limit: int | None = None,
) -> str:
    """Return formatted web-search block for LLM prompts, or empty string when disabled."""
    quality = normalize_web_search_quality(web_search_quality, use_web_search=use_web_search)
    if not web_search_enabled(quality):
        return ""
    if db is None or not user_id:
        logger.debug("[STEP] %s_skip reason=missing_user_context", log_prefix)
        return ""

    tier = WEB_SEARCH_QUALITY_TIERS[quality]
    search_queries: list[str] = []
    if queries:
        search_queries = [q for q in queries if str(q or "").strip()]
    elif str(query or "").strip():
        search_queries = [str(query).strip()]

    if not search_queries:
        return ""

    hits_per_query = limit if isinstance(limit, int) and limit > 0 else tier.hits_per_query
    budget = max_chars if isinstance(max_chars, int) and max_chars > 0 else tier.max_total_chars
    merged_hits: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    queries_run = 0

    for raw_q in search_queries[: tier.max_queries]:
        sq = _normalize_search_query(raw_q)
        if len(sq) < 8:
            continue
        try:
            hits = await web_search(sq, limit=hits_per_query, user_id=user_id, db=db, surface="marketing")
            queries_run += 1
        except WebSearchQuotaExceededError as exc:
            logger.info("[STEP] %s quota_denied remaining=%s", log_prefix, exc.status.total_remaining)
            break
        except Exception as exc:
            logger.warning("[STEP] %s failed err=%s query=%s", log_prefix, exc, sq[:80])
            continue
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            url = str(hit.get("url") or "").strip().casefold()
            if url:
                if url in seen_urls:
                    continue
                seen_urls.add(url)
            merged_hits.append(hit)

    if not merged_hits:
        return ""

    block = format_search_results_for_prompt(merged_hits, max_total_chars=budget)
    if block:
        logger.info(
            "[STEP] %s_used quality=%s queries_run=%s hits=%s",
            log_prefix,
            quality,
            queries_run,
            len(merged_hits),
        )
    return block


async def resolve_marketing_kbsew_context(
    *,
    query: str,
    queries: list[str] | None = None,
    db: Any | None,
    max_total_chars: int = 3500,
) -> str:
    """KBSEW prefetch for marketing cabinet when admin enabled surface ``marketing``."""

    from api.services.kbsew.kbsew_agent_runtime import resolve_kbsew_context_for_surface

    search_query = (query or "").strip()
    if not search_query and queries:
        for item in queries:
            candidate = str(item or "").strip()
            if candidate:
                search_query = candidate
                break
    if not search_query or db is None:
        return ""
    block = await resolve_kbsew_context_for_surface(
        agent_id="marketing",
        query=search_query,
        db=db,
        max_total_chars=max_total_chars,
    )
    if block:
        logger.info("[STEP] marketing_kbsew_used chars=%s", len(block))
    return block
