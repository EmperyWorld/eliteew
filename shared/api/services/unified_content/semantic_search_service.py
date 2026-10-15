#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Hybrid unified-content search service (Elasticsearch keyword + Qdrant vector), with RRF and ACL filtering.
# Invariants:
# - Vector backend is Qdrant only; Chroma/UNIFIED_VECTOR_READ_BACKEND=chroma is retired (ES-only degrade).
# - Vector hits are always resolved to UUID content ids before metadata/ACL merge.
# - Authenticated searches fail closed when the ACL database pool is unavailable.
# - Post-RRF ACL uses batch content_shares + friendship prefetch (no per-hit SELECT loops).
# Related:
# - api/services/unified_content/unified_content_qdrant_service.py
# - api/services/unified_content/content_acl_batch.py
# - api/ewa_platform/companion/storage/semantic_catalog_augment.py
# ---
"""Hybrid semantic search for unified content with Qdrant-first vector backend."""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.unified_content.content_acl_batch import (
    content_accessible_with_prefetch,
    prefetch_acl_sets_for_rows,
)

logger = logging.getLogger(__name__)
UNIFIED_CONTENT_QDRANT_COLLECTION = "eliteew_documents"
VECTOR_BACKEND_QDRANT = "qdrant"
VECTOR_BACKEND_CHROMA = "chroma"  # retired — detected only to log + ES-only degrade
CHROMA_RETIRED_LOG_STEP = "[STEP] unified_content_search_chroma_retired"


@dataclass
class SearchResult:
    """Single search result"""

    content_id: UUID
    title: str
    description: str | None
    score: float  # Combined search score
    metadata: dict[str, Any]


