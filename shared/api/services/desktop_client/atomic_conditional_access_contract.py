# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure contract constants and evaluators for Desktop Atomic Conditional Access.
# Wave 0–6 lock surface — no I/O, no FastAPI imports.
# Invariants:
# - Auth-risk pipeline never auto-revokes license (auth_risk_may_auto_revoke_license is False).
# - Unsigned/unverifiable proofs never change binding or license state.
# - Account-level quarantine requires admin action or corroborated multi-signal.
# - Client-supplied privilege flags are never trusted.
# - Native Start URLs must not carry raw license/device bind query params (target).
# - Fleet migrate binds by exact Keycloak sub only; pending DPoP JKT is a sentinel until first native commit.
# Related:
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# - tests/test_desktop_atomic_conditional_access_contract.py
# ---

from __future__ import annotations

from enum import StrEnum
from typing import Any, Final
from urllib.parse import parse_qsl, urlparse

NATIVE_KEYCLOAK_CLIENT_IDS: Final[frozenset[str]] = frozenset({"empery-desktop", "empery-fofline"})

REQUIRED_BINDING_ACR: Final[str] = "eliteew-device-bound"

REQUIRED_BINDING_CLAIMS: Final[tuple[str, ...]] = (
    "acr",
    "eliteew_binding_id",
    "eliteew_binding_epoch",
)

REQUIRED_CNF_JKT_CLAIM: Final[str] = "cnf.jkt"

FORBIDDEN_START_URL_QUERY_PARAMS: Final[frozenset[str]] = frozenset({"eliteewLicenseId", "eliteewDeviceId"})

ALLOWED_START_URL_PROFILE_MARKERS: Final[frozenset[str]] = frozenset(
    {
        "eliteewDesktopClient",
        "eliteewFoflineClient",
    }
)

GENERIC_AUTH_POLICY_DENY_CODE: Final[str] = "auth_policy_denied"

GENERIC_AUTH_POLICY_USER_MESSAGE_KEY: Final[str] = "desktop.atomicAuth.genericDeny"

# Paths that still implement leftover post-token assert — 410 only after enforce cutover.
LEGACY_MIGRATION_PATHS: Final[tuple[str, ...]] = (
    "shared/web/frontend/src/services/desktopClient/desktopClientSessionAssert.ts",
    "shared/api/routers/desktop_client/license.py",
)


class BindingState(StrEnum):
    ACTIVE = "active"
    RESTRICTED = "restricted"
    QUARANTINED = "quarantined"
    REVOKED = "revoked"


class AuthRiskEventKind(StrEnum):
    UNSIGNED_BAD_PROOF = "unsigned_bad_proof"
    STALE_NONCE = "stale_nonce"
    VALID_REPLAY = "valid_replay"
    IMPOSSIBLE_TRANSITION = "impossible_transition"
    ADMIN_QUARANTINE = "admin_quarantine"
    ADMIN_RESTORE = "admin_restore"
    ADMIN_ALLOW_REBIND = "admin_allow_rebind"
    ADMIN_END_SESSIONS = "admin_end_sessions"
    ADMIN_CLEAR_KC_FAILURES = "admin_clear_kc_failures"


class AdminRecoveryAction(StrEnum):
    END_SESSIONS = "end_sessions"
    QUARANTINE_DEVICE = "quarantine_device"
    RESTORE_LOGIN = "restore_login"
    ALLOW_REBIND = "allow_rebind"
    CLEAR_KC_LOGIN_FAILURES = "clear_kc_login_failures"


_NO_STATE_CHANGE_KINDS: Final[frozenset[AuthRiskEventKind]] = frozenset(
    {
        AuthRiskEventKind.UNSIGNED_BAD_PROOF,
        AuthRiskEventKind.ADMIN_END_SESSIONS,
        AuthRiskEventKind.ADMIN_CLEAR_KC_FAILURES,
        AuthRiskEventKind.ADMIN_ALLOW_REBIND,
    }
)

_TICKET_REVOKE_KINDS: Final[frozenset[AuthRiskEventKind]] = frozenset(
    {
        AuthRiskEventKind.VALID_REPLAY,
        AuthRiskEventKind.STALE_NONCE,
        AuthRiskEventKind.IMPOSSIBLE_TRANSITION,
        AuthRiskEventKind.ADMIN_QUARANTINE,
        AuthRiskEventKind.ADMIN_END_SESSIONS,
    }
)

_EPOCH_BUMP_KINDS: Final[frozenset[AuthRiskEventKind]] = frozenset(
    {
        AuthRiskEventKind.ADMIN_END_SESSIONS,
    }
)


