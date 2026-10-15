#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenWebUI HTTP client for UGS RAG / document QA / optional web-search chat.
# Invariants:
# - Default base_url matches ServiceConfig internal URL (port 8080), never host-mapped 31001.
# - Callers must pass the same base_url used for health probes (DB/seed/config).
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - documentation/product/UGS-FLOW-AND-CONFIG.md
# ---
"""
OpenWebUI Provider Integration
Phase 2 - Provider Integration
Supports RAG chat with document retrieval and web search
"""

import logging
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt, llm_wall_clock_system_section

logger = logging.getLogger(__name__)

# Align with unified_config ServiceConfig(openwebui).internal_url (container port 8080).
_OPENWEBUI_DEFAULT_BASE_URL = "http://openwebui-cuda128:8080"


class OpenWebUIProvider:
    """OpenWebUI RAG chat provider integration"""

    def __init__(self, base_url: str | None = None):
        resolved = (base_url or "").strip().rstrip("/")
        if not resolved:
            catalog = getattr(unified_settings, "openwebui", None)
            catalog_url = str(getattr(catalog, "internal_url", "") or "").strip().rstrip("/")
            resolved = catalog_url or _OPENWEBUI_DEFAULT_BASE_URL
        self.base_url = resolved
        self.session: aiohttp.ClientSession | None = None

    async def initialize(self) -> None:
        """Initialize the provider"""
        self.session = aiohttp.ClientSession()
        logger.info("OpenWebUIProvider initialized with base_url: %s", self.base_url)

    async def close(self) -> None:
        """Close connections"""
        if self.session:
            await self.session.close()

    async def health_check(self) -> bool:
        """Check if OpenWebUI is healthy"""
        if not self.session:
            return False

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with self.session.get(f"{self.base_url}/api/v1/health", timeout=timeout) as response:
                return response.status == 200
        except Exception as e:
            logger.warning("OpenWebUI health check failed: %s", e)
            return False

    async def chat_with_rag(
        self,
        messages: list[dict[str, str]],
        model: str = unified_settings.default_ai_model,
        use_rag: bool = True,
        use_web_search: bool = False,
        collection_names: list[str] | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Chat with RAG capabilities"""
        if not self.session:
            msg = "OpenWebUIProvider not initialized"
            raise RuntimeError(msg)

        endpoint = f"{self.base_url}/api/chat/completions"

        # Build payload with RAG options
        payload = {"model": model, "messages": messages, "stream": False, **kwargs}

        # Add RAG-specific parameters
        if use_rag:
            payload["use_rag"] = True
            if collection_names:
                payload["collection_names"] = collection_names

        if use_web_search:
            payload["use_web_search"] = True

        timeout = aiohttp.ClientTimeout(total=120)
        async with self.session.post(endpoint, json=payload, timeout=timeout) as response:
            if response.status != 200:
                error_text = await response.text()
                msg = f"OpenWebUI API error: {response.status} - {error_text}"
                raise Exception(msg)

            result = await response.json()

            return {
                "content": result["choices"][0]["message"]["content"],
                "model": result.get("model", model),
                "usage": result.get("usage", {}),
                "sources": result.get("sources", []),  # RAG sources
                "finish_reason": result["choices"][0].get("finish_reason"),
            }

    async def rag_query(
        self,
        query: str,
        collection_names: list[str] | None = None,
        model: str = unified_settings.default_ai_model,
        system_prompt: str = "",
        **kwargs,
    ) -> dict[str, Any]:
        """Query with RAG retrieval"""
        messages = []
        sys_content = (
            append_llm_wall_clock_to_system_prompt(system_prompt) if system_prompt else llm_wall_clock_system_section()
        )
        messages.append({"role": "system", "content": sys_content})
        messages.append({"role": "user", "content": query})

        return await self.chat_with_rag(
            messages=messages,
            model=model,
            use_rag=True,
            collection_names=collection_names,
            **kwargs,
        )

    async def web_search_chat(
        self,
        query: str,
        model: str = unified_settings.default_ai_model,
        system_prompt: str = "",
        **kwargs,
    ) -> dict[str, Any]:
        """Chat with web search capabilities"""
        messages = []
        sys_content = (
            append_llm_wall_clock_to_system_prompt(system_prompt) if system_prompt else llm_wall_clock_system_section()
        )
        messages.append({"role": "system", "content": sys_content})
        messages.append({"role": "user", "content": query})

        return await self.chat_with_rag(messages=messages, model=model, use_rag=False, use_web_search=True, **kwargs)

    async def document_qa(
        self,
        question: str,
        document_ids: list[str] | None = None,
        model: str = unified_settings.default_ai_model,
        **kwargs,
    ) -> dict[str, Any]:
        """Question answering over documents"""
        system_prompt = append_llm_wall_clock_to_system_prompt(
            "You are a helpful assistant that answers questions based on the provided documents. "
            "If the answer is not in the documents, say so clearly."
        )

        return await self.rag_query(
            query=question,
            collection_names=document_ids,
            model=model,
            system_prompt=system_prompt,
            **kwargs,
        )

    async def create_collection(self, name: str, description: str = "", **kwargs) -> dict[str, Any]:
        """Create a new document collection"""
        if not self.session:
            msg = "OpenWebUIProvider not initialized"
            raise RuntimeError(msg)

        endpoint = f"{self.base_url}/api/v1/collections"
        payload = {"name": name, "description": description, **kwargs}

        timeout = aiohttp.ClientTimeout(total=30)
        async with self.session.post(endpoint, json=payload, timeout=timeout) as response:
            if response.status not in [200, 201]:
                error_text = await response.text()
                msg = f"OpenWebUI collection creation error: {response.status} - {error_text}"
                raise Exception(msg)

            result = await response.json()
            return dict(result) if isinstance(result, dict) else {}

    async def add_documents(self, collection_name: str, documents: list[dict[str, Any]], **kwargs) -> dict[str, Any]:
        """Add documents to a collection"""
        if not self.session:
            msg = "OpenWebUIProvider not initialized"
            raise RuntimeError(msg)

        endpoint = f"{self.base_url}/api/v1/collections/{collection_name}/documents"
        payload = {"documents": documents, **kwargs}

        timeout = aiohttp.ClientTimeout(total=60)
        async with self.session.post(endpoint, json=payload, timeout=timeout) as response:
            if response.status not in [200, 201]:
                error_text = await response.text()
                msg = f"OpenWebUI document addition error: {response.status} - {error_text}"
                raise Exception(msg)

            result = await response.json()
            return dict(result) if isinstance(result, dict) else {}
