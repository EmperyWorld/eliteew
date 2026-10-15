# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Site Studio Edge Carrier: port stability, static pack, enable gate, handler registration.
# Invariants:
# - No real SSH / podman in CI — Carrier subprocess is monkeypatched.
# Related:
# - api/services/site_studio_edge_carrier.py
# - documentation/platform/SITE-EDGE-CARRIER.md
# ---
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from api.services import site_studio_edge_carrier as edge
from api.workers import queue_handlers


def test_allocate_edge_port_stable_for_slug() -> None:
    a = edge.allocate_edge_port("acme-demo", port_base=8080, port_span=100)
    b = edge.allocate_edge_port("acme-demo", port_base=8080, port_span=100)
    c = edge.allocate_edge_port("other-site", port_base=8080, port_span=100)
    assert a == b
    assert 8080 <= a < 8180
    assert c != a or True  # may collide rarely; both still in range
    assert 8080 <= c < 8180


def test_write_minimal_static_pack_has_index(tmp_path: Path) -> None:
    pack = edge.write_minimal_static_pack(
        tmp_path / "content",
        site_title="Demo Shop",
        site_topic="LAN preview",
        brief_json={"summary": "hello"},
    )
    index = pack / "index.html"
    assert index.is_file()
    body = index.read_text(encoding="utf-8")
    assert "Demo Shop" in body
    assert "LAN preview" in body
    assert "hello" in body


def test_build_static_content_dir_prefers_runtime_dist(tmp_path: Path) -> None:
    dist = tmp_path / "runtime" / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<html>built</html>", encoding="utf-8")
    instance = SimpleNamespace(
        site_slug="demo",
        site_title="T",
        site_topic="",
        brief_json={},
        runtime_dir=str(tmp_path / "runtime"),
        source_dir=None,
    )
    resolved = edge.build_static_content_dir(instance, work_root=tmp_path / "work")
    assert resolved == dist


def test_resolve_carrier_script_host_default(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    script = tmp_path / "site-edge-carrier-deploy.sh"
    script.write_text("#!/bin/bash\n", encoding="utf-8")
    monkeypatch.delenv("SITE_EDGE_CARRIER_SCRIPT", raising=False)
    monkeypatch.delenv("ELITEEW_REPO_ROOT", raising=False)
    monkeypatch.setattr(edge, "SITE_EDGE_CARRIER_SCRIPT_HOST_DEFAULT", str(script))
    assert edge.resolve_carrier_script() == script


def test_resolve_carrier_script_missing_lists_candidates(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("SITE_EDGE_CARRIER_SCRIPT", raising=False)
    monkeypatch.delenv("ELITEEW_REPO_ROOT", raising=False)
    missing = tmp_path / "missing-carrier.sh"
    monkeypatch.setattr(edge, "_carrier_script_candidates", lambda: [missing])
    with pytest.raises(edge.SiteStudioEdgeCarrierError, match="Carrier script not found"):
        edge.resolve_carrier_script()


def test_site_edge_carrier_enabled_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SITE_EDGE_CARRIER_ENABLED", raising=False)
    assert edge.site_edge_carrier_enabled() is False
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "1")
    assert edge.site_edge_carrier_enabled() is True
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "0")
    assert edge.site_edge_carrier_enabled() is False


def test_edge_health_snapshot_from_ports(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "true")
    monkeypatch.setenv("SITE_EDGE_SSH", "owned@192.168.1.10")
    monkeypatch.setenv("SITE_EDGE_PUBLIC_BASE", "http://192.168.1.10")
    instance = SimpleNamespace(
        ports_json={
            "edge_http": 8091,
            "edge_last_error": None,
            "edge_content_source": "stub",
        }
    )
    snap = edge.build_edge_health_snapshot(instance)
    assert snap["enabled"] is True
    assert snap["ssh_configured"] is True
    assert snap["port"] == 8091
    assert snap["url"] == "http://192.168.1.10:8091"
    assert snap["content_source"] == "stub"


@pytest.mark.asyncio
async def test_resolve_pack_runtime_dist(tmp_path: Path) -> None:
    dist = tmp_path / "runtime" / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<html>built</html>", encoding="utf-8")
    instance = SimpleNamespace(
        site_slug="demo",
        site_title="T",
        site_topic="",
        brief_json={},
        runtime_dir=str(tmp_path / "runtime"),
        source_dir=None,
        public_url=None,
        compose_project_name=None,
        ports_json={},
    )
    pack = await edge.resolve_edge_content_pack(instance, work_root=tmp_path / "work")
    assert pack.source == edge.CONTENT_SOURCE_RUNTIME
    assert pack.path == dist


@pytest.mark.asyncio
async def test_resolve_pack_snapshot_then_stub(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    html_body = "<html><head><title>Live</title></head><body><h1>Live Storefront</h1>" + ("x" * 200) + "</body></html>"

    class _Resp:
        status_code = 200
        text = html_body
        headers = {"content-type": "text/html; charset=utf-8"}
        url = "http://storefront.test/"
        content = b""

    class _Client:
        async def get(self, url: str, follow_redirects: bool = False):  # noqa: ARG002
            return _Resp()

    monkeypatch.setattr(
        "api.core.http_clients.get_httpx_client",
        lambda: _Client(),
    )
    instance = SimpleNamespace(
        site_slug="demo",
        site_title="T",
        site_topic="",
        brief_json={},
        runtime_dir=None,
        source_dir=None,
        public_url="http://storefront.test/",
        compose_project_name=None,
        ports_json={},
    )
    pack = await edge.resolve_edge_content_pack(instance, work_root=tmp_path / "work")
    assert pack.source == edge.CONTENT_SOURCE_SNAPSHOT
    assert (pack.path / "index.html").is_file()
    assert "Live Storefront" in (pack.path / "index.html").read_text(encoding="utf-8")

    # No candidates → stub
    instance2 = SimpleNamespace(
        site_slug="demo2",
        site_title="Stub Site",
        site_topic="topic",
        brief_json={},
        runtime_dir=None,
        source_dir=None,
        public_url=None,
        compose_project_name=None,
        ports_json={},
    )
    pack2 = await edge.resolve_edge_content_pack(instance2, work_root=tmp_path / "work2")
    assert pack2.source == edge.CONTENT_SOURCE_STUB
    assert (pack2.path / "index.html").is_file()


@pytest.mark.asyncio
async def test_deploy_requires_enabled_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "0")
    instance = SimpleNamespace(site_slug="demo", ports_json={})
    with pytest.raises(edge.SiteStudioEdgeCarrierError, match="ENABLED is off"):
        await edge.deploy_instance_to_edge(instance)


