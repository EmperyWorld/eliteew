# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for web-search multi-token ranking (homonyms, marketplace noise, ЦБ).
# Invariants:
# - No live Yandex HTTP in this module.
# Related:
# - api/services/web_search_relevance.py
# - api/services/search_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime

from api.services.search_service import SEARCH_QUERY_STOPWORDS, _filter_hits_by_query_overlap
from api.services.web_search_relevance import (
    is_shopping_intent,
    rank_web_search_hits,
    tokenize_web_search_query,
)
from api.utils.llm_wall_clock_context import anchor_web_search_query_to_wall_clock


def test_tokenize_keeps_short_cb_token() -> None:
    tokens = tokenize_web_search_query("ставка ЦБ сегодня", stopwords=SEARCH_QUERY_STOPWORDS)
    assert "цб" in tokens
    assert "ставка" in tokens


def test_condense_keeps_short_cb_token() -> None:
    from api.services.search_service import _condense_search_query

    longish = (
        "расскажи подробно про ключевую ставку ЦБ и ипотеку рефинансирование "
        "после анализа затем сгенерируй отчёт " + ("x" * 40)
    )
    condensed = _condense_search_query(longish)
    assert "цб" in condensed.casefold()
    assert "ставк" in condensed.casefold() or "ключев" in condensed.casefold()


def test_rank_drops_marketplace_wrench_for_apartment_key_query() -> None:
    query = "ключ для квартиры сантехника"
    rows = [
        {
            "title": "Ключ для установке смесителя купить на OZON",
            "content": "Сантехнический ключ для смесителя",
            "url": "https://www.ozon.ru/category/klyuch-dlya-ustanovke-smesitelya/",
        },
        {
            "title": "Ключ сантехнический разводной",
            "content": "Газовый ключ для труб",
            "url": "https://tool-tech.ru/catalog/santehnicheskij-klyuch",
        },
        {
            "title": "Замена замка и ключа от квартиры сантехником",
            "content": "Мастер изготовит дубликат ключа для квартиры и поменяет замок",
            "url": "https://example-lock.ru/kvartira-kluch",
        },
    ]
    out = rank_web_search_hits(rows, query, limit=3, stopwords=SEARCH_QUERY_STOPWORDS)
    assert out
    assert "квартир" in (out[0]["title"] + out[0]["content"]).casefold()
    assert "ozon.ru" not in (out[0].get("url") or "").casefold()


def test_shopping_intent_keeps_ozon_hdmi() -> None:
    query = "OZON HDMI удлинитель цена"
    assert is_shopping_intent(query)
    rows = [
        {
            "title": "Удлинитель HDMI купить на OZON",
            "content": "HDMI удлинитель по низкой цене",
            "url": "https://www.ozon.ru/category/hdmi-udlinitel/",
        },
        {
            "title": "История HDMI стандарта",
            "content": "Технический обзор без цен",
            "url": "https://example.com/hdmi-history",
        },
    ]
    out = _filter_hits_by_query_overlap(rows, query, limit=2)
    assert out
    assert "ozon.ru" in (out[0].get("url") or "").casefold()


def test_cb_rate_prefers_key_rate_over_refinance_glossary() -> None:
    query = "ставка ЦБ март 2026 ипотека рефинансирование"
    rows = [
        {
            "title": "Ставка рефинансирования ЦБ РФ (справочник)",
            "content": "Историческая ставка рефинансирования для налогов",
            "url": "https://base.garant.ru/10180094/",
        },
        {
            "title": "Ключевая ставка 15%: что это значит для кредитов и ипотеки",
            "content": "Решение ЦБ в марте 2026 и влияние на ипотеку и рефинансирование",
            "url": "https://www.sravni.ru/text/klyuchevaya-stavka-reshenie-20-marta-2026/",
        },
    ]
    out = rank_web_search_hits(rows, query, limit=2, stopwords=SEARCH_QUERY_STOPWORDS)
    assert "ключевая" in out[0]["title"].casefold()


def test_anchor_skips_bare_price_shopping_query() -> None:
    instant = datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    q = "OZON HDMI удлинитель цена"
    assert anchor_web_search_query_to_wall_clock(q, now=instant) == q


def test_anchor_keeps_weather_month_year() -> None:
    instant = datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    anchored = anchor_web_search_query_to_wall_clock("погода Владивосток", now=instant)
    assert "2026" in anchored
    assert "август" in anchored.casefold()


def test_rank_web_search_hits_rejects_meta_howto_tutorial() -> None:
    from api.services.web_search_relevance import is_meta_howto_serp_row

    howto = {
        "title": "Хитрости эффективного поиска информации в «Гугле» и не только.",
        "content": "Skillbox media growth internet-searching-rules",
        "url": "https://skillbox.ru/media/growth/internet-searching-rules/",
    }
    useful = {
        "title": "Консервы сельдь оптом прайс 2026",
        "content": "Оптовые цены на консервированную сельдь в ритейле РФ",
        "url": "https://example.ru/fish/canned-herring-prices",
    }
    assert is_meta_howto_serp_row(howto) is True
    assert is_meta_howto_serp_row(useful) is False
    out = rank_web_search_hits(
        [howto, useful],
        "цены консервированная сельдь ритейл",
        limit=3,
        stopwords=SEARCH_QUERY_STOPWORDS,
    )
    assert all("skillbox" not in (r.get("url") or "").casefold() for r in out)
    assert any("сельдь" in (r.get("title") or "").casefold() for r in out)


def test_meta_howto_rejects_claude_help_mail_ctrlf_and_google_landing() -> None:
    from api.services.web_search_relevance import is_meta_howto_serp_row

    trash = [
        {
            "title": "Включение и использование веб-поиска | Anthropic Help Center",
            "content": "Как включить веб-поиск в Claude",
            "url": "https://support.claude.com/ru/articles/10684626-включение-и-использование-веб-поиска",
        },
        {
            "title": "Сочетание каких клавиш включает поиск слова или фразы по странице? напомните, забыл | Ответы Mail",
            "content": "Ctrl+F поиск по странице",
            "url": "https://otvet.mail.ru/question/123",
        },
        {
            "title": "Поиск информации в интернете: веб страницы, картинки, видео...",
            "content": "Google",
            "url": "https://www.google.com.ai/",
        },
    ]
    useful = {
        "title": "Рынок консервированной сельди в РФ 2026",
        "content": "Объёмы и цены на консервы из сельди",
        "url": "https://example.ru/market/canned-herring-2026",
    }
    for row in trash:
        assert is_meta_howto_serp_row(row) is True, row["title"]
    assert is_meta_howto_serp_row(useful) is False
    out = rank_web_search_hits(
        [*trash, useful],
        "рынок консервированная сельдь ритейл 2026",
        limit=5,
        stopwords=SEARCH_QUERY_STOPWORDS,
    )
    assert len(out) == 1
    assert "сельд" in out[0]["title"].casefold()


def test_soft_fail_drops_near_zero_score_trash() -> None:
    """When nothing covers the query, do not keep unrelated near-zero soft matches."""
    query = "ключевая ставка ЦБ март 2026 ипотека"
    rows = [
        {
            "title": "Рецепт борща с капустой",
            "content": "Домашняя кухня без финансов",
            "url": "https://cooking.example/borscht",
        },
        {
            "title": "Погода во Владивостоке",
            "content": "Прогноз на неделю",
            "url": "https://weather.example/vl",
        },
    ]
    out = rank_web_search_hits(rows, query, limit=3, stopwords=SEARCH_QUERY_STOPWORDS)
    assert out == []
