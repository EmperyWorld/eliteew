# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin SiteStudioRuntimeManager orchestrator (mixins).
# Invariants:
# - Public imports remain via api.services.site_studio_runtime_service.
# Related:
# - api/services/site_studio_runtime/manager.py
# ---
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any
from uuid import UUID

from api.core.http_clients import init_http_clients
from api.models.desktop import ProjectSiteInstance, SiteStudioStatus, UserSiteInstance
from api.services.site_studio_runtime.helpers import (
    DEFAULT_RUNTIME_BASE_DIR,
    DEFAULT_TEMPLATE_ROOT,
    SiteStudioRuntimeError,
    SiteStudioRuntimeInstance,
    _resolve_site_studio_container_runtime,
    normalize_site_studio_template_key,
    read_site_studio_applied_profile_id,
    with_site_studio_applied_profile,
)
from api.services.site_studio_runtime.manager_compose import SiteStudioRuntimeComposeMixin
from api.services.site_studio_runtime.manager_health import SiteStudioRuntimeHealthMixin
from api.services.site_studio_runtime.manager_lifecycle import SiteStudioRuntimeLifecycleMixin

logger = logging.getLogger(__name__)


class SiteStudioRuntimeManager(
    SiteStudioRuntimeComposeMixin,
    SiteStudioRuntimeLifecycleMixin,
    SiteStudioRuntimeHealthMixin,
):
    def __init__(
        self,
        *,
        template_root: Path | None = None,
        runtime_base_dir: Path | None = None,
    ) -> None:
        self.default_template_root = (template_root or DEFAULT_TEMPLATE_ROOT).resolve()
        self.runtime_base_dir = (runtime_base_dir or DEFAULT_RUNTIME_BASE_DIR).resolve()
        self.container_runtime = _resolve_site_studio_container_runtime()
        self._resolved_runtime_cli: str | None = None
        self._resolved_runtime_env: dict[str, str] | None = None
        self._admin_token_cache: dict[str, tuple[str, float]] = {}
        self._admin_login_locks: dict[str, asyncio.Lock] = {}


_site_studio_runtime_manager: SiteStudioRuntimeManager | None = None


def get_site_studio_runtime_manager() -> SiteStudioRuntimeManager:
    global _site_studio_runtime_manager  # noqa: PLW0603
    if _site_studio_runtime_manager is None:
        _site_studio_runtime_manager = SiteStudioRuntimeManager()
    return _site_studio_runtime_manager


