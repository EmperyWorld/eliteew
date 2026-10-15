#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Middleware-level OAuth2 guard for protected API paths before FastAPI routers run.
# Invariants:
# - Public path skips are narrow; route-level handlers must enforce any alternate auth they require.
# - Admin path checks use the same JWT role helper contract as router dependencies.
# Related:
# - api/core/oauth2_auth.py
# - api/routers/desktop.py
# ---
"""
OAuth2 Protection Middleware
Protects API endpoints requiring authorization via OAuth2 (Keycloak SSO)
Supports dual-mode auth: OAuth2 Proxy headers + Bearer tokens
Uses BaseHTTPMiddleware for simplicity

IMPORTANT: READ DOCUMENTATION BEFORE MAKING CHANGES
Documentation: documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md

This middleware validates tokens via provider-agnostic auth service.
DO NOT modify validation logic without understanding authorization architecture!
"""

import logging
import re
from collections.abc import Awaitable, Callable

import structlog  # type: ignore[import-not-found]
from fastapi import Request, Response, status  # type: ignore[import-untyped]
from fastapi.exceptions import HTTPException  # type: ignore[import-untyped]
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]
from starlette.responses import JSONResponse  # type: ignore[import-untyped]
from starlette.types import ASGIApp  # type: ignore[import-untyped]

from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_REFRESH,
    AUTH_REASON_AUTH_FAILED,
    AUTH_REASON_FORBIDDEN,
    AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
    AUTH_REASON_SESSION_REPLACED,
    AUTH_REASON_TOKEN_EXPIRED,
    AUTH_REASON_TOKEN_MISSING,
    build_auth_error_body,
    build_sso_registry_unavailable_detail,
)
from api.core.token_roles import payload_has_admin_access, token_roles_list
from api.core.unified_config import unified_settings
from api.services.auth_provider_service import get_auth_provider_service
from api.services.desktop_client.native_access_pep import enforce_native_access_pep
from api.services.site_studio_public_utils import (
    is_site_studio_public_gateway_path,
    is_site_studio_public_host,
)
from api.services.sso_session_registry import (
    SsoSessionRegistryUnavailable,
    get_sso_session_registry,
    is_sso_registry_exempt_api_path,
)

logger = logging.getLogger(__name__)

