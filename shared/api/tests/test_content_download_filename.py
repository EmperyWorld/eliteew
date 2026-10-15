"""build_content_disposition_filename — имя скачивания как в UI, расширение из slug."""

from api.utils.content_download_filename import (
    build_content_disposition_filename,
    display_name_for_content_download,
)


def test_display_title_plus_ext_from_original() -> None:
    assert (
        build_content_disposition_filename(
            "Чат: Группировка",
            "desktop-ai-chat_Чат_Группировка_ecf49fb9.md",
        )
        == "Чат Группировка.md"
    )


def test_display_already_has_ext() -> None:
    assert (
        build_content_disposition_filename(
            "Notes.md",
            "slug_ecf49fb9.md",
        )
        == "Notes.md"
    )


def test_fallback_original_when_name_empty() -> None:
    assert build_content_disposition_filename(" ", "only.md") == "only.md"


def test_name_only_no_original() -> None:
    assert build_content_disposition_filename("Title", None) == "Title"


def test_display_name_prefers_title_over_name() -> None:
    assert display_name_for_content_download("Версия A", "internal_name") == "Версия A"


def test_display_name_falls_back_to_name() -> None:
    assert display_name_for_content_download(None, "internal_name") == "internal_name"
    assert display_name_for_content_download("", "internal_name") == "internal_name"


def test_download_uses_title_for_extension_merge() -> None:
    assert (
        build_content_disposition_filename(
            display_name_for_content_download("Мой отчёт", "old_slug"),
            "upload_abc.md",
        )
        == "Мой отчёт.md"
    )
