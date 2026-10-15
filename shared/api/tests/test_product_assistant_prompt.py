# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Поведенческие тесты хелперов промпта справочника (история, RAG query, FAQ, источники).
# Invariants:
# - Без FastAPI/БД; только api.services.product_assistant_prompt_helpers.
# Related:
# - api/routers/product_desktop.py
# ---

from __future__ import annotations

from api.services.product_assistant_prompt_helpers import (
    build_assistant_rag_query,
    build_faq_context_block,
    extract_keyword_snippet,
    format_assistant_chat_history_block,
    guard_assistant_reply_quality,
    is_assistant_reply_degenerate,
    maybe_append_rag_sources_footer,
    merge_rag_content_id_order,
    sanitize_assistant_model_reply,
    score_faq_entry_relevance,
    select_faq_entries_for_prompt,
)


def test_format_assistant_chat_history_block_empty() -> None:
    assert format_assistant_chat_history_block([]) == ""


def test_format_assistant_chat_history_block_orders_and_labels() -> None:
    rows = [
        {"role": "user", "content": "Как открыть плеер?"},
        {"role": "assistant", "content": "Через иконку на столе."},
        {"role": "user", "content": "А если иконки нет?"},
    ]
    block = format_assistant_chat_history_block(rows, max_turns=6, max_chars=8000)
    assert "Пользователь: Как открыть плеер?" in block
    assert "Помощник: Через иконку на столе." in block
    assert "Пользователь: А если иконки нет?" in block
    assert block.index("Как открыть") < block.index("А если")


def test_format_assistant_chat_history_block_truncates_by_chars() -> None:
    rows = [{"role": "user", "content": "x" * 5000}]
    block = format_assistant_chat_history_block(rows, max_chars=100)
    assert len(block) <= 100


def test_build_assistant_rag_query_merges_last_user_turn() -> None:
    history = [
        {"role": "user", "content": "Где музыкальный плеер на рабочем столе?"},
        {"role": "assistant", "content": "На столе или в Пуске."},
    ]
    q = build_assistant_rag_query("А если нет значка?", history)
    assert "музыкальный плеер" in q
    assert "А если нет значка?" in q


def test_build_assistant_rag_query_skips_duplicate_user_text() -> None:
    history = [{"role": "user", "content": "Тот же вопрос"}]
    assert build_assistant_rag_query("Тот же вопрос", history) == "Тот же вопрос"


def test_faq_relevance_prefers_matching_entries() -> None:
    entries = [
        {"question": "Как открыть плеер?", "answer": "Через иконку MusicPlayer."},
        {"question": "Что такое EW?", "answer": "Внутренняя валюта."},
    ]
    picked = select_faq_entries_for_prompt(entries, "музыкальный плеер на столе")
    assert picked[0]["question"].startswith("Как открыть плеер")


def test_build_faq_context_block_includes_relevant_pair() -> None:
    entries = [
        {"question": "Плеер", "answer": "MusicPlayer на столе."},
        {"question": "EW", "answer": "Валюта."},
    ]
    block = build_faq_context_block(entries, "где музыкальный плеер")
    assert "MusicPlayer" in block
    assert score_faq_entry_relevance("плеер", "Плеер", "MusicPlayer") >= 1


def test_maybe_append_rag_sources_footer() -> None:
    out = maybe_append_rag_sources_footer("Ответ.", ["kb-magazin.md", "kb-magazin.md"])
    assert "Источники справочника" in out
    assert "kb-magazin.md" in out


def test_maybe_append_rag_sources_skips_if_already_cited() -> None:
    text = "Ответ.\n\nИсточники: kb-doc.md"
    assert maybe_append_rag_sources_footer(text, ["kb-doc.md"]) == text


def test_extract_keyword_snippet_prefers_matching_paragraph() -> None:
    filler = "нейтральный текст. " * 80
    body = f"{filler}\n\nМузыкальный плеер на рабочем столе открывается через иконку.\n\n{filler}\n\nДругое."
    snippet = extract_keyword_snippet(body, "музыкальный плеер", max_len=120)
    assert "Музыкальный плеер" in snippet
    assert len(snippet) <= 120


def test_merge_rag_content_id_order_vector_first() -> None:
    out = merge_rag_content_id_order(["a"], ["b"], limit=2)
    assert out == ["a", "b"]


def test_merge_rag_content_id_order_skips_duplicate() -> None:
    out = merge_rag_content_id_order(["a"], ["a", "b"], limit=3)
    assert out == ["a", "b"]


def test_format_assistant_chat_history_skips_poisoned_assistant_turn() -> None:
    rows = [
        {"role": "user", "content": "как сделать картинку"},
        {"role": "assistant", "content": "error_error_error " * 40},
        {"role": "user", "content": "Снимок?"},
        {"role": "assistant", "content": "Откройте Image Studio."},
    ]
    block = format_assistant_chat_history_block(rows)
    assert "error_error" not in block
    assert "Image Studio" in block
    assert "Снимок?" in block


def test_sanitize_truncates_dialog_echo() -> None:
    raw = "Ответ про Image Studio.\n\nПользователь: Как найти картинки?\n\nПомощник: повтор..."
    out = sanitize_assistant_model_reply(raw)
    assert out == "Ответ про Image Studio."
    assert "Пользователь:" not in out


def test_sanitize_strips_pomoshchnik_prefix_and_fixes_link_typo() -> None:
    raw = "Помощник:\nСсылка [CM](/__eliteew-desktop-desktop-open-app__/ContentManagerPro)."
    out = sanitize_assistant_model_reply(raw)
    assert not out.lower().startswith("помощник:")
    assert "__eliteew-desktop-desktop-open-app__" not in out


def test_guard_assistant_reply_quality_on_garbage() -> None:
    assert is_assistant_reply_degenerate("error_error " * 20)
    out = guard_assistant_reply_quality("error_error " * 20)
    assert "Не удалось сформировать ответ" in out


def test_detects_r_spam_and_rag_title_leak() -> None:
    sample = "? [AI Чт eт, студии con f r r r r r r r r r r " + "r r " * 40
    assert is_assistant_reply_degenerate(sample)
    out = sanitize_assistant_model_reply(sample)
    assert out == ""


def test_contextual_fallback_for_video_call_question() -> None:
    out = guard_assistant_reply_quality("Süd-Süd-" * 40, user_message="как позвонить")
    assert "VideoCallApp" in out or "GAFChatApp" in out


def test_detects_json_fence_leak_as_degenerate() -> None:
    sample = '```json\n{"reply_markdown": "hello'
    assert is_assistant_reply_degenerate(sample)


def test_detects_underscore_char_spam() -> None:
    assert is_assistant_reply_degenerate("folder_р_а_г_р_а_м_р_а_м_р_а_м_р_а_м_р_а_м_")


def test_contextual_fallback_for_song_question() -> None:
    out = guard_assistant_reply_quality("?", user_message="а как сделать песню")
    assert "MusicForgeApp" in out
    assert "Студия песен" in out
