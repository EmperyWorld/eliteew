#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Документный pipeline: индексация, извлечение текста, шаблоны индексов, retention/health.
# Invariants:
#   - Внутренние метки времени и health — UTC через datetime_helpers; индекс см. elasticsearch_indices.
# Related:
#   - documentation/platform (ES при необходимости), redis_service при флагах
# ------------------------------------------------------------------------------
"""Elasticsearch document pipeline: indexing, Tika extraction, templates, analysers."""

import base64
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, cast

import aiohttp  # type: ignore[import-not-found]

from api.utils.datetime_helpers import utc_now_iso, utc_now_naive

try:
    from api.core.elasticsearch_indices import INDEX_EMPERYWORLD_DOCUMENTS
    from api.core.unified_config import unified_settings
    from api.services.redis_service import RedisService

    CONFIG_AVAILABLE = True
except ImportError:
    INDEX_EMPERYWORLD_DOCUMENTS = "emperyworld_documents"
    CONFIG_AVAILABLE = False
    logging.warning("Configuration services not available - Elasticsearch functionality limited")

from api.core.infra_client_timeouts import elasticsearch_resilience_settings
from api.core.pdf_engine import page_count_from_bytes

logger = logging.getLogger(__name__)


def _estimate_document_pages_count(file_content: bytes, filename: str) -> int | None:
    """Best-effort page count for PDFs (PyMuPDF). Other formats: None until Tika metadata is wired."""
    if Path(filename).suffix.lower() != ".pdf":
        return None
    try:
        return page_count_from_bytes(file_content)
    except Exception as exc:
        logger.debug("[STEP] elasticsearch_pdf_page_count_skip filename=%s err=%s", filename, exc)
        return None


