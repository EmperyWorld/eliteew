# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for S0 runtime remediation: async offload for blocking MinIO listing
# and explicit 503 contract for embedding backend outages.
# Invariants:
# - list_minio_files executes MinIO list/stat calls via asyncio.to_thread.
# - Embedding backend outages raise EmbeddingUnavailableError and map to HTTP 503 in router.
# - Error recovery embedding fallback must not return zero vectors (S0 contract).
# Related:
# - api/services/elite_editor/elite_orchestrator.py
# - api/services/ai_sdk/embedding_service.py
# ---
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

if "numpy" not in sys.modules:
    fake_numpy = ModuleType("numpy")
    fake_numpy.ndarray = list  # type: ignore[attr-defined]
    fake_numpy.array = lambda values: values  # type: ignore[attr-defined]
    fake_numpy.dot = lambda a, b: sum(x * y for x, y in zip(a, b, strict=False))  # type: ignore[attr-defined]
    fake_numpy.linalg = SimpleNamespace(norm=lambda v: max(sum(abs(x) for x in v), 1.0))  # type: ignore[attr-defined]
    sys.modules["numpy"] = fake_numpy

if "api.services.ai_sdk.llama_provider_service" not in sys.modules:
    fake_llama_module = ModuleType("api.services.ai_sdk.llama_provider_service")

    class _FakeLlamaProviderService:
        async def embed(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            msg = "stub embed should be monkeypatched in tests"
            raise RuntimeError(msg)

    fake_llama_module.LlamaProviderService = _FakeLlamaProviderService  # type: ignore[attr-defined]
    sys.modules["api.services.ai_sdk.llama_provider_service"] = fake_llama_module

if "multipart" not in sys.modules:
    fake_multipart = ModuleType("multipart")
    fake_multipart.__version__ = "0.0-test"  # type: ignore[attr-defined]
    fake_multipart_sub = ModuleType("multipart.multipart")
    fake_multipart_sub.parse_options_header = (  # type: ignore[attr-defined]
        lambda value: ("form-data", {"name": "file"})  # noqa: ARG005
    )
    sys.modules["multipart"] = fake_multipart
    sys.modules["multipart.multipart"] = fake_multipart_sub

from api.services.ai_sdk.embedding_service import EmbeddingService, EmbeddingUnavailableError
from api.services.ai_sdk.simple_cache_service import simple_cache_service as ai_sdk_cache_service


@pytest.mark.unit
def test_list_minio_files_uses_to_thread_in_source_contract() -> None:
    source = Path("services/elite_editor/elite_orchestrator.py").read_text(encoding="utf-8")
    assert "await asyncio.to_thread(_list_objects_sync)" in source
    assert "await asyncio.to_thread(minio_client.stat_object, bucket, obj.object_name)" in source


@pytest.mark.unit
def test_embed_text_raises_typed_unavailable_error(monkeypatch: pytest.MonkeyPatch) -> None:
    service = EmbeddingService()

    async def _cache_get(_namespace: str, _action: str, _key: str):  # type: ignore[no-untyped-def]
        return None

    async def _fail_embed(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise ConnectionError("embedding backend down")

    monkeypatch.setattr(ai_sdk_cache_service.cache_manager, "get", _cache_get)
    monkeypatch.setattr(service.llama_service, "embed", _fail_embed)

    async def _run() -> None:
        with pytest.raises(EmbeddingUnavailableError) as exc_info:
            await service.embed_text("hello world", model="nomic-embed-text")
        exc = exc_info.value
        assert exc.reason == "embedding_backend_unavailable"
        assert exc.model == "nomic-embed-text"
        assert exc.text_length == len("hello world")

    asyncio.run(_run())
