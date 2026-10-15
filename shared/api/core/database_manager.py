# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Centralized infra connection manager for API runtime (PostgreSQL, Redis, Elasticsearch, Qdrant, SeaweedFS, RabbitMQ).
# Invariants:
# - Qdrant is the vector backend; ChromaDB client package is not installed in stack0-api.
# - Celery loop resets drop stale loop-bound pools without surfacing recovered cleanup as ERROR.
# - After a loop reset, shared HTTP clients are re-initialized on the current loop (companion music / Llama title path).
# - ES soft-reconnect is rate-limited; timeouts/retries come from infra_client_timeouts env knobs.
# - elastic_transport.ConnectionTimeout is NOT a builtin TimeoutError — health checks must catch it
#   (or broader Exception) or Celery workers keep a dead AsyncElasticsearch client for minutes.
# - Builtin/asyncio TimeoutError on health: drop client, do not soft-reconnect inline (cancelled
#   wait_for can poison aiohttp); reconnect on the next monitor cycle when client is missing.
# - Celery prefork: do not start ``_health_monitor_loop`` — wait_for deadlines are monotonic and
#   expire while the loop is stopped between ``run_celery_async`` calls (false ES down on one worker).
# - encryption.pii_key: SET SESSION on SQLAlchemy pool connect (pii_session.register_*); session
#   open must not soft-skip yield without key (DB_PITFALLS §3 / Wave 2 fail-closed).
# - When PostgreSQL is enabled but SQLAlchemy asyncio deps are missing (e.g. no greenlet),
#   ``get_health_summary`` reports overall unhealthy — never ok:true via Redis-only paths.
# Related:
# - api/services/unified_content/semantic_search_service.py
# - api/services/document_service.py
# - api/core/infra_client_timeouts.py
# - api/core/pii_session.py
# ---
from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, ClassVar, Protocol
from urllib.parse import quote as urlquote
from urllib.parse import urlparse

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from elasticsearch import AsyncElasticsearch  # type: ignore[attr-defined,import-not-found]
    from minio import Minio  # type: ignore[import-not-found]
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.infra_client_timeouts import (
    elasticsearch_resilience_settings,
    filter_supported_kwargs,
    rabbitmq_connection_resilience_settings,
)
from api.core.unified_config import unified_settings


class TerminableAsyncpgPool(Protocol):
    """asyncpg pool surface used by DatabaseManager cleanup (terminate on loop reset)."""

    def terminate(self) -> None: ...


# Initialize availability flags (using lowercase for internal flags)
_postgres_available = False
_redis_available = False
_elasticsearch_available = False
_minio_available = False
_rabbitmq_available = False
_qdrant_available = False

# Database specific imports with granular dependency checking
# Initialize with False, will be set in try/except blocks
POSTGRES_AVAILABLE: bool = False
REDIS_AVAILABLE: bool = False
ELASTICSEARCH_AVAILABLE: bool = False
CHROMADB_AVAILABLE: bool = False  # stack0-api: chromadb package removed; use Qdrant
MINIO_AVAILABLE: bool = False
RABBITMQ_AVAILABLE: bool = False
QDRANT_AVAILABLE: bool = False

try:
    from sqlalchemy import text  # type: ignore[import-not-found]
    from sqlalchemy.exc import MissingGreenlet  # type: ignore[import-not-found]
    from sqlalchemy.ext.asyncio import (  # type: ignore[import-not-found]
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )

    _postgres_available = True
    POSTGRES_AVAILABLE = True  # type: ignore[assignment,no-redef]
except ImportError as e:
    logging.warning("PostgreSQL dependencies not available: %s", e)
    MissingGreenlet = RuntimeError  # type: ignore[assignment,misc]
    text = None  # type: ignore[assignment, misc]
    POSTGRES_AVAILABLE = False  # type: ignore[assignment,no-redef]

try:
    import redis.asyncio as aioredis  # type: ignore[reportMissingModuleSource]  # pyright: ignore[reportMissingModuleSource]

    _redis_available = True
    REDIS_AVAILABLE = True  # type: ignore[assignment,no-redef]
except ImportError as e:
    logging.warning("Redis dependencies not available: %s", e)
    REDIS_AVAILABLE = False  # type: ignore[assignment,no-redef]

try:
    from elasticsearch import AsyncElasticsearch  # type: ignore[attr-defined,import-not-found]

    _elasticsearch_available = True
    ELASTICSEARCH_AVAILABLE = True  # type: ignore[assignment,no-redef]
except ImportError as e:
    # Slim images (e.g. site-studio-worker) omit elasticsearch; full API includes it.
    logging.debug("Elasticsearch client not installed: %s", e)
    ELASTICSEARCH_AVAILABLE = False  # type: ignore[assignment,no-redef]

try:
    from minio import Minio  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]  # noqa: I001

    _minio_available = True
    MINIO_AVAILABLE = True  # type: ignore[assignment,no-redef]
except ImportError as e:
    logging.warning("MinIO dependencies not available: %s", e)
    MINIO_AVAILABLE = False  # type: ignore[assignment,no-redef]

try:
    import aio_pika  # type: ignore[import-not-found]

    _rabbitmq_available = True
    RABBITMQ_AVAILABLE = True  # type: ignore[assignment,no-redef]
except ImportError as e:
    logging.warning("RabbitMQ dependencies not available: %s", e)
    RABBITMQ_AVAILABLE = False  # type: ignore[assignment,no-redef]

try:
    import importlib.util

    if importlib.util.find_spec("qdrant_client") is not None:
        _qdrant_available = True
        QDRANT_AVAILABLE = True  # type: ignore[assignment,no-redef]
    else:
        QDRANT_AVAILABLE = False  # type: ignore[assignment,no-redef]
except ImportError as e:
    logging.warning("Qdrant dependencies not available: %s", e)
    QDRANT_AVAILABLE = False  # type: ignore[assignment,no-redef]

# Core dependencies available if at least PostgreSQL or Redis is available
CORE_DEPENDENCIES_AVAILABLE = POSTGRES_AVAILABLE or REDIS_AVAILABLE

logger = logging.getLogger(__name__)


# ========================================
# Migrated from database_config.py
# ========================================


class DatabaseType(StrEnum):
    POSTGRESQL = "postgresql"
    REDIS = "redis"
    ELASTICSEARCH = "elasticsearch"
    CHROMADB = "chromadb"
    MINIO = "minio"
    RABBITMQ = "rabbitmq"
    QDRANT = "qdrant"


def _require_env(key: str) -> str:
    """Обязательная переменная окружения (передаётся при запуске, путь к файлу не в репозитории)."""
    val = os.environ.get(key)
    if val is None or str(val).strip() == "":
        raise ValueError(f"Required env var not set: {key}. Set it in your environment.")
    return val.strip()


def _require_env_int(key: str) -> int:
    val = _require_env(key)
    try:
        return int(val)
    except ValueError as e:
        raise ValueError(f"Env var {key} must be an integer, got: {val!r}") from e


