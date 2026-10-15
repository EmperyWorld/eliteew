"""BI ownership regression tests; all infrastructure is local or mocked."""

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from elasticsearch import ConflictError
from fastapi import BackgroundTasks, HTTPException

from api.routers import business_intelligence as routes
from api.schemas.business_intelligence import GenerationRequest
from api.services.business_intelligence.business_analyzer import BusinessAnalyzer
from api.services.business_intelligence.elasticsearch_service import ElasticsearchService
from api.services.business_intelligence.template_engine import TemplateEngine


def conflict():
    return ConflictError("already exists", meta=None, body={})


@pytest.fixture
def services(monkeypatch, tmp_path):
    es = ElasticsearchService()
    es.client = AsyncMock()
    es.client.get.return_value = {"found": True, "_source": {"user_id": "alice", "status": "pending"}}
    es.client.search.return_value = {"hits": {"hits": []}}
    result = {
        "elasticsearch": es,
        "template": TemplateEngine(output_dir=str(tmp_path)),
        "analyzer": SimpleNamespace(analyze_business=AsyncMock(return_value={"status": "completed"})),
    }
    monkeypatch.setattr(routes, "get_services", AsyncMock(return_value=result))
    monkeypatch.setattr(routes, "is_queue_enabled", lambda *a, **k: False)
    monkeypatch.setattr(
        routes,
        "get_auth_provider_service",
        lambda: SimpleNamespace(validate_token=AsyncMock(return_value={"sub": "alice"})),
    )
    monkeypatch.setattr(routes, "resolve_db_user_id_by_email", AsyncMock(return_value=None))
    return result


def request():
    return GenerationRequest(
        session_id="session",
        documents=[{"id": "victim-id", "type": "text", "name": "input", "content": "business data"}],
        analysis_types=["executive_summary"],
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("owner", ["bob", "", None])
async def test_status_denies_foreign_or_unowned(services, owner):
    es = services["elasticsearch"]
    es.client.get.return_value["_source"]["user_id"] = owner
    with pytest.raises(HTTPException) as error:
        await routes.get_session_status("session", SimpleNamespace(id="alice"))
    assert error.value.status_code == 404
    es.client.search.assert_not_awaited()


@pytest.mark.asyncio
async def test_status_scopes_analysis_query(services):
    result = await routes.get_session_status("session", SimpleNamespace(id="alice"))
    assert result["status"] == "pending"
    filters = services["elasticsearch"].client.search.call_args.kwargs["body"]["query"]["bool"]["filter"]
    assert filters == [{"term": {"session_id": "session"}}, {"term": {"user_id": "alice"}}]


@pytest.mark.asyncio
@pytest.mark.parametrize("missing", [True, False])
async def test_missing_or_failed_store_denies_status(services, missing):
    es = services["elasticsearch"]
    if missing:
        es.client.get.return_value = {"found": False}
    else:
        es.client.get.side_effect = RuntimeError("offline")
    with pytest.raises(HTTPException) as error:
        await routes.get_session_status("session", SimpleNamespace(id="alice"))
    assert error.value.status_code == 404
    es.client.search.assert_not_awaited()


@pytest.mark.asyncio
async def test_atomic_reservation_only_dispatches_one_owner(services):
    stored = {}

    async def create(**kwargs):
        assert kwargs["op_type"] == "create"
        if kwargs["id"] in stored:
            raise conflict()
        stored[kwargs["id"]] = kwargs["document"].copy()
        await asyncio.sleep(0)

    services["elasticsearch"].client.index.side_effect = create
    tasks = [BackgroundTasks(), BackgroundTasks()]
    results = await asyncio.gather(
        *(
            routes.generate_analysis(request(), tasks[i], SimpleNamespace(id=owner))
            for i, owner in enumerate(["alice", "bob"])
        ),
        return_exceptions=True,
    )
    assert sum(isinstance(r, HTTPException) and r.status_code == 409 for r in results) == 1
    assert sum(len(t.tasks) for t in tasks) == 1
    assert stored["session"]["user_id"] == "alice"
    queued = tasks[0].tasks[0].kwargs["documents"][0]
    assert queued["id"] != "victim-id"
    # Same-owner replay must also leave the original reservation untouched.
    with pytest.raises(HTTPException) as error:
        await routes.generate_analysis(request(), BackgroundTasks(), SimpleNamespace(id="alice"))
    assert error.value.status_code == 409
    assert stored["session"]["status"] == "pending"


@pytest.mark.asyncio
async def test_failed_reservation_does_not_dispatch(services):
    services["elasticsearch"].client.index.side_effect = RuntimeError("offline")
    tasks = BackgroundTasks()
    with pytest.raises(HTTPException) as error:
        await routes.generate_analysis(request(), tasks, SimpleNamespace(id="alice"))
    assert error.value.status_code == 503
    assert not tasks.tasks


@pytest.mark.asyncio
async def test_owner_identity_cannot_be_updated(services):
    es = services["elasticsearch"]
    for changes in ({"user_id": "bob"}, {"session_id": "other"}):
        assert not await es.update_session("session", changes)
    es.client.update.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["other.json", "../other.json", "..\\other.json", ".", ".."])
async def test_download_denies_unbound_and_unsafe_names(services, name):
    # Even an invalid historic manifest cannot authorize paths outside the root.
    services["elasticsearch"].client.get.return_value["_source"]["generated_files"] = (
        [name] if name != "other.json" else ["owned.json"]
    )
    with pytest.raises(HTTPException) as error:
        await routes.download_document("session", name, "token")
    assert error.value.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["foreign", "missing-store", "legacy", "symlink"])
