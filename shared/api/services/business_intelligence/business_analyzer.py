#!/usr/bin/env python3
"""
💼 BUSINESS ANALYZER - Core Business Logic
Основная логика бизнес-анализа с интеграцией всех сервисов

Features:
✅ Multi-document analysis
✅ Multiple analysis types support
✅ Intelligent content aggregation
✅ Quality scoring
✅ Progress tracking
"""

import base64
import json
import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from api.core.unified_config import unified_settings

from .elasticsearch_service import ElasticsearchService
from .llama_ai_service import LlamaAIService
from .tika_service import TikaService

logger = logging.getLogger(__name__)


class BusinessAnalyzer:
    """Core business analysis engine"""

    def __init__(
        self,
        elasticsearch_service: ElasticsearchService,
        tika_service: TikaService,
        llama_service: LlamaAIService,
    ):
        """
        Initialize Business Analyzer

        Args:
            elasticsearch_service: Elasticsearch service instance
            tika_service: Tika service instance
            llama_service: Llama AI service instance
        """
        self.es = elasticsearch_service
        self.tika = tika_service
        self.llama = llama_service

        # Analysis configurations
        self.ANALYSIS_CONFIGS = {
            "executive_summary": {"priority": 1, "estimated_time": 120, "complexity": "low"},
            "detailed_analysis": {"priority": 2, "estimated_time": 300, "complexity": "high"},
            "swot_analysis": {"priority": 3, "estimated_time": 200, "complexity": "medium"},
            "competitive_analysis": {"priority": 4, "estimated_time": 250, "complexity": "high"},
            "financial_projection": {"priority": 5, "estimated_time": 280, "complexity": "high"},
            "marketing_strategy": {"priority": 6, "estimated_time": 240, "complexity": "medium"},
            "action_plan": {"priority": 7, "estimated_time": 180, "complexity": "medium"},
            "risk_assessment": {"priority": 8, "estimated_time": 220, "complexity": "medium"},
        }

    async def analyze_business(
        self,
        session_id: str,
        user_id: str,
        documents: list[dict[str, Any]],
        analysis_types: list[str],
        settings: dict[str, Any],
        progress_callback: Callable[[dict[str, Any]], Any] | None = None,
    ) -> dict[str, Any]:
        """
        Perform comprehensive business analysis

        Args:
            session_id: Session ID
            user_id: User ID
            documents: List of documents to analyze
            analysis_types: Types of analyses to perform
            settings: Analysis settings
            progress_callback: Callback for progress updates

        Returns:
            Analysis results
        """
        start_time = datetime.now(UTC)

        try:
            # Step 1: Process and index documents
            if progress_callback:
                await progress_callback(
                    {
                        "stage": "document_processing",
                        "progress": 10,
                        "message": "Обработка документов...",
                    }
                )

            processed_docs = await self._process_documents(session_id, user_id, documents)

            # Step 2: Aggregate content
            if progress_callback:
                await progress_callback(
                    {
                        "stage": "content_aggregation",
                        "progress": 20,
                        "message": "Агрегация контента...",
                    }
                )

            aggregated_content = self._aggregate_content(processed_docs)

            # Step 3: Perform analyses
            total_analyses = len(analysis_types)
            analyses_results = []

            for idx, analysis_type in enumerate(analysis_types):
                progress = 20 + int((idx / total_analyses) * 60)

                if progress_callback:
                    await progress_callback(
                        {
                            "stage": f"analysis_{analysis_type}",
                            "progress": progress,
                            "message": f"Анализ: {analysis_type}...",
                        }
                    )

                analysis_result = await self._perform_single_analysis(
                    session_id=session_id,
                    user_id=user_id,
                    analysis_type=analysis_type,
                    content=aggregated_content,
                    context=settings.get("custom_instructions", ""),
                    settings=settings,
                )

                analyses_results.append(analysis_result)

            # Step 4: Generate summary
            if progress_callback:
                await progress_callback(
                    {
                        "stage": "summary_generation",
                        "progress": 85,
                        "message": "Генерация сводки...",
                    }
                )

            summary = await self._generate_summary(analyses_results)

            # Step 5: Calculate metrics
            generation_time = (datetime.now(UTC) - start_time).total_seconds()
            total_tokens = sum(r.get("metrics", {}).get("tokens_used", 0) for r in analyses_results)

            # Final progress
            if progress_callback:
                await progress_callback({"stage": "completed", "progress": 100, "message": "Анализ завершен!"})

            return {
                "session_id": session_id,
                "status": "completed",
                "analyses": analyses_results,
                "summary": summary,
                "documents_processed": len(processed_docs),
                "metrics": {
                    "total_tokens": total_tokens,
                    "generation_time": generation_time,
                    "analyses_count": len(analyses_results),
                },
                "timestamp": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            logger.exception("Business analysis failed")
            return {
                "session_id": session_id,
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now(UTC).isoformat(),
            }

    async def _process_documents(
        self, session_id: str, user_id: str, documents: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Process and index documents

        Args:
            session_id: Session ID
            user_id: User ID
            documents: Raw documents

        Returns:
            Processed documents with extracted text
        """
        processed = []

        for doc in documents:
            try:
                # Scope legacy queue IDs too; never use a caller ID as a global key.
                document_id = str(
                    uuid.uuid5(
                        uuid.NAMESPACE_URL, json.dumps([str(user_id), session_id, doc.get("id") or str(uuid.uuid4())])
                    )
                )
                doc_type = doc.get("type", "text")
                name = doc.get("name", "Unnamed")

                logger.info("Processing document: name=%s, type=%s", name, doc_type)
                logger.info("Document keys: %s", list(doc.keys()))

                # Convert doc_type to string if it's an Enum
                if hasattr(doc_type, "value"):
                    doc_type_str = doc_type.value.lower()
                elif isinstance(doc_type, str):
                    doc_type_str = doc_type.lower()
                else:
                    doc_type_str = str(doc_type).lower()

                logger.info("🔄 Type converted: %s → %s", doc_type, doc_type_str)

                # Extract text based on type
                if doc_type_str == "text":
                    content = doc.get("content", "")
                    metadata = {}
                    logger.info("📝 Text document: %s chars", len(content))

                elif doc_type_str == "url":
                    # Extract from URL using Tika
                    url = doc.get("url", "")
                    logger.info("🌐 URL document: %s", url)
                    result = await self.tika.extract_text_from_url(url)
                    content = result.get("text", "")
                    metadata = result.get("metadata", {})
                    logger.info("Extracted from URL: %s chars", len(content))

                elif doc_type_str in ["pdf", "docx", "doc", "file"]:
                    # Extract from file using Tika
                    if doc.get("file_data"):
                        # Decode base64 to bytes
                        try:
                            file_data_str = doc["file_data"]
                            logger.info("📦 File data length (base64): %s chars", len(file_data_str))

                            file_bytes = base64.b64decode(file_data_str)
                            logger.info("📦 Decoded bytes length: %s bytes", len(file_bytes))

                            result = await self.tika.extract_text_from_bytes(file_bytes, filename=name)
                            content = result.get("text", "")
                            metadata = result.get("metadata", {})
                            logger.info("Extracted from file: %s chars", len(content))
                            logger.info("📄 Content preview: %s...", content[:200])
                        except Exception:
                            logger.exception("Failed to decode/extract base64")
                            content = doc.get("content", "")
                            metadata = {}
                    else:
                        logger.warning("No file_data found for %s document", doc_type_str)
                        content = doc.get("content", "")
                        metadata = {}

                else:
                    logger.warning("Unknown document type: %s", doc_type_str)
                    content = doc.get("content", "")
                    metadata = {}

                # Index in Elasticsearch
                await self.es.index_document(
                    session_id=session_id,
                    document_id=document_id,
                    user_id=user_id,
                    name=name,
                    doc_type=doc_type_str,
                    content=content,
                    metadata=metadata,
                    size=len(content),
                )

                processed.append(
                    {
                        "id": document_id,
                        "name": name,
                        "type": doc_type_str,
                        "content": content,
                        "metadata": metadata,
                        "char_count": len(content),
                    }
                )

            except Exception:
                logger.exception("Failed to process document %s", doc.get("name"))
                continue

        return processed

    def _aggregate_content(self, documents: list[dict[str, Any]]) -> str:
        """
        Aggregate content from multiple documents

        Args:
            documents: Processed documents

        Returns:
            Aggregated content string
        """
        aggregated = []

        for doc in documents:
            content = doc.get("content", "")
            if content:
                aggregated.append(f"""
===== ДОКУМЕНТ: {doc.get("name", "Unnamed")} =====
Тип: {doc.get("type", "unknown")}
Размер: {doc.get("char_count", 0)} символов

{content}
""")

        return "\n\n".join(aggregated)

    async def _perform_single_analysis(
        self,
        session_id: str,
        user_id: str,
        analysis_type: str,
        content: str,
        context: str,
        settings: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Perform single type of analysis

        Args:
            session_id: Session ID
            user_id: User ID
            analysis_type: Type of analysis
            content: Content to analyze
            context: Additional context
            settings: Analysis settings

        Returns:
            Analysis result
        """
        try:
            analysis_id = str(uuid.uuid4())
            start_time = datetime.now(UTC)

            # BI model priority: request override -> LLAMA_MODEL_BI/LLAMA_MODEL_MARKETING -> shared LLAMA_MODEL
            model = settings.get("model", unified_settings.bi_ai_model)
            depth = settings.get("analysis_depth", "deep")

            # Generate analysis
            result = await self.llama.generate_business_analysis(
                analysis_type=analysis_type,
                content=content,
                context=context,
                model=model,
                temperature=settings.get("temperature", 0.8),
                max_tokens=settings.get("max_tokens", 8000),
                stream=False,
                custom_instructions=settings.get("custom_instructions", ""),
            )

            generation_time = (datetime.now(UTC) - start_time).total_seconds()

            # Handle AsyncGenerator if result is a generator
            from collections.abc import AsyncIterator

            if isinstance(result, AsyncIterator) or hasattr(result, "__aiter__"):
                # It's an AsyncGenerator, collect all chunks
                result_dict: dict[str, Any] = {
                    "success": True,
                    "text": "",
                    "tokens_generated": 0,
                    "tokens_per_second": 0,
                }
                async for chunk in result:  # type: ignore[union-attr]
                    if isinstance(chunk, dict):
                        if "text" in chunk:
                            result_dict["text"] += chunk.get("text", "")
                        if "tokens_generated" in chunk:
                            result_dict["tokens_generated"] = chunk.get("tokens_generated", 0)
                        if "tokens_per_second" in chunk:
                            result_dict["tokens_per_second"] = chunk.get("tokens_per_second", 0)
                result = result_dict
            elif not isinstance(result, dict):
                # Convert to dict if needed
                result = {"success": False, "error": "Invalid result type"}

            actual_model = result.get("model") or model

            if result.get("success"):
                analysis_text = result.get("text", "")

                # Index in Elasticsearch
                await self.es.index_analysis(
                    session_id=session_id,
                    analysis_id=analysis_id,
                    user_id=user_id,
                    title=f"{analysis_type.replace('_', ' ').title()}",
                    analysis_type=analysis_type,
                    depth=depth,
                    model_used=actual_model,
                    content=analysis_text,
                    metadata={"settings": settings},
                    metrics={
                        "tokens_used": result.get("tokens_generated", 0),
                        "generation_time": generation_time,
                        "quality_score": self._calculate_quality_score(analysis_text),
                    },
                    status="completed",
                )

                return {
                    "analysis_id": analysis_id,
                    "analysis_type": analysis_type,
                    "title": f"{analysis_type.replace('_', ' ').title()}",
                    "content": analysis_text,
                    "model_used": actual_model,
                    "metrics": {
                        "tokens_used": result.get("tokens_generated", 0),
                        "generation_time": generation_time,
                        "tokens_per_second": result.get("tokens_per_second", 0),
                        "quality_score": self._calculate_quality_score(analysis_text),
                    },
                    "success": True,
                }
            logger.error("Analysis %s failed: %s", analysis_type, result.get("error"))
            return {
                "analysis_id": analysis_id,
                "analysis_type": analysis_type,
                "error": result.get("error", "Unknown error"),
                "success": False,
            }

        except Exception as e:
            logger.exception("Single analysis %s failed", analysis_type)
            return {
                "analysis_id": str(uuid.uuid4()),
                "analysis_type": analysis_type,
                "error": str(e),
                "success": False,
            }

    async def _generate_summary(self, analyses: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Generate summary from all analyses

        Args:
            analyses: List of analysis results

        Returns:
            Summary dict
        """
        successful = [a for a in analyses if a.get("success", False)]
        failed = [a for a in analyses if not a.get("success", False)]

        total_tokens = sum(a.get("metrics", {}).get("tokens_used", 0) for a in successful)

        avg_quality = (
            sum(a.get("metrics", {}).get("quality_score", 0) for a in successful) / len(successful) if successful else 0
        )

        return {
            "total_analyses": len(analyses),
            "successful": len(successful),
            "failed": len(failed),
            "total_tokens_used": total_tokens,
            "average_quality_score": round(avg_quality, 2),
            "analyses_breakdown": {
                a.get("analysis_type"): {
                    "success": a.get("success", False),
                    "tokens": a.get("metrics", {}).get("tokens_used", 0),
                    "time": a.get("metrics", {}).get("generation_time", 0),
                }
                for a in analyses
            },
        }

    def _calculate_quality_score(self, text: str) -> float:
        """
        Calculate quality score for analysis

        Args:
            text: Analysis text

        Returns:
            Quality score (0-100)
        """
        score = 50  # Base score

        # Length check
        if len(text) > 1000:
            score += 10
        if len(text) > 3000:
            score += 10

        # Structure indicators
        if "##" in text or "**" in text:  # Markdown formatting
            score += 10
        if "\n-" in text or "\n•" in text:  # Lists
            score += 5
        if any(word in text.lower() for word in ["рекомендация", "вывод", "анализ"]):
            score += 10
        if any(word in text.lower() for word in ["цель", "стратегия", "план"]):
            score += 5

        return min(score, 100)

    async def search_analyses(self, user_id: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Search user's previous analyses

        Args:
            user_id: User ID
            query: Search query
            limit: Max results

        Returns:
            List of matching analyses
        """
        return await self.es.search_analyses(query=query, user_id=user_id, size=limit)

    async def get_user_stats(self, user_id: str) -> dict[str, Any]:
        """
        Get user's usage statistics

        Args:
            user_id: User ID

        Returns:
            Statistics dict
        """
        return await self.es.get_user_statistics(user_id)
