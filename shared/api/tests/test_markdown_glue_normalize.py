"""Tests for glued-markdown line-break heuristics (JTBD / AI exports)."""

from api.services.markdown_glue_normalize import (
    markdown_needs_glue_normalization,
    normalize_glued_markdown_text,
)


def test_needs_glue_single_long_line():
    blob = "a" * 500
    assert markdown_needs_glue_normalization(blob) is True


def test_needs_glue_false_short():
    assert markdown_needs_glue_normalization("# Hello\n\nWorld") is False


def test_normalize_glued_heading_after_word():
    raw = 'в операционке## СЕГМЕНТ 2: "ОДИНОЧКА"'
    out = normalize_glued_markdown_text(raw)
    assert "\n\n## СЕГМЕНТ 2:" in out
    assert "операционке" in out


def test_normalize_glued_trigger_label():
    raw = "Собственник в операционкеТриггер: «Опять всё встало»"
    out = normalize_glued_markdown_text(raw)
    assert "операционке" in out
    assert "\n\nТриггер:" in out


def test_normalize_dash_heading():
    raw = "конец секции---# 2. ЦЕННОСТНЫЕ ПРЕДЛОЖЕНИЯ"
    out = normalize_glued_markdown_text(raw)
    assert "\n\n---\n\n# 2." in out


def test_needs_glue_many_newlines_short_lines():
    md = "\n".join(["# H", "p", "q", "r", "s", "t", "u", "v", "w", "x"])
    assert markdown_needs_glue_normalization(md) is False