class ElasticsearchDocumentService:
    def __init__(
        self,
        es_host: str = "http://stack1-elasticsearch:9200",
        tika_url: str = "http://stack4-tika:9998",
        *,
        request_timeout: float | None = None,
    ):
        # request_timeout: max seconds for HTTP requests (connect + total). None = env/default 60.
        # Resolve configuration from unified settings when available
        resolved_es_host = es_host
        resolved_tika_url = tika_url
        self._auth: aiohttp.BasicAuth | None = None
        resilience = elasticsearch_resilience_settings()
        self._request_timeout = (
            float(request_timeout) if request_timeout is not None else float(resilience["request_timeout"])
        )
        self._connect_timeout = float(resilience["connect_timeout"])
        if request_timeout is not None:
            self._connect_timeout = min(self._connect_timeout, self._request_timeout)

        if CONFIG_AVAILABLE:
            try:
                resolved_es_host = unified_settings.get_connection_string("elasticsearch") or es_host
                resolved_tika_url = unified_settings.tika_url or tika_url

                es_user = unified_settings.elasticsearch_user
                es_password = unified_settings.elasticsearch_password or ""
                if es_user or es_password:
                    self._auth = aiohttp.BasicAuth(es_user, es_password)
            except Exception as config_error:
                logger.warning("Failed to load unified configuration for Elasticsearch service: %s", config_error)

        self.es_host = resolved_es_host.rstrip("/")
        self.tika_url = resolved_tika_url.rstrip("/")
        self.index_name = INDEX_EMPERYWORLD_DOCUMENTS
        self.session: aiohttp.ClientSession | None = None

        # File extensions passed to Tika / ingest validation
        self.supported_formats = [
            ".pdf",
            ".docx",
            ".doc",
            ".txt",
            ".rtf",
            ".odt",
            ".html",
            ".xml",
            ".csv",
            ".json",
            ".png",
            ".jpg",
            ".jpeg",
            ".tiff",
            ".bmp",
        ]

    async def initialize(self) -> None:
        """Open HTTP session and ensure target index exists."""
        if not self.session:
            connect = min(self._connect_timeout, self._request_timeout)
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self._request_timeout, connect=connect),
                auth=self._auth,
            )
            await self._init_index()

    async def close(self) -> None:
        """Close aiohttp session."""
        if self.session:
            await self.session.close()
            self.session = None

    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def _init_index(self) -> None:
        """Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð¸Ð½Ð´ÐµÐºÑÐ° Elasticsearch"""
        if not self.session:
            logger.error("Session not initialized")
            return
        try:
            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÑÑÐµÑÑÐ²ÑÐµÑ Ð»Ð¸ Ð¸Ð½Ð´ÐµÐºÑ
            async with self.session.head(f"{self.es_host}/{self.index_name}") as response:
                if response.status == 404:
                    # Ð¡Ð¾Ð·Ð´Ð°ÑÐ¼ Ð¸Ð½Ð´ÐµÐºÑ Ñ Ð½Ð°ÑÑÑÐ¾Ð¹ÐºÐ°Ð¼Ð¸
                    index_settings = {
                        "settings": {
                            "number_of_shards": 1,
                            "number_of_replicas": 0,
                            "analysis": {"analyzer": {"default": {"type": "standard"}}},
                        },
                        "mappings": {
                            "properties": {
                                "title": {"type": "text"},
                                "content": {"type": "text"},
                                "filename": {"type": "keyword"},
                                "file_hash": {"type": "keyword"},
                                "file_size": {"type": "long"},
                                "word_count": {"type": "integer"},
                                "created_at": {"type": "date"},
                                "file_type": {"type": "keyword"},
                                "file_base64": {"type": "text", "index": False},
                                "user_id": {"type": "keyword"},
                                "tags": {"type": "keyword"},
                                "processed": {"type": "boolean"},
                                "ai_analyzed": {"type": "boolean"},
                                "pages_count": {"type": "integer"},
                                "text_extracted": {"type": "boolean"},
                            }
                        },
                    }

                    async with self.session.put(
                        f"{self.es_host}/{self.index_name}", json=index_settings
                    ) as create_response:
                        if create_response.status in [200, 201]:
                            logger.info(f"Index {self.index_name} created")
                        else:
                            logger.warning(f"Elasticsearch cluster status: {create_response.status}")
                else:
                    logger.info(f"Index {self.index_name} already exists")

        except Exception as e:
            logger.exception(f"Error: {e!s}")

    async def process_document(
        self, file_content: bytes, filename: str, user_id: str, tags: list[str] | None = None, auto_process: bool = True
    ) -> dict[str, Any]:
        """
        ð ÐÐ±ÑÐ°Ð±Ð¾ÑÐºÐ° Ð¸ ÑÐ¾ÑÑÐ°Ð½ÐµÐ½Ð¸Ðµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°

        Args:
            file_content: Ð¡Ð¾Ð´ÐµÑÐ¶Ð¸Ð¼Ð¾Ðµ ÑÐ°Ð¹Ð»Ð° Ð² Ð±Ð°Ð¹ÑÐ°Ñ
            filename: ÐÐ¼Ñ ÑÐ°Ð¹Ð»Ð°
            user_id: ID Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»Ñ
            tags: Ð¢ÐµÐ³Ð¸ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
            auto_process: ÐÐ²ÑÐ¾Ð¼Ð°ÑÐ¸ÑÐµÑÐºÐ¸ Ð¸Ð·Ð²Ð»ÐµÐºÐ°ÑÑ ÑÐµÐºÑÑ

        Returns:
            (dict[str, Any]) Ñ ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ°Ð¼Ð¸ Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ¸
        """
        await self.initialize()
        try:
            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÐ¾ÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ðµ Ñ Elasticsearch
            if not self.session:
                return {"success": False, "error": "Session not initialized", "message": "Session not initialized"}
            assert self.session is not None
            async with self.session.get(f"{self.es_host}/_cluster/health") as response:
                if response.status != 200:
                    msg = f"Elasticsearch Ð½ÐµÐ´Ð¾ÑÑÑÐ¿ÐµÐ½: {response.status}"
                    raise Exception(msg)

            # Ð¥ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
            doc_hash = hashlib.md5(file_content).hexdigest()

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ Ð´ÑÐ±Ð»Ð¸ÐºÐ°Ñ
            duplicate_query = {"query": {"term": {"file_hash": doc_hash}}, "size": 1}

            assert self.session is not None
            async with self.session.post(
                f"{self.es_host}/{self.index_name}/_search", json=duplicate_query
            ) as dup_response:
                if dup_response.status == 200:
                    dup_data = await dup_response.json()
                    if dup_data["hits"]["total"]["value"] > 0:
                        existing = dup_data["hits"]["hits"][0]
                        return {
                            "success": False,
                            "error": "duplicate",
                            "message": "ÐÐ¾ÐºÑÐ¼ÐµÐ½Ñ ÑÐ¶Ðµ ÑÑÑÐµÑÑÐ²ÑÐµÑ",
                            "existing_id": existing["_id"],
                            "existing_title": existing["_source"].get("title", "ÐÐµÐ· Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ"),
                        }

            # ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ ÑÐµÐºÑÑÐ° ÑÐµÑÐµÐ· Apache Tika
            extracted_text = ""
            word_count = 0

            if auto_process:
                try:
                    headers = {"Accept": "text/plain; charset=utf-8", "Content-Type": "application/octet-stream"}

                    assert self.session is not None
                    async with self.session.put(
                        f"{self.tika_url}/tika", data=file_content, headers=headers
                    ) as text_response:
                        if text_response.status == 200:
                            extracted_text = await text_response.text()

                            # ÐÑÐ¿ÑÐ°Ð²Ð»ÑÐµÐ¼ ÐºÐ¾Ð´Ð¸ÑÐ¾Ð²ÐºÑ ÐµÑÐ»Ð¸ Ð½ÑÐ¶Ð½Ð¾
                            if extracted_text.startswith("Ã"):
                                content_bytes = await text_response.read()
                                try:
                                    extracted_text = content_bytes.decode("utf-8")
                                except Exception:
                                    try:
                                        extracted_text = content_bytes.decode("windows-1251")
                                    except Exception:
                                        extracted_text = content_bytes.decode("latin-1", errors="ignore")

                            word_count = len(extracted_text.split())
                            logger.info(f"Extracted {word_count} words from {filename}")
                        else:
                            logger.warning(f"Tika unavailable: {text_response.status}")

                except Exception as e:
                    logger.exception(f"Error: {e}")

            # ÐÐµÐ½ÐµÑÐ¸ÑÑÐµÐ¼ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ
            if extracted_text:
                clean_text = " ".join(extracted_text.split()[:10])
                clean_text = "".join(c for c in clean_text if c.isalnum() or c.isspace())
                title = clean_text[:100] if clean_text else filename
            else:
                title = filename

            pages_count = _estimate_document_pages_count(file_content, filename)

            # ÐÐ¾Ð´Ð³Ð¾ÑÐ¾Ð²ÐºÐ° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
            document = {
                "title": title,
                "content": extracted_text,
                "filename": filename,
                "file_hash": doc_hash,
                "file_size": len(file_content),
                "word_count": word_count,
                "created_at": utc_now_iso(),
                "file_type": Path(filename).suffix.lower().lstrip(".") if "." in filename else "unknown",
                "tags": tags or [],
                "file_base64": base64.b64encode(file_content).decode(),
                "user_id": user_id,
                "processed": True,
                "ai_analyzed": False,
                "text_extracted": bool(extracted_text),
                "pages_count": pages_count,
            }

            # Сохраняем в Elasticsearch
            assert self.session is not None
            async with self.session.put(
                f"{self.es_host}/{self.index_name}/_doc/{doc_hash}", json=document
            ) as index_response:
                if index_response.status in [200, 201]:
                    logger.info(f"Document {filename} indexed, id={doc_hash[:12]}...")

                    return {
                        "success": True,
                        "document_id": doc_hash,
                        "title": title,
                        "filename": filename,
                        "file_size": len(file_content),
                        "word_count": word_count,
                        "text_extracted": bool(extracted_text),
                        "processed": True,
                    }
                error_text = await index_response.text()
                msg = f"ÐÑÐ¸Ð±ÐºÐ° Ð¸Ð½Ð´ÐµÐºÑÐ°ÑÐ¸Ð¸: {index_response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ¸: {e!s}"}

    async def search_documents(
        self, query: str, user_id: str | None = None, limit: int = 10, search_type: str = "multi_match"
    ) -> dict[str, Any]:
        """
        ð ÐÐ¾Ð¸ÑÐº Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð²

        Args:
            query: ÐÐ¾Ð¸ÑÐºÐ¾Ð²ÑÐ¹ Ð·Ð°Ð¿ÑÐ¾Ñ
            user_id: ID Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»Ñ (Ð¾Ð¿ÑÐ¸Ð¾Ð½Ð°Ð»ÑÐ½Ð¾)
            limit: ÐÐ¸Ð¼Ð¸Ñ ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ¾Ð²
            search_type: Ð¢Ð¸Ð¿ Ð¿Ð¾Ð¸ÑÐºÐ°
        if not self.session:
            return {"success": False, "error": "Session not initialized", "results": []}

        Returns:
            (dict[str, Any]) Ñ ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ°Ð¼Ð¸ Ð¿Ð¾Ð¸ÑÐºÐ°
        """
        await self.initialize()
        try:
            # Ð¤Ð¾ÑÐ¼Ð¸ÑÑÐµÐ¼ Ð·Ð°Ð¿ÑÐ¾Ñ
            if search_type == "multi_match":
                es_query = {
                    "query": {
                        "bool": {
                            "must": {
                                "multi_match": {
                                    "query": query,
                                    "fields": ["title^2", "content", "filename"],
                                    "type": "best_fields",
                                }
                            }
                        }
                    },
                    "size": limit,
                    "highlight": {"fields": {"content": {"fragment_size": 150, "number_of_fragments": 1}}},
                    "_source": {
                        "excludes": ["file_base64"]  # ÐÑÐºÐ»ÑÑÐ°ÐµÐ¼ base64 ÐºÐ¾Ð½ÑÐµÐ½Ñ Ð¸Ð· ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ¾Ð²
                    },
                }
            else:
                es_query = {"query": {"bool": {"must": {"match": {"content": query}}}}, "size": limit}

            # ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¸Ð»ÑÑÑ Ð¿Ð¾ Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»Ñ ÐµÑÐ»Ð¸ ÑÐºÐ°Ð·Ð°Ð½
            if user_id:
                query_dict: dict[str, Any] = cast("dict[str, Any]", es_query["query"])
                if "bool" not in query_dict:
                    es_query["query"] = {"bool": {"must": query_dict}}

                query_obj: dict[str, Any] = cast("dict[str, Any]", es_query["query"])
                bool_obj: dict[str, Any] = cast("dict[str, Any]", query_obj["bool"])
                bool_query_dict: dict[str, Any] = dict(bool_obj)
                if "filter" not in bool_query_dict:
                    bool_query_dict["filter"] = []

                bool_query_dict["filter"].append({"term": {"user_id": user_id}})
                query_obj["bool"] = bool_query_dict
                es_query["query"] = query_obj

            # ÐÑÐ¿Ð¾Ð»Ð½ÑÐµÐ¼ Ð¿Ð¾Ð¸ÑÐº
            assert self.session is not None
            async with self.session.post(f"{self.es_host}/{self.index_name}/_search", json=es_query) as response:
                if response.status != 200:
                    error_text = await response.text()
                    msg = f"ÐÑÐ¸Ð±ÐºÐ° Ð¿Ð¾Ð¸ÑÐºÐ°: {response.status} - {error_text}"
                    raise Exception(msg)

                data = await response.json()
                total = data["hits"]["total"]["value"]

                results = []
                for hit in data["hits"]["hits"]:
                    doc = hit["_source"]
                    result = {
                        "id": hit["_id"],
                        "score": hit["_score"],
                        "title": doc.get("title", "ÐÐµÐ· Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ"),
                        "filename": doc.get("filename", ""),
                        "file_size": doc.get("file_size", 0),
                        "word_count": doc.get("word_count", 0),
                        "created_at": doc.get("created_at", ""),
                        "file_type": doc.get("file_type", ""),
                        "text_extracted": doc.get("text_extracted", False),
                        "processed": doc.get("processed", False),
                    }

                    # ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð¿Ð¾Ð´ÑÐ²ÐµÑÐºÑ
                    if "highlight" in hit and "content" in hit["highlight"]:
                        result["highlight"] = hit["highlight"]["content"][0]

                    results.append(result)

                return {"success": True, "total": total, "results": results, "query": query}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° Ð¿Ð¾Ð¸ÑÐºÐ°: {e!s}"}

    async def get_document(self, document_id: str, include_content: bool = False) -> dict[str, Any]:
        """
        ð ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð¿Ð¾ ID

        Args:
        if not self.session:
            return {"success": False, "error": "Session not initialized"}
            document_id: ID Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
            include_content: ÐÐºÐ»ÑÑÐ¸ÑÑ ÑÐ¾Ð´ÐµÑÐ¶Ð¸Ð¼Ð¾Ðµ ÑÐ°Ð¹Ð»Ð°

        Returns:
            (dict[str, Any]) Ñ Ð´Ð°Ð½Ð½ÑÐ¼Ð¸ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
        """
        await self.initialize()
        try:
            # ÐÑÐ»Ð¸ ID ÐºÐ¾ÑÐ¾ÑÐºÐ¸Ð¹, Ð¸ÑÐµÐ¼ Ð¿Ð¾ Ð¿ÑÐµÑÐ¸ÐºÑÑ hash
            if len(document_id) < 20:
                search_query = {"query": {"prefix": {"file_hash": document_id}}, "size": 1}

                assert self.session is not None
                async with self.session.post(
                    f"{self.es_host}/{self.index_name}/_search", json=search_query
                ) as response:
                    if response.status == 200:
                        data: dict[str, Any] = await response.json()
                        hits_data = data.get("hits", {})
                        if isinstance(hits_data, dict):
                            total_data = hits_data.get("total", {})
                            if isinstance(total_data, dict) and total_data.get("value", 0) > 0:
                                hits_list = hits_data.get("hits", [])
                                if hits_list and isinstance(hits_list[0], dict):
                                    document_id = hits_list[0].get("_id", document_id)

            # ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ
            assert self.session is not None
            async with self.session.get(f"{self.es_host}/{self.index_name}/_doc/{document_id}") as response:
                if response.status != 200:
                    return {"success": False, "error": "not_found", "message": "ÐÐ¾ÐºÑÐ¼ÐµÐ½Ñ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½"}

                data = await response.json()
                doc = data["_source"]

                result = {
                    "success": True,
                    "id": data["_id"],
                    "title": doc.get("title", "ÐÐµÐ· Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ"),
                    "filename": doc.get("filename", ""),
                    "file_size": doc.get("file_size", 0),
                    "word_count": doc.get("word_count", 0),
                    "created_at": doc.get("created_at", ""),
                    "file_type": doc.get("file_type", ""),
                    "content": doc.get("content", ""),
                    "tags": doc.get("tags", []),
                    "processed": doc.get("processed", False),
                    "ai_analyzed": doc.get("ai_analyzed", False),
                    "text_extracted": doc.get("text_extracted", False),
                    "user_id": doc.get("user_id", ""),
                }

                # ÐÐºÐ»ÑÑÐ°ÐµÐ¼ ÑÐ°Ð¹Ð» ÐµÑÐ»Ð¸ Ð·Ð°Ð¿ÑÐ¾ÑÐµÐ½
                if include_content and "file_base64" in doc:
                    result["file_base64"] = doc["file_base64"]

                return result

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°: {e!s}"}

    async def get_user_documents(
        self, user_id: str, limit: int = 50, offset: int = 0, status: str | None = None
    ) -> dict[str, Any]:
        """
        ð ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÑ Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»Ñ
        """
        await self.initialize()
        if not self.session:
            return {"success": False, "error": "Session not initialized", "documents": []}
        try:
            query = {
                "query": {"bool": {"must": [{"term": {"user_id": user_id}}]}},
                "from": offset,
                "size": limit,
                "sort": [{"created_at": {"order": "desc"}}],
                "_source": {"excludes": ["file_base64", "content"]},
            }

            # ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¸Ð»ÑÑÑ Ð¿Ð¾ ÑÑÐ°ÑÑÑÑ ÐµÑÐ»Ð¸ ÑÐºÐ°Ð·Ð°Ð½
            if status:
                query_obj: dict[str, Any] = cast("dict[str, Any]", query["query"])
                bool_obj: dict[str, Any] = cast("dict[str, Any]", query_obj["bool"])
                bool_query_dict: dict[str, Any] = dict(bool_obj)
                must_list = bool_query_dict.get("must", [])
                if status == "processed":
                    must_list.append({"term": {"processed": True}})
                elif status == "ai_analyzed":
                    must_list.append({"term": {"ai_analyzed": True}})
                bool_query_dict["must"] = must_list
                query_obj["bool"] = bool_query_dict
                query["query"] = query_obj

            assert self.session is not None
            async with self.session.post(f"{self.es_host}/{self.index_name}/_search", json=query) as response:
                if response.status != 200:
                    error_text = await response.text()
                    msg = f"ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð¿ÑÐ¾ÑÐ°: {response.status} - {error_text}"
                    raise Exception(msg)

                data = await response.json()
                total = data["hits"]["total"]["value"]

                documents = []
                for hit in data["hits"]["hits"]:
                    doc = hit["_source"]
                    documents.append(
                        {
                            "id": hit["_id"],
                            "title": doc.get("title", "ÐÐµÐ· Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ"),
                            "filename": doc.get("filename", ""),
                            "file_size": doc.get("file_size", 0),
                            "word_count": doc.get("word_count", 0),
                            "created_at": doc.get("created_at", ""),
                            "file_type": doc.get("file_type", ""),
                            "processed": doc.get("processed", False),
                            "ai_analyzed": doc.get("ai_analyzed", False),
                            "text_extracted": doc.get("text_extracted", False),
                            "tags": doc.get("tags", []),
                        }
                    )

                return {"success": True, "total": total, "documents": documents, "limit": limit, "offset": offset}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"ÐÑÐ¸Ð±ÐºÐ° Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð²: {e!s}",
            }

    async def delete_document(self, document_id: str, user_id: str | None = None) -> dict[str, Any]:
        """
        ðï¸ Ð£Ð´Ð°Ð»Ð¸ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ
        """
        await self.initialize()
        try:
            # Ð¡Ð½Ð°ÑÐ°Ð»Ð° Ð¿ÑÐ¾Ð²ÐµÑÑÐµÐ¼ Ð¿ÑÐ°Ð²Ð° Ð´Ð¾ÑÑÑÐ¿Ð° ÐµÑÐ»Ð¸ ÑÐºÐ°Ð·Ð°Ð½ user_id
            if user_id:
                doc_info = await self.get_document(document_id)
                if not doc_info["success"]:
                    return doc_info

                if doc_info.get("user_id") != user_id:
                    return {"success": False, "error": "access_denied", "message": "ÐÐ¾ÑÑÑÐ¿ Ð·Ð°Ð¿ÑÐµÑÐµÐ½"}

            assert self.session is not None
            async with self.session.delete(f"{self.es_host}/{self.index_name}/_doc/{document_id}") as response:
                if response.status in [200, 404]:
                    return {"success": True, "message": "ÐÐ¾ÐºÑÐ¼ÐµÐ½Ñ ÑÐ´Ð°Ð»ÐµÐ½"}
                error_text = await response.text()
                msg = f"ÐÑÐ¸Ð±ÐºÐ° ÑÐ´Ð°Ð»ÐµÐ½Ð¸Ñ: {response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° ÑÐ´Ð°Ð»ÐµÐ½Ð¸Ñ: {e!s}"}

    async def download_document(self, document_id: str, user_id: str | None = None) -> dict[str, Any]:
        """
        ð¾ ÐÐ¾Ð»ÑÑÐ¸ÑÑ ÑÐ°Ð¹Ð» Ð´Ð»Ñ ÑÐºÐ°ÑÐ¸Ð²Ð°Ð½Ð¸Ñ
        """
        await self.initialize()
        if not self.session:
            return {"success": False, "error": "Session not initialized"}
        try:
            doc_info = await self.get_document(document_id, include_content=True)

            if not doc_info["success"]:
                return doc_info

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ Ð¿ÑÐ°Ð²Ð° Ð´Ð¾ÑÑÑÐ¿Ð°
            if user_id and doc_info.get("user_id") != user_id:
                return {"success": False, "error": "access_denied", "message": "ÐÐ¾ÑÑÑÐ¿ Ð·Ð°Ð¿ÑÐµÑÐµÐ½"}

            if "file_base64" not in doc_info:
                return {
                    "success": False,
                    "error": "no_content",
                    "message": "Ð¡Ð¾Ð´ÐµÑÐ¶Ð¸Ð¼Ð¾Ðµ ÑÐ°Ð¹Ð»Ð° Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾",
                }

            # ÐÐµÐºÐ¾Ð´Ð¸ÑÑÐµÐ¼ ÑÐ°Ð¹Ð»
            file_bytes = base64.b64decode(doc_info["file_base64"])

            return {
                "success": True,
                "filename": doc_info["filename"],
                "content": file_bytes,
                "size": len(file_bytes),
                "content_type": self._get_content_type(doc_info["file_type"]),
            }

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° ÑÐºÐ°ÑÐ¸Ð²Ð°Ð½Ð¸Ñ: {e!s}"}

    def _get_content_type(self, file_type: str) -> str:
        """ÐÐ¾Ð»ÑÑÐ¸ÑÑ MIME type Ð¿Ð¾ ÑÐ°ÑÑÐ¸ÑÐµÐ½Ð¸Ñ ÑÐ°Ð¹Ð»Ð°"""
        content_types = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "doc": "application/msword",
            "txt": "text/plain",
            "rtf": "application/rtf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "csv": "text/csv",
            "json": "application/json",
            "xml": "application/xml",
        }
        return content_types.get(file_type, "application/octet-stream")

    async def check_health(self) -> dict[str, Any]:
        """
        ð¥ ÐÑÐ¾Ð²ÐµÑÐºÐ° ÑÐ¾ÑÑÐ¾ÑÐ½Ð¸Ñ ÑÐµÑÐ²Ð¸ÑÐ¾Ð²
        """
        await self.initialize()
        if not self.session:
            return {"success": False, "error": "Session not initialized", "results": {}}
        try:
            results: dict[str, Any] = {
                "elasticsearch": {"status": "unknown"},
                "tika": {"status": "unknown"},
                "index": {"status": "unknown"},
            }

            # ÐÑÐ¾Ð²ÐµÑÐºÐ° Elasticsearch
            try:
                async with self.session.get(f"{self.es_host}/_cluster/health") as response:
                    if response.status == 200:
                        health_data = await response.json()
                        results["elasticsearch"] = {
                            "status": "healthy",
                            "cluster_status": health_data.get("status", "unknown"),
                            "nodes": health_data.get("number_of_nodes", 0),
                        }
                    else:
                        results["elasticsearch"]["status"] = f"error_{response.status}"
            except Exception as e:
                results["elasticsearch"] = {"status": "error", "error": str(e)}

            # ÐÑÐ¾Ð²ÐµÑÐºÐ° Tika
            try:
                async with self.session.get(f"{self.tika_url}/version") as response:
                    if response.status == 200:
                        results["tika"]["status"] = "healthy"
                    else:
                        results["tika"]["status"] = f"error_{response.status}"
            except Exception as e:
                results["tika"] = {"status": "error", "error": str(e)}

            # ÐÑÐ¾Ð²ÐµÑÐºÐ° Ð¸Ð½Ð´ÐµÐºÑÐ°
            try:
                async with self.session.get(f"{self.es_host}/{self.index_name}/_stats") as response:
                    if response.status == 200:
                        stats_data = await response.json()
                        if "_all" in stats_data and "primaries" in stats_data["_all"]:
                            docs = stats_data["_all"]["primaries"]["docs"]
                            store = stats_data["_all"]["primaries"]["store"]

                            results["index"] = {
                                "status": "healthy",
                                "documents": docs.get("count", 0),
                                "size_mb": round(store.get("size_in_bytes", 0) / 1024 / 1024, 1),
                            }
                        else:
                            results["index"]["status"] = "no_stats"
                    else:
                        results["index"]["status"] = f"error_{response.status}"
            except Exception as e:
                results["index"] = {"status": "error", "error": str(e)}

            return {
                "success": True,
                "services": results,
                "overall_status": "healthy"
                if all(r.get("status") == "healthy" for r in results.values())
                else "degraded",
            }

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"success": False, "error": str(e), "message": f"ÐÑÐ¸Ð±ÐºÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸: {e!s}"}


