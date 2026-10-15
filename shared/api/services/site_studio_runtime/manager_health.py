# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Health/logs mixins for SiteStudioRuntimeManager.
# Invariants:
# - Public imports remain via api.services.site_studio_runtime_service.
# Related:
# - api/services/site_studio_runtime/manager.py
# ---
from __future__ import annotations

import asyncio
import logging
import subprocess
from typing import TYPE_CHECKING, Any

from api.core.http_clients import get_httpx_client
from api.models.desktop import SiteStudioStatus
from api.services.site_studio_runtime.helpers import (
    SiteStudioRuntimeInstance,
    resolve_site_studio_runtime_health_urls,
)

logger = logging.getLogger(__name__)


class SiteStudioRuntimeHealthMixin:
    """Health/logs. Cross-mixin compose helpers typed via TYPE_CHECKING stubs."""

    if TYPE_CHECKING:

        def _run_compose(
            self,
            compose_file_path: str,
            project_name: str,
            *args: str,
        ) -> subprocess.CompletedProcess[str]: ...

    async def health(self, instance: SiteStudioRuntimeInstance) -> dict[str, Any]:
        client = get_httpx_client()
        api_ok = False
        public_ok = False
        api_error: str | None = None
        public_error: str | None = None
        internal_api_base_url, internal_public_url, skip_reason = resolve_site_studio_runtime_health_urls(instance)
        if skip_reason:
            api_error = skip_reason
            public_error = skip_reason

        if internal_api_base_url:
            try:
                response = await client.get(f"{internal_api_base_url}/health")
                api_ok = response.status_code < 400
                if not api_ok:
                    api_error = f"status={response.status_code}"
            except Exception as exc:  # noqa: BLE001
                api_error = str(exc)

        if internal_public_url:
            try:
                response = await client.get(internal_public_url)
                public_ok = response.status_code < 400
                if not public_ok:
                    public_error = f"status={response.status_code}"
            except Exception as exc:  # noqa: BLE001
                public_error = str(exc)

        runtime_status = SiteStudioStatus.RUNNING.value if api_ok and public_ok else SiteStudioStatus.FAILED.value
        return {
            "status": runtime_status,
            "api_ok": api_ok,
            "public_ok": public_ok,
            "api_error": api_error,
            "public_error": public_error,
            "ports": instance.ports_json if isinstance(instance.ports_json, dict) else {},
            "public_url": instance.public_url,
            "api_base_url": instance.api_base_url,
        }

    async def collect_logs(
        self,
        instance: SiteStudioRuntimeInstance,
        *,
        tail: int = 80,
    ) -> str:
        compose_file_path = (instance.compose_file_path or "").strip()
        project_name = (instance.compose_project_name or "").strip()
        if not compose_file_path or not project_name:
            return ""
        result = await asyncio.to_thread(
            self._run_compose,
            compose_file_path,
            project_name,
            "logs",
            "--no-color",
            "--tail",
            str(tail),
        )
        if result.returncode != 0:
            return result.stderr.strip() or result.stdout.strip()
        return result.stdout.strip()
