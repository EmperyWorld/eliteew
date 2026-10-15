"""normalized_mime_type — .md / audio extension hints when DB MIME is generic."""

from api.utils.content_mime_normalization import normalized_mime_type


def test_md_plain_to_markdown() -> None:
    assert normalized_mime_type("text/plain", "note.md") == "text/markdown"


def test_md_markdown_unchanged() -> None:
    assert normalized_mime_type("text/markdown", "x.md") == "text/markdown"


def test_md_octet_stream_to_markdown() -> None:
    assert normalized_mime_type("application/octet-stream", "doc.markdown") == "text/markdown"


def test_pdf_plain_unchanged() -> None:
    assert normalized_mime_type("text/plain", "doc.pdf") == "text/plain"


def test_none_mime_md_gets_markdown() -> None:
    assert normalized_mime_type(None, "readme.MD") == "text/markdown"


def test_mp3_octet_stream_to_audio_mpeg() -> None:
    assert normalized_mime_type("application/octet-stream", "song.mp3") == "audio/mpeg"


def test_flac_empty_mime_to_audio_flac() -> None:
    assert normalized_mime_type(None, "track.FLAC") == "audio/flac"


def test_audio_explicit_mime_unchanged() -> None:
    assert normalized_mime_type("audio/mpeg", "song.bin") == "audio/mpeg"


def test_unknown_ext_octet_unchanged() -> None:
    assert normalized_mime_type("application/octet-stream", "data.bin") == "application/octet-stream"