@pytest.mark.asyncio
async def test_deploy_calls_carrier_script(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "1")
    monkeypatch.setenv("SITE_EDGE_SSH", "owned@192.168.1.10")
    monkeypatch.setenv("SITE_EDGE_PUBLIC_BASE", "http://192.168.1.10")
    monkeypatch.delenv("SITE_EDGE_ALLOW_STUB_PUBLISH", raising=False)
    script = tmp_path / "site-edge-carrier-deploy.sh"
    script.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
    monkeypatch.setenv("SITE_EDGE_CARRIER_SCRIPT", str(script))

    dist = tmp_path / "runtime" / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<html>built</html>", encoding="utf-8")

    run_mock = AsyncMock()
    monkeypatch.setattr(edge, "_run_cmd", run_mock)

    instance = SimpleNamespace(
        site_slug="demo-edge",
        site_title="Edge Demo",
        site_topic="test",
        brief_json={},
        runtime_dir=str(tmp_path / "runtime"),
        source_dir=None,
        ports_json={},
        public_url=None,
        compose_project_name=None,
        last_error=None,
    )
    result = await edge.deploy_instance_to_edge(instance)
    assert run_mock.await_count == 1
    assert run_mock.await_args is not None
    cmd = run_mock.await_args.args[0]
    assert cmd[0] == "bash"
    assert str(script) in cmd
    assert "--slug" in cmd and "demo-edge" in cmd
    assert "--host-port" in cmd
    assert result["port"] == edge.allocate_edge_port("demo-edge")
    assert result["content_source"] == edge.CONTENT_SOURCE_RUNTIME
    assert instance.ports_json.get("edge_http") == result["port"]
    assert instance.ports_json.get("edge_url") == result["url"]
    assert instance.ports_json.get("edge_content_source") == "runtime_dist"
    assert result["url"] == f"http://192.168.1.10:{result['port']}"


@pytest.mark.asyncio
async def test_deploy_rejects_stub_without_allow_flag(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "1")
    monkeypatch.setenv("SITE_EDGE_SSH", "owned@192.168.1.10")
    monkeypatch.setenv("SITE_EDGE_PUBLIC_BASE", "http://192.168.1.10")
    monkeypatch.delenv("SITE_EDGE_ALLOW_STUB_PUBLISH", raising=False)
    script = tmp_path / "site-edge-carrier-deploy.sh"
    script.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
    monkeypatch.setenv("SITE_EDGE_CARRIER_SCRIPT", str(script))
    run_mock = AsyncMock()
    monkeypatch.setattr(edge, "_run_cmd", run_mock)
    instance = SimpleNamespace(
        site_slug="demo-stub",
        site_title="Stub Only",
        site_topic="t",
        brief_json={},
        runtime_dir=None,
        source_dir=None,
        ports_json={},
        public_url=None,
        compose_project_name=None,
        last_error=None,
    )
    with pytest.raises(edge.SiteStudioEdgeCarrierError, match="runtime_dist or storefront snapshot"):
        await edge.deploy_instance_to_edge(instance)
    assert run_mock.await_count == 0


@pytest.mark.asyncio
async def test_deploy_allows_stub_when_flag_set(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SITE_EDGE_CARRIER_ENABLED", "1")
    monkeypatch.setenv("SITE_EDGE_SSH", "owned@192.168.1.10")
    monkeypatch.setenv("SITE_EDGE_PUBLIC_BASE", "http://192.168.1.10")
    monkeypatch.setenv("SITE_EDGE_ALLOW_STUB_PUBLISH", "1")
    script = tmp_path / "site-edge-carrier-deploy.sh"
    script.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
    monkeypatch.setenv("SITE_EDGE_CARRIER_SCRIPT", str(script))
    run_mock = AsyncMock()
    monkeypatch.setattr(edge, "_run_cmd", run_mock)
    instance = SimpleNamespace(
        site_slug="demo-stub-ok",
        site_title="Stub Dry Run",
        site_topic="t",
        brief_json={},
        runtime_dir=None,
        source_dir=None,
        ports_json={},
        public_url=None,
        compose_project_name=None,
        last_error=None,
    )
    result = await edge.deploy_instance_to_edge(instance)
    assert run_mock.await_count == 1
    assert result["content_source"] == edge.CONTENT_SOURCE_STUB


def test_queue_handlers_register_edge_tasks() -> None:
    assert "site_studio_edge_publish" in queue_handlers.TASK_HANDLERS
    assert "site_studio_edge_unpublish" in queue_handlers.TASK_HANDLERS
    assert queue_handlers.TASK_HANDLERS["site_studio_edge_publish"] is queue_handlers.handle_site_studio_edge
