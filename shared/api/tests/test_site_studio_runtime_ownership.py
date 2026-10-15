"""Tenant isolation through real runtime-manager entry points with a fake CLI."""

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
import yaml

from api.services.site_studio_runtime.helpers import SiteStudioRuntimeError
from api.services.site_studio_runtime.manager import SiteStudioRuntimeManager
from api.utils.site_studio_runtime_identity import BINDING_FILE, ownership_labels, runtime_identity


def instance(**changes):
    fields = dict(
        id=uuid4(),
        user_id=uuid4(),
        site_slug="a" * 48 + "-11111111",
        site_title="A" * 48,
        site_topic="test",
        template_key="olenti",
        compose_project_name=None,
        runtime_dir=None,
        compose_file_path=None,
        db_name=None,
        public_hostname=None,
        public_url=None,
        api_base_url=None,
        admin_email="test@example.invalid",
        admin_password_encrypted=None,
    )
    return SimpleNamespace(**(fields | changes))


class Runtime:
    def __init__(self):
        self.containers = {}
        self.networks = {}
        self.calls = []

    def __call__(self, *args):
        self.calls.append(args)
        stdout, stderr, code = "", "", 0
        if args[0] == "ps":
            key, project = args[-1][6:].split("=", 1)
            stdout = "\n".join(cid for cid, labels in self.containers.items() if labels.get(key) == project)
        elif args[0] == "inspect":
            stdout = json.dumps([{"Id": args[1], "Config": {"Labels": self.containers[args[1]]}}])
        elif args[:2] == ("network", "inspect"):
            if args[2] not in self.networks:
                code, stderr = 1, "network not found"
            else:
                stdout = json.dumps([self.networks[args[2]]])
        elif args[0] == "rm":
            for cid in args[2:]:
                self.containers.pop(cid)
        elif args[:2] == ("network", "rm"):
            for name, obj in list(self.networks.items()):
                if args[2] in {obj.get("Id"), obj.get("id")}:
                    del self.networks[name]
        return subprocess.CompletedProcess(args, code, stdout, stderr)

    def add(self, obj, podman=False):
        identity = runtime_identity(obj)
        labels = ownership_labels(identity)
        labels["io.podman.compose.project" if podman else "com.docker.compose.project"] = identity["project"]
        cid = UUID(str(obj.id)).hex * 2
        self.containers[cid] = labels
        self.networks[identity["project"] + "_default"] = {
            "id" if podman else "Id": "network-" + str(obj.id),
            "labels" if podman else "Labels": ownership_labels(identity),
        }
        return cid

    def mutations(self):
        return [a for a in self.calls if a[0] in {"rm", "stop", "compose"} or a[:2] == ("network", "rm")]


@pytest.fixture
def setup(tmp_path, monkeypatch):
    from api.services.site_studio_runtime import manager_compose as compose

    manager = SiteStudioRuntimeManager(runtime_base_dir=tmp_path)
    runtime = Runtime()
    monkeypatch.setattr(manager, "_run_runtime", runtime)
    monkeypatch.setattr(manager, "_resolve_template_images", lambda _: ("test/api", "test/frontend"))
    monkeypatch.setattr(compose, "encrypt_site_studio_secret", lambda value: "encrypted")
    monkeypatch.setattr(manager, "_wait_until_healthy", AsyncMock())

    def up(path, project, *args):
        runtime.calls.append(("compose", path, project, *args))
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(manager, "_run_compose", up)
    return manager, runtime


def test_identity_ignores_titles_prefixes_and_rename(setup):
    manager, _ = setup
    a = instance(id=UUID("11111111-0000-0000-0000-000000000001"))
    b = instance(id=UUID("11111111-0000-0000-0000-000000000002"))
    assert manager._compose_project_name(a) != manager._compose_project_name(b)
    original = manager._layout(a)
    a.site_slug = "renamed"
    assert manager._layout(a) == original
    project = instance(id=a.id, marketing_project_id=uuid4(), owner_user_id=a.user_id)
    assert manager._compose_project_name(project) != manager._compose_project_name(a)


@pytest.mark.asyncio
async def test_unprovisioned_draft_never_calls_runtime(setup):
    manager, runtime = setup
    draft = instance()
    await manager.destroy(draft)
    assert runtime.calls == []


@pytest.mark.parametrize("field", ["compose_project_name", "runtime_dir", "compose_file_path"])
@pytest.mark.asyncio
async def test_foreign_or_legacy_binding_blocks_all_lifecycle_operations(setup, field):
    manager, runtime = setup
    obj = instance(**{field: "site-studio-legacy" if field == "compose_project_name" else "/tmp/foreign"})
    for method in (manager.provision, manager.start, manager.stop, manager.redeploy, manager.destroy):
        with pytest.raises(SiteStudioRuntimeError):
            await method(obj)
    assert not runtime.mutations()


@pytest.mark.parametrize("podman", [False, True])
@pytest.mark.parametrize("preserve", [False, True])
@pytest.mark.asyncio
async def test_destroy_removes_only_verified_ids(setup, podman, preserve):
    manager, runtime = setup
    obj = instance()
    manager._prepare_runtime_files(obj)
    cid = runtime.add(obj, podman)
    other = instance()
    foreign = runtime.add(other, podman)
    await manager.destroy(obj, preserve_runtime_data=preserve)
    assert cid not in runtime.containers and foreign in runtime.containers
    assert manager._layout(obj).runtime_dir.exists() == preserve
    assert all("down" not in call and "--volumes" not in call for call in runtime.calls)


