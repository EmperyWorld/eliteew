# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for Курсорина path allowlist + heuristic decide + library/web tools.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.kursorina.decide import heuristic_decide
from api.services.kursorina.jobs import max_global, max_per_user
from api.services.kursorina.models import (
    EvidenceItem,
    MissionSnapshot,
    StepItem,
    progress_message,
    to_public_view,
)
from api.services.kursorina.paths import is_path_allowed, monorepo_root
from api.services.kursorina.runtime import ToolRuntime
from api.services.kursorina.tools import run_tool, tool_web_search


def test_capacity_env_defaults() -> None:
    assert max_per_user() >= 1
    assert max_global() >= max_per_user()


def test_public_view_hides_tool_steps() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-pub",
        principal_id="u1",
        goal="Найти брендбук",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="x", ok=True)],
        evidence=[
            EvidenceItem(id="e1", kind="doc_hit", ref="documentation/x.md", extract="hit"),
            EvidenceItem(id="e2", kind="web", ref="https://example.com/b", extract="brand"),
            EvidenceItem(id="e3", kind="file", ref="documentation/x.md", extract="text"),
            EvidenceItem(id="e4", kind="library", ref="cid-1", extract="Brandbook\ncolors"),
            EvidenceItem(id="e5", kind="library_hit", ref="cid-2", extract="Logo pack\nsnippet"),
        ],
        created_at=now,
        updated_at=now,
    )
    view = to_public_view(m)
    dumped = view.model_dump()
    assert "steps" not in dumped
    assert view.progress.startswith("Собираю")
    assert all(r.kind != "doc_hit" for r in view.results)
    assert any(r.kind == "web" for r in view.results)
    assert any(r.kind == "file" for r in view.results)
    assert any(r.kind == "library" and r.title == "Brandbook" for r in view.results)
    assert any(r.kind == "library_hit" for r in view.results)


def test_progress_queued_and_cancelled() -> None:
    now = "2026-09-05T00:00:00+00:00"
    base = dict(
        id="m-p",
        principal_id="u1",
        goal="g",
        steps=[],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    assert "очереди" in progress_message(MissionSnapshot(status="queued", **base)).lower()
    assert "тменено" in progress_message(MissionSnapshot(status="cancelled", **base)).lower()


def test_path_allowlist_docs_ok() -> None:
    assert is_path_allowed("documentation/product/desktop/KURSORINA.md")
    assert is_path_allowed("shared/apps/kursorina/app.manifest.yaml")
    assert is_path_allowed("shared/api/services/kursorina/tools.py")
    assert is_path_allowed("shared/api/routers/kursorina.py")


def test_path_allowlist_denies_secrets() -> None:
    assert not is_path_allowed("docker/env_file/.env.stack0.backend")
    assert not is_path_allowed("keys/something.pem")
    assert not is_path_allowed("trash/20260101/foo.md")
    assert not is_path_allowed("../etc/passwd")


def test_monorepo_root_has_documentation() -> None:
    root = monorepo_root()
    assert (root / "documentation").is_dir()
    assert (root / "shared" / "api").is_dir()


def test_heuristic_library_then_read_then_finish() -> None:
    now = "2026-09-05T00:00:00+00:00"
    cid = "11111111-1111-1111-1111-111111111111"
    m = MissionSnapshot(
        id="m1",
        principal_id="u1",
        goal="Найди брендбук в моей библиотеке",
        status="running",
        created_at=now,
        updated_at=now,
    )
    a1 = heuristic_decide(m)
    assert a1.tool == "search_library"

    m.steps.append(StepItem(index=0, tool="search_library", args={"query": "брендбук"}, observation="hits", ok=True))
    m.evidence.append(
        EvidenceItem(
            id="e1",
            kind="library_hit",
            ref=cid,
            extract="Brandbook\nlogo colors",
        )
    )
    a2 = heuristic_decide(m)
    assert a2.tool == "read_content"
    assert a2.args.get("content_id") == cid

    m.steps.append(
        StepItem(
            index=1,
            tool="read_content",
            args={"content_id": cid},
            observation="read",
            ok=True,
        )
    )
    m.evidence.append(
        EvidenceItem(
            id="e2",
            kind="library",
            ref=cid,
            extract="Brandbook\nPrimary color #0A0A0A",
        )
    )
    a3 = heuristic_decide(m)
    assert a3.tool == "finish"
    assert a3.args.get("answer") in (None, "")


def test_heuristic_library_miss_then_platform_docs() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m1b",
        principal_id="u1",
        goal="Прочитай канон Курсорины в documentation",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="library hits=0", ok=True)],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "search_docs"
    assert a.reason == "platform_docs"


def test_heuristic_library_miss_tries_web_before_block() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m2",
        principal_id="u1",
        goal="несуществующее_шшш_xyz",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="library hits=0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "web_search"
    assert a.reason == "library_miss_web_fallback"
    assert a.tool != "search_docs"


def test_heuristic_blocks_after_web_and_library_empty() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m3",
        principal_id="u1",
        goal="несуществующее_шшш_xyz",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="library hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="empty", ok=False),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "block"


def test_heuristic_market_goal_web_after_library_probe() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m4",
        principal_id="u1",
        goal="Топ-5 метрик рынка EdTech в России с источниками",
        status="running",
        created_at=now,
        updated_at=now,
    )
    a0 = heuristic_decide(m)
    assert a0.tool == "search_library"
    assert a0.reason == "library_probe_before_web"

    m.steps.append(StepItem(index=0, tool="search_library", args={}, observation="no hits", ok=True))
    a1 = heuristic_decide(m)
    assert a1.tool == "web_search"
    # Market goals must NOT force-read library before web (tool switching).
    assert a1.tool != "read_content"
    assert a1.tool != "search_docs"


