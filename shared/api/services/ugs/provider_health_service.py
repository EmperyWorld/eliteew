# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Provider health probes and DB health recording for UGS.
# Invariants:
# - ComfyUI health uses the same base URL resolver as execution.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

import asyncio
import logging
import socket
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]
from sqlalchemy import text  # type: ignore[import-not-found]

from api.services.ugs.provider_config_models import ProviderError
from api.services.ugs.provider_runtime_seeds import ugs_resolve_text_llm_base_url
from api.services.ugs.text_llm_constants import TEXT_LLM_PROVIDER_TYPES

logger = logging.getLogger(__name__)


class ProviderHealthServiceMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    async def check_provider_status(self, provider_name: str) -> dict[str, Any]:
        """Check provider health and record in database"""
        try:
            await self._ensure_http_session()
            config = await self.get_provider_config(provider_name)
            # MISO/ИМК rows use provider_type "miso" (DB CHECK) but call the same text stack as llama/llama
            # (_call_miso / _call_imc_* use ugs_resolve_text_llm_base_url). Health must not use a bare "" base.
            use_text_stack_base = config.provider_type in TEXT_LLM_PROVIDER_TYPES or config.provider_type == "miso"
            if config.provider_type == "comfyui":
                # Same resolver as execution (COMFYUI_URL / contour env / DB base_url).
                health_base = self._resolve_comfyui_base_url(config, generation_type="")
            elif use_text_stack_base:
                health_base = ugs_resolve_text_llm_base_url(config.base_url)
            else:
                health_base = str(config.base_url or "").strip().rstrip("/")
            url = f"{health_base}{config.health_endpoint}"
            health_timeout_seconds = max(3, min(int(config.timeout_seconds), 15))

            start_time = datetime.now(UTC)
            if config.provider_type == "faster_whisper":
                from api.services.voice.stt_service import STTService  # noqa: PLC0415

                health = await STTService.health_check()
                is_healthy = health.get("status") == "up"
                response_time_ms = health.get("latency_ms")

                await self._record_health_check(
                    provider_name=provider_name,
                    is_healthy=is_healthy,
                    response_time_ms=int(response_time_ms) if response_time_ms else None,
                    error_message=None if is_healthy else health.get("error"),
                )

                http_status_ok = 200
                return {
                    "available": is_healthy,
                    "response_time": response_time_ms,
                    "last_checked": datetime.now(UTC),
                    "status_code": http_status_ok if is_healthy else None,
                    "details": health,
                }

            probe_timeout = httpx.Timeout(
                timeout=float(health_timeout_seconds),
                connect=float(min(5, health_timeout_seconds)),
            )
            async with httpx.AsyncClient(timeout=probe_timeout) as probe_client:
                response = await probe_client.get(url)
            response_time = (datetime.now(UTC) - start_time).total_seconds() * 1000  # ms

            http_status_ok = 200
            is_healthy = response.status_code == http_status_ok
            error_message = None if is_healthy else f"HTTP {response.status_code}"

            # Record health check in database
            await self._record_health_check(
                provider_name=provider_name,
                is_healthy=is_healthy,
                response_time_ms=int(response_time),
                error_message=error_message,
            )

            return {
                "available": is_healthy,
                "response_time": response_time,
                "last_checked": datetime.now(UTC),
                "status_code": response.status_code,
            }

        except (TimeoutError, aiohttp.ClientError, httpx.HTTPError, OSError) as e:
            # Handle DNS errors, connection errors, and timeouts gracefully
            error_msg = str(e)
            error_type = type(e).__name__

            # Check if it's a DNS resolution error (gaierror) - don't log as error, only warning
            is_dns_error = (
                isinstance(e, socket.gaierror)
                or "name resolution" in error_msg.lower()
                or "gaierror" in error_type.lower()
                or (
                    isinstance(e, OSError) and hasattr(e, "errno") and e.errno in (-2, -3)  # noqa: PLR2004
                )  # Name or service not known / temporary DNS failure
            )

            if is_dns_error:
                # DNS errors are expected for unavailable services - log as debug/warning, not error
                logger.debug(
                    "Provider %s DNS resolution failed (expected for unavailable services): %s",
                    provider_name,
                    error_msg or error_type,
                )
                error_msg = f"DNS resolution failed: {error_msg or error_type}"
            elif "timeout" in error_msg.lower() or isinstance(e, asyncio.TimeoutError):
                logger.info("Provider %s health check timeout: %s", provider_name, error_msg or error_type)
                error_msg = f"Connection timeout: {error_msg or error_type}"
            else:
                logger.info("Provider %s health check network error: %s", provider_name, error_msg or error_type)

            # Record failed health check (but don't raise exception - return gracefully)
            try:
                await self._record_health_check(
                    provider_name=provider_name,
                    is_healthy=False,
                    response_time_ms=None,
                    error_message=error_msg,
                )
            except (OSError, ValueError, TypeError) as record_error:
                # Don't fail health check if recording fails
                logger.debug("Failed to record health check for %s: %s", provider_name, record_error)

            return {"available": False, "error": error_msg, "last_checked": datetime.now(UTC)}
        except ProviderError as e:
            error_msg = str(e)
            logger.warning("Provider %s health check failed: %s", provider_name, error_msg)

            await self._record_health_check(
                provider_name=provider_name,
                is_healthy=False,
                response_time_ms=None,
                error_message=error_msg,
            )

            return {"available": False, "error": error_msg, "last_checked": datetime.now(UTC)}
        except (ValueError, TypeError) as e:
            error_msg = str(e)
            logger.exception(
                "Provider %s health check unexpected error: %s",
                provider_name,
                error_msg,
            )

            # Record failed health check
            await self._record_health_check(
                provider_name=provider_name,
                is_healthy=False,
                response_time_ms=None,
                error_message=error_msg,
            )

            return {"available": False, "error": error_msg, "last_checked": datetime.now(UTC)}

    async def get_provider_stats(self) -> dict[str, Any]:
        """Aggregate provider health statistics for monitoring widgets"""
        try:
            # Load all enabled providers from DB
            query = text(
                """
                SELECT provider_name
                FROM generation_providers
                WHERE enabled = TRUE
                ORDER BY provider_name
                """
            )

            result = await self.db.execute(query)
            provider_rows = [row._mapping["provider_name"] for row in result]

            total_providers = len(provider_rows)

            # Check health concurrently
            async def _check(name: str) -> tuple[str, dict[str, Any]]:
                try:
                    status = await self.check_provider_status(name)
                except (TimeoutError, aiohttp.ClientError, OSError) as exc:
                    logger.warning("Provider stats check failed: %s: %s", name, exc)
                    status = {
                        "available": False,
                        "error": str(exc),
                        "last_checked": datetime.now(UTC),
                    }
                return name, status

            checks: list[tuple[str, dict[str, Any]]] = []
            if provider_rows:
                async with asyncio.TaskGroup() as tg:
                    tasks: list[asyncio.Task[tuple[str, dict[str, Any]]]] = []
                    for provider_name in provider_rows:
                        tasks.append(tg.create_task(_check(provider_name)))
                checks = [task.result() for task in tasks]

            healthy = sum(1 for _, st in checks if st.get("available"))
            unhealthy = total_providers - healthy

            return {
                "total_providers": total_providers,
                "available_providers": healthy,
                "unavailable_providers": unhealthy,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        except (OSError, ValueError, TypeError):  # fmt: skip
            logger.exception("Failed to aggregate provider stats")
            return {
                "total_providers": 0,
                "available_providers": 0,
                "unavailable_providers": 0,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    async def _record_health_check(
        self,
        provider_name: str,
        is_healthy: bool,
        response_time_ms: int | None,
        error_message: str | None,
    ) -> None:
        """Record provider health check result in database"""
        try:
            query = text("""
                SELECT record_provider_health(
                    :provider_name,
                    :is_healthy,
                    :response_time_ms,
                    :error_message,
                    0,  -- queue_size (not tracked yet)
                    0   -- active_requests (not tracked yet)
                )
            """)

            await self.db.execute(
                query,
                {
                    "provider_name": provider_name,
                    "is_healthy": is_healthy,
                    "response_time_ms": response_time_ms,
                    "error_message": error_message,
                },
            )

        except (OSError, ValueError, TypeError):  # fmt: skip
            logger.exception("Failed to record health check for %s", provider_name)
            # Rollback transaction to prevent PendingRollbackError
            try:
                await self.db.rollback()
            except (OSError, ValueError, TypeError) as rollback_error:
                logger.warning("Failed to rollback after health check error: %s", rollback_error)