@pytest.mark.parametrize("resource", ["container", "network"])
@pytest.mark.asyncio
async def test_foreign_labels_block_before_any_mutation(setup, resource):
    manager, runtime = setup
    obj = instance()
    manager._prepare_runtime_files(obj)
    cid = runtime.add(obj)
    if resource == "container":
        runtime.containers[cid]["ru.eliteew.site-studio.owner"] = str(uuid4())
    else:
        runtime.networks[runtime_identity(obj)["project"] + "_default"]["Labels"] = {}
    for method in (manager.provision, manager.start, manager.stop, manager.redeploy, manager.destroy):
        with pytest.raises(SiteStudioRuntimeError):
            await method(obj)
    assert not runtime.mutations()


@pytest.mark.asyncio
async def test_failed_launch_keeps_cleanup_binding_without_db_metadata(setup, monkeypatch):
    manager, runtime = setup
    obj = instance()

    def up(*args):
        assert (manager._layout(obj).runtime_dir / BINDING_FILE).is_file()
        runtime.add(obj)
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(manager, "_run_compose", up)
    manager._wait_until_healthy.side_effect = RuntimeError("health failed")
    with pytest.raises(SiteStudioRuntimeError):
        await manager.provision(obj)
    assert obj.compose_project_name is None
    await manager.destroy(obj)
    assert not runtime.containers


@pytest.mark.parametrize("images", [None, ("test/api", "test/frontend")])
def test_every_service_and_default_network_has_identity_labels(setup, images):
    manager, _ = setup
    obj = instance()
    parsed = yaml.safe_load(
        manager._compose_yaml(manager._layout(obj), obj, db_password="test", template_images=images)
    )
    expected = ownership_labels(runtime_identity(obj))
    for service in parsed["services"].values():
        assert service["labels"] == expected
    assert parsed["networks"]["default"]["labels"] == expected
    assert parsed["networks"]["eliteew-shared"]["external"] is True


@pytest.mark.asyncio
async def test_symlink_and_mismatched_marker_fail_closed(setup, tmp_path):
    manager, runtime = setup
    obj = instance()
    directory = manager._layout(obj).runtime_dir
    directory.symlink_to(tmp_path / "foreign", target_is_directory=True)
    with pytest.raises(SiteStudioRuntimeError):
        await manager.destroy(obj)
    directory.unlink()
    manager._prepare_runtime_files(obj)
    (directory / BINDING_FILE).write_text("{}")
    with pytest.raises(SiteStudioRuntimeError):
        await manager.destroy(obj)
    assert not runtime.mutations()


@pytest.mark.asyncio
async def test_owned_stop_start_and_redeploy(setup):
    manager, runtime = setup
    obj = instance()
    metadata = await manager.provision(obj)
    for key, value in metadata.items():
        setattr(obj, key, value)
    runtime.add(obj)
    assert (await manager.stop(obj))["status"] == "stopped"
    assert (await manager.start(obj))["status"] == "running"
    assert (await manager.redeploy(obj))["status"] == "running"


def _operator_module():
    import importlib.util

    path = Path(__file__).resolve().parents[3] / "docker/scripts/site-studio-runtime-ownership.py"
    spec = importlib.util.spec_from_file_location("runtime_operator", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_inventory_is_read_only_and_lists_colliding_resources():
    tool = _operator_module()
    rows = [vars(instance(compose_project_name="site-studio-legacy")) for _ in range(2)]
    resource = {
        "id": "container-1",
        "kind": "container",
        "name": "old",
        "labels": {"com.docker.compose.project": "site-studio-legacy"},
        "Env": ["SECRET=never-output"],
    }
    result = tool.inventory(rows, [resource])
    assert result["dry_run"] is True
    assert all(row["action"] == "BLOCK_CONFLICT" for row in result["instances"])
    assert all(row["resources"][0]["id"] == "container-1" for row in result["instances"])
    assert "SECRET" not in json.dumps(result)


def test_autostart_skips_unbound_legacy_and_checks_foreign_labels(setup, monkeypatch, tmp_path, capsys):
    tool = _operator_module()
    manager, runtime = setup
    legacy = tmp_path / "legacy/compose"
    legacy.mkdir(parents=True)
    (legacy / "docker-compose.yml").write_text("services: {}")
    monkeypatch.setattr(tool.subprocess, "run", lambda args, **kwargs: runtime(*args[1:]))
    tool.autostart(tmp_path, apply=True)
    assert runtime.calls == []
    assert "BLOCK_UNBOUND_LEGACY" in capsys.readouterr().out
    obj = instance()
    manager._prepare_runtime_files(obj)
    cid = runtime.add(obj)
    tool.autostart(tmp_path, apply=False)
    assert not runtime.mutations()
    tool.autostart(tmp_path, apply=True)
    assert len(runtime.mutations()) == 1
    runtime.calls.clear()
    runtime.containers[cid]["ru.eliteew.site-studio.owner"] = "foreign"
    assert not tool.autostart(tmp_path, apply=True)
    assert not runtime.mutations()


def test_autostart_partial_prepare_does_not_block_other_healthy_instances(setup, monkeypatch, tmp_path):
    tool = _operator_module()
    manager, runtime = setup
    broken = instance(id=UUID("00000000-0000-0000-0000-000000000001"))
    healthy = instance(id=UUID("00000000-0000-0000-0000-000000000002"))
    manager._owned_runtime_resources(broken, create=True)
    manager._prepare_runtime_files(healthy)
    monkeypatch.setattr(tool.subprocess, "run", lambda args, **kwargs: runtime(*args[1:]))
    assert not tool.autostart(tmp_path, apply=True)
    calls = runtime.mutations()
    assert len(calls) == 1
    assert runtime_identity(healthy)["project"] in calls[0]