def test_external_goal_skips_forced_library_read_with_hits() -> None:
    """Mission 83b73754 class: library hit must not block web switch."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-sw",
        principal_id="u1",
        goal=(
            "Исследование рынка: анализ конкурентов Level Kitchen и My Food, "
            "тарифы, динамика цен на авокадо, расчёт прибыли, стратегия"
        ),
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="hits=1", ok=True)],
        evidence=[
            EvidenceItem(
                id="h1",
                kind="library_hit",
                ref="2a4c6c67-ba4d-4230-97fc-09010382eaa4",
                extract="сервис: обслуживание",
            )
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="web_search", args={"query": "x"}, reason="llm"))
    assert out.tool == "web_search"
    assert out.reason != "guard_read_library_before_web"

    h = heuristic_decide(m)
    assert h.tool == "web_search"
    assert h.tool != "read_content"


def test_facet_plan_continues_web_past_two_searches() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-plan",
        principal_id="u1",
        goal=(
            "Анализ конкурентов Level Kitchen и My Food, тарифы, "
            "динамика цен на авокадо и киноа, расчёт прибыли и стратегия"
        ),
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "a"}, observation="hits=1", ok=True),
            StepItem(index=2, tool="web_search", args={"query": "b"}, observation="hits=1", ok=True),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://levelkitchen.com/", extract="Level Kitchen программы"),
        ],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "web_search"
    assert a.reason == "facet_web"
    q = (a.args.get("query") or "").casefold()
    # Must stay on goal topic — never the retired meal-kit / ЗОЖ hardcode vertical.
    assert "зож" not in q
    assert "competitor" in q or "leader" in q or "level" in q or "cac" in q or "kitchen" in q
    # Avocado may appear only because it is in the user goal — not as a fixed vertical.


def test_guard_finish_switches_to_pending_facet_web() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-fin",
        principal_id="u1",
        goal="Анализ конкурентов Level Kitchen My Food тарифы и динамика цен авокадо",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "a"}, observation="ok", ok=True),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://levelkitchen.com/", extract="Level Kitchen")],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="finish", args={}, reason="llm"))
    # Deepen existing SERP before another facet web spam.
    assert out.tool in {"fetch_url", "web_search"}


def test_goal_topic_query_avoids_meal_kit_hardcode() -> None:
    from api.services.kursorina.models import MissionSnapshot
    from api.services.kursorina.plan import facets_for_goal, goal_topic_query, query_for_facet

    goal = (
        "Глубокое исследование AI-агентов для логистики: рынок, CAGR, "
        "конкуренты, Python unit-экономика, cash_flow_forecast.png, "
        "Market_Intelligence_Report.md"
    )
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-topic",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        created_at=now,
        updated_at=now,
    )
    topic = goal_topic_query(goal).casefold()
    assert "logistic" in topic or "ai" in topic
    facets = facets_for_goal(goal)
    assert len(facets) >= 2
    q = query_for_facet(m, facets[0]).casefold()
    assert "зож" not in q
    assert "logistic" in q or "ai" in q


def test_heuristic_runs_python_before_finish_on_model_goal() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-py",
        principal_id="u1",
        goal="SaaS unit-экономика LTV CAC Python график cash_flow_forecast.png и Market_Intelligence_Report.md",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            *[
                StepItem(
                    index=i,
                    tool="web_search",
                    args={"query": f"q{i}"},
                    observation="ok",
                    ok=True,
                )
                for i in range(1, 7)
            ],
            StepItem(index=7, tool="fetch_url", args={"url": "https://ex.com/1"}, observation="ok", ok=True),
            StepItem(index=8, tool="fetch_url", args={"url": "https://ex.com/2"}, observation="ok", ok=True),
            StepItem(index=9, tool="fetch_url", args={"url": "https://ex.com/3"}, observation="ok", ok=True),
            StepItem(index=10, tool="fetch_url", args={"url": "https://ex.com/4"}, observation="ok", ok=True),
            StepItem(index=11, tool="fetch_url", args={"url": "https://ex.com/5"}, observation="ok", ok=True),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://ex.com/1", extract="CAC $600 LTV SaaS logistics AI"),
            EvidenceItem(id="w2", kind="web", ref="https://ex.com/2", extract="market CAGR logistics"),
            EvidenceItem(id="w3", kind="web", ref="https://ex.com/3", extract="competitor pricing leader"),
            EvidenceItem(id="w4", kind="web", ref="https://ex.com/4", extract="churn ARPU benchmarks"),
            EvidenceItem(id="w5", kind="web", ref="https://ex.com/5", extract="burn rate runway"),
        ],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    # Economics pending until finance/python deliverable — not more SERP after cap.
    assert a.tool in {"run_python", "calculate_financial_metrics"}
    assert a.tool != "finish"


def test_run_python_default_model_builds_png_bytes() -> None:
    from api.services.kursorina.python_tool import _draw_line_png, default_unit_economics_code

    code = default_unit_economics_code(cac=600, arpu=150, churn=0.05, invest=500_000, opex=40_000)
    assert "save_png" in code
    png = _draw_line_png(xs=[1.0, 2.0, 3.0], ys=[100.0, 90.0, 80.0], title="t")
    assert png[:8] == b"\x89PNG\r\n\x1a\n"


def test_heuristic_market_skips_platform_docs_after_web() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m4b",
        principal_id="u1",
        goal="Топ-10 программ для ПК с аналитикой",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="hits=4", ok=True),
            StepItem(index=2, tool="web_search", args={}, observation="hits=4", ok=True),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://a.example/1", extract="Tool A — overview"),
            EvidenceItem(id="w2", kind="web", ref="https://b.example/2", extract="Tool B — review"),
        ],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "fetch_url"
    assert a.args.get("url") == "https://a.example/1"
    assert a.reason == "deepen_web"

    m.steps.append(
        StepItem(
            index=3,
            tool="fetch_url",
            args={"url": "https://a.example/1"},
            observation="ok",
            ok=True,
        )
    )
    a2 = heuristic_decide(m)
    assert a2.tool == "fetch_url"
    assert a2.args.get("url") == "https://b.example/2"

    m.steps.append(
        StepItem(
            index=4,
            tool="fetch_url",
            args={"url": "https://b.example/2"},
            observation="ok",
            ok=True,
        )
    )
    # No more unfetched URLs → finish (not platform_docs).
    a3 = heuristic_decide(m)
    assert a3.tool == "finish"
    assert a3.reason == "web_budget_enough"


def test_heuristic_profession_software_goal_is_external_no_docs() -> None:
    """Mission 2edb5d9b class: «топ программ… профессии» — not platform docs."""
    from api.services.kursorina.decide import _wants_external

    goal = "Сформируй топ программ для десктопа, разные профессии, например маркетологи, топ менеджмент, бухгалтера"
    assert _wants_external(goal)
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-2edb",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="library hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="web hits=4", ok=True),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://ex.example/a", extract="Accounting tools list"),
        ],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool != "search_docs"
    assert a.tool in {"fetch_url", "web_search", "finish"}


def test_heuristic_aborts_deepen_after_consecutive_fetch_fails() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-ff",
        principal_id="u1",
        goal="Топ-10 программ для ПК",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
            StepItem(
                index=2,
                tool="fetch_url",
                args={"url": "https://a.example/1"},
                observation="Ошибка загрузки URL:",
                ok=False,
            ),
            StepItem(
                index=3,
                tool="fetch_url",
                args={"url": "https://b.example/2"},
                observation="Ошибка загрузки URL:",
                ok=False,
            ),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://a.example/1", extract="A"),
            EvidenceItem(id="w2", kind="web", ref="https://b.example/2", extract="B"),
            EvidenceItem(id="w3", kind="web", ref="https://c.example/3", extract="C"),
        ],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "finish"
    assert a.reason == "fetch_fail_abort"
    assert a.tool != "fetch_url"


def test_guard_defers_mid_loop_save_to_finish() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-gs",
        principal_id="u1",
        goal="Топ программ для маркетологов",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://x.example/p", extract="short list")],
        created_at=now,
        updated_at=now,
    )
    # Prefer deepen over speculative save.
    out = guard_llm_action(
        m,
        DecideAction(
            tool="save_to_library",
            args={"title": "Черновик", "text": "частичный отчёт"},
            reason="llm",
        ),
    )
    assert out.tool == "fetch_url"

    m.steps.append(
        StepItem(
            index=2,
            tool="fetch_url",
            args={"url": "https://x.example/p"},
            observation="ok",
            ok=True,
        )
    )
    out2 = guard_llm_action(
        m,
        DecideAction(
            tool="save_to_library",
            args={"title": "Черновик", "text": "частичный отчёт"},
            reason="llm",
        ),
    )
    assert out2.tool == "finish"
    assert out2.reason == "guard_defer_save_to_finish"


def test_unfetched_web_urls_prefers_articles_over_marketplace() -> None:
    from api.services.kursorina.decide import _unfetched_web_urls

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-pref",
        principal_id="u1",
        goal="цены самокатов",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://www.ozon.ru/category/scooters", extract="ozon"),
            EvidenceItem(id="w2", kind="web", ref="https://www.tadviser.ru/article/scooters", extract="stats"),
            EvidenceItem(id="w3", kind="web", ref="https://wildberries.ru/catalog/x", extract="wb"),
        ],
        created_at=now,
        updated_at=now,
    )
    urls = _unfetched_web_urls(m)
    assert urls[0].startswith("https://www.tadviser.ru")
    assert any("ozon" in u for u in urls)


def test_unfetched_web_urls_skips_failed_fetch_hosts() -> None:
    from api.services.kursorina.decide import _unfetched_web_urls

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-host-skip",
        principal_id="u1",
        goal="unit economics SaaS",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "q"}, observation="hits=2", ok=True),
            StepItem(
                index=2,
                tool="fetch_url",
                args={"url": "https://saashero.io/a"},
                observation="timeout",
                ok=False,
            ),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://saashero.io/b", extract="same host"),
            EvidenceItem(id="w2", kind="web", ref="https://other.example/ok", extract="alt"),
        ],
        created_at=now,
        updated_at=now,
    )
    urls = _unfetched_web_urls(m)
    assert all("saashero.io" not in u for u in urls)
    assert any("other.example" in u for u in urls)


def test_normalize_web_search_query_collapses_case_and_space() -> None:
    from api.services.kursorina.decide import normalize_web_search_query

    assert normalize_web_search_query("  CAC  LTV  ") == "cac ltv"
    assert normalize_web_search_query("CAC LTV") == normalize_web_search_query("cac   ltv")


def test_guard_dedupes_identical_web_search_to_deepen() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-dedupe",
        principal_id="u1",
        goal="рынок EdTech РФ 2026",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={"query": "x"}, observation="0", ok=True),
            StepItem(
                index=1,
                tool="web_search",
                args={"query": "CAC LTV EdTech"},
                observation="hits=4",
                ok=True,
            ),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://a.example/article", extract="metrics"),
        ],
        created_at=now,
        updated_at=now,
        step_budget=16,
    )
    out = guard_llm_action(
        m,
        DecideAction(tool="web_search", args={"query": "  cac   ltv edtech "}, reason="llm"),
    )
    assert out.tool == "fetch_url"
    assert out.reason == "web_search_dedupe"
    assert "a.example" in str(out.args.get("url") or "")


def test_facet_web_skips_already_done_query() -> None:
    from api.services.kursorina.decide import _facet_web_action

    now = "2026-09-06T00:00:00+00:00"
    # Market goal with facet plan: after one facet query is done, next facet differs.
    m = MissionSnapshot(
        id="m-facet-dedupe",
        principal_id="u1",
        goal="исследование рынка EdTech Россия конкуренты цены",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(
                index=1,
                tool="web_search",
                args={"query": "исследование рынка EdTech Россия конкуренты цены"},
                observation="hits=3",
                ok=True,
            ),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://x.example/1", extract="hit")],
        created_at=now,
        updated_at=now,
    )
    # First call may return None (all pending facets normalize to goal) or a different facet.
    # Lock: never re-emit the exact already-done goal dump as facet_web.
    action = _facet_web_action(m)
    if action is not None:
        assert action.tool == "web_search"
        from api.services.kursorina.decide import normalize_web_search_query

        done_q = normalize_web_search_query("исследование рынка EdTech Россия конкуренты цены")
        assert normalize_web_search_query(str(action.args.get("query") or "")) != done_q


@pytest.mark.asyncio
async def test_tool_fetch_url_stores_page_extract() -> None:
    from api.services.kursorina.tools import tool_fetch_url

    with patch(
        "api.services.desktop_chat.tools.fetch_url.run_fetch_url",
        new=AsyncMock(return_value="Full page body about Tool A ranking metrics DAU"),
    ) as mocked:
        obs, ev = await tool_fetch_url("https://a.example/1", runtime=ToolRuntime())
    mocked.assert_awaited()
    assert "fetched" in obs
    assert len(ev) == 1
    assert ev[0].kind == "web"
    assert ev[0].ref.startswith("https://")
    assert "DAU" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_fetch_url_rejects_non_http() -> None:
    from api.services.kursorina.tools import tool_fetch_url

    obs, ev = await tool_fetch_url("file:///etc/passwd", runtime=ToolRuntime())
    assert "http" in obs.casefold()
    assert ev == []


def test_guard_finish_deepens_before_complete() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-gf",
        principal_id="u1",
        goal="Топ-10 софта",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://x.example/p", extract="short")],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="finish", args={}, reason="llm"))
    assert out.tool == "fetch_url"
    assert out.args.get("url") == "https://x.example/p"


def test_guard_rewrites_early_web_to_library() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-g",
        principal_id="u1",
        goal="Топ-10 софта",
        status="running",
        steps=[],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="web_search", args={"query": "x"}, reason="llm"))
    assert out.tool == "search_library"
    assert out.reason == "guard_library_first"


def test_guard_caps_web_spam() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-g2",
        principal_id="u1",
        goal="Топ-10 софта",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
            StepItem(index=2, tool="web_search", args={}, observation="ok", ok=True),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://x.example", extract="X app"),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="web_search", args={"query": "more"}, reason="llm"))
    assert out.tool == "fetch_url"
    assert out.args.get("url") == "https://x.example"


def test_structured_answer_not_ledger_dialect() -> None:
    from api.services.kursorina.synthesize import structured_user_answer

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-ans",
        principal_id="u1",
        goal="Топ-10 программ для ПК",
        status="running",
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://example.com/tools",
                extract="Лучшие программы 2026\nОбзор редакторов и утилит",
            ),
        ],
        steps=[],
        created_at=now,
        updated_at=now,
    )
    text = structured_user_answer(m)
    assert "Улики:" not in text
    assert "library=" not in text
    assert "https://example.com/tools" in text
    assert "Пробелы" in text


def test_heuristic_code_goal_searches_code_after_library() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m5",
        principal_id="u1",
        goal="Где реализован router kursorina в shared/api",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="no", ok=True),
            StepItem(index=1, tool="search_docs", args={}, observation="no", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "search_code"


def test_heuristic_folder_goal_lists_then_can_finish() -> None:
    now = "2026-09-05T00:00:00+00:00"
    cid = "22222222-2222-2222-2222-222222222222"
    m = MissionSnapshot(
        id="m6",
        principal_id="u1",
        goal="Покажи содержимое папки проектов",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True)],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "list_folder"

    m.steps.append(StepItem(index=1, tool="list_folder", args={}, observation="items=1", ok=True))
    m.evidence.append(EvidenceItem(id="f1", kind="folder", ref=cid, extract="Report · type=document"))
    a2 = heuristic_decide(m)
    assert a2.tool == "read_content"
    assert a2.args.get("content_id") == cid

    m.steps.append(StepItem(index=2, tool="read_content", args={"content_id": cid}, observation="ok", ok=True))
    m.evidence.append(EvidenceItem(id="f2", kind="library", ref=cid, extract="Report\nbody"))
    a3 = heuristic_decide(m)
    assert a3.tool == "finish"


def test_note_alone_is_not_substantive_finish() -> None:
    from api.services.kursorina.decide import has_substantive_evidence

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-note",
        principal_id="u1",
        goal="anything",
        status="running",
        evidence=[EvidenceItem(id="n1", kind="note", ref="note", extract="x" * 80)],
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="search_docs", args={}, observation="0", ok=True),
            StepItem(index=2, tool="web_search", args={}, observation="0", ok=False),
            StepItem(index=3, tool="note", args={}, observation="noted", ok=True),
        ],
        created_at=now,
        updated_at=now,
    )
    assert has_substantive_evidence(m) is False
    a = heuristic_decide(m)
    assert a.tool == "block"


@pytest.mark.asyncio
async def test_web_search_requires_runtime_session() -> None:
    obs, ev = await tool_web_search("тест запрос", runtime=ToolRuntime())
    assert "requires authenticated" in obs
    assert ev == []


@pytest.mark.asyncio
async def test_search_library_requires_user() -> None:
    from api.services.kursorina.library import tool_search_library

    obs, ev = await tool_search_library("брендбук", runtime=ToolRuntime())
    assert "authenticated" in obs
    assert ev == []


@pytest.mark.asyncio
async def test_search_library_maps_hits() -> None:
    from api.services.kursorina.library import tool_search_library

    uid = uuid4()
    cid = uuid4()
    row = MagicMock()
    row.id = cid
    row.name = "Brandbook"
    row.title = None
    row.original_filename = "brand.pdf"
    row.search_snippet = "logo colors"
    row.extracted_text = None
    row.description = None
    row.folder_item_id = "projects"
    svc = MagicMock()
    svc.list_content = AsyncMock(return_value=([row], 1))
    with patch("api.services.kursorina.library._query_service", new=AsyncMock(return_value=svc)):
        obs, ev = await tool_search_library("брендбук", runtime=ToolRuntime(user_id=uid))
    assert "library hits=1" in obs
    assert len(ev) == 1
    assert ev[0].kind == "library_hit"
    assert ev[0].ref == str(cid)
    assert "Brandbook" in ev[0].extract
    svc.list_content.assert_awaited_once()
    kwargs = svc.list_content.await_args.kwargs
    assert kwargs["user_id"] == str(uid)
    assert kwargs["search_scope"] == "hybrid"
    assert kwargs["owner_only"] is False


@pytest.mark.asyncio
async def test_read_content_acl_and_body() -> None:
    from api.services.kursorina.library import tool_read_content

    uid = uuid4()
    cid = uuid4()
    row = MagicMock()
    row.name = "Doc"
    row.title = "Title"
    row.original_filename = None
    row.extracted_text = "Hello library body " * 20
    row.description = None
    svc = MagicMock()
    svc.get_content = AsyncMock(return_value=row)
    with patch("api.services.kursorina.library._query_service", new=AsyncMock(return_value=svc)):
        obs, ev = await tool_read_content(str(cid), runtime=ToolRuntime(user_id=uid))
    assert "read ok" in obs
    assert len(ev) == 1
    assert ev[0].kind == "library"
    assert ev[0].ref == str(cid)
    svc.get_content.assert_awaited_once_with(cid, str(uid))


@pytest.mark.asyncio
async def test_run_tool_search_library_wires_runtime() -> None:
    uid = uuid4()
    runtime = ToolRuntime(user_id=uid)
    with patch(
        "api.services.kursorina.library.tool_search_library",
        new=AsyncMock(
            return_value=(
                "library hits=1",
                [EvidenceItem(id="1", kind="library_hit", ref="c", extract="x")],
            )
        ),
    ):
        obs, ev, ok = await run_tool("search_library", {"query": "q"}, runtime=runtime)
    assert ok is True
    assert len(ev) == 1
    assert "library hits" in obs


@pytest.mark.asyncio
async def test_read_content_access_denied() -> None:
    from api.services.kursorina.library import tool_read_content

    uid = uuid4()
    cid = uuid4()
    svc = MagicMock()
    svc.get_content = AsyncMock(side_effect=PermissionError("denied"))
    with patch("api.services.kursorina.library._query_service", new=AsyncMock(return_value=svc)):
        obs, ev = await tool_read_content(str(cid), runtime=ToolRuntime(user_id=uid))
    assert "access denied" in obs
    assert ev == []


@pytest.mark.asyncio
async def test_search_library_ignores_args_user_id() -> None:
    uid = uuid4()
    victim = uuid4()
    svc = MagicMock()
    svc.list_content = AsyncMock(return_value=([], 0))
    with patch("api.services.kursorina.library._query_service", new=AsyncMock(return_value=svc)):
        await run_tool(
            "search_library",
            {"query": "q", "user_id": str(victim)},
            runtime=ToolRuntime(user_id=uid),
        )
    assert svc.list_content.await_args.kwargs["user_id"] == str(uid)
    assert str(victim) not in str(svc.list_content.await_args.kwargs)


@pytest.mark.asyncio
async def test_budget_completes_with_library_evidence() -> None:
    from api.services.kursorina.loop import tick_mission

    now = "2026-09-05T00:00:00+00:00"
    cid = str(uuid4())
    mission = MissionSnapshot(
        id="m-budget-lib",
        principal_id="u1",
        goal="брендбук",
        status="running",
        step_budget=1,
        steps=[StepItem(index=0, tool="search_library", args={}, observation="hits", ok=True)],
        evidence=[EvidenceItem(id="e1", kind="library", ref=cid, extract="Brand\nbody")],
        created_at=now,
        updated_at=now,
    )
    with (
        patch("api.services.kursorina.loop.save_mission", new=AsyncMock(side_effect=lambda m: m)),
        patch(
            "api.services.kursorina.loop.synthesize_answer",
            new=AsyncMock(return_value="Кратко по цели «брендбук»:\n1. Brand\n\nПробелы:\n— тест"),
        ),
    ):
        out = await tick_mission(mission, max_steps=2)
    assert out.status == "completed"
    assert out.answer and "Улики:" not in out.answer
    assert "Brand" in (out.answer or "")


@pytest.mark.asyncio
async def test_web_search_maps_yandex_sources() -> None:
    uid = uuid4()
    db = MagicMock()
    runtime = ToolRuntime(db=db, user_id=uid, web_enabled=True)
    sources = [
        {"title": "Source A", "url": "https://example.com/a", "snippet": "metric 42"},
        {"title": "Source B", "url": "https://example.com/b", "snippet": "metric 7"},
    ]
    with (
        patch(
            "api.services.search_service.resolve_web_search_provider_for_surface",
            new=AsyncMock(return_value="yandex"),
        ),
        patch(
            "api.services.desktop_chat.tools.web_search_tool.run_web_search_with_sources",
            new=AsyncMock(return_value=("block text", sources)),
        ),
    ):
        obs, ev = await tool_web_search("рынок EdTech", runtime=runtime)
    assert "web hits=2" in obs
    assert len(ev) == 2
    assert ev[0].kind == "web"
    assert ev[0].ref.startswith("https://")


@pytest.mark.asyncio
async def test_run_tool_web_search_ok_flag() -> None:
    uid = uuid4()
    runtime = ToolRuntime(db=MagicMock(), user_id=uid)
    with patch(
        "api.services.kursorina.tools.tool_web_search",
        new=AsyncMock(return_value=("web hits=1", [EvidenceItem(id="1", kind="web", ref="u", extract="x")])),
    ):
        obs, ev, ok = await run_tool("web_search", {"query": "q"}, runtime=runtime)
    assert ok is True
    assert len(ev) == 1
    assert "web hits" in obs


@pytest.mark.asyncio
async def test_tick_mission_passes_runtime_to_web_search() -> None:
    """Integration lock: market goal → web_search receives ToolRuntime with db+user."""
    from api.services.kursorina.loop import tick_mission
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    uid = uuid4()
    db = MagicMock()
    runtime = ToolRuntime(db=db, user_id=uid, web_enabled=True)
    mission = MissionSnapshot(
        id="m-tick",
        principal_id=str(uid),
        goal="Топ-5 метрик рынка EdTech",
        status="running",
        steps=[StepItem(index=0, tool="search_docs", args={}, observation="no", ok=True)],
        evidence=[],
        created_at=now,
        updated_at=now,
        step_budget=8,
    )
    seen: dict[str, object] = {}

    async def fake_decide(m: MissionSnapshot) -> DecideAction:
        if any(s.tool == "web_search" for s in m.steps):
            return DecideAction(tool="finish", args={}, reason="done")
        return DecideAction(tool="web_search", args={"query": m.goal}, reason="internet_goal")

    async def fake_web(query: str, *, runtime: ToolRuntime | None) -> tuple[str, list[EvidenceItem]]:
        seen["db"] = runtime.db if runtime else None
        seen["user_id"] = runtime.user_id if runtime else None
        return (
            "web hits=1",
            [EvidenceItem(id="w1", kind="web", ref="https://example.com/x", extract="metric 1")],
        )

    with (
        patch("api.services.kursorina.loop.decide_next", new=fake_decide),
        patch("api.services.kursorina.tools.tool_web_search", new=fake_web),
        patch("api.services.kursorina.loop.save_mission", new=AsyncMock(side_effect=lambda m: m)),
        patch(
            "api.services.kursorina.loop.synthesize_answer",
            new=AsyncMock(return_value="Кратко: metric 1. Источник: https://example.com/x\n\nПробелы:\n— тест"),
        ),
    ):
        out = await tick_mission(mission, max_steps=3, runtime=runtime)

    assert seen.get("db") is db
    assert seen.get("user_id") == uid
    assert out.status == "completed"
    assert any(e.kind == "web" for e in out.evidence)
    assert out.answer and "Улики:" not in out.answer
    assert "https://example.com/x" in (out.answer or "")
    assert "library=" not in (out.answer or "")


@pytest.mark.asyncio
async def test_tick_honors_cancel_requested() -> None:
    from api.services.kursorina.loop import tick_mission

    now = "2026-09-05T00:00:00+00:00"
    mission = MissionSnapshot(
        id="m-cancel",
        principal_id="u1",
        goal="anything",
        status="queued",
        cancel_requested=True,
        created_at=now,
        updated_at=now,
    )
    with patch("api.services.kursorina.loop.save_mission", new=AsyncMock(side_effect=lambda m: m)):
        out = await tick_mission(mission, max_steps=3)
    assert out.status == "cancelled"
    assert out.block_reason == "cancelled by user"


def test_guard_fetch_abort_after_consecutive_fails() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-gfa",
        principal_id="u1",
        goal="Топ-10 программ для ПК",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
            StepItem(
                index=2,
                tool="fetch_url",
                args={"url": "https://a.example/1"},
                observation="err",
                ok=False,
            ),
            StepItem(
                index=3,
                tool="fetch_url",
                args={"url": "https://b.example/2"},
                observation="err",
                ok=False,
            ),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://a.example/1", extract="A"),
            EvidenceItem(id="w2", kind="web", ref="https://b.example/2", extract="B"),
            EvidenceItem(id="w3", kind="web", ref="https://c.example/3", extract="C"),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(
        m,
        DecideAction(tool="fetch_url", args={"url": "https://c.example/3"}, reason="llm"),
    )
    assert out.tool != "web_search"
    assert out.tool in {"finish", "calculate_financial_metrics", "swot_matrix_analysis", "run_python"}
    if out.tool == "finish":
        assert out.reason == "fetch_fail_abort"


@pytest.mark.asyncio
async def test_decide_next_abort_beats_facet_web_after_fetch_fails() -> None:
    """Production path: abort before more SERP when facets still pending."""
    from api.services.kursorina.decide import decide_next

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-dna",
        principal_id="u1",
        goal=("Анализ конкурентов Level Kitchen и My Food, тарифы, динамика цен на авокадо, расчёт прибыли"),
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "a"}, observation="ok", ok=True),
            StepItem(
                index=2,
                tool="fetch_url",
                args={"url": "https://a.example/1"},
                observation="err",
                ok=False,
            ),
            StepItem(
                index=3,
                tool="fetch_url",
                args={"url": "https://b.example/2"},
                observation="err",
                ok=False,
            ),
        ],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://a.example/1", extract="Level Kitchen"),
            EvidenceItem(id="w2", kind="web", ref="https://b.example/2", extract="B"),
        ],
        created_at=now,
        updated_at=now,
    )
    with patch("api.services.kursorina.decide.llm_decide", new=AsyncMock(return_value=None)):
        out = await decide_next(m)
    # May finish, deliverable, or honest block — must not spam more web_search.
    assert out.tool != "web_search"
    assert out.tool in {
        "finish",
        "block",
        "calculate_financial_metrics",
        "swot_matrix_analysis",
        "run_python",
    }
    if out.tool == "finish":
        assert out.reason == "fetch_fail_abort"
    if out.tool == "block":
        assert "incomplete" in (out.reason or "") or "incomplete" in str(out.args.get("reason") or "")


def test_guard_skips_read_content_on_external_goal() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-grc",
        principal_id="u1",
        goal="Анализ конкурентов Level Kitchen My Food тарифы и динамика цен авокадо",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="hits=1", ok=True)],
        evidence=[
            EvidenceItem(
                id="h1",
                kind="library_hit",
                ref="big-blob-id",
                extract="сервис: обслуживание",
            )
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(
        m,
        DecideAction(tool="read_content", args={"content_id": "big-blob-id"}, reason="llm"),
    )
    assert out.tool == "web_search"
    assert out.tool != "read_content"


def test_goal_wants_library_save_cues() -> None:
    from api.services.kursorina.decide import goal_wants_library_save

    assert goal_wants_library_save("Сохрани результат в файл .md")
    assert goal_wants_library_save("Write a file with the summary")
    assert not goal_wants_library_save("Топ-10 программ для ПК")


@pytest.mark.asyncio
async def test_tool_save_to_library_uses_runtime_user() -> None:
    from api.services.kursorina.library import tool_save_to_library

    uid = uuid4()
    victim = uuid4()
    created = MagicMock()
    created.id = uuid4()
    storage = MagicMock()
    storage.create_content = AsyncMock(return_value=created)

    with (
        patch("api.core.database_manager.get_asyncpg_pool", new=AsyncMock(return_value=MagicMock())),
        patch(
            "api.services.unified_content.storage_backends.factory.get_storage_factory",
            return_value=MagicMock(),
        ),
        patch(
            "api.services.unified_content.audit_logger.AuditLogger",
            return_value=MagicMock(),
        ),
        patch(
            "api.services.unified_content.content_storage_service.ContentStorageService",
            return_value=storage,
        ),
    ):
        obs, ev = await tool_save_to_library(
            "Отчёт",
            "тело ответа",
            runtime=ToolRuntime(user_id=uid),
            mission_id="m1",
        )
        # Ignore victim id in args — must use runtime user
        _ = victim

    assert "saved" in obs
    assert len(ev) == 1
    assert ev[0].kind == "library"
    assert str(created.id) == ev[0].ref
    assert storage.create_content.await_args.args[2] == str(uid)


@pytest.mark.asyncio
async def test_finish_autosaves_when_goal_asks() -> None:
    from api.services.kursorina.loop import tick_mission
    from api.services.kursorina.models import DecideAction

    now = "2026-09-05T00:00:00+00:00"
    uid = uuid4()
    cid = uuid4()
    mission = MissionSnapshot(
        id="m-save",
        principal_id=str(uid),
        goal="Собери краткий обзор и сохрани в файл",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://ex.example/a", extract="fact A")],
        created_at=now,
        updated_at=now,
        step_budget=8,
    )

    async def fake_decide(m: MissionSnapshot) -> DecideAction:
        return DecideAction(tool="finish", args={}, reason="done")

    async def fake_save(title: str, text: str, *, runtime=None, mission_id=None):
        return (
            f"saved content_id={cid}",
            [EvidenceItem(id="s1", kind="library", ref=str(cid), extract=f"{title}\n{text[:80]}")],
        )

    with (
        patch("api.services.kursorina.loop.decide_next", new=fake_decide),
        patch(
            "api.services.kursorina.loop.synthesize_answer",
            new=AsyncMock(return_value="Краткий обзор\n\nПробелы:\n— тест"),
        ),
        patch("api.services.kursorina.library.tool_save_to_library", new=fake_save),
        patch("api.services.kursorina.loop.save_mission", new=AsyncMock(side_effect=lambda m: m)),
    ):
        out = await tick_mission(
            mission,
            max_steps=2,
            runtime=ToolRuntime(user_id=uid),
        )

    assert out.status == "completed"
    assert any(s.tool == "save_to_library" for s in out.steps)
    assert str(cid) in (out.answer or "")
    assert any(e.kind == "library" and e.ref == str(cid) for e in out.evidence)


@pytest.mark.asyncio
async def test_run_python_rejects_custom_matplotlib_code() -> None:
    from api.services.kursorina.python_tool import tool_run_python

    code = """
