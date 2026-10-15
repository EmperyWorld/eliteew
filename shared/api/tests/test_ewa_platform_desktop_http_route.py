# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``POST /api/v1/ewa/desktop-orchestration/turn`` (envelope parse, observation validation, turn).
# Invariants:
# - Uses FastAPI ``TestClient`` with ``require_oauth2_user`` override; no real Keycloak or AMKA PG required.
# Related:
# - shared/api/ewa_platform/gateways/routers/desktop.py
# - shared/api/ewa_platform/desktop/runtime.py
# ---
from __future__ import annotations

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.contracts.desktop_observation import DesktopObservationKind
from api.ewa_platform.contracts.orchestration import OrchestrationSessionBranch
from api.ewa_platform.gateways.desktop_http import ewa_desktop_orchestration_signal_request
from api.ewa_platform.gateways.routers.desktop import router as ewa_desktop_router
from api.ewa_platform.io.envelope import (
    EWA_IO_API_VERSION,
    EwaRequestMessageType,
    EwaRequestV1,
    ewa_request_v1_to_mapping,
)
from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.state.ewa_orchestration_memory_stores = InMemoryOrchestrationStores()
    app.include_router(ewa_desktop_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    return TestClient(app)


def test_desktop_orchestration_turn_user_cancelled(client: TestClient) -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-1",
        session_id="sess-1",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    body = ewa_request_v1_to_mapping(req)
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["correlation_id"] == "cid-1"
    assert data["payload"]["kind"] == "ewa_desktop_orchestration_result_v1"
    assert data["payload"]["session_id"] == "sess-1"
    assert len(data["payload"]["events"]) >= 1
    assert data["payload"]["session"]["last_branch"] == OrchestrationSessionBranch.NO_INTENT
    pers = data["payload"]["persistence"]
    assert pers["store_kind"] == "shared_memory"
    assert pers["persisted_across_requests"] is True
    assert pers["companion"]["loaded"] is False
    assert pers["companion"]["reason"] == "no_database_pool"


def test_desktop_orchestration_turn_active_app_focus(client: TestClient) -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-2",
        session_id="sess-2",
        observation={
            "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
            "app_component": "App",
            "window_id": "w1",
        },
    )
    body = ewa_request_v1_to_mapping(req)
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["payload"]["session"]["last_branch"] == OrchestrationSessionBranch.INTENT_EXECUTED
    kinds = {e.get("kind") for e in data["payload"]["events"]}
    assert "observation" in kinds
    assert "intent_result" in kinds


def test_desktop_orchestration_turn_wrong_payload_kind(client: TestClient) -> None:
    req = EwaRequestV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaRequestMessageType.SIGNAL,
        correlation_id="c",
        auth_context_ref=None,
        payload={
            "kind": "wrong_kind",
            "session_id": "s1",
            "observation": {
                "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
                "reason": "r",
            },
        },
    )
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=ewa_request_v1_to_mapping(req))
    assert r.status_code == 400


def test_desktop_orchestration_sse_snapshot_after_turn(client: TestClient) -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-sse",
        session_id="sess-sse",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    body = ewa_request_v1_to_mapping(req)
    post_r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=body)
    assert post_r.status_code == 200

    r = client.get("/api/v1/ewa/desktop-orchestration/sessions/sess-sse/events")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/event-stream")
    assert ": keep-alive" in r.text or "keep-alive" in r.text
    assert "data:" in r.text


def test_desktop_orchestration_turn_marks_ephemeral_memory() -> None:
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_desktop_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-ephemeral",
        session_id="sess-ephemeral",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    r = c.post("/api/v1/ewa/desktop-orchestration/turn", json=ewa_request_v1_to_mapping(req))
    assert r.status_code == 200
    persistence = r.json()["payload"]["persistence"]
    assert persistence["store_kind"] == "ephemeral_memory"
    assert persistence["persisted_across_requests"] is False
    assert "POST turn and later SSE requests do not share events" in persistence["operator_note"]
    assert persistence["companion"]["loaded"] is False
    assert persistence["companion"]["reason"] == "no_database_pool"


def test_desktop_orchestration_turn_invalid_observation(client: TestClient) -> None:
    req = EwaRequestV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaRequestMessageType.SIGNAL,
        correlation_id="c",
        auth_context_ref=None,
        payload={
            "kind": "ewa_desktop_orchestration_v1",
            "session_id": "s1",
            "observation": {"observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value},
        },
    )
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=ewa_request_v1_to_mapping(req))
    assert r.status_code == 400


def test_desktop_orchestration_turn_companion_metadata_emits_context_event(client: TestClient) -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-companion-meta",
        session_id="sess-cc",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    body = ewa_request_v1_to_mapping(req)
    body["payload"]["metadata"] = {
        "companion": {
            "seed_persona_id": "mela",
            "expect_companion_revision": 2,
        },
    }
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=body)
    assert r.status_code == 200
    data = r.json()
    kinds = [e.get("kind") for e in data["payload"]["events"]]
    assert "companion_context" in kinds
    cc = next(e for e in data["payload"]["events"] if e.get("kind") == "companion_context")
    assert cc.get("loaded") is False
    assert cc.get("client_seed_persona_id") == "mela"
    assert cc.get("client_expect_companion_revision") == 2
    assert "revision_expect_matched" not in cc
    companion = data["payload"]["persistence"]["companion"]
    assert companion["client"]["seed_persona_id"] == "mela"
    assert companion["expect_companion_revision"] == 2


def test_desktop_orchestration_turn_bad_companion_metadata_yields_warnings(client: TestClient) -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="cid-bad-companion",
        session_id="sess-bad",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    body = ewa_request_v1_to_mapping(req)
    body["payload"]["metadata"] = {"companion": []}
    r = client.post("/api/v1/ewa/desktop-orchestration/turn", json=body)
    assert r.status_code == 200
    data = r.json()
    warns = data["payload"]["persistence"]["companion"]["hints_warnings"]
    assert "metadata.companion_not_object_skipped" in warns
    kinds = {e.get("kind") for e in data["payload"]["events"]}
    assert "companion_context" in kinds
