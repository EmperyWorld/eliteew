"""Tests for editor replace-file blob normalization (.md / .txt)."""

from api.helpers.markdown_storage_normalize import (
    maybe_convert_html_payload_to_markdown_for_md_filename,
    maybe_convert_html_payload_to_plain_for_txt_filename,
)


def test_md_filename_html_payload_converts() -> None:
    html = "<h1>Hi</h1><p>Line one.</p><p>Line two.</p>"
    raw = html.encode("utf-8")
    out, converted = maybe_convert_html_payload_to_markdown_for_md_filename("note.md", raw)
    assert converted is True
    text = out.decode("utf-8")
    assert "# Hi" in text
    assert "Line one." in text
    assert text.endswith("\n")


def test_html_filename_unchanged() -> None:
    raw = b"<p>x</p>"
    out, converted = maybe_convert_html_payload_to_markdown_for_md_filename("note.html", raw)
    assert converted is False
    assert out == raw


def test_md_payload_unchanged() -> None:
    raw = b"# Title\n\nHello\n"
    out, converted = maybe_convert_html_payload_to_markdown_for_md_filename("note.md", raw)
    assert converted is False
    assert out == raw


def test_txt_filename_html_payload_converts_to_plain() -> None:
    html = "<p>Line one.</p><p>Line two.</p>"
    raw = html.encode("utf-8")
    out, converted = maybe_convert_html_payload_to_plain_for_txt_filename("notes.txt", raw)
    assert converted is True
    text = out.decode("utf-8")
    assert "Line one." in text
    assert "Line two." in text
    assert text.endswith("\n")


def test_txt_payload_unchanged() -> None:
    raw = b"hello\nworld\n"
    out, converted = maybe_convert_html_payload_to_plain_for_txt_filename("notes.txt", raw)
    assert converted is False
    assert out == raw
