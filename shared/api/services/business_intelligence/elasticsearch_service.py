#!/usr/bin/env python3
# ruff: noqa: I001
"""
🔍 ELASTICSEARCH SERVICE - Production-Ready
Хранение и полнотекстовый поиск документов и анализов

Features:
✅ Document indexing with metadata
✅ Full-text search
✅ Analysis results storage
✅ Historical tracking
✅ Advanced filtering
"""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from elasticsearch import ConflictError, NotFoundError  # type: ignore[import-not-found,attr-defined]

from api.core.database_manager import get_database_manager
from api.core.elasticsearch_indices import (
    INDEX_BUSINESS_ANALYSES,
    INDEX_BUSINESS_DOCUMENTS,
    INDEX_BUSINESS_SESSIONS,
)

logger = logging.getLogger(__name__)

CLUSTER_HEALTH_TIMEOUT = 5.0  # seconds; avoid blocking on slow ES
CREATE_INDICES_TIMEOUT = 15.0  # seconds; exists/create can be slow


class ElasticsearchService:
    """Production-ready Elasticsearch service.

    NOTE: The underlying Elasticsearch client is owned by `DatabaseManager`.
    This service only borrows the shared client and MUST NOT create or close
    its own `AsyncElasticsearch` instances.
    """

    def __init__(self) -> None:
        """Initialize Elasticsearch service wrapper."""
        self.client = None

        # Index names (from single registry api.core.elasticsearch_indices)
        self.DOCUMENTS_INDEX = INDEX_BUSINESS_DOCUMENTS
        self.ANALYSES_INDEX = INDEX_BUSINESS_ANALYSES
        self.SESSIONS_INDEX = INDEX_BUSINESS_SESSIONS

    async def initialize(self) -> bool | None:
        """Initialize Elasticsearch client and create indices"""
        try:
            # Reuse shared Elasticsearch client from DatabaseManager
            manager = await get_database_manager()
            self.client = manager.get_elasticsearch_client()

            # Проверка подключения (graceful - не падаем если недоступен)
            try:
                if self.client is None:
                    logger.warning("Elasticsearch client not initialized")
                    return False
                if await self.client.ping():
                    logger.info("Connected to shared Elasticsearch client")

                    # Проверка здоровья кластера (с таймаутом — не блокировать старт при медленном ES)
                    try:
                        async with asyncio.timeout(CLUSTER_HEALTH_TIMEOUT):
                            health = await self.client.cluster.health()
                    except TimeoutError:
                        logger.warning(
                            "Elasticsearch cluster.health timed out (%.1fs), continuing without status",
                            CLUSTER_HEALTH_TIMEOUT,
                        )
                        health = {}
                    status = health.get("status", "unknown")

                    # Yellow = OK для single-node кластера
                    if status in ["green", "yellow"]:
                        logger.info("Elasticsearch cluster status: %s", status)
                    elif status != "unknown":
                        logger.warning("Elasticsearch cluster status: %s", status)

                    # Создание индексов если не существуют (с таймаутом)
                    try:
                        async with asyncio.timeout(CREATE_INDICES_TIMEOUT):
                            await self._create_indices()
                    except TimeoutError:
                        logger.warning(
                            "Elasticsearch _create_indices timed out (%.1fs), indices will be created on demand",
                            CREATE_INDICES_TIMEOUT,
                        )
                    return True
                logger.warning("Elasticsearch not ready, will retry on demand")
                return False  # noqa: TRY300
            except Exception as ping_error:  # noqa: BLE001
                logger.warning("Elasticsearch ping failed: %s, will retry on demand", ping_error)
                return False

        except Exception:
            logger.exception("Elasticsearch client creation failed")
            # Still return False but keep client for retries
            return False

    async def close(self) -> None:
        """Close Elasticsearch connection (no-op).

        Elasticsearch client lifecycle is managed by `DatabaseManager`.
        This method intentionally does nothing to avoid double-closing
        the shared client.
        """
        logger.debug("ElasticsearchService.close() called - no-op (managed by DatabaseManager)")

    async def _create_indices(self) -> None:
        """Create Elasticsearch indices with mappings"""

        # Documents index mapping
        documents_mapping = {
            "mappings": {
                "properties": {
                    "session_id": {"type": "keyword"},
                    "document_id": {"type": "keyword"},
                    "user_id": {"type": "keyword"},
                    "name": {"type": "text"},
                    "type": {"type": "keyword"},
                    "content": {
                        "type": "text",
                        "analyzer": "russian",
                        "fields": {"english": {"type": "text", "analyzer": "english"}},
                    },
                    "metadata": {"type": "object"},
                    "size": {"type": "long"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"},
                    "tags": {"type": "keyword"},
                }
            }
        }

        # Analyses index mapping
        analyses_mapping = {
            "mappings": {
                "properties": {
                    "session_id": {"type": "keyword"},
                    "analysis_id": {"type": "keyword"},
                    "user_id": {"type": "keyword"},
                    "title": {"type": "text"},
                    "analysis_type": {"type": "keyword"},
                    "depth": {"type": "keyword"},
                    "model_used": {"type": "keyword"},
                    "content": {"type": "text", "analyzer": "russian"},
                    "summary": {"type": "text"},
                    "key_insights": {"type": "text"},
                    "recommendations": {"type": "text"},
                    "swot": {"type": "object"},
                    "financial_projections": {"type": "object"},
                    "metadata": {"type": "object"},
                    "metrics": {
                        "properties": {
                            "tokens_used": {"type": "integer"},
                            "generation_time": {"type": "float"},
                            "quality_score": {"type": "float"},
                        }
                    },
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "completed_at": {"type": "date"},
                }
            }
        }

        # Sessions index mapping
        sessions_mapping = {
            "mappings": {
                "properties": {
                    "session_id": {"type": "keyword"},
                    "user_id": {"type": "keyword"},
                    "status": {"type": "keyword"},
                    "settings": {"type": "object"},
                    "document_count": {"type": "integer"},
                    "analysis_count": {"type": "integer"},
                    "total_tokens": {"type": "integer"},
                    "created_at": {"type": "date"},
                    "completed_at": {"type": "date"},
                }
            }
        }

        # Create indices
        for index_name, mapping in [
            (self.DOCUMENTS_INDEX, documents_mapping),
            (self.ANALYSES_INDEX, analyses_mapping),
            (self.SESSIONS_INDEX, sessions_mapping),
        ]:
            try:
                if not await self.client.indices.exists(index=index_name):  # type: ignore[union-attr]
                    await self.client.indices.create(index=index_name, body=mapping)  # type: ignore[union-attr]
                    logger.info("Created index: %s", index_name)
                else:
                    logger.info("Index already exists: %s", index_name)
            except Exception:
                logger.exception("Failed to create index %s", index_name)

    # ========================================
    # DOCUMENT OPERATIONS
    # ========================================

    async def index_document(
        self,
        session_id: str,
        document_id: str,
        user_id: str,
        name: str,
        doc_type: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        size: int = 0,
    ) -> bool:
        """
        Index a document in Elasticsearch

        Args:
            session_id: Session ID
            document_id: Unique document ID
            user_id: User ID
            name: Document name
            doc_type: Document type (pdf, txt, url, text)
            content: Document content (extracted text)
            metadata: Additional metadata
            size: Document size in bytes

        Returns:
            Success boolean
        """
        # Graceful degradation: skip if client not available
        if not self.client:
            logger.debug("Elasticsearch unavailable, skipping document indexing: %s", document_id)
            return False

        try:
            doc = {
                "session_id": session_id,
                "document_id": document_id,
                "user_id": user_id,
                "name": name,
                "type": doc_type,
                "content": content,
                "metadata": metadata or {},
                "size": size,
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "tags": [],
            }

            await self.client.index(index=self.DOCUMENTS_INDEX, id=document_id, document=doc)

            logger.info("Indexed document: %s", document_id)
            return True  # noqa: TRY300
        except ConflictError:
            raise
        except Exception:  # noqa: BLE001
            # INFO level: graceful failure, not critical
            logger.info("Elasticsearch document indexing failed (degraded mode): %s", document_id)
            return False

    async def get_document(self, document_id: str) -> dict[str, Any] | None:
        """Get document by ID"""
        if not self.client:
            return None
        try:
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            result = await self.client.get(index=self.DOCUMENTS_INDEX, id=document_id)
            source: dict[str, Any] = result["_source"]
            return source  # noqa: TRY300
        except NotFoundError:
            return None
        except Exception:
            logger.exception("Failed to get document %s", document_id)
            return None

    async def search_documents(
        self, query: str, user_id: str | None = None, session_id: str | None = None, size: int = 10
    ) -> list[dict[str, Any]]:
        """
        Full-text search across documents

        Args:
            query: Search query
            user_id: Filter by user ID
            session_id: Filter by session ID
            size: Number of results

        Returns:
            List of matching documents
        """
        try:
            must_clauses = [
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["content", "name^2", "metadata^1.5"],
                        "type": "best_fields",
                    }
                }
            ]

            if user_id:
                must_clauses.append({"term": {"user_id": user_id}})
            if session_id:
                must_clauses.append({"term": {"session_id": session_id}})

            search_query = {
                "query": {"bool": {"must": must_clauses}},
                "size": size,
                "sort": [{"created_at": {"order": "desc"}}],
            }

            if not self.client:
                return []
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            result = await self.client.search(index=self.DOCUMENTS_INDEX, body=search_query)

            return [hit["_source"] for hit in result["hits"]["hits"]]

        except Exception:
            logger.exception("Document search failed")
            return []

    # ========================================
    # ANALYSIS OPERATIONS
    # ========================================

    async def index_analysis(
        self,
        session_id: str,
        analysis_id: str,
        user_id: str,
        title: str,
        analysis_type: str,
        depth: str,
        model_used: str,
        content: str,
        summary: str = "",
        key_insights: str = "",
        recommendations: str = "",
        swot: dict[str, Any] | None = None,
        financial_projections: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        status: str = "completed",
    ) -> bool:
        """Index analysis results in Elasticsearch"""
        # Graceful degradation: skip if client not available
        if not self.client:
            logger.debug("Elasticsearch unavailable, skipping analysis indexing: %s", analysis_id)
            return False

        try:
            analysis = {
                "session_id": session_id,
                "analysis_id": analysis_id,
                "user_id": user_id,
                "title": title,
                "analysis_type": analysis_type,
                "depth": depth,
                "model_used": model_used,
                "content": content,
                "summary": summary,
                "key_insights": key_insights,
                "recommendations": recommendations,
                "swot": swot or {},
                "financial_projections": financial_projections or {},
                "metadata": metadata or {},
                "metrics": metrics or {},
                "status": status,
                "created_at": datetime.now(UTC).isoformat(),
                "completed_at": datetime.now(UTC).isoformat(),
            }

            await self.client.index(index=self.ANALYSES_INDEX, id=analysis_id, document=analysis)

            logger.info("Indexed analysis: %s", analysis_id)
            return True  # noqa: TRY300
        except ConflictError:
            raise
        except Exception:  # noqa: BLE001
            # INFO level: graceful failure, not critical
            logger.info("Elasticsearch analysis indexing failed (degraded mode): %s", analysis_id)
            return False

    async def get_analysis(self, analysis_id: str) -> dict[str, Any] | None:
        """Get analysis by ID"""
        if not self.client:
            return None
        try:
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            result = await self.client.get(index=self.ANALYSES_INDEX, id=analysis_id)
            source: dict[str, Any] = result["_source"]
            return source  # noqa: TRY300
        except NotFoundError:
            return None
        except Exception:
            logger.exception("Failed to get analysis %s", analysis_id)
            return None

    async def search_analyses(
        self,
        query: str,
        user_id: str | None = None,
        analysis_type: str | None = None,
        size: int = 10,
    ) -> list[dict[str, Any]]:
        """Search analyses with filters"""
        try:
            must_clauses = [
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "summary^2", "content", "key_insights^1.5"],
                        "type": "best_fields",
                    }
                }
            ]

            if user_id:
                must_clauses.append({"term": {"user_id": user_id}})
            if analysis_type:
                must_clauses.append({"term": {"analysis_type": analysis_type}})

            search_query = {
                "query": {"bool": {"must": must_clauses}},
                "size": size,
                "sort": [{"created_at": {"order": "desc"}}],
            }

            if not self.client:
                return []
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            result = await self.client.search(index=self.ANALYSES_INDEX, body=search_query)

            return [hit["_source"] for hit in result["hits"]["hits"]]

        except Exception:
            logger.exception("Analysis search failed")
            return []

    async def get_user_analyses_history(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        """Get user's analysis history"""
        try:
            query = {
                "query": {"term": {"user_id": user_id}},
                "size": limit,
                "sort": [{"created_at": {"order": "desc"}}],
            }

            if not self.client:
                return []
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            result = await self.client.search(index=self.ANALYSES_INDEX, body=query)

            return [hit["_source"] for hit in result["hits"]["hits"]]

        except Exception:
            logger.exception("Failed to get user history")
            return []

    # ========================================
    # SESSION OPERATIONS
    # ========================================

    async def index_session(
        self, session_id: str, user_id: str, settings: dict[str, Any], status: str = "active"
    ) -> bool:
        """Index session metadata"""
        # Graceful degradation: skip if client not available
        if not self.client:
            logger.debug("Elasticsearch unavailable, skipping session indexing: %s", session_id)
            return False

        try:
            session = {
                "session_id": session_id,
                "user_id": user_id,
                "status": status,
                "settings": settings,
                "document_count": 0,
                "analysis_count": 0,
                "total_tokens": 0,
                "created_at": datetime.now(UTC).isoformat(),
            }

            await self.client.index(index=self.SESSIONS_INDEX, id=session_id, document=session, op_type="create")

            logger.info("Indexed session: %s", session_id)
            return True  # noqa: TRY300
        except ConflictError:
            raise
        except Exception:  # noqa: BLE001
            # INFO level: graceful failure, not critical
            logger.info("Elasticsearch session indexing failed (degraded mode): %s", session_id)
            return False

    async def update_session(self, session_id: str, updates: dict[str, Any]) -> bool:
        """Update mutable session data; identity is fixed at reservation."""
        if {"user_id", "session_id"}.intersection(updates):
            return False
        if not self.client:
            return False
        try:
            assert self.client is not None  # noqa: S101
            await self.client.update(index=self.SESSIONS_INDEX, id=session_id, body={"doc": updates})
            return True  # noqa: TRY300
        except Exception:
            logger.exception("Failed to update session")
            return False

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Get session by id for ownership validation. Returns None if not found or ES unavailable."""
        if not self.client:
            return None
        try:
            assert self.client is not None  # noqa: S101
            resp = await self.client.get(index=self.SESSIONS_INDEX, id=session_id)
            if not resp or not resp.get("found"):
                return None
            return resp.get("_source") or None
        except NotFoundError:
            return None
        except Exception:
            logger.debug("get_session failed for %s: %s", session_id, type(Exception).__name__)
            return None

    # ========================================
    # STATISTICS & ANALYTICS
    # ========================================

    async def get_user_statistics(self, user_id: str) -> dict[str, Any]:
        """Get user's usage statistics"""
        if not self.client:
            return {"analyses_count": 0, "documents_count": 0, "analysis_types": {}}
        try:
            # Client is checked above, but type checker needs this
            assert self.client is not None  # noqa: S101
            # Count analyses
            analyses_count = await self.client.count(
                index=self.ANALYSES_INDEX, body={"query": {"term": {"user_id": user_id}}}
            )

            # Count documents
            documents_count = await self.client.count(
                index=self.DOCUMENTS_INDEX, body={"query": {"term": {"user_id": user_id}}}
            )

            # Aggregate metrics
            agg_query = {
                "query": {"term": {"user_id": user_id}},
                "aggs": {
                    "total_tokens": {"sum": {"field": "metrics.tokens_used"}},
                    "avg_quality": {"avg": {"field": "metrics.quality_score"}},
                    "analysis_types": {"terms": {"field": "analysis_type", "size": 10}},
                },
                "size": 0,
            }

            assert self.client is not None  # noqa: S101
            agg_result = await self.client.search(index=self.ANALYSES_INDEX, body=agg_query)

            aggregations = agg_result.get("aggregations", {})

            return {
                "total_analyses": analyses_count["count"],
                "total_documents": documents_count["count"],
                "total_tokens_used": int(aggregations.get("total_tokens", {}).get("value", 0)),
                "average_quality": round(aggregations.get("avg_quality", {}).get("value", 0), 2),
                "analysis_types_distribution": [
                    {"type": bucket["key"], "count": bucket["doc_count"]}
                    for bucket in aggregations.get("analysis_types", {}).get("buckets", [])
                ],
            }

        except Exception:
            logger.exception("Failed to get user statistics")
            return {
                "total_analyses": 0,
                "total_documents": 0,
                "total_tokens_used": 0,
                "average_quality": 0,
                "analysis_types_distribution": [],
            }
