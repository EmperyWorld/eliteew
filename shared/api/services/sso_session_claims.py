#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSO registry claim types, client-id mapping, enrich/normalize helpers,
# browser session-replace confirmation heuristics, and FoFline↔browser XOR helpers.
# Invariants:
# - Raw access/refresh tokens are never persisted here (claims only).
# - Does not import the registry facade (no cycles).
# - FoFline maps only from KEYCLOAK_FOFLINE_CLIENT_ID; never overload desktop.
# Related:
# - api.services.sso_session_registry_enforce; documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
# ---
"""SSO session claim extraction and enrichment helpers."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal

from api.core.keycloak_jwt import decode_unverified_claims
from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

SsoClientClass = Literal["browser", "mobile", "desktop", "fofline"]
SsoFofLineBrowserXorPolicy = Literal["displace", "deny", "off"]

# Admin UI: treat SSO registry row as "active" when last_seen_at is within this window.
SSO_SESSION_ACTIVE_WINDOW = timedelta(minutes=30)
# Admin UI: "live" (bright online) when last_seen within this shorter window.
SSO_SESSION_LIVE_WINDOW = timedelta(minutes=3)


@dataclass(frozen=True)
class SsoSessionClaims:
    """Normalized Keycloak claims required for SSO session replacement decisions."""

    keycloak_sub: str
    session_id: str
    client_id: str
    client_class: SsoClientClass
    username: str | None
    email: str | None
    auth_time_epoch: int | None
    issued_at_epoch: int | None


@dataclass(frozen=True)
class SsoSessionDecision:
    """Result of a registry check."""

    allowed: bool
    claims: SsoSessionClaims | None = None
    replaced_session_id: str | None = None
    reason: str | None = None
    # FoFline↔browser XOR: winner class when this client was displaced (toast UX).
    displaced_by: str | None = None
    # FoFline↔browser XOR: partner class that would be displaced (confirm UX).
    xor_partner: str | None = None


def _int_claim(payload: dict[str, Any], key: str) -> int | None:
    raw = payload.get(key)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):  # fmt: skip
        return None


def _clean_claim(payload: dict[str, Any], key: str) -> str | None:
    raw = payload.get(key)
    if raw is None:
        return None
    value = str(raw).strip()
    return value or None


def is_mobile_redirect_uri(redirect_uri: str | None) -> bool:
    """Return True when redirect_uri is a native MobileAndroid custom-scheme callback."""

    uri = (redirect_uri or "").strip()
    return uri.startswith("world.empery.mobile")


def allowed_public_client_ids() -> set[str]:
    """Public PKCE clients that EliteEW is allowed to use without a client secret."""

    return {
        str(unified_settings.keycloak_web_client_id).strip(),
        str(unified_settings.keycloak_mobile_client_id).strip(),
        str(unified_settings.keycloak_apk_download_client_id).strip(),
        str(unified_settings.keycloak_desktop_client_id).strip(),
        str(unified_settings.keycloak_fofline_client_id).strip(),
    }


def resolve_public_client_id(
    *,
    redirect_uri: str | None,
    requested_client_id: str | None = None,
) -> str:
    """Prefer an allowed explicit client_id (desktopNative); else map from redirect_uri."""

    requested = (requested_client_id or "").strip()
    if requested and requested in allowed_public_client_ids():
        return requested
    return public_client_id_for_redirect_uri(redirect_uri)


def public_client_id_for_redirect_uri(redirect_uri: str | None) -> str:
    """Return the configured public Keycloak client for a browser or native mobile redirect URI."""

    if is_apk_distribution_redirect_uri(redirect_uri):
        return unified_settings.keycloak_apk_download_client_id
    if is_mobile_redirect_uri(redirect_uri):
        return unified_settings.keycloak_mobile_client_id
    return unified_settings.keycloak_web_client_id


def public_client_id_from_token_payload(payload: dict[str, Any], *, default_to_web: bool = True) -> str:
    """Infer the public client from token claims, falling back to the SPA client for old tokens."""

    azp = _clean_claim(payload, "azp") or _clean_claim(payload, "client_id")
    if azp in allowed_public_client_ids():
        return azp
    return unified_settings.keycloak_web_client_id if default_to_web else (azp or "")


def client_class_for_client_id(client_id: str | None) -> SsoClientClass:
    """Map Keycloak public client id to EliteEW's session class."""

    cid = (client_id or "").strip()
    if cid in {
        unified_settings.keycloak_mobile_client_id,
        unified_settings.keycloak_apk_download_client_id,
    }:
        return "mobile"
    if cid == str(unified_settings.keycloak_desktop_client_id).strip():
        return "desktop"
    if cid == str(unified_settings.keycloak_fofline_client_id).strip():
        return "fofline"
    return "browser"


