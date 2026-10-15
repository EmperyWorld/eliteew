# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Backend state-machine guardrails for Site Studio lifecycle actions.
# Mirrors launch-control rules server-side so invalid runtime transitions cannot bypass the Desktop UI.
# Invariants:
# - Pending transitions are mutually exclusive with new lifecycle mutations.
# - Public/admin surface separation is out of scope; this only validates lifecycle state.
# Related:
# - api/routers/desktop_sites.py
# - api/routers/kirs.py
# - api/services/site_studio_lifecycle_jobs.py
# ---
from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status  # type: ignore[import-untyped]

SITE_STUDIO_PENDING_STATUSES = {"provisioning", "starting", "redeploying", "stopping"}
SITE_STUDIO_RUNNING_STATUSES = {"running"}
SITE_STUDIO_STOPPED_STATUSES = {"draft", "stopped", "failed"}
SITE_STUDIO_WORKER_TASK_ACTIONS = {"provision", "start", "stop", "redeploy", "destroy"}


def _status(instance: Any) -> str:
    return str(getattr(instance, "status", "") or "").strip().lower()


def _has_runtime_metadata(instance: Any) -> bool:
    return bool(str(getattr(instance, "compose_file_path", "") or "").strip()) and bool(
        str(getattr(instance, "compose_project_name", "") or "").strip()
    )


def validate_site_studio_lifecycle_action(
    instance: Any,
    *,
    action: str,
    worker_ready: bool = True,
    require_worker: bool = False,
) -> None:
    normalized_action = action.strip().lower()
    current_status = _status(instance)

    # Destroy must remain available for stuck pending transitions (e.g. orphaned provisioning).
    if current_status in SITE_STUDIO_PENDING_STATUSES and normalized_action != "destroy":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Site Studio runtime already has a pending transition: {current_status}",
        )

    if require_worker and normalized_action in SITE_STUDIO_WORKER_TASK_ACTIONS and not worker_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site Studio worker is not ready. Start the site-studio-worker profile before running lifecycle actions.",
        )

    if normalized_action == "start" and current_status in SITE_STUDIO_RUNNING_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Site Studio runtime is already running")

    if normalized_action == "stop":
        if current_status not in SITE_STUDIO_RUNNING_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Site Studio runtime is not running")
        if not _has_runtime_metadata(instance):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Site Studio runtime compose metadata is missing",
            )

    if normalized_action == "redeploy":
        if current_status not in SITE_STUDIO_RUNNING_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Site Studio runtime must be running before redeploy",
            )
        if not _has_runtime_metadata(instance):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Site Studio runtime compose metadata is missing",
            )

    if normalized_action == "publish" and current_status in {"draft"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Prepare or start the Site Studio runtime before publishing the storefront",
        )