async def test_download_fails_closed(services, tmp_path, state):
    source = services["elasticsearch"].client.get.return_value["_source"]
    source["generated_files"] = ["owned.json"]
    if state == "foreign":
        source["user_id"] = "bob"
    elif state == "missing-store":
        services.pop("elasticsearch")
    elif state == "legacy":
        source.pop("generated_files")
    else:
        outside = tmp_path.parent / (tmp_path.name + "-outside")
        outside.write_text("secret")
        (tmp_path / "owned.json").symlink_to(outside)
    with pytest.raises(HTTPException) as error:
        await routes.download_document("session", "owned.json", "token")
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_all_supported_formats_are_bound_and_downloadable(services):
    engine = services["template"]
    docs = await engine.generate_documents(
        "../../untrusted/session", [], {}, formats=["docx", "markdown", "json", "html"]
    )
    assert len(docs) == 4
    source = services["elasticsearch"].client.get.return_value["_source"]
    source["generated_files"] = [doc["file_name"] for doc in docs]
    for doc in docs:
        path = Path(doc["file_path"])
        assert path.parent == engine.output_dir
        assert path.stat().st_size > 0
        response = await routes.download_document("session", doc["file_name"], "token")
        assert response.path == str(path.resolve())
    second = await engine.generate_documents("session", [], {}, formats=["json"])
    assert second[0]["file_name"] not in source["generated_files"]


@pytest.mark.asyncio
async def test_legacy_document_ids_are_scoped_to_owner_and_session(services):
    analyzer = BusinessAnalyzer(services["elasticsearch"], None, None)
    doc = {"id": "victim-id", "type": "text", "name": "input", "content": "data"}
    ids = []
    for owner, session in [("alice", "one"), ("bob", "one"), ("alice", "two"), ("alice", "one")]:
        result = await analyzer._process_documents(session, owner, [doc])
        ids.append(result[0]["id"])
    assert len(set(ids[:3])) == 3
    assert ids[0] == ids[3]
    assert "victim-id" not in ids
    result = await analyzer._process_documents("one", "alice", [{**doc, "id": None}])
    assert result[0]["id"]


@pytest.mark.asyncio
async def test_queued_job_owner_mismatch_has_no_side_effects(services, monkeypatch):
    emit = AsyncMock()
    monkeypatch.setattr(routes, "send_bi_error", emit)
    with pytest.raises(HTTPException):
        await routes._run_generation("session", "bob", [], [], [], {}, None, services)
    services["analyzer"].analyze_business.assert_not_awaited()
    services["elasticsearch"].client.update.assert_not_awaited()
    emit.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("persisted", [True, False])
async def test_manifest_persisted_before_completion(services, monkeypatch, persisted):
    import api.core.database_manager as db

    monkeypatch.setattr(
        db,
        "get_database_manager",
        AsyncMock(return_value=SimpleNamespace(get_redis_client=AsyncMock(return_value=None))),
    )
    es = services["elasticsearch"]
    events = []

    async def update(session_id, updates):
        events.append("persist")
        assert len(updates["generated_files"]) == 1
        return persisted

    es.update_session = update

    async def completed(*args):
        events.append("emit")

    monkeypatch.setattr(routes, "send_bi_completed", completed)
    monkeypatch.setattr(routes, "send_bi_error", AsyncMock())
    monkeypatch.setattr(routes, "get_notification_service", lambda: SimpleNamespace(send_to_user=AsyncMock()))
    call = routes._run_generation("session", "alice", [], [], ["json"], {}, None, services)
    if persisted:
        await call
        assert events == ["persist", "emit"]
    else:
        with pytest.raises(RuntimeError, match="manifest"):
            await call
        assert events == ["persist"]


@pytest.mark.asyncio
async def test_manifest_failure_can_recover_on_queue_redelivery(services, monkeypatch):
    import api.core.database_manager as db

    state = {}

    async def set_value(key, value, nx=False, **kwargs):
        if nx and key in state:
            return False
        state[key] = value
        return True

    async def delete(key):
        state.pop(key, None)

    redis = SimpleNamespace(set=set_value, delete=delete)
    monkeypatch.setattr(
        db,
        "get_database_manager",
        AsyncMock(return_value=SimpleNamespace(get_redis_client=AsyncMock(return_value=redis))),
    )
    es = services["elasticsearch"]
    es.update_session = AsyncMock(side_effect=[False, True])
    emit = AsyncMock()
    monkeypatch.setattr(routes, "send_bi_completed", emit)
    monkeypatch.setattr(routes, "send_bi_error", AsyncMock())
    monkeypatch.setattr(routes, "get_notification_service", lambda: SimpleNamespace(send_to_user=AsyncMock()))
    with pytest.raises(RuntimeError, match="manifest"):
        await routes._run_generation("session", "alice", [], [], ["json"], {}, None, services)
    assert not state
    await routes._run_generation("session", "alice", [], [], ["json"], {}, None, services)
    assert state["bi:generation:session"] == "completed"
    assert es.update_session.await_count == 2
    emit.assert_awaited_once()
    await routes._run_generation("session", "alice", [], [], ["json"], {}, None, services)
    assert es.update_session.await_count == 2