def fofline_browser_xor_partner(client_class: SsoClientClass) -> SsoClientClass | None:
    """Return the XOR partner class for FoFline↔browser exclusivity, else None."""

    if client_class == "fofline":
        return "browser"
    if client_class == "browser":
        return "fofline"
    return None


def normalize_fofline_browser_xor_policy(raw: str | None) -> SsoFofLineBrowserXorPolicy:
    """Normalize Config Plane XOR policy; unknown values fail closed to displace."""

    value = (raw or "").strip().lower()
    if value in {"displace", "deny", "off"}:
        return value  # type: ignore[return-value]
    if value:
        logger.warning(
            "SSO FoFline XOR policy unknown=%r; using displace",
            value,
        )
    return "displace"


def fofline_browser_xor_policy() -> SsoFofLineBrowserXorPolicy:
    """Active browser↔fofline XOR policy from UnifiedConfig."""

    return normalize_fofline_browser_xor_policy(unified_settings.sso_fofline_browser_xor_policy)


def parse_xor_displaced_winner(current_session_id: str | None) -> SsoClientClass | None:
    """Parse winner class from XOR displace sentinel ``xor-displaced:<winner>:<sid>``."""

    raw = (current_session_id or "").strip()
    if not raw.startswith("xor-displaced:"):
        return None
    parts = raw.split(":", 2)
    if len(parts) < 2:
        return None
    winner = parts[1].strip()
    if winner in {"browser", "fofline", "mobile", "desktop"}:
        return winner  # type: ignore[return-value]
    return None


def is_apk_distribution_redirect_uri(redirect_uri: str | None) -> bool:
    """Standalone /mobile-app/ login must not replace the primary browser SSO session."""

    uri = (redirect_uri or "").strip().rstrip("/")
    if not uri:
        return False
    return uri.endswith("/mobile-app") or uri.endswith("/mobile-app/")


def is_sso_registry_exempt_api_path(path: str) -> bool:
    """Ticketed APK download is anonymous after one-time ticket validation; other mobile APIs enforce SSO."""

    normalized = (path or "").split("?", 1)[0]
    return normalized == "/api/v1/mobile-app/download-by-ticket"


def is_ewpower_operator_client_id(client_id: str | None) -> bool:
    """EWPower SPA (`ewpower-web`) is a separate operator console — not the app.eliteew.ru browser slot."""

    cid = (client_id or "").strip()
    if not cid:
        return False
    configured = str(unified_settings.keycloak_ewpower_web_client_id or "ewpower-web").strip()
    return cid == configured


def _id_token_claims(token_response: dict[str, Any] | None) -> dict[str, Any]:
    if not token_response:
        return {}
    id_token = token_response.get("id_token")
    if not isinstance(id_token, str) or not id_token.strip():
        return {}
    try:
        claims = decode_unverified_claims(id_token)
        return claims if isinstance(claims, dict) else {}
    except Exception:
        logger.warning("SSO registry: could not parse id_token claims", exc_info=True)
        return {}


def _merge_sso_claim_fields(
    target: dict[str, Any],
    source: dict[str, Any],
    *,
    keys: tuple[str, ...],
) -> None:
    for key in keys:
        if key == "sid":
            if _clean_claim(target, "sid") or _clean_claim(target, "session_state"):
                continue
            sid = _clean_claim(source, "sid") or _clean_claim(source, "session_state")
            if sid:
                target["sid"] = sid
            continue
        if _clean_claim(target, key):
            continue
        value = _clean_claim(source, key)
        if value:
            target[key] = value


