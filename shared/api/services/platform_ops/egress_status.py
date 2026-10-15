# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read Podman egress monitor JSON for Admin (no apply / set-mode).
# Invariants:
# - Missing or unreadable status → ``unavailable`` (never fake lock/allowlist ok).
# - Mutation surface remains ``eliteew-podman-egress.sh`` / host lock script.
# Related:
# - documentation/platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md
# - docker/scripts/prod-core/podman-egress-lib.sh
# ---

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger(__name__)

OverallStatus = Literal["ok", "degraded", "unavailable"]

_DEFAULT_CANDIDATES = (
    # Compose mount on prod-core (baked + dev-bind overrides).
    "/run/eliteew/egress-state/podman-egress-status.json",
    # Same default as podman-egress-lib.sh when XDG/HOME map into the container.
    "{home}/.local/state/eliteew/podman-egress-status.json",
    "/run/eliteew/podman-egress-status.json",
    "/var/lib/eliteew/podman-egress-status.json",
)


def _status_path_candidates() -> list[Path]:
    paths: list[Path] = []
    override = (os.environ.get("ELITEEW_PODMAN_EGRESS_STATUS") or "").strip()
    if override:
        paths.append(Path(override))
    home = os.environ.get("HOME") or "/home/owned"
    for template in _DEFAULT_CANDIDATES:
        paths.append(Path(template.format(home=home)))
    # Deduplicate while preserving order
    seen: set[str] = set()
    out: list[Path] = []
    for path in paths:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        out.append(path)
    return out


def _mode_counts(containers: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {
        "lock": 0,
        "allowlist": 0,
        "wan_open": 0,
        "unmanaged": 0,
        "other": 0,
    }
    for row in containers:
        mode = str(row.get("mode") or "other")
        if mode in counts:
            counts[mode] += 1
        else:
            counts["other"] += 1
    return counts


def build_egress_status() -> dict[str, Any]:
    """Load egress monitor snapshot from disk if mounted into the API process."""
    candidates = _status_path_candidates()
    chosen: Path | None = None
    raw: dict[str, Any] | None = None
    read_error: str | None = None

    for path in candidates:
        try:
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                read_error = f"invalid_json_shape:{path}"
                continue
            chosen = path
            raw = parsed
            break
        except OSError as exc:
            read_error = f"{type(exc).__name__}:{path}"
            logger.debug("[STEP] platform_ops_egress_read_skip path=%s err=%s", path, exc)
        except json.JSONDecodeError as exc:
            read_error = f"json_decode:{path}:{exc}"
            logger.debug("[STEP] platform_ops_egress_json_skip path=%s err=%s", path, exc)

    if chosen is None or raw is None:
        logger.info("[STEP] platform_ops_egress_status overall=unavailable reason=missing_status")
        return {
            "schema_version": 1,
            "probe_scope": "status_file",
            "probed_at": datetime.now(UTC).isoformat(),
            "overall": "unavailable",
            "status_path": None,
            "status_path_candidates": [str(p) for p in candidates],
            "updated_at": None,
            "policy_path": None,
            "containers": [],
            "mode_counts": _mode_counts([]),
            "error": read_error or "egress_status_file_missing",
            "cli_hint": (
                "bash docker/scripts/eliteew-podman-egress.sh status"
                "  # mount JSON via ELITEEW_PODMAN_EGRESS_STATUS for Admin"
            ),
            "notes": [
                "Admin reads the monitor JSON only; apply/set/verify stay CLI-only.",
                "On prod-core the file is typically ~/.local/state/eliteew/podman-egress-status.json.",
            ],
        }

    containers_raw = raw.get("containers")
    containers: list[dict[str, Any]] = (
        [c for c in containers_raw if isinstance(c, dict)] if isinstance(containers_raw, list) else []
    )
    counts = _mode_counts(containers)
    overall: OverallStatus = "ok" if containers else "degraded"

    payload: dict[str, Any] = {
        "schema_version": 1,
        "probe_scope": "status_file",
        "probed_at": datetime.now(UTC).isoformat(),
        "overall": overall,
        "status_path": str(chosen),
        "status_path_candidates": [str(p) for p in candidates],
        "updated_at": raw.get("updated_at"),
        "policy_path": raw.get("policy_path"),
        "containers": containers,
        "mode_counts": counts,
        "error": None,
        "cli_hint": "bash docker/scripts/eliteew-podman-egress.sh status",
        "notes": [
            "Read-only snapshot from egress monitor (--write-status).",
            "Do not treat Admin as a substitute for CLI verify.",
        ],
    }
    logger.info(
        "[STEP] platform_ops_egress_status overall=%s path=%s containers=%s",
        overall,
        chosen,
        len(containers),
    )
    return payload
