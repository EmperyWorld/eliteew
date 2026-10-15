#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Поиск и индексация unified content в Elasticsearch (CRUD индекса, фильтры видимости).
# Invariants:
# - Keyword search path is ES-only; Chroma is not a living backend (hybrid vector leg → Qdrant).
# - Удаление из индекса идемпотентно: отсутствие документа не считается сбоем.
# Related:
# - api/core/elasticsearch_indices.py, content_access_policy.py
# ---

"""Content search service: Elasticsearch integration for unified content."""

import json
import logging
from time import perf_counter
from typing import Any
from uuid import UUID

from asyncpg import Pool  # type: ignore[import-not-found]
from elasticsearch import AsyncElasticsearch, NotFoundError  # type: ignore[attr-defined,import-not-found]
from elasticsearch.exceptions import (  # type: ignore[import-not-found,attr-defined]
    ApiError,
    RequestError,
    TransportError,
)
from elasticsearch.exceptions import ConnectionError as ESConnectionError  # type: ignore[import-untyped]

from api.core.elasticsearch_indices import INDEX_UNIFIED_CONTENT
from api.services.unified_content.content_access_policy import (
    build_es_permission_filter,
    build_es_visibility_filter,
)

logger = logging.getLogger(__name__)  # type: ignore[import-not-found]


