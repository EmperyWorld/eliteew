# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Admin platform-ops stack0 / egress status builders.
# Invariants:
# - Missing egress file → unavailable (never fake ok).
# - Unset ELITEEW_RUNTIME_LINE → inferred baked.
# Related:
# - api/services/platform_ops/
# ---

from __future__ import annotations

import json
from pathlib import Path

from api.services.platform_ops.egress_status import build_egress_status
from api.services.platform_ops.stack0_status import build_stack0_status


def test_stack0_status_infers_baked_when_line_unset(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.delenv("ELITEEW_RUNTIME_LINE", raising=False)
    monkeypatch.delenv("ELITEEW_PRODUCT_EDITION", raising=False)
    monkeypatch.delenv("ELITEEW_INSTALL_PROFILE", raising=False)
    monkeypatch.setenv("ELITEEW_PROD_LINE_EXPORT_MARKER", str(tmp_path / "missing-nfs"))
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-abc123\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    snap = build_stack0_status()
    assert snap["schema_version"] == 1
    assert snap["probe_scope"] == "in_process"
    assert snap["runtime_line"] == "baked"
    assert snap["runtime_line_source"] == "inferred_unset"
    assert snap["runtime_line_env"] is None
    assert snap["app_build_id"] == "deploy-abc123"
    assert snap["overall"] == "ok"
    assert snap["cli_hint"]
    assert any(c["id"] == "runtime_line" for c in snap["checks"])


def test_stack0_status_dev_bind_from_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ELITEEW_RUNTIME_LINE", "dev-bind")
    monkeypatch.setenv("ELITEEW_PROD_LINE_EXPORT_MARKER", str(tmp_path / "missing-nfs"))
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(tmp_path / "no-build.txt"))

    snap = build_stack0_status()
    assert snap["runtime_line"] == "dev-bind"
    assert snap["runtime_line_source"] == "env"
    assert snap["overall"] == "degraded"  # missing build id
    assert snap["app_build_id"] is None


def test_egress_status_unavailable_without_file(monkeypatch, tmp_path: Path) -> None:
    missing = tmp_path / "absent.json"
    monkeypatch.setenv("ELITEEW_PODMAN_EGRESS_STATUS", str(missing))
    monkeypatch.setenv("HOME", str(tmp_path / "empty-home"))

    snap = build_egress_status()
    assert snap["overall"] == "unavailable"
    assert snap["error"] == "egress_status_file_missing"
    assert snap["containers"] == []
    assert snap["status_path"] is None
    assert str(missing) in snap["status_path_candidates"]


def test_egress_status_prefers_compose_mount_path(monkeypatch, tmp_path: Path) -> None:
    """Compose default /run/eliteew/egress-state/… is tried even without env override."""
    state_dir = tmp_path / "egress-state"
    state_dir.mkdir()
    status_path = state_dir / "podman-egress-status.json"
    status_path.write_text(
        json.dumps(
            {
                "updated_at": "2026-08-04T12:00:00+00:00",
                "policy_path": "/tmp/policy.json",
                "containers": [
                    {
                        "name": "stack0-eliteew-frontend-prod-baked",
                        "mode": "lock",
                        "running": True,
                        "ips": [],
                        "external_web": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.delenv("ELITEEW_PODMAN_EGRESS_STATUS", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path / "empty-home"))

    compose_path = "/run/eliteew/egress-state/podman-egress-status.json"
    real_is_file = Path.is_file

    def _is_file(self: Path) -> bool:
        if str(self) == compose_path:
            return True
        return real_is_file(self)

    real_read_text = Path.read_text

    def _read_text(self: Path, *args: object, **kwargs: object) -> str:
        if str(self) == compose_path:
            return status_path.read_text(encoding="utf-8")
        return real_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "is_file", _is_file)
    monkeypatch.setattr(Path, "read_text", _read_text)

    snap = build_egress_status()
    assert snap["overall"] == "ok"
    assert snap["status_path"] == compose_path
    assert snap["mode_counts"]["lock"] == 1


def test_egress_status_reads_monitor_json(monkeypatch, tmp_path: Path) -> None:
    status_path = tmp_path / "podman-egress-status.json"
    payload = {
        "updated_at": "2026-08-04T12:00:00+00:00",
        "policy_path": "/tmp/policy.json",
        "containers": [
            {
                "name": "stack0-eliteew-frontend-prod-baked",
                "mode": "lock",
                "running": True,
                "ips": ["10.89.0.2"],
                "external_web": False,
            },
            {
                "name": "stack0-eliteew-api-prod-baked",
                "mode": "allowlist",
                "running": True,
                "ips": ["10.89.0.3"],
                "external_web": "allowlist",
            },
        ],
    }
    status_path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setenv("ELITEEW_PODMAN_EGRESS_STATUS", str(status_path))

    snap = build_egress_status()
    assert snap["overall"] == "ok"
    assert snap["status_path"] == str(status_path)
    assert snap["updated_at"] == payload["updated_at"]
    assert snap["mode_counts"]["lock"] == 1
    assert snap["mode_counts"]["allowlist"] == 1
    assert len(snap["containers"]) == 2
    assert snap["error"] is None
