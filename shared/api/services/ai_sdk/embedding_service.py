#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AI SDK embeddings/RAG service: generates embeddings via Llama provider, caches vectors,
# and exposes semantic search helpers for in-memory documents.
# Invariants:
# - Embedding backend errors must raise a typed service-unavailable exception (no synthetic hash/zero vectors).
# - Cache keys include model + input hash to avoid cross-model embedding reuse.
# Related:
# - api/routers/ai_sdk/embeddings.py
# - api/services/ai_sdk/llama_provider_service.py
# ---
"""AI SDK embedding and in-memory semantic search service."""

from __future__ import annotations

import hashlib
import logging
import math
from collections.abc import AsyncIterator
from typing import Any

from api.services.ai_sdk.llama_provider_service import LlamaProviderService
from api.services.ai_sdk.simple_cache_service import simple_cache_service as ai_sdk_cache_service
from pydantic import BaseModel  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)


class EmbeddingUnavailableError(RuntimeError):
    """Raised when the embedding backend is unavailable for a request."""

    def __init__(self, model: str, reason: str, *, text_length: int):
        self.model = model
        self.reason = reason
        self.text_length = text_length
        super().__init__(f"Embedding backend unavailable: reason={reason} model={model}")


class EmbeddingDocument(BaseModel):
    """Document for embedding"""

    id: str
    content: str
    metadata: dict[str, Any] | None = None
    embedding: list[float] | None = None


class SearchResult(BaseModel):
    """Search result with similarity score"""

    document: EmbeddingDocument
    score: float
    rank: int


class RAGContext(BaseModel):
    """RAG context for generation"""

    query: str
    relevant_documents: list[SearchResult]
    context_text: str
    total_tokens: int


