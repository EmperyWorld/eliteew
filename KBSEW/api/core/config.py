# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Environment-driven settings for KBSEW microservice.
# Invariants:
# - No secrets hardcoded; all from env / runtime config plane.
# ---

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class KbsewSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    service_name: str = "kbsew"
    log_level: str = Field(default="INFO", validation_alias="KBSEW_LOG_LEVEL")

    postgres_host: str = Field(
        default="stack1-postgres", validation_alias="POSTGRES_HOST"
    )
    postgres_port: int = Field(default=5432, validation_alias="POSTGRES_PORT")
    postgres_user: str = Field(default="ai_user", validation_alias="POSTGRES_USER")
    postgres_password: str = Field(default="", validation_alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="ai_services", validation_alias="POSTGRES_DB")

    qdrant_host: str = Field(default="stack1-qdrant", validation_alias="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, validation_alias="QDRANT_PORT")
    qdrant_api_key: str | None = Field(default=None, validation_alias="QDRANT_API_KEY")
    qdrant_url: str | None = Field(default=None, validation_alias="QDRANT_URL")

    minio_host: str = Field(default="stack1-seaweedfs", validation_alias="MINIO_HOST")
    minio_port: int = Field(default=8333, validation_alias="MINIO_PORT")
    minio_access_key: str = Field(default="", validation_alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="", validation_alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="eliteew", validation_alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, validation_alias="MINIO_SECURE")
    object_prefix: str = Field(default="kbsew/", validation_alias="KBSEW_OBJECT_PREFIX")

    tika_url: str = Field(
        default="http://stack4-tika:9998", validation_alias="TIKA_URL"
    )
    ocrmypdf_url: str = Field(
        default="http://stack4-ocrmypdf-api:5000", validation_alias="OCRMYPDF_URL"
    )

    llama_embedding_url: str = Field(
        default="http://192.168.1.141:8081", validation_alias="LLAMA_EMBEDDING_URL"
    )
    llama_embedding_model: str = Field(
        default="nomic-embed-text:latest", validation_alias="LLAMA_EMBEDDING_MODEL"
    )
    embedding_dimension: int = Field(
        default=768, validation_alias="AI_EMBEDDINGS_DIMENSION"
    )
    embed_batch_size: int = Field(
        default=50, validation_alias="AI_EMBEDDINGS_BATCH_SIZE"
    )
    embed_timeout_sec: float = Field(
        default=180.0, validation_alias="KBSEW_EMBED_TIMEOUT_SEC"
    )
    embed_batch_timeout_sec: float = Field(
        default=600.0, validation_alias="KBSEW_EMBED_BATCH_TIMEOUT_SEC"
    )
    embed_http_retries: int = Field(
        default=3, validation_alias="KBSEW_EMBED_HTTP_RETRIES"
    )
    qdrant_upsert_batch_size: int = Field(
        default=50, validation_alias="KBSEW_QDRANT_UPSERT_BATCH_SIZE"
    )
    qdrant_upsert_retries: int = Field(
        default=3, validation_alias="KBSEW_QDRANT_UPSERT_RETRIES"
    )
    sparse_vectors_enabled: bool = Field(
        default=False, validation_alias="KBSEW_SPARSE_VECTORS_ENABLED"
    )
    sparse_native_qdrant: bool = Field(
        default=False,
        validation_alias="KBSEW_SPARSE_NATIVE_QDRANT",
    )
    sparse_max_terms: int = Field(
        default=128, validation_alias="KBSEW_SPARSE_MAX_TERMS"
    )
    sparse_candidate_limit: int = Field(
        default=256, validation_alias="KBSEW_SPARSE_CANDIDATE_LIMIT"
    )
    hybrid_allow_truncated_sparse: bool = Field(
        default=False,
        validation_alias="KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE",
    )
    search_top_k: int = Field(default=5, validation_alias="KBSEW_SEARCH_TOP_K")
    retrieval_mode_default: str = Field(
        default="dense", validation_alias="KBSEW_RETRIEVAL_MODE"
    )
    worker_enabled: bool = Field(default=True, validation_alias="KBSEW_WORKER_ENABLED")
    worker_concurrency: int = Field(
        default=1, validation_alias="KBSEW_WORKER_CONCURRENCY"
    )
    worker_poll_interval_sec: float = Field(
        default=1.0, validation_alias="KBSEW_WORKER_POLL_INTERVAL_SEC"
    )
    worker_lease_timeout_sec: int = Field(
        default=900, validation_alias="KBSEW_WORKER_LEASE_TIMEOUT_SEC"
    )
    worker_heartbeat_interval_sec: float = Field(
        default=60.0, validation_alias="KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC"
    )
    worker_max_attempts: int = Field(
        default=3, validation_alias="KBSEW_WORKER_MAX_ATTEMPTS"
    )
    kbsew_internal_service_token: str | None = Field(
        default=None, validation_alias="KBSEW_INTERNAL_SERVICE_TOKEN"
    )
    # Opt-in ops: allow X-KBSEW-Service-Token on mutation routes (barrel create/ingest).
    # Default false — JWT admin remains the normal mutation path.
    kbsew_service_can_mutate: bool = Field(
        default=False, validation_alias="KBSEW_SERVICE_CAN_MUTATE"
    )

    keycloak_url: str = Field(
        default="http://stack6-keycloak:8080", validation_alias="KEYCLOAK_URL"
    )
    keycloak_realm: str = Field(default="empery", validation_alias="KEYCLOAK_REALM")
    keycloak_audience: str = Field(
        default="empery-api", validation_alias="KEYCLOAK_AUDIENCE"
    )

    chunk_size: int = Field(default=800, validation_alias="KBSEW_CHUNK_SIZE")
    chunk_overlap: int = Field(default=100, validation_alias="KBSEW_CHUNK_OVERLAP")
    ingest_max_bytes: int = Field(
        default=52_428_800,
        validation_alias="KBSEW_INGEST_MAX_BYTES",
    )
    url_allow_private: bool = Field(
        default=False,
        validation_alias="KBSEW_URL_ALLOW_PRIVATE",
    )

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def qdrant_http_url(self) -> str:
        explicit = (self.qdrant_url or "").strip().rstrip("/")
        if explicit:
            return explicit
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    @property
    def embed_batch_size_clamped(self) -> int:
        return max(8, min(int(self.embed_batch_size), 128))

    @property
    def qdrant_upsert_batch_size_clamped(self) -> int:
        return max(10, min(int(self.qdrant_upsert_batch_size), 200))

    @property
    def embed_http_retries_clamped(self) -> int:
        return max(1, min(int(self.embed_http_retries), 5))

    @property
    def qdrant_upsert_retries_clamped(self) -> int:
        return max(1, min(int(self.qdrant_upsert_retries), 5))

    @property
    def sparse_max_terms_clamped(self) -> int:
        return max(8, min(int(self.sparse_max_terms), 512))

    @property
    def sparse_candidate_limit_clamped(self) -> int:
        """Max Qdrant points scrolled for in-process sparse ranking (hybrid)."""
        return max(32, min(int(self.sparse_candidate_limit), 2048))

    @property
    def sparse_native_active(self) -> bool:
        """True when ingest/search should use named dense+sparse Qdrant vectors."""
        return bool(self.sparse_vectors_enabled and self.sparse_native_qdrant)

    @property
    def search_top_k_clamped(self) -> int:
        return max(1, min(int(self.search_top_k), 20))

    @property
    def retrieval_mode_resolved(self) -> str:
        mode = (self.retrieval_mode_default or "dense").strip().lower()
        if mode not in ("dense", "hybrid"):
            return "dense"
        return mode

    @property
    def worker_concurrency_clamped(self) -> int:
        return max(1, min(int(self.worker_concurrency), 8))

    @property
    def worker_poll_interval_clamped(self) -> float:
        return max(0.2, min(float(self.worker_poll_interval_sec), 30.0))

    @property
    def worker_lease_timeout_clamped(self) -> int:
        return max(60, min(int(self.worker_lease_timeout_sec), 86_400))

    @property
    def worker_heartbeat_interval_clamped(self) -> float:
        """Seconds between lease heartbeats; 0 disables in-process heartbeat."""
        return max(0.0, min(float(self.worker_heartbeat_interval_sec), 600.0))

    @property
    def worker_max_attempts_clamped(self) -> int:
        return max(1, min(int(self.worker_max_attempts), 10))

    @property
    def ingest_max_bytes_clamped(self) -> int:
        """Hard cap for upload body and URL download (1 MiB .. 512 MiB)."""
        return max(1_048_576, min(int(self.ingest_max_bytes), 536_870_912))


@lru_cache(maxsize=1)
def get_settings() -> KbsewSettings:
    return KbsewSettings()