class ElasticsearchIndexManager:
    """
    ð¯ð ELASTICSEARCH INDEX MANAGER ðð¯

    Enterprise-grade index management for production environments

    ÐÐ¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑÐ¸:
    - Index templates management
    - Multi-language analyzers
    - Index lifecycle management
    - Bulk operations optimization
    - Health monitoring
    - Index aliases management
    - Retention policies
    """

    def __init__(self, es_host: str | None = None, redis_service: RedisService | None = None):
        if CONFIG_AVAILABLE:
            self.es_host = (es_host or unified_settings.elasticsearch.internal_url).rstrip("/")
        else:
            self.es_host = (es_host or "http://stack1-elasticsearch:9200").rstrip("/")

        self.redis_service = redis_service
        self.session: aiohttp.ClientSession | None = None

        # Index configurations
        self.index_configs = {
            "documents": {
                "pattern": "eliteew_documents-*",
                "template_name": "eliteew_documents_template",
                "rotation": "monthly",  # YYYY.MM
                "retention_days": 730,  # 2 years
                "settings": {
                    "number_of_shards": 2,
                    "number_of_replicas": 0,
                    "refresh_interval": "30s",
                    "max_result_window": 50000,
                },
            },
            "logs": {
                "pattern": "eliteew_logs-*",
                "template_name": "eliteew_logs_template",
                "rotation": "daily",  # YYYY.MM.DD
                "retention_days": 30,  # 30 days
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "refresh_interval": "5s",
                    "max_result_window": 10000,
                },
            },
            "metrics": {
                "pattern": "eliteew_metrics-*",
                "template_name": "eliteew_metrics_template",
                "rotation": "daily",  # YYYY.MM.DD
                "retention_days": 90,  # 90 days
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "refresh_interval": "10s",
                    "max_result_window": 10000,
                },
            },
            "chats": {
                "pattern": "eliteew_chats-*",
                "template_name": "eliteew_chats_template",
                "rotation": "monthly",  # YYYY.MM
                "retention_days": 365,  # 1 year
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "refresh_interval": "30s",
                    "max_result_window": 20000,
                },
            },
            "users": {
                "pattern": "eliteew_users",
                "template_name": "eliteew_users_template",
                "rotation": "none",  # Single index
                "retention_days": None,  # Permanent
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "refresh_interval": "30s",
                    "max_result_window": 10000,
                },
            },
        }

        # Performance settings
        self.bulk_size = 1000
        self.bulk_timeout = 30
        self.cache_ttl = 300  # 5 minutes

    async def initialize(self) -> bool | None:
        """ð Initialize index manager"""
        try:
            logger.info("Initializing Elasticsearch Index Manager...")

            if not self.session:
                self.session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=60), headers={"Content-Type": "application/json"}
                )

            # Health check
            if not await self.health_check():
                logger.warning("Elasticsearch health check failed")
                return False

            # Setup analyzers
            await self._setup_analyzers()

            # Setup index templates
            await self._setup_index_templates()

            # Setup index aliases
            await self._setup_index_aliases()

            # Cleanup old indices
            await self._cleanup_old_indices()

            logger.info("Elasticsearch Index Manager initialized successfully")
            return True

        except Exception as e:
            logger.exception(f"Failed to initialize Index Manager: {e}")
            return False
        """ð§¹ Cleanup resources"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None
        return None

    async def health_check(self) -> bool:
        """ð Elasticsearch cluster health check"""
        try:
            if not self.session:
                return False
            assert self.session is not None
            async with self.session.get(f"{self.es_host}/_cluster/health") as response:
                if response.status == 200:
                    health = await response.json()
                    status = health.get("status", "red")

                    if status in ["green", "yellow"]:
                        return True
                    logger.warning(f"Elasticsearch cluster status: {status}")
                    return False
                logger.error(f"Elasticsearch health check failed: HTTP {response.status}")
                return False
        except Exception as e:
            logger.exception(f"Elasticsearch health check error: {e}")
            return False
            return False

    # =============================================================================
    # ð¨ ANALYZERS CONFIGURATION
    # =============================================================================

    async def _setup_analyzers(self) -> None:
        """ð¨ Setup custom analyzers Ð´Ð»Ñ multilingual support"""
        try:
            analyzer_settings = {
                "settings": {
                    "analysis": {
                        "analyzer": {
                            "eliteew_text_analyzer": {
                                "type": "custom",
                                "tokenizer": "standard",
                                "filter": [
                                    "lowercase",
                                    "stop_filter_en",
                                    "stop_filter_ru",
                                    "snowball_en",
                                    "snowball_ru",
                                ],
                            },
                            "eliteew_search_analyzer": {
                                "type": "custom",
                                "tokenizer": "keyword",
                                "filter": ["lowercase", "trim"],
                            },
                            "eliteew_code_analyzer": {
                                "type": "custom",
                                "tokenizer": "keyword",
                                "filter": ["lowercase"],
                            },
                            "eliteew_filename_analyzer": {
                                "type": "custom",
                                "tokenizer": "path_hierarchy",
                                "filter": ["lowercase"],
                            },
                        },
                        "filter": {
                            "stop_filter_en": {"type": "stop", "stopwords": "_english_"},
                            "stop_filter_ru": {"type": "stop", "stopwords": "_russian_"},
                            "snowball_en": {"type": "snowball", "language": "English"},
                            "snowball_ru": {"type": "snowball", "language": "Russian"},
                        },
                    }
                }
            }

            # Apply analyzer settings globally
            if not self.session:
                logger.error("Session not initialized")
                return
            async with self.session.put(
                f"{self.es_host}/_cluster/settings",
                data=json.dumps({"persistent": {"indices.analysis": analyzer_settings["settings"]["analysis"]}}),
            ) as response:
                if response.status in [200, 201]:
                    logger.info("Custom analyzers configured successfully")
                else:
                    logger.warning(f"Elasticsearch cluster status: {response.status}")

        except Exception as e:
            logger.warning(f"Error: {e}")

    # =============================================================================
    # ð INDEX TEMPLATES MANAGEMENT
    # =============================================================================

    async def _setup_index_templates(self) -> None:
        """ð Setup index templates Ð´Ð»Ñ consistency"""
        try:
            templates = {
                "eliteew_documents_template": self._get_documents_template(),
                "eliteew_logs_template": self._get_logs_template(),
                "eliteew_metrics_template": self._get_metrics_template(),
                "eliteew_chats_template": self._get_chats_template(),
                "eliteew_users_template": self._get_users_template(),
            }

            for template_name, template_config in templates.items():
                try:
                    if not self.session:
                        logger.error("Session not initialized")
                        continue
                    async with self.session.put(
                        f"{self.es_host}/_index_template/{template_name}", data=json.dumps(template_config)
                    ) as response:
                        if response.status in [200, 201]:
                            logger.info(f"Index template '{template_name}' created/updated")
                        else:
                            error_text = await response.text()
                            logger.warning(f"Failed to create template '{template_name}': {error_text}")

                except Exception as e:
                    logger.warning(f"Failed to setup template '{template_name}': {e}")

        except Exception as e:
            logger.exception(f"Error: {e}")

    def _get_documents_template(self) -> dict[str, Any]:
        """ð Documents index template"""
        return {
            "index_patterns": ["eliteew_documents-*"],
            "priority": 100,
            "template": {
                "settings": {
                    **cast("dict[str, Any]", cast("dict[str, Any]", self.index_configs["documents"])["settings"]),
                    "analysis": {
                        "analyzer": {
                            "default": {
                                "type": "custom",
                                "tokenizer": "standard",
                                "filter": ["lowercase", "stop", "snowball"],
                            }
                        }
                    },
                },
                "mappings": {
                    "properties": {
                        "title": {
                            "type": "text",
                            "analyzer": "eliteew_text_analyzer",
                            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
                        },
                        "content": {"type": "text", "analyzer": "eliteew_text_analyzer"},
                        "filename": {"type": "keyword", "analyzer": "eliteew_filename_analyzer"},
                        "file_path": {"type": "text", "analyzer": "eliteew_filename_analyzer"},
                        "file_hash": {"type": "keyword"},
                        "file_size": {"type": "long"},
                        "word_count": {"type": "integer"},
                        "created_at": {"type": "date"},
                        "updated_at": {"type": "date"},
                        "file_type": {"type": "keyword"},
                        "mime_type": {"type": "keyword"},
                        "user_id": {"type": "keyword"},
                        "document_id": {"type": "keyword"},
                        "tags": {"type": "keyword"},
                        "category": {"type": "keyword"},
                        "language": {"type": "keyword"},
                        "processed": {"type": "boolean"},
                        "ai_analyzed": {"type": "boolean"},
                        "ai_summary": {"type": "text"},
                        "ai_keywords": {"type": "keyword"},
                        "access_level": {"type": "keyword"},
                        "version": {"type": "integer"},
                        "parent_document": {"type": "keyword"},
                        "file_base64": {"type": "text", "index": False},
                        "metadata": {"type": "object", "enabled": False},
                    }
                },
            },
        }

    def _get_logs_template(self) -> dict[str, Any]:
        """ð Application logs template"""
        return {
            "index_patterns": ["eliteew_logs-*"],
            "priority": 100,
            "template": {
                "settings": cast("dict[str, Any]", cast("dict[str, Any]", self.index_configs["logs"])["settings"]),
                "mappings": {
                    "properties": {
                        "@timestamp": {"type": "date"},
                        "level": {"type": "keyword"},
                        "logger": {"type": "keyword"},
                        "message": {"type": "text", "analyzer": "eliteew_text_analyzer"},
                        "module": {"type": "keyword"},
                        "function": {"type": "keyword"},
                        "line_number": {"type": "integer"},
                        "user_id": {"type": "keyword"},
                        "session_id": {"type": "keyword"},
                        "request_id": {"type": "keyword"},
                        "endpoint": {"type": "keyword"},
                        "method": {"type": "keyword"},
                        "status_code": {"type": "integer"},
                        "response_time": {"type": "float"},
                        "ip_address": {"type": "ip"},
                        "user_agent": {"type": "text", "index": False},
                        "error_type": {"type": "keyword"},
                        "stack_trace": {"type": "text", "index": False},
                        "tags": {"type": "keyword"},
                        "environment": {"type": "keyword"},
                        "service": {"type": "keyword"},
                        "host": {"type": "keyword"},
                    }
                },
            },
        }

    def _get_metrics_template(self) -> dict[str, Any]:
        """ð System metrics template"""
        return {
            "index_patterns": ["eliteew_metrics-*"],
            "priority": 100,
            "template": {
                "settings": cast("dict[str, Any]", cast("dict[str, Any]", self.index_configs["metrics"])["settings"]),
                "mappings": {
                    "properties": {
                        "@timestamp": {"type": "date"},
                        "metric_name": {"type": "keyword"},
                        "metric_type": {"type": "keyword"},
                        "value": {"type": "double"},
                        "unit": {"type": "keyword"},
                        "service": {"type": "keyword"},
                        "host": {"type": "keyword"},
                        "environment": {"type": "keyword"},
                        "tags": {"type": "keyword"},
                        "labels": {
                            "type": "object",
                            "properties": {
                                "cpu": {"type": "keyword"},
                                "memory": {"type": "keyword"},
                                "disk": {"type": "keyword"},
                                "network": {"type": "keyword"},
                            },
                        },
                        "system_info": {
                            "type": "object",
                            "properties": {
                                "cpu_count": {"type": "integer"},
                                "memory_total": {"type": "long"},
                                "disk_total": {"type": "long"},
                            },
                        },
                    }
                },
            },
        }

    def _get_chats_template(self) -> dict[str, Any]:
        """ð¬ Chat messages template"""
        return {
            "index_patterns": ["eliteew_chats-*"],
            "priority": 100,
            "template": {
                "settings": cast("dict[str, Any]", cast("dict[str, Any]", self.index_configs["chats"])["settings"]),
                "mappings": {
                    "properties": {
                        "@timestamp": {"type": "date"},
                        "chat_id": {"type": "keyword"},
                        "message_id": {"type": "keyword"},
                        "user_id": {"type": "keyword"},
                        "username": {"type": "keyword"},
                        "message": {"type": "text", "analyzer": "eliteew_text_analyzer"},
                        "message_type": {"type": "keyword"},
                        "ai_model": {"type": "keyword"},
                        "ai_response": {"type": "text", "analyzer": "eliteew_text_analyzer"},
                        "conversation_context": {"type": "text"},
                        "attachments": {
                            "type": "object",
                            "properties": {
                                "filename": {"type": "keyword"},
                                "file_type": {"type": "keyword"},
                                "file_size": {"type": "long"},
                                "file_url": {"type": "keyword"},
                            },
                        },
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "response_time": {"type": "float"},
                                "tokens_used": {"type": "integer"},
                                "cost": {"type": "float"},
                            },
                        },
                        "sentiment": {"type": "keyword"},
                        "language": {"type": "keyword"},
                        "tags": {"type": "keyword"},
                        "is_favorite": {"type": "boolean"},
                    }
                },
            },
        }

    def _get_users_template(self) -> dict[str, Any]:
        """ð¥ Users search template"""
        return {
            "index_patterns": ["eliteew_users"],
            "priority": 100,
            "template": {
                "settings": cast("dict[str, Any]", cast("dict[str, Any]", self.index_configs["users"])["settings"]),
                "mappings": {
                    "properties": {
                        "user_id": {"type": "keyword"},
                        "username": {
                            "type": "text",
                            "analyzer": "eliteew_search_analyzer",
                            "fields": {"keyword": {"type": "keyword"}},
                        },
                        "email": {"type": "keyword"},
                        "full_name": {"type": "text", "analyzer": "eliteew_text_analyzer"},
                        "role": {"type": "keyword"},
                        "status": {"type": "keyword"},
                        "created_at": {"type": "date"},
                        "last_login": {"type": "date"},
                        "profile": {
                            "type": "object",
                            "properties": {
                                "bio": {"type": "text"},
                                "location": {"type": "keyword"},
                                "skills": {"type": "keyword"},
                                "interests": {"type": "keyword"},
                            },
                        },
                        "preferences": {"type": "object", "enabled": False},
                        "activity_score": {"type": "float"},
                        "tags": {"type": "keyword"},
                    }
                },
            },
        }

    # =============================================================================
    # ð INDEX ALIASES MANAGEMENT
    # =============================================================================

    async def _setup_index_aliases(self) -> None:
        """ð Setup index aliases Ð´Ð»Ñ zero-downtime updates"""
        if not self.session:
            logger.error("Session not initialized")
            return
        try:
            aliases = {
                "eliteew_documents_current": self._get_current_index_name("documents"),
                "eliteew_logs_current": self._get_current_index_name("logs"),
                "eliteew_metrics_current": self._get_current_index_name("metrics"),
                "eliteew_chats_current": self._get_current_index_name("chats"),
                "eliteew_users_current": "eliteew_users",
            }

            for alias, index_name in aliases.items():
                try:
                    # Check if index exists, create if needed
                    if not await self._index_exists(index_name):
                        await self._create_index(index_name)

                    # Create alias
                    await self._create_alias(index_name, alias)

                except Exception as e:
                    logger.warning(f"Failed to setup alias '{alias}': {e}")

        except Exception as e:
            logger.exception(f"Failed to setup index aliases: {e}")

    async def _create_alias(self, index_name: str, alias_name: str) -> bool | None:
        """🔗 Create index alias"""
        if not self.session:
            logger.error("Session not initialized")
            return False
        try:
            alias_config = {"actions": [{"add": {"index": index_name, "alias": alias_name}}]}

            async with self.session.post(f"{self.es_host}/_aliases", data=json.dumps(alias_config)) as response:
                if response.status in [200, 201]:
                    logger.info(f"Alias '{alias_name}' → '{index_name}' created")
                else:
                    error_text = await response.text()
                    logger.warning(f"Failed to create alias: {error_text}")

        except Exception as e:
            logger.warning(f"Failed to create alias '{alias_name}': {e}")

    async def _index_exists(self, index_name: str) -> bool:
        """â Check if index exists"""
        try:
            if not self.session:
                return False
            assert self.session is not None
            async with self.session.head(f"{self.es_host}/{index_name}") as response:
                return response.status == 200
        except Exception as exc:
            logger.debug("[STEP] elasticsearch_index_exists_skip index=%s err=%s", index_name, exc)
            return False

    async def _create_index(self, index_name: str) -> None:
        if not self.session:
            logger.error("Session not initialized")
            return
        """ð Create index"""
        try:
            async with self.session.put(f"{self.es_host}/{index_name}") as response:
                if response.status in [200, 201]:
                    logger.info(f"Index '{index_name}' created")
                else:
                    error_text = await response.text()
                    logger.warning(f"Failed to create index {index_name}: {error_text}")

        except Exception as e:
            logger.warning(f"Error: {e}")

    def _get_current_index_name(self, index_type: str) -> str:
        """ð Get current index name based Ð½Ð° rotation policy"""
        config: dict[str, Any] = cast("dict[str, Any]", self.index_configs.get(index_type, {}))
        rotation: str = config.get("rotation", "none")

        now = utc_now_naive()

        if rotation == "daily":
            suffix = now.strftime("%Y.%m.%d")
        elif rotation == "monthly":
            suffix = now.strftime("%Y.%m")
        elif rotation == "yearly":
            suffix = now.strftime("%Y")
        else:
            # No rotation
            pattern: str = str(config.get("pattern", ""))
            return pattern.replace("-*", "").replace("*", "")

        base_name = config.get("pattern", "").replace("-*", "").replace("*", "")
        return f"{base_name}-{suffix}"

    # =============================================================================
    # ðï¸ INDEX LIFECYCLE MANAGEMENT
    # =============================================================================

    async def _cleanup_old_indices(self) -> None:
        if not self.session:
            logger.error("Session not initialized")
            return
        """ðï¸ Cleanup old indices based Ð½Ð° retention policies"""
        try:
            for config in self.index_configs.values():
                retention_days = config.get("retention_days")

                if retention_days is None:
                    continue  # No cleanup Ð´Ð»Ñ permanent indices

                pattern = config.get("pattern", "")
                if not pattern.endswith("*"):
                    continue  # No cleanup Ð´Ð»Ñ non-rotated indices

                await self._cleanup_indices_by_pattern(pattern, retention_days)

        except Exception as e:
            logger.exception(f"Error: {e}")

    async def _cleanup_indices_by_pattern(self, pattern: str, retention_days: int) -> bool | None:
        if not self.session:
            logger.error("Session not initialized")
            return False
        """ðï¸ Cleanup indices matching pattern older than retention"""
        try:
            cutoff_date = utc_now_naive() - timedelta(days=retention_days)

            # Get all indices matching pattern
            async with self.session.get(f"{self.es_host}/_cat/indices/{pattern}?format=json") as response:
                if response.status == 200:
                    indices = await response.json()

                    for index_info in indices:
                        index_name = index_info.get("index", "")
                        creation_date = index_info.get("creation.date.string")

                        if creation_date:
                            try:
                                index_date = datetime.strptime(creation_date, "%Y-%m-%dT%H:%M:%S.%fZ")

                                if index_date < cutoff_date:
                                    await self._delete_index(index_name)
                                    logger.info(f"Deleted old index: {index_name}")

                            except ValueError:
                                # Try parsing index name Ð´Ð»Ñ date
                                await self._cleanup_by_index_name(index_name, cutoff_date)

        except Exception as e:
            logger.warning(f"Failed to cleanup indices for pattern '{pattern}': {e}")

    async def _cleanup_by_index_name(self, index_name: str, cutoff_date: datetime) -> None:
        """ðï¸ Extract date from index name Ð¸ cleanup if old"""
        try:
            # Extract date from index name (e.g., eliteew_logs-2024.01.15)
            if "-" in index_name:
                date_part = index_name.split("-")[-1]

                if "." in date_part:
                    parts = date_part.split(".")

                    if len(parts) == 3:  # YYYY.MM.DD
                        index_date = datetime.strptime(date_part, "%Y.%m.%d")
                    elif len(parts) == 2:  # YYYY.MM
                        index_date = datetime.strptime(date_part + ".01", "%Y.%m.%d")
                    else:
                        return

                    if index_date < cutoff_date:
                        await self._delete_index(index_name)
                        logger.info(f"Deleted old index by name: {index_name}")

        except Exception as e:
            logger.warning(f"Error: {e}")

    async def _delete_index(self, index_name: str):
        """ðï¸ Delete index"""
        try:
            if not self.session:
                return False
            assert self.session is not None
            async with self.session.delete(f"{self.es_host}/{index_name}") as response:
                if response.status in [200, 404]:  # 404 = already deleted
                    return True
                error_text = await response.text()
                logger.warning(f"Failed to create index {index_name}: {error_text}")
                return False

        except Exception as e:
            logger.warning(f"Error: {e}")
            return False

        if not self.session:
            return {"indexed": 0, "errors": ["Session not initialized"]}
        return None

    # =============================================================================
    # ð BULK OPERATIONS
    # =============================================================================

    async def bulk_index_documents(
        self, documents: list[dict[str, Any]], index_name: str | None = None, doc_type: str = "_doc"
    ) -> dict[str, Any]:
        """ð¦ Bulk index documents Ð´Ð»Ñ performance"""
        try:
            if not documents:
                return {"indexed": 0, "errors": []}

            index_name = index_name or "eliteew_documents_current"

            # Prepare bulk request
            bulk_body = []
            for doc in documents:
                # Index operation
                bulk_body.append(json.dumps({"index": {"_index": index_name, "_id": doc.get("id", str(uuid.uuid4()))}}))

                # Document data
                bulk_body.append(json.dumps(doc))

            bulk_data = "\n".join(bulk_body) + "\n"

            # Execute bulk request
            if not self.session:
                return {"indexed": 0, "errors": ["Session not initialized"]}
            assert self.session is not None
            async with self.session.post(
                f"{self.es_host}/_bulk", data=bulk_data, headers={"Content-Type": "application/x-ndjson"}
            ) as response:
                if response.status in [200, 201]:
                    result = await response.json()

                    indexed = 0
                    errors = []

                    for item in result.get("items", []):
                        if "index" in item:
                            if item["index"].get("status") in [200, 201]:
                                indexed += 1
                            else:
                                errors.append({"id": item["index"].get("_id"), "error": item["index"].get("error", {})})

                    logger.info(f"Bulk indexed {indexed}/{len(documents)} documents")

                    return {
                        "indexed": indexed,
                        "errors": errors,
                        "total": len(documents),
                        "took": result.get("took", 0),
                    }
                error_text = await response.text()
                logger.error(f"Request failed: {error_text}")
                return {"indexed": 0, "errors": [error_text]}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"indexed": 0, "errors": [str(e)]}

    # =============================================================================
    # ð ADVANCED SEARCH OPERATIONS
    # =============================================================================

    async def advanced_search(
        self,
        query: str,
        indices: list[str] | None = None,
        filters: dict[str, Any] | None = None,
        sort: list[dict[str, str]] | None = None,
        size: int = 10,
        from_: int = 0,
        highlight: bool = True,
    ) -> dict[str, Any]:
        if not self.session:
            return {"success": False, "error": "Session not initialized", "results": []}
        """ð Advanced search across multiple indices"""
        try:
            indices = indices or ["eliteew_*_current"]
            index_pattern = ",".join(indices)

            # Build query
            search_query = {
                "query": {
                    "bool": {
                        "must": {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "content^2", "message^2", "username", "filename"],
                                "type": "best_fields",
                                "fuzziness": "AUTO",
                            }
                        }
                    }
                },
                "size": size,
                "from": from_,
            }

            # Add filters
            if filters:
                query_obj: dict[str, Any] = cast("dict[str, Any]", search_query["query"])
                bool_obj: dict[str, Any] = cast("dict[str, Any]", query_obj["bool"])
                bool_query_dict: dict[str, Any] = dict(bool_obj)
                bool_query_dict["filter"] = []
                for field, value in filters.items():
                    if isinstance(value, list):
                        bool_query_dict["filter"].append({"terms": {field: value}})
                    else:
                        bool_query_dict["filter"].append({"term": {field: value}})
                query_obj["bool"] = bool_query_dict
                search_query["query"] = query_obj

            # Add sorting
            if sort:
                search_query["sort"] = sort
            else:
                search_query["sort"] = [{"_score": {"order": "desc"}}]

            # Add highlighting
            if highlight:
                search_query["highlight"] = {
                    "fields": {
                        "title": {"fragment_size": 100, "number_of_fragments": 1},
                        "content": {"fragment_size": 150, "number_of_fragments": 2},
                        "message": {"fragment_size": 150, "number_of_fragments": 1},
                    }
                }

            # Execute search
            async with self.session.post(
                f"{self.es_host}/{index_pattern}/_search", data=json.dumps(search_query)
            ) as response:
                if response.status == 200:
                    result = await response.json()

                    hits = result.get("hits", {})
                    total = hits.get("total", {}).get("value", 0)
                    documents = []

                    for hit in hits.get("hits", []):
                        doc = {
                            "id": hit["_id"],
                            "index": hit["_index"],
                            "score": hit["_score"],
                            "source": hit["_source"],
                        }

                        if highlight and "highlight" in hit:
                            doc["highlight"] = hit["highlight"]

                        documents.append(doc)

                    return {
                        "total": total,
                        "documents": documents,
                        "took": result.get("took", 0),
                        "max_score": hits.get("max_score", 0),
                    }
                error_text = await response.text()
                logger.error(f"Request failed: {error_text}")
                return {"total": 0, "documents": [], "error": error_text}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"total": 0, "documents": [], "error": str(e)}

    # =============================================================================
    # ð MONITORING AND STATS
    # =============================================================================

    async def get_cluster_stats(self) -> dict[str, Any]:
        if not self.session:
            return {"error": "Session not initialized"}
        """ð Get comprehensive cluster statistics"""
        try:
            stats = {}

            # Cluster health
            async with self.session.get(f"{self.es_host}/_cluster/health") as response:
                if response.status == 200:
                    stats["health"] = await response.json()

            # Cluster stats
            async with self.session.get(f"{self.es_host}/_cluster/stats") as response:
                if response.status == 200:
                    cluster_stats = await response.json()
                    stats["cluster"] = {
                        "nodes": cluster_stats.get("nodes", {}),
                        "indices": cluster_stats.get("indices", {}),
                    }

            # Index statistics
            async with self.session.get(f"{self.es_host}/_cat/indices/eliteew_*?format=json") as response:
                if response.status == 200:
                    indices = await response.json()
                    stats["indices"] = indices

            # Node information
            async with self.session.get(f"{self.es_host}/_nodes/stats") as response:
                if response.status == 200:
                    node_stats = await response.json()
                    stats["nodes"] = node_stats.get("nodes", {})

            return {"status": "healthy", "timestamp": utc_now_iso(), "stats": stats}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"status": "error", "error": str(e), "timestamp": utc_now_iso()}

    async def get_index_health(self, index_pattern: str = "eliteew_*") -> dict[str, Any]:
        """ð Get health status of indices"""
        try:
            health_info = {}

            # Get index details
            if not self.session:
                return {"status": "error", "error": "Session not initialized"}
            assert self.session is not None
            async with self.session.get(
                f"{self.es_host}/_cat/indices/{index_pattern}?format=json&h=index,status,health,docs.count,store.size"
            ) as response:
                if response.status == 200:
                    indices = await response.json()

                    for index in indices:
                        index_name = index.get("index", "")
                        health_info[index_name] = {
                            "status": index.get("status", "unknown"),
                            "health": index.get("health", "unknown"),
                            "docs_count": int(index.get("docs.count", 0)),
                            "store_size": index.get("store.size", "0b"),
                        }

            return {"status": "success", "indices": health_info, "total_indices": len(health_info)}

        except Exception as e:
            logger.exception(f"Error: {e}")
            return {"status": "error", "error": str(e)}

    async def cleanup(self) -> None:
        """Cleanup resources"""
        if self.session:
            await self.session.close()
            self.session = None


# =============================================================================
# ð GLOBAL SERVICE INSTANCES
# =============================================================================

# Lazy initialization
_elasticsearch_index_manager: ElasticsearchIndexManager | None = None


async def get_elasticsearch_index_manager() -> ElasticsearchIndexManager:
    """ð¯ Get global Elasticsearch Index Manager instance"""
    global _elasticsearch_index_manager

    if _elasticsearch_index_manager is None:
        try:
            # Import services if available
            redis_service = None

            if CONFIG_AVAILABLE:
                try:
                    from ..services.redis_service import get_redis_service

                    redis_service = await get_redis_service()
                except ImportError:
                    pass

            _elasticsearch_index_manager = ElasticsearchIndexManager(redis_service=redis_service)
            await _elasticsearch_index_manager.initialize()

        except Exception as e:
            logger.exception(f"Error: {e}")
            # Return manager anyway for graceful degradation
            _elasticsearch_index_manager = ElasticsearchIndexManager()

    return _elasticsearch_index_manager


async def cleanup_elasticsearch_services() -> None:
    """ð§¹ Cleanup global services"""
    global _elasticsearch_index_manager
    if _elasticsearch_index_manager:
        await _elasticsearch_index_manager.cleanup()
        _elasticsearch_index_manager = None


# Global service instances
document_service = ElasticsearchDocumentService()
index_manager = get_elasticsearch_index_manager