class DatabaseConfig:
    # Хосты и порты только из окружения (передаются при запуске через --env-file и т.п.).
    STACK1_NETWORK: ClassVar[str] = _require_env("DOCKER_NETWORK")
    STACK1_HOST_IP: ClassVar[str] = _require_env("HOST_IP")

    _postgres_service: ClassVar[Any] = unified_settings.postgres
    _redis_service: ClassVar[Any] = unified_settings.redis
    _elasticsearch_service: ClassVar[Any] = unified_settings.elasticsearch
    _minio_service: ClassVar[Any] = unified_settings.minio

    POSTGRES_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _postgres_service.container_name,
        "internal_host": _require_env("POSTGRES_HOST"),
        "external_host": _require_env("HOST_IP"),
        "internal_port": _require_env_int("POSTGRES_PORT"),
        "external_port": _require_env_int("POSTGRES_EXTERNAL_PORT"),
        "database": unified_settings.database_name,
        "username": unified_settings.database_user,
        "password": unified_settings.database_password,
        "driver": "postgresql+asyncpg",
        "pool_size": 10,
        "max_overflow": 15,
        "pool_timeout": 30,
        "pool_recycle": 3600,
        "echo": False,
        "description": "Main PostgreSQL database for structured data",
    }

    @classmethod
    def get_postgres_config(cls) -> dict[str, Any]:
        """Connection dict including pool sizes from unified_settings (env POSTGRES_POOL_*)."""
        cfg = dict(cls.POSTGRES_CONFIG)
        cfg["pool_size"] = unified_settings.postgres_pool_size
        cfg["max_overflow"] = unified_settings.postgres_max_overflow
        cfg["pool_timeout"] = unified_settings.postgres_pool_timeout
        cfg["pool_recycle"] = unified_settings.postgres_pool_recycle
        return cfg

    REDIS_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _redis_service.container_name,
        "internal_host": _require_env("REDIS_HOST"),
        "external_host": _require_env("HOST_IP"),
        "internal_port": _require_env_int("REDIS_PORT"),
        "external_port": _require_env_int("REDIS_EXTERNAL_PORT"),
        "password": unified_settings.redis_password,
        "database": unified_settings.redis_db,
        "pool_size": 50,
        "max_connections": 100,
        "socket_timeout": 5,
        "socket_connect_timeout": 5,
        "health_check_interval": 0,  # avoid RecursionError in redis-py asyncio
        "retry_on_timeout": False,
        "description": "Redis for caching, sessions, and real-time data",
    }

    ELASTICSEARCH_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _elasticsearch_service.container_name,
        "internal_host": _require_env("ELASTICSEARCH_HOST"),
        "external_host": _require_env("HOST_IP"),
        "internal_port": _require_env_int("ELASTICSEARCH_PORT"),
        "external_port": _require_env_int("ELASTICSEARCH_EXTERNAL_PORT"),
        "username": unified_settings.elasticsearch_user,
        "password": unified_settings.elasticsearch_password,
        "scheme": "http",
        "verify_certs": False,
        **elasticsearch_resilience_settings(),
        "indices": {
            "documents": "eliteew_documents",
            "logs": "eliteew_logs",
            "chats": "eliteew_chats",
            "metrics": "eliteew_metrics",
        },
        "description": "Elasticsearch for full-text search and log aggregation",
    }

    CHROMADB_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _require_env("CHROMADB_CONTAINER_NAME"),
        "internal_host": _require_env("CHROMADB_HOST"),
        "external_host": _require_env("CHROMADB_EXTERNAL_HOST"),
        "internal_port": _require_env_int("CHROMADB_PORT"),
        "external_port": _require_env_int("CHROMADB_EXTERNAL_PORT"),
        "scheme": "http",
        "collections": {
            "documents": "document_embeddings",
            "chats": "chat_embeddings",
            "knowledge": "ai_knowledge_base",
            "code": "code_embeddings",
        },
        "embedding_dimension": 1536,
        "distance_metric": "cosine",
        "description": "ChromaDB for AI embeddings and semantic search",
    }

    MINIO_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _minio_service.container_name,
        "internal_host": _require_env("MINIO_HOST"),
        "external_host": _require_env("HOST_IP"),
        "internal_port": _require_env_int("MINIO_PORT"),
        "external_port": _require_env_int("MINIO_EXTERNAL_PORT"),
        "console_port": _require_env_int("MINIO_CONSOLE_PORT"),
        "access_key": unified_settings.minio_access_key,
        "secret_key": unified_settings.minio_secret_key,
        "secure": unified_settings.minio_secure,
        "endpoint_url": unified_settings.minio_endpoint,
        "region": unified_settings.aws_s3_region,
        "buckets": {
            "documents": "eliteew-documents",
            "images": "eliteew-images",
            "backups": "eliteew-backups",
            "logs": "eliteew-logs",
        },
        "description": "SeaweedFS S3-compatible object storage for files (replaced MinIO)",
    }
    SEAWEEDFS_CONFIG = MINIO_CONFIG

    RABBITMQ_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _require_env("RABBITMQ_CONTAINER_NAME"),
        "internal_host": _require_env("RABBITMQ_HOST"),
        "external_host": _require_env("RABBITMQ_EXTERNAL_HOST"),
        "internal_port": _require_env_int("RABBITMQ_PORT"),
        "external_port": _require_env_int("RABBITMQ_EXTERNAL_PORT"),
        "management_port": _require_env_int("RABBITMQ_MANAGEMENT_PORT"),
        # In-stack management API (15672); external_host health uses management_port (host map).
        "management_internal_port": int((os.environ.get("RABBITMQ_MANAGEMENT_INTERNAL_PORT") or "15672").strip()),
        "username": _require_env("RABBITMQ_USER"),
        "password": os.environ.get("RABBITMQ_PASSWORD", ""),
        "virtual_host": _require_env("RABBITMQ_VHOST"),
        **rabbitmq_connection_resilience_settings(),
        "exchanges": {
            "ai_tasks": "ai.tasks.exchange",
            "documents": "documents.exchange",
            "notifications": "notifications.exchange",
        },
        "queues": {
            "ai_generation": "ai.generation.queue",
            "document_processing": "documents.processing.queue",
            "notifications": "notifications.queue",
            "site_studio": "site-studio.runtime.queue",
        },
        "description": "RabbitMQ for background task processing",
    }

    QDRANT_CONFIG: ClassVar[dict[str, Any]] = {
        "container_name": _require_env("QDRANT_CONTAINER_NAME"),
        "internal_host": _require_env("QDRANT_HOST"),
        "external_host": _require_env("QDRANT_EXTERNAL_HOST"),
        "internal_port": _require_env_int("QDRANT_PORT"),
        "external_port": _require_env_int("QDRANT_EXTERNAL_PORT"),
        "grpc_port": _require_env_int("QDRANT_GRPC_PORT"),
        "api_key": os.environ.get("QDRANT_API_KEY") or None,
        "collections": {
            "documents": "eliteew_documents",
            "similarity": "similarity_search",
            "clustering": "content_clustering",
        },
        "vector_size": 1536,
        "distance": "Cosine",
        "description": "Qdrant primary vector database for semantic search and embeddings",
    }

    @classmethod
    def get_postgres_url(cls, *, internal: bool = True) -> str:
        """PostgreSQL connection URL."""
        config = cls.get_postgres_config()
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]

        return f"{config['driver']}://{config['username']}:{config['password']}@{host}:{port}/{config['database']}"

    @classmethod
    def get_redis_url(cls, *, internal: bool = True, db: int | None = None) -> str:
        """Redis connection URL. If db is None, use REDIS_CONFIG['database']."""
        config = cls.REDIS_CONFIG
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]
        password = config.get("password", "")
        db_num = config["database"] if db is None else db

        # Include password if configured (Redis requires authentication)
        if password:
            return f"redis://:{password}@{host}:{port}/{db_num}"
        return f"redis://{host}:{port}/{db_num}"

    @classmethod
    def get_elasticsearch_url(cls, *, internal: bool = True) -> str:
        """Elasticsearch connection URL."""
        config = cls.ELASTICSEARCH_CONFIG
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]

        return f"{config['scheme']}://{host}:{port}"

    @classmethod
    def get_chromadb_url(cls, *, internal: bool = True) -> str:
        """ChromaDB connection URL."""
        config = cls.CHROMADB_CONFIG
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]

        return f"{config['scheme']}://{host}:{port}"

    @classmethod
    def get_minio_endpoint(cls, *, internal: bool = True) -> str:
        """SeaweedFS S3 endpoint (backward compatibility: method name kept)."""
        config = cls.MINIO_CONFIG
        endpoint_url = config.get("endpoint_url")
        if endpoint_url:
            endpoint_str = str(endpoint_url) if endpoint_url is not None else ""
            parsed = urlparse(endpoint_str)
            if parsed.netloc:
                return str(parsed.netloc)
            stripped = endpoint_str.replace("https://", "").replace("http://", "")
            if stripped:
                return str(stripped)
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]

        return f"{host}:{port}"

    @classmethod
    def get_qdrant_url(cls, *, internal: bool = True) -> str:
        """Qdrant HTTP endpoint URL."""
        config = cls.QDRANT_CONFIG
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]
        return f"http://{host}:{port}"

    @classmethod
    def get_rabbitmq_url(cls, *, internal: bool = True) -> str:
        """RabbitMQ connection URL. Uses RABBITMQ_URL if set, else RABBITMQ_USER/RABBITMQ_PASSWORD from env (same as broker)."""
        env_url = os.environ.get("RABBITMQ_URL")
        if env_url:
            return env_url
        config = cls.RABBITMQ_CONFIG
        host = config["internal_host"] if internal else config["external_host"]
        port = config["internal_port"] if internal else config["external_port"]
        username = os.environ.get("RABBITMQ_USER", config["username"])
        password = os.environ.get("RABBITMQ_PASSWORD", config["password"])
        vhost = config["virtual_host"]
        # Quote user/password so special chars (e.g. ':') don't break URL parsing
        username_enc = urlquote(str(username), safe="")
        password_enc = urlquote(str(password), safe="")
        return f"amqp://{username_enc}:{password_enc}@{host}:{port}{vhost}"

    @classmethod
    def get_all_health_endpoints(cls, *, internal: bool = True) -> dict[str, str]:
        """Health check endpoints."""
        return {
            "postgresql": f"{cls.get_postgres_url(internal=internal)}/health",
            "redis": f"{cls.get_redis_url(internal=internal)}/ping",
            "elasticsearch": f"{cls.get_elasticsearch_url(internal=internal)}/_health",
            "qdrant": f"{cls.get_qdrant_url(internal=internal)}/collections",
            "minio": f"http://{cls.get_minio_endpoint(internal=internal)}/",
            "rabbitmq": f"http://{cls.RABBITMQ_CONFIG['external_host']}:{cls.RABBITMQ_CONFIG['management_port']}/api/healthchecks/node",
        }

    @classmethod
    def get_database_summary(cls) -> dict[str, Any]:
        return {
            "total_databases": 6,
            "databases": {
                "postgresql": {
                    "type": "Relational Database",
                    "usage": "Main application data",
                    "port": cls.POSTGRES_CONFIG["external_port"],
                    "status": "primary",
                },
                "redis": {
                    "type": "In-Memory Cache",
                    "usage": "Caching and sessions",
                    "port": cls.REDIS_CONFIG["external_port"],
                    "status": "primary",
                },
                "elasticsearch": {
                    "type": "Search Engine",
                    "usage": "Full-text search and logs",
                    "port": cls.ELASTICSEARCH_CONFIG["external_port"],
                    "status": "primary",
                },
                "qdrant": {
                    "type": "Vector Database",
                    "usage": "Semantic search and embedding storage",
                    "port": cls.QDRANT_CONFIG["external_port"],
                    "status": "primary",
                },
                "minio": {
                    "type": "Object Storage",
                    "usage": "File storage (S3-compatible)",
                    "port": cls.MINIO_CONFIG["external_port"],
                    "status": "primary",
                },
                "rabbitmq": {
                    "type": "Message Queue",
                    "usage": "Background task processing",
                    "port": cls.RABBITMQ_CONFIG["external_port"],
                    "status": "primary",
                },
            },
            "network": cls.STACK1_NETWORK,
            "host": cls.STACK1_HOST_IP,
        }


