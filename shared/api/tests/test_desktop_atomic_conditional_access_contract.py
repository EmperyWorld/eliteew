# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Executable contract locks for Desktop Atomic Conditional Access (Wave 0).
# Related:
# - services/desktop_client/atomic_conditional_access_contract.py
# ---

from __future__ import annotations

from pathlib import Path

from api.services.desktop_client.atomic_conditional_access_contract import (
    FORBIDDEN_START_URL_QUERY_PARAMS,
    GENERIC_AUTH_POLICY_DENY_CODE,
    LEGACY_MIGRATION_PATHS,
    MIGRATION_PENDING_DPOP_JKT,
    REQUIRED_BINDING_ACR,
    AuthRiskEventKind,
    BindingMigrationSlotAction,
    BindingState,
    NativeAccessPepMode,
    account_level_quarantine_allowed,
    auth_risk_bumps_authz_epoch,
    auth_risk_may_auto_revoke_license,
    auth_risk_may_change_license_status,
    auth_risk_next_binding_state,
    auth_risk_revokes_open_tickets,
    binding_migration_slot_action,
    client_supplied_privilege_flag_trusted,
    commit_email_verified_grandfathered,
    is_generic_auth_policy_error,
    is_migration_pending_dpop_jkt,
    native_access_pep_mode,
    native_channels_for_license_flags,
    native_client_id,
    native_token_has_required_binding_claims,
    start_url_has_forbidden_bind_ids,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_start_url_forbidden_bind_ids() -> None:
    assert start_url_has_forbidden_bind_ids("https://app.eliteew.ru/?eliteewDesktopClient=1&eliteewLicenseId=x")
    assert start_url_has_forbidden_bind_ids("https://app.eliteew.ru/?eliteewDeviceId=dev-1")
    assert not start_url_has_forbidden_bind_ids("https://app.eliteew.ru/?eliteewDesktopClient=1")


def test_native_token_binding_claims() -> None:
    assert native_token_has_required_binding_claims(
        {
            "acr": REQUIRED_BINDING_ACR,
            "eliteew_binding_id": "bind_opaque_1",
            "eliteew_binding_epoch": 3,
            "cnf": {"jkt": "thumbprint"},
        }
    )
    assert not native_token_has_required_binding_claims({"acr": "0"})
    assert not native_token_has_required_binding_claims(
        {
            "acr": REQUIRED_BINDING_ACR,
            "eliteew_binding_id": "x",
            "eliteew_binding_epoch": 0,
            "cnf": {"jkt": "t"},
        }
    )


def test_generic_auth_policy_error_family() -> None:
    assert is_generic_auth_policy_error(GENERIC_AUTH_POLICY_DENY_CODE)
    assert is_generic_auth_policy_error("invalid_grant")
    assert not is_generic_auth_policy_error("license_expired")


def test_auth_risk_never_auto_revokes_license() -> None:
    assert auth_risk_may_auto_revoke_license() is False
    assert auth_risk_may_change_license_status("valid_replay") is False
    assert auth_risk_may_change_license_status("admin_quarantine") is False


def test_unsigned_proof_never_changes_binding_state() -> None:
    assert (
        auth_risk_next_binding_state(
            kind=AuthRiskEventKind.UNSIGNED_BAD_PROOF,
            current=BindingState.ACTIVE,
            corroborated=False,
        )
        is None
    )
    assert auth_risk_revokes_open_tickets(AuthRiskEventKind.UNSIGNED_BAD_PROOF) is False


def test_valid_replay_raises_then_quarantines_when_corroborated() -> None:
    assert (
        auth_risk_next_binding_state(
            kind=AuthRiskEventKind.VALID_REPLAY,
            current=BindingState.ACTIVE,
            corroborated=False,
        )
        is BindingState.RESTRICTED
    )
    assert (
        auth_risk_next_binding_state(
            kind=AuthRiskEventKind.VALID_REPLAY,
            current=BindingState.RESTRICTED,
            corroborated=True,
        )
        is BindingState.QUARANTINED
    )
    assert auth_risk_revokes_open_tickets(AuthRiskEventKind.VALID_REPLAY) is True
    assert auth_risk_bumps_authz_epoch(AuthRiskEventKind.ADMIN_END_SESSIONS) is True
    assert auth_risk_bumps_authz_epoch(AuthRiskEventKind.UNSIGNED_BAD_PROOF) is False


def test_account_quarantine_requires_admin_or_corroborated() -> None:
    assert account_level_quarantine_allowed(admin_action=False, multi_signal_corroborated=False) is False
    assert account_level_quarantine_allowed(admin_action=True, multi_signal_corroborated=False) is True
    assert account_level_quarantine_allowed(admin_action=False, multi_signal_corroborated=True) is True


def test_client_privilege_flags_never_trusted() -> None:
    assert client_supplied_privilege_flag_trusted("is_admin") is False
    assert client_supplied_privilege_flag_trusted("moderator") is False


def test_native_client_ids() -> None:
    assert native_client_id("empery-desktop")
    assert native_client_id("empery-fofline")
    assert not native_client_id("empery-web")


def test_native_access_pep_mode_dual_path() -> None:
    web = {"azp": "empery-web", "sub": "u"}
    native_bare = {"azp": "empery-desktop", "sub": "u"}
    native_bound = {
        "azp": "empery-desktop",
        "acr": REQUIRED_BINDING_ACR,
        "eliteew_binding_id": "bind_opaque_1",
        "eliteew_binding_epoch": 3,
        "cnf": {"jkt": "thumbprint"},
    }
    assert native_access_pep_mode(claims=web, enforce_missing_claims=True) is NativeAccessPepMode.SKIP
    assert native_access_pep_mode(claims=native_bare, enforce_missing_claims=False) is NativeAccessPepMode.SKIP
    assert native_access_pep_mode(claims=native_bare, enforce_missing_claims=True) is NativeAccessPepMode.DENY
    assert (
        native_access_pep_mode(claims=native_bound, enforce_missing_claims=False)
        is NativeAccessPepMode.REQUIRE_CURRENT_BINDING
    )


def test_legacy_migration_paths_exist_in_repo() -> None:
    for rel in LEGACY_MIGRATION_PATHS:
        assert (REPO_ROOT / rel).is_file(), rel


def test_contract_module_exports_forbidden_params() -> None:
    src = (REPO_ROOT / "shared/api/services/desktop_client/atomic_conditional_access_contract.py").read_text(
        encoding="utf-8"
    )
    for param in FORBIDDEN_START_URL_QUERY_PARAMS:
        assert param in src


def test_wave6_channels_and_grandfather() -> None:
    assert native_channels_for_license_flags(allow_online=True, allow_fofline=False) == (("desktop", "empery-desktop"),)
    assert native_channels_for_license_flags(allow_online=True, allow_fofline=True) == (
        ("desktop", "empery-desktop"),
        ("fofline", "empery-fofline"),
    )
    assert commit_email_verified_grandfathered(
        request_sub="sub-1",
        license_bound_sub="sub-1",
    )
    assert not commit_email_verified_grandfathered(
        request_sub="sub-1",
        license_bound_sub=None,
        binding_sub="sub-1",
    )
    assert not commit_email_verified_grandfathered(
        request_sub="sub-1",
        license_bound_sub=None,
        binding_sub=None,
    )
    assert not commit_email_verified_grandfathered(
        request_sub="sub-1",
        license_bound_sub="other",
    )


def test_wave6_binding_migration_slot_actions() -> None:
    assert (
        binding_migration_slot_action(
            bound_keycloak_sub="sub-1",
            channel_enabled=True,
            existing_binding_sub=None,
            existing_binding_state=None,
        )
        is BindingMigrationSlotAction.CREATE
    )
    assert (
        binding_migration_slot_action(
            bound_keycloak_sub="sub-1",
            channel_enabled=True,
            existing_binding_sub="sub-1",
            existing_binding_state=BindingState.RESTRICTED.value,
        )
        is BindingMigrationSlotAction.ALREADY_MIGRATED
    )
    assert (
        binding_migration_slot_action(
            bound_keycloak_sub="sub-1",
            channel_enabled=True,
            existing_binding_sub="other",
            existing_binding_state=BindingState.ACTIVE.value,
        )
        is BindingMigrationSlotAction.CONFLICT_SUB
    )
    assert (
        binding_migration_slot_action(
            bound_keycloak_sub=None,
            channel_enabled=True,
            existing_binding_sub=None,
            existing_binding_state=None,
        )
        is BindingMigrationSlotAction.SKIP_NO_BOUND_SUB
    )
    assert is_migration_pending_dpop_jkt(MIGRATION_PENDING_DPOP_JKT)
    assert not is_migration_pending_dpop_jkt("real-jkt")