def enrich_sso_payload_for_registry(
    access_payload: dict[str, Any],
    *,
    token_response: dict[str, Any] | None = None,
    user_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fill SSO registry claims from access token, id_token and OIDC userinfo (OAuth callback path)."""

    merged = dict(access_payload)
    id_claims = _id_token_claims(token_response or {})
    claim_keys = ("sub", "sid", "preferred_username", "email", "auth_time", "iat", "azp")
    for source in (access_payload, id_claims, user_info or {}):
        _merge_sso_claim_fields(merged, source, keys=claim_keys)
    return merged


def enrich_sso_payload_from_token_response(
    access_payload: dict[str, Any],
    token_response: dict[str, Any],
) -> dict[str, Any]:
    """Backward-compatible wrapper; prefer enrich_sso_payload_for_registry with user_info."""

    return enrich_sso_payload_for_registry(
        access_payload,
        token_response=token_response,
    )


def normalize_sso_token_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Align introspection/JWT shapes before SSO registry extraction."""

    merged = dict(payload)
    if not _clean_claim(merged, "azp") and _clean_claim(merged, "client_id"):
        merged["azp"] = merged["client_id"]
    if not _clean_claim(merged, "preferred_username") and _clean_claim(merged, "username"):
        merged["preferred_username"] = merged["username"]
    return merged


def sso_claims_from_payload(
    payload: dict[str, Any],
    *,
    oauth_client_id: str | None = None,
) -> SsoSessionClaims | None:
    """Extract the stable Keycloak SSO session tuple from a validated token payload."""

    sub = _clean_claim(payload, "sub")
    session_id = _clean_claim(payload, "sid") or _clean_claim(payload, "session_state")
    if not sub or not session_id:
        return None
    token_client_id = public_client_id_from_token_payload(payload)
    resolved_client_id = (oauth_client_id or "").strip() or token_client_id
    if oauth_client_id and resolved_client_id != token_client_id:
        logger.warning(
            "SSO registry: token azp=%s differs from OAuth flow client_id=%s; using OAuth client",
            token_client_id,
            resolved_client_id,
        )
    return SsoSessionClaims(
        keycloak_sub=sub,
        session_id=session_id,
        client_id=resolved_client_id,
        client_class=client_class_for_client_id(resolved_client_id),
        username=_clean_claim(payload, "preferred_username") or _clean_claim(payload, "username"),
        email=_clean_claim(payload, "email"),
        auth_time_epoch=_int_claim(payload, "auth_time"),
        issued_at_epoch=_int_claim(payload, "iat"),
    )


def should_replace_existing_session(
    *,
    existing_auth_time_epoch: int | None,
    existing_issued_at_epoch: int | None,
    incoming_auth_time_epoch: int | None,
    incoming_issued_at_epoch: int | None,
) -> bool:
    """Return true when an incoming different sid is newer than the registry's current sid."""

    existing = (existing_auth_time_epoch or 0, existing_issued_at_epoch or 0)
    incoming = (incoming_auth_time_epoch or 0, incoming_issued_at_epoch or 0)
    return incoming >= existing


def _session_replace_header_confirms(raw_value: str | None) -> bool:
    value = (raw_value or "").strip().lower()
    return value in {"1", "true", "yes", "confirm", "replace"}


def should_require_fofline_browser_xor_confirm(
    *,
    client_class: SsoClientClass,
    replace_confirm_header: str | None,
    partner_session_id: str | None,
) -> bool:
    """Displace policy: kick a live XOR partner only after explicit confirm header."""

    if fofline_browser_xor_policy() != "displace":
        return False
    if fofline_browser_xor_partner(client_class) is None:
        return False
    if not (partner_session_id or "").strip():
        return False
    if parse_xor_displaced_winner(partner_session_id) is not None:
        # Partner already displaced — no interactive session to confirm against.
        return False
    return not _session_replace_header_confirms(replace_confirm_header)


def sso_replace_confirm_header_value(raw: object) -> str | None:
    """Normalize HTTP header or Socket.IO ``sso_replace_confirm`` auth field to header string."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return "1" if raw else None
    if isinstance(raw, int) and raw == 1:
        return "1"
    if isinstance(raw, str):
        stripped = raw.strip()
        return stripped if stripped else None
    return None


def sso_replace_confirm_is_valid(replace_confirm_header: str | None) -> bool:
    """True when the client explicitly confirmed browser session replacement."""
    return _session_replace_header_confirms(replace_confirm_header)


def user_agents_match(
    existing_user_agent: str | None,
    incoming_user_agent: str | None,
) -> bool:
    """True when both UAs are present and identical (same browser profile re-login)."""

    left = (existing_user_agent or "").strip()
    right = (incoming_user_agent or "").strip()
    if not left or not right:
        return False
    return left == right


def should_require_session_replace_confirmation(
    *,
    client_class: SsoClientClass,
    replace_confirm_header: str | None,
    existing_user_agent: str | None = None,
    incoming_user_agent: str | None = None,
) -> bool:
    """Browser takeover must be explicit; User-Agent equality is not an identity proof."""

    # Call-site kwargs retained for diagnostics; confirmation is header-only.
    _ = (existing_user_agent, incoming_user_agent)
    if client_class != "browser":
        return False
    return not _session_replace_header_confirms(replace_confirm_header)
