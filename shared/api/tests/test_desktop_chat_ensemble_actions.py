# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for ensemble action gate, planner bounds, merge, and capability.
# Invariants:
# - no_capabilities skips honestly; research_plan uses after_rp1.
# Related:
# - api/services/desktop_chat_ensemble/actions/
# ---
"""Tests for Desktop AI Chat ensemble action pack (Wave 1)."""

from __future__ import annotations

from uuid import uuid4

from api.services.desktop_chat_ensemble.actions.agent_planner import _coerce_planned
from api.services.desktop_chat_ensemble.actions.budget import MAX_ACTIONS_PER_PACK
from api.services.desktop_chat_ensemble.actions.capability import resolve_action_capabilities
from api.services.desktop_chat_ensemble.actions.gate import action_gate_enabled, resolve_action_mode
from api.services.desktop_chat_ensemble.actions.merge import (
    build_pack_result,
    format_findings_markdown,
    merge_action_sources_into_rag_ctx,
)
from api.services.desktop_chat_ensemble.actions.query_planner import plan_actions
from api.services.desktop_chat_ensemble.actions.types import (
    ActionResult,
    CapabilitySnapshot,
    PlannedAction,
)


def test_gate_research_plan_after_rp1() -> None:
    caps = CapabilitySnapshot(web=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="research_plan_v1",
        artifact_type="research_plan",
        user_text="нужен план",
        capabilities=caps,
    )
    assert mode == "after_rp1"
    assert reason is None


def test_gate_caa_after_caa2() -> None:
    caps = CapabilitySnapshot(chat_rag=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="code_architecture_audit_v1",
        artifact_type="code_architecture_audit",
        user_text="аудит архитектуры",
        capabilities=caps,
    )
    assert mode == "after_caa2"
    assert reason is None


def test_gate_explicit_verify_pre_step() -> None:
    caps = CapabilitySnapshot(web=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="marketing_brief_v1",
        artifact_type="marketing_brief",
        user_text="Не знаю X — найди в сети и проверь в доках",
        capabilities=caps,
    )
    assert mode == "pre_step"
    assert reason is None


def test_gate_web_armed_pre_step_without_trigger_words() -> None:
    """User toggle web=on is enough — no «найди в сети» required."""
    caps = CapabilitySnapshot(web=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="content_brief_v1",
        artifact_type="content_brief",
        user_text="Соберите обзор рынка для нового оффера",
        capabilities=caps,
    )
    assert mode == "pre_step"
    assert reason is None


def test_gate_skips_when_web_off_and_no_intent() -> None:
    caps = CapabilitySnapshot(chat_rag=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="content_brief_v1",
        artifact_type="content_brief",
        user_text="Напишите короткий пост для сторис",
        capabilities=caps,
    )
    assert mode == "skip"
    assert reason == "not_in_scope"


def test_ensure_web_when_armed_injects_web() -> None:
    from api.services.desktop_chat_ensemble.actions.agent_planner import ensure_web_when_armed

    caps = CapabilitySnapshot(web=True, chat_rag=True, chat_id=uuid4())
    only_rag = [
        PlannedAction(
            action_id="a1",
            kind="chat_rag",
            query="topic",
            rationale="test",
            barrel_id="",
        )
    ]
    out = ensure_web_when_armed(
        only_rag,
        capabilities=caps,
        user_text="мировые практики desktop agents 2026",
    )
    assert out[0].kind == "web"
    assert any(a.kind == "chat_rag" for a in out)


def test_ensure_web_when_armed_short_seed_still_injects() -> None:
    from api.services.desktop_chat_ensemble.actions.agent_planner import ensure_web_when_armed

    caps = CapabilitySnapshot(web=True, chat_id=uuid4())
    out = ensure_web_when_armed([], capabilities=caps, user_text="ок")
    assert len(out) == 1
    assert out[0].kind == "web"
    assert len(out[0].query) >= 8


def test_gate_analysis_intent_pre_step() -> None:
    caps = CapabilitySnapshot(chat_rag=True, chat_id=uuid4())
    mode, reason = resolve_action_mode(
        template_id="marketing_brief_v1",
        artifact_type="marketing_brief",
        user_text="Проведите анализ рынка сельди и проверьте гипотезы",
        capabilities=caps,
    )
    assert mode == "pre_step"
    assert reason is None


def test_gate_skips_without_capabilities() -> None:
    caps = CapabilitySnapshot()
    mode, reason = resolve_action_mode(
        template_id="research_plan_v1",
        artifact_type="research_plan",
        user_text="исследование",
        capabilities=caps,
    )
    assert mode == "skip"
    assert reason == "no_capabilities"


def test_gate_kill_switch() -> None:
    assert action_gate_enabled({}) is True
    assert action_gate_enabled({"ensemble_actions_enabled": False}) is False


def test_capability_web_requires_both_flags() -> None:
    caps = resolve_action_capabilities(
        defaults={"tools_web_search_enabled": True},
        use_web_search=False,
        use_project_rag=False,
        project_id=None,
        chat_id=uuid4(),
    )
    assert caps.web is False
    caps2 = resolve_action_capabilities(
        defaults={"tools_web_search_enabled": True},
        use_web_search=True,
        use_project_rag=True,
        project_id=uuid4(),
        chat_id=uuid4(),
    )
    assert caps2.web is True
    assert caps2.project_vault is True


