# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for companion social_post_compose (intent gates + sidecar LLM handler).
# Invariants:
# - «сделай пост для телеграм …» must route through ``social_post_compose`` and return terminal reply.
# Related:
# - api/ewa_platform/companion/orchestration/companion_social_post_compose.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.orchestration.branch_line_gates import early_tool_branch_may_probe
from api.ewa_platform.companion.orchestration.companion_social_post_compose import (
    extract_social_post_brief,
    format_social_post_body,
    post_quality_needs_polish,
    resolve_social_post_channel,
    user_line_requests_long_form_post,
    user_line_requests_short_post,
    user_line_requests_social_post_compose,
)
from api.ewa_platform.companion.orchestration.routing_policy import OrchestrationBranch


@pytest.mark.unit
def test_post_quality_needs_polish_detects_mba_fluff() -> None:
    sample = (
        "Владивосток — это не просто город, это уникальный инвестиционный кейс, "
        "который невозможно оценивать по стандартным меркам Москвы. "
        "Пока одни ищут жилье, опытные игроки рынка следят за драйвером роста. "
        "Рынок на опережение — кто заберет маржу."
    )
    assert post_quality_needs_polish(sample, channel="telegram") is True


@pytest.mark.unit
def test_post_quality_accepts_formatted_telegram_post() -> None:
    good = (
        "🏙 **Владивосток: где растут цены**\n\n"
        "Короткий заход.\n\n"
        "• **Центр** — дефицит\n"
        "• **Снеговая** — развязки\n\n"
        "Ваш выбор?\n\n"
        "#VL"
    )
    assert post_quality_needs_polish(good, channel="telegram") is False


@pytest.mark.unit
def test_format_social_post_body_splits_wall_of_text() -> None:
    wall = (
        "Владивосток — это не только про море и сопки, но и про один из самых динамичных рынков недвижимости в стране. "
        "Если вы следите за новостями, то заметили, как меняется сама структура спроса. "
        "Классические «панельки» на окраинах всё чаще уступают место современным жилым комплексам. "
        "Сегодня покупка квартиры во Владивостоке — это уже не просто вопрос «где будет удобнее добираться до работы». "
        "Это вопрос качества среды. "
        "А как вы считаете, стоит ли сейчас входить в новостройки? "
        "#недвижимость #владивосток #инвестиции"
    )
    out = format_social_post_body(wall, channel="telegram")
    assert out.count("\n\n") >= 2
    assert out.strip().endswith("#недвижимость #владивосток #инвестиции")
    assert "Владивосток" in out.split("\n\n")[0]


@pytest.mark.unit
def test_short_post_intent_detected() -> None:
    assert user_line_requests_short_post("сделай короткий пост для телеграм") is True
    assert user_line_requests_short_post("сделай пост для телеграм про рынок") is False


@pytest.mark.unit
def test_user_line_generic_social_post_matches() -> None:
    line = "сделай пост про запуск нового продукта — коротко и цепляюще"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "generic"
    assert "запуск" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_user_line_social_networks_explicit_matches() -> None:
    line = "напиши пост для соцсетей про обновление приложения"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "generic"


@pytest.mark.unit
def test_user_line_linkedin_channel() -> None:
    line = "write a LinkedIn post about our hiring push"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "linkedin"


@pytest.mark.unit
def test_user_line_telegram_post_intent_matches() -> None:
    line = "сделай пост для телеграм про запуск нового продукта — коротко и цепляюще"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "telegram"
    assert "запуск" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_user_line_write_post_en_matches() -> None:
    line = "write a Telegram post about our summer release party"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "telegram"


@pytest.mark.unit
def test_user_line_longread_vk_any_topic_matches() -> None:
    line = "сделай лонгрид для VK про киберспорт и турниры — почему локальные команды растут быстрее столичных"
    assert user_line_requests_social_post_compose(line) is True
    assert user_line_requests_long_form_post(line) is True
    assert resolve_social_post_channel(line) == "vk"
    assert "киберспорт" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_user_line_longread_telegram_matches() -> None:
    line = "напиши лонгрид для телеграм про запуск мобильного приложения"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "telegram"
    assert "мобильного" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_user_line_longread_linkedin_en_matches() -> None:
    line = "write a longread for LinkedIn about our open-source release"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "linkedin"
    assert "open-source" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_user_line_longread_generic_channel_matches() -> None:
    line = "сделай лонгрид про обучение детей программированию — без привязки к площадке"
    assert user_line_requests_social_post_compose(line) is True
    assert resolve_social_post_channel(line) == "generic"
    assert "программированию" in extract_social_post_brief(line).lower()


