#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OAuth2/SSO facade for Keycloak login, callback, refresh, logout, and guarded admin diagnostics.
# Invariants:
# - Public SSO flow routes stay open only for login/callback/refresh; migration and diagnostics require admin auth.
# - Refresh tokens are accepted in JSON bodies, never logged or persisted.
# Related:
# - api.services.auth_provider_service; api.services.sso_session_registry; documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
"""OAuth2 / SSO authentication router (provider-agnostic facade)."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status  # type: ignore[import-untyped]
from fastapi.responses import RedirectResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.core.auth import User as AuthUser
from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_REFRESH,
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
    AUTH_REASON_SESSION_REPLACED,
    build_auth_error_body,
    build_auth_error_detail,
    build_sso_registry_unavailable_detail,
)
from api.core.oauth2_auth import require_oauth2_user
from api.services.auth_provider_service import AuthProviderService, get_auth_provider_service
from api.services.sso_session_registry import (
    SsoSessionDecision,
    SsoSessionRegistryUnavailable,
    enrich_sso_payload_for_registry,
    get_sso_session_registry,
    is_apk_distribution_redirect_uri,
    public_client_id_for_redirect_uri,
    resolve_public_client_id,
)
from api.services.web_browser_sso_session_policy import get_web_browser_sso_session_policy
from api.services.web_sso_recovery_capsule import (
    RecoveryCapsuleError,
    consume_recovery_capsule,
    discard_recovery_capsule,
    upsert_recovery_capsule,
)
from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)

# Router configuration
# NOTE: domain registration adds /api/v1 and /api prefixes automatically.
router = APIRouter(prefix="/auth/sso", tags=["SSO Authentication"])


# === HELPER FUNCTIONS ===


def _raise_invalid_authorization_header() -> None:
    """Raise HTTPException for invalid authorization header."""
    raise HTTPException(status_code=401, detail="Invalid authorization header")


async def require_sso_admin_user(user: AuthUser = Depends(require_oauth2_user)) -> AuthUser:  # noqa: B008
    """Require application admin for SSO maintenance and diagnostic endpoints."""

    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator privileges required")
    return user


# =============================================================================
# PYDANTIC MODELS
# =============================================================================


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request data"""

    code: str
    state: str | None = None
    redirect_uri: str
    code_verifier: str | None = None
    # Optional: empery-desktop (Tauri) when redirect_uri is still https://app.eliteew.ru/*
    client_id: str | None = None


class KeycloakTokenResponse(BaseModel):
    """Keycloak token response"""

    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str
    id_token: str | None = None
    scope: str


class SsoLogoutRequest(BaseModel):
    """JSON body for SSO logout; refresh tokens must not travel in query strings."""

    refresh_token: str
    redirect_uri: str | None = None


class UserInfoResponse(BaseModel):
    """User information from Keycloak"""

    sub: str  # User ID in Keycloak
    email: str
    username: str
    name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    email_verified: bool
    preferred_username: str
    realm_access: dict[str, Any] | None = None
    resource_access: dict[str, Any] | None = None


class WebBrowserSsoSessionPolicyResponse(BaseModel):
    """Declared empery-web SSO timeouts (Continuity W0; no secrets)."""

    source: str
    client_id: str
    access_token_lifespan_sec: int
    sso_session_idle_timeout_sec: int
    sso_session_max_lifespan_sec: int
    sso_session_idle_timeout_remember_me_sec: int
    sso_session_max_lifespan_remember_me_sec: int
    revoke_refresh_token: bool
    refresh_token_max_reuse: int


class WebSsoRecoveryCapsulePutRequest(BaseModel):
    """Continuity W3: client envelope (no bearer tokens). Server encrypts at rest."""

    terminal_reason: str = Field(..., min_length=1, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)


class WebSsoRecoveryCapsulePutResponse(BaseModel):
    stored: bool
    expires_at: str
    schema_version: int


class WebSsoRecoveryCapsuleGetResponse(BaseModel):
    found: bool
    terminal_reason: str | None = None
    schema_version: int | None = None
    payload: dict[str, Any] | None = None
    expires_at: str | None = None