class EmbeddingService:
    """Service for embeddings and RAG functionality"""

    def __init__(self) -> None:
        self.llama_service = LlamaProviderService()
        self.embedding_model = "nomic-embed-text"
        self.documents: dict[str, EmbeddingDocument] = {}

    async def embed_text(self, text: str, model: str | None = None) -> list[float]:
        """
        Generate embedding for text with caching
        Uses proper Llama embedding API
        Источник: docs/ai/AI_SDK_Core/file/embed.md
        """
        input_text = str(text or "").strip()
        if not input_text:
            msg = "Text for embedding must be non-empty"
            raise ValueError(msg)
        model_name = model or self.embedding_model

        # Check cache first
        digest = hashlib.sha256((model_name + "\0" + input_text).encode()).hexdigest()
        cache_key = f"embed:{model_name}:{digest}"
        cached = await ai_sdk_cache_service.cache_manager.get("embeddings", "generate", cache_key)
        if cached:
            return cached

        try:
            # Use proper Llama embedding API
            embedding = await self.llama_service.embed(text=input_text, model=model_name)
            if not self._is_valid_embedding_vector(embedding):
                msg = "Embedding backend returned empty vector"
                raise RuntimeError(msg)

            # Cache the result
            await ai_sdk_cache_service.cache_manager.set(
                "embeddings", "generate", cache_key, embedding, custom_ttl=3600
            )

            return embedding

        except (ValueError, RuntimeError, ConnectionError, TimeoutError) as exc:
            logger.warning(
                "[STEP] ai_sdk.embed_text_unavailable model=%s text_chars=%s error_type=%s error=%s",
                model_name,
                len(input_text),
                type(exc).__name__,
                exc,
            )
            raise EmbeddingUnavailableError(
                model=model_name,
                reason="embedding_backend_unavailable",
                text_length=len(input_text),
            ) from exc

    async def _embed_with_cache(self, text: str, model_name: str) -> list[float]:
        """Generate embedding with caching"""
        cached_embedding = await ai_sdk_cache_service.cache_manager.get_cached_embedding(model_name, text)
        if cached_embedding:
            return cached_embedding

        # Generate embedding
        embedding = await self.llama_service.embed(text=text, model=model_name)

        # Cache the result
        await ai_sdk_cache_service.cache_manager.cache_embedding(model_name, text, embedding)

        return embedding

    @staticmethod
    def _is_valid_embedding_vector(embedding: Any) -> bool:
        return (
            isinstance(embedding, list)
            and bool(embedding)
            and all(isinstance(value, int | float) and math.isfinite(float(value)) for value in embedding)
        )

    async def embed_many(self, texts: list[str], model: str | None = None) -> list[list[float]]:
        """
        Generate embeddings for multiple texts with caching
        Batch processing for efficiency
        """
        model_name = model or self.embedding_model
        embeddings = []

        # Check cache for each text first
        uncached_texts = []
        uncached_indices = []

        for i, text in enumerate(texts):
            cached_embedding = await ai_sdk_cache_service.cache_manager.get_cached_embedding(model_name, text)
            if cached_embedding:
                embeddings.append(cached_embedding)
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)
                embeddings.append(None)  # Placeholder

        # Generate embeddings for uncached texts
        if uncached_texts:
            batch_size = 10  # Process in batches to avoid overwhelming Llama

            for i in range(0, len(uncached_texts), batch_size):
                batch = uncached_texts[i : i + batch_size]
                batch_embeddings = await self.llama_service.embed_many(batch, model=model_name)
                if len(batch_embeddings) != len(batch):
                    msg = "Embedding backend returned incomplete batch"
                    raise EmbeddingUnavailableError(
                        model=model_name,
                        reason=msg,
                        text_length=sum(len(text) for text in batch),
                    )

                # Cache and place results
                for j, embedding in enumerate(batch_embeddings):
                    if not self._is_valid_embedding_vector(embedding):
                        msg = "Embedding backend returned invalid vector"
                        raise EmbeddingUnavailableError(
                            model=model_name,
                            reason=msg,
                            text_length=len(batch[j]),
                        )
                    original_index = uncached_indices[i + j]
                    embeddings[original_index] = embedding
                    await ai_sdk_cache_service.cache_manager.cache_embedding(model_name, batch[j], embedding)

        return embeddings

    async def add_document(
        self, doc_id: str, content: str, metadata: dict[str, Any] | None = None
    ) -> EmbeddingDocument:
        """
        Add document and generate its embedding
        """
        embedding = await self.embed_text(content)

        document = EmbeddingDocument(id=doc_id, content=content, metadata=metadata or {}, embedding=embedding)

        self.documents[doc_id] = document
        return document

    async def add_documents_batch(self, documents: list[dict[str, Any]]) -> list[EmbeddingDocument]:
        """
        Add multiple documents in batch
        """
        # Extract texts for batch embedding
        texts = [doc["content"] for doc in documents]
        embeddings = await self.embed_many(texts)

        # Create document objects
        doc_objects = []
        for i, doc in enumerate(documents):
            document = EmbeddingDocument(
                id=doc["id"], content=doc["content"], metadata=doc.get("metadata", {}), embedding=embeddings[i]
            )
            self.documents[doc["id"]] = document
            doc_objects.append(document)

        return doc_objects

    def cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """Calculate cosine similarity between two vectors (stdlib — no numpy)."""
        if len(vec1) != len(vec2) or not vec1:
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec1, vec2, strict=True))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)

    async def search_similar(
        self, query: str, limit: int = 5, threshold: float = 0.0, metadata_filter: dict[str, Any] | None = None
    ) -> list[SearchResult]:
        """
        Search for similar documents using semantic similarity with caching
        """
        # Cache key is created in get_cached_similarity_search call below

        # Check cache first
        cached_results = await ai_sdk_cache_service.cache_manager.get_cached_similarity_search(
            collection="embeddings", query=f"{query}_{limit}_{threshold}_{metadata_filter!s}"
        )
        if cached_results:
            # Convert cached results back to SearchResult objects
            results = []
            for item in cached_results:
                doc = self.documents.get(item["id"])
                if doc:
                    results.append(SearchResult(document=doc, score=item["score"], rank=item["rank"]))
            return results

        # Generate query embedding
        query_embedding = await self.embed_text(query)

        # Calculate similarities
        similarities = []
        for doc in self.documents.values():
            if not doc.embedding:
                continue

            # Apply metadata filter if provided
            if metadata_filter and not self._matches_metadata_filter(doc.metadata or {}, metadata_filter):
                continue

            similarity = self.cosine_similarity(query_embedding, doc.embedding)
            if similarity >= threshold:
                similarities.append((doc, similarity))

        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)

        # Convert to SearchResult objects
        results = []
        cached_results_data = []
        for rank, (doc, score) in enumerate(similarities[:limit], 1):
            result = SearchResult(document=doc, score=score, rank=rank)
            results.append(result)

            # Prepare data for caching
            cached_results_data.append({"id": doc.id, "score": score, "rank": rank})

        # Cache the search results
        if cached_results_data:
            await ai_sdk_cache_service.cache_manager.cache_similarity_search(
                collection="embeddings",
                query=f"{query}_{limit}_{threshold}_{metadata_filter!s}",
                results=cached_results_data,
            )

        return results

    def _matches_metadata_filter(self, doc_metadata: dict[str, Any], filter_criteria: dict[str, Any]) -> bool:
        """Check if document metadata matches filter criteria"""
        for key, value in filter_criteria.items():
            if key not in doc_metadata or doc_metadata[key] != value:
                return False
        return True

    async def generate_rag_response(
        self,
        query: str,
        system_prompt: str | None = None,
        model: str = "llama3.3",
        max_context_length: int = 4000,
        similarity_threshold: float = 0.1,
    ) -> dict[str, Any]:
        """
        Generate RAG response with retrieved context
        Документация: docs/ai/AI_SDK_Core/Middleware.md#retrieval-augmented-generation-rag
        """
        # Search for relevant documents
        search_results = await self.search_similar(query=query, limit=5, threshold=similarity_threshold)

        if not search_results:
            # No relevant context found, generate without RAG
            response = await self.llama_service.generate_text(model=model, prompt=query, system=system_prompt)

            return {"response": response, "rag_context": None, "used_rag": False}

        # Build context from search results
        context_parts = []
        total_tokens: float = 0.0

        for result in search_results:
            # Simple token estimation (rough approximation)
            content_tokens = len(result.document.content.split()) * 1.3  # Rough token estimation

            if total_tokens + content_tokens > max_context_length:
                break

            context_parts.append(f"Document: {result.document.content}")
            total_tokens += content_tokens

        context_text = "\n\n".join(context_parts)

        # Create RAG prompt
        rag_prompt = f"""
Based on the following context, please answer the question.

Context:
{context_text}

Question: {query}

Answer:"""

        # Generate response with context
        response = await self.llama_service.generate_text(model=model, prompt=rag_prompt, system=system_prompt)

        rag_context = RAGContext(
            query=query, relevant_documents=search_results, context_text=context_text, total_tokens=int(total_tokens)
        )

        return {"response": response, "rag_context": rag_context.dict(), "used_rag": True}

    async def stream_rag_response(
        self, query: str, system_prompt: str | None = None, model: str = "llama3.3"
    ) -> AsyncIterator[str]:
        """
        Stream RAG response generation
        """
        # Get RAG context first
        search_results = await self.search_similar(query=query, limit=3)

        if search_results:
            # Build context
            context_text = "\n\n".join([f"Document: {result.document.content}" for result in search_results])

            rag_prompt = f"""
Based on the following context, please answer the question.

Context:
{context_text}

Question: {query}

Answer:"""
        else:
            rag_prompt = query

        # Stream the response
        async for delta in self.llama_service.stream_text(model=model, prompt=rag_prompt, system=system_prompt):
            yield delta

    def get_document(self, doc_id: str) -> EmbeddingDocument | None:
        """Get document by ID"""
        return self.documents.get(doc_id)

    def list_documents(self) -> list[EmbeddingDocument]:
        """List all documents"""
        return list(self.documents.values())

    def delete_document(self, doc_id: str) -> bool:
        """Delete document"""
        if doc_id in self.documents:
            del self.documents[doc_id]
            return True
        return False

    def clear_documents(self) -> None:
        """Clear all documents"""
        self.documents.clear()

    def get_stats(self) -> dict[str, Any]:
        """Get service statistics"""
        first_doc = next(iter(self.documents.values()), None)
        embedding_dimension = len(first_doc.embedding) if first_doc and first_doc.embedding else 0

        return {
            "total_documents": len(self.documents),
            "embedding_model": self.embedding_model,
            "embedding_dimension": embedding_dimension,
        }


# Singleton instance
embedding_service = EmbeddingService()
