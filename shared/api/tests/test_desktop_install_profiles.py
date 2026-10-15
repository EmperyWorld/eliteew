# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for install profiles over shared/apps manifests.
# Invariants:
# - edition_default is a hard floor (profile cannot enable false edition).
# - allowlist unknown ids fail; include_legacy only on cloud-full.
# Related:
# - api/services/desktop_app_manifests/profiles.py
# ---

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from api.services.desktop_app_manifests.loader import load_legacy_components, load_manifests
from api.services.desktop_app_manifests.profiles import (
    InstallProfile,
    is_app_component_enabled,
    load_profile,
    resolve_enabled_app_components,
    validate_profiles,
)


def test_builtin_profiles_validate() -> None:
    lines = validate_profiles()
    assert any("cloud-full" in line for line in lines)
    assert any("onprem-team-core" in line for line in lines)
    assert any("client-offline-ai" in line for line in lines)
    assert any("fofline-connected" in line for line in lines)


def test_builtin_profile_access_contract() -> None:
    onprem = load_profile("onprem-team-core")
    assert onprem.access_mode == "community"
    assert onprem.seat_activation_required is False

    cloud = load_profile("cloud-full")
    assert cloud.access_mode == "managed"
    assert cloud.seat_activation_required is False

    client = load_profile("client-offline-ai")
    assert client.access_mode == "managed"
    assert client.seat_activation_required is True

    fofline = load_profile("fofline-connected")
    assert fofline.access_mode == "managed"
    assert fofline.seat_activation_required is True


def test_install_profile_api_schema_exposes_access_contract() -> None:
    from api.routers.desktop_install_profile import DesktopInstallProfileResponse

    schema = DesktopInstallProfileResponse.model_json_schema()
    assert schema["properties"]["schema_version"]["default"] == 3
    assert {"access_mode", "seat_activation_required"} <= set(schema["required"])


def test_community_profile_cannot_require_seat_activation() -> None:
    with pytest.raises(ValueError, match="access_mode=community cannot require seat activation"):
        InstallProfile.model_validate(
            {
                "id": "invalid-community",
                "title": "Invalid community",
                "edition": "onprem",
                "mode": "edition_default",
                "access_mode": "community",
                "seat_activation_required": True,
            }
        )


def test_fofline_connected_surface_scoped() -> None:
    comps = resolve_enabled_app_components("fofline-connected")
    assert "EwaApp" in comps
    assert "ContentManagerPro" in comps
    assert "UGS" in comps
    assert "UserProfile" in comps
    assert "NotificationsApp" in comps
    assert "AssistantApp" in comps  # Handbook / Справочник
    assert "DesktopAiChatApp" not in comps  # Experts not on FoFline surface
    assert "GAFChatApp" in comps
    assert "VideoCallApp" in comps
    assert "CalendarApp" in comps
    assert "DocEditorV2" in comps
    assert "EWRP" in comps
    assert "ImageStudio" in comps
    assert "SocialHubApp" in comps
    assert "SurveyHubApp" in comps
    assert "KursorinaApp" in comps
    assert "EBrowserApp" in comps
    assert "ProfessionalWorlds" in comps
    assert "DocEditor" not in comps
    assert "Presentations" not in comps
    assert "MusicForgeApp" not in comps
    assert "MarketingCabinet" not in comps
    assert "UnifiedAdminApp" not in comps
    assert load_profile("fofline-connected").edition == "cloud"
    assert load_profile("fofline-connected").include_legacy is False


def test_cloud_full_includes_legacy_and_notifications() -> None:
    comps = resolve_enabled_app_components("cloud-full")
    assert "NotificationsApp" in comps
    assert "CalendarApp" in comps
    assert "DesktopAiChatApp" in comps  # first-class manifest (not legacy)
    assert "AssistantApp" in comps
    assert "EwaApp" in comps  # still legacy
    cloud_manifest_components = {
        manifest.surfaces.desktop.app_component for manifest in load_manifests() if manifest.edition_default.cloud
    }
    expected = cloud_manifest_components | set(load_legacy_components())
    assert comps == expected


def test_onprem_core_excludes_marketing_and_legacy() -> None:
    comps = resolve_enabled_app_components("onprem-team-core")
    assert "NotificationsApp" in comps
    assert "CalendarApp" in comps
    assert "AssistantApp" in comps
    assert "DesktopAiChatApp" in comps  # allowlisted desktop_ai_chat
    assert "MarketingCabinet" not in comps
    assert "UnifiedAdminApp" not in comps
    assert "CustomerCabinet" not in comps
    assert "EwaApp" not in comps  # legacy not included
    assert "FriendsApp" not in comps  # not on allowlist


