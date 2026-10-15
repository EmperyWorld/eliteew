#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unified elite editor orchestrator that bridges storage, parsing, AI analysis, and integrations for
# document/media workflows.
# Invariants:
# - Long-running network I/O in request handlers must not block the asyncio event loop.
# - External service failures are surfaced as runtime errors with structured logs.
# Related:
# - api/services/document_service.py
# - api/services/unified_content/storage_backends/minio_storage.py
# ---
"""
🔥💎⚡ ELITE EDITOR ORCHESTRATOR - PRODUCTION CORE ⚡💎🔥

Main orchestration service integrating ALL EliteEW microservices:
- Stack 1: PostgreSQL, Redis, Elasticsearch, ChromaDB, MinIO
- Stack 2: Llama, WhisperX, LocalAI, LocalAGI
- Stack 4: Tika, Gotenberg, Tesseract, Paperless, Document AI

Architecture Principles:
✅ Service fallback chains (primary → secondary → tertiary)
✅ Graceful degradation (system works even if services fail)
✅ Comprehensive error handling with logging
✅ Connection pooling and caching
✅ Async/await throughout
✅ Type hints for all methods
✅ Production-ready error recovery

Created: 2025-10-02
Version: 1.0.0
"""

import asyncio
import base64
import json
import logging
import os
import re
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import asyncpg  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]
from elasticsearch import AsyncElasticsearch  # type: ignore[attr-defined,import-not-found]
from minio import Minio  # type: ignore[import-not-found]
from redis import asyncio as aioredis  # type: ignore[import-not-found]

from api.core.database_manager import DatabaseConfig, get_database_manager
from api.core.http_clients import get_httpx_client
from api.core.unified_config import unified_settings
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.audit_logger import AuditLogger

# Unified Content System imports
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
)
from api.services.unified_content.storage_backends.factory import (
    get_storage_factory,
)
from api.services.unified_content.version_manager import VersionManager
from api.utils.llama_models import DEFAULT_MODEL
from api.utils.llm_openai_compat_http import httpx_compat_generate_json

from .elite_editor_unified_adapter import EliteEditorUnifiedAdapter

logger = logging.getLogger(__name__)

# ========================================
# CONSTANTS
# ========================================

HTTP_OK_STATUS = 200
HTTP_METHOD_NOT_ALLOWED = 405
FIELD_CONTEXT_BEFORE = 50
MAX_FIELD_HINT_LENGTH = 50
MAX_CONTENT_PREVIEW_LENGTH = 200
FIELD_POSITION_TOLERANCE = 10
TIMEOUT_HEALTH_CHECK = 5.0
TIMEOUT_FILE_PROCESSING = 60.0

# ========================================
# GLOBAL SINGLETON INSTANCE
# ========================================


class _OrchestratorState:
    """State holder for orchestrator singleton instance."""

    instance: EliteEditorOrchestrator | None = None


_orchestrator_state = _OrchestratorState()


async def get_orchestrator() -> EliteEditorOrchestrator:
    """
    Get or create singleton orchestrator instance

    Returns:
        Initialized EliteEditorOrchestrator
    """
    if _orchestrator_state.instance is None:
        _orchestrator_state.instance = EliteEditorOrchestrator()
        await _orchestrator_state.instance.initialize()

    return _orchestrator_state.instance


# ========================================
# ELITE EDITOR ORCHESTRATOR
# ========================================