# Пути всегда без JWT на уровне middleware (остальная защита — в роутерах).  # noqa: RUF003
_BASE_PUBLIC_PATH_STRINGS: list[str] = [
    # Health / liveness / Prometheus scrape (E6 ops alarms on /metrics)
    r"^/health$",
    r"^/api/health$",
    r"^/api/v1/health$",
    r"^/metrics$",
    r"^/api/metrics$",
    r"^/api/v1/system-info$",
    r"^/api/v1/ping$",
    r"^/api/v1/system/maintenance$",
    r"^/api/elite-editor/health$",
    r"^/api/doc-editor/health$",  # Ultimate Document Editor health endpoint
    r"^/api/ugs/health$",  # UGS health endpoint
    r"^/api/v1/ugs/health$",  # UGS health endpoint (versioned)
    r"^/api/v1/voice-gateway/health$",  # Voice Gateway health endpoint (Stack9 STT/TTS), no auth
    r"^/api/ugs/callback/",  # UGS callback endpoints
    r"^/$",  # Root
    # Version API - public for frontend cache invalidation
    r"^/api/version$",
    r"^/version$",
    # Telemetry endpoints - для диагностики проблем с HTTP/HTTPS  # noqa: RUF003
    r"^/api/v1/telemetry/",
    r"^/api/telemetry/",
    # Auth endpoints - для самой авторизации (includes /api/auth/logout)
    r"^/api/auth/",
    r"^/api/auth/sso/",
    r"^/api/v1/auth/sso/",
    r"^/api/v1/auth/mobile-embedded/",
    r"^/api/auth/mobile-embedded/",
    # OAuth2 Proxy Profile endpoint - validates OAuth2 headers in router
    r"^/api/profile/",
    # Voice Center TTS - public for all users
    r"^/api/voice-center/",
    # Mobile APK direct file link uses short-lived ticket (router validates + strict replay grace).
    r"^/api/v1/mobile-app/download-by-ticket$",
    # Referral landing preview — bounded public read model, no auth required.
    r"^/api/v1/friends/referral/preview$",
    # Native Tauri desktop-client enroll (pre-OIDC). Perimeter = WG/SG; not open marketplace.
    r"^/api/v1/desktop-client/license/redeem$",
    # Pre-OIDC Start gate + in-session kill-switch (no PII; rate-limited in service).
    r"^/api/v1/desktop-client/license/preflight$",
    r"^/api/v1/desktop-client/license/heartbeat$",
    r"^/api/v1/desktop-client/devices/challenge$",
    r"^/api/v1/desktop-client/devices/prove$",
    # Atomic conditional access (Wave 1): pre-OIDC challenge + signed ticket.
    r"^/api/v1/desktop-client/auth/challenge$",
    r"^/api/v1/desktop-client/auth/ticket$",
    # Capsule v2 one-time activation (token + Ed25519 proof; no OIDC).
    r"^/api/v1/desktop-client/activation/consume$",
    # Pre-license Air enrollment WebSocket (selector+secret; edge ingress only).
    r"^/api/v1/desktop-client/air-enroll/ws$",
    # Desktop-client ops (JWT skip only). Routers enforce X-Desktop-Client-Ops-Token =
    # DESKTOP_CLIENT_OPS_TOKEN — not anonymous. Admin JWT twin: /desktop/admin/platform-ops/*.
    r"^/api/v1/desktop-client/license/issue$",
    r"^/api/v1/desktop-client/license/revoke$",
    # Ops GET/PATCH license capabilities (ops token; not JWT).
    r"^/api/v1/desktop-client/licenses/[^/]+$",
    r"^/api/v1/desktop-client/devices/revoke$",
    r"^/api/v1/desktop-client/portal-peers$",
    r"^/api/v1/desktop-client/portal-peers/import$",
    r"^/api/v1/desktop-client/portal-peers/sync$",
    r"^/api/v1/desktop-client/portal-peers/[^/]+/revoke$",
    r"^/api/v1/desktop-client/seats/issue$",
    # Native heartbeat (device-bound); SPA also uses JWT path on same route when authenticated.
    r"^/api/v1/desktop-client/runtime/presence$",
    # EWRP PDF direct links use a short-lived token query; router validates token or falls back to owner auth.
    r"^/api/v1/ewrp/[0-9a-fA-F-]{36}/pdf$",
    # Unified Content direct browser downloads use short-lived opaque tickets.
    # Router handlers validate tickets and re-check ACLs before serving bytes.
    r"^/api/v1/content/[0-9a-fA-F-]{36}/download-by-ticket$",
    r"^/api/v1/content/versions/[0-9a-fA-F-]{36}/download-by-ticket$",
    r"^/api/v1/content/batch-download-by-ticket$",
    r"^/api/v1/content/download-owned-archive-by-ticket$",
    # Theme presets
    r"^/api/themes/presets$",
    r"^/api/business-intelligence/download/",
    # Socket.IO — JWT/SSO enforced in socketio_handler.connect (not this middleware).
    # Legacy FastAPI `/api/ws*` echo router soft-retired 2026-07-28; do not re-add public /ws.
    # Authenticated native WS (Live Voice, Doc Yjs) live under `/api/v1/...` and use
    # validate_websocket_token inside the endpoint after upgrade.
    r"^/socket\.io/",
    # HTTP probe only (not a live socket); nginx may also stub this path.
    r"^/ws/health$",
    # Client-side error logs from frontend (no auth required)
    r"^/api/v1/logs/client-error$",
    # Local Service iframe proxy: route validates a short HttpOnly cookie because iframes cannot send Authorization.
    r"^/api/v1/desktop/local-service-proxy(?:/.*)?$",
    # ESP TFT desk display AI / image (device token in router; not anonymous).
    r"^/api/v1/ewa/esp-display/turn$",
    r"^/api/v1/ewa/esp-display/image$",
]