import matplotlib.pyplot as plt
import json
import math

xs = [1, 2, 3, 4]
ys = [x * 10 for x in xs]
plt.plot(xs, ys)
plt.title('Test Metrics')
plt.savefig('metrics.png')
print(json.dumps({'max_y': max(ys)}))
"""
    obs, ev = await tool_run_python(code, goal="Build chart metrics.png")
    assert "blocked" in obs
    assert "disabled" in obs
    assert ev == []


def test_after_fetch_fail_abort_executes_python_when_goal_wants_python() -> None:
    from api.services.kursorina.decide import _after_fetch_fail_abort

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-abort-py",
        principal_id="u1",
        goal="Рыночный аудит, запусти Python для расчета юнит-экономики и построй график chart.png",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="ok", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
            StepItem(index=2, tool="fetch_url", args={}, observation="err", ok=False),
            StepItem(index=3, tool="fetch_url", args={}, observation="err", ok=False),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://a.test", extract="market data")],
        created_at=now,
        updated_at=now,
    )
    action = _after_fetch_fail_abort(m)
    assert action is not None
    assert action.tool == "run_python"


def test_evidence_for_synthesize_prioritizes_python_evidence() -> None:
    from api.services.kursorina.synthesize import evidence_for_synthesize

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-synth",
        principal_id="u1",
        goal="test",
        status="running",
        steps=[],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://test.com", extract="fact A"),
            EvidenceItem(id="py1", kind="python", ref="run_python", extract='{"break_even": 12}'),
            EvidenceItem(id="lib1", kind="library", ref="cid1", extract="chart.png bytes=100"),
        ],
        created_at=now,
        updated_at=now,
    )
    items = evidence_for_synthesize(m)
    kinds = [e.kind for e in items]
    assert "python" in kinds
    assert items[0].kind in {"python", "library"}


def test_dump_safe_jsonb_strips_null_characters() -> None:
    from api.services.kursorina.store import _dump_safe_jsonb

    payload = {"obs": "bad\x00null\u0000byte", "nested": ["a\x00b"]}
    result = _dump_safe_jsonb(payload)
    assert "\u0000" not in result
    assert "\x00" not in result
    assert "badnullbyte" in result


def test_sanitize_extracted_text_removes_null_bytes() -> None:
    from api.services.desktop_chat.tools.fetch_url import _sanitize_extracted_text

    raw = "Report\x00 Title\x01\x02 with\x00 nulls"
    cleaned = _sanitize_extracted_text(raw)
    assert "\x00" not in cleaned
    assert "\0" not in cleaned
    assert cleaned == "Report Title with nulls"


def test_external_market_research_goal_does_not_probe_internal_code() -> None:
    from api.services.kursorina.decide import _wants_external, _wants_platform, heuristic_decide

    goal = (
        "Изучить Российский протокол развития технологий и ИИ в бизнесе, цифровизация, "
        "переход на российское ПО. Исследуй рыночные особенности, найди производителей ОС. "
        "Составь таблицу с платформами, кто разработал код, насколько он авторский. "
        "Сделай выводы и рекомендации."
    )
    assert _wants_external(goal) is True
    assert _wants_platform(goal) is False

    now = "2026-09-05T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-market-no-code",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="ok", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="ok", ok=True),
            StepItem(index=2, tool="web_search", args={}, observation="ok", ok=True),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://vendor.ru", extract="vendor facts")],
        created_at=now,
        updated_at=now,
    )
    action = heuristic_decide(m)
    assert action.tool != "search_code"


def test_goal_wants_library_save_on_tables_and_reports() -> None:
    from api.services.kursorina.decide import goal_wants_library_save

    assert goal_wants_library_save("Составь таблицу с производителями и разработчиками российского ПО") is True
    assert goal_wants_library_save("Подготовь аналитический отчет по рынку ИИ и сделай выводы и рекомендации") is True


@pytest.mark.asyncio
async def test_delete_mission_executes_delete_query() -> None:
    from unittest.mock import AsyncMock, MagicMock, patch

    from api.services.kursorina.store import delete_mission

    mock_conn = AsyncMock()
    mock_conn.execute.return_value = "DELETE 1"

    class DummyAcquire:
        async def __aenter__(self):
            return mock_conn

        async def __aexit__(self, *args):
            pass

    mock_pool = MagicMock()
    mock_pool.acquire.return_value = DummyAcquire()

    with (
        patch("api.services.kursorina.store.ensure_schema", new=AsyncMock()),
        patch("api.services.kursorina.store._pool", new=AsyncMock(return_value=mock_pool)),
    ):
        ok = await delete_mission(mission_id="m-del-1", principal_id="u1")
    assert ok is True
    mock_conn.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_tool_generate_diagram_merges_header_and_creates_evidence() -> None:
    from api.services.kursorina.tools import tool_generate_diagram

    raw_code = "A --> B\nB --> C"
    obs, ev = await tool_generate_diagram(
        raw_code,
        title="Тестовая архитектура",
        diagram_type="flowchart",
        save_as_file=False,
    )
    assert "diagram generated" in obs
    assert len(ev) == 1
    assert ev[0].kind == "diagram"
    assert "flowchart TD" in ev[0].extract
    assert "```mermaid" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_extract_table_data_computes_statistics() -> None:
    from api.services.kursorina.tools import tool_extract_table_data

    sample = "Метрика | Показатель_A | Показатель_B\nКонверсия | 10.0 | 20.0\nУдержание | 30.0 | 40.0"
    obs, ev = await tool_extract_table_data(sample, title="Сравнительная матрица", calculate_stats=True)
    assert "extracted table" in obs
    assert len(ev) == 1
    assert ev[0].kind == "table"
    assert "Итого / Среднее" in ev[0].extract
    assert "avg=" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_export_file_without_user_fallback() -> None:
    from api.services.kursorina.tools import tool_export_file

    obs, ev = await tool_export_file("report.csv", "a,b,c\n1,2,3", runtime=None)
    assert "exported physical file" in obs
    assert len(ev) == 1
    assert ev[0].ref == "report.csv"
    assert "1,2,3" in ev[0].extract


def test_heuristic_decide_kbsew_and_projects_goals() -> None:
    now = "2026-09-05T00:00:00+00:00"
    # KBSEW cue
    m_kb = MissionSnapshot(
        id="m-kb",
        principal_id="u1",
        goal="Найди регламенты информационной безопасности в базе знаний KBSEW",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    action_kb = heuristic_decide(m_kb)
    assert action_kb.tool == "knowledge_base_search"

    # Projects cue
    m_proj = MissionSnapshot(
        id="m-pr",
        principal_id="u1",
        goal="Покажи активные проекты компании и текущий roadmap",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    action_pr = heuristic_decide(m_proj)
    assert action_pr.tool == "search_projects"

    # Companies cue
    m_comp = MissionSnapshot(
        id="m-co",
        principal_id="u1",
        goal="Покажи профили компаний и клиентские организации в нашей базе",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    action_co = heuristic_decide(m_comp)
    assert action_co.tool == "search_companies"


@pytest.mark.asyncio
async def test_tool_calculate_financial_metrics_cagr_and_saas() -> None:
    from api.services.kursorina.tools import tool_calculate_financial_metrics

    obs, ev = await tool_calculate_financial_metrics(
        metric_type="all",
        inputs={
            "initial_value": 10_000_000,
            "final_value": 30_000_000,
            "years": 2,
            "cac": 5000,
            "arpu": 2500,
            "churn_rate": 0.05,
            "gross_margin": 0.8,
        },
    )
    assert "calculated financial metrics" in obs
    assert len(ev) == 1
    assert ev[0].kind == "finance"
    assert "CAGR" in ev[0].extract
    assert "LTV" in ev[0].extract
    assert "Payback" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_swot_matrix_analysis_cross_strategies() -> None:
    from api.services.kursorina.tools import tool_swot_matrix_analysis

    obs, ev = await tool_swot_matrix_analysis(
        subject="Платформа Курсорина",
        strengths=["Автономность", "Безопасность"],
        weaknesses=["Сложность обучения"],
        opportunities=["Импортозамещение"],
        threats=["Конкуренция"],
    )
    assert "synthesized SWOT matrix" in obs
    assert len(ev) == 1
    assert ev[0].kind == "swot"
    assert "Strengths" in ev[0].extract
    assert "SO-стратегии" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_export_executive_html_renders_cards() -> None:
    from api.services.kursorina.tools import tool_export_executive_html

    obs, ev = await tool_export_executive_html(
        title="Тестовый отчет",
        content="## Раздел 1\n- Пункт 1\n- Пункт 2\n### Подраздел\nТекст резюме",
        subtitle="Аналитическое досье",
        runtime=None,
    )
    assert "exported executive html report" in obs
    assert len(ev) == 1
    assert ev[0].kind == "html_report"
    assert ev[0].ref.endswith(".html")


@pytest.mark.asyncio
async def test_tool_extract_key_entities_finds_metrics_and_orgs() -> None:
    from api.services.kursorina.tools import tool_extract_key_entities

    raw_text = (
        "Компания ООО Яндекс объявила о росте выручки на 42% в 2025 году. "
        "Вендор ООО Империя соответствует стандарту ГОСТ Р 57580.1 и показал LTV/CAC 4.5x."
    )
    obs, ev = await tool_extract_key_entities(text=raw_text)
    assert "extracted" in obs
    assert len(ev) == 1
    assert ev[0].kind == "entities"
    assert "Яндекс" in ev[0].extract or "Империя" in ev[0].extract
    assert "42%" in ev[0].extract or "4.5x" in ev[0].extract
    assert "ГОСТ" in ev[0].extract


def test_heuristic_decide_swot_and_finance_goals() -> None:
    now = "2026-09-05T00:00:00+00:00"
    m_swot = MissionSnapshot(
        id="m-swot",
        principal_id="u1",
        goal="Проведи SWOT анализ продукта и опиши сильные и слабые стороны",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "SWOT 1"}, observation="hits=5", ok=True),
            StepItem(index=2, tool="web_search", args={"query": "SWOT 2"}, observation="hits=5", ok=True),
            StepItem(index=3, tool="web_search", args={"query": "SWOT 3"}, observation="hits=5", ok=True),
            StepItem(index=4, tool="web_search", args={"query": "SWOT 4"}, observation="hits=5", ok=True),
            StepItem(index=5, tool="web_search", args={"query": "SWOT 5"}, observation="hits=5", ok=True),
            StepItem(index=6, tool="web_search", args={"query": "SWOT 6"}, observation="hits=5", ok=True),
            StepItem(
                index=7,
                tool="fetch_url",
                args={"url": "https://x.example"},
                observation="page content with SWOT details",
                ok=True,
            ),
        ],
        evidence=[
            EvidenceItem(
                id="e1",
                kind="web",
                ref="https://x.example",
                extract="strength weakness opportunity threat SWOT анализ продукта",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    action_sw = heuristic_decide(m_swot)
    assert action_sw.tool == "swot_matrix_analysis"

    # Also test guard_llm_action switching premature finish to finance
    m_fin = MissionSnapshot(
        id="m-fin",
        principal_id="u1",
        goal="Рассчитай финмодель и ключевые финансовые показатели CAGR и окупаемость проекта",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "Finance 1"}, observation="hits=5", ok=True),
            StepItem(index=2, tool="web_search", args={"query": "Finance 2"}, observation="hits=5", ok=True),
            StepItem(index=3, tool="web_search", args={"query": "Finance 3"}, observation="hits=5", ok=True),
            StepItem(index=4, tool="web_search", args={"query": "Finance 4"}, observation="hits=5", ok=True),
            StepItem(index=5, tool="web_search", args={"query": "Finance 5"}, observation="hits=5", ok=True),
            StepItem(index=6, tool="web_search", args={"query": "Finance 6"}, observation="hits=5", ok=True),
            StepItem(index=7, tool="fetch_url", args={"url": "https://y.example"}, observation="data", ok=True),
        ],
        evidence=[
            EvidenceItem(id="e2", kind="web", ref="https://y.example", extract="Выручка 20 млн руб, CAC 3000 руб LTV"),
        ],
        created_at=now,
        updated_at=now,
    )
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    action_fn = guard_llm_action(m_fin, DecideAction(tool="finish", args={}, reason="done"))
    assert action_fn.tool == "calculate_financial_metrics"


@pytest.mark.asyncio
async def test_tool_risk_matrix_assessment_levels_and_scoring() -> None:
    from api.services.kursorina.tools import tool_risk_matrix_assessment

    obs, ev = await tool_risk_matrix_assessment(
        subject="Платформа автоматизации",
        risks=[
            {
                "category": "Финансовый",
                "name": "Кассовый разрыв",
                "probability": 4,
                "impact": 5,
                "mitigation": "Резервный фонд",
            },
            {"category": "Технологический", "name": "Сбой питания", "probability": 2, "impact": 2, "mitigation": "ИБП"},
        ],
    )
    assert "assessed" in obs
    assert len(ev) == 1
    assert ev[0].kind == "risk"
    assert "Матрица оценки рисков" in ev[0].extract
    assert "20" in ev[0].extract
    assert "Критический" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_competitor_benchmark_matrix_ranking() -> None:
    from api.services.kursorina.tools import tool_competitor_benchmark_matrix

    obs, ev = await tool_competitor_benchmark_matrix(
        subject="EliteEW",
        competitors=["Конкурент Альфа", "Конкурент Бета"],
        criteria=[
            {"name": "Функционал", "weight": 0.5},
            {"name": "Цена", "weight": 0.5},
        ],
        scores={
            "EliteEW": {"Функционал": 9.0, "Цена": 8.0},
            "Конкурент Альфа": {"Функционал": 7.0, "Цена": 7.5},
            "Конкурент Бета": {"Функционал": 6.0, "Цена": 9.0},
        },
    )
    assert "synthesized benchmark" in obs
    assert len(ev) == 1
    assert ev[0].kind == "benchmark"
    assert "EliteEW" in ev[0].extract
    assert "Итоговый балл" in ev[0].extract
    assert "не случайная" in ev[0].extract.casefold() or "явные" in ev[0].extract.casefold()


@pytest.mark.asyncio
async def test_tool_competitor_benchmark_str_criteria_no_crash_and_no_rng() -> None:
    """Prod 38e6c507: list[str] criteria must not AttributeError; no RNG ranks."""
    from api.services.kursorina.tools import tool_competitor_benchmark_matrix

    obs, ev = await tool_competitor_benchmark_matrix(
        subject="РФ ПО",
        competitors=["Астра", "РЕД СОФТ"],
        criteria=["Функциональность", "Стоимость", "Безопасность"],
    )
    assert "benchmark deferred" in obs
    assert len(ev) == 1
    assert "Недостаточно данных" in ev[0].extract
    assert "RNG" not in obs
    assert "8." not in ev[0].extract  # no invented decimal scores


@pytest.mark.asyncio
async def test_tool_finance_refuses_empty_default_inputs() -> None:
    from api.services.kursorina.tools import tool_calculate_financial_metrics

    obs, ev = await tool_calculate_financial_metrics(metric_type="all", inputs={})
    assert "finance deferred" in obs
    assert len(ev) == 1
    assert "Недостаточно данных" in ev[0].extract
    assert "65.1%" not in obs
    assert "CAGR=" not in obs


def test_ledger_has_finance_rejects_bare_years() -> None:
    from api.services.kursorina.plan import ledger_has_finance_inputs

    now = "2026-09-07T00:00:00+00:00"
    bare = MissionSnapshot(
        id="m-years",
        principal_id="u1",
        goal="рынок 2024 2025 2026",
        status="running",
        steps=[],
        evidence=[EvidenceItem(id="w", kind="web", ref="https://x/", extract="trends 2024 2025 2026 outlook")],
        created_at=now,
        updated_at=now,
    )
    assert ledger_has_finance_inputs(bare) is False
    rich = MissionSnapshot(
        id="m-rich",
        principal_id="u1",
        goal="финмодель",
        status="running",
        steps=[],
        evidence=[
            EvidenceItem(id="w2", kind="web", ref="https://y/", extract="Выручка 316 млрд руб CAGR рынка"),
        ],
        created_at=now,
        updated_at=now,
    )
    assert ledger_has_finance_inputs(rich) is True


def test_guard_library_thrash_stops_duplicate_empty_search() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    q = "EliteEW архитектура регламенты описание продуктов"
    m = MissionSnapshot(
        id="m-lib-thrash",
        principal_id="u1",
        goal="Исследуй корпоративную библиотеку EliteEW документы по стримам",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
            StepItem(index=1, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
            StepItem(index=2, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(
        m,
        DecideAction(tool="search_library", args={"query": q}, reason="Пользователь просит ещё раз поискать"),
    )
    assert out.tool != "search_library" or out.reason == "guard_library_query_shorten"
    assert out.reason.startswith("guard_library_") or out.reason == "guard_library_query_shorten"
    # Free-form reason must not leak
    assert "Пользователь" not in out.reason


def test_guard_library_thrash_blocks_after_shorten_exhausted() -> None:
    """After empty streak + shorten already done, never re-emit search_library."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction
    from api.services.kursorina.plan import goal_intent_text
    from api.services.kursorina.tools import tokenize_goal

    now = "2026-09-07T00:00:00+00:00"
    goal = "Исследуй корпоративную библиотеку EliteEW документы по стримам"
    q = "EliteEW архитектура регламенты"
    short_q = tokenize_goal(goal_intent_text(goal))[:48]
    m = MissionSnapshot(
        id="m-lib-thrash-2",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
            StepItem(index=1, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
            StepItem(index=2, tool="search_library", args={"query": q}, observation="library hits=0 total≈0", ok=True),
            StepItem(
                index=3,
                tool="search_library",
                args={"query": short_q},
                observation="library hits=0 total≈0",
                ok=True,
            ),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(
        m,
        DecideAction(tool="search_library", args={"query": q}, reason="llm_search_library"),
    )
    assert out.tool != "search_library"
    assert out.tool in {"block", "web_search", "finish"} or out.reason.startswith("guard_library_")


@pytest.mark.asyncio
async def test_finance_requires_churn_not_default() -> None:
    from api.services.kursorina.tools import tool_calculate_financial_metrics

    obs, ev = await tool_calculate_financial_metrics(metric_type="all", inputs={"cac": 3500, "arpu": 1800})
    assert "finance deferred" in obs
    assert "LTV/CAC" not in obs
    assert all("LTV / CAC" not in (e.extract or "") for e in ev)


def test_normalize_reason_strips_llm_essay() -> None:
    from api.services.kursorina.decide import _normalize_reason

    assert _normalize_reason("facet_web", "web_search") == "facet_web"
    assert _normalize_reason("Для проведения бенчмаркинга нужно ещё", "web_search") == "llm_web_search"


@pytest.mark.asyncio
async def test_tool_generate_timeline_roadmap_and_gantt() -> None:
    from api.services.kursorina.tools import tool_generate_timeline_roadmap

    obs, ev = await tool_generate_timeline_roadmap(
        title="План внедрения платформы",
        phases=[
            {"name": "Фаза 1: Пилот", "duration": "1 мес", "milestones": ["Старт", "Финиш"], "deliverable": "Отчет"},
        ],
    )
    assert "generated timeline roadmap" in obs
    assert len(ev) == 1
    assert ev[0].kind == "roadmap"
    assert "gantt" in ev[0].extract
    assert "Фаза 1" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_verify_compliance_standards_gost_152fz() -> None:
    from api.services.kursorina.tools import tool_verify_compliance_standards

    obs, ev = await tool_verify_compliance_standards(standards=["152-ФЗ", "ГОСТ Р 57580.1"])
    assert "completed compliance audit" in obs
    assert len(ev) == 1
    assert ev[0].kind == "compliance"
    assert "152-ФЗ" in ev[0].extract
    assert "Индекс соответствия" in ev[0].extract


@pytest.mark.asyncio
async def test_tool_aggregate_market_statistics_quantiles_and_outliers() -> None:
    from api.services.kursorina.tools import tool_aggregate_market_statistics

    prices = [100.0, 150.0, 200.0, 250.0, 300.0, 350.0, 1000.0]
    obs, ev = await tool_aggregate_market_statistics(numbers=prices, unit="тыс. руб.", sample_name="Тарифы SaaS")
    assert "calculated statistics" in obs
    assert len(ev) == 1
    assert ev[0].kind == "statistics"
    assert "Медиана" in ev[0].extract
    assert "25-й процентиль" in ev[0].extract
    assert "1000" in ev[0].extract or "Выбросы" in ev[0].extract


def test_heuristic_decide_and_guard_wave3_tools() -> None:
    now = "2026-09-05T00:00:00+00:00"

    # Risk cue in heuristic
    m_risk = MissionSnapshot(
        id="m-risk",
        principal_id="u1",
        goal="Оцени риски проекта и построй матрицу рисков с мерами митигации",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "R1"}, observation="hits=5", ok=True),
            StepItem(index=2, tool="web_search", args={"query": "R2"}, observation="hits=5", ok=True),
            StepItem(index=3, tool="web_search", args={"query": "R3"}, observation="hits=5", ok=True),
            StepItem(index=4, tool="web_search", args={"query": "R4"}, observation="hits=5", ok=True),
            StepItem(index=5, tool="web_search", args={"query": "R5"}, observation="hits=5", ok=True),
            StepItem(index=6, tool="web_search", args={"query": "R6"}, observation="hits=5", ok=True),
            StepItem(index=7, tool="fetch_url", args={"url": "https://risk.example"}, observation="data", ok=True),
        ],
        evidence=[
            EvidenceItem(id="e-r", kind="web", ref="https://risk.example", extract="Ключевые угрозы и риски"),
        ],
        created_at=now,
        updated_at=now,
    )
    action_risk = heuristic_decide(m_risk)
    assert action_risk.tool == "risk_matrix_assessment"

    # Guard switches premature finish to roadmap
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    m_road = MissionSnapshot(
        id="m-road",
        principal_id="u1",
        goal="Построй дорожную карту реализации проекта и таймлайн вех внедрения",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
            StepItem(index=1, tool="web_search", args={"query": "Road 1"}, observation="hits=5", ok=True),
            StepItem(index=2, tool="web_search", args={"query": "Road 2"}, observation="hits=5", ok=True),
            StepItem(index=3, tool="web_search", args={"query": "Road 3"}, observation="hits=5", ok=True),
            StepItem(index=4, tool="web_search", args={"query": "Road 4"}, observation="hits=5", ok=True),
            StepItem(index=5, tool="web_search", args={"query": "Road 5"}, observation="hits=5", ok=True),
            StepItem(index=6, tool="web_search", args={"query": "Road 6"}, observation="hits=5", ok=True),
            StepItem(index=7, tool="fetch_url", args={"url": "https://road.example"}, observation="data", ok=True),
        ],
        evidence=[
            EvidenceItem(id="e-rd", kind="web", ref="https://road.example", extract="Сроки и этапы проекта"),
        ],
        created_at=now,
        updated_at=now,
    )
    action_road = guard_llm_action(m_road, DecideAction(tool="finish", args={}, reason="done"))
    assert action_road.tool == "generate_timeline_roadmap"