def test_planner_respects_budget_and_diversity() -> None:
    caps = CapabilitySnapshot(
        web=True,
        chat_rag=True,
        project_vault=True,
        kbsew=True,
        kbsew_barrels=(str(uuid4()),),
        chat_id=uuid4(),
        project_id=uuid4(),
    )
    draft = """
- Гипотеза: B2B покупатели готовы платить за премиум сельдь
- Research question: Какой канал даёт лучший CAC
- Гипотеза: ритейл требует сертификацию партии
"""
    planned = plan_actions(
        user_text="проверьте гипотезы по сельди",
        draft_body=draft,
        capabilities=caps,
    )
    assert 1 <= len(planned) <= MAX_ACTIONS_PER_PACK
    kinds = [p.kind for p in planned]
    assert kinds.count("web") <= 2
    assert kinds.count("kbsew") <= 1
    assert sum(1 for k in kinds if k in {"chat_rag", "project_vault"}) <= 2


def test_merge_findings_and_sources() -> None:
    results = [
        ActionResult(
            action_id="a1",
            kind="web",
            query="сельдь рынок",
            status="ok",
            summary="Источник A",
            context_sources=[
                {
                    "citation_id": "W3",
                    "kind": "web",
                    "authority": "external",
                    "title": "A",
                    "url": "https://example.com/a",
                }
            ],
        ),
        ActionResult(
            action_id="a2",
            kind="chat_rag",
            query="сельдь",
            status="empty",
            summary="Нет фрагментов",
        ),
    ]
    md = format_findings_markdown(results)
    assert "Findings from execution" in md
    assert "empty" in md
    assert "【W3】" in md
    pack = build_pack_result(ran=True, mode="pre_step", skipped_reason=None, results=results)
    assert pack.metadata_payload()["ran"] is True
    assert pack.metadata_payload()["ungrounded"] is False
    assert "W3" in pack.metadata_payload()["citation_ids"]
    rag = merge_action_sources_into_rag_ctx({"context_sources": []}, pack.context_sources)
    assert any(s.get("citation_id") == "W3" for s in rag["context_sources"])


def test_ungrounded_pack_when_only_empty_results() -> None:
    results = [
        ActionResult(
            action_id="a1",
            kind="chat_rag",
            query="brand facts",
            status="empty",
            summary="Нет фрагментов",
        ),
    ]
    md = format_findings_markdown(results)
    assert "Ungrounded" in md
    pack = build_pack_result(ran=True, mode="mid_step", skipped_reason=None, results=results)
    meta = pack.metadata_payload()
    assert meta["ungrounded"] is True
    assert meta["ok_count"] == 0
    assert meta["empty_count"] == 1


def test_capabilities_without_empty_chat_rag_disables_on_zero_prefetch() -> None:
    from api.services.desktop_chat_ensemble.actions.types import capabilities_without_empty_chat_rag

    caps = CapabilitySnapshot(web=True, chat_rag=True, chat_id=uuid4())
    assert capabilities_without_empty_chat_rag(caps, chat_rag_chunks=0).chat_rag is False
    assert capabilities_without_empty_chat_rag(caps, chat_rag_chunks=2).chat_rag is True
    assert capabilities_without_empty_chat_rag(caps, chat_rag_chunks=None).chat_rag is True


def test_findings_markdown_strips_rag_dump_headers() -> None:
    results = [
        ActionResult(
            action_id="a1",
            kind="chat_rag",
            query="сельдь",
            status="ok",
            summary="Фрагмент о сельди",
            detail=(
                "Ниже — релевантные выдержки из вложений этого чата.\n"
                "Ссылки в пользовательском ответе оформляй только как `【C1】`.\n"
                "Никогда не показывай слова RAG/vault.\n\n"
                '[source=C1 kind=chat_attachment excerpt=1 title="note"]\n'
                "Сельдь — важный промысел в регионе.\n"
                "score=0.91 content_id=abc"
            ),
            context_sources=[
                {
                    "citation_id": "C1",
                    "kind": "chat_attachment",
                    "title": "note",
                }
            ],
        ),
    ]
    md = format_findings_markdown(results)
    assert "【C1】" in md
    assert "Сельдь — важный промысел" in md
    assert "source=" not in md
    assert "content_id" not in md.casefold()
    assert "score=" not in md.casefold()
    assert "Ниже — релевантные выдержки" not in md
    assert "Никогда не показывай слова RAG" not in md


def test_agent_planner_coerce_abstain_and_caps() -> None:
    caps = CapabilitySnapshot(web=True, chat_rag=True, chat_id=uuid4())
    assert _coerce_planned({"need_tools": False, "abstain_reason": "enough"}, capabilities=caps) == []
    planned = _coerce_planned(
        {
            "need_tools": True,
            "actions": [
                {"kind": "web_search", "query": "сельдь рынок 2026 факты", "reason": "gap"},
                {"kind": "chat_rag", "query": "сельдь вложения чата", "reason": "gap"},
                {"kind": "web", "query": "ещё один web слишком", "reason": "x"},
                {"kind": "web", "query": "третий web должен отрезаться", "reason": "x"},
            ],
        },
        capabilities=caps,
    )
    assert planned is not None
    assert len(planned) <= MAX_ACTIONS_PER_PACK
    assert sum(1 for p in planned if p.kind == "web") <= 2
    assert any(p.kind == "chat_rag" for p in planned)
