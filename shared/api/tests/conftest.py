"""Load stack0 backend env for local pytest so `api.*` imports resolve (DatabaseConfig, unified_config)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

# .env.stack0.backend is merged with compose `environment:`; these match .env.example for missing keys.
_FALLBACKS: dict[str, str] = {
    "MINIO_HOST": "stack1-seaweedfs",
    "POSTGRES_EXTERNAL_PORT": "30000",
    "REDIS_EXTERNAL_PORT": "30001",
    "ELASTICSEARCH_EXTERNAL_PORT": "30007",
    "CHROMADB_CONTAINER_NAME": "stack1-chroma",
    "CHROMADB_HOST": "stack1-chroma",
    "CHROMADB_EXTERNAL_HOST": "127.0.0.1",
    "CHROMADB_PORT": "8000",
    "CHROMADB_EXTERNAL_PORT": "30002",
    "MINIO_PORT": "8333",
    "MINIO_EXTERNAL_PORT": "30006",
    "MINIO_CONSOLE_PORT": "30005",
    "RABBITMQ_CONTAINER_NAME": "stack1-rabbitmq",
    "RABBITMQ_HOST": "stack1-rabbitmq",
    "RABBITMQ_EXTERNAL_HOST": "127.0.0.1",
    "RABBITMQ_PORT": "5672",
    "RABBITMQ_EXTERNAL_PORT": "30008",
    "RABBITMQ_MANAGEMENT_PORT": "30009",
    "RABBITMQ_MANAGEMENT_INTERNAL_PORT": "15672",
    "RABBITMQ_VHOST": "/",
    "QDRANT_CONTAINER_NAME": "stack1-qdrant",
    "QDRANT_HOST": "stack1-qdrant",
    "QDRANT_EXTERNAL_HOST": "127.0.0.1",
    "QDRANT_PORT": "6333",
    "QDRANT_EXTERNAL_PORT": "30003",
    "QDRANT_GRPC_PORT": "30004",
    # Llama / embeddings: обязательны для unified_config без захардкоженных дефолтов в коде
    "LLAMA_URL": "http://127.0.0.1:11434",
    "LLAMA_MODEL": "test/llama-dummy:latest",
    "LLAMA_EMBEDDING_MODEL": "nomic-embed-text:latest",
    "MARKETING_CABINET_ROUTER_MODEL": "functiongemma:latest",
}


def _configure_test_env() -> None:
    if os.environ.get("ELITEEW_PYTEST_STACK0_ENV") == "1":
        return
    repo_root = Path(__file__).resolve().parents[3]
    env_path = repo_root / "docker" / "env_file" / ".env.stack0.backend"
    if env_path.is_file():
        try:
            from dotenv import load_dotenv

            load_dotenv(env_path, override=False)
        except ImportError:
            pass
    for key, val in _FALLBACKS.items():
        os.environ.setdefault(key, val)
    os.environ["ELITEEW_PYTEST_STACK0_ENV"] = "1"


# Run at conftest import time so env exists before test modules import `api.*` (DatabaseConfig).
_configure_test_env()


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as a coroutine executed via asyncio.run (pytest-asyncio-compatible)",
    )


def pytest_pyfunc_call(pyfuncitem: pytest.Function) -> bool | None:
    """Run ``@pytest.mark.asyncio`` coroutine tests without requiring pytest-asyncio."""

    import asyncio
    import inspect

    testfunction = pyfuncitem.obj
    if not inspect.iscoroutinefunction(testfunction):
        return None
    if not any(mark.name == "asyncio" for mark in pyfuncitem.iter_markers()):
        return None
    funcargs = {name: pyfuncitem.funcargs[name] for name in pyfuncitem._fixtureinfo.argnames}
    asyncio.run(testfunction(**funcargs))
    return True