class ContentSearchService:
    """
    Service for searching content using Elasticsearch.

    Features:
    - Full-text search with Russian/English analyzers
    - Multi-field search with boosting
    - Fuzzy matching for typo tolerance
    - Permission-based filtering
    - Advanced search with complex filters
    - Tag autocomplete suggestions
    - Result highlighting
    """

    def __init__(self, es_client: AsyncElasticsearch, db_pool: Pool):
        """
        Initialize the search service.

        Args:
            es_client: AsyncElasticsearch client instance
            db_pool: AsyncPG database connection pool
        """
        self.es = es_client
        self.db_pool = db_pool
        self.index_name = INDEX_UNIFIED_CONTENT

    async def _get_friend_user_ids(self, user_id: str) -> list[str]:
        """Return accepted friend IDs for the current user."""
        try:
            viewer_id = UUID(str(user_id).strip())
        except (TypeError, ValueError):  # fmt: skip
            return []

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT friend_id
                FROM friendships
                WHERE user_id = $1
                """,
                viewer_id,
            )

        return [str(row["friend_id"]) for row in rows if row["friend_id"] is not None]

    async def _build_permission_filter(self, user_id: str) -> dict[str, Any]:
        """Build the Elasticsearch permission filter matching the SQL listing rules."""
        friend_user_ids = await self._get_friend_user_ids(user_id)
        return build_es_permission_filter(user_id=user_id, friend_user_ids=friend_user_ids)

    async def _build_visibility_filter(self, user_id: str, visibility: str | list[str]) -> dict[str, Any] | None:
        """
        Build an explicit visibility filter on top of the permission filter.

        Supports the special filter-only value `from_friends`, which means:
        "content from other users that is visible due to friendship".
        """
        values = visibility if isinstance(visibility, list) else [visibility]
        normalized = [str(value).strip() for value in values if str(value).strip()]
        if not normalized:
            return None
        friend_user_ids = await self._get_friend_user_ids(user_id)
        return build_es_visibility_filter(
            user_id=user_id,
            friend_user_ids=friend_user_ids,
            visibility=normalized,
        )

    def _parse_metadata(self, metadata: Any, content_id: UUID) -> dict[str, Any]:
        """
        Parse metadata from various formats (dict, JSON string, None) to dict.
        Also ensures all values are JSON-serializable for Elasticsearch.

        Args:
            metadata: Metadata value (can be dict, JSON string, or None)
            content_id: Content ID for logging

        Returns:
            Parsed metadata as dict, empty dict if parsing fails
        """
        if metadata is None:
            return {}

        parsed_dict: dict[str, Any] = {}

        # Handle dict (including asyncpg JSONB objects)
        if isinstance(metadata, dict):
            parsed_dict = dict(metadata)
        # Handle JSON string
        elif isinstance(metadata, str):
            try:
                parsed = json.loads(metadata)
                if isinstance(parsed, dict):
                    parsed_dict = parsed
                else:
                    logger.warning(
                        "Metadata for content %s parsed to non-dict type: %s",
                        content_id,
                        type(parsed),
                    )
                    return {}
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    "Failed to parse metadata JSON for content %s: %s, using empty dict",
                    content_id,
                    e,
                )
                return {}
        else:
            logger.warning(f"Unexpected metadata type for content {content_id}: {type(metadata)}, using empty dict")
            return {}

        # Clean and validate metadata for Elasticsearch compatibility
        # Remove any non-serializable values and ensure all nested structures are dicts
        return self._clean_metadata_for_es(parsed_dict, content_id)

    def _clean_metadata_for_es(self, metadata: dict[str, Any], content_id: UUID) -> dict[str, Any]:
        """
        Clean metadata to ensure Elasticsearch compatibility.
        Removes non-serializable values and ensures proper structure.

        Args:
            metadata: Metadata dict to clean
            content_id: Content ID for logging

        Returns:
            Cleaned metadata dict
        """
        cleaned: dict[str, Any] = {}

        for key, value in metadata.items():
            # Skip None values
            if value is None:
                continue

            # Handle nested dicts recursively
            if isinstance(value, dict):
                cleaned[key] = self._clean_metadata_for_es(value, content_id)
            # Handle lists - ensure all items are serializable
            elif isinstance(value, list):
                cleaned_list: list[Any] = []
                for item in value:
                    if isinstance(item, (str, int, float, bool)):
                        cleaned_list.append(item)
                    elif isinstance(item, dict):
                        cleaned_list.append(self._clean_metadata_for_es(item, content_id))
                    # Skip non-serializable items
                cleaned[key] = cleaned_list
            # Handle primitive types
            elif isinstance(value, (str, int, float, bool)):
                cleaned[key] = value
            # Convert datetime/date to ISO string
            elif hasattr(value, "isoformat"):
                cleaned[key] = value.isoformat()
            # Skip other non-serializable types
            else:
                logger.debug(
                    "Skipping non-serializable metadata key '%s' (type: %s) for content %s",
                    key,
                    type(value).__name__,
                    content_id,
                )

        return cleaned

    async def index_content(self, content_id: UUID, user_id: str) -> bool:
        """
        Index a content item to Elasticsearch.

        Fetches content from PostgreSQL and creates/updates ES document.

        Args:
            content_id: UUID of content to index
            user_id: Owner user ID

        Returns:
            True if indexing successful, False otherwise
        """
        try:
            # Fetch content from PostgreSQL
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT
                        id, user_id, content_type, name, description,
                        tags, extracted_text, metadata, created_at,
                        visibility, friend_visibility, file_size, mime_type, updated_at,
                        source_service, shared_with_user_ids
                    FROM unified_content
                    WHERE id = $1 AND user_id = $2::uuid AND deleted_at IS NULL
                """,
                    content_id,
                    user_id,
                )

                if not row:
                    logger.warning("Content %s not found or deleted", content_id)
                    return False

                # Fetch shared user IDs
                shared_user_ids = await conn.fetch(
                    """
                    SELECT shared_with_user_id
                    FROM content_shares
                    WHERE content_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
                """,
                    content_id,
                )

            # Parse metadata using helper method
            metadata = self._parse_metadata(row["metadata"], content_id)
            legacy_shared_ids = [
                str(shared_user_id)
                for shared_user_id in (row["shared_with_user_ids"] or [])
                if shared_user_id is not None
            ]
            explicit_shared_ids = [str(s["shared_with_user_id"]) for s in shared_user_ids]
            merged_shared_ids = list(dict.fromkeys([*legacy_shared_ids, *explicit_shared_ids]))

            # Build ES document
            doc = {
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "content_type": row["content_type"],
                "name": row["name"],
                "description": row["description"] or "",
                "tags": row["tags"] or [],
                "extracted_text": row["extracted_text"] or "",
                "metadata": metadata,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                "visibility": row["visibility"],
                "friend_visibility": bool(row["friend_visibility"]),
                "source_service": row["source_service"] or "",
                "file_size": row["file_size"],
                "mime_type": row["mime_type"] or "",
                "shared_with_user_ids": merged_shared_ids,
            }

            # Index to Elasticsearch with better error handling
            try:
                await self.es.index(
                    index=self.index_name,
                    id=str(content_id),
                    document=doc,
                    refresh=False,  # Use refresh=False for better performance, ES will refresh periodically
                )
                logger.info("Successfully indexed content %s", content_id)
                return True
            except ESConnectionError as e:
                logger.exception(
                    f"Elasticsearch connection error while indexing {content_id}: {e}",
                    exc_info=False,
                )
                return False
            except RequestError as e:
                error_details = e.info if hasattr(e, "info") else str(e)
                error_msg = str(e)

                # Check if it's a metadata parsing error
                if "document_parsing_exception" in error_msg and "metadata" in error_msg.lower():
                    logger.exception(
                        f"Elasticsearch metadata parsing error for content {content_id}: {error_details}. "
                        f"Metadata was: {json.dumps(metadata, default=str)[:500]}",
                        exc_info=False,
                    )
                    # Try to re-index with cleaned metadata
                    try:
                        # Re-fetch and re-parse metadata
                        async with self.db_pool.acquire() as conn:
                            row = await conn.fetchrow(
                                """
                                SELECT metadata FROM unified_content WHERE id = $1
                            """,
                                content_id,
                            )
                            if row:
                                cleaned_metadata = self._parse_metadata(row["metadata"], content_id)
                                doc["metadata"] = cleaned_metadata
                                await self.es.index(
                                    index=self.index_name,
                                    id=str(content_id),
                                    document=doc,
                                    refresh=False,
                                )
                                logger.info(f"Successfully re-indexed content {content_id} with cleaned metadata")
                                return True
                    except Exception as retry_error:
                        logger.exception(f"Failed to retry indexing {content_id} after metadata error: {retry_error}")

                logger.exception(
                    f"Elasticsearch request error while indexing {content_id}: {error_details}",
                    exc_info=False,
                )
                return False
            except TransportError as e:
                logger.exception(
                    f"Elasticsearch transport error while indexing {content_id}: {e}",
                    exc_info=False,
                )
                return False
            except ApiError as e:
                logger.exception(f"Elasticsearch API error while indexing {content_id}: {e}", exc_info=False)
                return False

        except Exception:
            logger.exception("Failed to index content %s", content_id)
            return False

    async def update_index(self, content_id: UUID) -> bool:
        """
        Re-index existing content.

        Fetches latest content from PostgreSQL and updates ES document.

        Args:
            content_id: UUID of content to re-index

        Returns:
            True if update successful, False otherwise
        """
        try:
            # Fetch content with user_id
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT user_id
                    FROM unified_content
                    WHERE id = $1 AND deleted_at IS NULL
                """,
                    content_id,
                )

                if not row:
                    logger.warning("Content %s not found for update", content_id)
                    return False

                user_id = row["user_id"]

            # Reuse index_content logic
            return await self.index_content(content_id, user_id)

        except Exception:
            logger.exception("Failed to update index for %s", content_id)
            return False

    async def delete_from_index(self, content_id: UUID) -> bool:
        """
        Remove content from Elasticsearch index.

        Args:
            content_id: UUID of content to remove

        Returns:
            True if deletion successful, False otherwise
        """
        try:
            await self.es.delete(index=self.index_name, id=str(content_id), refresh=True)
            logger.info("Successfully deleted content %s from index", content_id)
            return True

        except NotFoundError:
            logger.debug("Content %s not found in index (delete idempotent)", content_id)
            return True  # Already gone, consider success

        except Exception:
            logger.exception("Failed to delete content %s from index", content_id)
            return False

    async def search(
        self,
        query: str,
        user_id: str,
        filters: dict[str, Any] | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Search content with full-text query and filters.

        Features:
        - Multi-field search with boosting (name^3, description^2, text^1)
        - Fuzzy matching for typo tolerance
        - Permission filtering (owner OR public OR shared)
        - Content type, tag, date range filters
        - Result highlighting

        Args:
            query: Search query string
            user_id: Current user ID for permission filtering
            filters: Optional filters dict with keys:
                - content_type: str or list
                - tags: list
                - date_from: datetime
                - date_to: datetime
            limit: Maximum results to return
            offset: Results offset for pagination

        Returns:
            (dict[str, Any]) with keys:
                - total: Total matching documents
                - results: List of result dicts
                - took_ms: Query execution time
        """
        started_at = perf_counter()
        try:
            filters = filters or {}

            # Build multi_match query
            must_clause = {
                "multi_match": {
                    "query": query,
                    "fields": [
                        "name^3",
                        "name.russian^3",
                        "description^2",
                        "description.russian^2",
                        "extracted_text",
                    ],
                    "fuzziness": "AUTO",
                    "prefix_length": 2,
                    "operator": "or",
                }
            }

            # Permission filter
            permission_filter = await self._build_permission_filter(user_id)

            # Additional filters
            filter_clauses = [permission_filter]

            # Content type filter
            if filters.get("content_type"):
                ct = filters["content_type"]
                if isinstance(ct, list):
                    filter_clauses.append({"terms": {"content_type": ct}})
                else:
                    filter_clauses.append({"term": {"content_type": ct}})

            # Tags filter
            if filters.get("tags"):
                for tag in filters["tags"]:
                    filter_clauses.append({"term": {"tags": tag}})

            if filters.get("must_have_tags"):
                for tag in filters["must_have_tags"]:
                    filter_clauses.append({"term": {"tags": tag}})

            # Date range filter
            if filters.get("date_from") or filters.get("date_to"):
                date_range = {}
                if filters.get("date_from"):
                    date_range["gte"] = filters["date_from"].isoformat()
                if filters.get("date_to"):
                    date_range["lte"] = filters["date_to"].isoformat()
                filter_clauses.append({"range": {"created_at": date_range}})

            if filters.get("visibility"):
                visibility_filter = await self._build_visibility_filter(user_id, filters["visibility"])
                if visibility_filter:
                    filter_clauses.append(visibility_filter)

            # Build final query
            es_query = {
                "bool": {
                    "must": must_clause,
                    "filter": filter_clauses,
                    "must_not": {"exists": {"field": "deleted_at"}},
                }
            }

            # Execute search
            response = await self.es.search(
                index=self.index_name,
                query=es_query,
                from_=offset,
                size=limit,
                timeout="5s",
                highlight={
                    "fields": {
                        "name": {},
                        "description": {},
                        "extracted_text": {"fragment_size": 150},
                    },
                    "pre_tags": ["<mark>"],
                    "post_tags": ["</mark>"],
                },
            )

            # Parse results
            results = []
            for hit in response["hits"]["hits"]:
                result = {
                    "id": hit["_id"],
                    "name": hit["_source"]["name"],
                    "description": hit["_source"]["description"],
                    "content_type": hit["_source"]["content_type"],
                    "tags": hit["_source"]["tags"],
                    "created_at": hit["_source"]["created_at"],
                    "score": hit["_score"],
                    "highlight": hit.get("highlight", {}),
                }
                results.append(result)

            result = {
                "total": response["hits"]["total"]["value"],
                "results": results,
                "took_ms": response["took"],
            }
            logger.info(
                "content_search.search_ok user_id=%s query_len=%s results=%s took_ms=%s service_ms=%s",
                user_id,
                len(query),
                result["total"],
                result["took_ms"],
                int((perf_counter() - started_at) * 1000),
            )
            return result

        except Exception as exc:
            logger.exception(
                "content_search.search_failed user_id=%s query_len=%s service_ms=%s",
                user_id,
                len(query),
                int((perf_counter() - started_at) * 1000),
            )
            raise RuntimeError("Search backend error") from exc

    async def advanced_search(self, search_params: dict[str, Any], user_id: str) -> dict[str, Any]:
        """
        Advanced search with complex boolean queries.

        Supports:
        - Complex bool queries (must/should/filter)
        - Multiple content types
        - Multiple tags (OR logic)
        - Date range filtering
        - File size range filtering
        - Visibility filtering

        Args:
            search_params: dict[str, Any] with search parameters:
                - query: str (optional, free-text search)
                - content_types: list (optional)
                - tags: list (optional, OR logic)
                - date_range: dict with 'from' and 'to'
                - file_size_range: dict with 'min' and 'max'
                - visibility: str or list
                - must_have_tags: list (AND logic)
                - limit: int
                - offset: int
            user_id: Current user ID for permissions

        Returns:
            Same format as search()
        """
        started_at = perf_counter()
        try:
            limit = search_params.get("limit", 20)
            offset = search_params.get("offset", 0)

            # Build bool query components
            must_clauses = []
            should_clauses = []
            filter_clauses = []

            # Free-text search (optional)
            if search_params.get("query"):
                must_clauses.append(
                    {
                        "multi_match": {
                            "query": search_params["query"],
                            "fields": [
                                "name^3",
                                "name.russian^3",
                                "description^2",
                                "description.russian^2",
                                "extracted_text",
                            ],
                            "fuzziness": "AUTO",
                            "prefix_length": 2,
                        }
                    }
                )

            # Permission filter (always required)
            filter_clauses.append(await self._build_permission_filter(user_id))

            # Content types filter
            if search_params.get("content_types"):
                filter_clauses.append({"terms": {"content_type": search_params["content_types"]}})

            # Tags filter (OR logic - any tag matches)
            if search_params.get("tags"):
                should_clauses.append({"terms": {"tags": search_params["tags"]}})

            # Must-have tags filter (AND logic - all tags required)
            if search_params.get("must_have_tags"):
                for tag in search_params["must_have_tags"]:
                    filter_clauses.append({"term": {"tags": tag}})

            # Date range filter
            if search_params.get("date_range"):
                date_range = {}
                if search_params["date_range"].get("from") is not None:
                    date_range["gte"] = search_params["date_range"]["from"]
                if search_params["date_range"].get("to") is not None:
                    date_range["lte"] = search_params["date_range"]["to"]
                if date_range:
                    filter_clauses.append({"range": {"created_at": date_range}})

            # File size range filter
            if search_params.get("file_size_range"):
                size_range = {}
                if search_params["file_size_range"].get("min") is not None:
                    size_range["gte"] = search_params["file_size_range"]["min"]
                if search_params["file_size_range"].get("max") is not None:
                    size_range["lte"] = search_params["file_size_range"]["max"]
                if size_range:
                    filter_clauses.append({"range": {"file_size": size_range}})

            # Visibility filter
            if search_params.get("visibility"):
                visibility_filter = await self._build_visibility_filter(user_id, search_params["visibility"])
                if visibility_filter:
                    filter_clauses.append(visibility_filter)

            # Build final query
            es_query = {"bool": {"filter": filter_clauses, "must_not": {"exists": {"field": "deleted_at"}}}}

            if must_clauses:
                es_query["bool"]["must"] = must_clauses

            if should_clauses:
                es_query["bool"]["should"] = should_clauses
                es_query["bool"]["minimum_should_match"] = 1  # type: ignore[assignment]

            # Execute search
            response = await self.es.search(
                index=self.index_name,
                query=es_query,
                from_=offset,
                size=limit,
                timeout="5s",
                highlight={
                    "fields": {
                        "name": {},
                        "description": {},
                        "extracted_text": {"fragment_size": 150},
                    },
                    "pre_tags": ["<mark>"],
                    "post_tags": ["</mark>"],
                },
            )

            # Parse results
            results = []
            for hit in response["hits"]["hits"]:
                result = {
                    "id": hit["_id"],
                    "name": hit["_source"]["name"],
                    "description": hit["_source"]["description"],
                    "content_type": hit["_source"]["content_type"],
                    "tags": hit["_source"]["tags"],
                    "file_size": hit["_source"]["file_size"],
                    "mime_type": hit["_source"]["mime_type"],
                    "created_at": hit["_source"]["created_at"],
                    "score": hit["_score"],
                    "highlight": hit.get("highlight", {}),
                }
                results.append(result)

            result = {
                "total": response["hits"]["total"]["value"],
                "results": results,
                "took_ms": response["took"],
            }
            logger.info(
                "content_search.advanced_ok user_id=%s query_len=%s results=%s took_ms=%s service_ms=%s",
                user_id,
                len(str(search_params.get("query", ""))),
                result["total"],
                result["took_ms"],
                int((perf_counter() - started_at) * 1000),
            )
            return result

        except Exception as exc:
            logger.exception(
                "content_search.advanced_failed user_id=%s query_len=%s service_ms=%s",
                user_id,
                len(str(search_params.get("query", ""))),
                int((perf_counter() - started_at) * 1000),
            )
            raise RuntimeError("Advanced search backend error") from exc

    async def suggest_tags(self, prefix: str, user_id: str, limit: int = 10) -> list[str]:
        """
        Get tag suggestions for autocomplete.

        Queries PostgreSQL content_tags table for tags matching prefix,
        ordered by usage count.

        Args:
            prefix: Tag prefix to search for
            limit: Maximum suggestions to return

        Returns:
            List of tag strings
        """
        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT tag
                    FROM content_tags
                    WHERE tag ILIKE $1 AND (user_id)::text = $2
                    ORDER BY usage_count DESC
                    LIMIT $3
                """,
                    f"{prefix}%",
                    user_id,
                    limit,
                )

                return [row["tag"] for row in rows]

        except Exception:
            logger.exception("Tag suggestion failed for prefix '%s'", prefix)
            return []
