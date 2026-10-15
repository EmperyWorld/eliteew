# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer B HTTP integration: POST dag with builder_meta → in-memory PG store → GET round-trip.
# Related:
# - api/ewa_platform/gateways/routers/companion_user_workflows.py
# ---

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.gateways.routers.companion_user_workflows import (
    router as companion_user_workflows_router,
)
from api.ewa_platform.persistence_pg import companion_user_workflows_asyncpg as user_wf_pg

_PRINCIPAL_ID = "11111111-1111-4111-8111-111111111111"
_NODE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
_NODE_ID_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
_ORPHAN_NODE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"


class _InMemoryUserWorkflowStore:
    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], dict[str, Any]] = {}

    async def create(
        self,
        pool: Any,
        *,
        principal_id: str,
        name: str,
        enabled: bool,
        definition_json: dict[str, Any],
        trigger_json: dict[str, Any],
    ) -> dict[str, Any]:
        _ = pool
        workflow_id = str(uuid.uuid4())
        now = datetime.now(tz=UTC).isoformat()
        row = {
            "id": workflow_id,
            "principal_id": principal_id,
            "name": name,
            "enabled": enabled,
            "definition_json": definition_json,
            "trigger_json": trigger_json,
            "version": 1,
            "created_at": now,
            "updated_at": now,
        }
        self._rows[(principal_id, workflow_id)] = row
        return dict(row)

    async def fetch(
        self,
        pool: Any,
        *,
        principal_id: str,
        workflow_id: str,
    ) -> dict[str, Any] | None:
        _ = pool
        row = self._rows.get((principal_id, workflow_id))
        return dict(row) if row is not None else None

    async def update(
        self,
        pool: Any,
        *,
        principal_id: str,
        workflow_id: str,
        name: str | None = None,
        enabled: bool | None = None,
        definition_json: dict[str, Any] | None = None,
        trigger_json: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        _ = pool
        key = (principal_id, workflow_id)
        row = self._rows.get(key)
        if row is None:
            return None
        if name is not None:
            row["name"] = name
        if enabled is not None:
            row["enabled"] = enabled
        if definition_json is not None:
            row["definition_json"] = definition_json
        if trigger_json is not None:
            row["trigger_json"] = trigger_json
        row["version"] = int(row.get("version") or 1) + 1
        row["updated_at"] = datetime.now(tz=UTC).isoformat()
        return dict(row)

    async def list_enabled(
        self,
        pool: Any,
        *,
        principal_id: str,
        limit: int = 32,
    ) -> list[dict[str, Any]]:
        _ = pool, principal_id, limit
        return []


def _dag_payload(
    *,
    x: float = 120.0,
    y: float = 80.0,
    zoom: float = 1.0,
    extra_position_node_id: str | None = None,
) -> dict[str, Any]:
    node_positions: dict[str, dict[str, float]] = {
        _NODE_ID: {"x": x, "y": y},
    }
    if extra_position_node_id is not None:
        node_positions[extra_position_node_id] = {"x": 10.0, "y": 10.0}
    return {
        "nodes": [
            {
                "id": _NODE_ID,
                "type": "prompt_gen",
                "mode": "stateful",
                "inputs": {"prompt": "{{turn.user_line}}"},
                "outputs": {"reply": {"type": "text"}},
                "title_ru": "Prompt",
                "title_en": "Prompt",
            }
        ],
        "edges": [],
        "builder_meta": {
            "schema_version": 1,
            "node_positions": node_positions,
            "viewport": {"x": -40.0, "y": 10.0, "zoom": zoom},
        },
        "execution_mode": "async",
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, _InMemoryUserWorkflowStore]:
    store = _InMemoryUserWorkflowStore()
    fake_pool = object()

    monkeypatch.setattr(
        user_wf_pg,
        "companion_user_workflow_create",
        AsyncMock(side_effect=store.create),
    )
    monkeypatch.setattr(
        user_wf_pg,
        "companion_user_workflow_fetch",
        AsyncMock(side_effect=store.fetch),
    )
    monkeypatch.setattr(
        user_wf_pg,
        "companion_user_workflow_update",
        AsyncMock(side_effect=store.update),
    )
    monkeypatch.setattr(
        user_wf_pg,
        "companion_user_workflows_list_enabled",
        AsyncMock(side_effect=store.list_enabled),
    )

    app = FastAPI()
    app.state.ewa_orchestration_pool = fake_pool
    app.include_router(companion_user_workflows_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(
            id=_PRINCIPAL_ID,
            email="builder@test.local",
            username="builder",
            role="user",
            is_verified=True,
        )

    app.dependency_overrides[require_oauth2_user] = fake_user
    return TestClient(app), store


def test_create_get_persists_builder_meta(client: tuple[TestClient, _InMemoryUserWorkflowStore]) -> None:
    test_client, _store = client
    create_body = {
        "name": "Visual layout chain",
        "enabled": True,
        "trigger": {"type": "phrase", "patterns": ["run visual layout chain"]},
        "dag": _dag_payload(),
    }
    created = test_client.post("/api/v1/ewa/companion-user-workflows", json=create_body)
    assert created.status_code == 200, created.text
    workflow_id = created.json()["id"]

    fetched = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert fetched.status_code == 200, fetched.text
    definition = fetched.json()["definition_json"]
    assert definition["schema_version"] == 2
    builder_meta = definition["builder_meta"]
    assert builder_meta["node_positions"][_NODE_ID]["x"] == pytest.approx(120.0)
    assert builder_meta["node_positions"][_NODE_ID]["y"] == pytest.approx(80.0)
    assert builder_meta["viewport"]["x"] == pytest.approx(-40.0)
    assert builder_meta["viewport"]["y"] == pytest.approx(10.0)
    assert builder_meta["viewport"]["zoom"] == pytest.approx(1.0)


def test_patch_updates_builder_meta_positions(
    client: tuple[TestClient, _InMemoryUserWorkflowStore],
) -> None:
    test_client, _store = client
    create_body = {
        "name": "Patch layout chain",
        "enabled": True,
        "trigger": {"type": "phrase", "patterns": ["patch layout chain"]},
        "dag": _dag_payload(),
    }
    created = test_client.post("/api/v1/ewa/companion-user-workflows", json=create_body)
    assert created.status_code == 200, created.text
    workflow_id = created.json()["id"]

    patched = test_client.patch(
        f"/api/v1/ewa/companion-user-workflows/{workflow_id}",
        json={"dag": _dag_payload(x=240.0, y=160.0, zoom=0.85)},
    )
    assert patched.status_code == 200, patched.text

    fetched = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert fetched.status_code == 200, fetched.text
    builder_meta = fetched.json()["definition_json"]["builder_meta"]
    assert builder_meta["node_positions"][_NODE_ID]["x"] == pytest.approx(240.0)
    assert builder_meta["node_positions"][_NODE_ID]["y"] == pytest.approx(160.0)
    assert builder_meta["viewport"]["zoom"] == pytest.approx(0.85)


def test_create_rejects_orphan_builder_meta_node_positions(
    client: tuple[TestClient, _InMemoryUserWorkflowStore],
) -> None:
    test_client, _store = client
    create_body = {
        "name": "Invalid layout chain",
        "enabled": True,
        "trigger": {"type": "phrase", "patterns": ["invalid layout chain"]},
        "dag": _dag_payload(extra_position_node_id=_ORPHAN_NODE_ID),
    }
    response = test_client.post("/api/v1/ewa/companion-user-workflows", json=create_body)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "errors" in detail
    assert any("builder_meta.node_positions references unknown nodes" in err for err in detail["errors"])


def _two_node_edge_dag_payload() -> dict[str, Any]:
    return {
        "nodes": [
            {
                "id": _NODE_ID,
                "type": "prompt_gen",
                "mode": "stateful",
                "inputs": {"prompt": "{{turn.user_line}}"},
                "outputs": {"reply": {"type": "text"}},
                "title_ru": "Prompt",
                "title_en": "Prompt",
            },
            {
                "id": _NODE_ID_2,
                "type": "print_log",
                "mode": "stateless",
                "inputs": {"text": f"{{{{{_NODE_ID}.reply}}}}"},
                "outputs": {"reply": {"type": "text"}},
                "title_ru": "Log",
                "title_en": "Log",
            },
        ],
        "edges": [
            {
                "source_node_id": _NODE_ID,
                "target_node_id": _NODE_ID_2,
                "mapping_rules": {"text": f"{{{{{_NODE_ID}.reply}}}}"},
            }
        ],
        "builder_meta": {
            "schema_version": 1,
            "node_positions": {
                _NODE_ID: {"x": 100.0, "y": 50.0},
                _NODE_ID_2: {"x": 400.0, "y": 50.0},
            },
            "viewport": {"x": 0.0, "y": 0.0, "zoom": 1.0},
        },
        "execution_mode": "async",
    }


def test_create_patch_get_persists_multi_node_graph_with_edge(
    client: tuple[TestClient, _InMemoryUserWorkflowStore],
) -> None:
    test_client, _store = client
    create_body = {
        "name": "Two node chain",
        "enabled": True,
        "trigger": {"type": "phrase", "patterns": ["two node chain demo"]},
        "dag": _two_node_edge_dag_payload(),
    }
    created = test_client.post("/api/v1/ewa/companion-user-workflows", json=create_body)
    assert created.status_code == 200, created.text
    workflow_id = created.json()["id"]

    fetched = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert fetched.status_code == 200, fetched.text
    definition = fetched.json()["definition_json"]
    assert len(definition["nodes"]) == 2
    assert len(definition["edges"]) == 1
    assert definition["edges"][0]["source_node_id"] == _NODE_ID
    assert definition["edges"][0]["target_node_id"] == _NODE_ID_2
    assert definition["builder_meta"]["node_positions"][_NODE_ID]["x"] == pytest.approx(100.0)
    assert definition["builder_meta"]["node_positions"][_NODE_ID_2]["x"] == pytest.approx(400.0)

    patched_dag = _two_node_edge_dag_payload()
    patched_dag["builder_meta"]["node_positions"][_NODE_ID] = {"x": 150.0, "y": 75.0}
    patched_dag["builder_meta"]["node_positions"][_NODE_ID_2] = {"x": 450.0, "y": 75.0}
    patched = test_client.patch(
        f"/api/v1/ewa/companion-user-workflows/{workflow_id}",
        json={"dag": patched_dag},
    )
    assert patched.status_code == 200, patched.text

    refetched = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert refetched.status_code == 200, refetched.text
    updated = refetched.json()["definition_json"]
    assert len(updated["nodes"]) == 2
    assert len(updated["edges"]) == 1
    assert updated["builder_meta"]["node_positions"][_NODE_ID]["x"] == pytest.approx(150.0)
    assert updated["builder_meta"]["node_positions"][_NODE_ID_2]["x"] == pytest.approx(450.0)
    assert updated["edges"][0]["mapping_rules"]["text"] == f"{{{{{_NODE_ID}.reply}}}}"


def _single_node_dag_payload() -> dict[str, Any]:
    return {
        "nodes": [
            {
                "id": _NODE_ID,
                "type": "prompt_gen",
                "mode": "stateful",
                "inputs": {"prompt": "{{turn.user_line}}"},
                "outputs": {"reply": {"type": "text"}},
                "title_ru": "Prompt",
                "title_en": "Prompt",
            }
        ],
        "edges": [],
        "builder_meta": {
            "schema_version": 1,
            "node_positions": {_NODE_ID: {"x": 80.0, "y": 120.0}},
            "viewport": {"x": 0.0, "y": 0.0, "zoom": 1.0},
        },
        "execution_mode": "async",
    }


def test_post_patch_get_incremental_workflow_build(
    client: tuple[TestClient, _InMemoryUserWorkflowStore],
) -> None:
    """Simulates visual builder: create with one node, patch to add second + edge, reload."""
    test_client, _store = client
    trigger = {"type": "phrase", "patterns": ["incremental build demo"]}

    created = test_client.post(
        "/api/v1/ewa/companion-user-workflows",
        json={
            "name": "Incremental chain",
            "enabled": True,
            "trigger": trigger,
            "dag": _single_node_dag_payload(),
        },
    )
    assert created.status_code == 200, created.text
    workflow_id = created.json()["id"]

    initial = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert initial.status_code == 200, initial.text
    initial_def = initial.json()["definition_json"]
    assert len(initial_def["nodes"]) == 1
    assert initial_def["nodes"][0]["id"] == _NODE_ID
    assert initial_def["edges"] == []
    assert initial_def["builder_meta"]["node_positions"][_NODE_ID]["y"] == pytest.approx(120.0)

    expanded_dag = _two_node_edge_dag_payload()
    expanded_dag["nodes"][1]["title_en"] = "Log updated"
    expanded_dag["nodes"][1]["config"] = {"delay_sec": 0}
    expanded_dag["nodes"][1]["inputs"] = {"text": "hello from patch"}

    patched = test_client.patch(
        f"/api/v1/ewa/companion-user-workflows/{workflow_id}",
        json={"dag": expanded_dag},
    )
    assert patched.status_code == 200, patched.text

    final = test_client.get(f"/api/v1/ewa/companion-user-workflows/{workflow_id}")
    assert final.status_code == 200, final.text
    definition = final.json()["definition_json"]
    assert len(definition["nodes"]) == 2
    assert len(definition["edges"]) == 1
    assert definition["edges"][0]["source_node_id"] == _NODE_ID
    assert definition["edges"][0]["target_node_id"] == _NODE_ID_2
    assert definition["builder_meta"]["node_positions"][_NODE_ID_2]["x"] == pytest.approx(400.0)

    log_node = next(node for node in definition["nodes"] if node["id"] == _NODE_ID_2)
    assert log_node["title_en"] == "Log updated"
    assert log_node["inputs"]["text"] == "hello from patch"
