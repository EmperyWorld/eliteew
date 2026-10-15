# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-process stack0 runtime / deploy-line rollup for Admin (not full DEWA SSH verify).
# Invariants:
# - Never fabricate ``ok`` when build id or line is unknown.
# - Mutations stay on ``eeprodline`` / ``eliteew-deploy.sh`` — this is read-only.
# Related:
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# - api/services/client_build_service.py
# ---

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from api.core.unified_config import unified_settings
from api.services.client_build_service import get_server_app_build_id

logger = logging.getLogger(__name__)

OverallStatus = Literal["ok", "degraded", "unavailable"]
CheckStatus = Literal["ok", "degraded", "unavailable", "unknown"]

_NFS_MARKER_DEFAULT = "/mnt/eliteew-prod-line-export"


def _normalize_runtime_line(raw: str | None) -> tuple[str, str]:
    """Return ``(normalized, source)`` where source is env|inferred|unknown."""
    value = (raw or "").strip().lower()
    if value in ("dev-bind", "dev_bind", "devbind"):
        return "dev-bind", "env"
    if value in ("baked", "prod-baked", "prod_baked"):
        return "baked", "env"
    if value:
        return value, "env"
    # Baked compose does not set ELITEEW_RUNTIME_LINE; only dev-bind override does.
    return "baked", "inferred_unset"


def _nfs_export_visible() -> bool:
    marker = os.environ.get("ELITEEW_PROD_LINE_EXPORT_MARKER", _NFS_MARKER_DEFAULT).strip()
    try:
        return Path(marker).is_dir()
    except OSError as exc:
        logger.debug("[STEP] platform_ops_nfs_marker_skip err=%s", exc)
        return False


def build_stack0_status() -> dict[str, Any]:
    """Build a read-only stack0 line / version rollup from the API process env."""
    raw_line = os.environ.get("ELITEEW_RUNTIME_LINE")
    runtime_line, line_source = _normalize_runtime_line(raw_line)
    app_build_id = get_server_app_build_id(force_refresh=True)
    nfs_visible = _nfs_export_visible()
    product_edition = (os.environ.get("ELITEEW_PRODUCT_EDITION") or "").strip() or None
    install_profile = (os.environ.get("ELITEEW_INSTALL_PROFILE") or "").strip() or None

    checks: list[dict[str, Any]] = []

    line_status: CheckStatus = "ok" if line_source in ("env", "inferred_unset") else "unknown"
    if runtime_line == "dev-bind" and not nfs_visible:
        # Inside the API container the host NFS path is often invisible; do not fail hard.
        line_status = "ok"
        line_detail = "ELITEEW_RUNTIME_LINE=dev-bind (host NFS marker not visible in-process)"
    elif runtime_line == "dev-bind" and nfs_visible:
        line_detail = "ELITEEW_RUNTIME_LINE=dev-bind and NFS export marker present"
    elif line_source == "inferred_unset":
        line_detail = "ELITEEW_RUNTIME_LINE unset — treating as baked (prod default)"
    else:
        line_detail = f"ELITEEW_RUNTIME_LINE={runtime_line!r} (source={line_source})"
    checks.append(
        {
            "id": "runtime_line",
            "status": line_status,
            "detail": line_detail,
        }
    )

    if app_build_id:
        checks.append(
            {
                "id": "app_build_id",
                "status": "ok",
                "detail": app_build_id,
            }
        )
    else:
        checks.append(
            {
                "id": "app_build_id",
                "status": "degraded",
                "detail": "app-build-version.txt missing or unreadable in this process",
            }
        )

    # Serving this response proves the API process is up; DB/sibling health stays on System.
    checks.append(
        {
            "id": "api_process",
            "status": "ok",
            "detail": "in-process probe (this request)",
        }
    )

    statuses = {c["status"] for c in checks}
    overall: OverallStatus
    if "unavailable" in statuses:
        overall = "unavailable"
    elif "degraded" in statuses or "unknown" in statuses:
        overall = "degraded"
    else:
        overall = "ok"

    payload: dict[str, Any] = {
        "schema_version": 1,
        "probe_scope": "in_process",
        "probed_at": datetime.now(UTC).isoformat(),
        "overall": overall,
        "runtime_line": runtime_line,
        "runtime_line_env": (raw_line.strip() if raw_line and raw_line.strip() else None),
        "runtime_line_source": line_source,
        "nfs_export_visible": nfs_visible,
        "app_build_id": app_build_id,
        "app_version": unified_settings.app_version,
        "product_edition": product_edition,
        "install_profile": install_profile,
        "checks": checks,
        "cli_hint": ("bash docker/scripts/eliteew-deploy.sh hotfix stack0 status  # or: eeprodline status"),
        "notes": [
            "This is not the full DEWA/SSH stack0 file-hash verifier.",
            "Line switches and rebake remain CLI-only (eeprodline / eliteew-deploy.sh).",
        ],
    }
    logger.info(
        "[STEP] platform_ops_stack0_status overall=%s line=%s build=%s",
        overall,
        runtime_line,
        app_build_id or "-",
    )
    return payload
