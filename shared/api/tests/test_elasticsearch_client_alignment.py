# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: stack0-api Elasticsearch client aligned with stack1 ES 9.x (Wave 1 Task 0.2).
# Invariants:
# - api.lock pins elasticsearch 9.x; elasticsearch-dsl removed (no 9.x release, unused in code).
# - ElasticsearchService uses shared DatabaseManager client for ping/health/search.
# Related:
# - docker/builders/stack0-api/requirements/locks/api.lock
# - api/services/business_intelligence/elasticsearch_service.py
# ---
from __future__ import annotations

import importlib.metadata
import re
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK = _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock"
_CONSTRAINTS = _REPO_ROOT / "docker/builders/stack0-api/constraints.txt"


def test_api_lock_pins_elasticsearch_9x() -> None:
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    match = re.search(r"^elasticsearch==(\S+)", lock_text, re.MULTILINE)
    assert match is not None, "elasticsearch must be present in api.lock"
    version = match.group(1)
    assert version.startswith("9."), f"expected elasticsearch 9.x, got {version}"


def test_api_lock_does_not_include_elasticsearch_dsl() -> None:
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    assert "elasticsearch-dsl==" not in lock_text
    assert "elasticsearch_dsl" not in lock_text


def test_constraints_do_not_cap_elasticsearch_below_9() -> None:
    constraints = _CONSTRAINTS.read_text(encoding="utf-8")
    assert "elasticsearch<9" not in constraints
    assert "elasticsearch-dsl" not in constraints


def test_installed_elasticsearch_is_9x_when_present() -> None:
    try:
        version = importlib.metadata.version("elasticsearch")
    except importlib.metadata.PackageNotFoundError:
        pytest.skip("elasticsearch not installed in host venv")
    assert version.startswith("9."), f"host venv elasticsearch must be 9.x, got {version}"


def _load_elasticsearch_service_module() -> Any:
    """Load elasticsearch_service without executing business_intelligence.__init__."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "services" / "business_intelligence" / "elasticsearch_service.py"
    module_name = "_test_elasticsearch_service_isolated"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        msg = f"unable to load elasticsearch_service from {path}"
        raise RuntimeError(msg)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_elasticsearch_service_initialize_ping_and_health(monkeypatch: pytest.MonkeyPatch) -> None:
    es_mod = _load_elasticsearch_service_module()

    mock_client = AsyncMock()
    mock_client.ping = AsyncMock(return_value=True)
    mock_client.cluster.health = AsyncMock(return_value={"status": "green"})
    mock_client.indices.exists = AsyncMock(return_value=True)

    mock_manager = MagicMock()
    mock_manager.get_elasticsearch_client.return_value = mock_client

    async def fake_get_manager() -> MagicMock:
        return mock_manager

    monkeypatch.setattr(es_mod, "get_database_manager", fake_get_manager)

    service = es_mod.ElasticsearchService()
    assert await service.initialize() is True
    mock_client.ping.assert_awaited_once()
    mock_client.cluster.health.assert_awaited_once()


@pytest.mark.asyncio
async def test_elasticsearch_service_search_documents_body_compat() -> None:
    es_mod = _load_elasticsearch_service_module()
    ElasticsearchService = es_mod.ElasticsearchService

    mock_client = AsyncMock()
    mock_client.search = AsyncMock(
        return_value={
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "document_id": "doc-1",
                            "name": "Sample",
                            "content": "hello",
                        }
                    }
                ]
            }
        }
    )

    service = ElasticsearchService()
    service.client = mock_client

    results = await service.search_documents(query="hello", size=5)
    assert len(results) == 1
    assert results[0]["document_id"] == "doc-1"

    call_kwargs: dict[str, Any] = mock_client.search.await_args.kwargs
    assert call_kwargs["index"] == service.DOCUMENTS_INDEX
    assert "body" in call_kwargs
    assert call_kwargs["body"]["query"]["bool"]["must"]