@pytest.mark.unit
def test_long_form_disables_short_mode() -> None:
    line = "сделай короткий лонгрид для VK про музыку"
    assert user_line_requests_long_form_post(line) is True
    assert user_line_requests_short_post(line) is False


@pytest.mark.unit
def test_catalog_discuss_skipped_when_social_post_intent() -> None:
    line = "сделай пост для телеграм на основе документа notes.md"
    assert user_line_requests_social_post_compose(line) is True
    assert early_tool_branch_may_probe("catalog_discuss", line, {}, principal_id="u1") is False
    assert early_tool_branch_may_probe("social_post_compose", line, {}, principal_id="u1") is True


@pytest.mark.unit
def test_casual_chat_does_not_match_post_compose() -> None:
    line = "расскажи что такое телеграм каналы"
    assert user_line_requests_social_post_compose(line) is False


@pytest.mark.unit
def test_early_tool_gate_social_post_compose() -> None:
    line = "напиши пост для телеграм про обновление приложения"
    assert early_tool_branch_may_probe("social_post_compose", line, {}, principal_id="u1") is True
    assert early_tool_branch_may_probe("social_post_compose", "привет", {}, principal_id="u1") is False


@pytest.mark.unit
def test_pipeline_order_social_post_after_catalog_discuss() -> None:
    from api.ewa_platform.companion.orchestration.routing_policy import ORCHESTRATION_PIPELINE_ORDER

    order = ORCHESTRATION_PIPELINE_ORDER
    assert order.index(OrchestrationBranch.CATALOG_DISCUSS) < order.index(OrchestrationBranch.SOCIAL_POST_COMPOSE)
    assert order.index(OrchestrationBranch.SOCIAL_POST_COMPOSE) < order.index(OrchestrationBranch.CATALOG_LIST)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_handle_social_post_compose_generic_reply_header() -> None:
    line = "сделай пост про новый релиз EliteEW"
    ctx = reg.ToolContext(
        principal_id="principal-1",
        user_line=line,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    fake_post = "Релиз уже в проде — заходите смотреть."

    with patch(
        "api.ewa_platform.companion.orchestration.companion_social_post_compose.compose_social_post_text",
        new=AsyncMock(return_value=fake_post),
    ):
        result = await reg.dispatch_tool_by_name("social_post_compose", {"user_line": line}, ctx)

    assert result is not None
    reply = str(result.get("reply") or "")
    assert "Telegram" not in reply
    assert "Лонгрид" in reply or "Готовый пост" in reply
    assert fake_post in reply


@pytest.mark.unit
@pytest.mark.asyncio
async def test_handle_social_post_compose_returns_formatted_reply() -> None:
    line = "сделай пост для телеграм про новый релиз EliteEW"
    ctx = reg.ToolContext(
        principal_id="principal-1",
        user_line=line,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    fake_post = "**Новый релиз EliteEW уже здесь**\n\nКороткий абзац с сутью.\n\n#EliteEW #release"

    with patch(
        "api.ewa_platform.companion.orchestration.companion_social_post_compose.compose_social_post_text",
        new=AsyncMock(return_value=fake_post),
    ):
        result = await reg.dispatch_tool_by_name("social_post_compose", {"user_line": line}, ctx)

    assert result is not None
    assert result.get("status") == "ok"
    reply = str(result.get("reply") or "")
    assert "Telegram" in reply
    assert fake_post in reply
    data = result.get("data") or {}
    assert data.get("channel") == "telegram"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_handle_social_post_compose_with_source_doc(monkeypatch: pytest.MonkeyPatch) -> None:
    line = "сделай пост для телеграм на основе файла roadmap.md про Q3"
    ctx = reg.ToolContext(
        principal_id="principal-1",
        user_line=line,
        content_catalog_user_id="user-1",
        oauth2_sub_for_content_alternate=None,
    )
    source_text = "Q3 goals: launch mobile OTA, polish desktop shell."

    async def _fake_source(_ctx: Any, _line: str) -> tuple[str, str] | None:
        return source_text, "roadmap.md"

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.companion_social_post_compose._resolve_post_source_document",
        _fake_source,
    )

    captured: dict[str, Any] = {}

    async def _fake_compose(**kwargs: Any) -> str:
        captured.update(kwargs)
        return "Post grounded on roadmap."

    with patch(
        "api.ewa_platform.companion.orchestration.companion_social_post_compose.compose_social_post_text",
        side_effect=_fake_compose,
    ):
        result = await reg.dispatch_tool_by_name("social_post_compose", {"user_line": line}, ctx)

    assert result is not None
    assert result.get("status") == "ok"
    assert captured.get("source_text") == source_text
    assert captured.get("source_label") == "roadmap.md"
    assert "roadmap.md" in str(result.get("reply") or "")