def test_guard_python_already_done_routes_to_strategy_tool() -> None:
    """99a09e0f: python+png must not finish while strategy facet pending."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-06T00:00:00+00:00"
    goal = "Рынок ИИ в России: конкуренты, CAGR, стратегия и рекомендации, архитектурная схема платформы"
    m = MissionSnapshot(
        id="m-py-fin",
        principal_id="u1",
        goal=goal,
        status="running",
        step_budget=24,
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            *[
                StepItem(
                    index=i,
                    tool="web_search",
                    args={"query": f"q{i}"},
                    observation="hits=2",
                    ok=True,
                )
                for i in range(1, 7)
            ],
            StepItem(
                index=7,
                tool="run_python",
                args={},
                observation="saved file=cash_flow_forecast.png content_id=abc",
                ok=True,
            ),
            StepItem(
                index=8,
                tool="fetch_url",
                args={"url": "https://ex.example/a"},
                observation="ok",
                ok=True,
            ),
        ],
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://ex.example/a",
                extract="Yandex Cloud Sber AI market CAGR competitors pricing leader",
            ),
            EvidenceItem(
                id="p1",
                kind="library",
                ref="cash_flow_forecast.png",
                extract="png chart",
            ),
            EvidenceItem(id="py", kind="python", ref="run_python", extract="cac=600"),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="run_python", args={"code": ""}, reason="again"))
    assert out.tool != "finish"
    assert out.tool in {"swot_matrix_analysis", "generate_diagram", "calculate_financial_metrics"}
    assert out.reason.startswith("facet_deliverable_") or "rewrite" in (out.reason or "")


def test_web_cap_with_pending_architecture_does_not_invent_diagram() -> None:
    """Architecture prose must not force sample mermaid theatre when web budget is done."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-arch",
        principal_id="u1",
        goal="Исследование рынка SaaS и архитектурная схема компонентов пайплайна",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            *[
                StepItem(index=i, tool="web_search", args={"query": f"w{i}"}, observation="ok", ok=True)
                for i in range(1, 7)
            ],
        ],
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://saas.example/",
                extract="SaaS market trends billion forecast 2026",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="web_search", args={"query": "more"}, reason="llm"))
    assert out.tool != "web_search"
    assert out.tool != "generate_diagram"
    assert out.tool in {"fetch_url", "finish", "swot_matrix_analysis", "risk_matrix_assessment", "block"}