_ROUTE_AUTH_PATH_STRINGS: tuple[str, ...] = (
    r"^/api/v1/desktop-client/auth/internal/precheck$",
    r"^/api/v1/desktop-client/auth/internal/commit$",
    r"^/api/v1/desktop-client/auth/internal/refresh-decision$",
)


def build_public_path_strings() -> list[str]:
    """Paths that skip JWT in this middleware. Opt-in for docs, monitoring, AI SDK via env (see UnifiedConfig)."""
    paths = list(_BASE_PUBLIC_PATH_STRINGS)
    if unified_settings.public_openapi_docs:
        paths.extend(
            [
                r"^/api/docs",
                r"^/api/redoc",
                r"^/api/openapi\.json",
                r"^/openapi\.json",
            ],
        )
    return paths


def build_route_auth_path_strings() -> tuple[str, ...]:
    """Exact POST routes whose handlers enforce a non-Bearer machine credential."""
    return _ROUTE_AUTH_PATH_STRINGS


# Пути требующие админские права
ADMIN_PATHS = [
    r"^/api/admin/",
    r"^/api/docker/",
    # Убираем /api/monitoring/ - базовые метрики доступны всем авторизованным пользователям
    # При необходимости можно добавить конкретные admin endpoints:
    # r"^/api/monitoring/admin/",
]


