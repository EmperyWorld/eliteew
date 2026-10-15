"""HTML-in-.md detection and plain-text extraction."""

from api.services.html_fragment_extract import (
    html_fragment_to_plain_text,
    looks_like_html_fragment,
)


def test_looks_like_html_fragment_positive():
    s = '<h1 style="text-align: left;">Title</h1><p>x</p>'
    assert looks_like_html_fragment(s) is True


def test_looks_like_html_fragment_markdown_negative():
    s = "# Title\n\nParagraph with **bold**.\n"
    assert looks_like_html_fragment(s) is False


def test_html_fragment_to_plain_removes_tags_and_br():
    s = "<p>Line one<br/>Line two</p><p>Second block</p>"
    out = html_fragment_to_plain_text(s)
    assert "Line one" in out
    assert "Line two" in out
    assert "Second block" in out
    assert "<p>" not in out


def test_html_h1_glued_plain():
    s = (
        '<h1 style="text-align: left;">JTBD</h1>'
        '<h1 style="text-align: left;">## СЕГМЕНТ 1</h1>'
        "<h1>операционкеТриггер: «Опять»</h1>"
    )
    out = html_fragment_to_plain_text(s)
    assert "JTBD" in out
    assert "СЕГМЕНТ" in out
    assert "операционке" in out
    assert "Триггер:" in out