class EliteEditorOrchestrator:
    """
    Main orchestrator for Elite Document Editor

    Manages all service integrations with fallback chains and graceful degradation
    """

    def __init__(self) -> None:
        """Initialize orchestrator (services initialized in initialize() method)"""
        # Stack 1 - Database layer
        self.pg_pool: asyncpg.Pool | None = None
        self.redis_client: aioredis.Redis | None = None
        self.es_client: AsyncElasticsearch | None = None  # Elasticsearch client (initialized if available)
        self.minio_client: Minio | None = None  # MinIO client

        # HTTP client for external services
        self.http_client: httpx.AsyncClient | None = None

        # Unified Content System adapter
        self.unified_adapter: EliteEditorUnifiedAdapter | None = None

        # Service availability flags
        self.services_status = {
            "postgres": True,
            "redis": True,
            "elasticsearch": True,
            "chroma": True,
            "minio": True,
            "llama": True,
            "whisperx": False,
            "tika": True,
            "gotenberg": False,
            "tesseract": False,
            "paperless": False,
            "document_ai": False,
            "pdf_tools": False,
            "doc_converter": False,
        }

        # Base configuration derived from unified settings
        self.redis_url = unified_settings.get_connection_string("redis", "11")
        self.elasticsearch_base_url = (
            f"http://{unified_settings.elasticsearch_host}:{unified_settings.elasticsearch_port}"
        )
        self.elasticsearch_auth = (
            unified_settings.elasticsearch_user,
            unified_settings.elasticsearch_password or "",
        )
        self.llama_base_url = unified_settings.llama_url.rstrip("/")
        self.tika_base_url = unified_settings.tika_url.rstrip("/")
        _gotenberg = getattr(unified_settings, "gotenberg", None)
        self.gotenberg_base_url = (
            _gotenberg.internal_url.rstrip("/")
            if _gotenberg
            else (os.environ.get("GOTENBERG_URL") or "").strip().rstrip("/")
        ) or ""
        self.tesseract_base_url = unified_settings.tesseract_url.rstrip("/")
        _paperless = getattr(unified_settings, "paperless", None)
        self.paperless_base_url = (
            _paperless.internal_url.rstrip("/")
            if _paperless
            else (os.environ.get("PAPERLESS_URL") or "").strip().rstrip("/")
        ) or ""
        _ocrmypdf = getattr(unified_settings, "ocrmypdf", None)
        self.ocrmypdf_base_url = (
            _ocrmypdf.internal_url.rstrip("/")
            if _ocrmypdf
            else (os.environ.get("OCRMYPDF_URL") or "").strip().rstrip("/")
        ) or ""
        minio_endpoint_raw = unified_settings.minio_endpoint
        parsed_minio = urlparse(minio_endpoint_raw if "://" in minio_endpoint_raw else f"http://{minio_endpoint_raw}")
        self.minio_endpoint = parsed_minio.netloc or parsed_minio.path or minio_endpoint_raw
        if ":" not in self.minio_endpoint:
            self.minio_endpoint = f"{self.minio_endpoint}:{unified_settings.minio.internal_port}"
        self.minio_secure = parsed_minio.scheme == "https" if parsed_minio.scheme else unified_settings.minio_secure
        self.minio_access_key = unified_settings.minio_access_key
        self.minio_secret_key = unified_settings.minio_secret_key

        self.initialized = False

    async def initialize(self) -> None:
        """
        Initialize all service connections

        Uses graceful degradation - failures don't stop initialization
        """
        if self.initialized:
            return

        logger.info("Initializing Elite Editor Orchestrator...")

        # Use central HTTP client (closed at app shutdown)
        self.http_client = get_httpx_client()

        # Initialize services concurrently
        await asyncio.gather(
            self._init_postgres(),
            self._init_redis(),
            self._init_elasticsearch(),
            self._init_minio(),
            self._check_llama(),
            self._check_tika(),
            self._check_gotenberg(),
            self._check_tesseract(),
            self._check_paperless(),
            return_exceptions=True,
        )

        # Initialize Unified Content System adapter
        if self.pg_pool is not None:
            try:
                storage_factory = get_storage_factory(self.pg_pool)
                audit_logger = AuditLogger(self.pg_pool)
                content_service = ContentStorageService(
                    db_pool=self.pg_pool, storage_factory=storage_factory, audit_logger=audit_logger
                )
                version_manager = VersionManager(self.pg_pool, storage_factory)
                self.unified_adapter = EliteEditorUnifiedAdapter(
                    content_service=content_service,
                    version_manager=version_manager,
                    db_pool=self.pg_pool,
                )
                logger.info("Unified Content adapter initialized")
            except Exception:
                logger.exception("Failed to initialize Unified Content adapter")

        self.initialized = True

        # Log initialization summary
        active_services = [name for name, status in self.services_status.items() if status]
        logger.info(
            "Orchestrator initialized. Active services: %s/%s",
            len(active_services),
            len(self.services_status),
        )
        logger.info("   Active: %s", ", ".join(active_services))

    async def _init_postgres(self) -> None:
        """Attach shared asyncpg pool from DatabaseManager."""
        try:
            manager = await get_database_manager()
            self.pg_pool = await manager.get_asyncpg_pool()
            pool = self.pg_pool
            if pool is None:
                raise ValueError("asyncpg pool not available")
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            self.services_status["postgres"] = True
            logger.info("PostgreSQL connected (DatabaseManager asyncpg pool)")
        except Exception:
            logger.exception("PostgreSQL initialization failed")
            self.pg_pool = None
            self.services_status["postgres"] = False

    async def _init_redis(self) -> None:
        """Initialize Redis via DatabaseManager shared pool."""
        try:
            manager = await get_database_manager()
            self.redis_client = await manager.get_redis_client()
            if self.redis_client is not None:
                await self.redis_client.ping()
            else:
                raise ValueError("Redis client not initialized")
            self.services_status["redis"] = True
            logger.info("Redis connected (DatabaseManager)")
        except Exception:
            logger.exception("Redis initialization failed")

    async def _init_elasticsearch(self) -> None:
        """Initialize Elasticsearch client via global DatabaseManager."""
        try:
            manager = await get_database_manager()
            self.es_client = manager.get_elasticsearch_client()
            self.services_status["elasticsearch"] = True
            logger.info("Elasticsearch client acquired from DatabaseManager")
        except Exception:
            logger.exception("Elasticsearch initialization via DatabaseManager failed")
            self.es_client = None

    async def _init_minio(self) -> None:
        """Initialize MinIO/SeaweedFS client via global DatabaseManager."""
        try:
            manager = await get_database_manager()
            self.minio_client = manager.get_minio_client()
            self.services_status["minio"] = True
            logger.info("MinIO/SeaweedFS client acquired from DatabaseManager")
        except Exception:
            logger.exception("MinIO initialization via DatabaseManager failed")
            self.minio_client = None

    async def _check_elasticsearch(self) -> None:
        """Check Elasticsearch availability"""
        if not self.http_client:
            self.services_status["elasticsearch"] = False
            logger.warning("HTTP client not initialized for Elasticsearch check")
            return
        try:
            response = await self.http_client.get(f"{self.elasticsearch_base_url}/_cluster/health")  # type: ignore[union-attr]
            if response.status_code == HTTP_OK_STATUS:  # type: ignore[union-attr]
                self.services_status["elasticsearch"] = True
                logger.info("Elasticsearch available")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Elasticsearch not available: %s", e)

    async def _check_llama(self) -> None:
        """Check Llama availability"""
        if not self.http_client:
            self.services_status["llama"] = False
            logger.warning("HTTP client not initialized for Llama check")
            return
        try:
            base = self.llama_base_url.rstrip("/")
            for path in ("/v1/models", "/api/tags"):
                response = await self.http_client.get(f"{base}{path}")  # type: ignore[union-attr]
                if response.status_code != HTTP_OK_STATUS:  # type: ignore[union-attr]
                    continue
                data = response.json()
                models = data.get("data", []) or data.get("models", [])
                self.services_status["llama"] = True
                logger.info("LLM available (%s models)", len(models))
                return
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Llama not available: %s", e)

    async def _check_tika(self) -> None:
        """Check Tika availability"""
        if not self.http_client:
            self.services_status["tika"] = False
            logger.warning("HTTP client not initialized for Tika check")
            return
        try:
            response = await self.http_client.get(f"{self.tika_base_url}/tika")  # type: ignore[union-attr]
            if response.status_code == HTTP_OK_STATUS:  # type: ignore[union-attr]
                self.services_status["tika"] = True
                logger.info("Tika available")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Tika not available: %s", e)

    async def _check_gotenberg(self) -> None:
        """Check Gotenberg availability"""
        if not self.http_client:
            self.services_status["gotenberg"] = False
            logger.warning("HTTP client not initialized for Gotenberg check")
            return
        try:
            response = await self.http_client.get(f"{self.gotenberg_base_url}/health")  # type: ignore[union-attr]
            if response.status_code == HTTP_OK_STATUS:  # type: ignore[union-attr]
                self.services_status["gotenberg"] = True
                logger.info("Gotenberg available")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Gotenberg not available: %s", e)

    async def _check_tesseract(self) -> None:
        """Check Tesseract server availability"""
        if not self.http_client:
            self.services_status["tesseract"] = False
            logger.warning("HTTP client not initialized for Tesseract check")
            return
        try:
            response = await self.http_client.get(f"{self.tesseract_base_url}/")  # type: ignore[union-attr]
            if response.status_code in [HTTP_OK_STATUS, HTTP_METHOD_NOT_ALLOWED]:  # type: ignore[union-attr]  # 405 = method not allowed but server alive
                self.services_status["tesseract"] = True
                logger.info("Tesseract available")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Tesseract not available: %s", e)

    async def _check_paperless(self) -> None:
        """Check Paperless-ngx availability"""
        if not self.http_client:
            self.services_status["paperless"] = False
            logger.warning("HTTP client not initialized for Paperless check")
            return
        try:
            response = await self.http_client.get(f"{self.paperless_base_url}/api/")  # type: ignore[union-attr]
            if response.status_code == HTTP_OK_STATUS:  # type: ignore[union-attr]
                self.services_status["paperless"] = True
                logger.info("Paperless available")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning("Paperless not available: %s", e)

    # ========================================
    # HEALTH CHECK METHODS
    # ========================================

    async def check_all_services(self) -> dict[str, Any]:
        """
        Comprehensive health check of all services

        Returns:
            (dict[str, Any])ionary with health status of each service
        """
        await asyncio.gather(
            self._check_postgres_health(),
            self._check_redis_health(),
            self._check_elasticsearch_health(),
            self._check_llama_health(),
            self._check_tika_health(),
            self._check_gotenberg_health(),
            return_exceptions=True,
        )

        return {
            "overall_health": any(self.services_status.values()),
            "critical_services": {
                "postgres": self.services_status["postgres"],
                "redis": self.services_status["redis"],
            },
            "processing_services": {
                "tika": self.services_status["tika"],
                "llama": self.services_status["llama"],
                "gotenberg": self.services_status["gotenberg"],
            },
            "optional_services": {
                "elasticsearch": self.services_status["elasticsearch"],
                "tesseract": self.services_status["tesseract"],
                "paperless": self.services_status["paperless"],
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }

    async def _check_postgres_health(self) -> bool:
        """Check PostgreSQL health"""
        try:
            if self.pg_pool:
                async with self.pg_pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                return True
        except (asyncpg.PostgresError, TimeoutError):  # fmt: skip
            self.services_status["postgres"] = False
        return False

    async def _check_redis_health(self) -> bool:
        """Check Redis health"""
        try:
            if self.redis_client:
                await self.redis_client.ping()
                return True
        except (aioredis.ConnectionError, aioredis.TimeoutError):  # fmt: skip
            self.services_status["redis"] = False
        return False

    async def _check_elasticsearch_health(self) -> bool:
        """Check Elasticsearch health"""
        if self.http_client is None:
            return False
        try:
            response = await self.http_client.get(  # type: ignore[union-attr]
                f"{self.elasticsearch_base_url}/_cluster/health", timeout=TIMEOUT_HEALTH_CHECK
            )
        except (httpx.RequestError, httpx.TimeoutException):  # fmt: skip
            return False
        else:
            return response.status_code == HTTP_OK_STATUS  # type: ignore[union-attr]

    async def _check_llama_health(self) -> bool:
        """Check Llama health"""
        if self.http_client is None:
            return False
        try:
            base = self.llama_base_url.rstrip("/")
            for path in ("/v1/models", "/api/tags"):
                response = await self.http_client.get(f"{base}{path}", timeout=TIMEOUT_HEALTH_CHECK)  # type: ignore[union-attr]
                if response.status_code == HTTP_OK_STATUS:  # type: ignore[union-attr]
                    return True
        except (httpx.RequestError, httpx.TimeoutException):  # fmt: skip
            pass
        return False

    async def _check_tika_health(self) -> bool:
        """Check Tika health"""
        if self.http_client is None:
            return False
        try:
            response = await self.http_client.get(f"{self.tika_base_url}/tika", timeout=TIMEOUT_HEALTH_CHECK)  # type: ignore[union-attr]
        except (httpx.RequestError, httpx.TimeoutException):  # fmt: skip
            return False
        else:
            return response.status_code == HTTP_OK_STATUS  # type: ignore[union-attr]

    async def _check_gotenberg_health(self) -> bool:
        """Check Gotenberg health"""
        if self.http_client is None:
            return False
        try:
            response = await self.http_client.get(f"{self.gotenberg_base_url}/health", timeout=TIMEOUT_HEALTH_CHECK)  # type: ignore[union-attr]
        except (httpx.RequestError, httpx.TimeoutException):  # fmt: skip
            return False
        else:
            return response.status_code == HTTP_OK_STATUS  # type: ignore[union-attr]

    async def get_detailed_status(self) -> dict[str, Any]:
        """Get detailed status of all services with metrics"""
        status: dict[str, Any] = {"orchestrator_initialized": self.initialized, "services": {}}

        for service_name, is_available in self.services_status.items():
            services_dict: dict[str, Any] = status["services"]  # type: ignore[assignment]
            services_dict[service_name] = {
                "available": is_available,
                "status": "healthy" if is_available else "unavailable",
            }

        # Add connection pool stats
        if self.pg_pool:
            status["postgres_pool"] = {
                "size": self.pg_pool.get_size(),
                "free": self.pg_pool.get_idle_size(),
            }

        return status

    # ========================================
    # DOCUMENT PROCESSING - MAIN WORKFLOW
    # ========================================

    async def process_document(
        self, file_name: str, file_type: str, file_data: str, user_id: str, options: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Main document processing pipeline

        Pipeline stages:
        1. Text extraction (Tika → Document AI fallback)
        2. OCR if needed (Tesseract → OCRmyPDF)
        3. Table/image extraction
        4. AI analysis (optional)
        5. Pattern extraction (questions, JSON flags)
        6. Storage (PostgreSQL + optional Paperless/MinIO)
        7. Indexing (Elasticsearch + optional embeddings)

        Args:
            file_name: Original filename
            file_type: File extension
            file_data: Base64 encoded file content
            user_id: User ID from authentication
            options: Processing options dict

        Returns:
            Processing result with extracted content and metadata
        """
        document_id = str(uuid4())
        start_time = datetime.now(UTC)
        services_used = []

        logger.info("Processing document: %s (ID: %s)", file_name, document_id)

        result: dict[str, Any] = {
            "document_id": document_id,
            "text_content": "",
            "html_content": None,
            "tables": [],
            "images": [],
            "questions": [],
            "json_flags": [],
            "ai_analysis": None,
            "extraction_method": "unknown",
            "ocr_performed": False,
            "services_used": [],
            "postgres_id": None,
            "paperless_id": None,
            "minio_url": None,
            "elasticsearch_indexed": False,
        }

        # Stage 1: Text Extraction
        if options.get("extract_text", True):
            text_result = await self._extract_text_with_fallback(
                file_data, file_type, perform_ocr=options.get("perform_ocr", False)
            )
            result["text_content"] = text_result["text"]
            result["html_content"] = text_result.get("html")
            result["extraction_method"] = text_result["method"]
            result["ocr_performed"] = text_result.get("ocr_performed", False)
            services_used.extend(text_result["services_used"])

        # Stage 2: Table Extraction
        text_content: str = result.get("text_content", "") or ""
        if options.get("extract_tables", False) and text_content:
            tables = await self._extract_tables(file_data, file_type)
            result["tables"] = tables

        # Stage 3: Pattern Extraction
        if options.get("extract_questions", False) and text_content:
            questions = self._extract_questions_pattern(text_content)
            result["questions"] = questions

        if options.get("extract_json_flags", False) and text_content:
            json_flags = self._extract_json_patterns(text_content)
            result["json_flags"] = json_flags

        # Stage 4: AI Analysis
        if options.get("enable_ai", False) and text_content:
            ai_result = await self._analyze_with_ai(
                text_content,
                options.get("ai_prompt"),
                options.get("ai_model", DEFAULT_MODEL),
                user_id=user_id,
            )
            result["ai_analysis"] = ai_result
            if ai_result:
                services_used.append("ugs")
                if ai_result.get("source") == "llama":
                    services_used.append("llama")

        # Stage 5: Storage
        if options.get("save_to_db", True) and self.services_status["postgres"]:
            pg_id = await self._save_to_postgres(
                document_id=document_id,
                user_id=user_id,
                title=file_name,
                content=text_content,
                file_type=file_type,
                metadata={
                    "html_content": result.get("html_content"),
                    "tables": result.get("tables", []),
                    "questions": result.get("questions", []),
                    "json_flags": result.get("json_flags", []),
                    "ai_analysis": result.get("ai_analysis"),
                    "extraction_method": result.get("extraction_method", "unknown"),
                },
            )
            if pg_id:
                result["postgres_id"] = pg_id
            services_used.append("postgres")

        # Stage 6: Elasticsearch Indexing
        if options.get("index_elasticsearch", True) and self.services_status["elasticsearch"]:
            indexed = await self._index_in_elasticsearch(document_id, text_content, file_name, user_id)
            result["elasticsearch_indexed"] = indexed
            if indexed:
                services_used.append("elasticsearch")

        result["services_used"] = list(set(services_used))

        processing_time = (datetime.now(UTC) - start_time).total_seconds()
        services_str = ", ".join(services_used)
        logger.info(
            "Document processed in %.2fs (services: %s)",
            processing_time,
            services_str,
        )

        return result

    # ========================================
    # TEXT EXTRACTION WITH FALLBACK CHAIN
    # ========================================

    async def _extract_text_with_fallback(self, file_data: str, file_type: str, *, perform_ocr: bool) -> dict[str, Any]:
        """
        Extract text with fallback chain: Tika → Document AI → OCR

        Args:
            file_data: Base64 encoded file
            file_type: File extension
            perform_ocr: Whether to perform OCR if no text found

        Returns:
            Extraction result with text, method used, and services
        """

        # Try Tika first (primary)
        if self.services_status["tika"]:
            try:
                logger.info("Attempting text extraction with Tika...")
                tika_result = await self._extract_with_tika(file_data, file_type)

                if tika_result and len(tika_result.get("text", "").strip()) > 0:
                    text_len = len(tika_result["text"])
                    logger.info("Tika extracted %s characters", text_len)
                    return {
                        "text": tika_result["text"],
                        "html": tika_result.get("html"),
                        "method": "tika",
                        "services_used": ["tika"],
                        "ocr_performed": False,
                    }
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.warning("Tika extraction failed: %s", e)

        # Try Document AI (fallback)
        if self.services_status.get("document_ai", False):
            try:
                logger.info("Attempting text extraction with Document AI...")
                doc_ai_result = await self._extract_with_document_ai(file_data, file_type)

                if doc_ai_result and len(doc_ai_result.get("text", "").strip()) > 0:
                    text_len = len(doc_ai_result["text"])
                    logger.info("Document AI extracted %s characters", text_len)
                    return {
                        "text": doc_ai_result["text"],
                        "html": None,
                        "method": "document_ai",
                        "services_used": ["document_ai"],
                        "ocr_performed": False,
                    }
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.warning("Document AI extraction failed: %s", e)

        # Perform OCR if enabled and no text found
        if perform_ocr:
            logger.info("No text found, attempting OCR...")
            ocr_result = await self._perform_ocr_with_fallback(file_data, file_type)

            if ocr_result and len(ocr_result.get("text", "").strip()) > 0:
                return {
                    "text": ocr_result["text"],
                    "html": None,
                    "method": ocr_result["method"],
                    "services_used": ocr_result["services_used"],
                    "ocr_performed": True,
                }

        # No text extracted
        logger.warning("No text could be extracted from document")
        return {
            "text": "",
            "html": None,
            "method": "none",
            "services_used": [],
            "ocr_performed": False,
        }

    async def _extract_with_tika(self, file_data: str, file_type: str) -> dict[str, str] | None:  # noqa: ARG002
        """Extract text using Apache Tika"""
        if self.http_client is None:
            return None
        try:
            # Decode base64
            file_bytes = base64.b64decode(file_data)

            tika_url = f"{self.tika_base_url.rstrip('/')}/tika"
            # Send to Tika (text extraction)
            response = await self.http_client.put(  # type: ignore[union-attr]
                tika_url,
                content=file_bytes,
                headers={"Accept": "text/plain"},
                timeout=60.0,
            )

            if response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                text = response.text  # type: ignore[attr-defined]

                # Also get HTML version
                html_response = await self.http_client.put(  # type: ignore[union-attr]
                    tika_url,
                    content=file_bytes,
                    headers={"Accept": "text/html"},
                    timeout=TIMEOUT_FILE_PROCESSING,
                )

                html: str | None = None
                if html_response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                    html = html_response.text  # type: ignore[attr-defined]

                return {"text": text, "html": html}  # type: ignore[dict-item]  # html может быть None

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError):  # fmt: skip
            logger.exception("Tika extraction error")

        return None

    async def _extract_with_document_ai(self, file_data: str, file_type: str) -> dict[str, str] | None:
        """Extract text using Document AI service (Stack 4)"""
        if self.http_client is None:
            return None
        try:
            response = await self.http_client.post(  # type: ignore[union-attr]
                f"{(os.environ.get('DOCUMENT_AI_URL') or '').strip().rstrip('/')}/extract",
                json={"file_data": file_data, "file_type": file_type},
                timeout=60.0,
            )

            if response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                data = response.json()  # type: ignore[attr-defined]
                return {"text": data.get("text", "")}

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError):  # fmt: skip
            logger.exception("Document AI extraction error")

        return None

    # ========================================
    # OCR WITH FALLBACK CHAIN
    # ========================================

    async def _perform_ocr_with_fallback(
        self, file_data: str, file_type: str, language: str = "eng+rus"
    ) -> dict[str, Any] | None:
        """
        Perform OCR with fallback: Tesseract → OCRmyPDF
        """
        # Try Tesseract first
        if self.services_status["tesseract"]:
            try:
                logger.info("Attempting OCR with Tesseract...")
                result = await self._ocr_with_tesseract(file_data, language)
                if result:
                    return {
                        "text": result,
                        "method": "tesseract_ocr",
                        "services_used": ["tesseract"],
                    }
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.warning("Tesseract OCR failed: %s", e)

        # Try OCRmyPDF for PDFs
        if file_type.lower() in [".pdf", "pdf"]:
            try:
                logger.info("Attempting OCR with OCRmyPDF...")
                result = await self._ocr_with_ocrmypdf(file_data, language)
                if result:
                    return {"text": result, "method": "ocrmypdf", "services_used": ["ocrmypdf"]}
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.warning("OCRmyPDF failed: %s", e)

        return None

    async def _ocr_with_tesseract(self, file_data: str, language: str) -> str | None:
        """Perform OCR using Tesseract server via Stack4 gateway."""
        from api.services.stack4 import Stack4DocumentGateway

        try:
            file_bytes = base64.b64decode(file_data)
            gateway = Stack4DocumentGateway(client=self.http_client)
            text = await gateway.ocr_image_to_text(file_bytes, "document.png", lang=language)
            return text or None
        except Exception:
            logger.exception("Tesseract OCR error")
        return None

    async def _ocr_with_ocrmypdf(self, file_data: str, language: str) -> str | None:
        """Perform OCR using OCRmyPDF service via Stack4 gateway."""
        from api.services.stack4 import Stack4DocumentGateway

        try:
            file_bytes = base64.b64decode(file_data)
            gateway = Stack4DocumentGateway(client=self.http_client)
            text = await gateway.ocr_pdf_to_text(file_bytes, "document.pdf", ocr_lang=language)
            return text or None
        except Exception:
            logger.exception("OCRmyPDF error")
        return None

    # ========================================
    # TABLE EXTRACTION
    # ========================================

    async def _extract_tables(self, file_data: str, file_type: str) -> list[dict[str, Any]]:  # noqa: ARG002
        """
        Extract tables from document using Tika HTML output

        Returns list of tables with structure:
        [
            {
                "table_id": "table_1",
                "rows": [[cell1, cell2, ...], ...],
                "headers": [header1, header2, ...],
                "row_count": N,
                "col_count": M
            }
        ]
        """
        if not self.services_status.get("tika"):
            logger.warning("Tika not available for table extraction")
            return []

        try:
            # Decode base64
            file_bytes = base64.b64decode(file_data)

            # Get HTML version from Tika (contains table structure)
            if self.http_client is None:
                return []
            response = await self.http_client.put(  # type: ignore[union-attr]
                f"{self.tika_base_url.rstrip('/')}/tika",
                content=file_bytes,
                headers={"Accept": "text/html"},
                timeout=60.0,
            )

            if response.status_code != HTTP_OK_STATUS:  # type: ignore[attr-defined]
                logger.error("Tika HTML extraction failed: %s", response.status_code)  # type: ignore[attr-defined]
                return []

            html_content = response.text  # type: ignore[attr-defined]

            # Parse HTML tables using BeautifulSoup-like approach
            # Since we can't import BS4, use simple regex parsing

            tables = []
            table_pattern = re.compile(r"<table[^>]*>(.*?)</table>", re.DOTALL | re.IGNORECASE)
            table_matches = table_pattern.findall(html_content)

            for idx, table_html in enumerate(table_matches):
                # Extract rows
                row_pattern = re.compile(r"<tr[^>]*>(.*?)</tr>", re.DOTALL | re.IGNORECASE)
                rows_html = row_pattern.findall(table_html)

                if not rows_html:
                    continue

                # Parse cells (both <td> and <th>)
                cell_pattern = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.DOTALL | re.IGNORECASE)

                parsed_rows = []
                headers: list[str] = []

                for row_idx, row_html in enumerate(rows_html):
                    cells = cell_pattern.findall(row_html)

                    # Clean cell content (remove HTML tags)
                    cleaned_cells = []
                    for cell in cells:
                        # Remove HTML tags
                        clean_cell = re.sub(r"<[^>]+>", "", cell)
                        # Decode HTML entities
                        clean_cell = clean_cell.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">")
                        clean_cell = clean_cell.strip()
                        cleaned_cells.append(clean_cell)

                    # First row with <th> tags is header
                    headers = cleaned_cells if row_idx == 0 and "<th" in row_html.lower() else headers
                    if not (row_idx == 0 and "<th" in row_html.lower()):
                        parsed_rows.append(cleaned_cells)

                # Determine dimensions
                row_count = len(parsed_rows)
                col_count = max(len(row) for row in parsed_rows) if parsed_rows else 0

                if row_count > 0 and col_count > 0:
                    table_data = {
                        "table_id": f"table_{idx + 1}",
                        "rows": parsed_rows,
                        "headers": headers if headers else [f"Column {i + 1}" for i in range(col_count)],
                        "row_count": row_count,
                        "col_count": col_count,
                    }
                    tables.append(table_data)
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError):  # fmt: skip
            logger.exception("Table extraction error")
            return []
        else:
            logger.info("Extracted %s tables from document", len(tables))
            return tables

    def _build_document_html(self, content: str, tables: list[dict[str, Any]]) -> str:
        """
        Build HTML representation of document with content and tables

        Args:
            content: Plain text content
            tables: List of table dictionaries from _extract_tables()

        Returns:
            HTML string with formatted content and tables
        """
        html_parts = []

        # Add content
        if content:
            html_parts.append(f'<div class="content">{content}</div>')

        # Add tables
        for table in tables:
            table_html = ["<table>"]

            # Add headers if present
            if table.get("headers"):
                table_html.append("  <thead>")
                table_html.append("    <tr>")
                table_html.extend(f"      <th>{header}</th>" for header in table["headers"])
                table_html.append("    </tr>")
                table_html.append("  </thead>")

            # Add body
            table_html.append("  <tbody>")
            for row in table.get("rows", []):
                table_html.append("    <tr>")
                table_html.extend(f"      <td>{cell}</td>" for cell in row)
                table_html.append("    </tr>")
            table_html.append("  </tbody>")

            table_html.append("</table>")
            html_parts.append("\n".join(table_html))

        return "\n".join(html_parts)

    def _clean_tika_html(self, tika_html: str) -> str:
        """
        Clean Tika HTML output - extract body content only

        Args:
            tika_html: Raw HTML from Tika with <html><head><body> structure

        Returns:
            Cleaned HTML body content suitable for insertion into template
        """
        # Extract body content
        body_match = re.search(r"<body[^>]*>(.*?)</body>", tika_html, re.DOTALL | re.IGNORECASE)
        body_content = body_match.group(1) if body_match else tika_html

        # Clean up empty paragraphs
        body_content = re.sub(r"<p>\s*</p>", "", body_content)
        body_content = re.sub(r"<p/>", "", body_content)

        return body_content.strip()

    def _build_markdown_tables(self, tables: list[dict[str, Any]]) -> str:
        """Build Markdown representation of tables"""
        md_parts = []

        for table in tables:
            table_md = []

            # Headers
            if table.get("headers"):
                table_md.append("| " + " | ".join(table["headers"]) + " |")
                table_md.append("| " + " | ".join(["---"] * len(table["headers"])) + " |")

            # Rows
            table_md.extend("| " + " | ".join(row) + " |" for row in table.get("rows", []))

            md_parts.append("\n".join(table_md))

        return "\n\n".join(md_parts)

    def _build_text_tables(self, tables: list[dict[str, Any]]) -> str:
        """Build plain text ASCII representation of tables"""
        text_parts = []

        for table in tables:
            rows = table.get("rows", [])
            headers = table.get("headers", [])
            all_rows = [headers, *rows] if headers else rows

            if not all_rows:
                continue

            # Calculate column widths
            col_widths = []
            num_cols = max(len(row) for row in all_rows)
            for col_idx in range(num_cols):
                max_width = max((len(str(row[col_idx])) if col_idx < len(row) else 0) for row in all_rows)
                col_widths.append(max_width)

            # Build separator
            separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"

            # Build table
            table_lines = [separator]
            for row_idx, row in enumerate(all_rows):
                cells = []
                for col_idx, width in enumerate(col_widths):
                    cell = str(row[col_idx]) if col_idx < len(row) else ""
                    cells.append(f" {cell.ljust(width)} ")
                table_lines.append("|" + "|".join(cells) + "|")

                # Add separator after headers
                if headers and row_idx == 0:
                    table_lines.append(separator)

            table_lines.append(separator)
            text_parts.append("\n".join(table_lines))

        return "\n\n".join(text_parts)

    # ========================================
    # PATTERN EXTRACTION
    # ========================================

    def _extract_questions_pattern(self, text: str) -> list[dict[str, Any]]:
        """Extract )*(...)*( question patterns from text"""
        pattern = r"\)\*\((.*?)\)\*\("
        matches = re.finditer(pattern, text)

        questions = []
        for i, match in enumerate(matches):
            questions.append(
                {
                    "id": f"q_{i + 1}",
                    "question": match.group(1).strip(),
                    "position": {"start": match.start(), "end": match.end()},
                    "filled": False,
                }
            )

        logger.info("Extracted %s question patterns", len(questions))
        return questions

    def _extract_json_patterns(self, text: str) -> list[dict[str, Any]]:
        """Extract {JSON(...)} flag patterns from text"""
        pattern = r"\{JSON\((.*?)\)\}"
        matches = re.finditer(pattern, text, re.IGNORECASE)

        flags = []
        for i, match in enumerate(matches):
            flags.append(
                {
                    "id": f"json_{i + 1}",
                    "content": match.group(1).strip(),
                    "position": {"start": match.start(), "end": match.end()},
                    "filled": False,
                }
            )

        logger.info("Extracted %s JSON flag patterns", len(flags))
        return flags

    # ========================================
    # AI ANALYSIS
    # ========================================

    async def _generate_text_via_ugs(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        user_id: str | None = None,
    ) -> str | None:
        """Helper to execute text generation through the UGS hub."""

        safe_temperature = max(0.0, min(float(temperature), 2.0))
        num_predict = int(max_tokens) if max_tokens else 1024
        if num_predict <= 0:
            num_predict = 512

        try:
            manager = await get_database_manager()
            async with (
                manager.get_postgres_session() as session,
                UnifiedGenerationService(session) as ugs_service,
            ):
                generation = await ugs_service.generate_and_wait(
                    user_id=user_id or "elite_editor_system",
                    type_key="text_chat_response",
                    input_data={
                        "prompt": prompt,
                        "model": model,
                        "options": {"temperature": safe_temperature, "num_predict": num_predict},
                    },
                    priority=5,
                    timeout_seconds=120.0,
                    poll_interval=1.0,
                )
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
            logger.warning("UGS text generation failed: %s", e)
            return None

        payload: Any = generation.get("result") or generation.get("result_preview") or generation

        if isinstance(payload, dict):
            return (
                payload.get("response") or payload.get("content") or payload.get("text") or payload.get("result_text")
            )

        if isinstance(payload, str):
            return payload

        return None

    async def _analyze_with_ai(
        self,
        text: str,
        custom_prompt: str | None,
        model: str,
        user_id: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> dict[str, Any] | None:
        """Analyze document using the UGS hub with Llama fallback."""

        prompt = custom_prompt or f"Analyze this document and provide a summary:\n\n{text[:4000]}"

        try:
            ugs_response = await self._generate_text_via_ugs(
                prompt=prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                user_id=user_id,
            )

            if ugs_response is not None:
                return {"summary": ugs_response, "model": model, "tokens": None, "source": "ugs"}
        except Exception:
            logger.exception("UGS analysis fallback triggered")

        if not self.services_status["llama"]:
            logger.warning("Llama not available for AI analysis fallback")
            return None

        if self.http_client is None:
            return None
        try:
            data = await httpx_compat_generate_json(
                self.http_client,  # type: ignore[arg-type]
                self.llama_base_url,
                model=model,
                prompt=prompt,
                system=None,
                options={"temperature": temperature, "num_predict": max_tokens},
                json_format=False,
                keep_alive=None,
                timeout=httpx.Timeout(120.0, connect=10.0),
            )
            return {
                "summary": data.get("response", ""),
                "model": model,
                "tokens": data.get("eval_count", 0),
                "source": "llama",
            }

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError, RuntimeError):  # fmt: skip
            logger.exception("AI analysis error")

        return None

    # ========================================
    # AI AUTO-FILL METHODS (V2 - Phase 4.1)
    # ========================================

    def extract_fillable_fields(self, content: str) -> list[dict[str, Any]]:
        """
        Extract all fillable fields from document content

        Detects 3 types of patterns:
        1. )*(...)*( - standard pattern (most common)
        2. [FIELD_NAME] - bracket pattern
        3. _______ - underline pattern (3+ underscores)

        Returns:
            List of field objects: {id, type, label, position, current_value, hint}
        """
        fields = []
        field_counter = 0

        # Pattern 1: )*(...)*( - standard pattern
        standard_pattern = r"\)\*\((.*?)\)\*\("
        for match in re.finditer(standard_pattern, content):
            field_counter += 1
            label = match.group(1).strip()

            fields.append(
                {
                    "id": f"field_{field_counter}",
                    "type": "standard",
                    "label": label if label else f"Field {field_counter}",
                    "position": {"start": match.start(), "end": match.end()},
                    "current_value": label if label else None,
                    "hint": self._infer_field_hint(content, match.start(), match.end()),
                }
            )

        # Pattern 2: [FIELD_NAME] - bracket pattern
        bracket_pattern = r"\[([A-Z_]+(?:\s+[A-Z_]+)*)\]"
        for match in re.finditer(bracket_pattern, content):
            # Skip if already captured by standard pattern
            match_start: int = match.start()  # type: ignore[assignment]
            if any(f["position"]["start"] == match_start for f in fields):  # type: ignore[index]
                continue

            field_counter += 1
            label = match.group(1).strip()

            fields.append(
                {
                    "id": f"field_{field_counter}",
                    "type": "bracket",
                    "label": label,
                    "position": {"start": match_start, "end": match.end()},  # type: ignore[assignment]
                    "current_value": None,
                    "hint": self._infer_field_hint(content, match_start, match.end()),  # type: ignore[arg-type]
                }
            )

        # Pattern 3: ___ - underline pattern (3+ underscores)
        underline_pattern = r"_{3,}"
        for match in re.finditer(underline_pattern, content):
            # Skip if already captured
            underline_start: int = match.start()  # type: ignore[assignment]
            if any(abs(f["position"]["start"] - underline_start) < FIELD_POSITION_TOLERANCE for f in fields):  # type: ignore[index,operator]
                continue

            field_counter += 1

            fields.append(
                {
                    "id": f"field_{field_counter}",
                    "type": "underline",
                    "label": f"Blank {field_counter}",
                    "position": {"start": underline_start, "end": match.end()},  # type: ignore[assignment]
                    "current_value": None,
                    "hint": self._infer_field_hint(content, underline_start, match.end()),  # type: ignore[arg-type]
                }
            )

        standard_count = sum(1 for f in fields if f["type"] == "standard")
        bracket_count = sum(1 for f in fields if f["type"] == "bracket")
        underline_count = sum(1 for f in fields if f["type"] == "underline")
        logger.info(
            "Extracted %s fillable fields: %s standard, %s bracket, %s underline",
            len(fields),
            standard_count,
            bracket_count,
            underline_count,
        )

        return fields

    def _infer_field_hint(self, content: str, start: int, end: int) -> str | None:  # noqa: ARG002
        """
        Infer hint for field based on surrounding context

        Looks at text before the field to extract labels like:
        "Дата: )*(...)*(" -> hint: "Дата"
        "Name: [NAME]" -> hint: "Name"
        """
        # Get chars before the field
        context_start = max(0, start - FIELD_CONTEXT_BEFORE)
        context = content[context_start:start]

        # Look for label pattern: "Label:" or "Label "
        label_match = re.search(r"([A-Za-z\s]+)[:\s]+$", context)
        if label_match:
            hint = label_match.group(1).strip()
            if len(hint) > 0 and len(hint) < MAX_FIELD_HINT_LENGTH:
                return hint

        return None

    async def ai_suggest_field_value(
        self,
        field: dict[str, Any],
        document_context: str,
        user_context: dict[str, Any],
        model: str = DEFAULT_MODEL,
        temperature: float = 0.7,
    ) -> str | None:
        """
        Generate suggested value for a single field using AI

        Args:
            field: Field object from extract_fillable_fields()
            document_context: Full document content for context
            user_context: Additional context (user_name, date, etc.)
            model: Llama model to use
            temperature: AI temperature (0.0-2.0)

        Returns:
            Suggested value or None if AI unavailable
        """
        field_label = field.get("label", "Unknown")
        field_hint = field.get("hint", "")
        field_type = field.get("type", "unknown")

        # Get surrounding context (100 chars before/after)
        position: dict[str, Any] = field.get("position", {})  # type: ignore[assignment]
        pos_start: int = position.get("start", 0)  # type: ignore[assignment]
        pos_end: int = position.get("end", 0)  # type: ignore[assignment]
        context_start = max(0, pos_start - 100)
        context_end = min(len(document_context), pos_end + 100)
        surrounding = document_context[context_start:context_end]

        prompt = (
            "You are filling out a document form. Generate ONLY the value for the specified field.\n\n"
            "Field Information:\n"
            f"- Field Label: {field_label}\n"
            f"- Field Type: {field_type}\n"
            f"- Hint: {field_hint or 'None'}\n\n"
            "Surrounding Context:\n"
            f"{surrounding}\n\n"
            "Additional Context:\n"
            f"{json.dumps(user_context, ensure_ascii=False, indent=2)}\n\n"
            "Instructions:\n"
            "1. Generate a concise, appropriate value for this field\n"
            "2. Output ONLY the value, no explanations or quotes\n"
            "3. If it's a date field, use YYYY-MM-DD format\n"
            "4. If it's a name field, use proper capitalization\n"
            "5. Keep the response under 50 characters unless necessary\n\n"
            "Value:"
        )

        try:
            ugs_value = await self._generate_text_via_ugs(
                prompt=prompt,
                model=model,
                temperature=temperature,
                max_tokens=100,
                user_id=str(user_context.get("user_id")) if user_context.get("user_id") else None,
            )
            if ugs_value is not None:
                suggested_value = ugs_value.strip("\"'").strip()
                logger.info("UGS suggested value for '%s': %s", field_label, suggested_value[:50])
                return suggested_value
        except Exception:
            logger.exception("UGS field suggestion fallback triggered")

        if not self.services_status["llama"]:
            logger.warning("Llama not available for AI suggestions fallback")
            return None

        if self.http_client is None:
            return None
        try:
            data = await httpx_compat_generate_json(
                self.http_client,  # type: ignore[arg-type]
                self.llama_base_url,
                model=model,
                prompt=prompt,
                system=None,
                options={"temperature": temperature, "num_predict": 100},
                json_format=False,
                keep_alive=None,
                timeout=httpx.Timeout(30.0, connect=10.0),
            )
            suggested_value = (data.get("response") or "").strip()
            suggested_value = suggested_value.strip("\"'").strip()
            logger.info("AI suggested value for '%s': %s", field_label, suggested_value[:50])
            return suggested_value
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError, RuntimeError):  # fmt: skip
            logger.exception("AI field suggestion error")

        return None

    async def ai_fill_document(
        self,
        document_id: str,
        user_id: str,
        fields_to_fill: list[str] | None = None,
        context: dict[str, Any] | None = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.7,
        *,
        preview: bool = True,
    ) -> dict[str, Any]:
        """
        AI auto-fill document fields

        Args:
            document_id: Document ID
            user_id: User ID
            fields_to_fill: Optional list of field IDs to fill (None = all)
            context: Additional context for AI
            model: Llama model
            temperature: AI temperature
            preview: If True, don't save changes (just return suggestions)

        Returns:
            {
                "filled_fields": {field_id: value},
                "total_fields": int,
                "filled_count": int,
                "preview": bool,
                "document_id": str
            }
        """
        start_time = datetime.now(UTC)

        # Get document
        document = await self.get_document(document_id, user_id)
        if not document:
            msg = "Document not found"
            raise ValueError(msg)

        content = document.get("content", "")

        # Extract fillable fields
        all_fields = self.extract_fillable_fields(content)

        if not all_fields:
            logger.warning("No fillable fields found in document")
            return {
                "filled_fields": {},
                "total_fields": 0,
                "filled_count": 0,
                "preview": preview,
                "document_id": document_id,
            }

        # Filter fields if specific IDs provided
        fields = [f for f in all_fields if f["id"] in fields_to_fill] if fields_to_fill else all_fields

        # Prepare context
        user_context = context or {}
        user_context.setdefault("current_date", datetime.now(UTC).strftime("%Y-%m-%d"))
        user_context.setdefault("user_id", user_id)

        # Generate suggestions for each field
        filled_fields = {}
        filled_count = 0

        for field in fields:
            suggested_value = await self.ai_suggest_field_value(
                field=field,
                document_context=content,
                user_context=user_context,
                model=model,
                temperature=temperature,
            )

            if suggested_value:
                filled_fields[field["id"]] = suggested_value
                filled_count += 1

        # Apply suggestions to document if not preview
        if not preview and filled_count > 0:
            # Replace field patterns with suggested values
            new_content = content
            # Sort by position DESC to avoid index shifting
            sorted_fields = sorted(
                [(fid, all_fields[int(fid.split("_")[1]) - 1]) for fid in filled_fields],
                key=lambda x: x[1]["position"]["start"],  # type: ignore[index]
                reverse=True,
            )

            for field_id, field in sorted_fields:
                value = filled_fields[field_id]
                field_position: dict[str, Any] = field.get("position", {})  # type: ignore[assignment]
                pos_start: int = field_position.get("start", 0)  # type: ignore[assignment]
                pos_end: int = field_position.get("end", 0)  # type: ignore[assignment]

                # Replace the pattern with the value
                new_content = new_content[:pos_start] + value + new_content[pos_end:]

            # Update document
            await self.update_document(
                document_id=document_id,
                user_id=user_id,
                updates={"content": new_content},
                create_revision=True,  # Save as new revision
            )

        processing_time = (datetime.now(UTC) - start_time).total_seconds()
        logger.info(
            "AI filled %s/%s fields in %.2fs (preview=%s)",
            filled_count,
            len(fields),
            processing_time,
            preview,
        )

        return {
            "filled_fields": filled_fields,
            "total_fields": len(all_fields),
            "filled_count": filled_count,
            "preview": preview,
            "document_id": document_id,
        }

    # ========================================
    # STORAGE METHODS
    # ========================================

    async def _save_to_postgres(
        self,
        document_id: str,
        user_id: str,
        title: str,
        content: str,
        file_type: str,
        metadata: dict[str, Any],
    ) -> str | None:
        """Save document to PostgreSQL"""
        if not self.pg_pool:
            return None

        try:
            async with self.pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO elite_documents (
                        id, user_id, title, content, document_type, metadata, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE
                    SET content = $4, metadata = $6, updated_at = NOW()
                """,
                    document_id,
                    user_id,
                    title,
                    content,
                    file_type,
                    json.dumps(metadata),
                )

        except (asyncpg.PostgresError, TimeoutError):  # fmt: skip
            logger.exception("PostgreSQL save error")
            return None
        else:
            logger.info("Document saved to PostgreSQL: %s", document_id)
            return document_id

    async def _index_in_elasticsearch(self, document_id: str, content: str, title: str, user_id: str) -> bool:
        """Index document in Elasticsearch"""
        if self.http_client is None:
            return False
        try:
            es_base = (DatabaseConfig.get_elasticsearch_url(internal=True)).rstrip("/")
            auth = (
                (unified_settings.elasticsearch_user, unified_settings.elasticsearch_password or "")
                if getattr(unified_settings, "elasticsearch_user", None)
                else None
            )
            response = await self.http_client.post(  # type: ignore[union-attr]
                f"{es_base}/elite_documents/_doc/{document_id}",
                json={
                    "title": title,
                    "content": content,
                    "user_id": user_id,
                    "indexed_at": datetime.now(UTC).isoformat(),
                },
                auth=auth,
                timeout=30.0,
            )

            if response.status_code in [HTTP_OK_STATUS, 201]:  # type: ignore[attr-defined]
                logger.info("Document indexed in Elasticsearch: %s", document_id)
                return True

        except (httpx.RequestError, httpx.HTTPStatusError):  # fmt: skip
            logger.exception("Elasticsearch indexing error")

        return False

    # ========================================
    # CRUD OPERATIONS
    # ========================================

    async def create_document(
        self,
        title: str,
        content: str,
        document_type: str,
        user_id: str,
        metadata: dict[str, Any] | None,
        tags: list[str],
    ) -> dict[str, Any]:
        """Create new document using unified_content"""
        if not self.unified_adapter:
            msg = "Unified Content adapter not available"
            raise RuntimeError(msg)

        return await self.unified_adapter.create_document(
            title=title,
            content=content,
            document_type=document_type,
            user_id=user_id,
            metadata=metadata,
            tags=tags,
        )

    async def list_documents(
        self,
        user_id: str,
        offset: int,
        limit: int,
        document_type: str | None,
        tags: list[str] | None,
        *,
        include_deleted: bool = False,
    ) -> list[dict[str, Any]]:
        """List user documents using unified_content"""
        if not self.unified_adapter:
            return []

        return await self.unified_adapter.list_documents(
            user_id=user_id,
            offset=offset,
            limit=limit,
            document_type=document_type,
            tags=tags,
            include_deleted=include_deleted,
        )

    async def get_document(self, document_id: str, user_id: str) -> dict[str, Any] | None:
        """Get document by ID using unified_content"""
        if not self.unified_adapter:
            return None

        return await self.unified_adapter.get_document(document_id, user_id)

    async def update_document(
        self,
        document_id: str,
        user_id: str,
        updates: dict[str, Any],
        *,
        create_revision: bool = True,  # noqa: ARG002
    ) -> dict[str, Any] | None:
        """Update document using unified_content"""
        if not self.unified_adapter:
            return None

        return await self.unified_adapter.update_document(document_id, user_id, updates)

    async def delete_document(
        self,
        document_id: str,
        user_id: str,
        *,
        soft_delete: bool = True,  # noqa: ARG002
    ) -> bool:
        """Delete document using unified_content (soft delete only)"""
        if not self.unified_adapter:
            return False

        return await self.unified_adapter.delete_document(document_id, user_id)

    async def search_documents(
        self,
        query: str,
        user_id: str,
        filters: dict[str, Any],
        search_options: dict[str, Any],  # noqa: ARG002
        offset: int,
        limit: int,
    ) -> dict[str, Any]:
        """Search documents using Elasticsearch or PostgreSQL fallback"""
        # Try Elasticsearch first, fallback to PostgreSQL
        if self.es_client:
            try:
                return await self._elasticsearch_search(query, user_id, filters, offset, limit)
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.warning("Elasticsearch search failed, falling back to PostgreSQL: %s", e)

        # PostgreSQL fallback
        return await self._postgres_search(query, user_id, filters, offset, limit)

    async def _elasticsearch_search(
        self, query: str, user_id: str, filters: dict[str, Any], offset: int, limit: int
    ) -> dict[str, Any]:
        """Search using Elasticsearch"""
        if not self.es_client:
            msg = "Elasticsearch client not available"
            raise RuntimeError(msg)

        search_body: dict[str, Any] = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "content", "tags"],
                                "type": "best_fields",
                                "operator": "or",
                            }
                        },
                        {"term": {"user_id": user_id}},
                    ],
                    "filter": [],
                }
            },
            "highlight": {"fields": {"content": {"fragment_size": 150, "number_of_fragments": 3}, "title": {}}},
            "from": offset,
            "size": limit,
        }

        # Add filters
        if filters.get("document_type"):
            filter_list = search_body["query"]["bool"]["filter"]  # type: ignore[index]
            if isinstance(filter_list, list):
                filter_list.append({"term": {"document_type": filters["document_type"]}})  # type: ignore[arg-type]

        if filters.get("tags"):
            filter_list = search_body["query"]["bool"]["filter"]  # type: ignore[index]
            if isinstance(filter_list, list):
                filter_list.append({"terms": {"tags": filters["tags"]}})  # type: ignore[arg-type]

        # Execute search
        result = await self.es_client.search(index="elite_documents", body=search_body)  # type: ignore[arg-type]

        # Transform results
        documents = []
        for hit in result["hits"]["hits"]:
            doc = hit["_source"]
            doc["id"] = hit["_id"]
            doc["score"] = hit["_score"]
            doc["highlights"] = hit.get("highlight", {})
            documents.append(doc)

        return {"results": documents, "total": result["hits"]["total"]["value"]}

    async def _postgres_search(
        self, query: str, user_id: str, filters: dict[str, Any], offset: int, limit: int
    ) -> dict[str, Any]:
        """PostgreSQL fallback search"""
        if not self.pg_pool:
            return {"results": [], "total": 0}

        try:
            async with self.pg_pool.acquire() as conn:
                # Build WHERE conditions
                conditions = ["user_id = $1"]
                params = [user_id]
                param_count = 1

                # Add search query
                if query:
                    param_count += 1
                    conditions.append(
                        "(title ILIKE $" + str(param_count) + " OR content ILIKE $" + str(param_count) + ")"
                    )
                    params.append(f"%{query}%")

                # Add filters
                if filters.get("document_type"):
                    param_count += 1
                    conditions.append("document_type = $" + str(param_count))
                    params.append(filters["document_type"])

                if filters.get("tags"):
                    # Handle array overlap for tags
                    tag_conditions = []
                    for tag in filters["tags"]:
                        param_count += 1
                        tag_conditions.append("$" + str(param_count))
                        params.append(tag)
                    conditions.append(f"tags && ARRAY[{', '.join(tag_conditions)}]")

                where_clause = " AND ".join(conditions)

                # Get total count
                count_query = f"SELECT COUNT(*) FROM elite_documents WHERE {where_clause}"  # noqa: S608
                total_row = await conn.fetchrow(count_query, *params)
                total: int = total_row["count"] if total_row else 0  # type: ignore[index]

                # Get results
                select_query = f"""
                    SELECT id, user_id, title, content, document_type, metadata, tags,
                           word_count, character_count, created_at, updated_at
                    FROM elite_documents
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ${param_count + 1} OFFSET ${param_count + 2}
                """  # noqa: S608
                params.extend([str(limit), str(offset)])  # Convert int to str for asyncpg params

                rows = await conn.fetch(select_query, *params)

                results = [
                    {
                        "id": str(row["id"]),
                        "user_id": row["user_id"],
                        "title": row["title"],
                        "content": row["content"] or "",
                        "document_type": row["document_type"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                        "tags": row["tags"] or [],
                        "word_count": row["word_count"],
                        "character_count": row["character_count"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                    }
                    for row in rows
                ]

                return {"results": results, "total": total}

        except (asyncpg.PostgresError, TimeoutError):  # fmt: skip
            logger.exception("Document search error")
            return {"results": [], "total": 0}

    # ========================================
    # TABLE EDITING METHODS (V2)
    # ========================================

    async def update_table(
        self, document_id: str, user_id: str, table_index: int, table_data: dict[str, Any]
    ) -> dict[str, Any] | None:
        """
        Update specific table in document

        Args:
            document_id: Document ID
            user_id: User ID
            table_index: Index of table in metadata.tables array (0-based)
            table_data: New table data {headers: [...], rows: [[...]]}
        """
        if not self.pg_pool:
            return None

        try:
            # Get current document
            doc = await self.get_document(document_id, user_id)
            if not doc:
                logger.error("Document %s not found", document_id)
                return None

            metadata = doc.get("metadata", {})
            tables = metadata.get("tables", [])

            if table_index < 0 or table_index >= len(tables):
                logger.error("Table index %s out of range (0-%s)", table_index, len(tables) - 1)
                return None

            # Update table
            tables[table_index] = {
                "table_id": tables[table_index].get("table_id", f"table_{table_index}"),
                "headers": table_data.get("headers", []),
                "rows": table_data.get("rows", []),
                "row_count": len(table_data.get("rows", [])),
                "col_count": len(table_data.get("headers", [])),
            }

            # Update metadata
            metadata["tables"] = tables

            # Save document with updated tables
            result = await self.update_document(
                document_id=document_id,
                user_id=user_id,
                updates={"metadata": metadata},
                create_revision=True,  # Create revision on table edit
            )

            if result:
                logger.info("Table %s updated in document %s", table_index, document_id)

        except Exception:
            logger.exception("Table update error")
            return None
        else:
            return result

    # ========================================
    # REVISION METHODS (V2)
    # ========================================

    async def get_revisions(self, document_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """
        Get revision history for document

        Args:
            document_id: Document ID
            user_id: User ID (for authorization)
            limit: Max number of revisions to return
        """
        if not self.pg_pool:
            return []

        try:
            async with self.pg_pool.acquire() as conn:
                # Verify user owns document
                doc = await conn.fetchrow(
                    """
                    SELECT id FROM elite_documents
                    WHERE id = $1 AND user_id = $2
                """,
                    document_id,
                    user_id,
                )

                if not doc:
                    logger.error("Document %s not found for user %s", document_id, user_id)
                    return []

                # Get revisions
                rows = await conn.fetch(
                    """
                    SELECT
                        id, revision_number, content, metadata,
                        change_summary, created_by, created_at, content_size
                    FROM elite_document_revisions
                    WHERE document_id = $1
                    ORDER BY revision_number DESC
                    LIMIT $2
                """,
                    document_id,
                    limit,
                )

                return [
                    {
                        "id": str(row["id"]),
                        "revision_number": row["revision_number"],
                        "content_preview": row["content"][:MAX_CONTENT_PREVIEW_LENGTH] + "..."
                        if len(row["content"]) > MAX_CONTENT_PREVIEW_LENGTH
                        else row["content"],
                        "content_size": row["content_size"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                        "change_summary": row["change_summary"],
                        "created_by": row["created_by"],
                        "created_at": row["created_at"].isoformat(),
                    }
                    for row in rows
                ]

        except Exception:
            logger.exception("Revision retrieval error")
            return []

    async def restore_revision(self, document_id: str, user_id: str, revision_number: int) -> dict[str, Any] | None:
        """
        Restore document to specific revision

        Args:
            document_id: Document ID
            user_id: User ID
            revision_number: Revision number to restore
        """
        if not self.pg_pool:
            return None

        try:
            async with self.pg_pool.acquire() as conn:
                # Get revision
                revision = await conn.fetchrow(
                    """
                    SELECT content, metadata
                    FROM elite_document_revisions
                    WHERE document_id = $1 AND revision_number = $2
                """,
                    document_id,
                    revision_number,
                )

                if not revision:
                    logger.error("Revision %s not found for document %s", revision_number, document_id)
                    return None

                # Restore document to revision state
                result = await self.update_document(
                    document_id=document_id,
                    user_id=user_id,
                    updates={
                        "content": revision["content"],
                        "metadata": json.loads(revision["metadata"]) if revision["metadata"] else {},
                    },
                    create_revision=True,  # This will create a NEW revision
                )

                if result:
                    logger.info("Document %s restored to revision %s", document_id, revision_number)

                return result

        except (asyncpg.PostgresError, TimeoutError):  # fmt: skip
            logger.exception("Revision restore error")
            return None

    async def export_document(
        self,
        document_id: str,
        export_format: str,
        options: dict[str, Any],  # noqa: ARG002
    ) -> dict[str, Any]:
        """
        Export document to specified format using Gotenberg

        Supports: PDF, DOCX, HTML, TXT, MD
        """
        if not self.pg_pool:
            msg = "PostgreSQL not available"
            raise RuntimeError(msg)

        # Get document
        async with self.pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, title, content, document_type, metadata
                FROM elite_documents
                WHERE id = $1
            """,
                document_id,
            )

            if not row:
                msg = "Document not found"
                raise ValueError(msg)

        title = row["title"]
        content = row["content"] or ""
        metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        tables = metadata.get("tables", [])
        html_content_raw = metadata.get("html_content")  # Original HTML from Tika

        # Create temp file path
        temp_dir = tempfile.gettempdir()

        if export_format in ["pdf", "docx"]:
            # Use Gotenberg for PDF/DOCX
            if not self.services_status.get("gotenberg"):
                msg = "Gotenberg not available"
                raise RuntimeError(msg)

            try:
                # Use original HTML from Tika if available (preserves table positions)
                if html_content_raw:
                    body_html = self._clean_tika_html(html_content_raw)
                else:
                    # Fallback: Build HTML from content + tables
                    body_html = self._build_document_html(content, tables)

                # Create HTML content for Gotenberg
                html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
        }}
        h1 {{
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }}
        .content {{
            white-space: pre-wrap;
            margin-bottom: 30px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #f3f4f6;
            font-weight: bold;
            color: #1f2937;
        }}
        tr:nth-child(even) {{
            background-color: #f9fafb;
        }}
        tr:hover {{
            background-color: #f3f4f6;
        }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {body_html}
</body>
</html>
"""

                if export_format == "pdf":
                    # Convert HTML to PDF via Gotenberg
                    if self.http_client is None:
                        msg = "HTTP client not available"
                        raise RuntimeError(msg)
                    response = await self.http_client.post(  # type: ignore[union-attr]
                        f"{self.gotenberg_base_url.rstrip('/')}/forms/chromium/convert/html",
                        files={"files": ("index.html", html_content.encode("utf-8"), "text/html")},  # type: ignore[arg-type]
                        data={  # type: ignore[arg-type]
                            "marginTop": "0.5",
                            "marginBottom": "0.5",
                            "marginLeft": "0.5",
                            "marginRight": "0.5",
                            "paperWidth": "8.27",
                            "paperHeight": "11.69",
                        },
                        timeout=TIMEOUT_FILE_PROCESSING,
                    )

                    if response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                        file_path = Path(temp_dir) / f"{document_id}.pdf"
                        file_path.write_bytes(response.content)  # type: ignore[attr-defined]

                        return {
                            "file_path": str(file_path),
                            "filename": f"{title}.pdf",
                            "media_type": "application/pdf",
                        }
                    msg = f"Gotenberg PDF conversion failed with status {response.status_code}"
                    raise RuntimeError(msg)  # type: ignore[attr-defined]

                if export_format == "docx":
                    # Convert HTML to DOCX via Gotenberg -> LibreOffice
                    if self.http_client is None:
                        msg = "HTTP client not available"
                        raise RuntimeError(msg)
                    response = await self.http_client.post(  # type: ignore[union-attr]
                        f"{self.gotenberg_base_url.rstrip('/')}/forms/libreoffice/convert",
                        files={  # type: ignore[arg-type]
                            "files": ("document.html", html_content.encode("utf-8"), "text/html")
                        },
                        timeout=TIMEOUT_FILE_PROCESSING,
                    )

                    if response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                        file_path = Path(temp_dir) / f"{document_id}.docx"
                        file_path.write_bytes(response.content)  # type: ignore[attr-defined]

                        return {
                            "file_path": str(file_path),
                            "filename": f"{title}.docx",
                            "media_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        }
                    msg = f"Gotenberg DOCX conversion failed with status {response.status_code}"
                    raise RuntimeError(msg)  # type: ignore[attr-defined]
                # This should never happen if export_format in ["pdf", "docx"]
                msg = f"Unexpected format in pdf/docx branch: {export_format}"
                raise ValueError(msg)

            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.exception("Gotenberg export error")
                msg = f"Export via Gotenberg failed: {e}"
                raise RuntimeError(msg) from e

        elif format == "html":
            # Export as HTML with tables
            # Use original HTML from Tika if available (preserves table positions)
            if html_content_raw:
                body_html = self._clean_tika_html(html_content_raw)
            else:
                # Fallback: Build HTML from content + tables
                body_html = self._build_document_html(content, tables)

            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }}
        h1 {{
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }}
        .content {{
            white-space: pre-wrap;
            margin-bottom: 30px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #f3f4f6;
            font-weight: bold;
            color: #1f2937;
        }}
        tr:nth-child(even) {{
            background-color: #f9fafb;
        }}
        tr:hover {{
            background-color: #f3f4f6;
        }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {body_html}
</body>
</html>"""

            file_path = Path(temp_dir) / f"{document_id}.html"
            file_path.write_text(html_content, encoding="utf-8")

            return {
                "file_path": str(file_path),
                "filename": f"{title}.html",
                "media_type": "text/html",
            }

        elif export_format == "txt":
            # Export as plain text with ASCII tables
            full_content = f"{title}\n{'=' * len(title)}\n\n{content}"

            if tables:
                tables_text = self._build_text_tables(tables)
                full_content += f"\n\n{tables_text}"

            file_path = Path(temp_dir) / f"{document_id}.txt"
            file_path.write_text(full_content, encoding="utf-8")

            return {
                "file_path": str(file_path),
                "filename": f"{title}.txt",
                "media_type": "text/plain",
            }

        elif export_format == "md":
            # Export as Markdown with tables
            md_content = f"# {title}\n\n{content}"

            if tables:
                tables_md = self._build_markdown_tables(tables)
                md_content += f"\n\n{tables_md}"

            file_path = Path(temp_dir) / f"{document_id}.md"
            file_path.write_text(md_content, encoding="utf-8")

            return {
                "file_path": str(file_path),
                "filename": f"{title}.md",
                "media_type": "text/markdown",
            }

        else:
            msg = f"Unsupported export format: {export_format}"
            raise ValueError(msg)

    async def convert_document(
        self, source_format: str, target_format: str, file_data: str, options: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Convert document between formats using Gotenberg/LibreOffice

        Supported conversions:
        - HTML → PDF (Gotenberg Chromium)
        - HTML → DOCX (Gotenberg LibreOffice)
        - DOCX → PDF (Gotenberg LibreOffice)
        - ODT → PDF (Gotenberg LibreOffice)
        - XLSX → PDF (Gotenberg LibreOffice)
        - PPTX → PDF (Gotenberg LibreOffice)

        Args:
            source_format: Source format (html, docx, odt, xlsx, pptx)
            target_format: Target format (pdf, docx)
            file_data: Base64 encoded file data
            options: Conversion options (margins, paper size, etc.)

        Returns:
            (dict[str, Any]) with converted file data and metadata
        """
        if not self.services_status.get("gotenberg"):
            msg = "Gotenberg service not available for conversion"
            raise RuntimeError(msg)

        try:
            # Decode base64 file data
            file_bytes = base64.b64decode(file_data)

            # Determine conversion endpoint and parameters
            if source_format.lower() == "html" and target_format.lower() == "pdf":
                # HTML to PDF using Chromium
                endpoint = f"{self.gotenberg_base_url.rstrip('/')}/forms/chromium/convert/html"
                files_data = {"files": ("index.html", file_bytes, "text/html")}
                data_params = {
                    "marginTop": options.get("margin_top", "0.5"),
                    "marginBottom": options.get("margin_bottom", "0.5"),
                    "marginLeft": options.get("margin_left", "0.5"),
                    "marginRight": options.get("margin_right", "0.5"),
                    "paperWidth": options.get("paper_width", "8.27"),
                    "paperHeight": options.get("paper_height", "11.69"),
                    "preferCSSPageSize": options.get("prefer_css_page_size", "false"),
                }

            elif target_format.lower() == "pdf":
                # Office docs to PDF using LibreOffice
                endpoint = f"{self.gotenberg_base_url.rstrip('/')}/forms/libreoffice/convert"
                files_data = {
                    "files": (
                        f"document.{source_format}",
                        file_bytes,
                        f"application/vnd.openxmlformats-officedocument.{source_format}document",
                    )
                }
                data_params = {}

            elif source_format.lower() == "html" and target_format.lower() == "docx":
                # HTML to DOCX using LibreOffice
                endpoint = f"{self.gotenberg_base_url.rstrip('/')}/forms/libreoffice/convert"
                files_data = {"files": ("document.html", file_bytes, "text/html")}
                data_params = {}

            else:
                msg = f"Unsupported conversion: {source_format} → {target_format}"
                raise ValueError(msg)

            # Perform conversion
            if self.http_client is None:
                msg = "HTTP client not available"
                raise RuntimeError(msg)
            response = await self.http_client.post(  # type: ignore[union-attr]
                endpoint,
                files=files_data,
                data=data_params,
                timeout=120.0,  # type: ignore[arg-type]
            )

            if response.status_code == HTTP_OK_STATUS:  # type: ignore[attr-defined]
                # Return base64 encoded result
                result_b64 = base64.b64encode(response.content).decode("utf-8")  # type: ignore[attr-defined]

                return {
                    "converted_data": result_b64,
                    "source_format": source_format,
                    "target_format": target_format,
                    "file_size": len(response.content),  # type: ignore[attr-defined]
                    "conversion_method": "gotenberg",
                    "options_used": options,
                }

            msg = f"Gotenberg conversion failed: HTTP {response.status_code}"  # type: ignore[attr-defined]
            raise RuntimeError(msg)

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
            logger.exception("Document conversion error")
            msg = f"Document conversion failed: {e}"
            raise RuntimeError(msg) from e

    async def perform_ocr(self, file_data: str, file_type: str, options: dict[str, Any]) -> dict[str, Any]:
        """Perform OCR on image/PDF"""
        # Already implemented in _perform_ocr_with_fallback
        result = await self._perform_ocr_with_fallback(file_data, file_type, options.get("language", "eng+rus"))
        if result:
            return result
        msg = "OCR failed"
        raise RuntimeError(msg)

    async def analyze_with_ai(
        self,
        text: str,
        task: str,  # noqa: ARG002
        prompt: str | None,
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Analyze text with AI"""
        start_time = datetime.now(UTC)
        result = await self._analyze_with_ai(
            text, prompt, model, user_id=None, temperature=temperature, max_tokens=max_tokens
        )

        if result:
            processing_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
            return {
                "analysis": result.get("summary", ""),
                "model_used": model,
                "tokens_used": result.get("tokens") or 0,
                "processing_time_ms": processing_time,
                "source": result.get("source", "ugs"),
            }

        msg = "AI analysis failed"
        raise RuntimeError(msg)

    async def speech_to_text(self, audio_data: str, audio_format: str, language: str, model: str) -> dict[str, Any]:
        """
        Convert speech to text using whisper-fast (stack9).

        Args:
            audio_data: Base64 encoded audio data or file path
            audio_format: Audio format (wav, mp3, webm, etc.)
            language: Language code (en, ru, auto, etc.)
            model: Model hint (ignored; stack9 uses whisper-fast)

        Returns:
            dict with text, language, segments, confidence, processing_time_ms, model
        """
        from api.services.voice.stt_service import STTService  # noqa: PLC0415

        start_time = time.time()
        try:
            # Decode audio data if it's base64
            data_input = audio_data
            if data_input.startswith("data:"):
                data_input = data_input.split(",", 1)[1]

            try:
                audio_bytes = base64.b64decode(data_input)
            except (ValueError, TypeError):  # fmt: skip
                if isinstance(data_input, str) and not data_input.startswith("/"):
                    try:
                        audio_bytes = Path(data_input).read_bytes()
                    except (OSError, ValueError):  # fmt: skip
                        audio_bytes = (
                            data_input.encode() if isinstance(data_input, str) else data_input  # type: ignore[arg-type]
                        )
                else:
                    audio_bytes = (
                        data_input.encode() if isinstance(data_input, str) else data_input  # type: ignore[arg-type]
                    )

            result = await STTService.transcribe(
                audio_data=audio_bytes,
                language=language if language and language != "auto" else None,
            )
            processing_time = (time.time() - start_time) * 1000
            segments = result.get("segments", [])
            confidence = result.get("confidence", 0.95)
            if not isinstance(confidence, (int, float)):
                confidence = 0.95

            return {
                "text": result.get("text", ""),
                "language": result.get("language", language or "unknown"),
                "segments": segments,
                "confidence": float(confidence),
                "processing_time_ms": int(result.get("duration_ms", processing_time)),
                "model": "whisper-fast (stack9)",
            }
        except (RuntimeError, TimeoutError, OSError) as e:
            logger.exception("whisper-fast (stack9) speech-to-text error")
            raise RuntimeError(f"Transcription failed: {e!s}") from e

    async def get_document_analytics(self, document_id: str, user_id: str) -> dict[str, Any]:
        """
        Get analytics for a specific document

        Args:
            document_id: Document ID
            user_id: User ID for authorization

        Returns:
            Document analytics including word count, character count, reading time, etc.
        """
        if not self.pg_pool:
            msg = "PostgreSQL not available"
            raise RuntimeError(msg)

        try:
            async with self.pg_pool.acquire() as conn:
                # Get document
                row = await conn.fetchrow(
                    """
                    SELECT id, title, content, document_type, metadata, word_count, character_count, created_at, updated_at
                    FROM elite_documents
                    WHERE id = $1 AND user_id = $2
                """,
                    document_id,
                    user_id,
                )

                if not row:
                    msg = "Document not found"
                    raise ValueError(msg)

                content = row["content"] or ""
                metadata = json.loads(row["metadata"]) if row["metadata"] else {}

                # Calculate basic metrics
                word_count = len(content.split()) if content else 0
                character_count = len(content) if content else 0
                line_count = len(content.split("\n")) if content else 0

                # Estimate reading time (200 words per minute average)
                reading_time_minutes = word_count / 200 if word_count > 0 else 0

                # Extract additional metrics from metadata
                tables_count = len(metadata.get("tables", []))
                questions_count = len(metadata.get("questions", []))
                json_flags_count = len(metadata.get("json_flags", []))
                ai_analysis_count = 1 if metadata.get("ai_analysis") else 0

                # Calculate complexity score (0-100)
                complexity_score = min(
                    100,
                    (
                        (word_count / 1000) * 20  # Length factor
                        + (tables_count * 10)  # Tables factor
                        + (questions_count * 5)  # Questions factor
                        + (json_flags_count * 5)  # JSON flags factor
                        + (ai_analysis_count * 10)  # AI analysis factor
                    ),
                )

                return {
                    "document_id": str(row["id"]),
                    "title": row["title"],
                    "document_type": row["document_type"],
                    "metrics": {
                        "word_count": word_count,
                        "character_count": character_count,
                        "line_count": line_count,
                        "tables_count": tables_count,
                        "questions_count": questions_count,
                        "json_flags_count": json_flags_count,
                        "ai_analysis_count": ai_analysis_count,
                        "reading_time_minutes": round(reading_time_minutes, 1),
                        "complexity_score": round(complexity_score, 1),
                    },
                    "metadata": {
                        "extraction_method": metadata.get("extraction_method"),
                        "ocr_performed": metadata.get("ocr_performed", False),
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                    },
                }

        except (asyncpg.PostgresError, TimeoutError) as e:
            logger.exception("Document analytics error")
            msg = f"Failed to get document analytics: {e}"
            raise RuntimeError(msg) from e

    async def get_user_analytics(self, user_id: str) -> dict[str, Any]:
        """
        Get comprehensive analytics for user documents

        Args:
            user_id: User ID

        Returns:
            User analytics including document counts, totals, activity metrics
        """
        if not self.pg_pool:
            msg = "PostgreSQL not available"
            raise RuntimeError(msg)

        try:
            async with self.pg_pool.acquire() as conn:
                # Get document statistics
                stats_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_documents,
                        SUM(word_count) as total_words,
                        SUM(character_count) as total_characters,
                        AVG(word_count) as avg_words_per_doc,
                        AVG(character_count) as avg_chars_per_doc,
                        COUNT(CASE WHEN document_type = 'pdf' THEN 1 END) as pdf_count,
                        COUNT(CASE WHEN document_type = 'docx' THEN 1 END) as docx_count,
                        COUNT(CASE WHEN document_type = 'txt' THEN 1 END) as txt_count,
                        COUNT(CASE WHEN metadata->>'ocr_performed' = 'true' THEN 1 END) as ocr_documents,
                        COUNT(CASE WHEN metadata->'ai_analysis' IS NOT NULL THEN 1 END) as ai_analyzed_documents,
                        MAX(created_at) as last_document_date,
                        MIN(created_at) as first_document_date
                    FROM elite_documents
                    WHERE user_id = $1
                """,
                    user_id,
                )

                if not stats_row:
                    return {
                        "total_documents": 0,
                        "total_words": 0,
                        "total_characters": 0,
                        "avg_words_per_doc": 0,
                        "avg_chars_per_doc": 0,
                        "document_types": {},
                        "features_used": {},
                        "activity": {},
                    }

                # Get recent activity (last 30 days)
                recent_docs = await conn.fetch(
                    """
                    SELECT created_at
                    FROM elite_documents
                    WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY created_at DESC
                """,
                    user_id,
                )

                # Calculate activity metrics
                recent_count = len(recent_docs)
                if recent_docs:
                    days_span = (recent_docs[0]["created_at"] - recent_docs[-1]["created_at"]).days + 1
                    docs_per_day = recent_count / max(days_span, 1)
                else:
                    docs_per_day = 0

                return {
                    "total_documents": stats_row["total_documents"] or 0,
                    "total_words": stats_row["total_words"] or 0,
                    "total_characters": stats_row["total_characters"] or 0,
                    "avg_words_per_doc": round(stats_row["avg_words_per_doc"] or 0, 1),
                    "avg_chars_per_doc": round(stats_row["avg_chars_per_doc"] or 0, 1),
                    "document_types": {
                        "pdf": stats_row["pdf_count"] or 0,
                        "docx": stats_row["docx_count"] or 0,
                        "txt": stats_row["txt_count"] or 0,
                    },
                    "features_used": {
                        "ocr_used": stats_row["ocr_documents"] or 0,
                        "ai_analysis_used": stats_row["ai_analyzed_documents"] or 0,
                    },
                    "activity": {
                        "recent_documents_30d": recent_count,
                        "documents_per_day_avg": round(docs_per_day, 2),
                        "last_document_date": stats_row["last_document_date"].isoformat()
                        if stats_row["last_document_date"]
                        else None,
                        "first_document_date": stats_row["first_document_date"].isoformat()
                        if stats_row["first_document_date"]
                        else None,
                    },
                }

        except (asyncpg.PostgresError, TimeoutError) as e:
            logger.exception("User analytics error")
            msg = f"Failed to get user analytics: {e}"
            raise RuntimeError(msg) from e

    async def import_from_paperless(self, paperless_id: int, user_id: str) -> dict[str, Any]:
        """
        Import document from Paperless-ngx

        Args:
            paperless_id: Paperless document ID
            user_id: User ID to import for

        Returns:
            Imported document information
        """
        if not self.services_status.get("paperless"):
            msg = "Paperless service not available"
            raise RuntimeError(msg)

        from api.services.stack4.paperless_gateway import (
            PaperlessGatewayError,
            PaperlessNotConfigured,
            get_paperless_gateway,
        )

        try:
            gateway = get_paperless_gateway()
            file_bytes, paperless_doc = await gateway.download_document_bytes(paperless_id)
        except PaperlessNotConfigured as exc:
            raise RuntimeError(str(exc)) from exc
        except PaperlessGatewayError as exc:
            raise RuntimeError(str(exc)) from exc

        file_data = base64.b64encode(file_bytes).decode("utf-8")

        file_type = (paperless_doc.file_type or "").lower()
        if not file_type and paperless_doc.original_file_name and "." in paperless_doc.original_file_name:
            file_type = paperless_doc.original_file_name.rsplit(".", 1)[-1].lower()

        processing_result = await self.process_document(
            file_name=paperless_doc.title or f"Paperless_{paperless_id}",
            file_type=file_type or "pdf",
            file_data=file_data,
            user_id=user_id,
            options={
                "extract_text": True,
                "extract_tables": True,
                "extract_questions": True,
                "extract_json_flags": True,
                "enable_ai": False,
                "save_to_db": True,
                "index_elasticsearch": True,
            },
        )

        processing_result["paperless_metadata"] = {
            "paperless_id": paperless_id,
            "paperless_title": paperless_doc.title,
            "paperless_created": paperless_doc.created,
            "paperless_tags": paperless_doc.tags,
            "paperless_correspondent": paperless_doc.correspondent,
            "paperless_document_type": paperless_doc.document_type,
        }

        logger.info(
            "Imported document from Paperless: %s -> %s",
            paperless_id,
            processing_result["document_id"],
        )
        return processing_result

    async def list_minio_files(
        self,
        bucket: str,
        prefix: str = "",
        user_id: str | None = None,  # noqa: ARG002
    ) -> list[dict[str, Any]]:
        """
        List files in MinIO bucket

        Args:
            bucket: MinIO bucket name
            prefix: Optional prefix to filter objects
            user_id: Optional user ID for authorization (if implementing user-specific buckets)

        Returns:
            List of file objects with metadata
        """
        minio_client = self.minio_client
        if not minio_client:
            msg = "MinIO client not available"
            raise RuntimeError(msg)

        try:

            def _list_objects_sync() -> list[Any]:
                # list_objects returns a lazy iterator with blocking network reads.
                return list(minio_client.list_objects(bucket, prefix=prefix, recursive=True))

            # Run blocking MinIO listing outside the event loop.
            objects = await asyncio.to_thread(_list_objects_sync)

            files = []
            for obj in objects:
                if obj.object_name:  # Skip directory markers
                    # stat_object performs a blocking HTTP call; keep it off the loop.
                    stat = await asyncio.to_thread(minio_client.stat_object, bucket, obj.object_name)

                    file_info = {
                        "name": obj.object_name,
                        "size": obj.size,
                        "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
                        "etag": obj.etag,
                        "content_type": getattr(stat, "content_type", None),
                        "metadata": getattr(stat, "metadata", {}),
                        "bucket": bucket,
                        "url": f"http://{self.minio_endpoint}/{bucket}/{obj.object_name}",
                    }

                    # Add file extension info
                    if "." in obj.object_name:
                        file_info["extension"] = obj.object_name.split(".")[-1].lower()

                    files.append(file_info)

        except Exception as e:
            logger.exception("MinIO listing error")
            msg = f"Failed to list MinIO files: {e}"
            raise RuntimeError(msg) from e
        else:
            logger.info("Listed %s files from MinIO bucket '%s'", len(files), bucket)
            return files

    async def list_minio_documents(self, bucket: str, user_id: str) -> list[dict[str, Any]]:
        """List documents in MinIO bucket (legacy method)"""
        return await self.list_minio_files(bucket, user_id=user_id)


logger.info("Elite Editor Orchestrator module loaded")
