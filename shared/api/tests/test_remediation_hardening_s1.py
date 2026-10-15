# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Focused S1 hardening regression tests: payload bounds, lazy Seaweed init contract,
# and bounded retry behavior for embed/rerank HTTP flows.
# Invariants:
# - EmbedManyRequest rejects oversized payloads before service calls.
# - SeaweedFSStorage constructor keeps network checks lazy.
# - chat_memory/rerank retries are bounded and recover on transient failures.
# Related:
# - api/services/unified_content/storage_backends/minio_storage.py
# - api/services/chat_memory_service.py
# - api/services/rerank_client.py
# ---
from __future__ import annotations

import asyncio
import importlib
import sys
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType, SimpleNamespace
from uuid import uuid4

import pytest

ARCHIVED_AI_SDK_EMBEDDINGS = Path(
    "/home/owned/trash_all/eliteew-api-dead-code-2026-06-22/shared/api/routers/ai_sdk/embeddings.py"
)


@pytest.mark.unit
def test_archived_ai_sdk_embed_many_request_has_batch_bounds_contract() -> None:
    if not ARCHIVED_AI_SDK_EMBEDDINGS.is_file():
        pytest.skip("unregistered ai_sdk embeddings router archived outside repo")
    source = ARCHIVED_AI_SDK_EMBEDDINGS.read_text(encoding="utf-8")
    assert "MAX_EMBED_BATCH_TOTAL_CHARS = 200_000" in source
    assert "class EmbedManyRequest" in source
    assert "@model_validator" in source


@pytest.mark.unit
def test_seaweed_storage_constructor_has_no_eager_network_calls() -> None:
    source = Path("services/unified_content/storage_backends/minio_storage.py").read_text(encoding="utf-8")
    constructor_section = source.split("def _get_init_lock", maxsplit=1)[0]
    assert "self.client.list_buckets()" not in constructor_section
    assert "self._ensure_bucket()" not in constructor_section
    assert "async def _ensure_initialized" in source