def start_url_has_forbidden_bind_ids(url: str) -> bool:
    """True when URL query contains raw license/device bind ids (forbidden at enforce)."""
    parsed = urlparse(url)
    keys = {k for k, _ in parse_qsl(parsed.query, keep_blank_values=True)}
    return bool(keys & FORBIDDEN_START_URL_QUERY_PARAMS)


def native_token_has_required_binding_claims(claims: dict[str, Any]) -> bool:
    """True when access/id token carries mandatory native binding claims."""
    if claims.get("acr") != REQUIRED_BINDING_ACR:
        return False
    binding_id = claims.get("eliteew_binding_id")
    if not isinstance(binding_id, str) or not binding_id.strip():
        return False
    epoch = claims.get("eliteew_binding_epoch")
    if not isinstance(epoch, int) or epoch < 1:
        return False
    cnf = claims.get("cnf")
    if not isinstance(cnf, dict):
        return False
    jkt = cnf.get("jkt")
    return isinstance(jkt, str) and bool(jkt.strip())


def is_generic_auth_policy_error(code: str) -> bool:
    """Public deny codes must map to the single generic auth-policy family."""
    normalized = (code or "").strip().lower()
    if not normalized:
        return False
    if normalized == GENERIC_AUTH_POLICY_DENY_CODE:
        return True
    return normalized in {
        "invalid_grant",
        "access_denied",
        "unauthorized_client",
    }


def auth_risk_may_auto_revoke_license() -> bool:
    """Auth-risk pipeline must never change license status automatically."""
    return False


def auth_risk_may_change_license_status(_kind: AuthRiskEventKind | str) -> bool:
    """No auth-risk or admin-recovery action may mutate license status."""
    return False


def auth_risk_revokes_open_tickets(kind: AuthRiskEventKind | str) -> bool:
    normalized = AuthRiskEventKind(str(kind))
    return normalized in _TICKET_REVOKE_KINDS


def auth_risk_bumps_authz_epoch(kind: AuthRiskEventKind | str) -> bool:
    """True when the kind must bump authz_epoch even without a binding-state change."""
    normalized = AuthRiskEventKind(str(kind))
    return normalized in _EPOCH_BUMP_KINDS or normalized in _TICKET_REVOKE_KINDS


def account_level_quarantine_allowed(*, admin_action: bool, multi_signal_corroborated: bool) -> bool:
    """Account quarantine is admin or corroborated multi-signal only — never unsigned spam."""
    return bool(admin_action or multi_signal_corroborated)


def auth_risk_next_binding_state(
    *,
    kind: AuthRiskEventKind | str,
    current: BindingState | str,
    corroborated: bool,
) -> BindingState | None:
    """Next binding state, or None when the event must not mutate state.

    Unsigned/unverifiable proofs never change state. Valid replay / stale nonce
    raise device risk to restricted. Quarantine requires corroborated=True from
    admin or an independent multi-signal — never from repeating the same event.
    """
    event = AuthRiskEventKind(str(kind))
    state = BindingState(str(current))
    if event in _NO_STATE_CHANGE_KINDS:
        return None
    if state is BindingState.REVOKED:
        return None
    if event is AuthRiskEventKind.ADMIN_QUARANTINE:
        return BindingState.QUARANTINED
    if event is AuthRiskEventKind.ADMIN_RESTORE:
        return BindingState.ACTIVE
    if event is AuthRiskEventKind.VALID_REPLAY or event is AuthRiskEventKind.STALE_NONCE:
        if state is BindingState.QUARANTINED:
            return None
        if corroborated and state is BindingState.RESTRICTED:
            return BindingState.QUARANTINED
        if state is BindingState.ACTIVE:
            return BindingState.RESTRICTED
        return None
    if event is AuthRiskEventKind.IMPOSSIBLE_TRANSITION:
        if state is BindingState.QUARANTINED:
            return None
        if corroborated:
            return BindingState.QUARANTINED
        if state is BindingState.ACTIVE:
            return BindingState.RESTRICTED
        return None
    return None


def admin_recovery_action_to_risk_kind(action: AdminRecoveryAction | str) -> AuthRiskEventKind:
    mapped = {
        AdminRecoveryAction.END_SESSIONS: AuthRiskEventKind.ADMIN_END_SESSIONS,
        AdminRecoveryAction.QUARANTINE_DEVICE: AuthRiskEventKind.ADMIN_QUARANTINE,
        AdminRecoveryAction.RESTORE_LOGIN: AuthRiskEventKind.ADMIN_RESTORE,
        AdminRecoveryAction.ALLOW_REBIND: AuthRiskEventKind.ADMIN_ALLOW_REBIND,
        AdminRecoveryAction.CLEAR_KC_LOGIN_FAILURES: AuthRiskEventKind.ADMIN_CLEAR_KC_FAILURES,
    }
    return mapped[AdminRecoveryAction(str(action))]


