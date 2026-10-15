# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for shared/apps product manifests and KNOWN union loader.
# Invariants:
# - Gold manifests (notifications, project_about) load and contribute app_components.
# - Overlap between manifest and legacy fails closed.
# Related:
# - api/services/desktop_app_manifests/
# - shared/apps/README.md
# ---

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS
from api.services.desktop_app_manifests.loader import (
    build_known_desktop_app_components,
    load_manifests,
    validate_all,
)


def test_known_includes_gold_manifest_components() -> None:
    assert "NotificationsApp" in KNOWN_DESKTOP_APP_COMPONENTS
    assert "ProjectAboutApp" in KNOWN_DESKTOP_APP_COMPONENTS


def test_gold_manifests_load() -> None:
    manifests = {m.id: m for m in load_manifests()}
    expected = {
        "notifications": "NotificationsApp",
        "calendar": "CalendarApp",
        "project_about": "ProjectAboutApp",
        "clipboard": "ClipboardManager",
        "feedback_hub": "FeedbackHubApp",
        "survey_hub": "SurveyHubApp",
        "music_player": "MusicPlayer",
        "ewdesk": "EWDeskApp",
        "app_store": "AppStore",
        "assistant": "AssistantApp",
        "desktop_ai_chat": "DesktopAiChatApp",
        "poemma": "PoemmaApp",
        "local_service_iframe": "LocalServiceIframeApp",
        "customer_cabinet": "CustomerCabinet",
        "social_hub": "SocialHubApp",
        "friends": "FriendsApp",
        "user_site_studio": "UserSiteStudio",
        "unified_admin": "UnifiedAdminApp",
        "kirs_curation": "KirsCuration",
    }
    for mid, component in expected.items():
        assert mid in manifests
        assert manifests[mid].surfaces.desktop.app_component == component
        assert component in KNOWN_DESKTOP_APP_COMPONENTS


def test_legacy_excludes_migrated_components() -> None:
    from api.services.desktop_app_manifests.loader import load_legacy_components

    legacy = load_legacy_components()
    for component in (
        "NotificationsApp",
        "CalendarApp",
        "ProjectAboutApp",
        "ClipboardManager",
        "FeedbackHubApp",
        "SurveyHubApp",
        "MusicPlayer",
        "EWDeskApp",
        "AppStore",
        "AssistantApp",
        "DesktopAiChatApp",
        "PoemmaApp",
        "LocalServiceIframeApp",
        "CustomerCabinet",
        "SocialHubApp",
        "FriendsApp",
        "UserSiteStudio",
        "UnifiedAdminApp",
        "KirsCuration",
    ):
        assert component not in legacy
    assert len(legacy) == 24


def test_validate_all_passes_on_repo_apps() -> None:
    lines = validate_all()
    assert any(line.startswith("ok manifest") for line in lines)
    assert any("notifications" in line for line in lines)
    assert any(line.startswith("fe_known_generated=") for line in lines)
    from api.services.desktop_app_manifests.loader import known_fe_generated_path

    fe_path = known_fe_generated_path()
    assert fe_path.is_file()
    payload = json.loads(fe_path.read_text(encoding="utf-8"))
    assert payload["count"] == len(payload["app_components"])
    assert "NotificationsApp" in payload["app_components"]


def test_overlap_manifest_and_legacy_fails(tmp_path: Path) -> None:
    app_dir = tmp_path / "notifications"
    app_dir.mkdir()
    (app_dir / "app.manifest.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "notifications",
                "title": "Notification Center",
                "edition_default": {"cloud": True, "onprem": True, "client": True},
                "requires": ["auth"],
                "surfaces": {"desktop": {"app_component": "NotificationsApp"}},
            }
        ),
        encoding="utf-8",
    )
    legacy_dir = tmp_path / "_legacy"
    legacy_dir.mkdir()
    (legacy_dir / "known_desktop_app_components.legacy.json").write_text(
        json.dumps({"app_components": ["NotificationsApp", "AppStore"]}),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="both manifests and legacy"):
        build_known_desktop_app_components(tmp_path)


def test_duplicate_manifest_app_component_fails(tmp_path: Path) -> None:
    for name in ("a", "b"):
        d = tmp_path / name
        d.mkdir()
        (d / "app.manifest.yaml").write_text(
            yaml.safe_dump(
                {
                    "id": name,
                    "title": name,
                    "edition_default": {"cloud": True, "onprem": True, "client": True},
                    "requires": ["auth"],
                    "surfaces": {"desktop": {"app_component": "SameApp"}},
                }
            ),
            encoding="utf-8",
        )
    legacy_dir = tmp_path / "_legacy"
    legacy_dir.mkdir()
    (legacy_dir / "known_desktop_app_components.legacy.json").write_text(
        json.dumps({"app_components": ["AppStore"]}),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="duplicate app_component"):
        build_known_desktop_app_components(tmp_path)