class DatabaseFeatures:
    # Core databases (always enabled)
    ENABLE_POSTGRESQL = True
    ENABLE_REDIS = True

    # Search and analytics (can be disabled for development)
    ENABLE_ELASTICSEARCH = True

    # AI and ML features (can be disabled if no AI workload)
    ENABLE_CHROMADB = False  # Legacy fallback only; must not be required in startup path
    ENABLE_QDRANT = os.environ.get("ENABLE_QDRANT", "true").strip().lower() in ("true", "1", "yes")

    # File storage (SeaweedFS S3-compatible, can fallback to local filesystem)
    ENABLE_MINIO = True  # Note: Actually SeaweedFS, kept name for backward compatibility

    # Background processing (can be disabled for simple deployments)
    # Set ENABLE_RABBITMQ=false in env to skip RabbitMQ (e.g. if broker auth fails or not used)
    ENABLE_RABBITMQ = os.environ.get("ENABLE_RABBITMQ", "true").strip().lower() in ("true", "1", "yes")

    @classmethod
    def get_enabled_databases(cls) -> list[str]:
        enabled: list[str] = []

        if cls.ENABLE_POSTGRESQL:
            enabled.append("postgresql")
        if cls.ENABLE_REDIS:
            enabled.append("redis")
        if cls.ENABLE_ELASTICSEARCH:
            enabled.append("elasticsearch")
        if cls.ENABLE_CHROMADB:
            enabled.append("chromadb")
        if cls.ENABLE_QDRANT:
            enabled.append("qdrant")
        if cls.ENABLE_MINIO:
            enabled.append("minio")  # Actually SeaweedFS, kept name for backward compatibility
        if cls.ENABLE_RABBITMQ:
            enabled.append("rabbitmq")

        return enabled


# ========================================
# End of migration from database_config.py
# ========================================


class DatabaseConnectionError(Exception):
    pass


class DatabaseHealthStatus:
    def __init__(self, db_type: str, status: str, response_time_ms: float, error: str | None = None):
        self.db_type = db_type
        self.status = status  # 'healthy', 'degraded', 'down'
        self.response_time_ms = response_time_ms
        self.error = error
        self.timestamp = datetime.now(UTC)

    def to_dict(self) -> dict[str, Any]:
        return {
            "db_type": self.db_type,
            "status": self.status,
            "response_time_ms": self.response_time_ms,
            "error": self.error,
            "timestamp": self.timestamp.isoformat(),
        }