@pytest.mark.unit
def test_seaweed_retrieve_internal_error_maps_to_corrupted(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.unified_content.storage_backends.minio_storage as seaweed_module  # noqa: PLC0415

    class _FakeS3Error(Exception):
        def __init__(self, code: str, message: str) -> None:
            super().__init__(message)
            self.code = code
            self.message = message

    class _FailingClient:
        def get_object(self, _bucket: str, _object_name: str) -> object:
            raise _FakeS3Error("InternalError", "We encountered an internal error, please try again.")

    async def _noop_init() -> None:
        return None

    storage = object.__new__(seaweed_module.SeaweedFSStorage)
    storage._ensure_initialized = _noop_init  # type: ignore[attr-defined]
    storage.read_client = _FailingClient()  # type: ignore[attr-defined]
    storage.fast_client = _FailingClient()  # type: ignore[attr-defined]

    monkeypatch.setattr(seaweed_module, "S3Error", _FakeS3Error)
    with pytest.raises(seaweed_module.SeaweedFileCorruptedError):
        asyncio.run(
            storage.retrieve(
                f"unified-content/{uuid4()}/asset.bin",
                uuid4(),
                fail_fast=True,
            )
        )


@pytest.mark.unit
def test_seaweed_retrieve_no_such_key_maps_to_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.unified_content.storage_backends.minio_storage as seaweed_module  # noqa: PLC0415

    class _FakeS3Error(Exception):
        def __init__(self, code: str, message: str) -> None:
            super().__init__(message)
            self.code = code
            self.message = message

    class _FailingClient:
        def get_object(self, _bucket: str, _object_name: str) -> object:
            raise _FakeS3Error("NoSuchKey", "The specified key does not exist.")

    async def _noop_init() -> None:
        return None

    storage = object.__new__(seaweed_module.SeaweedFSStorage)
    storage._ensure_initialized = _noop_init  # type: ignore[attr-defined]
    storage.read_client = _FailingClient()  # type: ignore[attr-defined]
    storage.fast_client = _FailingClient()  # type: ignore[attr-defined]

    monkeypatch.setattr(seaweed_module, "S3Error", _FakeS3Error)
    with pytest.raises(seaweed_module.SeaweedFileNotFoundError):
        asyncio.run(
            storage.retrieve(
                f"unified-content/{uuid4()}/asset.bin",
                uuid4(),
                fail_fast=True,
            )
        )


@pytest.mark.unit
def test_seaweed_retrieve_service_unavailable_maps_to_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.unified_content.storage_backends.minio_storage as seaweed_module  # noqa: PLC0415

    class _FakeS3Error(Exception):
        def __init__(self, code: str, message: str) -> None:
            super().__init__(message)
            self.code = code
            self.message = message

    class _FailingClient:
        def get_object(self, _bucket: str, _object_name: str) -> object:
            raise _FakeS3Error("ServiceUnavailable", "Temporarily unavailable.")

    async def _noop_init() -> None:
        return None

    storage = object.__new__(seaweed_module.SeaweedFSStorage)
    storage._ensure_initialized = _noop_init  # type: ignore[attr-defined]
    storage.read_client = _FailingClient()  # type: ignore[attr-defined]
    storage.fast_client = _FailingClient()  # type: ignore[attr-defined]

    monkeypatch.setattr(seaweed_module, "S3Error", _FakeS3Error)
    with pytest.raises(seaweed_module.SeaweedStorageUnavailableError):
        asyncio.run(
            storage.retrieve(
                f"unified-content/{uuid4()}/asset.bin",
                uuid4(),
                fail_fast=True,
            )
        )


@pytest.mark.unit
def test_chat_memory_embed_retries_transient_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_llm_compat = ModuleType("api.utils.llm_openai_compat_http")

    async def _placeholder(*args, **kwargs):  # type: ignore[no-untyped-def]
        return {"embeddings": []}

    fake_llm_compat.aiohttp_compat_embeddings_dict = _placeholder  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "api.utils.llm_openai_compat_http", fake_llm_compat)

    import api.services.chat_memory_service as chat_memory_module  # noqa: PLC0415

    chat_memory_module = importlib.reload(chat_memory_module)
    dim = chat_memory_module._embedding_dim()
    attempts = {"count": 0}

    class _FakeClientTimeout:
        def __init__(self, total: float):
            self.total = total

    class _FakeClientSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

    async def _fake_embeddings_dict(*args, **kwargs):  # type: ignore[no-untyped-def]
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise ConnectionError("temporary embed outage")
        return {"embeddings": [[0.01] * dim]}

    async def _no_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr(
        chat_memory_module,
        "aiohttp",
        SimpleNamespace(ClientTimeout=_FakeClientTimeout, ClientSession=lambda: _FakeClientSession()),
    )
    monkeypatch.setattr(chat_memory_module, "aiohttp_compat_embeddings_dict", _fake_embeddings_dict)
    monkeypatch.setattr(chat_memory_module.asyncio, "sleep", _no_sleep)

    result = asyncio.run(chat_memory_module._get_embedding("resilient memory probe"))
    assert isinstance(result, list)
    assert len(result) == dim
    assert attempts["count"] == 3


@pytest.mark.unit
def test_rerank_client_retries_retryable_status(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_marketing_module = ModuleType("api.services.marketing_project_rag_service")

    @dataclass
    class MarketingRagChunk:
        text: str
        score: float = 0.0
        ordinal: int = 0

    fake_marketing_module.MarketingRagChunk = MarketingRagChunk  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "api.services.marketing_project_rag_service", fake_marketing_module)

    import api.services.rerank_client as rerank_module  # noqa: PLC0415

    rerank_module = importlib.reload(rerank_module)
    monkeypatch.setattr(rerank_module, "unified_settings", SimpleNamespace(rag_rerank_base_url="http://rerank.test"))
    attempts = {"count": 0}

    class _FakeResponse:
        def __init__(self, status_code: int, payload: dict[str, object], text: str = "") -> None:
            self.status_code = status_code
            self._payload = payload
            self.text = text

        def json(self) -> dict[str, object]:
            return self._payload

    class _FakeAsyncClient:
        def __init__(self, timeout: float):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def post(self, url: str, json: dict[str, object]):  # noqa: A002
            del url, json
            attempts["count"] += 1
            if attempts["count"] < 3:
                return _FakeResponse(status_code=503, payload={}, text="temporarily unavailable")
            return _FakeResponse(
                status_code=200,
                payload={"results": [{"index": 0, "relevance_score": 0.91}]},
            )

    async def _no_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr(rerank_module.httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(rerank_module.asyncio, "sleep", _no_sleep)

    result = asyncio.run(rerank_module.rerank_by_index("q", ["doc"], timeout=1.0))
    assert result == [(0, 0.91)]
    assert attempts["count"] == 3
