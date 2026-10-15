#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Validate Keycloak/JWT tokens, sync SSO users into PostgreSQL, expose FastAPI auth dependencies.
# Invariants:
#   - Email used as stable account key is normalized (strip + lower); user rows are matched case-insensitively on read.
# Related:
#   - api.core.auth (User); api.core.user_identity; documentation/platform docker Keycloak notes.
# ---
"""OAuth2 Proxy Authentication Dependency - PRODUCTION READY.

Compatible with both OAuth2 Proxy headers and Authorization header.

🚨 CRITICAL INFORMATION:
- This is the MAIN authentication handler for EliteEW Backend
- Supports DUAL MODE: OAuth2 Proxy (legacy) + Bearer tokens (app.eliteew.ru)
- DB SYNC: Automatically syncs Keycloak users to PostgreSQL with retry logic
- GRACEFUL DEGRADATION: Works even if DB is unavailable (transient users)
- SECURITY: RS256 token validation via KeycloakService

Created: 2025-10-12
Updated: 2025-10-23 (DB sync + circular import fix)
Migration: Phase 1 Complete ✅

Usage:
    from api.core.oauth2_auth import require_oauth2_user

    @router.get("/endpoint")
    async def endpoint(user: User = Depends(require_oauth2_user)):
        # user is guaranteed to be authenticated
        pass

Features:
- Reads X-Auth-Request-* headers from OAuth2 Proxy
- Falls back to Authorization: Bearer header
- Validates token via KeycloakService (RS256)
- Returns User object from core.auth
- Raises 401 if authentication fails
- DB sync with 3-retry exponential backoff
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

# NOTE: FastAPI is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from fastapi import (  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
    Depends,
    HTTPException,
    Request,
    status,
)

# NOTE: SQLAlchemy is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from sqlalchemy import (  # type: ignore[reportMissingImports,import-not-found]  # pyright: ignore[reportMissingImports]
    func,
    select,
)
from sqlalchemy.exc import (  # type: ignore[reportMissingImports,import-not-found]  # pyright: ignore[reportMissingImports]
    DBAPIError,
    IntegrityError,
    OperationalError,
)
from sqlalchemy.ext.asyncio import (  # type: ignore[reportMissingImports,import-not-found]  # pyright: ignore[reportMissingImports]
    AsyncSession,
)

# NOTE: Tenacity is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from tenacity import (  # type: ignore[reportMissingImports,import-not-found]  # pyright: ignore[reportMissingImports]
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# NOTE: Module exists, but linter doesn't see it due to Python path configuration
# This is a linter configuration error, not a code error - module is available at runtime
from api.core.auth import User  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
    AUTH_REASON_SESSION_REPLACED,
    AUTH_REASON_TOKEN_MISSING,
    build_auth_error_detail,
    build_sso_registry_unavailable_detail,
)
from api.core.database_manager import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    get_database_manager,
    get_postgres_session,
)
from api.core.pii_session import ensure_encryption_pii_key
from api.core.token_roles import (
    get_effective_role_from_payload,
    path_allows_bearer_token_query_param,
    payload_has_ew_family,
    persistable_users_role_from_payload,
)
from api.models.database_models import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    User as DBUser,
)
from api.services.auth_provider_service import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    AuthProviderService,
    get_auth_provider_service,
)
from api.services.desktop_client.native_access_pep import enforce_native_access_pep
from api.services.sso_session_registry import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    SsoSessionRegistryUnavailable,
    get_sso_session_registry,
    is_sso_registry_exempt_api_path,
)
from api.services.user_cache_service import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    get_user_cache_service,
)

logger = logging.getLogger(__name__)


_SSO_EMAIL_DOMAIN_ALIASES: dict[str, str] = {
    "empery.world": "eliteew.ru",
}


def _normalize_sso_email(raw: str | None) -> str:
    """Stable email key for lookups and inserts (matches legacy UserService conventions)."""
    email = (raw or "").strip().lower()
    if "@" not in email:
        return email
    local, _, domain = email.partition("@")
    mapped = _SSO_EMAIL_DOMAIN_ALIASES.get(domain, domain)
    return f"{local}@{mapped}"


def _jwt_claim_to_naive_utc_seconds(raw: Any) -> datetime | None:
    """Convert JWT numeric time claim (seconds since epoch) to naive UTC datetime."""
    if raw is None:
        return None
    try:
        ts = int(raw)
        return datetime.fromtimestamp(ts, tz=UTC).replace(tzinfo=None)
    except (TypeError, ValueError, OSError):  # fmt: skip
        return None


def _sso_auth_time_naive_utc(payload: dict[str, Any]) -> datetime | None:
    """OIDC auth_time: moment of user authentication at IdP (stable for the session)."""
    return _jwt_claim_to_naive_utc_seconds(payload.get("auth_time"))


def _sso_iat_naive_utc(payload: dict[str, Any]) -> datetime | None:
    """Token iat — use only for bootstrap when auth_time is absent (e.g. new user)."""
    return _jwt_claim_to_naive_utc_seconds(payload.get("iat"))


def _apply_sso_last_login_if_new_session(db_user: DBUser, payload: dict[str, Any]) -> bool:
    """
    Set last_login_at / increment login_count when Keycloak auth_time indicates a new session.

    Prefer OIDC auth_time (stable for the session). Do not use iat for routine updates:
    iat changes on every token refresh. One-shot iat only when last_login_at was never set.
    """
    prev = getattr(db_user, "last_login_at", None)
    auth_moment = _sso_auth_time_naive_utc(payload)
    if auth_moment is not None:
        if prev is not None and auth_moment <= prev:
            return False
        db_user.last_login_at = auth_moment  # type: ignore[assignment]
        db_user.login_count = int(getattr(db_user, "login_count", 0) or 0) + 1  # type: ignore[assignment]
        return True
    if prev is None:
        boot = _sso_iat_naive_utc(payload)
        if boot is not None:
            db_user.last_login_at = boot  # type: ignore[assignment]
            db_user.login_count = max(1, int(getattr(db_user, "login_count", 0) or 0))  # type: ignore[assignment]
            return True
    return False


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type((OperationalError, DBAPIError)),
    reraise=False,  # Don't reraise, we handle it manually
)
async def sync_user_to_db_with_retry(
    db: AsyncSession, user_id: str, username: str, email: str, payload: dict[str, Any]
) -> DBUser | None:
    """Sync Keycloak user to database with retry logic.

    Retries up to 3 times with exponential backoff (1s, 2s, 4s) for:
    - OperationalError (connection issues)
    - DBAPIError (database errors)

    Returns:
        DBUser object if successful, None if all retries failed
    """
    try:
        email = _normalize_sso_email(email)
        username = (username or "").strip()
        if not email:
            logger.warning("SSO sync skipped: empty email after normalize (sub=%s)", user_id)
            return None

        # Search by email (stable identifier), case-insensitive for legacy rows
        stmt = select(DBUser).where(func.lower(DBUser.email) == email)
        result = await db.execute(stmt)
        db_user = result.scalar_one_or_none()

        if db_user:
            if getattr(db_user, "is_system_account", False):
                logger.warning(
                    "SSO denied: system/internal account cannot authenticate (%s)",
                    getattr(db_user, "email", "?"),
                )
                return None
            # User exists - update only if data changed (avoid unnecessary DB writes)
            needs_update = False
            if db_user.username != username:
                db_user.username = username  # type: ignore[assignment]
                needs_update = True
            # full_name — «отображаемое имя» в EliteEW (PATCH /profile/me). Не перезаписывать
            # из Keycloak при каждом логине: иначе сохранённое пользователем имя затирается token.name.
            # Первичное значение задаётся при создании пользователя ниже.
            new_is_verified = payload.get("email_verified", False)
            if db_user.is_verified != new_is_verified:
                db_user.is_verified = new_is_verified  # type: ignore[assignment]
                needs_update = True

            # Роль в PG: см. persistable_users_role_from_payload (CHECK на users.role ≠ UI label).
            persisted_role = persistable_users_role_from_payload(payload)
            if db_user.role != persisted_role:
                db_user.role = persisted_role  # type: ignore[assignment]
                needs_update = True

            if _apply_sso_last_login_if_new_session(db_user, payload):
                needs_update = True

            if needs_update:
                await ensure_encryption_pii_key(db)
                await db.commit()
                await db.refresh(db_user)
                logger.info("Updated existing user: %s (id=%s)", username, db_user.id)
            # Если данные не изменились - просто возвращаем без обновления БД
            return db_user
        # Create new user
        # Parse user_id as UUID, or generate new one if invalid
        try:
            parsed_id = UUID(user_id)
        except (ValueError, AttributeError):  # fmt: skip
            parsed_id = uuid4()
            logger.warning("Invalid UUID from Keycloak, generated new: %s", parsed_id)

        # NOTE: "keycloak_sso" is a marker constant for SSO users, not a real password
        # This is safe as SSO users authenticate via Keycloak, not password hash
        first_login = _sso_auth_time_naive_utc(payload) or _sso_iat_naive_utc(payload)
        db_user = DBUser(
            id=parsed_id,
            username=username,
            email=email,
            password_hash="keycloak_sso",  # noqa: S106
            role=persistable_users_role_from_payload(payload),
            is_active=True,
            is_verified=payload.get("email_verified", False),  # type: ignore[arg-type]
            full_name=payload.get("name", username),  # type: ignore[arg-type]
            last_login_at=first_login,
            login_count=1 if first_login is not None else 0,
        )
        db.add(db_user)
        await ensure_encryption_pii_key(db)
        await db.commit()
        await db.refresh(db_user)
        logger.info("Created new SSO user: %s (id=%s)", username, db_user.id)
        try:
            from api.tasks.onboarding_gaf import schedule_system_gaf_onboarding_for_user

            schedule_system_gaf_onboarding_for_user(str(db_user.id))
        except Exception as onboarding_exc:  # noqa: BLE001
            logger.warning(
                "[ONBOARDING_GAF] schedule after new user failed: %s",
                onboarding_exc,
            )
    except IntegrityError:
        # Parallel logins / unique username: fetch existing row (must be before DBAPIError)
        await db.rollback()
        result = await db.execute(select(DBUser).where(func.lower(DBUser.email) == email))
        db_user = result.scalar_one_or_none()
        if db_user and not getattr(db_user, "is_system_account", False):
            return db_user
        try:
            pid = UUID(str(user_id))
        except (ValueError, AttributeError, TypeError):  # fmt: skip
            pid = None
        if pid is not None:
            result = await db.execute(select(DBUser).where(DBUser.id == pid))
            db_user = result.scalar_one_or_none()
            if db_user and not getattr(db_user, "is_system_account", False):
                return db_user
        if username:
            result = await db.execute(select(DBUser).where(DBUser.username == username))
            db_user = result.scalar_one_or_none()
            if db_user and not getattr(db_user, "is_system_account", False):
                return db_user
        return None
    except (OperationalError, DBAPIError) as e:
        # Retryable error - log and let tenacity retry
        logger.warning(" DB sync error (will retry): %s", e)
        await db.rollback()
        raise  # Trigger retry
    except Exception:
        # Non-retryable error
        logger.exception("DB sync failed (non-retryable)")
        await db.rollback()
        return None
    else:
        return db_user


async def get_oauth2_user(
    request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
    db: AsyncSession = Depends(get_postgres_session),
) -> User | None:
    """Get user from OAuth2 Proxy OR Authorization header.

    Priority: OAuth2 Proxy > Authorization header.

    Args:
        request: FastAPI request object
        auth_provider: Provider-agnostic token validation service (injected via Depends)
        db: Database session for user sync (injected via Depends)

    Returns:
        User object if authenticated, None otherwise
    """

    # Check if user already validated in this request (avoid double validation)
    if hasattr(request.state, "validated_user"):
        logger.debug("Using cached user from request.state for: %s", request.url.path)
        user = getattr(request.state, "validated_user", None)
        if user is not None:
            return user  # type: ignore[no-any-return]
        return None

    # Priority 1: OAuth2 Proxy headers (from nginx + OAuth2 Proxy)
    # If token is in OAuth2 Proxy headers - it's already validated, can use cache
    token = request.headers.get("X-Auth-Request-Access-Token")
    email = request.headers.get("X-Auth-Request-Email")
    username = request.headers.get("X-Auth-Request-Preferred-Username")

    # Priority 2: Authorization header (for backward compatibility)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    # Priority 3: token in query (only allowlisted paths; iframe/img cannot send Authorization)
    if not token and path_allows_bearer_token_query_param(request.url.path):
        token = request.query_params.get("token")

    if not token:
        logger.warning("No token found for %s", request.url.path)
        return None

    try:
        # Validate token via Keycloak (RS256 signature verification)
        # validate_token already has Redis cache inside
        payload: dict[str, Any] = await auth_provider.validate_token(token)  # type: ignore[assignment]

        if not payload:
            logger.error("Token validation failed: empty payload")
            return None

        # Native desktop/FoFline PEP: skip web/mobile; missing claims deny only at enforce.
        native_binding_verified = await enforce_native_access_pep(payload)

        if not getattr(request.state, "sso_session_checked", False):
            if is_sso_registry_exempt_api_path(request.url.path):
                request.state.sso_session_checked = True
            else:
                try:
                    session_decision = await get_sso_session_registry().enforce_current_session(
                        payload,
                        request=request,
                        allow_session_replace=native_binding_verified,
                    )
                except SsoSessionRegistryUnavailable as exc:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=build_sso_registry_unavailable_detail(),
                    ) from exc
                if not session_decision.allowed:
                    reason = (
                        AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED
                        if session_decision.reason == "session_replace_confirmation_required"
                        else AUTH_REASON_SESSION_REPLACED
                    )
                    detail_text = (
                        "Confirm replacing active browser session"
                        if reason == AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED
                        else "Session was replaced by a newer login"
                    )
                    status_code = (
                        status.HTTP_409_CONFLICT
                        if reason == AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED
                        else status.HTTP_401_UNAUTHORIZED
                    )
                    detail = build_auth_error_detail(
                        reason=reason,
                        action=AUTH_ACTION_LOGIN,
                    )
                    detail["detail"] = detail_text
                    raise HTTPException(
                        status_code=status_code,
                        detail=detail,
                        headers={"WWW-Authenticate": "Bearer"} if status_code == status.HTTP_401_UNAUTHORIZED else {},
                    )
                request.state.sso_session_checked = True

        # Extract user info from token payload
        user_id: Any = payload.get("sub", "")  # type: ignore[assignment,misc]
        email_raw: Any = payload.get("email", email or "")  # type: ignore[assignment,misc]
        email_norm = _normalize_sso_email(str(email_raw or ""))
        username_from_payload: Any = payload.get(
            "preferred_username",
            username or str(email_raw or "").split("@")[0],  # type: ignore[arg-type,misc]
        )  # type: ignore[assignment,misc]
        username_norm = str(username_from_payload or "").strip()
        if not username_norm and email_norm:
            username_norm = email_norm.split("@")[0]

        # Sync user to database with retry logic
        try:
            db_user = await sync_user_to_db_with_retry(
                db=db,
                user_id=user_id,
                username=username_norm,
                email=email_norm,
                payload=payload,
            )
        except RetryError:
            # All 3 retries failed
            logger.exception("DB sync failed after 3 retries")
            db_user = None

        # Graceful degradation: Allow authentication even if DB sync failed
        if db_user:
            # DB sync successful - use DB user ID
            user_id_final = str(db_user.id)
            logger.debug(
                "✅ OAuth2 user authenticated (DB synced): %s (db_id=%s)",
                username_norm,
                user_id_final,
            )
        else:
            # DB sync failed - use Keycloak ID (transient user)
            user_id_final = user_id
            logger.warning(
                "⚠️  OAuth2 user authenticated without DB row attach (JWT ok, SSO sync returned no user): %s",
                email_norm,
            )

        # Create User object with final user ID
        effective_role = get_effective_role_from_payload(payload)
        ew_family = payload_has_ew_family(payload)
        group_id = (
            getattr(db_user, "app_access_group_id", None) if db_user else None  # type: ignore[arg-type]
        )
        email_for_runtime = email_norm if email_norm else str(email_raw or "").strip()
        user = User(
            id=user_id_final,  # Use synced DB ID or Keycloak ID
            email=email_for_runtime,  # type: ignore[arg-type]
            username=username_norm,  # type: ignore[arg-type]
            role=effective_role,
            is_active=True,
            is_verified=payload.get("email_verified", False),  # type: ignore[arg-type]
            full_name=payload.get("name", ""),  # type: ignore[arg-type]
            app_access_group_id=group_id,
            ew_family=ew_family,
        )

        # Cache user in Redis (DB 15)
        try:
            user_cache = await get_user_cache_service()
            user_data = {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "role": user.role,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "full_name": user.full_name,
                "app_access_group_id": str(user.app_access_group_id) if user.app_access_group_id else None,
                "ew_family": user.ew_family,
            }
            # Cache for 1 hour (can be increased, as data is stable)
            await user_cache.cache_user(user_id_final, user_data, ttl=3600)
        except (ConnectionError, TimeoutError, AttributeError) as e:
            logger.debug("Failed to cache user (non-critical): %s", e)

        # Set user in request.state for RLS middleware and caching
        request.state.user = user
        request.state.user_id = user.id
        request.state.company_id = getattr(user, "company_id", None)  # Optional company_id
        request.state.role = user.role
        # Keycloak subject (may differ from users.id when SSO matched an existing email row).
        request.state.oidc_sub = str(payload.get("sub") or "")
        request.state.oidc_auth_time_epoch = payload.get("auth_time")
        request.state.oidc_issued_at_epoch = payload.get("iat")
        # OAuth client id for FoFline install-profile surface override (azp / client_id).
        azp_raw = payload.get("azp") or payload.get("client_id") or payload.get("clientId")
        request.state.oidc_azp = str(azp_raw).strip() if isinstance(azp_raw, str) else None
        request.state.validated_user = user  # Cache for this request

    except HTTPException:
        raise
    except (ValueError, KeyError, AttributeError) as e:
        logger.exception("OAuth2 validation failed: %s", type(e).__name__)
        return None
    except Exception as e:
        logger.exception("OAuth2 validation failed: %s", type(e).__name__)
        return None
    else:
        return user


async def require_oauth2_user(
    request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
    db: AsyncSession = Depends(get_postgres_session),
) -> User:
    """Require authenticated OAuth2 user (FastAPI dependency).

    Raises 401 if user is not authenticated.

    Usage:
        @router.get("/endpoint")
        async def endpoint(user: User = Depends(lambda: require_oauth2_user)):
            # user is guaranteed to be authenticated
            pass

    Raises:
        HTTPException 401 if authentication fails

    Returns:
        User object
    """
    current_user = await get_oauth2_user(request, auth_provider, db)
    if not current_user:
        logger.debug("OAuth2 authentication required but user not found (expected 401)")
        detail = build_auth_error_detail(
            reason=AUTH_REASON_TOKEN_MISSING,
            action=AUTH_ACTION_LOGIN,
        )
        detail["detail"] = "OAuth2 authentication required. Please log in."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user


async def require_oauth2_user_short_session(
    request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> User:
    """Require OAuth2 user; SQLAlchemy session is closed before this dependency returns.

    Design A for content blob GETs: do not hold ``Depends(get_postgres_session)`` across
    Seaweed retrieve / StreamingResponse. Plan:
    documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md
    """
    cached = getattr(request.state, "validated_user", None)
    if isinstance(cached, User):
        return cached

    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        current_user = await get_oauth2_user(request, auth_provider, db)

    if not current_user:
        logger.debug("OAuth2 authentication required but user not found (expected 401)")
        detail = build_auth_error_detail(
            reason=AUTH_REASON_TOKEN_MISSING,
            action=AUTH_ACTION_LOGIN,
        )
        detail["detail"] = "OAuth2 authentication required. Please log in."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user


async def get_optional_oauth2_user(
    request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
    db: AsyncSession = Depends(get_postgres_session),
) -> User | None:
    """Get OAuth2 user without raising 401 (for optional authentication).

    Usage:
        @router.get("/endpoint")
        async def endpoint(user: Optional[User] = Depends(get_optional_oauth2_user)):
            if user:
                # Authenticated user
                pass
            else:
                # Anonymous user
                pass

    Returns:
        User object if authenticated, None otherwise
    """
    return await get_oauth2_user(request, auth_provider, db)
