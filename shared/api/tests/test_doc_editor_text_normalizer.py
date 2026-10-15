# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for shared text/Markdown/HTML normalization used by DocEditor and EWA surfaces.
# Invariants:
# - Text-like documents produce explicit markdown/html/plain projections without calling Tika or LLM.
# Related:
# - api/services/doc_editor_text_normalizer.py
# ---

from __future__ import annotations

from api.services.doc_editor_text_normalizer import normalize_text_document


def test_normalize_markdown_preserves_structure_and_renders_html() -> None:
    doc = normalize_text_document(
        "# Title\n\n- one\n- two",
        filename="notes.md",
        mime_type="text/markdown",
    )

    assert doc.source_format == "markdown"
    assert doc.markdown.startswith("# Title")
    assert "<h1" in doc.rendered_html
    assert "<li>one</li>" in doc.rendered_html
    assert "Title" in doc.plain_text


def test_normalize_html_returns_markdown_and_plain_text() -> None:
    doc = normalize_text_document(
        "<h1>Hello</h1><p>First<br>Second</p>",
        filename="page.html",
        mime_type="text/html",
    )

    assert doc.source_format == "html"
    assert "# Hello" in doc.markdown
    assert "First" in doc.plain_text
    assert "Second" in doc.plain_text
    assert doc.rendered_html.startswith("<h1>")


def test_normalize_plain_text_escapes_editor_html() -> None:
    doc = normalize_text_document(
        "A < B\nC & D",
        filename="note.txt",
        mime_type="text/plain",
    )

    assert doc.source_format == "text"
    assert doc.markdown == "A < B\nC & D"
    assert doc.plain_text == "A < B\nC & D"
    assert "&lt;" in doc.rendered_html
    assert "&amp;" in doc.rendered_html


def test_normalize_glued_markdown_adds_warning() -> None:
    raw = "# A" + (" long" * 180) + "## B"
    doc = normalize_text_document(raw, filename="glued.md", mime_type="text/markdown")

    assert doc.source_format == "markdown"
    assert "markdown_glue_normalized" in doc.warnings
    assert "\n\n## B" in doc.markdown