def test_assistant_handbook_is_not_smart_chat_manifest() -> None:
    """desktop-ai-chat-027: editions dual was a naming collision, not one product."""
    by_id = {m.id: m for m in load_manifests()}
    assert by_id["assistant"].title == "Reference Navigation"
    assert by_id["assistant"].surfaces.desktop.app_component == "AssistantApp"
    assert by_id["desktop_ai_chat"].title == "Experts"
    assert by_id["desktop_ai_chat"].surfaces.desktop.app_component == "DesktopAiChatApp"
    assert by_id["assistant"].surfaces.desktop.app_component != (
        by_id["desktop_ai_chat"].surfaces.desktop.app_component
    )


def test_client_offline_only_client_edition_defaults() -> None:
    comps = resolve_enabled_app_components("client-offline-ai")
    assert "NotificationsApp" in comps
    assert "ClipboardManager" in comps
    assert "ProjectAboutApp" in comps
    assert "FeedbackHubApp" not in comps  # client:false
    assert "EwaApp" not in comps


def test_profile_cannot_enable_against_edition_floor(tmp_path: Path) -> None:
    apps = tmp_path
    (apps / "only_cloud").mkdir()
    (apps / "only_cloud" / "app.manifest.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "only_cloud",
                "title": "Cloud only",
                "edition_default": {"cloud": True, "onprem": False, "client": False},
                "requires": ["auth"],
                "surfaces": {"desktop": {"app_component": "OnlyCloudApp"}},
            }
        ),
        encoding="utf-8",
    )
    legacy = apps / "_legacy"
    legacy.mkdir()
    (legacy / "known_desktop_app_components.legacy.json").write_text(
        json.dumps({"app_components": []}),
        encoding="utf-8",
    )
    profiles = apps / "_profiles"
    profiles.mkdir()
    (profiles / "bad.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "bad-onprem",
                "title": "Bad",
                "edition": "onprem",
                "mode": "allowlist",
                "access_mode": "community",
                "seat_activation_required": False,
                "include_legacy": False,
                "apps": ["only_cloud"],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="resolved zero components"):
        resolve_enabled_app_components("bad-onprem", root=apps)


def test_is_app_component_enabled_helper() -> None:
    assert is_app_component_enabled("NotificationsApp", "cloud-full")
    assert not is_app_component_enabled("MarketingCabinet", "onprem-team-core")
    assert load_profile("client-offline-ai").edition == "client"


def test_runtime_defaults_to_cloud_full(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from api.services.desktop_app_manifests import runtime as rt

    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(eliteew_product_edition="cloud", eliteew_install_profile=""),
        raising=False,
    )
    # Patch the import site used inside runtime
    monkeypatch.setattr(
        rt,
        "_settings_edition_and_profile",
        lambda: ("cloud", ""),
    )
    rt.clear_active_install_cache()
    snap = rt.get_active_install_snapshot()
    assert snap.profile_id == "cloud-full"
    assert snap.edition == "cloud"
    assert snap.access_mode == "managed"
    assert snap.seat_activation_required is False
    assert "NotificationsApp" in snap.enabled_app_components
    assert "EwaApp" in snap.enabled_app_components


def test_runtime_edition_derives_onprem_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_app_manifests import runtime as rt

    monkeypatch.setattr(rt, "_settings_edition_and_profile", lambda: ("onprem", ""))
    rt.clear_active_install_cache()
    snap = rt.get_active_install_snapshot()
    assert snap.profile_id == "onprem-team-core"
    assert snap.access_mode == "community"
    assert snap.seat_activation_required is False
    assert "MarketingCabinet" not in snap.enabled_app_components
    assert "NotificationsApp" in snap.enabled_app_components


def test_runtime_dual_flag_conflict_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_app_manifests import runtime as rt

    monkeypatch.setattr(rt, "_settings_edition_and_profile", lambda: ("onprem", "cloud-full"))
    rt.clear_active_install_cache()
    with pytest.raises(rt.InstallProfileConfigError, match="conflicts"):
        rt.load_active_profile()


def test_fofline_oauth_overrides_install_snapshot_to_connected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.desktop_app_manifests import runtime as rt

    monkeypatch.setattr(rt, "_settings_edition_and_profile", lambda: ("cloud", ""))
    rt.clear_active_install_cache()
    browser = rt.get_install_snapshot_for_oauth_client("empery-web")
    assert browser.profile_id == "cloud-full"
    fofline = rt.get_install_snapshot_for_oauth_client("empery-fofline")
    assert fofline.profile_id == "fofline-connected"
    assert fofline.access_mode == "managed"
    assert fofline.seat_activation_required is True
    assert "EwaApp" in fofline.enabled_app_components
    assert "GAFChatApp" in fofline.enabled_app_components
    assert "VideoCallApp" in fofline.enabled_app_components
    assert "MarketingCabinet" not in fofline.enabled_app_components


def test_unified_config_edition_fields_defaults() -> None:
    from api.core.unified_config import UnifiedConfig

    cfg = UnifiedConfig.model_construct(database_password="x" * 16)
    assert cfg.eliteew_product_edition == "cloud"
    assert cfg.eliteew_install_profile == ""
