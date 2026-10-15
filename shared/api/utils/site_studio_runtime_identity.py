"""Runtime ownership primitives shared by the API and host autostart (stdlib only)."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID

BINDING_FILE = ".site-studio-owner.json"
LABEL_PREFIX = "ru.eliteew.site-studio."


def runtime_identity(instance: Any) -> dict[str, str]:
    instance_id = str(UUID(str(instance.id)))
    project_id = getattr(instance, "marketing_project_id", None)
    scope = "project" if project_id else "user"
    owner = getattr(instance, "owner_user_id", None) if project_id else getattr(instance, "user_id", None)
    owner_id = str(UUID(str(owner)))
    scope_id = str(UUID(str(project_id))) if project_id else owner_id
    return {
        "version": "1",
        "instance": instance_id,
        "owner": owner_id,
        "scope": scope,
        "scope-id": scope_id,
        "project": f"site-studio-{scope[0]}-{UUID(instance_id).hex}",
    }


def ownership_labels(identity: dict[str, str]) -> dict[str, str]:
    return {LABEL_PREFIX + key: value for key, value in identity.items()}


def validate_binding(runtime_dir: Path, identity: dict[str, str]) -> bool:
    """No adoption of unbound state, nor traversal through runtime symlinks."""
    if runtime_dir.is_symlink():
        raise ValueError("Runtime directory is a symlink")
    # Check paths we write/remove/mount, not legitimate node_modules/.bin links.
    for relative in (
        "source",
        "source/server",
        "env",
        "env/server.env",
        "env/frontend.env",
        "compose",
        "compose/docker-compose.yml",
        "uploads",
        "postgres-data",
        "node_modules",
        "node_modules/api",
        "node_modules/frontend",
        BINDING_FILE,
    ):
        path = runtime_dir / relative
        if path.is_symlink() or not path.resolve().is_relative_to(runtime_dir.resolve()):
            raise ValueError("Runtime managed path contains symlink or escapes its directory")
    marker = runtime_dir / BINDING_FILE
    if not marker.exists():
        return False
    if json.loads(marker.read_text()) != identity:
        raise ValueError("Runtime ownership binding mismatch")
    return True


def inspect_owned_resources(run: Callable[..., Any], identity: dict[str, str]) -> tuple[list[str], str | None]:
    """Validate the complete project before returning immutable IDs for mutations."""
    project = identity["project"]
    expected = ownership_labels(identity)
    ids: set[str] = set()
    for key in ("com.docker.compose.project", "io.podman.compose.project"):
        result = run("ps", "-aq", "--filter", f"label={key}={project}")
        if result.returncode:
            raise ValueError("Cannot inventory runtime containers")
        ids.update(result.stdout.split())
    owned = []
    for cid in sorted(ids):
        result = run("inspect", cid)
        if result.returncode:
            raise ValueError("Cannot inspect runtime container")
        records = json.loads(result.stdout)
        if not isinstance(records, list) or len(records) != 1:
            raise ValueError("Unexpected container inspect response")
        record = records[0]
        labels = (record.get("Config") or {}).get("Labels") or {}
        if any(labels.get(k) != v for k, v in expected.items()):
            raise ValueError("Foreign or unlabeled container in runtime project")
        full_id = str(record.get("Id") or "")
        if not full_id or not full_id.startswith(cid):
            raise ValueError("Container identity mismatch")
        owned.append(full_id)
    result = run("network", "inspect", f"{project}_default")
    network_id = None
    if result.returncode:
        message = (result.stderr + result.stdout).lower()
        if "not found" not in message and "no such network" not in message:
            raise ValueError("Cannot inspect runtime network")
    else:
        records = json.loads(result.stdout)
        if not isinstance(records, list) or len(records) != 1:
            raise ValueError("Unexpected network inspect response")
        record = records[0]
        labels = record.get("Labels") or record.get("labels") or {}
        if any(labels.get(k) != v for k, v in expected.items()):
            raise ValueError("Foreign or unlabeled runtime network")
        network_id = str(record.get("Id") or record.get("id") or "")
        if not network_id:
            raise ValueError("Missing network identity")
    return owned, network_id
