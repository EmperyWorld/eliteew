# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Generic Redis response-cache middleware for low-risk GET endpoints.
# Invariants:
# - Dynamic, personalized, streaming, chat, desktop and EWA endpoints must bypass this cache.
# - Public health/version probes must bypass this cache (deploy disclosure + live ok flag).
# - Cache body reads must restore the response iterator before returning to ASGI.
# Related:
# - documentation/platform/REDIS_ARCHITECTURE.md
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# ---
"""Response cache middleware."""

import hashlib
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import TYPE_CHECKING, Any, ClassVar

from fastapi import Request, Response  # type: ignore[import-untyped]
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]
from starlette.responses import JSONResponse  # type: ignore[import-untyped]
from starlette.types import ASGIApp  # type: ignore[import-untyped]

if TYPE_CHECKING:
    from api.services.redis_service import RedisService

from api.services.site_studio_public_utils import is_site_studio_public_host

logger = logging.getLogger(__name__)

# HTTP status code constants
HTTP_STATUS_OK = 200


class ResponseCacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware для автоматического кеширования GET responses

    Features:
    - Caches GET requests only (safe to cache)
    - Respects cache-control headers
    - Excludes specific endpoints (auth, real-time, etc.)
    - Never caches GET under /api/v1/gaf-chat (mount + subpaths; see GAF_CHAT_V1_PREFIX)
    - Uses Redis with 30-minute TTL (optimized for better hit rate)
    - Adds X-Cache-Status header (HIT/MISS)
    """

    # Endpoints to NEVER cache (auth, real-time, etc.)
    EXCLUDED_PATHS: ClassVar[set[str]] = {
        "/health",
        "/api/health",  # Public {ok} / admin topology — must stay live after deploy
        "/api/v1/health",
        "/api/version",  # Public build metadata — never serve stale pre-hardening body
        "/api/auth-keycloak/",
        "/api/websocket/",
        "/socket.io/",
        "/api/oauth2/",
        "/api/logout",
        "/api/business-intelligence/",  # BI health/session state changes frequently
        "/api/v1/voice-gateway/transcribe/status/",  # Queue polling endpoint must stay real-time
        "/api/v1/system/maintenance",  # Planned restart state must stay live for browsers and fallback pages
        "/api/v1/profile/me",  # ИСПРАВЛЕНО: Пользовательские данные
        "/api/v1/projects",  # ИСПРАВЛЕНО: Может быть динамическим
        "/api/v1/companies",  # ИСПРАВЛЕНО: Может быть динамическим
        "/api/v1/ugs/billing/stats",  # ИСПРАВЛЕНО: Биллинг данные
        "/api/v1/ugs/tasks",  # Список задач: большие ответы, персональные данные, не кешируем
        "/api/content",  # КРИТИЧНО: Пользовательские файлы, не кешируем через ResponseCache
        "/api/v1/content",  # КРИТИЧНО: Пользовательские файлы, не кешируем через ResponseCache
        "/api/doc-editor/",  # КРИТИЧНО: Все эндпоинты редактора документов, не кешируем через ResponseCache  # noqa: RUF003
        "/api/v1/doc-editor/",  # КРИТИЧНО: Ultimate Document Editor (list/get/delete должны быть без кэша)  # noqa: RUF003
        "/api/elite-editor/",  # КРИТИЧНО: Все эндпоинты Elite Editor, не кешируем через ResponseCache  # noqa: RUF003
        "/api/unified-editor/",  # КРИТИЧНО: Все эндпоинты Unified Editor, не кешируем через ResponseCache  # noqa: RUF003
        "/api/v1/desktop/",  # Desktop + desktop/admin: персональные и админские данные, не кешируем
        "/api/v1/desktop/admin/",  # Явно: единая админка, ensemble plans, app store admin (дублирует префикс desktop/)
        # desktop-client ops (JWT-skip + X-Desktop-Client-Ops-Token): cache key is path|query|anonymous —
        # a HIT after one authorized GET would leak portal peers (WG keys/IPs) to unauthenticated callers.
        # Trailing slash keeps segment boundary (not /api/v1/desktop-clientele/…).
        "/api/v1/desktop-client/",
        # product-desktop: отдельный mount (не под /api/v1/desktop/) — обращения, новости, assistant; иначе GET
        # кэшируется в Redis и отдаёт устаревший пустой список после POST тикета (X-Cache-Status: HIT).
        "/api/v1/product-desktop/",
        "/api/v1/profile/",  # Профиль и статистика: персональные данные, всегда актуальные (чат, генерации, хранилище)
        "/api/profile/",  # Legacy profile prefix
        "/api/v1/mobile-app",  # Mobile OTA overview/download: версия APK должна быть live после publish, без stale Redis
        "/api/mobile-app",  # Legacy mobile app prefix must also bypass generic response cache
        "/api/v1/ugs/admin/",  # UGS Admin: провайдеры/workflows/settings/users — админские данные, не кешируем
        "/api/v1/ugs/",  # UGS: провайдеры/status/tasks/stats — всегда актуальные данные из БД, не кешируем
        "/api/v1/ewrp/",  # EWRP: status меняется queued → completed, кеш давал бы старый ответ без pdf_url
        "/api/v1/marketing-cabinet",  # Marketing Cabinet: overview/dashboard и сущности должны читаться только из live server state
        "/api/marketing-cabinet",  # Legacy marketing cabinet prefix must also bypass generic response cache
        "/api/v1/ewa/",  # EWA companion/desktop state is per-user and mutable; stale empty workflow lists break UX
        "/api/v1/friends",  # Friends graph, requests, profiles and search are live per-user social state
        "/api/friends",  # Legacy friends prefix must also bypass generic response cache
        "/api/v1/music-generator/batch-tests",  # Batch approaches: статусы строк и оценки меняются без инвалидации GET-kэша
        "/api/v1/music-evolution/",  # Run polling/SSE fallback: progress меняется queued → completed; stale HIT залипал UI на ~18%
        "/api/v1/music-forge/",  # MusicForge run polling/SSE fallback is live per-user state, never Redis-cached
        "/api/v1/kbsew/",  # KBSEW admin barrels/drivers: mutable after POST; stale HIT gave empty list on refresh
        # EBrowser nav policy: per-user mutable after admin PUT; stale HIT kept is_default=true
        # («Сайты пока закрыты») for ~api_cache TTL after open save (2026-09-10 lady_boss).
        "/api/v1/ebrowser/",
    }

    # URL patterns to exclude
    EXCLUDED_PATTERNS: ClassVar[set[str]] = {
        "/stream",  # Any streaming endpoint
        "/ws",  # WebSocket endpoints
        "/sse",  # Server-Sent Events
    }

    # --- GAF Chat v1: exclusive GET response-cache bypass (unit contract) ---
    # Given: any GET to /api/v1/gaf-chat or /api/v1/gaf-chat/<subpath>
    # Expect: this middleware never reads/writes Redis for that path (always call_next / MISS path only).
    # Rationale: chats/messages are session- and user-specific; generic response cache is wrong here.
    # Implementation note: this is the only exclusion that uses segment-boundary matching via
    # _is_gaf_chat_v1_path (not a blind startswith in EXCLUDED_PATHS), so /api/v1/gaf-chatter is not
    # treated as GAF chat.
    GAF_CHAT_V1_PREFIX: ClassVar[str] = "/api/v1/gaf-chat"

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.redis_service: RedisService | None = None

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """Process request with caching logic"""

        if is_site_studio_public_host(request.headers.get("host")):
            return await call_next(request)

        # Skip non-GET requests
        if request.method != "GET":
            return await call_next(request)

        # Skip excluded paths
        if self._should_exclude(request.url.path):
            return await call_next(request)

        # Initialize Redis service
        # Циклическая зависимость: избегаем импорт на top-level
        if not self.redis_service:
            from api.services.redis_service import get_redis_service  # noqa: PLC0415

            self.redis_service = await get_redis_service()  # type: ignore[assignment]

        # Generate cache key
        cache_key = self._generate_cache_key(request)

        # Check cache
        cached_response = await self._get_cached_response(cache_key)

        if cached_response:
            # Cache HIT
            logger.debug("Cache HIT: %s", request.url.path)
            return self._create_response_from_cache(cached_response)

        # Cache MISS - execute request
        logger.debug("Cache MISS: %s", request.url.path)
        response = await call_next(request)

        # Cache successful responses only (200 OK)
        if response.status_code == HTTP_STATUS_OK:
            try:
                await self._cache_response(cache_key, response)
            except Exception as e:
                # Don't let cache errors break the response
                logger.warning("Cache error (non-fatal): %s", str(e))

        # Add cache status header
        response.headers["X-Cache-Status"] = "MISS"

        return response

    @staticmethod
    def _is_gaf_chat_v1_path(path: str) -> bool:
        """True when ``path`` is the GAF Chat v1 mount or a resource under it.

        ``path`` is the URL path only (no query string). Trailing slashes on the mount
        are normalized so /api/v1/gaf-chat/ is treated like /api/v1/gaf-chat. Paths that
        merely share a prefix with the mount (e.g. /api/v1/gaf-chatter) are not matched.
        """
        prefix = ResponseCacheMiddleware.GAF_CHAT_V1_PREFIX
        normalized = path.rstrip("/") or "/"
        return normalized == prefix or normalized.startswith(f"{prefix}/")

    def _should_exclude(self, path: str) -> bool:
        """Check if path should be excluded from caching"""
        # GAF v1 only: dedicated matcher (see GAF_CHAT_V1_PREFIX / _is_gaf_chat_v1_path).
        if self._is_gaf_chat_v1_path(path):
            return True

        for excluded in self.EXCLUDED_PATHS:
            if path.startswith(excluded):
                return True

        return any(pattern in path for pattern in self.EXCLUDED_PATTERNS)

    def _generate_cache_key(self, request: Request) -> str:
        """Generate unique cache key for request"""
        # Include: path + query params + user (if authenticated)
        key_parts = [
            request.url.path,
            str(request.query_params),
        ]

        # Include user ID for user-specific responses (middleware must run after OAuth2)
        user_id = getattr(request.state, "user_id", None)
        if user_id is None:
            user = getattr(request.state, "user", None)
            user_id = (
                (user.get("id") if isinstance(user, dict) else None)
                or request.state.__dict__.get("user_id")
                or "anonymous"
            )
        key_parts.append(str(user_id))

        # CRITICAL: Log cache key generation for debugging
        logger.debug(
            "[CACHE KEY] path=%s, user_id=%s, user_id_type=%s", request.url.path, user_id, type(user_id).__name__
        )

        # Hash for compact key
        # MD5 используется только для кеш-ключей, не для безопасности
        key_str = "|".join(key_parts)
        key_hash = hashlib.md5(key_str.encode()).hexdigest()  # noqa: S324

        return f"response_cache:{key_hash}"

    async def _get_cached_response(self, cache_key: str) -> dict[str, Any] | None:
        """Get cached response from Redis"""
        if not self.redis_service or not self.redis_service.is_available:
            return None

        async with self.redis_service.get_redis_client() as redis:
            if not redis:
                return None

            try:
                cached = await redis.get(cache_key)
                if cached:
                    return json.loads(cached)
                return None  # noqa: TRY300
            except Exception:
                logger.exception("Failed to get cached response")
                return None

    def _create_response_from_cache(self, cached_data: dict) -> Response:
        """Create FastAPI response from cached data"""
        response = JSONResponse(
            content=cached_data["content"],
            status_code=cached_data["status_code"],
            headers=cached_data.get("headers", {}),
        )

        # Add cache hit indicator
        response.headers["X-Cache-Status"] = "HIT"
        response.headers["X-Cache-Age"] = str(cached_data.get("age", 0))

        return response

    async def _cache_response(self, cache_key: str, response: Response) -> None:
        """Cache response in Redis - MUST restore body_iterator"""
        if not self.redis_service or not self.redis_service.is_available:
            return

        body = b""
        body_read = False
        # Starlette sets body_iterator at runtime; stubs for Response omit it (reportAttributeAccessIssue).
        body_iterator: Any = getattr(response, "body_iterator", None)

        try:
            # Step 1: Read body from response iterator
            if body_iterator is None:
                pass
            elif hasattr(body_iterator, "__aiter__"):
                async for chunk in body_iterator:
                    body += chunk
                body_read = True
            elif hasattr(body_iterator, "__iter__"):
                body = b"".join(body_iterator)
                body_read = True

            if not body_read:
                return  # Unknown type - skip, no restore needed

            # Step 2: Parse JSON (skip non-JSON but still restore body)
            try:
                content = json.loads(body.decode())
            except (json.JSONDecodeError, UnicodeDecodeError, ValueError):  # fmt: skip
                # Not JSON - skip caching but restore body
                pass
            else:
                # Step 3: Try to cache in Redis (non-blocking)
                try:
                    async with self.redis_service.get_redis_client() as redis:
                        if redis:
                            cache_data = {
                                "content": content,
                                "status_code": response.status_code,
                                "headers": dict(response.headers),
                            }
                            ttl = self.redis_service.DEFAULT_EXPIRATIONS["api_cache"]
                            await redis.setex(cache_key, ttl, json.dumps(cache_data, default=str))
                            logger.debug("Cached: %s", cache_key)
                except Exception as e:
                    logger.warning("Cache error: %s", str(e))

        except Exception as e:
            logger.warning("Body read error: %s", str(e))

        finally:
            # Step 4: ALWAYS restore body_iterator if we read it
            if body_read:

                async def body_gen() -> AsyncIterator[bytes]:
                    yield body

                # body_iterator exists on Starlette Response; stubs omit it — assign via Any.
                _response_for_body: Any = response
                _response_for_body.body_iterator = body_gen()
