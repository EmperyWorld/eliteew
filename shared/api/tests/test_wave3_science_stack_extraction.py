# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: Wave 3 Task 2.S — heavy science stack absent from stack0-api venv.
# Invariants:
# - api.lock excludes numpy/scipy/pandas/opencv/sklearn/matplotlib/seaborn.
# - queue-worker.lock includes science stack deps.
# Related:
# - api/services/science_stack/science_client.py
# ---
from __future__ import annotations

import importlib
import importlib.util
import wave
from io import BytesIO
from pathlib import Path

import pytest

_API_LOCK_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docker/builders/stack0-api/requirements/locks/api.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/api.lock"),
)
_QUEUE_LOCK_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docker/builders/stack0-api/requirements/locks/queue-worker.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/queue-worker.lock"),
)

_HEAVY_LOCK_PREFIXES = (
    "numpy==",
    "scipy==",
    "pandas==",
    "opencv-python==",
    "scikit-learn==",
    "matplotlib==",
    "seaborn==",
)

_HEAVY_IMPORT_MODULES = (
    "cv2",
    "pandas",
    "scipy",
    "sklearn",
    "matplotlib",
    "seaborn",
)

# numpy may remain transitively via qdrant-client / soundfile — tracked as follow-up (Wave 3+).
_NUMPY_TRANSITIVE_ALLOWED = True


def _first_existing(candidates: tuple[Path, ...]) -> Path | None:
    for path in candidates:
        if path.is_file():
            return path
    return None


def test_api_lock_excludes_heavy_science_stack() -> None:
    api_lock = _first_existing(_API_LOCK_CANDIDATES)
    if api_lock is None:
        pytest.skip("api.lock not available in this runtime")
    lock_text = api_lock.read_text(encoding="utf-8")
    for banned in _HEAVY_LOCK_PREFIXES:
        assert banned not in lock_text, f"{banned} must be absent from api.lock"


def test_queue_worker_lock_includes_science_stack() -> None:
    queue_lock = _first_existing(_QUEUE_LOCK_CANDIDATES)
    if queue_lock is None:
        pytest.skip("queue-worker.lock not available in this runtime")
    lock_text = queue_lock.read_text(encoding="utf-8")
    for required in ("numpy==", "scipy==", "scikit-learn=="):
        assert required in lock_text, f"{required} must remain on queue-worker.lock"


@pytest.mark.parametrize("module_name", _HEAVY_IMPORT_MODULES)
def test_heavy_module_not_installed(module_name: str) -> None:
    spec = importlib.util.find_spec(module_name)
    assert spec is None, f"{module_name} must be absent from stack0-api venv"


def test_numpy_transitive_dependency_documented() -> None:
    """numpy may still be installed transitively (qdrant-client, soundfile) — follow-up to eliminate."""
    spec = importlib.util.find_spec("numpy")
    if spec is None:
        return
    assert _NUMPY_TRANSITIVE_ALLOWED, "numpy transitive presence should be eliminated in a follow-up wave"


def test_embedding_cosine_similarity_without_numpy() -> None:
    from api.services.ai_sdk.embedding_service import EmbeddingService

    service = EmbeddingService()
    sim = service.cosine_similarity([1.0, 0.0], [1.0, 0.0])
    assert sim == pytest.approx(1.0)


def test_wav_merge_int16_chunks_stdlib() -> None:
    from api.utils.wav_merge import merge_wav_int16_chunks

    def _mini_wav(sample: int) -> bytes:
        buf = BytesIO()
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(int(sample).to_bytes(2, "little", signed=True))
        return buf.getvalue()

    merged = merge_wav_int16_chunks([_mini_wav(100), _mini_wav(200)])
    with wave.open(BytesIO(merged), "rb") as wav:
        assert wav.getnframes() > 1


@pytest.mark.asyncio
async def test_science_client_semantic_analyze_posts(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.science_stack import science_client as client_mod

    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "key_terms": ["alpha"],
                "coherence": 0.8,
                "sentence_count": 2,
                "confidence": 0.9,
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> FakeAsyncClient:
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url: str, json: dict) -> FakeResponse:
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(client_mod, "science_stack_service_url", lambda: "http://science-sidecar:8096")
    monkeypatch.setattr(client_mod.httpx, "AsyncClient", FakeAsyncClient)

    result = await client_mod.request_semantic_analyze("hello world. second sentence.")
    assert result is not None
    assert result["key_terms"] == ["alpha"]
    assert captured["url"] == "http://science-sidecar:8096/v1/science/semantic-analyze"