class DatabaseManager:
    """Unified database manager.

    This is the **single entry point** for all infrastructure used by the API:
    PostgreSQL, Redis, Elasticsearch, SeaweedFS/Minio, RabbitMQ (and optional
    vector stores like ChromaDB/Qdrant).

    Usage standards (архитектурное соглашение):
    - Все фичи-модули (`routers`/`services`) получают доступ к инфраструктуре
      ТОЛЬКО через `DatabaseManager` и `unified_settings`, а не создают
      свои подключения (`asyncpg.create_pool`, `AsyncElasticsearch`, `Minio`,
      `redis.from_url`, `aio_pika.connect_robust`) напрямую.
    - Для PostgreSQL по умолчанию используем SQLAlchemy `AsyncSession`
      через зависимость `get_postgres_session()`. Если нужен `asyncpg.Pool`
      для спец. задач (bulk-операции, COPY и т.п.), он создаётся и
      переиспользуется здесь, а не в отдельных модулях.
    - Для Redis, Elasticsearch, SeaweedFS/Minio и RabbitMQ клиенты
      создаются и живут здесь, а модули получают их через методы
      `get_redis_client()`, `get_elasticsearch_client()`, `get_minio_client()`,
      `get_rabbitmq_connection()` или их DI-обёртки.
    - Инициализация/закрытие инфраструктуры выполняется централизованно
      в `initialize()` / `close_all_connections()`. Роутеры не должны
      поднимать или останавливать свои собственные клиенты.

    Manages all database connections with:
    - Connection pooling for optimal performance
    - Health monitoring and circuit breaker pattern
    - Graceful degradation when databases are unavailable
    - Automatic retry logic with exponential backoff
    - Real-time connection statistics
    """

    def __init__(self) -> None:
        self.is_initialized = False
        self.health_status: dict[str, DatabaseHealthStatus] = {}
        self.connection_stats = {
            "total_connections": 0,
            "active_connections": 0,
            "failed_connections": 0,
            "last_health_check": None,
        }

        # Database connections (единственные точки владения подключениями)
        self.postgres_engine = None
        self.postgres_session_factory = None
        # Optional low-level asyncpg pool for modules that need asyncpg features.
        # Preferred default is AsyncSession; asyncpg-пул используется ТОЛЬКО там,
        # где это действительно необходимо (bulk, COPY и т.п.).
        self.asyncpg_pool: TerminableAsyncpgPool | None = None
        self.redis_pool = None
        # Per-db Redis pools for modules that need a different Redis DB (e.g. Telegram).
        # Only created via get_redis_client(db=N); same config source as main pool.
        self._redis_pools_by_db: dict[int, Any] = {}
        self.elasticsearch_client = None
        self.chromadb_client = None
        self.minio_client = None
        self.rabbitmq_connection = None
        self.qdrant_client = None
        self._health_task: asyncio.Task[None] | None = None
        # Rate-limit ES soft-reconnect attempts (monotonic seconds).
        self._elasticsearch_soft_reconnect_at: float = 0.0
        # asyncio event loop that owns pooled clients (asyncpg, SQLAlchemy async, redis asyncio, …).
        # Celery tasks use asyncio.run() per task → new loop each time; reuse without reset →
        # "RuntimeError: Event loop is closed" on the second run.
        self._event_loop: asyncio.AbstractEventLoop | None = None

        logger.info("Database Manager instance created")

    async def initialize(self) -> bool:
        """Initialize all database connections.

        Returns:
            True if initialization successful, False otherwise.
        """
        if not CORE_DEPENDENCIES_AVAILABLE:
            logger.error("Core database dependencies not available")
            return False

        logger.info("Initializing database connections...")

        success_count = 0
        total_databases = len(DatabaseFeatures.get_enabled_databases())

        # Initialize each enabled database (only if dependencies are available)
        if DatabaseFeatures.ENABLE_POSTGRESQL and POSTGRES_AVAILABLE and await self._init_postgresql():
            success_count += 1

        if DatabaseFeatures.ENABLE_REDIS and REDIS_AVAILABLE and await self._init_redis():
            success_count += 1

        if DatabaseFeatures.ENABLE_ELASTICSEARCH and ELASTICSEARCH_AVAILABLE and await self._init_elasticsearch():
            success_count += 1

        if DatabaseFeatures.ENABLE_QDRANT and QDRANT_AVAILABLE and await self._init_qdrant():
            success_count += 1

        if DatabaseFeatures.ENABLE_MINIO and MINIO_AVAILABLE and await self._init_minio():
            success_count += 1

        if DatabaseFeatures.ENABLE_RABBITMQ and RABBITMQ_AVAILABLE and await self._init_rabbitmq():
            success_count += 1

        self.is_initialized = success_count > 0

        logger.info(
            "Database initialization complete: %s/%s databases available",
            success_count,
            total_databases,
        )
        # One-line infrastructure summary for operators
        parts = []
        if self.postgres_engine is not None:
            parts.append("postgres=ok")
        if self.redis_pool is not None:
            parts.append("redis=ok")
        if self.elasticsearch_client is not None:
            parts.append("elasticsearch=ok")
        if self.qdrant_client is not None:
            parts.append("qdrant=ok")
        if self.minio_client is not None:
            parts.append("minio=ok")
        if self.rabbitmq_connection is not None:
            parts.append("rabbitmq=ok")
        if parts:
            logger.info("Infrastructure: %s", ", ".join(parts))

        # Start health monitoring (API / long-lived loop only — not Celery prefork).
        if self.is_initialized:
            self._event_loop = asyncio.get_running_loop()
            from api.core.celery_async import is_celery_worker_mode  # noqa: PLC0415

            if is_celery_worker_mode():
                self._health_task = None
                logger.info(
                    "[STEP] database_health_monitor_skip reason=celery_prefork_loop",
                )
            else:
                _health_task = asyncio.create_task(self._health_monitor_loop())
                # Store task reference to prevent garbage collection
                self._health_task = _health_task

        return self.is_initialized

    async def _init_postgresql(self) -> bool:
        """Initialize PostgreSQL connection."""

        def _raise_postgres_import_error() -> None:
            """Raise ImportError for missing PostgreSQL dependencies."""
            msg = "PostgreSQL dependencies not available"
            raise ImportError(msg)

        try:
            if create_async_engine is None:  # type: ignore[comparison-overlap]
                _raise_postgres_import_error()
            config = DatabaseConfig.get_postgres_config()
            url = DatabaseConfig.get_postgres_url(internal=True)

            self.postgres_engine = create_async_engine(  # type: ignore[assignment,misc]
                url,
                pool_size=config["pool_size"],
                max_overflow=config["max_overflow"],
                pool_timeout=config["pool_timeout"],
                pool_recycle=config["pool_recycle"],
                pool_pre_ping=True,
                echo=config["echo"],
            )
            from api.core.pii_session import register_sqlalchemy_encryption_pii_key

            register_sqlalchemy_encryption_pii_key(self.postgres_engine)

            if async_sessionmaker is None:  # type: ignore[comparison-overlap]
                _raise_postgres_import_error()
            self.postgres_session_factory = async_sessionmaker(  # type: ignore[assignment,misc]
                self.postgres_engine, class_=AsyncSession, expire_on_commit=False
            )

            # Test connection (SQLAlchemy engine)
            if self.postgres_engine is not None:
                async with self.postgres_engine.begin() as conn:
                    if text is not None:
                        await conn.execute(text("SELECT 1"))

            # Lazily initialize low-level asyncpg pool for modules that need it.
            # NOTE: основной способ работы с БД — AsyncSession; asyncpg-пул
            # используется только для тех задач, где это действительно нужно.
            if self.asyncpg_pool is None:
                import asyncpg  # type: ignore[import-not-found]

                async def _asyncpg_init(conn: Any) -> None:
                    # Session-scoped key on each pooled connection (not SET LOCAL: no txn at init).
                    key = getattr(unified_settings, "encryption_master_key", None)
                    if getattr(unified_settings, "encryption_enabled", False) and key:
                        safe = str(key).replace("'", "''")
                        await conn.execute(f"SET SESSION encryption.pii_key = '{safe}'")

                conn_config = DatabaseConfig.get_postgres_config()
                self.asyncpg_pool = await asyncpg.create_pool(  # type: ignore[assignment]
                    host=conn_config["internal_host"],
                    port=conn_config["internal_port"],
                    user=conn_config["username"],
                    password=conn_config["password"],
                    database=conn_config["database"],
                    min_size=unified_settings.asyncpg_pool_min_size,
                    max_size=unified_settings.asyncpg_pool_max_size,
                    command_timeout=30,
                    init=_asyncpg_init,
                )
        except (ImportError, ConnectionError, TimeoutError) as e:
            error_msg = f"PostgreSQL connection failed: {e}"
            logger.exception("PostgreSQL connection error")
            self.health_status["postgresql"] = DatabaseHealthStatus("postgresql", "down", 0.0, error_msg)
            return False
        except Exception as e:
            error_msg = str(e)
            if "password" in error_msg.lower() or "authentication" in error_msg.lower():
                logger.error(
                    "PostgreSQL auth failed (check POSTGRES_USER/POSTGRES_PASSWORD match docker/env_file/.env.stack1): %s",
                    error_msg,
                )
            else:
                logger.exception("PostgreSQL connection error")
            self.health_status["postgresql"] = DatabaseHealthStatus("postgresql", "down", 0.0, error_msg)
            return False
        else:
            self.health_status["postgresql"] = DatabaseHealthStatus("postgresql", "healthy", 0.0)

            logger.info(
                "PostgreSQL connection established (pool_size=%s max_overflow=%s asyncpg_min=%s asyncpg_max=%s)",
                config.get("pool_size"),
                config.get("max_overflow"),
                unified_settings.asyncpg_pool_min_size,
                unified_settings.asyncpg_pool_max_size,
            )
            return True

    async def _init_redis(self) -> bool:
        """Initialize Redis connection."""

        def _raise_redis_import_error() -> None:
            """Raise ImportError for missing Redis dependencies."""
            msg = "Redis dependencies not available"
            raise ImportError(msg)

        try:
            if aioredis is None:  # type: ignore[comparison-overlap]
                _raise_redis_import_error()
            config = DatabaseConfig.REDIS_CONFIG

            # Using modern aioredis API
            # FIX: Use get_redis_url() which already does not add password
            redis_url = DatabaseConfig.get_redis_url(internal=True)
            self.redis_pool = aioredis.from_url(  # type: ignore[assignment,misc]
                redis_url,
                max_connections=config["max_connections"],
                socket_timeout=config["socket_timeout"],
                decode_responses=True,
            )

            # Test connection
            if self.redis_pool is not None:
                await self.redis_pool.ping()

            # Note: Don't close the pool here as we need it for operations
        except Exception as e:
            self.redis_pool = None
            error_msg = f"Redis connection failed: {e}"
            logger.exception("Redis connection error")
            self.health_status["redis"] = DatabaseHealthStatus("redis", "down", 0.0, error_msg)
            return False
        else:
            self.health_status["redis"] = DatabaseHealthStatus("redis", "healthy", 0.0)

            logger.info("Redis connection established")
            return True

    async def _init_elasticsearch(self) -> bool:
        """Initialize Elasticsearch connection."""

        def _raise_elasticsearch_health_error() -> None:
            """Raise ValueError for failed Elasticsearch health check."""
            msg = "Elasticsearch health check failed"
            raise ValueError(msg)

        try:
            config = DatabaseConfig.ELASTICSEARCH_CONFIG
            url = DatabaseConfig.get_elasticsearch_url(internal=True)

            # Read Elasticsearch credentials from unified configuration
            es_user = unified_settings.elasticsearch_user
            es_password = unified_settings.elasticsearch_password or ""

            # Refresh env-driven resilience knobs each init (soft-reconnect path).
            resilience = elasticsearch_resilience_settings()
            verify_certs_val = config.get("verify_certs")
            verify_certs = bool(verify_certs_val) if verify_certs_val is not None else True

            client_kwargs: dict[str, Any] = {
                "basic_auth": (es_user, es_password),
                "verify_certs": verify_certs,
                "request_timeout": float(resilience["request_timeout"]),
                "max_retries": int(resilience["max_retries"]),
                "retry_on_timeout": bool(resilience["retry_on_timeout"]),
                "retry_on_status": resilience["retry_on_status"],
                "dead_node_backoff_factor": float(resilience["dead_node_backoff_factor"]),
                "max_dead_node_backoff": float(resilience["max_dead_node_backoff"]),
            }
            client_kwargs = filter_supported_kwargs(AsyncElasticsearch, client_kwargs)

            self.elasticsearch_client = AsyncElasticsearch(  # type: ignore[assignment]
                [url],
                **client_kwargs,
            )

            # Test connection (same budget as periodic health — avoid Celery fork stalls).
            health: Any = None
            if self.elasticsearch_client is not None:
                health_timeout = float(elasticsearch_resilience_settings()["health_check_timeout"])
                health = await asyncio.wait_for(
                    self.elasticsearch_client.cluster.health(),  # type: ignore[assignment]
                    timeout=health_timeout,
                )
            if not health:
                _raise_elasticsearch_health_error()
        except Exception as e:
            client = self.elasticsearch_client
            self.elasticsearch_client = None
            if client is not None:
                try:
                    await client.close()
                except Exception:
                    logger.debug(
                        "[STEP] elasticsearch_client_close_skip reason=init_fail",
                        exc_info=True,
                    )
            error_msg = f"Elasticsearch connection failed: {e}"
            logger.exception("Elasticsearch connection error")
            self.health_status["elasticsearch"] = DatabaseHealthStatus("elasticsearch", "down", 0.0, error_msg)
            return False
        else:
            self.health_status["elasticsearch"] = DatabaseHealthStatus("elasticsearch", "healthy", 0.0)

            logger.info("Elasticsearch connection established")
            return True

    async def _soft_reconnect_elasticsearch_task(self) -> None:
        """Background soft-reconnect when the shared ES client is missing."""
        try:
            await self._maybe_soft_reconnect_elasticsearch()
        except Exception:
            logger.debug(
                "[STEP] elasticsearch_soft_reconnect_task_skip",
                exc_info=True,
            )

    async def _drop_elasticsearch_client(self, *, reason: str) -> None:
        """Close and clear the shared AsyncElasticsearch client (Celery fork safety)."""

        client = self.elasticsearch_client
        self.elasticsearch_client = None
        if client is None:
            return
        try:
            await client.close()
        except Exception:
            logger.debug(
                "[STEP] elasticsearch_client_close_skip reason=%s",
                reason,
                exc_info=True,
            )
        logger.info("[STEP] elasticsearch_client_dropped reason=%s", reason)

    async def _maybe_soft_reconnect_elasticsearch(self) -> bool:
        """
        Rate-limited re-init when the ES client is missing after a transient failure.

        Returns True if a reconnect attempt was made (success or fail).
        """
        if not (DatabaseFeatures.ENABLE_ELASTICSEARCH and ELASTICSEARCH_AVAILABLE):
            return False
        if self.elasticsearch_client is not None:
            return False

        interval = float(elasticsearch_resilience_settings()["soft_reconnect_interval_sec"])
        now = time.monotonic()
        if now - self._elasticsearch_soft_reconnect_at < interval:
            return False

        self._elasticsearch_soft_reconnect_at = now
        logger.info(
            "[STEP] elasticsearch_soft_reconnect_attempt interval_sec=%.0f",
            interval,
        )
        ok = await self._init_elasticsearch()
        if ok:
            logger.info("[STEP] elasticsearch_soft_reconnect_ok")
        else:
            logger.info("[STEP] elasticsearch_soft_reconnect_failed")
        return True

    async def _init_qdrant(self) -> bool:
        """Initialize Qdrant connection."""
        try:
            if not QDRANT_AVAILABLE:
                msg = "Qdrant dependencies not available"
                raise ImportError(msg)
            from qdrant_client import AsyncQdrantClient  # type: ignore[import-not-found]

            config = DatabaseConfig.QDRANT_CONFIG
            url = DatabaseConfig.get_qdrant_url(internal=True)
            kwargs: dict[str, Any] = {"url": url}
            api_key = config.get("api_key")
            if api_key:
                kwargs["api_key"] = str(api_key)

            self.qdrant_client = AsyncQdrantClient(**kwargs)
            await self.qdrant_client.get_collections()
        except (ImportError, ConnectionError, TimeoutError, ValueError) as e:
            error_msg = f"Qdrant connection failed: {e}"
            logger.warning("%s", error_msg)
            self.health_status["qdrant"] = DatabaseHealthStatus("qdrant", "down", 0.0, error_msg)
            self.qdrant_client = None
            return False
        except Exception as e:
            error_msg = f"Qdrant connection failed: {e}"
            logger.exception("Qdrant connection error")
            self.health_status["qdrant"] = DatabaseHealthStatus("qdrant", "down", 0.0, error_msg)
            self.qdrant_client = None
            return False
        else:
            self.health_status["qdrant"] = DatabaseHealthStatus("qdrant", "healthy", 0.0)
            logger.info("Qdrant connection established")
            return True

    async def _init_minio(self) -> bool:
        """Initialize SeaweedFS S3 storage (backward compatibility: method name kept)."""

        def _raise_seaweedfs_error() -> None:
            """Raise DatabaseConnectionError for failed SeaweedFS bucket listing."""
            msg = "SeaweedFS bucket listing failed"
            raise DatabaseConnectionError(msg)

        try:
            config = DatabaseConfig.MINIO_CONFIG  # Actually SeaweedFS config
            endpoint = DatabaseConfig.get_minio_endpoint(internal=True)

            access_key = str(config["access_key"]) if config.get("access_key") is not None else None
            secret_key = str(config["secret_key"]) if config.get("secret_key") is not None else None
            secure = bool(config["secure"]) if config.get("secure") is not None else False
            region = str(config["region"]) if config.get("region") is not None else None

            self.minio_client = Minio(  # type: ignore[assignment]
                endpoint, access_key=access_key, secret_key=secret_key, secure=secure, region=region
            )

            # Test connection
            buckets: Any = None
            if self.minio_client is not None:
                list_buckets = getattr(self.minio_client, "list_buckets", None)
                if not callable(list_buckets):
                    logger.warning("SeaweedFS client does not expose list_buckets; skipping SeaweedFS init")
                    self.health_status["minio"] = DatabaseHealthStatus(
                        "minio",
                        "down",
                        0.0,
                        "SeaweedFS client stub has no list_buckets",
                    )
                    return False
                buckets = await asyncio.to_thread(list_buckets)  # type: ignore[assignment]
            if not buckets:
                _raise_seaweedfs_error()
        except (DatabaseConnectionError, ConnectionError, TimeoutError) as e:
            error_msg = f"SeaweedFS connection failed: {e}"
            logger.exception("SeaweedFS connection failed")
            self.health_status["minio"] = DatabaseHealthStatus("minio", "down", 0.0, error_msg)
            return False
        else:
            self.health_status["minio"] = DatabaseHealthStatus("minio", "healthy", 0.0)

            logger.info("SeaweedFS connection established")
            return True

    async def _init_rabbitmq(self) -> bool:
        """Initialize RabbitMQ connection."""

        def _raise_rabbitmq_import_error() -> None:
            """Raise ImportError for missing RabbitMQ dependencies."""
            msg = "RabbitMQ dependencies not available"
            raise ImportError(msg)

        try:
            if aio_pika is None:  # type: ignore[comparison-overlap]
                _raise_rabbitmq_import_error()
            if not os.environ.get("RABBITMQ_URL") and not os.environ.get("RABBITMQ_PASSWORD"):
                logger.info("RabbitMQ skipped: RABBITMQ_PASSWORD not set (set in environment to enable)")
                self.health_status["rabbitmq"] = DatabaseHealthStatus(
                    "rabbitmq", "down", 0.0, "RabbitMQ disabled (no password)"
                )
                return False
            url = DatabaseConfig.get_rabbitmq_url(internal=True)

            resilience_rmq = rabbitmq_connection_resilience_settings()
            self.rabbitmq_connection = await aio_pika.connect_robust(  # type: ignore[assignment,misc]
                url,
                heartbeat=int(resilience_rmq["heartbeat"]),
                blocked_connection_timeout=int(resilience_rmq["blocked_connection_timeout"]),
            )

            # Test connection
            if self.rabbitmq_connection is not None:
                channel = await self.rabbitmq_connection.channel()  # type: ignore[union-attr]
                await channel.close()
        except (ImportError, ConnectionError, TimeoutError) as e:
            error_msg = f"RabbitMQ connection failed: {e}"
            logger.warning("RabbitMQ connection failed: %s", e)
            self.health_status["rabbitmq"] = DatabaseHealthStatus("rabbitmq", "down", 0.0, error_msg)
            return False
        except Exception as e:
            error_msg = str(e)
            if "ACCESS_REFUSED" in error_msg or "Authentication" in error_msg:
                logger.warning(
                    "RabbitMQ auth failed (check RABBITMQ_PASSWORD matches stack1): %s",
                    error_msg[:200],
                )
            else:
                logger.exception("RabbitMQ connection failed")
            self.health_status["rabbitmq"] = DatabaseHealthStatus("rabbitmq", "down", 0.0, error_msg[:200])
            return False
        else:
            self.health_status["rabbitmq"] = DatabaseHealthStatus("rabbitmq", "healthy", 0.0)

            logger.info("RabbitMQ connection established")
            return True

    @asynccontextmanager
    async def get_postgres_session(self) -> AsyncIterator[AsyncSession]:
        """Get PostgreSQL async session.

        **Important**: AsyncSession is NOT safe for use in concurrent tasks.
        Each session should be used by only one task at a time.
        This method creates a new session for each call, which is safe.

        Yields:
            AsyncSession: Database session instance

        Raises:
            DatabaseConnectionError: If PostgreSQL is not available
        """
        if not self.postgres_session_factory:
            msg = "PostgreSQL not available"
            raise DatabaseConnectionError(msg)

        async with self.postgres_session_factory() as session:
            # pii_key: pool connect event (register_sqlalchemy_encryption_pii_key). Do not soft-skip
            # on QueuePool timeout — acquisition failures must propagate (fail-closed).
            try:
                yield session
                # Check if connection is still open before committing
                try:
                    await session.commit()
                except asyncio.CancelledError:
                    # Client disconnect / SSE cancel during commit — never escalate as PendingRollback.
                    with suppress(Exception):
                        await session.rollback()
                    raise
                except Exception as commit_error:
                    from sqlalchemy.exc import PendingRollbackError

                    error_str = str(commit_error).lower()
                    if "connection is closed" in error_str or "connection closed" in error_str:
                        logger.warning("Database connection closed before commit - skipping commit")
                        return
                    if isinstance(
                        commit_error,
                        (PendingRollbackError, ConnectionError, RuntimeError),
                    ):
                        with suppress(Exception):
                            await session.rollback()
                        if isinstance(commit_error, PendingRollbackError):
                            logger.debug(
                                "[STEP] postgres_session commit skipped after prior rollback/cancel: %s",
                                commit_error,
                            )
                            return
                        raise
                    with suppress(Exception):
                        await session.rollback()
                    raise
            except asyncio.CancelledError:
                with suppress(Exception):
                    await session.rollback()
                raise
            except (ConnectionError, RuntimeError, ValueError):  # fmt: skip
                # Only rollback if connection is still open
                try:
                    await session.rollback()
                except (ConnectionError, RuntimeError) as rollback_error:
                    error_str = str(rollback_error).lower()
                    if "connection is closed" in error_str or "connection closed" in error_str:
                        logger.warning("Database connection closed before rollback - skipping rollback")
                        # Connection already closed, nothing to rollback
                    else:
                        raise
                raise

    async def get_redis_client(self, db: int | None = None) -> Any:  # type: ignore[type-arg] # noqa: ANN401
        """Get Redis client. For default DB use db=None; for other DBs use db=N (e.g. Telegram db=14)."""
        if not self.redis_pool:
            msg = "Redis not available"
            raise DatabaseConnectionError(msg)

        default_db = DatabaseConfig.REDIS_CONFIG["database"]
        if db is None or db == default_db:
            return self.redis_pool  # type: ignore[return-value]

        # Per-db pool: single factory, cached
        if db not in self._redis_pools_by_db:
            config = DatabaseConfig.REDIS_CONFIG
            redis_url = DatabaseConfig.get_redis_url(internal=True, db=db)
            self._redis_pools_by_db[db] = aioredis.from_url(  # type: ignore[assignment,misc]
                redis_url,
                max_connections=config.get("max_connections", 10),
                socket_timeout=config.get("socket_timeout", 5),
                decode_responses=True,
            )
        return self._redis_pools_by_db[db]  # type: ignore[return-value]

    async def get_asyncpg_pool(self) -> Any:  # type: ignore[type-arg] # noqa: ANN401
        """Get low-level asyncpg pool.

        Preferred way to work with PostgreSQL в приложении — через AsyncSession
        (`get_postgres_session`). Этот метод предназначен для модулей, которым
        действительно нужен asyncpg (`COPY`, bulk-вставки, низкоуровневые
        оптимизации).

        Raises:
            DatabaseConnectionError: If PostgreSQL pool is not available
        """
        if self.asyncpg_pool is None:
            msg = "PostgreSQL asyncpg pool not available"
            raise DatabaseConnectionError(msg)
        return self.asyncpg_pool

    def get_elasticsearch_client(self) -> AsyncElasticsearch:
        """Get Elasticsearch client."""
        if not self.elasticsearch_client:
            msg = "Elasticsearch not available"
            raise DatabaseConnectionError(msg)

        return self.elasticsearch_client

    def get_chromadb_client(self) -> Any:  # type: ignore[type-arg] # noqa: ANN401
        """ChromaDB client is not available in stack0-api (removed; use Qdrant)."""
        msg = "ChromaDB client removed from stack0-api; use Qdrant via get_qdrant_client()"
        raise DatabaseConnectionError(msg)

    def get_qdrant_client(self) -> Any:  # type: ignore[type-arg] # noqa: ANN401
        """Get Qdrant client."""
        if not self.qdrant_client:
            msg = "Qdrant not available"
            raise DatabaseConnectionError(msg)
        return self.qdrant_client

    def get_minio_client(self) -> Minio:
        """Get SeaweedFS S3 client (backward compatibility: method name kept)."""
        if not self.minio_client:
            msg = "SeaweedFS not available"
            raise DatabaseConnectionError(msg)

        return self.minio_client

    def get_rabbitmq_connection(self) -> Any:  # type: ignore[type-arg] # noqa: ANN401
        """Get RabbitMQ connection."""
        if not self.rabbitmq_connection:
            msg = "RabbitMQ not available"
            raise DatabaseConnectionError(msg)

        return self.rabbitmq_connection  # type: ignore[return-value]

    # Interval for background health checks (Postgres, Redis, ES). /api/health returns cached result.
    HEALTH_CHECK_INTERVAL_SEC = 60

    async def _health_monitor_loop(self) -> None:
        while True:
            sleep_for_sec = self.HEALTH_CHECK_INTERVAL_SEC
            try:
                await self._perform_health_checks()
            except (ConnectionError, TimeoutError, RuntimeError):  # fmt: skip
                # Health monitor must catch all exceptions to continue running
                logger.exception("Health monitor error")
                sleep_for_sec = 120  # Wait longer on error
            sleep_started = asyncio.get_event_loop().time()
            await asyncio.sleep(sleep_for_sec)
            lag_seconds = max(0.0, asyncio.get_event_loop().time() - (sleep_started + sleep_for_sec))
            try:
                from api.monitoring.metrics import observe_event_loop_lag  # noqa: PLC0415

                observe_event_loop_lag(lag_seconds=lag_seconds)
            except Exception:
                logger.debug("Event-loop lag metric update failed", exc_info=True)

    async def _perform_health_checks(self) -> None:
        tasks: list[asyncio.Task[None]] = []

        if DatabaseFeatures.ENABLE_POSTGRESQL and POSTGRES_AVAILABLE and self.postgres_engine:
            tasks.append(asyncio.create_task(self._check_postgres_health()))

        if DatabaseFeatures.ENABLE_REDIS and REDIS_AVAILABLE and self.redis_pool:
            tasks.append(asyncio.create_task(self._check_redis_health()))

        if DatabaseFeatures.ENABLE_ELASTICSEARCH and ELASTICSEARCH_AVAILABLE and self.elasticsearch_client:
            tasks.append(asyncio.create_task(self._check_elasticsearch_health()))
        elif DatabaseFeatures.ENABLE_ELASTICSEARCH and ELASTICSEARCH_AVAILABLE:
            # Client missing after drop/timeout — rate-limited soft reconnect (not inline
            # with a cancelled wait_for probe that can poison aiohttp sessions).
            tasks.append(asyncio.create_task(self._soft_reconnect_elasticsearch_task()))

        if DatabaseFeatures.ENABLE_QDRANT and QDRANT_AVAILABLE and self.qdrant_client:
            tasks.append(asyncio.create_task(self._check_qdrant_health()))

        if DatabaseFeatures.ENABLE_RABBITMQ and RABBITMQ_AVAILABLE and self.rabbitmq_connection:
            tasks.append(asyncio.create_task(self._refresh_rabbitmq_prometheus_metrics()))

        # Run all health checks concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self.connection_stats["last_health_check"] = datetime.now(UTC)  # type: ignore[assignment]

        # Log brief summary when status is not fully healthy (single source: health_status)
        summary = self.get_health_summary()
        overall = summary.get("overall_status", "unknown")
        if overall != "healthy":
            parts = [f"{name}={s.status}" for name, s in self.health_status.items()]
            logger.info(
                "Infrastructure health %s: %s",
                overall,
                ", ".join(parts),
            )

    async def _check_postgres_health(self) -> None:
        """Check PostgreSQL health."""
        start_time = asyncio.get_event_loop().time()
        try:
            if self.postgres_engine is None:
                return
            async with self.postgres_engine.begin() as conn:
                if text is not None:
                    await conn.execute(text("SELECT 1"))  # type: ignore[arg-type]

            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["postgresql"] = DatabaseHealthStatus("postgresql", "healthy", response_time)
        except (ConnectionError, TimeoutError) as e:
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["postgresql"] = DatabaseHealthStatus("postgresql", "down", response_time, str(e))

    async def _check_redis_health(self) -> None:
        """Check Redis health."""
        start_time = asyncio.get_event_loop().time()
        try:
            if self.redis_pool is None:
                return
            # Use the pool directly for aioredis v1.3.1
            await self.redis_pool.ping()  # type: ignore[union-attr]

            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["redis"] = DatabaseHealthStatus("redis", "healthy", response_time)
        except (ConnectionError, TimeoutError) as e:
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["redis"] = DatabaseHealthStatus("redis", "down", response_time, str(e))

    async def _refresh_rabbitmq_prometheus_metrics(self) -> None:
        """Update RabbitMQ queue depth gauges (Management HTTP API)."""
        try:
            from api.services.rabbitmq_service import (  # noqa: PLC0415
                refresh_rabbitmq_queue_metrics_for_prometheus,
            )

            await refresh_rabbitmq_queue_metrics_for_prometheus()
        except Exception:
            logger.debug("RabbitMQ Prometheus metrics refresh failed", exc_info=True)

    async def _check_elasticsearch_health(self) -> None:
        """Check Elasticsearch health; soft-reconnect when client is missing or hung."""
        start_time = asyncio.get_event_loop().time()
        try:
            if self.elasticsearch_client is None:
                await self._maybe_soft_reconnect_elasticsearch()
                if self.elasticsearch_client is None:
                    # Keep status visible as down (init already set it, or mark if absent).
                    if "elasticsearch" not in self.health_status:
                        self.health_status["elasticsearch"] = DatabaseHealthStatus(
                            "elasticsearch",
                            "down",
                            0.0,
                            "Elasticsearch client not available",
                        )
                    return
            # Cap probe time: default ES client retries can block Celery 60s×N (logs showed 120–360s).
            # elastic_transport.ConnectionTimeout is NOT a subclass of builtin TimeoutError.
            # Cancelling wait_for without closing the client can leave aiohttp connections hung
            # (ForkPoolWorker then times out every cycle while peers succeed in ~3ms).
            health_timeout = float(elasticsearch_resilience_settings()["health_check_timeout"])
            health = await asyncio.wait_for(
                self.elasticsearch_client.cluster.health(),  # type: ignore[union-attr]
                timeout=health_timeout,
            )
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000

            status = "healthy" if health["status"] in ["green", "yellow"] else "degraded"
            self.health_status["elasticsearch"] = DatabaseHealthStatus("elasticsearch", status, response_time)
            # OPTIMIZATION: Do not log successful health checks - too many logs
            # Log only errors
        except Exception as e:
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["elasticsearch"] = DatabaseHealthStatus("elasticsearch", "down", response_time, str(e))
            logger.warning(
                "[STEP] elasticsearch_health_check_failed err_type=%s err=%s",
                type(e).__name__,
                e,
            )
            # Drop dead/hung client so the next interval can soft-reconnect.
            # Do not soft-reconnect inline after TimeoutError: cancelled probes leave
            # half-open sessions; reconnect is rate-limited and runs on the next cycle
            # (or when client is missing — see _perform_health_checks).
            await self._drop_elasticsearch_client(reason=type(e).__name__)
            if not isinstance(e, TimeoutError):
                await self._maybe_soft_reconnect_elasticsearch()

    async def _check_qdrant_health(self) -> None:
        """Check Qdrant health."""
        start_time = asyncio.get_event_loop().time()
        try:
            if self.qdrant_client is None:
                return
            await self.qdrant_client.get_collections()
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["qdrant"] = DatabaseHealthStatus("qdrant", "healthy", response_time)
        except (ConnectionError, TimeoutError, ValueError) as e:
            response_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.health_status["qdrant"] = DatabaseHealthStatus("qdrant", "down", response_time, str(e))
            logger.warning("Qdrant health check failed: %s", e)

    def get_health_summary(self) -> dict[str, Any]:
        healthy_count = sum(1 for status in self.health_status.values() if status.status == "healthy")
        total_count = len(self.health_status)

        databases = {name: status.to_dict() for name, status in self.health_status.items()}
        overall: str = (
            "healthy"
            if healthy_count == total_count and total_count > 0
            else "degraded"
            if healthy_count > 0
            else "down"
        )

        # Fail closed: enabled PostgreSQL without asyncio deps must not report healthy
        # (thin bake on a stale base can omit greenlet while Redis still looks fine).
        if DatabaseFeatures.ENABLE_POSTGRESQL and not POSTGRES_AVAILABLE:
            databases["postgresql"] = {
                "db_type": "postgresql",
                "status": "down",
                "response_time_ms": 0.0,
                "error": "PostgreSQL dependencies not available (SQLAlchemy asyncio / greenlet)",
                "timestamp": datetime.now(UTC).isoformat(),
            }
            overall = "unhealthy"
            total_count = max(total_count, 1)
            healthy_count = sum(1 for detail in databases.values() if detail.get("status") == "healthy")

        return {
            "overall_status": overall,
            "healthy_databases": healthy_count,
            "total_databases": total_count,
            "databases": databases,
            "connection_stats": self.connection_stats,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def _sync_release_postgres_resources(self) -> None:
        """Close PostgreSQL pools without awaiting (previous asyncio loop may already be closed)."""
        if self.postgres_engine is not None:
            try:
                # ``close=False`` drops pool references without forcing sync close of
                # async-adapted connections (avoids MissingGreenlet in Celery prefork loop resets).
                self.postgres_engine.sync_engine.dispose(close=False)
            except TypeError:
                # Backward compatibility with SQLAlchemy variants without ``close`` arg.
                self.postgres_engine.sync_engine.dispose()
            except MissingGreenlet:
                logger.warning(
                    "DatabaseManager: defer SQLAlchemy engine close on loop reset (MissingGreenlet)",
                )
            except Exception:
                logger.exception(
                    "DatabaseManager: failed to dispose SQLAlchemy engine during loop reset",
                )
        if self.asyncpg_pool is not None:
            try:
                self.asyncpg_pool.terminate()
            except RuntimeError as exc:
                if "Event loop is closed" in str(exc):
                    logger.warning(
                        "DatabaseManager: asyncpg pool belonged to closed event loop during loop reset; dropping reference",
                    )
                else:
                    logger.exception(
                        "DatabaseManager: failed to terminate asyncpg pool during loop reset",
                    )
            except Exception:
                logger.exception(
                    "DatabaseManager: failed to terminate asyncpg pool during loop reset",
                )

    def _drop_connection_resources_for_new_event_loop(self, *, skip_http_drop: bool = False) -> None:
        """Forget pooled clients bound to a previous (closed) asyncio loop.

        Used when ``asyncio.run()`` is called repeatedly (e.g. Celery prefork workers): the old
        loop is already closed, so we cannot await ``close_all_connections()`` on it. Release
        PostgreSQL pools synchronously first (otherwise Celery tasks leak idle connections), then
        drop references so :meth:`initialize` can rebuild on the current loop.

        When ``skip_http_drop`` is True, the caller already awaited ``close_http_clients()`` on
        the current loop (e.g. mid-task ``get_database_manager`` after ``run_celery_async`` init).
        """
        logger.info(
            "DatabaseManager: event loop changed (e.g. Celery task); dropping stale connection refs",
        )
        if not skip_http_drop:
            try:
                from api.core.http_clients import drop_http_clients_for_closed_loop

                drop_http_clients_for_closed_loop()
            except Exception:
                logger.debug(
                    "DatabaseManager: drop_http_clients_for_closed_loop failed during loop reset",
                    exc_info=True,
                )
        self._sync_release_postgres_resources()
        self.is_initialized = False
        self._event_loop = None
        self._health_task = None
        self.postgres_engine = None
        self.postgres_session_factory = None
        self.asyncpg_pool = None
        self.redis_pool = None
        self._redis_pools_by_db.clear()
        self.elasticsearch_client = None
        self.chromadb_client = None
        self.minio_client = None
        self.rabbitmq_connection = None
        self.qdrant_client = None

    async def close_all_connections(self) -> None:
        logger.info("Closing all database connections...")

        if self.postgres_engine:
            await self.postgres_engine.dispose()

        if self.asyncpg_pool:
            await self.asyncpg_pool.close()  # type: ignore[union-attr]

        if self.redis_pool:
            await self.redis_pool.aclose()  # type: ignore[union-attr]

        for _db, pool in list(self._redis_pools_by_db.items()):
            try:
                await pool.aclose()  # type: ignore[union-attr]
            except Exception:
                logger.exception("Error closing Redis pool for db %s", _db)
        self._redis_pools_by_db.clear()

        if self.elasticsearch_client:
            await self.elasticsearch_client.close()

        if self.qdrant_client:
            close_fn = getattr(self.qdrant_client, "close", None)
            aclose_fn = getattr(self.qdrant_client, "aclose", None)
            if callable(close_fn):
                maybe_coro = close_fn()
                if asyncio.iscoroutine(maybe_coro):
                    await maybe_coro
            elif callable(aclose_fn):
                maybe_coro = aclose_fn()
                if asyncio.iscoroutine(maybe_coro):
                    await maybe_coro

        if self.rabbitmq_connection:
            await self.rabbitmq_connection.close()

        logger.info("All database connections closed")


#  GLOBAL DATABASE MANAGER INSTANCE
db_manager = DatabaseManager()
_db_manager_init_lock: asyncio.Lock | None = None
_db_manager_init_lock_loop: asyncio.AbstractEventLoop | None = None


def _get_db_manager_init_lock(current_loop: asyncio.AbstractEventLoop) -> asyncio.Lock:
    global _db_manager_init_lock, _db_manager_init_lock_loop  # noqa: PLW0603
    if _db_manager_init_lock is None or _db_manager_init_lock_loop is not current_loop:
        _db_manager_init_lock = asyncio.Lock()
        _db_manager_init_lock_loop = current_loop
    return _db_manager_init_lock


async def get_database_manager() -> DatabaseManager:
    """Get database manager instance."""
    current_loop = asyncio.get_running_loop()
    loop_changed = False
    if db_manager.is_initialized and db_manager._event_loop is not current_loop:
        from api.core.http_clients import close_http_clients

        try:
            await close_http_clients()
        except Exception:
            logger.debug(
                "DatabaseManager: close_http_clients failed during loop reset",
                exc_info=True,
            )
        db_manager._drop_connection_resources_for_new_event_loop(skip_http_drop=True)
        loop_changed = True
    if not db_manager.is_initialized:
        init_lock = _get_db_manager_init_lock(current_loop)
        async with init_lock:
            if not db_manager.is_initialized:
                await db_manager.initialize()
    if loop_changed:
        from api.core.http_clients import init_http_clients

        await init_http_clients()
    return db_manager


#  CONVENIENCE FUNCTIONS FOR DEPENDENCY INJECTION
async def get_postgres_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency for PostgreSQL session.

    **Important**: AsyncSession is NOT safe for use in concurrent tasks.
    Each session should be used by only one task at a time.
    This dependency creates a new session for each request, which is safe.

    Yields:
        AsyncSession: Database session instance
    """
    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        yield session


async def get_redis_client() -> Any:  # type: ignore[type-arg] # noqa: ANN401
    """Get Redis client dependency."""
    manager = await get_database_manager()
    return await manager.get_redis_client()


def get_elasticsearch_client() -> AsyncElasticsearch:
    """Get Elasticsearch client dependency."""
    manager = db_manager
    return manager.get_elasticsearch_client()


async def get_qdrant_client() -> Any:  # type: ignore[type-arg] # noqa: ANN401
    """Get Qdrant client dependency."""
    manager = await get_database_manager()
    return manager.get_qdrant_client()


async def get_asyncpg_pool() -> Any:  # type: ignore[type-arg] # noqa: ANN401
    """FastAPI dependency for low-level asyncpg pool.

    Используется только там, где действительно нужен asyncpg. Для обычных
    CRUD-операций предпочтителен `get_postgres_session()`.
    """
    manager = await get_database_manager()
    return await manager.get_asyncpg_pool()


# USAGE EXAMPLE
if __name__ == "__main__":

    async def main() -> None:
        manager = DatabaseManager()
        success = await manager.initialize()

        if success:
            manager.get_health_summary()
        else:
            logger.warning("DatabaseManager CLI example: initialize() returned False")

        await manager.close_all_connections()

    asyncio.run(main())
