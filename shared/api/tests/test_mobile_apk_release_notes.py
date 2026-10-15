"""
Behavioral tests for skipped-version OTA release notes aggregation (API).
"""

from __future__ import annotations

from api.services.mobile_apk_metadata import MobileReleaseNotesHistoryEntry
from api.services.mobile_apk_release_notes import aggregate_ota_release_notes

_HISTORY = (
    MobileReleaseNotesHistoryEntry(120, "0.2.110", "OTA one-click"),
    MobileReleaseNotesHistoryEntry(121, "0.2.111", "Notifications cleanup"),
    MobileReleaseNotesHistoryEntry(122, "0.2.112", "Appearance unified"),
    MobileReleaseNotesHistoryEntry(123, "0.2.113", "Privacy and friends UX"),
    MobileReleaseNotesHistoryEntry(124, "0.2.114", "Files and trusted badge"),
    MobileReleaseNotesHistoryEntry(125, "0.2.115", "UGS list layout"),
    MobileReleaseNotesHistoryEntry(126, "0.2.116", "Music mini player"),
)


def test_aggregate_returns_none_when_no_update() -> None:
    assert (
        aggregate_ota_release_notes(
            installed_version_code=123,
            server_version_code=123,
            server_version_name="0.2.113",
            current_release_notes="Latest",
            history=_HISTORY,
        )
        is None
    )


def test_single_step_uses_current_release_notes() -> None:
    assert (
        aggregate_ota_release_notes(
            installed_version_code=122,
            server_version_code=123,
            server_version_name="0.2.113",
            current_release_notes="Latest only",
            history=_HISTORY,
        )
        == "Latest only"
    )


def test_multi_step_includes_intermediate_versions() -> None:
    aggregated = aggregate_ota_release_notes(
        installed_version_code=123,
        server_version_code=126,
        server_version_name="0.2.116",
        current_release_notes="Music mini player",
        history=_HISTORY,
    )
    assert aggregated is not None
    assert aggregated.startswith("Вы пропустили несколько обновлений")
    assert "Версия 0.2.114" in aggregated
    assert "Files and trusted badge" in aggregated
    assert "Версия 0.2.115" in aggregated
    assert "Версия 0.2.116" in aggregated
    assert "Music mini player" in aggregated


def test_without_installed_version_code_returns_current_only() -> None:
    assert (
        aggregate_ota_release_notes(
            installed_version_code=None,
            server_version_code=126,
            server_version_name="0.2.116",
            current_release_notes="Music mini player",
            history=_HISTORY,
        )
        == "Music mini player"
    )
