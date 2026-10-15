#!/usr/bin/env python3
"""
💼 DOCUMENT ANALYZER - Core Orchestration
Центральный оркестратор обработки документов

Features:
✅ Multi-format document processing
✅ AI-powered analysis with Llama
✅ Full-text search with Elasticsearch
✅ Pattern extraction (questions, JSON flags)
✅ Progress tracking
"""

import base64
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from api.core.unified_config import unified_settings
from api.services.business_intelligence.elasticsearch_service import (
    ElasticsearchService,
)
from api.services.business_intelligence.llama_ai_service import LlamaAIService
from api.services.business_intelligence.tika_service import TikaService

logger = logging.getLogger(__name__)


class DocumentAnalyzer:
    """Core document analysis engine"""

    def __init__(
        self,
        tika_service: TikaService,
        llama_service: LlamaAIService,
        elasticsearch_service: ElasticsearchService | None = None,
    ):
        """
        Initialize Document Analyzer

        Args:
            tika_service: Tika service for text extraction
            llama_service: Llama AI service for analysis
            elasticsearch_service: Optional ES service for indexing
        """
        self.tika = tika_service
        self.llama = llama_service
        self.elasticsearch = elasticsearch_service

    async def process_document(
        self,
        file_name: str,
        file_type: str,
        file_data: str,
        user_id: str,
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Process uploaded document

        Args:
            file_name: Original file name
            file_type: File extension (.docx, .pdf, etc)
            file_data: Base64 encoded file content
            user_id: User ID
            options: Processing options

        Returns:
            Processing result
        """
        start_time = datetime.now(UTC)
        options = options or {}

        try:
            logger.info("📄 Processing document: %s (%s)", file_name, file_type)

            # Step 1: Extract text from document
            text_content, html_content, metadata = await self._extract_text(file_name, file_type, file_data)

            logger.info("Extracted %d chars from %s", len(text_content), file_name)

            # Step 2: Extract patterns (questions, JSON flags)
            extracted_patterns = []
            if options.get("extractQuestions", True):
                questions = self._extract_question_patterns(text_content)
                extracted_patterns.extend(questions)

            if options.get("extractJSONFlags", True):
                json_flags = self._extract_json_flags(text_content)
                extracted_patterns.extend(json_flags)

            logger.info("Extracted %d patterns", len(extracted_patterns))

            # Step 3: AI Analysis (if enabled)
            ai_analysis = None
            if options.get("enableAIAnalysis", False):
                ai_analysis = await self._analyze_with_ai(text_content, file_name, metadata)
                logger.info("🤖 AI analysis completed")

            # Step 4: Index in Elasticsearch (if available, via shared client)
            if self.elasticsearch:
                try:
                    doc_id = str(uuid.uuid4())
                    await self.elasticsearch.index_document(
                        session_id=doc_id,
                        document_id=doc_id,
                        user_id=user_id,
                        name=file_name,
                        doc_type=file_type,
                        content=text_content,
                        metadata=metadata,
                        size=len(text_content),
                    )
                    logger.info("📇 Indexed in Elasticsearch (unified editor): %s", doc_id)
                except (OSError, ConnectionError, ValueError) as e:
                    logger.warning("Elasticsearch indexing failed: %s", e)

            # Step 5: Compile result
            processing_time = (datetime.now(UTC) - start_time).total_seconds()

            return {
                "success": True,
                "html": html_content,
                "content": text_content,
                "extractedData": extracted_patterns,
                "metadata": metadata,
                "ai_analysis": ai_analysis,
                "processing_time": processing_time,
            }

        except Exception as e:
            logger.exception("Document processing failed")
            return {
                "success": False,
                "error": str(e),
                "html": "",
                "content": "",
                "extractedData": [],
            }

    async def _extract_text(self, file_name: str, file_type: str, file_data: str) -> tuple[str, str, dict[str, Any]]:
        """
        Extract text from file using Tika

        Args:
            file_name: File name
            file_type: File extension
            file_data: Base64 encoded file

        Returns:
            (text_content, html_content, metadata)
        """
        try:
            # Decode base64
            file_bytes = base64.b64decode(file_data)

            # Use Tika for supported formats
            if file_type.lower() in [".pdf", ".docx", ".doc", ".txt", ".html", ".rtf"]:
                result = await self.tika.extract_text_from_bytes(file_bytes, filename=file_name)

                text = result.get("text", "")
                metadata = result.get("metadata", {})

                # Generate HTML from text
                html = f"<div><h1>{file_name}</h1><pre>{text}</pre></div>"

                return text, html, metadata

            # Fallback for unsupported types
            if file_type.lower() in [".txt"]:
                text = file_bytes.decode("utf-8", errors="ignore")
                html = f"<pre>{text}</pre>"
                return text, html, {"type": "text"}

            logger.warning("Unsupported file type: %s", file_type)
            return "", "<p>Unsupported file type</p>", {}

        except Exception:
            logger.exception("Text extraction failed")
            raise

    def _extract_question_patterns(self, content: str) -> list[dict[str, Any]]:
        """
        Extract )*(...)* question patterns

        Args:
            content: Document content

        Returns:
            List of extracted questions
        """
        patterns: list[dict[str, Any]] = []
        question_regex = r"\)\*\(([^)]+)\)\*"

        for match in re.finditer(question_regex, content):
            pattern_id = f"question_{len(patterns) + 1}_{int(datetime.now(UTC).timestamp())}"
            patterns.append(
                {
                    "id": pattern_id,
                    "type": "question",
                    "pattern": match.group(0),
                    "content": match.group(1),
                    "position": {"start": match.start(), "end": match.end()},
                    "filled": False,
                }
            )

        return patterns

    def _extract_json_flags(self, content: str) -> list[dict[str, Any]]:
        """
        Extract {JSON(...)} flag patterns

        Args:
            content: Document content

        Returns:
            List of extracted JSON flags
        """
        patterns: list[dict[str, Any]] = []
        json_regex = r"\{JSON\(([^)]+)\)\}"

        for match in re.finditer(json_regex, content):
            pattern_id = f"json_{len(patterns) + 1}_{int(datetime.now(UTC).timestamp())}"
            patterns.append(
                {
                    "id": pattern_id,
                    "type": "json_flag",
                    "pattern": match.group(0),
                    "content": match.group(1),
                    "position": {"start": match.start(), "end": match.end()},
                    "filled": False,
                }
            )

        return patterns

    async def _analyze_with_ai(
        self,
        content: str,
        file_name: str,
        metadata: dict[str, Any],  # noqa: ARG002
    ) -> dict[str, Any]:
        """
        Analyze document with Llama AI

        Args:
            content: Document content
            file_name: File name
            metadata: Document metadata

        Returns:
            AI analysis result
        """
        try:
            # Generate analysis prompt
            prompt = f"""Проанализируй следующий документ:

Название: {file_name}
Содержимое:
{content[:2000]}...

Предоставь краткий анализ:
1. Основная тема
2. Ключевые моменты (3-5 пунктов)
3. Тип документа
4. Рекомендации по улучшению
"""

            # Call Llama
            # generate() returns dict[str, Any] when stream=False, AsyncGenerator when stream=True
            result = await self.llama.generate(
                prompt=prompt,
                model=unified_settings.default_ai_model,
                temperature=0.7,
                max_tokens=500,
                stream=False,
            )

            # Type check: when stream=False, result is dict[str, Any]
            if isinstance(result, dict) and result.get("success"):
                return {
                    "summary": result.get("text", ""),
                    "model_used": unified_settings.default_ai_model,
                    "tokens_used": result.get("tokens_generated", 0),
                }
            # Handle error case
            error_msg = result.get("error") if isinstance(result, dict) else "Unknown error"
            return {"summary": "AI analysis unavailable", "error": error_msg}

        except Exception as e:
            logger.exception("AI analysis failed")
            return {"summary": "AI analysis failed", "error": str(e)}