class OAuth2ProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware для защиты API через OAuth2 (Keycloak SSO)
    Поддерживает OAuth2 Proxy headers (приоритет) и Bearer tokens (fallback)
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.auth_provider = None
        self.public_patterns = [re.compile(p) for p in build_public_path_strings()]
        self.route_auth_patterns = [re.compile(p) for p in build_route_auth_path_strings()]
        self.admin_patterns = [re.compile(p) for p in ADMIN_PATHS]

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """
        Проверяет авторизацию для защищённых endpoints
        """
        path = request.url.path

        if is_site_studio_public_host(request.headers.get("host")) and is_site_studio_public_gateway_path(path):
            return await call_next(request)

        # FIX: Пропускаем Socket.IO подключения - они обрабатываются Socket.IO сервером
        if path.startswith("/socket.io/"):
            return await call_next(request)

        # Internal binding routes use a dedicated high-entropy SPI credential.
        # Handoff is POST-only and exact-path; each handler remains fail-closed.
        if request.method == "POST" and self._uses_route_auth(path):
            logger.debug("[STEP] oauth2_route_auth_handoff path=%s", path)
            return await call_next(request)

        # Пропускаем публичные пути
        if self._is_public_path(path):
            return await call_next(request)

        # Пропускаем OPTIONS запросы (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Инициализируем auth provider service если нужно
        if not self.auth_provider:
            try:
                self.auth_provider = get_auth_provider_service()  # type: ignore[assignment]
            except Exception:
                logger.exception("Failed to initialize auth provider service")
                # Если Keycloak недоступен - пропускаем запрос (fallback mode)
                logger.warning("Running in fallback mode - no auth check")
                # Security fix: Return 503 instead of allowing unauthenticated access
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "Authentication service temporarily unavailable"},
                )

        # PRIORITY 1: Check OAuth2 Proxy token (X-Auth-Request-Access-Token)
        # OAuth2 Proxy sets this header after validating the session
        token = request.headers.get("X-Auth-Request-Access-Token")

        if not token:
            # Fallback: Extract token from Authorization header
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")

        if not token:
            logger.debug("Unauthorized access to %s - no token (expected 401)", path)
            content = build_auth_error_body(
                reason=AUTH_REASON_TOKEN_MISSING,
                action=AUTH_ACTION_LOGIN,
                detail="Authorization required",
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=content,
                headers={"WWW-Authenticate": 'Bearer realm="empery"'},
            )

        # Log token source for debugging
        token_source = (
            "X-Auth-Request-Access-Token" if request.headers.get("X-Auth-Request-Access-Token") else "Authorization"
        )
        logger.debug("Token found from %s, length: %s, path: %s", token_source, len(token), path)

        try:
            # ОПТИМИЗАЦИЯ: validate_token уже проверяет Redis кэш внутри
            # Первая проверка токена - проверка кэша (быстро, <1ms)
            # Если токена нет в кэше - RS256 валидация (быстро, ~5ms)
            # Если RS256 не работает - introspection fallback (медленно, ~50ms, но редко)
            # Результат автоматически кэшируется в Redis (DB 15) на время жизни токена
            token_info = await self.auth_provider.validate_token(token)  # type: ignore[attr-defined]

            # validate_token возвращает декодированный JWT payload, не introspection response
            # Если токен валиден, он вернет payload, если нет - выбросит исключение
            if not token_info:
                logger.warning("Invalid token for %s (token_info is None)", path)
                content = build_auth_error_body(
                    reason=AUTH_REASON_TOKEN_EXPIRED,
                    action=AUTH_ACTION_REFRESH,
                    detail="Invalid or expired token",
                )
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=content,
                    headers={"WWW-Authenticate": 'Bearer realm="empery"'},
                )

            native_binding_verified = await enforce_native_access_pep(token_info)

            try:
                if is_sso_registry_exempt_api_path(path):
                    request.state.sso_session_checked = True
                else:
                    session_decision = await get_sso_session_registry().enforce_current_session(
                        token_info,
                        request=request,
                        allow_session_replace=native_binding_verified,
                    )
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
                        logger.info(
                            "Rejected SSO session for user=%s class=%s path=%s reason=%s",
                            token_info.get("preferred_username"),
                            session_decision.claims.client_class if session_decision.claims else "?",
                            path,
                            session_decision.reason or "session_replaced",
                        )
                        content = build_auth_error_body(
                            reason=reason,
                            action=AUTH_ACTION_LOGIN,
                            detail=detail_text,
                            displaced_by=session_decision.displaced_by,
                            xor_partner=session_decision.xor_partner,
                        )
                        return JSONResponse(
                            status_code=status_code,
                            content=content,
                            headers=(
                                {"WWW-Authenticate": 'Bearer realm="empery"'}
                                if status_code == status.HTTP_401_UNAUTHORIZED
                                else {}
                            ),
                        )
                    request.state.sso_session_checked = True
                    # FoFline W5: fail-closed remote-tools allowlist (same stack0, scoped surface).
                    # Gate on SSO class **or** FoFline azp so registry-skip (claims=None) cannot bypass.
                    from api.services.fofline_remote_tools import (
                        fofline_remote_tools_deny_reason,
                        should_apply_fofline_remote_tools_gate,
                    )

                    claims_class = session_decision.claims.client_class if session_decision.claims is not None else None
                    if should_apply_fofline_remote_tools_gate(token_info, client_class=claims_class):
                        deny_reason = fofline_remote_tools_deny_reason(path)
                        if deny_reason is not None:
                            logger.info(
                                "FoFline remote-tools deny user=%s path=%s",
                                token_info.get("preferred_username"),
                                path,
                            )
                            return JSONResponse(
                                status_code=status.HTTP_403_FORBIDDEN,
                                content=build_auth_error_body(
                                    reason=deny_reason,
                                    action=AUTH_ACTION_LOGIN,
                                    detail="This action is not available in FoFline",
                                ),
                            )

                    # Client edition host: tools.remote deny-by-default (API hard gate).
                    from api.services.client_remote_tools import (
                        client_remote_tools_deny_reason,
                        should_apply_client_remote_tools_gate,
                    )

                    if should_apply_client_remote_tools_gate():
                        client_deny = client_remote_tools_deny_reason(path)
                        if client_deny is not None:
                            logger.info(
                                "Client remote-tools deny user=%s path=%s",
                                token_info.get("preferred_username"),
                                path,
                            )
                            return JSONResponse(
                                status_code=status.HTTP_403_FORBIDDEN,
                                content=build_auth_error_body(
                                    reason=client_deny,
                                    action=AUTH_ACTION_LOGIN,
                                    detail="This action is not available in the client edition",
                                ),
                            )
            except SsoSessionRegistryUnavailable:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=build_sso_registry_unavailable_detail(),
                )

            # Логируем только на debug уровне (уменьшаем нагрузку на логи)
            logger.debug(
                "Token validated for user: %s",
                token_info.get("preferred_username", "unknown"),
            )

            # Проверяем админские права если нужно (те же источники ролей, что и require_oauth2_user)
            if self._is_admin_path(path) and not payload_has_admin_access(token_info):
                logger.warning(
                    "Insufficient permissions for %s - user: %s",
                    path,
                    token_info.get("preferred_username"),
                )
                content = build_auth_error_body(
                    reason=AUTH_REASON_FORBIDDEN,
                    action=AUTH_ACTION_LOGIN,
                    detail="Admin access required",
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=content,
                )

            # Добавляем информацию о пользователе в request state  # noqa: RUF003
            user_roles = token_roles_list(token_info)
            user_payload = {
                "id": token_info.get("sub"),
                "username": token_info.get("preferred_username"),
                "email": token_info.get("email"),
                "roles": user_roles,
            }
            request.state.user = user_payload
            structlog.contextvars.bind_contextvars(
                user_id=user_payload.get("id"),
                username=user_payload.get("username"),
                user_roles=",".join(user_roles),
            )

            # Логируем успешный доступ (только для не-health endpoints); сначала имя пользователя
            if not path.endswith("/health"):
                _uname = (
                    request.state.user.get("username")
                    or request.state.user.get("email")
                    or request.state.user.get("id")
                    or "unknown"
                )
                logger.info("user=%s authorized path=%s", _uname, path)

        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, str) else str(e.detail)
            reason = AUTH_REASON_TOKEN_EXPIRED if e.status_code == 401 else AUTH_REASON_AUTH_FAILED
            action = AUTH_ACTION_REFRESH if reason == AUTH_REASON_TOKEN_EXPIRED else AUTH_ACTION_LOGIN
            content = build_auth_error_body(
                reason=reason,
                action=action,
                detail=detail,
            )
            return JSONResponse(
                status_code=e.status_code,
                content=content,
                headers={"WWW-Authenticate": 'Bearer realm="empery"'} if e.status_code == 401 else {},
            )
        except (ValueError, KeyError, AttributeError, RuntimeError) as e:
            logger.warning(
                "Token validation failed for %s: %s: %s",
                path,
                type(e).__name__,
                str(e)[:200],
            )
            content = build_auth_error_body(
                reason=AUTH_REASON_TOKEN_EXPIRED,
                action=AUTH_ACTION_REFRESH,
                detail="Authentication failed",
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=content,
                headers={"WWW-Authenticate": 'Bearer realm="empery"'},
            )

        # Продолжаем обработку запроса
        return await call_next(request)

    def _is_public_path(self, path: str) -> bool:
        """Проверяет является ли путь публичным"""
        return any(pattern.match(path) for pattern in self.public_patterns)

    def _uses_route_auth(self, path: str) -> bool:
        """Return True only for handlers that enforce their own machine credential."""
        return any(pattern.match(path) for pattern in self.route_auth_patterns)

    def _is_admin_path(self, path: str) -> bool:
        """Проверяет требует ли путь админские права"""
        return any(pattern.match(path) for pattern in self.admin_patterns)