def test_elab_brief_goal_probes_companies_before_web() -> None:
    """Mission e7811f9a class: company+EliteEW brief is investigator-first, not SERP bot."""
    from api.services.kursorina.decide import _wants_platform, heuristic_decide
    from api.services.kursorina.plan import facets_for_goal

    goal = (
        "Разработать список вопросов для компании Е-лаб, чтобы определить соответствует ли "
        "платформа EliteEW как экосистема и операционная среда закрытого типа. "
        "Изучи примеры брифов и технических заданий в российской практике. "
        "Глубже изучи компанию elab.ru, ООО Е-лаб. Создай полноценный бриф в таблице."
    )
    ids = {f.id for f in facets_for_goal(goal)}
    assert "companies" in ids
    assert "economics" not in ids or "companies" in ids
    assert _wants_platform(goal) is True

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-elab",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    a = heuristic_decide(m)
    assert a.tool == "search_companies"
    assert a.reason == "companies_probe"

    m.steps.append(StepItem(index=1, tool="search_companies", args={"query": "Е-лаб"}, observation="ok", ok=True))
    m.evidence.append(EvidenceItem(id="c1", kind="company", ref="elab", extract="ООО Е-лаб проектирование лабораторий"))
    a2 = heuristic_decide(m)
    assert a2.tool in {"knowledge_base_search", "search_docs"}
    assert a2.tool != "web_search"