class SemanticSearchService:
    """
    🔥 SEMANTIC SEARCH SERVICE 🔥

    Hybrid search combining keyword and vector search
    """

    def __init__(
        self,
        elasticsearch_service: Any | None = None,  # noqa: ANN401
        qdrant_client: Any | None = None,  # noqa: ANN401
        embedding_service: Any | None = None,  # noqa: ANN401
        db_pool: asyncpg.Pool | None = None,
        vector_backend: str | None = None,
    ) -> None:
        """Initialize semantic search service"""
        self.es_service = elasticsearch_service
        self.qdrant_client = qdrant_client
        self.embedding_service = embedding_service
        self.db_pool = db_pool
        backend_raw = (vector_backend or os.getenv("UNIFIED_VECTOR_READ_BACKEND", VECTOR_BACKEND_QDRANT)).strip()
        self.vector_backend = backend_raw.lower() or VECTOR_BACKEND_QDRANT
        if self.vector_backend == VECTOR_BACKEND_CHROMA:
            logger.warning(
                "%s backend=chroma action=degrade_es_only hint=unset_or_set_qdrant",
                CHROMA_RETIRED_LOG_STEP,
            )

        # RRF parameters
        self.rrf_k = 60  # Constant for Reciprocal Rank Fusion

    async def search(
        self,
        query: str,
        filters: dict[str, Any] | None = None,
        limit: int = 20,
        user_id: UUID | None = None,
    ) -> list[SearchResult]:
        """
        Hybrid search: keyword + semantic

        Pipeline:
        1. Generate query embedding
        2. Vector search in Qdrant (Chroma backend retired — ES-only when env still requests chroma)
        3. Keyword search in Elasticsearch (top 50)
        4. Combine with Reciprocal Rank Fusion
        5. Apply filters
        6. Apply access control

        Args:
            query: Search query
            filters: Optional filters (content_type, tags, date_range, etc.)
            limit: Max results to return
            user_id: User UUID for access control

        Returns:
            List of SearchResult objects sorted by relevance
        """

        logger.info("Hybrid search: query='%s', limit=%d", query[:100], limit)

        try:

            async def _run_vector() -> list[tuple[UUID, float]]:
                try:
                    return await self._vector_search(query, filters=filters, limit=50, user_id=user_id)
                except Exception as error:  # noqa: BLE001 - log and degrade gracefully
                    logger.error("Vector search failed: %s", error)
                    return []

            async def _run_keyword() -> list[tuple[UUID, float]]:
                try:
                    return await self._keyword_search(query, filters, limit=50)
                except Exception as error:  # noqa: BLE001 - log and degrade gracefully
                    logger.error("Keyword search failed: %s", error)
                    return []

            async with asyncio.TaskGroup() as tg:
                vector_task = tg.create_task(_run_vector())
                keyword_task = tg.create_task(_run_keyword())

            vector_results_list = vector_task.result()
            keyword_results_list = keyword_task.result()

            # Combine with RRF
            combined = await self._reciprocal_rank_fusion(vector_results_list, keyword_results_list)

            # Apply filters
            if filters:
                combined = self._apply_filters(combined, filters)

            # Apply access control
            if user_id:
                combined = await self._apply_access_control(combined, user_id)

            # Limit results
            final_results = combined[:limit]

            logger.info("Found %d results (from %d total)", len(final_results), len(combined))

            return final_results

        except Exception as e:
            logger.exception("Search failed")
            msg = f"Search failed: {e!s}"
            raise RuntimeError(msg) from e

    async def _vector_search(
        self,
        query: str,
        filters: dict[str, Any] | None,
        limit: int = 50,
        user_id: UUID | None = None,
    ) -> list[tuple[UUID, float]]:
        if self.vector_backend == VECTOR_BACKEND_CHROMA:
            logger.warning(
                "%s backend=chroma action=skip_vector_leg degrade=es_only query_len=%s",
                CHROMA_RETIRED_LOG_STEP,
                len(query),
            )
            return []
        return await self._vector_search_qdrant(query=query, filters=filters, limit=limit, user_id=user_id)

    async def _vector_search_qdrant(
        self,
        *,
        query: str,
        filters: dict[str, Any] | None,
        limit: int,
        user_id: UUID | None,
    ) -> list[tuple[UUID, float]]:
        try:
            if not self.embedding_service or self.qdrant_client is None:
                logger.warning("Qdrant vector search not available (missing services)")
                return []
            query_embedding = await self.embedding_service.embed_text(query)
            # ACL applied after RRF; do not owner-filter in Qdrant (shared content must match).
            query_filter = self._build_qdrant_filter(filters=filters, user_id=None)
            result = await self.qdrant_client.query_points(
                collection_name=UNIFIED_CONTENT_QDRANT_COLLECTION,
                query=query_embedding,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False,
            )
            points = getattr(result, "points", []) or []
            best_by_content: dict[UUID, float] = {}
            for point in points:
                payload = getattr(point, "payload", None) or {}
                raw_cid = payload.get("content_id") if isinstance(payload, dict) else None
                if not raw_cid:
                    continue
                try:
                    content_id = UUID(str(raw_cid))
                except ValueError:
                    continue
                score = float(getattr(point, "score", 0.0) or 0.0)
                prev = best_by_content.get(content_id)
                if prev is None or score > prev:
                    best_by_content[content_id] = score
            return sorted(best_by_content.items(), key=lambda item: item[1], reverse=True)
        except Exception:
            logger.exception("Qdrant vector search error")
            return []

    def _build_qdrant_filter(
        self,
        *,
        filters: dict[str, Any] | None,
        user_id: UUID | None,
    ) -> Any | None:
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

            must: list[Any] = []
            if user_id is not None:
                must.append(FieldCondition(key="user_id", match=MatchValue(value=str(user_id))))
            if filters:
                content_type = filters.get("content_type")
                if isinstance(content_type, str) and content_type.strip():
                    must.append(FieldCondition(key="content_type", match=MatchValue(value=content_type.strip())))
                tags = filters.get("tags")
                if isinstance(tags, list) and tags:
                    normalized_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
                    if normalized_tags:
                        must.append(FieldCondition(key="tags", match=MatchAny(any=normalized_tags)))
                elif isinstance(tags, str) and tags.strip():
                    must.append(FieldCondition(key="tags", match=MatchAny(any=[tags.strip()])))
            return Filter(must=must) if must else None
        except Exception:
            logger.debug("Qdrant filter build skipped (client/models unavailable)", exc_info=True)
            return None

    async def _keyword_search(
        self, query: str, filters: dict[str, Any] | None, limit: int = 50
    ) -> list[tuple[UUID, float]]:
        """
        Keyword search using Elasticsearch

        Args:
            query: Search query
            filters: Optional filters
            limit: Max results

        Returns:
            List of (content_id, score) tuples
        """

        try:
            if not self.es_service:
                logger.warning("Keyword search not available (missing Elasticsearch)")
                return []

            # Build Elasticsearch query
            es_query = {
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "title^3",  # Title boost
                            "description^2",
                            "content",
                            "tags",
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                },
                "size": limit,
            }

            # Add filters
            if filters:
                es_query["query"] = {"bool": {"must": [es_query["query"]], "filter": self._build_es_filters(filters)}}

            # Execute search
            results = await self.es_service.search(index="unified_content", body=es_query)

            # Extract results
            hits = results.get("hits", {}).get("hits", [])

            return [(UUID(hit["_id"]), hit["_score"]) for hit in hits]

        except Exception:
            logger.exception("Keyword search error")
            return []

    async def _reciprocal_rank_fusion(
        self, vector_results: list[tuple[UUID, float]], keyword_results: list[tuple[UUID, float]]
    ) -> list[SearchResult]:
        """
        Combine results using Reciprocal Rank Fusion

        RRF Formula: score = sum(1 / (rank + k))

        Args:
            vector_results: Results from vector search
            keyword_results: Results from keyword search

        Returns:
            Combined results sorted by RRF score
        """

        scores: dict[UUID, float] = {}  # ⚡ FIX MYPY: Added type annotation

        # Add scores from vector search
        for rank, (content_id, _) in enumerate(vector_results):
            scores[content_id] = scores.get(content_id, 0) + (1 / (rank + self.rrf_k))

        # Add scores from keyword search
        for rank, (content_id, _) in enumerate(keyword_results):
            scores[content_id] = scores.get(content_id, 0) + (1 / (rank + self.rrf_k))

        # Sort by combined score
        sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        # Load content metadata from database
        content_ids = [content_id for content_id, _ in sorted_ids]
        content_metadata = await self._load_content_metadata(content_ids)

        # Convert to SearchResult objects with real data from DB
        results = []
        for content_id, score in sorted_ids:
            metadata = content_metadata.get(content_id, {})
            results.append(
                SearchResult(
                    content_id=content_id,
                    title=metadata.get("name", f"Content {content_id}"),
                    description=metadata.get("description"),
                    score=score,
                    metadata=metadata,
                )
            )

        return results

    async def _load_content_metadata(self, content_ids: list[UUID]) -> dict[UUID, dict[str, Any]]:
        """
        Load content metadata from database

        Args:
            content_ids: List of content UUIDs

        Returns:
            Dictionary mapping content_id to metadata dict
        """
        if not self.db_pool or not content_ids:
            return {}

        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, name, description, content_type, mime_type,
                           tags, visibility, user_id, company_id, project_id,
                           friend_visibility, shared_with_user_ids, metadata,
                           created_at
                    FROM unified_content
                    WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
                    """,
                    content_ids,
                )

                result = {}
                for row in rows:
                    content_id = row["id"]
                    row_dict = dict(row)
                    # Parse JSONB metadata if it's a string
                    if isinstance(row_dict.get("metadata"), str):
                        try:
                            row_dict["metadata"] = json.loads(row_dict["metadata"])
                        except (json.JSONDecodeError, TypeError):  # fmt: skip
                            row_dict["metadata"] = {}
                    result[content_id] = row_dict

                return result

        except Exception:
            logger.exception("Failed to load content metadata")
            return {}

    def _apply_filters(self, results: list[SearchResult], filters: dict[str, Any]) -> list[SearchResult]:
        """
        Apply filters to results

        Supported filters:
        - content_type: Filter by MIME type
        - tags: Filter by tags
        - date_range: Filter by date
        - owner_id: Filter by owner
        """

        filtered = results

        # Apply each filter
        for filter_key, filter_value in filters.items():
            if filter_key == "content_type" and filter_value:
                filtered = [r for r in filtered if r.metadata.get("content_type") == filter_value]

            elif filter_key == "tags" and filter_value:
                filter_tags = set(filter_value) if isinstance(filter_value, list) else {filter_value}
                filtered = [r for r in filtered if set(r.metadata.get("tags", [])) & filter_tags]

            # Add more filters as needed

        logger.info("Applied filters: %d → %d results", len(results), len(filtered))

        return filtered

    async def _apply_access_control(self, results: list[SearchResult], user_id: UUID) -> list[SearchResult]:
        """
        Filter results based on user access permissions

        Rules:
        - User can see own content
        - User can see public content
        - User can see shared content (legacy and explicit shares)
        - User can see friend content (if mutual friendship)
        """
        if not self.db_pool:
            logger.error("Access control failed closed: no db_pool available")
            return []

        if not results:
            return results

        user_id_str = str(user_id)
        content_ids = [r.content_id for r in results]

        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, user_id, visibility, shared_with_user_ids, friend_visibility
                    FROM unified_content
                    WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
                    """,
                    content_ids,
                )
                shared_ids, friend_ids = await prefetch_acl_sets_for_rows(conn, rows, user_id_str)
                access_map: dict[UUID, bool] = {
                    row["id"]: content_accessible_with_prefetch(
                        row,
                        user_id_str,
                        shared_content_ids=shared_ids,
                        mutual_friend_owner_ids=friend_ids,
                    )
                    for row in rows
                }
                filtered = [r for r in results if access_map.get(r.content_id, False)]
                logger.info(
                    "Access control: %s → %s results (user_id=%s)",
                    len(results),
                    len(filtered),
                    user_id_str,
                )
                return filtered

        except Exception:
            logger.exception("Access control failed")
            # On error, return empty list for security
            return []

    def _build_es_filters(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        """Build Elasticsearch filter clauses"""

        es_filters = []

        if filters.get("content_type"):
            es_filters.append({"term": {"content_type": filters["content_type"]}})

        if filters.get("tags"):
            tags = filters["tags"] if isinstance(filters["tags"], list) else [filters["tags"]]
            es_filters.append({"terms": {"tags": tags}})

        if filters.get("date_range"):
            es_filters.append({"range": {"created_at": filters["date_range"]}})

        return es_filters
