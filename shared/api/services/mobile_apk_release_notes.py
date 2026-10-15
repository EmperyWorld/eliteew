#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Aggregate OTA release notes when the client skipped multiple versionCode steps.
# Invariants:
# - User-facing aggregated text is Russian plain language; entries sorted by version_code ascending.
# Related:
# - api.routers.mobile_app, api.services.mobile_apk_metadata
# ---

from __future__ import annotations

from api.services.mobile_apk_metadata import MobileReleaseNotesHistoryEntry


def aggregate_ota_release_notes(
    *,
    installed_version_code: int | None,
    server_version_code: int | None,
    server_version_name: str | None,
    current_release_notes: str | None,
    history: tuple[MobileReleaseNotesHistoryEntry, ...] | list[MobileReleaseNotesHistoryEntry],
) -> str | None:
    """Build Profile → Updates notes for a multi-step OTA jump."""

    if server_version_code is None or server_version_code <= 0:
        return _trim_notes(current_release_notes)
    if installed_version_code is None or installed_version_code <= 0:
        return _trim_notes(current_release_notes)
    if server_version_code <= installed_version_code:
        return None

    delta = server_version_code - installed_version_code
    current = _trim_notes(current_release_notes)
    normalized_history = _history_in_update_range(
        history,
        installed_version_code=installed_version_code,
        server_version_code=server_version_code,
    )
    if not normalized_history and current:
        normalized_history = _synthetic_current_entry(
            server_version_code=server_version_code,
            server_version_name=server_version_name,
            current_release_notes=current,
        )
    elif current and not any(entry.version_code == server_version_code for entry in normalized_history):
        normalized_history = (
            *normalized_history,
            MobileReleaseNotesHistoryEntry(
                version_code=server_version_code,
                version_name=(server_version_name or str(server_version_code)).strip(),
                release_notes=current,
            ),
        )

    if delta <= 1 or not normalized_history:
        return current

    blocks = [_format_history_block(entry) for entry in normalized_history]
    return ("Вы пропустили несколько обновлений. Что изменилось:\n\n" + "\n\n".join(blocks)).strip()


def _history_in_update_range(
    history: tuple[MobileReleaseNotesHistoryEntry, ...] | list[MobileReleaseNotesHistoryEntry],
    *,
    installed_version_code: int,
    server_version_code: int,
) -> tuple[MobileReleaseNotesHistoryEntry, ...]:
    seen: set[int] = set()
    entries: list[MobileReleaseNotesHistoryEntry] = []
    for entry in history:
        if entry.version_code in seen:
            continue
        if entry.version_code <= installed_version_code or entry.version_code > server_version_code:
            continue
        seen.add(entry.version_code)
        entries.append(entry)
    entries.sort(key=lambda item: item.version_code)
    return tuple(entries)


def _synthetic_current_entry(
    *,
    server_version_code: int,
    server_version_name: str | None,
    current_release_notes: str,
) -> tuple[MobileReleaseNotesHistoryEntry, ...]:
    return (
        MobileReleaseNotesHistoryEntry(
            version_code=server_version_code,
            version_name=(server_version_name or str(server_version_code)).strip(),
            release_notes=current_release_notes,
        ),
    )


def _format_history_block(entry: MobileReleaseNotesHistoryEntry) -> str:
    body = _trim_notes(entry.release_notes)
    if not body:
        return f"Версия {entry.version_name}"
    return f"Версия {entry.version_name}\n{body}"


def _trim_notes(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