def _raise_recovery_capsule_http(exc: RecoveryCapsuleError) -> None:
    status_code = (
        status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == "encryption_unavailable" else status.HTTP_400_BAD_REQUEST
    )
    raise HTTPException(status_code=status_code, detail={"code": exc.code, "message": exc.message})


# =============================================================================
# SSO ENDPOINTS
# =============================================================================


@router.get("/session-policy", response_model=WebBrowserSsoSessionPolicyResponse)
async def sso_session_policy(
    source: str = Query(
        "declared_current",
        description="declared_current (live harden defaults) or target_locked (Continuity contract)",
    ),
) -> WebBrowserSsoSessionPolicyResponse:
    """
    Public metadata: browser SSO idle/max/access-token policy.
    SPA must not infer these from a failed refresh_token grant.
    """
    normalized = (source or "declared_current").strip().lower()
    if normalized not in ("declared_current", "target_locked"):
        raise HTTPException(
            status_code=400,
            detail="source must be declared_current or target_locked",
        )
    payload = get_web_browser_sso_session_policy(
        source=normalized,  # type: ignore[arg-type]
    )
    return WebBrowserSsoSessionPolicyResponse(**payload)


@router.put("/recovery-capsule", response_model=WebSsoRecoveryCapsulePutResponse)
async def put_web_sso_recovery_capsule(
    body: WebSsoRecoveryCapsulePutRequest,
    user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
) -> WebSsoRecoveryCapsulePutResponse:
    """Store/replace encrypted recovery capsule for the authenticated principal."""

    try:
        result = await upsert_recovery_capsule(
            keycloak_sub=user.id,
            terminal_reason=body.terminal_reason,
            payload=body.payload,
        )
    except RecoveryCapsuleError as exc:
        _raise_recovery_capsule_http(exc)
        raise  # pragma: no cover
    return WebSsoRecoveryCapsulePutResponse(**result)


@router.get("/recovery-capsule", response_model=WebSsoRecoveryCapsuleGetResponse)
async def get_web_sso_recovery_capsule(
    user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
) -> WebSsoRecoveryCapsuleGetResponse:
    """Consume (single-use) recovery capsule for the same principal after re-auth."""

    try:
        result = await consume_recovery_capsule(keycloak_sub=user.id)
    except RecoveryCapsuleError as exc:
        _raise_recovery_capsule_http(exc)
        raise  # pragma: no cover
    if result is None:
        return WebSsoRecoveryCapsuleGetResponse(found=False)
    return WebSsoRecoveryCapsuleGetResponse(found=True, **result)


