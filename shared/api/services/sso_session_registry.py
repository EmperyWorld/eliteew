#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public facade re-export for SSO session registry (claims / enrich / enforce / query).
# Stable import path: api.services.sso_session_registry.
# Invariants:
# - Export names remain stable for middleware, auth routers, Socket.IO, admin directory.
# - Implementation lives in sibling modules; this file is re-export only.
# Related:
# - sso_session_claims.py; sso_session_registry_enforce.py; sso_session_registry_query.py;
#   documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---
"""DB-backed SSO session replacement guard for Keycloak bearer tokens."""

from __future__ import annotations

from api.services.sso_session_claims import (
    SSO_SESSION_ACTIVE_WINDOW,
    SSO_SESSION_LIVE_WINDOW,
    SsoClientClass,
    SsoSessionClaims,
    SsoSessionDecision,
    allowed_public_client_ids,
    client_class_for_client_id,
    enrich_sso_payload_for_registry,
    enrich_sso_payload_from_token_response,
    fofline_browser_xor_partner,
    fofline_browser_xor_policy,
    is_apk_distribution_redirect_uri,
    is_ewpower_operator_client_id,
    is_mobile_redirect_uri,
    is_sso_registry_exempt_api_path,
    normalize_fofline_browser_xor_policy,
    normalize_sso_token_payload,
    parse_xor_displaced_winner,
    public_client_id_for_redirect_uri,
    public_client_id_from_token_payload,
    resolve_public_client_id,
    should_replace_existing_session,
    should_require_fofline_browser_xor_confirm,
    should_require_session_replace_confirmation,
    sso_claims_from_payload,
    sso_replace_confirm_header_value,
    sso_replace_confirm_is_valid,
)
from api.services.sso_session_registry_enforce import (
    SsoSessionRegistry,
    SsoSessionRegistryUnavailable,
    _is_transient_sso_registry_error,
    get_sso_session_registry,
)
from api.services.sso_session_registry_query import (
    batch_sso_sessions_for_user_ids,
    list_sso_login_history_for_user,
)

__all__ = [
    "SSO_SESSION_ACTIVE_WINDOW",
    "SSO_SESSION_LIVE_WINDOW",
    "SsoClientClass",
    "SsoSessionClaims",
    "SsoSessionDecision",
    "SsoSessionRegistry",
    "SsoSessionRegistryUnavailable",
    "_is_transient_sso_registry_error",
    "allowed_public_client_ids",
    "batch_sso_sessions_for_user_ids",
    "client_class_for_client_id",
    "enrich_sso_payload_for_registry",
    "enrich_sso_payload_from_token_response",
    "fofline_browser_xor_partner",
    "fofline_browser_xor_policy",
    "get_sso_session_registry",
    "is_apk_distribution_redirect_uri",
    "is_ewpower_operator_client_id",
    "is_mobile_redirect_uri",
    "is_sso_registry_exempt_api_path",
    "list_sso_login_history_for_user",
    "normalize_fofline_browser_xor_policy",
    "normalize_sso_token_payload",
    "parse_xor_displaced_winner",
    "public_client_id_for_redirect_uri",
    "public_client_id_from_token_payload",
    "resolve_public_client_id",
    "should_replace_existing_session",
    "should_require_fofline_browser_xor_confirm",
    "should_require_session_replace_confirmation",
    "sso_claims_from_payload",
    "sso_replace_confirm_header_value",
    "sso_replace_confirm_is_valid",
]
