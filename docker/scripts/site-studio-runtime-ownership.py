#!/usr/bin/env python3
"""Read-only migration inventory by default; guarded autostart requires --apply."""

from __future__ import annotations

import argparse
import fcntl
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared"))
from api.utils.site_studio_runtime_identity import (
    BINDING_FILE,
    inspect_owned_resources,
    runtime_identity,
    validate_binding,
)


def inventory(instances: list[dict], resources: list[dict]) -> dict:
    """Accept sanitized exports only; never infer ownership from a slug."""
    resources = [
        {
            "kind": r.get("kind"),
            "id": r.get("id"),
            "name": r.get("name"),
            "labels": {
                k: v
                for k, v in (r.get("labels") or {}).items()
                if k.startswith("ru.eliteew.site-studio.")
                or k in {"com.docker.compose.project", "io.podman.compose.project"}
            },
        }
        for r in resources
    ]
    result = []
    for row in instances:
        identity = runtime_identity(SimpleNamespace(**row))
        old = row.get("compose_project_name")
        conflicts = [
            str(other["id"])
            for other in instances
            if other is not row
            and (
                (old and other.get("compose_project_name") == old)
                or (
                    row.get("runtime_dir")
                    and other.get("runtime_dir") == row["runtime_dir"]
                )
            )
        ]
        matching = [
            r
            for r in resources
            if (r.get("labels") or {}).get("com.docker.compose.project")
            in {old, identity["project"]} - {None, ""}
            or (r.get("labels") or {}).get("io.podman.compose.project")
            in {old, identity["project"]} - {None, ""}
        ]
        result.append(
            {
                "identity": identity,
                "previous_project": old,
                "previous_runtime_dir": row.get("runtime_dir"),
                "conflicting_instances": conflicts,
                "resources": matching,
                "action": "BLOCK_CONFLICT"
                if conflicts
                else "REVIEW_BACKUP_AND_RECREATE",
                "automatic_migration_allowed": False,
            }
        )
    return {"dry_run": True, "instances": result, "resources": resources}


def autostart(root: Path, apply: bool) -> bool:
    def run(*args):
        return subprocess.run(
            ["podman", *args], capture_output=True, text=True, check=False, timeout=600
        )

    complete = True
    for marker in sorted(root.glob(f"*/{BINDING_FILE}")):
        try:
            locks = root / ".locks"
            locks.mkdir(exist_ok=True)
            with (locks / f"{marker.parent.name}.lock").open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                raw = json.loads(marker.read_text())
                instance = SimpleNamespace(
                    id=raw["instance"],
                    user_id=raw["owner"],
                    owner_user_id=raw["owner"],
                    marketing_project_id=raw["scope-id"]
                    if raw["scope"] == "project"
                    else None,
                )
                identity = runtime_identity(instance)
                runtime_dir = marker.parent
                if runtime_dir.name != identity["project"] or not validate_binding(
                    runtime_dir, identity
                ):
                    raise ValueError("Invalid runtime ownership binding")
                inspect_owned_resources(run, identity)
                compose = runtime_dir / "compose/docker-compose.yml"
                if not compose.is_file():
                    raise ValueError("Bound runtime has no Compose file")
                print(
                    json.dumps(
                        {
                            "runtime": str(runtime_dir),
                            "project": identity["project"],
                            "apply": apply,
                        }
                    )
                )
                if apply:
                    # No project-wide remove-orphans, and no ownership-changing chown before validation.
                    result = run(
                        "compose",
                        "-f",
                        str(compose),
                        "-p",
                        identity["project"],
                        "up",
                        "-d",
                    )
                    if result.returncode:
                        raise RuntimeError("Owned runtime autostart failed")
        except (
            ValueError,
            OSError,
            KeyError,
            RuntimeError,
            subprocess.TimeoutExpired,
        ) as exc:
            complete = False
            print(
                json.dumps(
                    {
                        "runtime": str(marker.parent),
                        "action": "BLOCK_INVALID_BINDING",
                        "error": str(exc),
                    }
                )
            )
    for compose in sorted(root.glob("*/compose/docker-compose.yml")):
        if not (compose.parent.parent / BINDING_FILE).exists():
            print(
                json.dumps(
                    {
                        "runtime": str(compose.parent.parent),
                        "action": "BLOCK_UNBOUND_LEGACY",
                    }
                )
            )

    return complete


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    inv = sub.add_parser("inventory")
    inv.add_argument("--instances", type=Path, required=True)
    inv.add_argument("--resources", type=Path, required=True)
    auto = sub.add_parser("autostart")
    auto.add_argument("--root", type=Path, required=True)
    auto.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.mode == "inventory":
        print(
            json.dumps(
                inventory(
                    json.loads(args.instances.read_text()),
                    json.loads(args.resources.read_text()),
                ),
                indent=2,
            )
        )
    else:
        if not autostart(args.root.resolve(), args.apply):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
