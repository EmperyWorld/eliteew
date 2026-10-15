# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Тесты JSON-контракта ответа справочника (reply_markdown, SSE chunks).
# Invariants:
# - Без FastAPI/БД.
# Related:
# - api/services/product_assistant_llm_contract.py
# ---

from __future__ import annotations

from api.services.product_assistant_llm_contract import (
    iter_assistant_reply_sse_chunks,
    parse_assistant_reply_markdown,
)


def test_parse_assistant_reply_markdown_from_json() -> None:
    raw = (
        '{"reply_markdown": "Откройте [плеер](/__eliteew-desktop-open-app__/MusicPlayer).", "off_topic_refusal": false}'
    )
    reply, ok = parse_assistant_reply_markdown(raw)
    assert ok is True
    assert "MusicPlayer" in reply


def test_parse_assistant_reply_markdown_strips_thinking_prefix() -> None:
    raw = '<|channel|>thought\n{"reply_markdown": "Краткий ответ про EliteEW.", "off_topic_refusal": false}'
    reply, ok = parse_assistant_reply_markdown(raw)
    assert ok is True
    assert reply.startswith("Краткий")


def test_parse_assistant_reply_markdown_legacy_free_text_fallback() -> None:
    raw = "Помощник: Просто текст без JSON."
    reply, ok = parse_assistant_reply_markdown(raw)
    assert ok is False
    assert "Просто текст" in reply


def test_parse_assistant_reply_markdown_empty_json_field() -> None:
    raw = '{"reply_markdown": "   "}'
    reply, ok = parse_assistant_reply_markdown(raw)
    assert ok is False
    assert reply


def test_parse_assistant_reply_markdown_salvages_truncated_json_fence() -> None:
    raw = (
        '```json\n{"reply_markdown": "Откройте '
        '[Студию изображений](/__eliteew-desktop-open-app__/ImageStudio).", "off_topic_refusal": false'
    )
    reply, ok = parse_assistant_reply_markdown(raw, user_message="как открыть картинки")
    assert ok is False
    assert "ImageStudio" in reply
    assert "```json" not in reply


def test_parse_assistant_reply_markdown_rejects_underscore_spam() -> None:
    raw = '{"reply_markdown": "Г_и_р_а_м_и_н_к_и в папкам ' + "_р_а_м_р_а_м_р_а_м_" * 20 + '"}'
    reply, ok = parse_assistant_reply_markdown(raw, user_message="как открыть картинки")
    assert ok in (True, False)
    assert "_р_а_м_" not in reply
    assert "ImageStudio" in reply or "Не удалось" in reply


def test_parse_assistant_reply_markdown_rejects_hyphen_loop_spam() -> None:
    raw = '{"reply_markdown": "' + "Süd-Süd-" * 40 + '"}'
    reply, _ok = parse_assistant_reply_markdown(raw, user_message="как позвонить")
    assert "Süd-Süd" not in reply
    assert "VideoCallApp" in reply or "GAFChatApp" in reply or "Не удалось" in reply


def test_salvage_assistant_reply_markdown_picks_longest_block() -> None:
    raw = (
        '```json\n{"reply_markdown": "коротко"}\n```\n'
        '```json\n{"reply_markdown": "Длинный ответ про [ImageStudio](/__eliteew-desktop-open-app__/ImageStudio)."}\n'
    )
    from api.services.product_assistant_llm_contract import salvage_assistant_reply_markdown

    salvaged = salvage_assistant_reply_markdown(raw)
    assert salvaged is not None
    assert "ImageStudio" in salvaged


def test_iter_assistant_reply_sse_chunks() -> None:
    text = "abcdef"
    chunks = iter_assistant_reply_sse_chunks(text, chunk_size=2)
    assert chunks == ["ab", "cd", "ef"]