def test_facets_for_goal_biznes_does_not_wipe_companies() -> None:
    from api.services.kursorina.plan import facets_for_goal

    goal = "Список вопросов для компании Е-лаб: задачи бизнеса и соответствие EliteEW"
    ids = [f.id for f in facets_for_goal(goal)]
    assert ids[0] == "companies"
    assert ids != ["market", "competitors", "economics"]


def test_web_cap_does_not_complete_brief_with_unread_library() -> None:
    """Mission 75afec1b: guard_web_cap_finish must not fake-complete a brief."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    goal = (
        "Разработать список вопросов для компании Е-лаб и полноценный бриф. "
        "Платформа EliteEW как экосистема закрытого типа."
    )
    m = MissionSnapshot(
        id="m-premature",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=3", ok=True),
            StepItem(index=1, tool="search_companies", args={}, observation="no companies", ok=True),
            StepItem(index=2, tool="knowledge_base_search", args={}, observation="thin", ok=True),
            StepItem(index=3, tool="search_docs", args={}, observation="no doc hits", ok=False),
            StepItem(index=4, tool="web_search", args={"query": "a"}, observation="hits=1", ok=True),
            StepItem(index=5, tool="web_search", args={"query": "b"}, observation="hits=1", ok=True),
        ],
        evidence=[
            EvidenceItem(id="h1", kind="library_hit", ref="cid-1", extract="x" * 100),
            EvidenceItem(id="h2", kind="library_hit", ref="cid-2", extract="y" * 100),
            EvidenceItem(id="kb", kind="kbsew", ref="kbsew:auto", extract="short"),
            EvidenceItem(id="w1", kind="web", ref="https://elab.ru/", extract="elab " * 50),
            EvidenceItem(id="w2", kind="web", ref="https://elab.ru/v", extract="v " * 40),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="web_search", args={"query": "more"}, reason="llm"))
    assert out.tool != "finish"
    assert out.tool in {"read_content", "block", "fetch_url", "search_docs", "knowledge_base_search"}


def test_empty_companies_probe_covers_facet() -> None:
    """Mission 50ad606e: CRM miss must cover companies (not forever-pending → block)."""
    from api.services.kursorina.plan import facet_covered, facets_for_goal

    now = "2026-09-07T00:00:00+00:00"
    goal = "Список вопросов для компании Е-лаб и бриф EliteEW"
    facets = {f.id: f for f in facets_for_goal(goal)}
    assert "companies" in facets
    m = MissionSnapshot(
        id="m-co-empty",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=0", ok=True),
            StepItem(
                index=1,
                tool="search_companies",
                args={"query": "Е-лаб"},
                observation="no companies found for query=Е-лаб",
                ok=True,
            ),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    assert facet_covered(m, facets["companies"]) is True
    # SERP alone still does not cover
    m_serp = MissionSnapshot(
        id="m-co-serp",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="web_search", args={}, observation="hits=3", ok=True),
        ],
        evidence=[EvidenceItem(id="w1", kind="web", ref="https://elab.ru", extract="Е-лаб elab компания")],
        created_at=now,
        updated_at=now,
    )
    assert facet_covered(m_serp, facets["companies"]) is False


def test_brief_finishes_after_empty_companies_and_depth() -> None:
    """After CRM miss + library reads + deep web, finish is allowed (not incomplete block)."""
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    goal = "Разработать список вопросов для компании Е-лаб и полноценный бриф."
    deep = ("Е-лаб elab.ru деятельность продукты " * 80)[:1600]
    m = MissionSnapshot(
        id="m-brief-ready",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="hits=1", ok=True),
            StepItem(index=1, tool="read_content", args={"content_id": "c1"}, observation="ok", ok=True),
            StepItem(
                index=2,
                tool="search_companies",
                args={"query": "Е-лаб"},
                observation="no companies found",
                ok=True,
            ),
            StepItem(index=3, tool="web_search", args={}, observation="hits=2", ok=True),
            StepItem(index=4, tool="fetch_url", args={"url": "https://elab.ru"}, observation="ok", ok=True),
        ],
        evidence=[
            EvidenceItem(id="h1", kind="library_hit", ref="c1", extract="x" * 100),
            EvidenceItem(id="lib", kind="library", ref="c1", extract="y" * 400),
            EvidenceItem(id="w1", kind="web", ref="https://elab.ru", extract=deep),
        ],
        created_at=now,
        updated_at=now,
    )
    out = guard_llm_action(m, DecideAction(tool="finish", args={}, reason="done"))
    assert out.tool == "finish"


def test_empty_search_docs_does_not_cover_architecture() -> None:
    from api.services.kursorina.plan import facet_covered, facets_for_goal

    now = "2026-09-07T00:00:00+00:00"
    goal = "Архитектурная схема EliteEW и регламенты"
    facets = {f.id: f for f in facets_for_goal(goal)}
    m = MissionSnapshot(
        id="m-arch-empty",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_docs", args={}, observation="no doc hits", ok=True)],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    if "architecture" in facets:
        assert facet_covered(m, facets["architecture"]) is False
    if "standards" in facets:
        m2 = MissionSnapshot(
            id="m-std",
            principal_id="u1",
            goal=goal,
            status="running",
            steps=[StepItem(index=0, tool="knowledge_base_search", args={}, observation="ok", ok=True)],
            evidence=[EvidenceItem(id="kb", kind="kbsew", ref="x", extract="tiny")],
            created_at=now,
            updated_at=now,
        )
        assert facet_covered(m2, facets["standards"]) is False


@pytest.mark.asyncio
async def test_tool_search_companies_uses_asyncpg_pool_not_api_config() -> None:
    """Prod crash 615af3bc: ModuleNotFoundError api.config on companies_probe."""
    from unittest.mock import AsyncMock, MagicMock, patch

    from api.services.kursorina.tools import tool_search_companies

    row = {
        "id": "c1",
        "name": "ООО Е-лаб",
        "slug": "elab",
        "industry": "lab",
        "size": "smb",
        "country": "RU",
        "website": "https://elab.ru",
        "description": "проектирование",
        "subscription_tier": "pro",
    }
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=[row])
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acquire_cm)

    with patch("api.core.database_manager.get_asyncpg_pool", new=AsyncMock(return_value=pool)):
        obs, ev = await tool_search_companies(query="Е-лаб")
    assert "api.config" not in obs
    assert "error" not in obs.casefold()
    assert len(ev) == 1
    assert ev[0].kind == "company"
    assert "Е-лаб" in (ev[0].extract or "")


def test_economics_not_covered_by_serp_cagr_keyword_alone() -> None:
    from api.services.kursorina.plan import facet_covered, facets_for_goal

    now = "2026-09-06T00:00:00+00:00"
    goal = "Рынок, конкуренты, расчёт LTV CAC unit-экономики"
    m = MissionSnapshot(
        id="m-econ",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(id="w1", kind="web", ref="https://x/", extract="cagr ltv cac churn arpu burn runway"),
        ],
        created_at=now,
        updated_at=now,
    )
    econ = next(f for f in facets_for_goal(goal) if f.id == "economics")
    assert facet_covered(m, econ) is False


@pytest.mark.asyncio
async def test_run_python_empty_market_goal_skips_unit_econ_default() -> None:
    from api.services.kursorina.python_tool import tool_run_python

    obs, ev = await tool_run_python(
        "",
        goal="Рынок ИИ России прогноз объёма до 2030 сегменты PaaS IaaS",
        evidence_blob="market size 316 млрд",
    )
    assert "no built-in model" in obs
    assert ev == []
    assert "cac" not in obs.casefold()


def test_goal_intent_strips_pasted_report_for_topic_and_facets() -> None:
    """Prod mission 491-shaped: pasted report must not drive SERP topic / facet spam."""
    from api.services.kursorina.models import MissionSnapshot
    from api.services.kursorina.plan import (
        facets_for_goal,
        goal_intent_text,
        goal_topic_query,
        max_intent_overlap,
    )

    goal = (
        "на основе отчета ниже сформируй техническое задание на разработку плана "
        "по разработке 10 приложений на React 19.2 + python3.14 .\n"
        "сам отчет:\n\n"
        "## Аналитический отчет: Топ-10 базовых стандартных приложений ОС\n\n"
        "Notepad Calculator File Explorer Paint Edge Internet Explorer CMD Terminal "
        "Snipping Tool Sticky Notes EVIDENCE Sublime Text market size CAGR\n"
    )
    intent = goal_intent_text(goal)
    assert "сам отчет" not in intent.casefold()
    assert "sublime" not in intent.casefold()
    assert "react" in intent.casefold()
    topic = goal_topic_query(goal).casefold()
    assert "sublime" not in topic
    assert "evidence" not in topic
    assert "notepad" not in topic
    assert "react" in topic or "python" in topic or "приложен" in topic
    facet_ids = {f.id for f in facets_for_goal(goal)}
    assert "market" not in facet_ids
    assert len(facet_ids) <= 3

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-491",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(
                id="yt",
                kind="web",
                ref="https://www.youtube.com/watch?v=wUL2wuKvCNU",
                extract="How To Run React App In Terminal on command line cmd YouTube tutorial CSS",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    assert max_intent_overlap(m) < 2


def test_market_not_covered_by_off_topic_youtube_serp() -> None:
    from api.services.kursorina.plan import facet_covered, facets_for_goal

    now = "2026-09-06T00:00:00+00:00"
    goal = "Исследуй рынок корпоративного ПО и платформ с искусственным интеллектом в России"
    m = MissionSnapshot(
        id="m-yt",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(
                id="yt",
                kind="web",
                ref="https://www.youtube.com/watch?v=x",
                extract="How To Run React App In Terminal CSS tutorial playlist",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    market = next(f for f in facets_for_goal(goal) if f.id == "market")
    assert facet_covered(m, market) is False


def test_market_covered_with_on_topic_web_overlap() -> None:
    from api.services.kursorina.plan import facet_covered, facets_for_goal

    now = "2026-09-06T00:00:00+00:00"
    goal = "Исследуй рынок корпоративного ПО и платформ с искусственным интеллектом в России"
    m = MissionSnapshot(
        id="m-ok",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://aiana.ru/research/rai-2026-ru/",
                extract=(
                    "Рынок искусственного интеллекта России 2026: корпоративного ПО и платформ, "
                    "316,1 млрд выручки, сегменты, тренд прогноз"
                ),
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    market = next(f for f in facets_for_goal(goal) if f.id == "market")
    assert facet_covered(m, market) is True


def test_facet_deliverable_skips_empty_finance_without_ledger_numbers() -> None:
    from api.services.kursorina.decide import facet_deliverable_action

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-fin",
        principal_id="u1",
        goal="Рынок SaaS и расчёт LTV CAC unit-экономики",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://ex.example/saas",
                extract="SaaS рынок платформ без цифр unit narrative only",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    out = facet_deliverable_action(m)
    assert out is None or out.tool != "calculate_financial_metrics"


def test_evidence_for_synthesize_drops_off_topic_web() -> None:
    from api.services.kursorina.synthesize import evidence_for_synthesize

    now = "2026-09-06T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-synth",
        principal_id="u1",
        goal="реестр отечественного ПО Минцифры требования к правообладателю",
        status="running",
        steps=[],
        evidence=[
            EvidenceItem(
                id="yt",
                kind="web",
                ref="https://www.youtube.com/watch?v=x",
                extract="How To Run React App In Terminal CSS tutorial",
            ),
            EvidenceItem(
                id="ok",
                kind="web",
                ref="https://www.klerk.ru/blogs/patent24/686694/",
                extract=(
                    "Регистрация отечественного ПО в реестре Минцифры: правообладатель РФ, "
                    "требования к включению, постановление"
                ),
            ),
            EvidenceItem(id="d", kind="diagram", ref="x.mermaid", extract="flowchart TD"),
        ],
        created_at=now,
        updated_at=now,
    )
    items = evidence_for_synthesize(m)
    refs = {e.ref for e in items}
    assert "https://www.youtube.com/watch?v=x" not in refs
    assert "https://www.klerk.ru/blogs/patent24/686694/" in refs
    assert any(e.kind == "diagram" for e in items)


def test_goal_intent_text_preserves_long_enterprise_prompt() -> None:
    from api.services.kursorina.plan import goal_intent_text

    long_prompt = "Слушай, нужно провести глубокое исследование. " + ("Требование по безопасности и архитектуре. " * 50)
    assert len(long_prompt) > 2000
    res = goal_intent_text(long_prompt)
    assert len(res) > 2000
    assert "Требование по безопасности" in res


def test_compliance_and_risk_tools_orchestrated_for_standards_facets() -> None:
    from api.services.kursorina.decide import facet_deliverable_action

    now = "2026-09-07T00:00:00+00:00"
    goal = "Аудит комплаенс 152-ФЗ, стандарты безопасности ГОСТ и матрица рисков доступа"
    m = MissionSnapshot(
        id="m-comp-risk",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0 hits", ok=True),
            StepItem(index=1, tool="knowledge_base_search", args={"query": "комплаенс"}, observation="ok", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    act = facet_deliverable_action(m)
    assert act is not None
    assert act.tool in {"verify_compliance_standards", "risk_matrix_assessment"}


def test_companies_probe_miss_switches_to_targeted_web() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    goal = "Исследовать профиль компании ООО Е-лаб и подготовить технический бриф"
    m = MissionSnapshot(
        id="m-elab-miss",
        principal_id="u1",
        goal=goal,
        status="running",
        step_budget=24,
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0 hits", ok=True),
            StepItem(
                index=1, tool="search_companies", args={"query": "ООО Е-лаб"}, observation="no companies found", ok=True
            ),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    # LLM tries search_companies again after probe already done
    act = guard_llm_action(m, DecideAction(tool="search_companies", args={"query": "Е-лаб"}, reason="llm"))
    assert act.tool == "web_search"
    assert "деятельность" in str(act.args.get("query") or "") or "Е-лаб" in str(act.args.get("query") or "")


def test_table_extract_accepts_compliance_and_risk_evidence() -> None:
    from api.services.kursorina.decide import _maybe_extract_table

    now = "2026-09-07T00:00:00+00:00"
    goal = "Составить сводную таблицу комплаенс и рисков безопасности"
    m = MissionSnapshot(
        id="m-table-comp",
        principal_id="u1",
        goal=goal,
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(
                id="c1",
                kind="compliance",
                ref="152-ФЗ",
                extract="Стандарт | Статус | Уровень\n152-ФЗ | Соответствует | УЗ-1\nГОСТ 57580 | В процессе | Стандартный",
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    act = _maybe_extract_table(m)
    assert act is not None
    assert act.tool == "extract_table_data"


def test_finish_or_incomplete_does_not_block_early_when_budget_remains() -> None:
    from api.services.kursorina.decide import _finish_or_incomplete

    now = "2026-09-07T00:00:00+00:00"
    goal = "Полный анализ рынка B2B SaaS и комплаенс стандарты"
    m = MissionSnapshot(
        id="m-budget-left",
        principal_id="u1",
        goal=goal,
        status="running",
        step_budget=20,
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="knowledge_base_search", args={}, observation="0", ok=True),
        ],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    act = _finish_or_incomplete(m, reason="premature_test")
    # Must NOT block at step 2 when 18 steps remain!
    assert act.tool != "block"


def test_substantive_evidence_finish_prevents_premature_block() -> None:
    """Mission c8576a56 forensic: when step budget is reached and substantive evidence exists, finish instead of block."""
    from api.services.kursorina.decide import _finish_or_incomplete

    now = "2026-09-07T00:00:00+00:00"
    goal = "Разработать бриф для компании Е-лаб: стек, импортозамещение, архитектура закрытого типа"
    m = MissionSnapshot(
        id="m-c8576a56-forensic",
        principal_id="u1",
        goal=goal,
        status="running",
        step_budget=24,
        steps=[
            StepItem(index=0, tool="search_library", args={}, observation="0", ok=True),
            StepItem(index=1, tool="search_companies", args={}, observation="no companies", ok=True),
            *[
                StepItem(index=i, tool="web_search", args={"query": f"q{i}"}, observation="hits=2", ok=True)
                for i in range(2, 24)
            ],
        ],
        evidence=[
            EvidenceItem(
                id=f"e{i}",
                kind="web",
                ref=f"https://example.org/{i}",
                extract=(
                    f"Архитектурный стек и экосистема импортозамещения для закрытых корпоративных сред {i}. "
                    "Платформа обеспечивает безопасность туннелей, ролевую модель RBAC и изоляцию компонентов."
                ),
            )
            for i in range(10)
        ],
        created_at=now,
        updated_at=now,
    )
    act = _finish_or_incomplete(m, reason="test_budget_done")
    assert act.tool == "finish"
    assert act.reason == "test_budget_done"


def test_import_substitution_technical_goal_does_not_inject_market_facets() -> None:
    """Goal with 'импортозамещение' and company brief must hit standards/companies without market/competitors/economics."""
    from api.services.kursorina.plan import facets_for_goal

    goal = (
        "Разработать список вопросов для компании Е-лаб, чтобы определить соответствует ли платформа EliteEW "
        "как экосистема и операционная среда закрытого типа с точки зрения импортозамещения"
    )
    facets = facets_for_goal(goal)
    facet_ids = {f.id for f in facets}
    assert "standards" in facet_ids or "companies" in facet_ids
    assert "market" not in facet_ids
    assert "competitors" not in facet_ids
    assert "economics" not in facet_ids


def test_architecture_facet_covered_by_substantive_technical_evidence() -> None:
    """Evidence with deep architectural analysis and component stack covers the architecture facet."""
    from api.services.kursorina.plan import _FACETS, facet_covered

    arch_facet = next(f for f in _FACETS if f.id == "architecture")
    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-arch-cov",
        principal_id="u1",
        goal="Архитектура экосистемы",
        status="running",
        steps=[],
        evidence=[
            EvidenceItem(
                id="w1",
                kind="web",
                ref="https://arch.example.org",
                extract=(
                    "Архитектура корпоративной системы включает компонент шлюза безопасности, стек сетевых "
                    "протоколов и экосистему закрытого типа. Развертывание защищенного туннеля обеспечивает изоляцию."
                    + " x"
                    * 250
                ),
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    assert facet_covered(m, arch_facet) is True


def test_dynamic_progress_message_live_updates() -> None:
    """Live progress message reflects tool activity and evidence counts for active polling users."""
    from api.services.kursorina.models import progress_message

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-dyn-prog",
        principal_id="u1",
        goal="Аудит соответствия",
        status="running",
        steps=[
            StepItem(index=0, tool="verify_compliance_standards", args={}, observation="ok", ok=True),
        ],
        evidence=[
            EvidenceItem(id="c1", kind="compliance", ref="152-ФЗ", extract="Аудит"),
        ],
        created_at=now,
        updated_at=now,
    )
    msg = progress_message(m)
    assert "Собираю результаты" in msg
    assert "152-ФЗ" in msg or "стандарт" in msg.lower()
    assert "источников: 1" in msg


def test_results_from_evidence_cleans_titles_and_deduplicates_library() -> None:
    """Results view strips markdown markers from titles and deduplicates unread library hits once read."""
    from api.services.kursorina.models import results_from_evidence

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-clean-res",
        principal_id="u1",
        goal="Исследование",
        status="running",
        steps=[],
        evidence=[
            EvidenceItem(id="e1", kind="library_hit", ref="doc-123", extract="### Заголовок документа\nТекст"),
            EvidenceItem(id="e2", kind="library", ref="doc-123", extract="### Заголовок документа\nПолный текст"),
            EvidenceItem(id="e3", kind="compliance", ref="ГОСТ", extract="**Аудит безопасности**\nПодробности"),
        ],
        created_at=now,
        updated_at=now,
    )
    items = results_from_evidence(m)
    # doc-123 should appear only once (as library, not unread library_hit)
    assert len([it for it in items if it.ref == "doc-123"]) == 1
    assert items[0].kind == "library"
    assert not items[0].title.startswith("#")
    # Compliance title should not start with **
    comp = next(it for it in items if it.kind == "compliance")
    assert not comp.title.startswith("*")


@pytest.mark.asyncio
async def test_tick_mission_saves_completed_status_to_store_on_finish() -> None:
    """Mission 4cfd977c forensic: tick_mission must persist status=completed and answer to store."""
    from api.services.kursorina.loop import tick_mission
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-save-finish-test",
        principal_id="u1",
        goal="Тест сохранения завершения",
        status="running",
        steps=[StepItem(index=0, tool="search_library", args={}, observation="0", ok=True)],
        evidence=[
            EvidenceItem(id="e1", kind="web", ref="https://example.org", extract="подробный технический факт " * 50)
        ],
        created_at=now,
        updated_at=now,
        step_budget=5,
    )

    saved_snapshots: list[MissionSnapshot] = []

    async def fake_save(snap: MissionSnapshot) -> MissionSnapshot:
        # Save deep copy of snap state
        from api.services.kursorina.models import MissionSnapshot

        saved_snapshots.append(MissionSnapshot(**snap.model_dump()))
        return snap

    with (
        patch(
            "api.services.kursorina.loop.decide_next",
            new=AsyncMock(return_value=DecideAction(tool="finish", args={}, reason="test_finish")),
        ),
        patch(
            "api.services.kursorina.loop.synthesize_answer",
            new=AsyncMock(return_value="Сгенерированный финальный отчет"),
        ),
        patch("api.services.kursorina.loop.save_mission", new=fake_save),
    ):
        out = await tick_mission(m, max_steps=2)

    assert out.status == "completed"
    assert out.answer == "Сгенерированный финальный отчет"
    assert len(saved_snapshots) >= 1
    # The last saved snapshot must be completed with the answer
    final_saved = saved_snapshots[-1]
    assert final_saved.status == "completed"
    assert final_saved.answer == "Сгенерированный финальный отчет"
    assert any(s.tool == "finish" for s in final_saved.steps)


def test_normalize_latex_math_symbols() -> None:
    from api.services.kursorina.synthesize import normalize_latex_math_symbols

    raw = "Формула риска $P \\times I$, переход A $\\rightarrow$ B, порог $\\le$ 5, а также $N$."
    res = normalize_latex_math_symbols(raw)
    assert "×" in res
    assert "→" in res
    assert "≤" in res
    assert "$\\rightarrow$" not in res
    assert "$P \\times I$" not in res
    assert res == "Формула риска P × I, переход A → B, порог ≤ 5, а также N."


def test_polish_product_answer_replaces_outdated_2024_date() -> None:
    from api.services.kursorina.synthesize import current_date_context, polish_product_answer

    _, date_iso, cur_year = current_date_context()
    raw = (
        "# Аналитический отчет\n\n"
        "**Дата исследования:** 15.11.2024\n"
        "**Статус:** Черновик\n\n"
        "Связь компонентов $A \\rightarrow B$."
    )
    polished = polish_product_answer(raw)
    assert "2024" not in polished
    assert str(cur_year) in polished
    assert date_iso in polished
    assert "→" in polished


def test_strip_markdown_decorations_cleans_goal_for_search() -> None:
    from api.services.kursorina.plan import strip_markdown_decorations

    raw = (
        "## Название цели\n"
        "- Пункт 1: **Kubernetes** и [Docker](https://docker.com)\n"
        "- Пункт 2: `microservices` архитектура\n"
        "«Кавычки» и (скобки)"
    )
    clean = strip_markdown_decorations(raw)
    assert "#" not in clean
    assert "*" not in clean
    assert "`" not in clean
    assert "https://" not in clean
    assert "Kubernetes" in clean
    assert "Docker" in clean
    assert "microservices архитектура" in clean


def test_guard_web_search_deduplication_does_not_loop_identical_query() -> None:
    from api.services.kursorina.decide import guard_llm_action
    from api.services.kursorina.models import DecideAction

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-dedup",
        principal_id="u1",
        goal="Исследование рынка микросервисов в РФ",
        status="running",
        steps=[
            StepItem(
                index=0,
                tool="search_library",
                args={"query": "микросервисы"},
                observation="[]",
                ok=True,
            ),
            StepItem(
                index=1,
                tool="web_search",
                args={"query": "рынок микросервисов в рф"},
                observation="[]",
                ok=True,
            ),
        ],
        evidence=[
            EvidenceItem(
                id="e1",
                kind="web",
                ref="https://example.org",
                extract="подробный технический факт о микросервисах " * 20,
            )
        ],
        created_at=now,
        updated_at=now,
    )
    action = DecideAction(tool="web_search", args={"query": "рынок микросервисов в рф"})
    guarded = guard_llm_action(m, action)
    # Must not issue the exact same query that was already done!
    if guarded.tool == "web_search":
        assert guarded.args.get("query") != "рынок микросервисов в рф"
    else:
        assert guarded.tool in ("fetch_url", "run_python", "finish", "block")


def test_unread_library_hits_deduplicates_duplicate_titles_and_caps_steps() -> None:
    from api.services.kursorina.decide import _unread_library_hits

    now = "2026-09-07T00:00:00+00:00"
    # Case 1: multiple duplicate copies of the same document title in evidence
    m = MissionSnapshot(
        id="m-lib-dedup",
        principal_id="u1",
        goal="Разработать список вопросов для Е-лаб",
        status="running",
        steps=[
            StepItem(index=0, tool="search_library", args={"query": "Е-лаб"}, observation="ok", ok=True),
        ],
        evidence=[
            EvidenceItem(
                id="e1",
                kind="library_hit",
                ref="cid-1",
                extract="Матрица рисков: Цель Разработать список вопросов\nСодержимое 1",
            ),
            EvidenceItem(
                id="e2",
                kind="library_hit",
                ref="cid-2",
                extract="Матрица рисков: Цель Разработать список вопросов (копия 2)\nСодержимое 2",
            ),
            EvidenceItem(
                id="e3",
                kind="library_hit",
                ref="cid-3",
                extract="Схема архитектуры: закрытый контур\nДиаграмма 1",
            ),
        ],
        created_at=now,
        updated_at=now,
    )

    unread = _unread_library_hits(m)
    # Must deduplicate the "Матрица рисков" title and return at most 2 distinct documents
    refs = [e.ref for e in unread]
    assert "cid-1" in refs
    assert "cid-2" not in refs  # duplicate title skipped!
    assert "cid-3" in refs
    assert len(unread) == 2

    # Case 2: if 2 read_content steps have already completed successfully, no further library hits block
    m.steps.append(StepItem(index=1, tool="read_content", args={"content_id": "cid-1"}, observation="ok", ok=True))
    m.steps.append(StepItem(index=2, tool="read_content", args={"content_id": "cid-3"}, observation="ok", ok=True))
    assert _unread_library_hits(m) == []


def test_query_for_facet_enriches_company_tech_stack_query() -> None:
    from api.services.kursorina.plan import _FACETS, query_for_facet

    now = "2026-09-07T00:00:00+00:00"
    m = MissionSnapshot(
        id="m-comp-stack",
        principal_id="u1",
        goal="Изучи ООО Е-лаб, определи текущий стек технологий, СУБД, языки программирования и архитектуру",
        status="running",
        steps=[],
        evidence=[],
        created_at=now,
        updated_at=now,
    )
    facet = next(f for f in _FACETS if f.id == "companies")
    q = query_for_facet(m, facet)
    assert "Е-лаб" in q
    assert "стек технологий" in q or "СУБД" in q or "вакансии" in q


def test_synthesize_system_prompt_mandates_exhaustive_chapters_and_questionnaire_matrix() -> None:
    from api.services.kursorina.synthesize import _SYNTH_SYSTEM

    assert "## 1. Аналитическая записка" in _SYNTH_SYSTEM
    assert "## 2. Архитектурная концепция" in _SYNTH_SYSTEM
    assert "## 3. Сводная инженерная матрица брифа" in _SYNTH_SYSTEM
    assert "25–35" in _SYNTH_SYSTEM
    assert "Mermaid" in _SYNTH_SYSTEM
    assert "Unicode" in _SYNTH_SYSTEM


def test_goal_wants_python_detects_technical_assessment_and_conditions_cues() -> None:
    from api.services.kursorina.plan import goal_wants_python

    goal = (
        "Цель: Разработать список вопросов для компании Е-лаб, для описания задач "
        "и технических условий , чтобы определить соответствует ли платформа EliteEW"
    )
    assert goal_wants_python(goal) is True


@pytest.mark.asyncio
async def test_tool_run_python_executes_default_technical_readiness_model() -> None:
    from api.services.kursorina.python_tool import tool_run_python

    goal = "Определить соответствует ли платформа EliteEW условиям компании Е-лаб"
    obs, ev = await tool_run_python(
        code="",
        goal=goal,
        mission_id="test-mid",
    )
    assert "overall_readiness_index_pct" in obs
    assert "domains" in obs
    assert any(e.kind == "python" for e in ev)


def test_draw_line_png_generates_valid_png_with_bars_and_scores() -> None:
    from api.services.kursorina.python_tool import _draw_line_png

    data = _draw_line_png(xs=[1.0, 2.0, 3.0, 4.0], ys=[90.0, 85.0, 95.0, 100.0], title="Индекс готовности")
    assert data.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(data) > 500


def test_polish_product_answer_embeds_chart_image_from_evidence() -> None:
    from api.services.kursorina.synthesize import find_png_chart_evidence, polish_product_answer

    cid = "12345678-1234-1234-1234-123456789abc"
    evidence = [
        EvidenceItem(
            id="e-chart",
            kind="library",
            ref=cid,
            extract=f"technical_readiness_assessment.png bytes=8000 content_id={cid}",
        ),
    ]

    charts = find_png_chart_evidence(evidence)
    assert len(charts) == 1
    assert charts[0][1] == cid

    raw = "## 1. Записка\n\nТекст записки.\n\n## 8. Дорожная карта\n\nТекст дорожной карты."
    polished = polish_product_answer(raw, evidence=evidence)
    assert f"/api/v1/content/{cid}/download" in polished


@pytest.mark.asyncio
@pytest.mark.parametrize("argument", ["code", "script"])
@pytest.mark.parametrize(
    "source",
    [
        "print.__globals__['_security_probe'] = True",
        "save_png.__globals__['_security_probe'] = True",
        "import os\nos.listdir('.')",
        "import socket\nsocket.socket()",
        "import subprocess\nsubprocess.run(['true'])",
        "while True: pass",
        "print(1 + 1)",
        " " * 17000 + "print(2)",
    ],
)
async def test_run_python_blocks_all_custom_source_before_side_effects(argument: str, source: str) -> None:
    from api.services.kursorina import python_tool

    with (
        patch.object(python_tool, "_draw_line_png") as draw,
        patch.object(python_tool, "_save_png_bytes", new_callable=AsyncMock) as save,
    ):
        obs, ev, ok = await run_tool("run_python", {argument: source, "goal": "CAC cash flow"})
    assert "blocked" in obs
    assert not ok
    assert ev == []
    assert not hasattr(python_tool, "_security_probe")
    draw.assert_not_called()
    save.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_python_legacy_retry_cannot_enable_source() -> None:
    from api.services.kursorina.python_tool import tool_run_python

    obs, ev = await tool_run_python("print(2)", goal="CAC", _fallback_used=True)
    assert "blocked" in obs
    assert ev == []


@pytest.mark.asyncio
async def test_run_python_builtin_cashflow_preserves_chart_and_provenance() -> None:
    import json

    from api.services.kursorina import python_tool

    runtime = ToolRuntime(user_id=uuid4())
    saved = [EvidenceItem(id="chart", kind="library", ref="chart-id", extract="forecast.png")]
    with patch.object(python_tool, "_save_png_bytes", new_callable=AsyncMock) as save:
        save.return_value = ("content_id=chart-id", saved)
        obs, ev, ok = await run_tool(
            "run_python",
            {
                "code": " \n\t",
                "goal": "CAC cash flow forecast.png",
                "mission_id": "test-mission",
                "evidence_blob": "CAC 600 ARPU 150 churn 5%",
            },
            runtime=runtime,
        )
    assert ok
    result = json.loads(obs.splitlines()[0])
    assert result["cash_end"] == pytest.approx(-287566.2561268996)
    assert result["customers_end"] == 141.6
    assert result["break_even_month"] is None
    assert result["runway_months_at_end"] == 0.0
    assert ev[0].kind == "python"
    assert ev[1:] == saved
    args = save.await_args.kwargs
    assert args["filename"] == "forecast.png"
    assert args["runtime"] is runtime
    assert args["mission_id"] == "test-mission"
    assert args["data"].startswith(b"\x89PNG\r\n\x1a\n")


@pytest.mark.asyncio
async def test_run_python_unknown_goal_is_unsuccessful() -> None:
    obs, ev, ok = await run_tool("run_python", {"code": "", "goal": "market size"})
    assert "blocked" in obs
    assert ev == []
    assert not ok


@pytest.mark.asyncio
@pytest.mark.parametrize("churn", ["9" * 400, "101"])
async def test_run_python_rejects_invalid_model_input_before_render(churn: str) -> None:
    from api.services.kursorina import python_tool

    with patch.object(python_tool, "_draw_line_png") as draw:
        obs, ev, ok = await run_tool(
            "run_python",
            {
                "code": "",
                "goal": "CAC cash flow",
                "evidence_blob": f"churn {churn}%",
            },
        )
    assert "blocked" in obs
    assert ev == []
    assert not ok
    draw.assert_not_called()


def test_python_permanent_rejection_is_not_rescheduled() -> None:
    from api.services.kursorina.decide import _maybe_run_python, guard_llm_action
    from api.services.kursorina.models import DecideAction

    mission = MissionSnapshot(
        id="rejected-python",
        principal_id="u1",
        goal="CAC cash flow",
        status="running",
        created_at="2026-10-10T00:00:00Z",
        updated_at="2026-10-10T00:00:00Z",
        steps=[
            StepItem(
                index=0,
                tool="run_python",
                args={},
                ok=False,
                observation="run_python blocked: invalid built-in model inputs",
            )
        ],
    )
    assert _maybe_run_python(mission) is None
    assert guard_llm_action(mission, DecideAction(tool="run_python", args={"code": ""})).tool == "block"
    mission.steps = []
    mission.goal = "Use python to calculate 2 + 2"
    assert _maybe_run_python(mission) is None
    for alias in ("code", "script"):
        assert guard_llm_action(mission, DecideAction(tool="run_python", args={alias: "print(2+2)"})).tool == "block"