def client_supplied_privilege_flag_trusted(_flag: str) -> bool:
    """Honey/fake admin flags from client are always ignored."""
    return False


def native_client_id(client_id: str) -> bool:
    return client_id in NATIVE_KEYCLOAK_CLIENT_IDS


class NativeAccessPepMode(StrEnum):
    SKIP = "skip"
    REQUIRE_CURRENT_BINDING = "require_current_binding"
    DENY = "deny"


def native_token_azp(claims: dict[str, Any]) -> str:
    raw = claims.get("azp") or claims.get("client_id") or claims.get("clientId")
    return str(raw).strip() if isinstance(raw, str) else ""


def native_access_pep_mode(
    *,
    claims: dict[str, Any],
    enforce_missing_claims: bool,
) -> NativeAccessPepMode:
    """Client-scoped PEP: web/mobile skip; native claims always checked; missing claims deny only at enforce."""
    if not native_client_id(native_token_azp(claims)):
        return NativeAccessPepMode.SKIP
    if native_token_has_required_binding_claims(claims):
        return NativeAccessPepMode.REQUIRE_CURRENT_BINDING
    if enforce_missing_claims:
        return NativeAccessPepMode.DENY
    return NativeAccessPepMode.SKIP


# Wave 6 — fleet binding migration (PG SoT; KC attrs are read-model).
MIGRATION_PENDING_DPOP_JKT: Final[str] = "migrate:pending-pop"

MIGRATION_REBIND_DAYS: Final[int] = 365

KC_MANAGED_BINDING_ATTR_ID: Final[str] = "eliteew_binding_id"
KC_MANAGED_BINDING_ATTR_EPOCH: Final[str] = "eliteew_binding_epoch"
KC_MANAGED_BINDING_ATTR_STATE: Final[str] = "eliteew_auth_state"


class BindingMigrationSlotAction(StrEnum):
    CREATE = "create"
    ALREADY_MIGRATED = "already_migrated"
    CONFLICT_SUB = "conflict_sub"
    SKIP_NO_BOUND_SUB = "skip_no_bound_sub"
    SKIP_CHANNEL_DISABLED = "skip_channel_disabled"


def native_channels_for_license_flags(
    *,
    allow_online: bool,
    allow_fofline: bool,
) -> tuple[tuple[str, str], ...]:
    """Return (channel, client_id) slots enabled on the license."""
    slots: list[tuple[str, str]] = []
    if allow_online:
        slots.append(("desktop", "empery-desktop"))
    if allow_fofline:
        slots.append(("fofline", "empery-fofline"))
    return tuple(slots)


def commit_email_verified_grandfathered(
    *,
    request_sub: str,
    license_bound_sub: str | None,
    binding_sub: str | None = None,
) -> bool:
    """Historical license-bound users may commit with email_verified=false when sub matches.

    Grandfather is license-column only: admin clear of bound_keycloak_sub must stick even if a
    Wave 6 migrated binding row still exists. ``binding_sub`` is ignored (API compatibility).
    """
    _ = binding_sub
    sub = (request_sub or "").strip()
    if not sub:
        return False
    bound = (license_bound_sub or "").strip()
    return bool(bound and bound == sub)


def binding_migration_slot_action(
    *,
    bound_keycloak_sub: str | None,
    channel_enabled: bool,
    existing_binding_sub: str | None,
    existing_binding_state: str | None,
) -> BindingMigrationSlotAction:
    """Pure classifier for one license×client migration slot (no PII)."""
    if not channel_enabled:
        return BindingMigrationSlotAction.SKIP_CHANNEL_DISABLED
    bound = (bound_keycloak_sub or "").strip()
    if not bound:
        return BindingMigrationSlotAction.SKIP_NO_BOUND_SUB
    state = (existing_binding_state or "").strip()
    existing = (existing_binding_sub or "").strip()
    if state and state != BindingState.REVOKED.value:
        if existing and existing == bound:
            return BindingMigrationSlotAction.ALREADY_MIGRATED
        if existing and existing != bound:
            return BindingMigrationSlotAction.CONFLICT_SUB
        # Non-revoked row without sub is unexpected; treat as conflict.
        return BindingMigrationSlotAction.CONFLICT_SUB
    return BindingMigrationSlotAction.CREATE


def is_migration_pending_dpop_jkt(dpop_jkt: str | None) -> bool:
    return (dpop_jkt or "").strip() == MIGRATION_PENDING_DPOP_JKT