@router.delete("/recovery-capsule", status_code=status.HTTP_204_NO_CONTENT)
async def delete_web_sso_recovery_capsule(
    user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Discard recovery capsule without restore."""

    try:
        await discard_recovery_capsule(keycloak_sub=user.id)
    except RecoveryCapsuleError as exc:
        _raise_recovery_capsule_http(exc)


@router.get("/login")
async def sso_login(
    redirect_uri: str = Query(..., description="Where to redirect after login"),
    state: str | None = Query(None, description="Optional state parameter"),
    code_challenge: str | None = Query(None, description="PKCE code challenge"),
    code_challenge_method: str | None = Query(None, description="PKCE challenge method, usually S256"),
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> RedirectResponse:
    """
    🔑 Initiate SSO login flow
    Redirects user to Keycloak login page
    """
    try:
        if bool(code_challenge) != bool(code_challenge_method):
            raise HTTPException(
                status_code=400,
                detail="code_challenge and code_challenge_method must be provided together",
            )

        public_client_id = public_client_id_for_redirect_uri(redirect_uri)
        login_url = auth_provider.get_login_url(
            redirect_uri=redirect_uri,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            client_id=public_client_id,
        )
        logger.info(
            "🔑 Initiating SSO login client_id=%s redirect_uri=%s",
            public_client_id,
            redirect_uri,
        )
        return RedirectResponse(url=login_url, status_code=303)

    except (ValueError, RuntimeError, AttributeError) as e:
        logger.exception(f"SSO login initiation failed: {e}")
        error_msg = "Failed to initiate SSO login"
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        logger.exception(f"SSO login initiation failed: unexpected error: {e}")
        error_msg = "Failed to initiate SSO login"
        raise HTTPException(status_code=500, detail=error_msg) from e


@router.post("/callback")
async def sso_callback(
    body: OAuthCallbackRequest,
    http_request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> dict[str, Any]:
    """
    🔄 Handle OAuth callback from Keycloak
    Exchange authorization code for tokens
    """
    try:
        public_client_id = resolve_public_client_id(
            redirect_uri=body.redirect_uri,
            requested_client_id=body.client_id,
        )
        # Exchange code for tokens (публичный клиент; при PKCE — code_verifier)
        token_response = await auth_provider.exchange_code_for_token(
            code=body.code,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
            client_id=public_client_id,
        )

        # Get user info
        user_info = await auth_provider.get_user_info(token_response["access_token"])
        token_payload = await auth_provider.validate_token(token_response["access_token"])
        oauth_client_id = public_client_id
        registry_payload = enrich_sso_payload_for_registry(
            token_payload,
            token_response=token_response,
            user_info=user_info,
        )
        if is_apk_distribution_redirect_uri(body.redirect_uri):
            session_decision = SsoSessionDecision(allowed=True, reason="apk_download_exempt")
            logger.info(
                "SSO callback APK download page — skip browser session replace (user=%s)",
                user_info.get("preferred_username"),
            )
        else:
            session_decision = await get_sso_session_registry().enforce_current_session(
                registry_payload,
                request=http_request,
                oauth_client_id=oauth_client_id,
                allow_session_replace=True,
            )
        if session_decision.reason == "missing_sso_session_claims":
            logger.error(
                "SSO callback registry incomplete after enrich (user=%s client=%s keys=%s)",
                user_info.get("preferred_username"),
                oauth_client_id,
                sorted(registry_payload.keys()),
            )
        if not session_decision.allowed:
            if session_decision.reason == "session_replace_confirmation_required":
                partner = session_decision.xor_partner
                detail_text = (
                    "Confirm ending FoFline session to continue in the browser"
                    if partner == "fofline"
                    else "Confirm ending web session to continue in FoFline"
                    if partner == "browser"
                    else "Confirm replacing active browser session"
                )
                raise HTTPException(
                    status_code=409,
                    detail=build_auth_error_body(
                        reason=AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
                        action=AUTH_ACTION_LOGIN,
                        detail=detail_text,
                        xor_partner=partner,
                    ),
                )
            raise HTTPException(
                status_code=401,
                detail=build_auth_error_body(
                    reason=AUTH_REASON_SESSION_REPLACED,
                    action=AUTH_ACTION_LOGIN,
                    detail="Session was replaced by a newer login",
                    displaced_by=session_decision.displaced_by,
                ),
            )

        logger.info(
            "✅ SSO callback successful for user: %s (client_id=%s)",
            user_info.get("preferred_username"),
            oauth_client_id,
        )

        # Return tokens and user info
        return {
            "tokens": {
                "access_token": token_response["access_token"],
                "refresh_token": token_response["refresh_token"],
                "expires_in": token_response["expires_in"],
                "token_type": token_response["token_type"],
                "id_token": token_response.get("id_token"),
            },
            "user": {
                "id": user_info["sub"],
                "username": user_info["preferred_username"],
                "email": user_info["email"],
                "email_verified": user_info.get("email_verified", False),
                "name": user_info.get("name"),
                "roles": user_info.get("realm_access", {}).get("roles", []),
            },
        }

    except HTTPException:
        raise
    except SsoSessionRegistryUnavailable as e:
        logger.exception("SSO callback failed: session registry unavailable")
        raise HTTPException(
            status_code=503,
            detail=build_sso_registry_unavailable_detail(),
        ) from e
    except (ValueError, RuntimeError, AttributeError) as e:
        logger.exception(f"SSO callback failed: {e}")
        error_msg = f"OAuth callback failed: {e}"
        raise HTTPException(status_code=400, detail=error_msg) from e
    except Exception as e:
        logger.exception(f"SSO callback failed: unexpected error: {e}")
        error_msg = f"OAuth callback failed: {e}"
        raise HTTPException(status_code=400, detail=error_msg) from e


@router.post("/refresh")
async def sso_refresh_token(
    refresh_token: str, auth_provider: AuthProviderService = Depends(get_auth_provider_service)
) -> dict[str, Any]:
    """
    🔄 Refresh SSO access token
    """
    try:
        token_response = await auth_provider.refresh_token(refresh_token)

        logger.info("🔄 SSO token refreshed successfully")

        return {
            "access_token": token_response["access_token"],
            "refresh_token": token_response["refresh_token"],
            "expires_in": token_response["expires_in"],
            "token_type": token_response["token_type"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"SSO token refresh failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=build_auth_error_detail(
                AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
                action=AUTH_ACTION_REFRESH,
            ),
        ) from e


@router.post("/logout")
async def sso_logout(
    body: SsoLogoutRequest,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> dict[str, Any]:
    """
    🚪 Logout from SSO
    """
    try:
        success = await auth_provider.logout(body.refresh_token)

        if not success:
            logger.warning("SSO logout returned non-success status")

        logger.info("🚪 SSO logout successful")

        if body.redirect_uri:
            logout_url = auth_provider.get_logout_url(body.redirect_uri)
            return {"logout_url": logout_url, "message": "Logout successful"}
        return {"message": "Logout successful"}

    except Exception as e:
        logger.exception(f"SSO logout failed: {e}")
        # Don't raise error for logout - consider it successful
        return {"message": "Logout processed"}


@router.get("/userinfo")
async def sso_userinfo(
    authorization: str, auth_provider: AuthProviderService = Depends(get_auth_provider_service)
) -> dict[str, Any]:
    """
    👤 Get user information from SSO token
    """
    try:
        # Extract token from Authorization header
        if not authorization.startswith("Bearer "):
            _raise_invalid_authorization_header()

        token = authorization[7:]  # Remove "Bearer " prefix

        return await auth_provider.get_user_info(token)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get user info: {e}")
        raise HTTPException(status_code=401, detail="Failed to get user information") from e


@router.post("/validate")
async def validate_sso_token(
    token: str, auth_provider: AuthProviderService = Depends(get_auth_provider_service)
) -> dict[str, Any]:
    """
    ✅ Validate SSO token
    """
    try:
        token_payload = await auth_provider.validate_token(token)
        valid = bool(token_payload.get("active", True))

        return {
            "valid": valid,
            "username": token_payload.get("preferred_username"),
            "email": token_payload.get("email"),
            "exp": token_payload.get("exp"),
            "scope": token_payload.get("scope"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Token validation failed") from e


@router.post("/migrate-user")
async def migrate_user_to_keycloak(
    email: str,
    username: str,
    password: str,
    first_name: str | None = None,
    last_name: str | None = None,
    _admin: AuthUser = Depends(require_sso_admin_user),
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> dict[str, Any]:
    """
    🔄 Migrate existing user to Keycloak
    Admin endpoint for user migration
    """
    try:
        # Check if user already exists
        existing_user = await auth_provider.get_user_by_username(username)
        if existing_user:
            return {"message": "User already exists in Keycloak", "user_id": existing_user["id"], "username": username}

        # Create user in Keycloak
        user = await auth_provider.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            attributes={"migrated": "true", "migration_date": utc_now_iso()},
        )

        logger.info(f"User migrated to Keycloak: {username}")

        return {"message": "User migrated successfully", "user_id": user["id"], "username": username}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"User migration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to migrate user: {e!s}") from e


@router.get("/test-token")
async def test_token_validation(
    request: Request,
    _admin: AuthUser = Depends(require_sso_admin_user),
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> dict[str, Any]:
    """
    🔍 Test endpoint for Keycloak token validation
    """
    auth_header = request.headers.get("authorization", "")

    if not auth_header.startswith("Bearer "):
        return {"error": "No bearer token provided"}

    token = auth_header[7:]

    try:
        logger.info("Testing token validation (length=%s)", len(token))

        token_payload = await auth_provider.validate_token(token)
        valid = bool(token_payload.get("active", True))

        if valid:
            user_info = await auth_provider.get_user_info(token)
            return {
                "status": "success",
                "message": "Token is valid!",
                "user": user_info.get("preferred_username"),
                "email": user_info.get("email"),
            }
        return {"status": "invalid", "message": "Token is not active"}
    except (ValueError, RuntimeError, AttributeError) as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:  # noqa: BLE001 - Test endpoint must return response on any error
        return {"status": "error", "message": f"Unexpected error: {e}"}
