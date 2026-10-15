"""Desktop folder IDs tied to tenant/marketing projects (Content Manager integration)."""

from __future__ import annotations

from uuid import UUID

PROJECT_DESKTOP_FOLDER_PREFIX = "eliteew-proj-"


def project_desktop_folder_item_id(project_id: UUID) -> str:
    return f"{PROJECT_DESKTOP_FOLDER_PREFIX}{project_id}"


def parse_project_id_from_desktop_folder_item_id(item_id: str) -> UUID | None:
    if not item_id or not item_id.startswith(PROJECT_DESKTOP_FOLDER_PREFIX):
        return None
    rest = item_id[len(PROJECT_DESKTOP_FOLDER_PREFIX) :].strip()
    if not rest:
        return None
    try:
        return UUID(rest)
    except ValueError:
        return None