async def execute_site_studio_runtime_task(
    instance_id: UUID,
    task_type: str,
    *,
    instance_scope: str = "user",
    job_id: UUID | str | None = None,
) -> None:
    from api.core.database_manager import get_database_manager
    from api.services.site_studio_lifecycle_jobs import (
        mark_lifecycle_job_failed,
        mark_lifecycle_job_running,
        mark_lifecycle_job_stage,
        mark_lifecycle_job_succeeded,
        record_worker_heartbeat,
    )

    await init_http_clients()
    runtime_manager = get_site_studio_runtime_manager()
    db_manager = await get_database_manager()

    async with db_manager.get_postgres_session() as db:
        instance: SiteStudioRuntimeInstance | None
        if instance_scope == "project":
            instance = await db.get(ProjectSiteInstance, instance_id)
        else:
            instance = await db.get(UserSiteInstance, instance_id)
        if instance is None:
            return

        inst_mut: Any = instance
        started_at = time.perf_counter()
        worker_id = await record_worker_heartbeat(
            db, metadata={"task_type": task_type, "instance_scope": instance_scope}
        )
        await mark_lifecycle_job_running(db, job_id, worker_id=worker_id)
        await db.commit()
        logger.info(
            "Site Studio task started task=%s slug=%s instance_id=%s",
            task_type,
            instance.site_slug,
            instance.id,
        )

        try:
            async with runtime_manager.runtime_operation_lock(instance):

                async def _apply_template_profile_if_needed() -> None:
                    target_profile_id = runtime_manager.resolve_template_profile_id(instance.template_key)
                    if not target_profile_id:
                        return

                    applied_profile_id = read_site_studio_applied_profile_id(instance)
                    if applied_profile_id == target_profile_id:
                        return

                    try:
                        new_profile_id = await runtime_manager.apply_template_profile(instance)
                    except Exception as profile_exc:  # noqa: BLE001
                        logger.warning(
                            "Site Studio template profile apply failed slug=%s template=%s profile=%s error=%s",
                            instance.site_slug,
                            normalize_site_studio_template_key(instance.template_key),
                            target_profile_id,
                            profile_exc,
                        )
                        return

                    if not new_profile_id:
                        return

                    inst_mut.brief_json = with_site_studio_applied_profile(instance, new_profile_id)
                    await db.commit()
                    await db.refresh(instance)

                metadata: dict[str, Any] = {}
                if task_type == "site_studio_provision":
                    await mark_lifecycle_job_stage(db, job_id, stage="prepare_runtime_files")
                    await db.commit()
                    metadata = await runtime_manager.provision(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_metadata", metadata=metadata)
                    for key, value in metadata.items():
                        if hasattr(instance, key):
                            setattr(instance, key, value)
                    await db.commit()
                    await db.refresh(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_site_settings")
                    await db.commit()
                    await runtime_manager.sync_site_settings(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="apply_template_profile")
                    await db.commit()
                    await _apply_template_profile_if_needed()
                elif task_type == "site_studio_start":
                    await mark_lifecycle_job_stage(db, job_id, stage="start_runtime")
                    await db.commit()
                    metadata = await runtime_manager.start(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_metadata", metadata=metadata)
                    for key, value in metadata.items():
                        if hasattr(instance, key):
                            setattr(instance, key, value)
                    await _apply_template_profile_if_needed()
                elif task_type == "site_studio_stop":
                    await mark_lifecycle_job_stage(db, job_id, stage="stop_runtime")
                    await db.commit()
                    metadata = await runtime_manager.stop(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_metadata", metadata=metadata)
                    for key, value in metadata.items():
                        if hasattr(instance, key):
                            setattr(instance, key, value)
                elif task_type == "site_studio_redeploy":
                    await mark_lifecycle_job_stage(db, job_id, stage="redeploy_runtime")
                    await db.commit()
                    metadata = await runtime_manager.redeploy(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_metadata", metadata=metadata)
                    for key, value in metadata.items():
                        if hasattr(instance, key):
                            setattr(instance, key, value)
                    await db.commit()
                    await db.refresh(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="sync_site_settings")
                    await db.commit()
                    await runtime_manager.sync_site_settings(instance)
                    await mark_lifecycle_job_stage(db, job_id, stage="apply_template_profile")
                    await db.commit()
                    await _apply_template_profile_if_needed()
                else:
                    raise SiteStudioRuntimeError(f"Unknown task type: {task_type}")

                inst_mut.last_error = None
                await mark_lifecycle_job_succeeded(
                    db,
                    job_id,
                    duration_ms=int((time.perf_counter() - started_at) * 1000),
                    metadata={"runtime_mode": metadata.get("runtime_mode") or "unknown"},
                )
                await db.commit()
                logger.info(
                    "Site Studio task succeeded task=%s slug=%s mode=%s duration_ms=%s",
                    task_type,
                    instance.site_slug,
                    metadata.get("runtime_mode") or "unknown",
                    int((time.perf_counter() - started_at) * 1000),
                )
        except Exception as exc:  # noqa: BLE001
            inst_mut.status = SiteStudioStatus.FAILED.value
            inst_mut.last_error = str(exc)
            await mark_lifecycle_job_failed(
                db,
                job_id,
                stage="failed",
                error=str(exc),
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            await db.commit()
            logger.exception(
                "Site Studio task failed task=%s slug=%s duration_ms=%s error=%s",
                task_type,
                instance.site_slug,
                int((time.perf_counter() - started_at) * 1000),
                exc,
            )
