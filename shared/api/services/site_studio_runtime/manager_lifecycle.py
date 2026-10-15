# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lifecycle mixins (provision/start/stop/destroy) for SiteStudioRuntimeManager.
# Invariants:
# - Public imports remain via api.services.site_studio_runtime_service.
# Related:
# - api/services/site_studio_runtime/manager.py
# ---
from __future__ import annotations

import asyncio
import logging
import subprocess
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from api.core.http_clients import get_httpx_client
from api.models.desktop import SiteStudioStatus
from api.services.site_studio_runtime.helpers import (
    SITE_STUDIO_HEALTH_POLL_SECONDS,
    SITE_STUDIO_HEALTH_TIMEOUT_SECONDS,
    SiteStudioRuntimeError,
    SiteStudioRuntimeInstance,
    SiteStudioRuntimeLayout,
    build_site_studio_internal_api_base_url,
    build_site_studio_internal_public_url,
    decrypt_site_studio_secret,
    normalize_site_studio_template_key,
    resolve_site_studio_template_profile,
    resolve_site_studio_template_profile_id,
    rewrite_site_studio_internal_url,
    slugify_site_title,
)
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)


class SiteStudioRuntimeLifecycleMixin:
    """Lifecycle ops. Cross-mixin compose methods typed via TYPE_CHECKING stubs."""

    container_runtime: str
    default_template_root: Path
    runtime_base_dir: Path
    _resolved_runtime_cli: str | None
    _resolved_runtime_env: dict[str, str] | None
    _admin_token_cache: dict[str, tuple[str, float]]
    _admin_login_locks: dict[str, asyncio.Lock]

    if TYPE_CHECKING:

        def _admin_token_cache_key(self, instance: SiteStudioRuntimeInstance) -> str: ...

        def _layout(self, instance: SiteStudioRuntimeInstance) -> SiteStudioRuntimeLayout: ...

        def _compose_project_name(self, instance: SiteStudioRuntimeInstance) -> str: ...

        def _prepare_runtime_files(
            self,
            instance: SiteStudioRuntimeInstance,
            *,
            force_refresh_source: bool = False,
        ) -> tuple[dict[str, Any], str]: ...

        def _run_compose(
            self,
            compose_file_path: str,
            project_name: str,
            *args: str,
        ) -> subprocess.CompletedProcess[str]: ...

        def _run_runtime(self, *args: str) -> subprocess.CompletedProcess[str]: ...

        def _list_compose_container_ids(self, project_name: str) -> list[str]: ...

        def _remove_compose_network(self, project_name: str) -> None: ...

        def _owned_runtime_resources(
            self, instance: SiteStudioRuntimeInstance, *, create: bool = False
        ) -> tuple[list[str], str | None]: ...

        def _remove_owned_runtime_resources(self, instance: SiteStudioRuntimeInstance) -> None: ...

        def _remove_tree(self, path: Path) -> None: ...

    async def _wait_until_healthy(
        self,
        public_url: str,
        api_base_url: str,
        *,
        compose_project_name: str | None = None,
    ) -> None:
        deadline = time.monotonic() + SITE_STUDIO_HEALTH_TIMEOUT_SECONDS
        client = get_httpx_client()
        last_error = "runtime did not become healthy"
        # Never fall back to public HTTPS here — edge cert for *.sites.eliteew.ru may be
        # missing while local compose is healthy (one-label *.eliteew.ru does not cover it).
        internal_public_url = build_site_studio_internal_public_url(
            compose_project_name
        ) or rewrite_site_studio_internal_url(public_url)
        internal_api_base_url = build_site_studio_internal_api_base_url(
            compose_project_name
        ) or rewrite_site_studio_internal_url(api_base_url)
        if not internal_api_base_url or not internal_public_url:
            raise SiteStudioRuntimeError("Runtime compose metadata missing; cannot wait on public HTTPS health probes")
        if not internal_api_base_url.startswith("http://") or not internal_public_url.startswith("http://"):
            raise SiteStudioRuntimeError(
                "Runtime health probes require internal HTTP URLs (compose network), not public HTTPS"
            )

        while time.monotonic() < deadline:
            public_ok = False
            api_ok = False
            try:
                api_response = await client.get(f"{internal_api_base_url}/health")
                api_ok = api_response.status_code < 400
            except Exception as exc:  # noqa: BLE001
                last_error = f"API health failed: {exc}"

            try:
                public_response = await client.get(internal_public_url)
                public_ok = public_response.status_code < 400
            except Exception as exc:  # noqa: BLE001
                last_error = f"Frontend health failed: {exc}"

            if api_ok and public_ok:
                return
            await asyncio.sleep(SITE_STUDIO_HEALTH_POLL_SECONDS)

        raise SiteStudioRuntimeError(last_error)

    async def login_admin(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        force_refresh: bool = False,
    ) -> str:
        if not instance.api_base_url:
            raise SiteStudioRuntimeError("Site API URL is not configured yet")

        cache_key = self._admin_token_cache_key(instance)
        if not force_refresh:
            cached = self._admin_token_cache.get(cache_key)
            if cached and cached[1] > time.monotonic():
                return cached[0]

        login_lock = self._admin_login_locks.setdefault(cache_key, asyncio.Lock())
        async with login_lock:
            if force_refresh:
                self._admin_token_cache.pop(cache_key, None)
            else:
                cached = self._admin_token_cache.get(cache_key)
                if cached and cached[1] > time.monotonic():
                    return cached[0]

            decrypted_password = decrypt_site_studio_secret(instance.admin_password_encrypted or "")
            if not decrypted_password:
                raise SiteStudioRuntimeError("Site admin password is not configured")

            client = get_httpx_client()
            internal_api_base_url = (
                build_site_studio_internal_api_base_url(instance.compose_project_name)
                or rewrite_site_studio_internal_url(instance.api_base_url)
                or instance.api_base_url
            )
            response = await client.post(
                f"{internal_api_base_url}/admin/login",
                json={"email": instance.admin_email, "password": decrypted_password},
            )
            response.raise_for_status()
            token = response.json().get("token")
            if not token:
                raise SiteStudioRuntimeError("Site admin login returned no token")
            normalized_token = str(token)
            self._admin_token_cache[cache_key] = (
                normalized_token,
                time.monotonic() + (23 * 60 * 60),
            )
            return normalized_token

    async def sync_site_settings(self, instance: SiteStudioRuntimeInstance) -> None:
        if not instance.public_url or not instance.api_base_url:
            return
        token = await self.login_admin(instance)
        client = get_httpx_client()
        internal_api_base_url = (
            build_site_studio_internal_api_base_url(instance.compose_project_name)
            or rewrite_site_studio_internal_url(instance.api_base_url)
            or instance.api_base_url
        )
        response = await client.put(
            f"{internal_api_base_url}/admin/site-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "siteTitle": instance.site_title,
                "siteDescription": instance.site_topic,
                "frontendUrl": instance.public_url,
                "shopUrl": instance.public_url,
            },
        )
        response.raise_for_status()

    def resolve_template_profile_id(self, template_key: str | None) -> str | None:
        return resolve_site_studio_template_profile_id(template_key)

    def _build_template_profile_payload(self, instance: SiteStudioRuntimeInstance) -> dict[str, Any] | None:
        profile = resolve_site_studio_template_profile(instance.template_key)
        if not profile:
            return None
        profile_id = str(profile.get("profile_id") or "").strip()
        if not profile_id:
            return None

        brand = (instance.site_title or "").strip() or "Ваш проект"
        topic = (instance.site_topic or "").strip() or "услуги и продукты бренда"
        slug = slugify_site_title(instance.site_slug or brand)
        admin_email = (instance.admin_email or "").strip() or f"hello@{slug}.local"
        template_context = {
            "brand": brand,
            "topic": topic,
            "slug": slug,
            "admin_email": admin_email,
        }

        def render_value(value: Any) -> str:
            text = str(value or "").strip()
            if not text:
                return ""
            try:
                return text.format_map(template_context).strip()
            except Exception:  # noqa: BLE001
                return text

        settings: dict[str, str] = {}
        settings_template = profile.get("site_settings")
        if isinstance(settings_template, dict):
            for raw_key, raw_value in settings_template.items():
                key = str(raw_key).strip()
                if not key:
                    continue
                value = render_value(raw_value)
                if value:
                    settings[key] = value

        blocks: list[dict[str, str]] = []
        blocks_template = profile.get("blocks")
        if isinstance(blocks_template, list):
            for item in blocks_template:
                if not isinstance(item, dict):
                    continue
                page = str(item.get("page") or "").strip()
                section = str(item.get("section") or "").strip()
                key = str(item.get("key") or "").strip()
                value = render_value(item.get("value"))
                if page and section and key and value:
                    blocks.append({"page": page, "section": section, "key": key, "value": value})

        return {
            "profile_id": profile_id,
            "settings": settings,
            "blocks": blocks,
        }

    async def apply_template_profile(self, instance: SiteStudioRuntimeInstance) -> str | None:
        """Apply one-time template overlay (site settings + starter content blocks)."""
        if not instance.api_base_url:
            return None

        payload = self._build_template_profile_payload(instance)
        if not payload:
            return None

        token = await self.login_admin(instance)
        client = get_httpx_client()
        internal_api_base_url = (
            build_site_studio_internal_api_base_url(instance.compose_project_name)
            or rewrite_site_studio_internal_url(instance.api_base_url)
            or instance.api_base_url
        )
        auth_headers = {"Authorization": f"Bearer {token}"}

        settings = payload.get("settings")
        if isinstance(settings, dict) and settings:
            settings_response = await client.patch(
                f"{internal_api_base_url}/admin/site-settings",
                headers=auth_headers,
                json=settings,
            )
            settings_response.raise_for_status()

        blocks = payload.get("blocks")
        if isinstance(blocks, list) and blocks:
            blocks_response = await client.put(
                f"{internal_api_base_url}/content/blocks/bulk",
                headers=auth_headers,
                json={"blocks": blocks},
            )
            blocks_response.raise_for_status()

        profile_id = str(payload["profile_id"])
        logger.info(
            "Site Studio template profile applied slug=%s template=%s profile=%s blocks=%s",
            instance.site_slug,
            normalize_site_studio_template_key(instance.template_key),
            profile_id,
            len(blocks) if isinstance(blocks, list) else 0,
        )
        return profile_id

    async def provision(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        force_refresh_source: bool = False,
    ) -> dict[str, Any]:
        stage = "prepare_runtime_files"
        operation_started_at = time.perf_counter()
        stage_timings_ms: dict[str, int] = {}
        metadata: dict[str, Any] = {}
        try:
            stage_started_at = time.perf_counter()
            metadata, _ = await asyncio.to_thread(
                self._prepare_runtime_files,
                instance,
                force_refresh_source=force_refresh_source,
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)

            runtime_mode = str(metadata.get("runtime_mode") or "unknown")
            template_api_image = str(metadata.get("template_api_image") or "-")
            template_frontend_image = str(metadata.get("template_frontend_image") or "-")

            stage = "compose_up"
            stage_started_at = time.perf_counter()
            result = await asyncio.to_thread(
                self._run_compose,
                str(metadata["compose_file_path"]),
                str(metadata["compose_project_name"]),
                "up",
                "-d",
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)
            if result.returncode != 0:
                raise SiteStudioRuntimeError(result.stderr.strip() or result.stdout.strip())

            stage = "wait_until_healthy"
            stage_started_at = time.perf_counter()
            await self._wait_until_healthy(
                str(metadata["public_url"]),
                str(metadata["api_base_url"]),
                compose_project_name=str(metadata["compose_project_name"]),
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)

            total_ms = int((time.perf_counter() - operation_started_at) * 1000)
            metadata["status"] = SiteStudioStatus.RUNNING.value
            metadata["last_provisioned_at"] = utc_now_naive()
            logger.info(
                "Site Studio provision succeeded slug=%s mode=%s runtime=%s api_image=%s frontend_image=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                runtime_mode,
                metadata.get("container_runtime") or self.container_runtime,
                template_api_image,
                template_frontend_image,
                stage_timings_ms,
                total_ms,
            )
            return metadata
        except Exception as exc:  # noqa: BLE001
            total_ms = int((time.perf_counter() - operation_started_at) * 1000)
            runtime_mode = str(metadata.get("runtime_mode") or "unknown")
            logger.exception(
                "Site Studio provision failed slug=%s stage=%s mode=%s runtime=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                stage,
                runtime_mode,
                metadata.get("container_runtime") or self.container_runtime,
                stage_timings_ms,
                total_ms,
            )
            raise SiteStudioRuntimeError(f"stage={stage}; {exc}") from exc

    async def start(self, instance: SiteStudioRuntimeInstance) -> dict[str, Any]:
        stage = "prepare_runtime_files"
        operation_started_at = time.perf_counter()
        stage_timings_ms: dict[str, int] = {}
        metadata: dict[str, Any] = {}
        try:
            stage_started_at = time.perf_counter()
            metadata, _ = await asyncio.to_thread(
                self._prepare_runtime_files,
                instance,
                force_refresh_source=False,
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)

            stage = "compose_up"
            stage_started_at = time.perf_counter()
            result = await asyncio.to_thread(
                self._run_compose,
                str(metadata["compose_file_path"]),
                str(metadata["compose_project_name"]),
                "up",
                "-d",
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)
            if result.returncode != 0:
                raise SiteStudioRuntimeError(result.stderr.strip() or result.stdout.strip())

            stage = "wait_until_healthy"
            stage_started_at = time.perf_counter()
            await self._wait_until_healthy(
                str(metadata["public_url"]),
                str(metadata["api_base_url"]),
                compose_project_name=str(metadata["compose_project_name"]),
            )
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)
            metadata["status"] = SiteStudioStatus.RUNNING.value
            logger.info(
                "Site Studio start succeeded slug=%s mode=%s runtime=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                metadata.get("runtime_mode") or "unknown",
                metadata.get("container_runtime") or self.container_runtime,
                stage_timings_ms,
                int((time.perf_counter() - operation_started_at) * 1000),
            )
            return metadata
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Site Studio start failed slug=%s stage=%s runtime=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                stage,
                self.container_runtime,
                stage_timings_ms,
                int((time.perf_counter() - operation_started_at) * 1000),
            )
            raise SiteStudioRuntimeError(f"stage={stage}; {exc}") from exc

    async def stop(self, instance: SiteStudioRuntimeInstance) -> dict[str, Any]:
        container_ids, _ = await asyncio.to_thread(self._owned_runtime_resources, instance)
        if container_ids:
            result = await asyncio.to_thread(self._run_runtime, "stop", *container_ids)
            if result.returncode:
                raise SiteStudioRuntimeError(result.stderr.strip() or result.stdout.strip())
        return {
            "status": SiteStudioStatus.STOPPED.value,
        }

    async def redeploy(self, instance: SiteStudioRuntimeInstance) -> dict[str, Any]:
        stage = "compose_down_existing"
        operation_started_at = time.perf_counter()
        stage_timings_ms: dict[str, int] = {}
        try:
            stage_started_at = time.perf_counter()
            await asyncio.to_thread(self._remove_owned_runtime_resources, instance)
            stage_timings_ms[stage] = int((time.perf_counter() - stage_started_at) * 1000)
            stage = "provision_after_down"
            metadata = await self.provision(instance, force_refresh_source=True)
            logger.info(
                "Site Studio redeploy succeeded slug=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                stage_timings_ms,
                int((time.perf_counter() - operation_started_at) * 1000),
            )
            return metadata
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Site Studio redeploy failed slug=%s stage=%s timings_ms=%s total_ms=%s",
                instance.site_slug,
                stage,
                stage_timings_ms,
                int((time.perf_counter() - operation_started_at) * 1000),
            )
            raise SiteStudioRuntimeError(f"stage={stage}; {exc}") from exc

    async def destroy(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        preserve_runtime_data: bool = False,
    ) -> None:
        layout = self._layout(instance)
        await asyncio.to_thread(self._remove_owned_runtime_resources, instance)
        if not preserve_runtime_data and layout.runtime_dir.exists():
            await asyncio.to_thread(self._remove_tree, layout.runtime_dir)
            if layout.runtime_dir.exists():
                raise SiteStudioRuntimeError("Failed to remove owned runtime directory")
