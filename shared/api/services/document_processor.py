#!/usr/bin/env python3
"""
ð¥ð DOCUMENT PROCESSOR SERVICE ðð¥
Ð¡ÐµÑÐ²Ð¸Ñ Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ¸ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð² Ñ Ð¸Ð½ÑÐµÐ³ÑÐ°ÑÐ¸ÐµÐ¹ Stack 4
"""

import logging
import os
import re
import tempfile
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiofiles  # type: ignore[reportMissingModuleSource]
import aiohttp  # type: ignore[import-not-found]
import magic  # type: ignore[reportMissingImports]

from api.core.http_clients import get_aiohttp_session
from api.core.pdf_engine import (
    PDF_ENGINE_AVAILABLE,
    extract_embedded_images_from_path,
    merge_pdf_paths,
    page_count_from_path,
    render_page_thumbnail_png_from_path,
    split_by_pages_from_path,
    split_by_sections_from_path,
)
from api.utils.blocking import run_blocking_work
from api.utils.llama_models import DEFAULT_MODEL
from api.utils.llm_openai_compat_http import aiohttp_compat_generate_json

logger = logging.getLogger(__name__)

# HTTP status codes
HTTP_OK = 200
TEMP_FILE_MAX_AGE_SECONDS = 3600  # 1 hour
MIN_WORD_LENGTH = 3


class DocumentProcessor:
    """
    ÐÑÐ¾ÑÐµÑÑÐ¾Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð² Ñ Ð¸Ð½ÑÐµÐ³ÑÐ°ÑÐ¸ÐµÐ¹ Stack 4 ÑÐµÑÐ²Ð¸ÑÐ¾Ð²:
    - Apache Tika Ð´Ð»Ñ Ð¸Ð·Ð²Ð»ÐµÑÐµÐ½Ð¸Ñ ÑÐµÐºÑÑÐ°
    - OCRmyPDF Ð´Ð»Ñ OCR Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ¸
    - Paperless-ngx Ð´Ð»Ñ ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°Ð¼Ð¸
    - Gotenberg Ð´Ð»Ñ ÐºÐ¾Ð½Ð²ÐµÑÑÐ°ÑÐ¸Ð¸
    """

    def __init__(
        self,
        tika_url: str | None = None,
        ocr_url: str | None = None,
        paperless_url: str | None = None,  # ⚡ FIX MYPY: Optional types
        gotenberg_url: str | None = None,
        llama_url: str | None = None,
        use_ai_features: bool = True,
    ):
        # Stack 4 / Stack 2 — только из окружения
        def _url(val: str | None, env_key: str, default: str) -> str:
            out = (val or os.environ.get(env_key) or default or "").strip().rstrip("/")
            return out or ""

        self.tika_url = _url(tika_url, "TIKA_URL", "")
        self.ocr_url = _url(ocr_url, "OCRMYPDF_URL", "")
        self.paperless_url = _url(paperless_url, "PAPERLESS_URL", "")
        self.gotenberg_url = _url(gotenberg_url, "GOTENBERG_URL", "")
        self.llama_url = _url(llama_url, "LLAMA_BASE_URL", "")

        # AI components (Ð¸Ð· legacy ÑÑÐ½ÐºÑÐ¸Ð¾Ð½Ð°Ð»ÑÐ½Ð¾ÑÑÐ¸)
        self.use_ai_features = use_ai_features
        if use_ai_features:
            self.semantic_analyzer = SemanticAnalyzer()
            self.pattern_recognizer = PatternRecognizer()
            self.smart_filler = SmartFormFiller()
            self.visualization_engine = DataVisualizationEngine()

        self.session = None
        self._supported_formats = {
            "text_extraction": [".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt", ".html", ".xml"],
            "ocr": [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"],
            "conversion": [".pdf", ".docx", ".doc", ".txt", ".rtf", ".html", ".md"],
            "images": [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif"],
        }

    async def __aenter__(self):
        """Async context manager entry - uses central HTTP session."""
        self.session = get_aiohttp_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - central session closed at app shutdown."""
        self.session = None

    async def process_document_advanced(
        self,
        file_content: bytes,
        filename: str,
        extract_patterns: bool = True,
        generate_visualizations: bool = True,
        use_llama: bool = True,
    ) -> dict[str, Any]:
        """
        ð¯ ÐÑÐ¾Ð´Ð²Ð¸Ð½ÑÑÐ°Ñ Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° Ñ AI Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑÑÐ¼Ð¸
        ÐÐ½ÑÐµÐ³ÑÐ¸ÑÑÐµÑ Ð²ÑÐµ ÑÑÐ½ÐºÑÐ¸Ð¸ Ð¸Ð· legacy Ð¼Ð¾Ð´ÑÐ»ÐµÐ¹
        """
        result: dict[str, Any] = {
            "filename": filename,
            "status": "processing",
            "processed_at": datetime.now(UTC).isoformat(),
        }

        try:
            if not self.session:
                self.session = get_aiohttp_session()

            logger.info("Starting advanced processing for %s", filename)

            # 1. ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ ÑÐµÐºÑÑÐ° ÑÐµÑÐµÐ· Tika
            text = await self.extract_text_from_bytes(file_content, filename)
            result["extracted_text"] = text[:5000]  # ÐÐµÑÐ²ÑÐµ 5000 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²
            result["full_text_length"] = len(text)

            # 2. AI Ð°Ð½Ð°Ð»Ð¸Ð· ÑÐµÑÐµÐ· Llama (ÐµÑÐ»Ð¸ Ð´Ð¾ÑÑÑÐ¿ÐµÐ½)
            if use_llama and self.llama_url:
                result["ai_analysis"] = await self.analyze_with_llama(text)

            if self.use_ai_features:
                # 3. Ð¡ÐµÐ¼Ð°Ð½ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð°Ð½Ð°Ð»Ð¸Ð·
                result["semantic_analysis"] = await self.semantic_analyzer.analyze(text)

                # 4. Ð Ð°ÑÐ¿Ð¾Ð·Ð½Ð°Ð²Ð°Ð½Ð¸Ðµ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð²
                if extract_patterns:
                    patterns = await self.pattern_recognizer.recognize(text)
                    result["patterns"] = patterns

                    # 5. Smart suggestions
                    suggestions = await self.smart_filler.generate_suggestions(text, patterns)
                    result["suggestions"] = suggestions

                # 6. ÐÐ¸Ð·ÑÐ°Ð»Ð¸Ð·Ð°ÑÐ¸Ñ Ð´Ð°Ð½Ð½ÑÑ
                if generate_visualizations:
                    visualizations = await self.visualization_engine.create_visualizations(
                        text, result.get("patterns", [])
                    )
                    result["visualizations"] = visualizations

                # 7. ÐÑÑÐ¸ÑÐ»ÑÐµÐ¼ confidence score
                confidence = self.calculate_confidence(result.get("semantic_analysis", {}), result.get("patterns", []))
                result["confidence_score"] = confidence

            # 8. OCR ÐµÑÐ»Ð¸ ÑÑÐ¾ Ð¸Ð·Ð¾Ð±ÑÐ°Ð¶ÐµÐ½Ð¸Ðµ Ð¸Ð»Ð¸ PDF
            file_ext = Path(filename).suffix.lower()
            if file_ext in self._supported_formats["ocr"]:
                ocr_text = await self.ocr_from_bytes(file_content, filename)
                if ocr_text:
                    result["ocr_text"] = ocr_text[:2000]  # ÐÐµÑÐ²ÑÐµ 2000 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð² OCR

            result["status"] = "success"
            logger.info("Successfully processed %s", filename)

        except Exception as e:
            logger.exception("Error processing document: %s", e)
            result["status"] = "error"
            result["error"] = str(e)

        return result

    async def extract_text_from_bytes(self, file_content: bytes, filename: str) -> str:
        """
        ð ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ ÑÐµÐºÑÑÐ° Ð¸Ð· bytes ÑÐµÑÐµÐ· Apache Tika
        """
        if not self.session:
            self.session = get_aiohttp_session()

        assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

        try:
            headers = {"Accept": "text/plain", "Content-Type": "application/octet-stream"}

            async with self.session.put(f"{self.tika_url}/tika", headers=headers, data=file_content) as response:
                if response.status == HTTP_OK:
                    return await response.text()
                logger.warning("Tika extraction failed: %s", response.status)
                # Fallback Ð´Ð»Ñ ÑÐµÐºÑÑÐ¾Ð²ÑÑ ÑÐ°Ð¹Ð»Ð¾Ð²
                try:
                    return file_content.decode("utf-8")
                except Exception as exc:
                    logger.debug("[STEP] document_processor_utf8_decode_skip err=%s", exc)
                    return ""
        except Exception as e:
            logger.exception("Tika error: %s", e)
            return ""

    async def ocr_from_bytes(self, file_content: bytes, filename: str) -> str:
        """OCR PDF bytes via Stack4 gateway (OCRmyPDF → Tika), with empty string on failure."""
        from api.services.stack4 import get_stack4_document_gateway

        try:
            gateway = get_stack4_document_gateway()
            return await gateway.ocr_pdf_to_text(file_content, filename)
        except Exception as e:
            logger.exception("OCR error: %s", e)
            return ""

    async def analyze_with_llama(self, text: str) -> dict[str, Any]:
        """
        ð¤ AI Ð°Ð½Ð°Ð»Ð¸Ð· ÑÐµÑÐµÐ· Llama (Stack 2)
        """
        if not self.llama_url or not self.session:
            return {}

        assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

        try:
            prompt = f"""Analyze this document and provide:
            1. Brief summary (2-3 sentences)
            2. Main topics (list)
            3. Document type classification
            4. Key entities (people, companies, dates)
            5. Overall sentiment

            Document:
            {text[:2000]}
            """

            result = await aiohttp_compat_generate_json(
                self.session,
                self.llama_url,
                model=DEFAULT_MODEL,
                prompt=prompt,
                system=None,
                options={"temperature": 0.3, "num_predict": 2048},
                json_format=False,
                keep_alive=None,
                timeout=aiohttp.ClientTimeout(total=60),
            )
            return self.parse_llama_response(result.get("response", ""))
        except Exception as e:
            logger.exception("Llama analysis error: %s", e)
            return {"error": str(e)}

    def parse_llama_response(self, response: str) -> dict[str, Any]:
        """ÐÐ°ÑÑÐ¸Ð½Ð³ Ð¾ÑÐ²ÐµÑÐ° Ð¾Ñ Llama"""
        try:
            analysis: dict[str, Any] = {  # ⚡ FIX MYPY: Explicit type annotation
                "summary": "",
                "topics": [],  # ⚡ FIX MYPY: Will be list[str] when used
                "document_type": "general",
                "entities": [],  # ⚡ FIX MYPY: Will be list[str] when used
                "sentiment": "neutral",
            }

            lines = response.strip().split("\n")
            current_section = None

            for line in lines:
                line = line.strip()
                if "summary" in line.lower():
                    current_section = "summary"
                elif "topic" in line.lower():
                    current_section = "topics"
                elif "type" in line.lower() or "classification" in line.lower():
                    current_section = "document_type"
                elif "entities" in line.lower() or "key" in line.lower():
                    current_section = "entities"
                elif "sentiment" in line.lower():
                    current_section = "sentiment"
                elif current_section and line:
                    if current_section == "summary":
                        analysis["summary"] += line + " "
                    elif current_section == "topics" and (line.startswith(("-", "*"))):
                        analysis["topics"].append(line[1:].strip())
                    elif current_section == "document_type":
                        if line and not line.startswith(":"):
                            analysis["document_type"] = line.strip()
                    elif current_section == "entities" and (line.startswith(("-", "*"))):
                        analysis["entities"].append(line[1:].strip())
                    elif current_section == "sentiment" and any(
                        word in line.lower() for word in ["positive", "negative", "neutral"]
                    ):
                        analysis["sentiment"] = line.lower().strip()

            return analysis
        except Exception as e:
            logger.exception("Error parsing Llama response: %s", e)
            return {"raw_response": response[:500]}

    def calculate_confidence(self, semantic_results: dict[str, Any], patterns: list) -> float:
        """ÐÑÑÐ¸ÑÐ»ÐµÐ½Ð¸Ðµ ÑÐ²ÐµÑÐµÐ½Ð½Ð¾ÑÑÐ¸ Ð² ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ°Ñ Ð°Ð½Ð°Ð»Ð¸Ð·Ð°"""
        confidence = 0.5

        if semantic_results and semantic_results.get("confidence"):
            confidence += semantic_results["confidence"] * 0.3

        if patterns:
            confidence += min(len(patterns) * 0.1, 0.3)

        return min(confidence, 1.0)

    async def extract_text(self, file_path: str) -> dict[str, Any]:
        """
        ð ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ ÑÐµÐºÑÑÐ° Ð¸Ð· Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° ÑÐµÑÐµÐ· Apache Tika
        """
        try:
            if not os.path.exists(file_path):
                msg = f"Ð¤Ð°Ð¹Ð» Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½: {file_path}"
                raise FileNotFoundError(msg)

            file_extension = Path(file_path).suffix.lower()

            if file_extension not in self._supported_formats["text_extraction"]:
                msg = f"ÐÐµÐ¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÐ¹ ÑÐ¾ÑÐ¼Ð°Ñ Ð´Ð»Ñ Ð¸Ð·Ð²Ð»ÐµÑÐµÐ½Ð¸Ñ ÑÐµÐºÑÑÐ°: {file_extension}"
                raise ValueError(msg)

            if not self.session:
                self.session = get_aiohttp_session()
            assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

            # ÐÑÐ¿ÑÐ°Ð²Ð»ÑÐµÐ¼ ÑÐ°Ð¹Ð» Ð² Tika
            async with aiofiles.open(file_path, "rb") as f:
                file_content = await f.read()

            headers = {"Accept": "application/json", "Content-Type": "application/octet-stream"}

            async with self.session.put(f"{self.tika_url}/tika", headers=headers, data=file_content) as response:
                if response.status == HTTP_OK:
                    text_content = await response.text()

                    # ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¼ÐµÑÐ°Ð´Ð°Ð½Ð½ÑÐµ
                    async with self.session.put(
                        f"{self.tika_url}/meta",
                        headers={"Accept": "application/json"},
                        data=file_content,
                    ) as meta_response:
                        metadata = {}
                        if meta_response.status == HTTP_OK:
                            metadata = await meta_response.json()

                    return {
                        "success": True,
                        "text": text_content,
                        "metadata": metadata,
                        "file_path": file_path,
                        "extraction_method": "tika",
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                error_text = await response.text()
                msg = f"Tika error: {response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception("Text extraction failed from %s: %s", file_path, e)
            return {
                "success": False,
                "error": str(e),
                "file_path": file_path,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    async def ocr_process(self, file_path: str, language: str = "rus+eng") -> dict[str, Any]:
        """
        ðï¸ OCR Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐºÐ° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° ÑÐµÑÐµÐ· OCRmyPDF
        """
        try:
            file_extension = Path(file_path).suffix.lower()

            if file_extension not in self._supported_formats["ocr"]:
                msg = f"ÐÐµÐ¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÐ¹ ÑÐ¾ÑÐ¼Ð°Ñ Ð´Ð»Ñ OCR: {file_extension}"
                raise ValueError(msg)

            if not self.session:
                self.session = get_aiohttp_session()
            assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

            # ÐÐ¾Ð´Ð³Ð¾ÑÐ°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð´Ð°Ð½Ð½ÑÐµ Ð´Ð»Ñ OCR API
            with open(file_path, "rb") as fp:
                data = aiohttp.FormData()
                data.add_field(
                    "file",
                    fp,
                    filename=os.path.basename(file_path),
                    content_type="application/octet-stream",
                )
                data.add_field("language", language)
                data.add_field("optimize", "true")
                data.add_field("output_type", "pdf")

                async with self.session.post(f"{self.ocr_url}/ocr", data=data) as response:
                    if response.status == HTTP_OK:
                        # Ð¡Ð¾ÑÑÐ°Ð½ÑÐµÐ¼ OCR ÑÐµÐ·ÑÐ»ÑÑÐ°Ñ
                        ocr_content = await response.read()

                        ocr_file_path = file_path.replace(file_extension, "_ocr.pdf")
                        async with aiofiles.open(ocr_file_path, "wb") as f:
                            await f.write(ocr_content)

                        # ÐÐ·Ð²Ð»ÐµÐºÐ°ÐµÐ¼ ÑÐµÐºÑÑ Ð¸Ð· OCR ÑÐµÐ·ÑÐ»ÑÑÐ°ÑÐ°
                        text_result = await self.extract_text(ocr_file_path)

                        return {
                            "success": True,
                            "ocr_file_path": ocr_file_path,
                            "original_file_path": file_path,
                            "text": text_result.get("text", ""),
                            "language": language,
                            "method": "ocrmypdf",
                            "timestamp": datetime.now(UTC).isoformat(),
                        }
                    error_text = await response.text()
                    msg = f"OCR error: {response.status} - {error_text}"
                    raise Exception(msg)

        except Exception as e:
            logger.exception("OCR processing failed for %s: %s", file_path, e)
            return {
                "success": False,
                "error": str(e),
                "file_path": file_path,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    async def analyze_structure(self, file_path: str) -> dict[str, Any]:
        """
        ð ÐÐ½Ð°Ð»Ð¸Ð· ÑÑÑÑÐºÑÑÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
        """
        try:
            file_extension = Path(file_path).suffix.lower()
            file_stats = os.stat(file_path)

            structure_info = {
                "file_name": os.path.basename(file_path),
                "file_size": file_stats.st_size,
                "file_extension": file_extension,
                "created_date": datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                "modified_date": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
            }

            # ÐÐ¿ÑÐµÐ´ÐµÐ»ÑÐµÐ¼ MIME ÑÐ¸Ð¿
            mime_type = magic.from_file(file_path, mime=True)
            structure_info["mime_type"] = mime_type

            # Ð¡Ð¿ÐµÑÐ¸ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð°Ð½Ð°Ð»Ð¸Ð· Ð´Ð»Ñ ÑÐ°Ð·Ð½ÑÑ ÑÐ¸Ð¿Ð¾Ð² ÑÐ°Ð¹Ð»Ð¾Ð²
            if file_extension == ".pdf":
                structure_info.update(await self._analyze_pdf_structure(file_path))
            elif file_extension in [".docx", ".doc"]:
                structure_info.update(await self._analyze_word_structure(file_path))
            elif file_extension in [".txt", ".md"]:
                structure_info.update(await self._analyze_text_structure(file_path))

            return structure_info

        except Exception as e:
            logger.exception("Structure analysis failed for %s: %s", file_path, e)
            return {"error": str(e)}

    async def _analyze_pdf_structure(self, file_path: str) -> dict[str, Any]:
        """ÐÐ½Ð°Ð»Ð¸Ð· ÑÑÑÑÐºÑÑÑÑ PDF ÑÐµÑÐµÐ· Tika"""
        try:
            if not self.session:
                self.session = get_aiohttp_session()
            assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

            async with aiofiles.open(file_path, "rb") as f:
                file_content = await f.read()

            # ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¼ÐµÑÐ°Ð´Ð°Ð½Ð½ÑÐµ PDF
            async with self.session.put(
                f"{self.tika_url}/meta", headers={"Accept": "application/json"}, data=file_content
            ) as response:
                if response.status == HTTP_OK:
                    metadata = await response.json()

                    return {
                        "pages": metadata.get("xmpTPg:NPages", 0),
                        "title": metadata.get("title", ""),
                        "author": metadata.get("Author", ""),
                        "creator": metadata.get("Creator", ""),
                        "producer": metadata.get("Producer", ""),
                        "creation_date": metadata.get("Creation-Date", ""),
                        "pdf_version": metadata.get("pdf:PDFVersion", ""),
                        "encrypted": metadata.get("pdf:encrypted", False),
                    }
                return {"pdf_analysis_error": f"HTTP {response.status}"}

        except Exception as e:
            return {"pdf_analysis_error": str(e)}

    async def _analyze_word_structure(self, file_path: str) -> dict[str, Any]:
        """ÐÐ½Ð°Ð»Ð¸Ð· ÑÑÑÑÐºÑÑÑÑ Word Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°"""
        try:
            # ÐÑÐ¿Ð¾Ð»ÑÐ·ÑÐµÐ¼ Tika Ð´Ð»Ñ Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð¼ÐµÑÐ°Ð´Ð°Ð½Ð½ÑÑ Word
            if not self.session:
                self.session = get_aiohttp_session()

            assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

            async with aiofiles.open(file_path, "rb") as f:
                file_content = await f.read()

            async with self.session.put(
                f"{self.tika_url}/meta", headers={"Accept": "application/json"}, data=file_content
            ) as response:
                if response.status == HTTP_OK:
                    metadata = await response.json()

                    return {
                        "pages": metadata.get("Page-Count", 0),
                        "words": metadata.get("Word-Count", 0),
                        "characters": metadata.get("Character Count", 0),
                        "title": metadata.get("title", ""),
                        "author": metadata.get("Author", ""),
                        "last_author": metadata.get("Last-Author", ""),
                        "creation_date": metadata.get("Creation-Date", ""),
                        "last_modified": metadata.get("Last-Modified", ""),
                        "application": metadata.get("Application-Name", ""),
                    }
                return {"word_analysis_error": f"HTTP {response.status}"}

        except Exception as e:
            return {"word_analysis_error": str(e)}

    async def _analyze_text_structure(self, file_path: str) -> dict[str, Any]:
        """ÐÐ½Ð°Ð»Ð¸Ð· ÑÑÑÑÐºÑÑÑÑ ÑÐµÐºÑÑÐ¾Ð²Ð¾Ð³Ð¾ ÑÐ°Ð¹Ð»Ð°"""
        try:
            async with aiofiles.open(file_path, encoding="utf-8") as f:
                content = await f.read()

            lines = content.split("\n")
            words = content.split()

            return {
                "lines": len(lines),
                "words": len(words),
                "characters": len(content),
                "characters_no_spaces": len(content.replace(" ", "")),
                "empty_lines": len([line for line in lines if not line.strip()]),
                "encoding": "utf-8",
            }

        except Exception as e:
            return {"text_analysis_error": str(e)}

    async def convert_document(self, source_path: str, target_format: str, output_path: str | None = None) -> str:
        """
        ð ÐÐ¾Ð½Ð²ÐµÑÑÐ°ÑÐ¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° Ð² Ð´ÑÑÐ³Ð¾Ð¹ ÑÐ¾ÑÐ¼Ð°Ñ ÑÐµÑÐµÐ· Gotenberg
        """
        try:
            if not self.gotenberg_url:
                msg = "Gotenberg URL Ð½Ðµ Ð½Ð°ÑÑÑÐ¾ÐµÐ½"
                raise ValueError(msg)

            source_extension = Path(source_path).suffix.lower()
            if source_extension not in self._supported_formats["conversion"]:
                msg = f"ÐÐµÐ¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÐ¹ ÑÐ¾ÑÐ¼Ð°Ñ Ð´Ð»Ñ ÐºÐ¾Ð½Ð²ÐµÑÑÐ°ÑÐ¸Ð¸: {source_extension}"
                raise ValueError(msg)

            if not output_path:
                output_path = source_path.replace(source_extension, f".{target_format}")

            if not self.session:
                self.session = get_aiohttp_session()
            assert self.session is not None  # ⚡ FIX MYPY: Ensure session is not None

            # ÐÐ¾Ð´Ð³Ð¾ÑÐ°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð´Ð°Ð½Ð½ÑÐµ Ð´Ð»Ñ Gotenberg
            with open(source_path, "rb") as fp:
                data = aiohttp.FormData()
                data.add_field("files", fp, filename=os.path.basename(source_path))

                # ÐÑÐ±Ð¸ÑÐ°ÐµÐ¼ endpoint Ð² Ð·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ÑÑÐ¸ Ð¾Ñ ÑÐµÐ»ÐµÐ²Ð¾Ð³Ð¾ ÑÐ¾ÑÐ¼Ð°ÑÐ°
                if target_format == "pdf":
                    endpoint = f"{self.gotenberg_url}/forms/chromium/convert/html"
                else:
                    endpoint = f"{self.gotenberg_url}/forms/libreoffice/convert"

                async with self.session.post(endpoint, data=data) as response:
                    if response.status == HTTP_OK:
                        converted_content = await response.read()

                        async with aiofiles.open(output_path, "wb") as f:
                            await f.write(converted_content)

                        return output_path
                    error_text = await response.text()
                    msg = f"Conversion error: {response.status} - {error_text}"
                    raise Exception(msg)

        except Exception as e:
            logger.exception(f"Error: {e}")
            raise

    async def extract_images(self, file_path: str, output_dir: str | None = None) -> list[str]:
        """
        ð¼ï¸ ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ Ð¸Ð·Ð¾Ð±ÑÐ°Ð¶ÐµÐ½Ð¸Ð¹ Ð¸Ð· Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
        """
        try:
            if not output_dir:
                output_dir = str(Path(os.path.dirname(file_path)) / "extracted_images")

            os.makedirs(output_dir, exist_ok=True)

            file_extension = Path(file_path).suffix.lower()

            if file_extension == ".pdf":
                return await self._extract_images_from_pdf(file_path, output_dir)
            if file_extension in [".docx", ".doc"]:
                return await self._extract_images_from_word(file_path, output_dir)
            return []

        except Exception as e:
            logger.exception(f"Error: {e}")
            return []

    async def _extract_images_from_pdf(self, file_path: str, output_dir: str) -> list[str]:
        """Extract images from PDF document using PyMuPDF."""
        if not PDF_ENGINE_AVAILABLE:
            logger.warning("PyMuPDF not available for PDF image extraction")
            return []
        try:
            return await run_blocking_work(
                extract_embedded_images_from_path,
                file_path,
                output_dir,
                blocking_timeout=120.0,
            )
        except Exception:
            logger.exception("Error extracting images from PDF %s", file_path)
            return []

    async def _extract_images_from_word(self, file_path: str, output_dir: str) -> list[str]:
        """ÐÐ·Ð²Ð»ÐµÑÐµÐ½Ð¸Ðµ Ð¸Ð·Ð¾Ð±ÑÐ°Ð¶ÐµÐ½Ð¸Ð¹ Ð¸Ð· Word Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°"""
        try:
            import zipfile

            extracted_images = []

            with zipfile.ZipFile(file_path, "r") as zip_ref:
                for file_info in zip_ref.filelist:
                    if file_info.filename.startswith("word/media/"):
                        image_name = os.path.basename(file_info.filename)
                        image_path = Path(output_dir) / image_name

                        with zip_ref.open(file_info.filename) as source, open(image_path, "wb") as target:
                            target.write(source.read())

                        extracted_images.append(image_path)

            return [str(img_path) for img_path in extracted_images]

        except Exception as e:
            logger.exception("Word image extraction failed: %s", e)
            return []

    async def split_document(self, file_path: str, split_type: str, **kwargs) -> list[str]:
        """
        âï¸ Ð Ð°Ð·Ð´ÐµÐ»ÐµÐ½Ð¸Ðµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° Ð½Ð° ÑÐ°ÑÑÐ¸

        split_type:
        - pages: Ð¿Ð¾ ÑÑÑÐ°Ð½Ð¸ÑÐ°Ð¼
        - size: Ð¿Ð¾ ÑÐ°Ð·Ð¼ÐµÑÑ ÑÐ°Ð¹Ð»Ð°
        - sections: Ð¿Ð¾ ÑÐ°Ð·Ð´ÐµÐ»Ð°Ð¼
        """
        try:
            if split_type == "pages":
                return await self._split_by_pages(file_path, kwargs.get("pages_per_file", 1))
            if split_type == "size":
                return await self._split_by_size(file_path, kwargs.get("max_size_mb", 10))
            if split_type == "sections":
                return await self._split_by_sections(file_path)
            msg = f"ÐÐµÐ¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÐ¹ ÑÐ¸Ð¿ ÑÐ°Ð·Ð´ÐµÐ»ÐµÐ½Ð¸Ñ: {split_type}"
            raise ValueError(msg)

        except Exception as e:
            logger.exception("Document split failed for %s: %s", file_path, e)
            return []

    async def _split_by_pages(self, file_path: str, pages_per_file: int) -> list[str]:
        """Split document by pages."""
        if not PDF_ENGINE_AVAILABLE:
            return []
        try:
            return await run_blocking_work(
                split_by_pages_from_path,
                file_path,
                pages_per_file,
                blocking_timeout=120.0,
            )
        except Exception as e:
            logger.exception("Error splitting PDF by pages %s: %s", file_path, e)
            return []

    async def _split_by_size(self, file_path: str, max_size_mb: int) -> list[str]:
        """Split document by size."""
        if not PDF_ENGINE_AVAILABLE:
            return []
        try:
            total_size = os.path.getsize(file_path)
            total_pages = await run_blocking_work(
                page_count_from_path,
                file_path,
                blocking_timeout=30.0,
            )
            pages_per_chunk = max(1, int(total_pages * (max_size_mb * 1024 * 1024 / total_size)))
            return await self._split_by_pages(file_path, pages_per_chunk)
        except Exception as e:
            logger.exception("Error splitting document by size %s: %s", file_path, e)
            return []

    async def _split_by_sections(self, file_path: str) -> list[str]:
        """Split document by sections (headers)."""
        if not PDF_ENGINE_AVAILABLE:
            return []
        try:
            return await run_blocking_work(
                split_by_sections_from_path,
                file_path,
                blocking_timeout=120.0,
            )
        except Exception as e:
            logger.exception("Error splitting document by sections %s: %s", file_path, e)
            return []

    async def merge_documents(self, file_paths: list[str], output_path: str, format: str = "pdf") -> str:
        """
        ð ÐÐ±ÑÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ðµ Ð½ÐµÑÐºÐ¾Ð»ÑÐºÐ¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð² Ð² Ð¾Ð´Ð¸Ð½
        """
        try:
            if format == "pdf":
                return await self._merge_pdfs(file_paths, output_path)
            if format == "docx":
                return await self._merge_word_docs(file_paths, output_path)
            msg = f"ÐÐµÐ¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÐ¹ ÑÐ¾ÑÐ¼Ð°Ñ Ð´Ð»Ñ Ð¾Ð±ÑÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ñ: {format}"
            raise ValueError(msg)

        except Exception as e:
            logger.exception("Document merge failed: %s", e)
            raise

    async def _merge_pdfs(self, file_paths: list[str], output_path: str) -> str:
        """Merge PDF files."""
        if not PDF_ENGINE_AVAILABLE:
            return output_path
        try:
            return await run_blocking_work(
                merge_pdf_paths,
                file_paths,
                output_path,
                blocking_timeout=120.0,
            )
        except Exception as e:
            logger.exception("Error merging PDFs: %s", e)
            return output_path

    async def _merge_word_docs(self, file_paths: list[str], output_path: str) -> str:
        """Merge Word documents"""
        try:
            from docx import Document  # type: ignore[import-not-found]

            merged_doc = Document()

            for i, docx_path in enumerate(file_paths):
                doc = Document(docx_path)

                # Add page break between documents
                if i > 0:
                    merged_doc.add_page_break()

                # Copy all elements (paragraphs, tables, images)
                for element in doc.element.body:
                    merged_doc.element.body.append(element)

            merged_doc.save(output_path)
            return output_path

        except Exception as e:
            logger.exception("Error merging Word documents: %s", e)
            return output_path

    async def get_document_preview(self, file_path: str, page: int = 1) -> bytes:
        """Get document preview (image of selected page)."""
        if not PDF_ENGINE_AVAILABLE:
            return b""
        try:
            return await run_blocking_work(
                render_page_thumbnail_png_from_path,
                file_path,
                page=page,
                blocking_timeout=60.0,
            )
        except Exception as e:
            logger.exception("Error creating preview for %s: %s", file_path, e)
            return b""

    async def validate_document(self, file_path: str) -> dict[str, Any]:
        """
        â ÐÐ°Ð»Ð¸Ð´Ð°ÑÐ¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
        """
        try:
            validation_result: dict[str, Any] = {  # ⚡ FIX MYPY: Explicit type annotation
                "is_valid": True,
                "file_path": file_path,
                "errors": [],
                "warnings": [],
                "file_info": {},
            }

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÑÑÐµÑÑÐ²Ð¾Ð²Ð°Ð½Ð¸Ðµ ÑÐ°Ð¹Ð»Ð°
            if not os.path.exists(file_path):
                validation_result["is_valid"] = False
                validation_result["errors"].append("Ð¤Ð°Ð¹Ð» Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½")
                return validation_result

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÐ°Ð·Ð¼ÐµÑ ÑÐ°Ð¹Ð»Ð°
            file_size = os.path.getsize(file_path)
            validation_result["file_info"]["size"] = file_size

            if file_size == 0:
                validation_result["is_valid"] = False
                validation_result["errors"].append("Ð¤Ð°Ð¹Ð» Ð¿ÑÑÑÐ¾Ð¹")

            if file_size > 100 * 1024 * 1024:  # 100MB
                validation_result["warnings"].append("Ð¤Ð°Ð¹Ð» Ð±Ð¾Ð»ÑÑÐµ 100MB")

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ MIME ÑÐ¸Ð¿
            try:
                mime_type = magic.from_file(file_path, mime=True)
                validation_result["file_info"]["mime_type"] = mime_type
            except Exception as e:
                validation_result["warnings"].append(f"ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾Ð¿ÑÐµÐ´ÐµÐ»Ð¸ÑÑ MIME ÑÐ¸Ð¿: {e}")

            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑÑ ÑÑÐµÐ½Ð¸Ñ
            try:
                async with aiofiles.open(file_path, "rb") as f:
                    header = await f.read(1024)  # Ð§Ð¸ÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÐµ 1KB
                    if not header:
                        validation_result["warnings"].append("Ð¤Ð°Ð¹Ð» Ð¼Ð¾Ð¶ÐµÑ Ð±ÑÑÑ Ð¿Ð¾Ð²ÑÐµÐ¶Ð´ÐµÐ½")
            except Exception as e:
                validation_result["is_valid"] = False
                validation_result["errors"].append(f"ÐÑÐ¸Ð±ÐºÐ° ÑÑÐµÐ½Ð¸Ñ ÑÐ°Ð¹Ð»Ð°: {e}")

            return validation_result

        except Exception as e:
            return {
                "is_valid": False,
                "file_path": file_path,
                "errors": [f"ÐÑÐ¸ÑÐ¸ÑÐµÑÐºÐ°Ñ Ð¾ÑÐ¸Ð±ÐºÐ° Ð²Ð°Ð»Ð¸Ð´Ð°ÑÐ¸Ð¸: {e}"],
                "warnings": [],
                "file_info": {},
            }

    def get_supported_formats(self) -> dict[str, list[str]]:
        """
        ð ÐÐ¾Ð»ÑÑÐ¸ÑÑ ÑÐ¿Ð¸ÑÐ¾Ðº Ð¿Ð¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÐ¼ÑÑ ÑÐ¾ÑÐ¼Ð°ÑÐ¾Ð²
        """
        return self._supported_formats

    async def cleanup_temp_files(self, temp_dir: str | None = None) -> None:
        """
        ð§¹ ÐÑÐ¸ÑÑÐºÐ° Ð²ÑÐµÐ¼ÐµÐ½Ð½ÑÑ ÑÐ°Ð¹Ð»Ð¾Ð²
        """
        try:
            if not temp_dir:
                temp_dir = tempfile.gettempdir()

            # Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð²ÑÐµÐ¼ÐµÐ½Ð½ÑÐµ ÑÐ°Ð¹Ð»Ñ ÑÑÐ°ÑÑÐµ 1 ÑÐ°ÑÐ°

            current_time = time.time()

            for root, _dirs, files in os.walk(temp_dir):
                for file in files:
                    if file.startswith("eliteew_"):
                        file_path = Path(root) / file
                        file_age = current_time - Path(file_path).stat().st_ctime

                        if file_age > TEMP_FILE_MAX_AGE_SECONDS:  # 1 ÑÐ°Ñ
                            try:
                                Path(file_path).unlink()
                                logger.info("Removed temp file: %s", file_path)
                            except Exception as e:
                                logger.warning("Failed to remove temp file %s: %s", file_path, e)

        except Exception as e:
            logger.exception("Failed to cleanup temp files: %s", e)


# =============================================================================
# ð§  ADVANCED AI COMPONENTS FROM LEGACY CODE
# =============================================================================


class SemanticAnalyzer:
    """
    ð§  Ð¡ÐµÐ¼Ð°Ð½ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð°Ð½Ð°Ð»Ð¸Ð·Ð°ÑÐ¾Ñ (Ð¸Ð· legacy Advanced AI Engine)
    """

    async def analyze(self, text: str) -> dict[str, Any]:
        """Semantic analysis — remote sklearn on queue-worker sidecar with local Counter fallback."""
        from api.services.science_stack.science_client import request_semantic_analyze

        try:
            remote = await request_semantic_analyze(text)
            if remote:
                return remote
        except Exception as exc:
            logger.debug("[STEP] document_processor_semantic_sidecar_skip err=%s", exc)

        try:
            words = text.split()
            word_freq = Counter(words[:100])
            common_words = word_freq.most_common(10)
            key_terms = [word for word, _ in common_words if len(word) > MIN_WORD_LENGTH]

            return {
                "key_terms": key_terms[:10],
                "coherence": 0.5,
                "sentence_count": len(text.split(".")),
                "confidence": 0.6,
            }

        except Exception as e:
            logger.exception("Semantic analysis error: %s", e)
            return {"error": str(e), "confidence": 0}


class PatternRecognizer:
    """
    ð Ð Ð°ÑÐ¿Ð¾Ð·Ð½Ð°Ð²Ð°ÑÐµÐ»Ñ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð² (Ð¸Ð· legacy Pattern Recognition)
    """

    async def recognize(self, text: str) -> list[dict[str, Any]]:
        """Ð Ð°ÑÐ¿Ð¾Ð·Ð½Ð°Ð²Ð°Ð½Ð¸Ðµ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð² Ð² ÑÐµÐºÑÑÐµ"""
        patterns = []

        # Email Ð¿Ð°ÑÑÐµÑÐ½
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        emails = re.findall(email_pattern, text)
        if emails:
            patterns.append(
                {
                    "type": "email",
                    "values": list(set(emails))[:5],  # Ð£Ð½Ð¸ÐºÐ°Ð»ÑÐ½ÑÐµ, Ð¼Ð°ÐºÑÐ¸Ð¼ÑÐ¼ 5
                    "confidence": 0.95,
                    "count": len(emails),
                }
            )

        # Phone Ð¿Ð°ÑÑÐµÑÐ½
        phone_pattern = r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b"
        phones = re.findall(phone_pattern, text)
        if phones:
            patterns.append(
                {
                    "type": "phone",
                    "values": list(set(phones))[:5],
                    "confidence": 0.85,
                    "count": len(phones),
                }
            )

        # Date Ð¿Ð°ÑÑÐµÑÐ½
        date_patterns = [
            r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
            r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b",
            r"\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b",
        ]
        dates = []
        for pattern in date_patterns:
            dates.extend(re.findall(pattern, text, re.IGNORECASE))
        if dates:
            patterns.append(
                {
                    "type": "date",
                    "values": list(set(dates))[:5],
                    "confidence": 0.80,
                    "count": len(dates),
                }
            )

        # URL Ð¿Ð°ÑÑÐµÑÐ½
        url_pattern = r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"
        urls = re.findall(url_pattern, text)
        if urls:
            patterns.append(
                {
                    "type": "url",
                    "values": list(set(urls))[:5],
                    "confidence": 0.95,
                    "count": len(urls),
                }
            )

        # Money/Currency Ð¿Ð°ÑÑÐµÑÐ½
        money_pattern = (
            r"[\$â¬Â£Â¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?\b|\b\d+(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP|RUB)\b"
        )
        money_values = re.findall(money_pattern, text, re.IGNORECASE)
        if money_values:
            patterns.append(
                {
                    "type": "currency",
                    "values": list(set(money_values))[:5],
                    "confidence": 0.90,
                    "count": len(money_values),
                }
            )

        # ÐÐÐ/ÐÐÐ Ð Ð¿Ð°ÑÑÐµÑÐ½
        inn_pattern = r"\b\d{10}\b|\b\d{12}\b"
        inn_values = re.findall(inn_pattern, text)
        if inn_values:
            # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼, ÑÑÐ¾ ÑÑÐ¾ Ð½Ðµ ÑÐµÐ»ÐµÑÐ¾Ð½Ñ
            potential_inn = [v for v in inn_values if not re.match(phone_pattern, v)]
            if potential_inn:
                patterns.append(
                    {
                        "type": "inn",
                        "values": list(set(potential_inn))[:3],
                        "confidence": 0.70,
                        "count": len(potential_inn),
                    }
                )

        return patterns


class SmartFormFiller:
    """
    ð Ð£Ð¼Ð½Ð¾Ðµ Ð·Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ðµ ÑÐ¾ÑÐ¼ (Ð¸Ð· legacy Smart Form Filler)
    """

    async def generate_suggestions(self, text: str, patterns: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """ÐÐµÐ½ÐµÑÐ°ÑÐ¸Ñ ÑÐ¼Ð½ÑÑ Ð¿ÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ð¹ Ð´Ð»Ñ Ð·Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ"""
        suggestions = []

        # ÐÐ° Ð¾ÑÐ½Ð¾Ð²Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð½ÑÑ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð²
        for pattern in patterns:
            if pattern["type"] == "email":
                suggestions.append(
                    {
                        "field": "contact_email",
                        "value": pattern["values"][0] if pattern["values"] else "",
                        "confidence": pattern["confidence"],
                        "source": "pattern_recognition",
                    }
                )
            elif pattern["type"] == "phone":
                suggestions.append(
                    {
                        "field": "contact_phone",
                        "value": pattern["values"][0] if pattern["values"] else "",
                        "confidence": pattern["confidence"],
                        "source": "pattern_recognition",
                    }
                )
            elif pattern["type"] == "date":
                suggestions.append(
                    {
                        "field": "document_date",
                        "value": pattern["values"][0] if pattern["values"] else "",
                        "confidence": pattern["confidence"],
                        "source": "pattern_recognition",
                    }
                )
            elif pattern["type"] == "inn":
                suggestions.append(
                    {
                        "field": "company_inn",
                        "value": pattern["values"][0] if pattern["values"] else "",
                        "confidence": pattern["confidence"],
                        "source": "pattern_recognition",
                    }
                )
            elif pattern["type"] == "currency":
                suggestions.append(
                    {
                        "field": "amount",
                        "value": pattern["values"][0] if pattern["values"] else "",
                        "confidence": pattern["confidence"],
                        "source": "pattern_recognition",
                    }
                )

        # ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÐºÐ¾Ð½ÑÐµÐºÑÑÐ½ÑÐµ Ð¿ÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ
        text_lower = text.lower()

        # Ð¢Ð¸Ð¿ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°
        document_types = {
            "invoice": ["ÑÑÐµÑ", "invoice", "ÑÐ°ÐºÑÑÑÐ°", "Ð¾Ð¿Ð»Ð°Ñ"],
            "contract": ["Ð´Ð¾Ð³Ð¾Ð²Ð¾Ñ", "contract", "ÑÐ¾Ð³Ð»Ð°ÑÐµÐ½Ð¸Ðµ", "agreement"],
            "report": ["Ð¾ÑÑÐµÑ", "report", "Ð°Ð½Ð°Ð»Ð¸Ð·", "analysis"],
            "letter": ["Ð¿Ð¸ÑÑÐ¼Ð¾", "letter", "Ð¾Ð±ÑÐ°ÑÐµÐ½Ð¸Ðµ"],
            "order": ["Ð·Ð°ÐºÐ°Ð·", "order", "ÑÐ°ÑÐ¿Ð¾ÑÑÐ¶ÐµÐ½Ð¸Ðµ"],
        }

        for doc_type, keywords in document_types.items():
            if any(keyword in text_lower for keyword in keywords):
                suggestions.append(
                    {
                        "field": "document_type",
                        "value": doc_type,
                        "confidence": 0.85,
                        "source": "context_analysis",
                    }
                )
                break

        # ÐÑÐ³Ð°Ð½Ð¸Ð·Ð°ÑÐ¸Ð¸ Ð¸ Ð¸Ð¼ÐµÐ½Ð°
        org_pattern = r'(?:OOO|OAO|ÐÐÐ|ÐÐÐ|ÐÐÐ|ÐÐ)\s*["Â«]?([\w\s]+)["Â»]?'
        organizations = re.findall(org_pattern, text, re.IGNORECASE)
        if organizations:
            suggestions.append(
                {
                    "field": "company_name",
                    "value": organizations[0].strip(),
                    "confidence": 0.75,
                    "source": "text_extraction",
                }
            )

        return suggestions


class DataVisualizationEngine:
    """
    ð ÐÐ²Ð¸Ð¶Ð¾Ðº Ð²Ð¸Ð·ÑÐ°Ð»Ð¸Ð·Ð°ÑÐ¸Ð¸ Ð´Ð°Ð½Ð½ÑÑ (Ð¸Ð· legacy Data Visualization Engine)
    """

    async def create_visualizations(self, text: str, patterns: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð²Ð¸Ð·ÑÐ°Ð»Ð¸Ð·Ð°ÑÐ¸Ð¹ Ð½Ð° Ð¾ÑÐ½Ð¾Ð²Ðµ Ð´Ð°Ð½Ð½ÑÑ"""
        visualizations = []

        # Word frequency chart
        words = text.split()
        word_freq = Counter([w.lower().strip(".,!?;:") for w in words if len(w) > MIN_WORD_LENGTH])

        if word_freq:
            top_words = word_freq.most_common(10)
            visualizations.append(
                {
                    "type": "bar_chart",
                    "title": "Ð§Ð°ÑÑÐ¾ÑÐ½Ð¾ÑÑÑ ÑÐ»Ð¾Ð²",
                    "data": {
                        "labels": [w[0] for w in top_words],
                        "values": [w[1] for w in top_words],
                    },
                    "options": {"color_scheme": "vibrant", "show_values": True},
                }
            )

        # Pattern distribution pie chart
        if patterns:
            pattern_types = {}
            for pattern in patterns:
                ptype = pattern["type"]
                count = pattern.get("count", len(pattern.get("values", [])))
                pattern_types[ptype] = count

            if pattern_types:
                visualizations.append(
                    {
                        "type": "pie_chart",
                        "title": "Ð Ð°ÑÐ¿ÑÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ðµ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð²",
                        "data": {
                            "labels": list(pattern_types.keys()),
                            "values": list(pattern_types.values()),
                        },
                        "options": {"show_legend": True, "show_percentage": True},
                    }
                )

        # Text statistics
        sentences = text.split(".")
        paragraphs = text.split("\n\n")

        visualizations.append(
            {
                "type": "stats_card",
                "title": "Ð¡ÑÐ°ÑÐ¸ÑÑÐ¸ÐºÐ° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°",
                "data": {
                    "ÐÐ±ÑÐµÐµ ÐºÐ¾Ð»Ð¸ÑÐµÑÑÐ²Ð¾ ÑÐ»Ð¾Ð²": len(words),
                    "Ð£Ð½Ð¸ÐºÐ°Ð»ÑÐ½ÑÑ ÑÐ»Ð¾Ð²": len({w.lower() for w in words}),
                    "ÐÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ð¹": len([s for s in sentences if s.strip()]),
                    "ÐÐ±Ð·Ð°ÑÐµÐ²": len([p for p in paragraphs if p.strip()]),
                    "ÐÐ°Ð¹Ð´ÐµÐ½Ð½ÑÑ Ð¿Ð°ÑÑÐµÑÐ½Ð¾Ð²": len(patterns),
                },
                "style": "modern",
            }
        )

        # ÐÐ»Ð¸Ð½Ð° Ð¿ÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ð¹ distribution
        sentence_lengths = [len(s.split()) for s in sentences if s.strip()]
        if sentence_lengths:
            avg_length = sum(sentence_lengths) / len(sentence_lengths)
            visualizations.append(
                {
                    "type": "histogram",
                    "title": "Ð Ð°ÑÐ¿ÑÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ðµ Ð´Ð»Ð¸Ð½Ñ Ð¿ÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ð¹",
                    "data": {
                        "values": sentence_lengths[:50],  # ÐÐµÑÐ²ÑÐµ 50 Ð¿ÑÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ð¹
                        "bins": 10,
                        "average": avg_length,
                    },
                    "options": {"show_average": True, "color": "#3b82f6"},
                }
            )

        return visualizations


# =============================================================================
# ð¯ ENHANCED DOCUMENT PROCESSOR METHODS
# =============================================================================


# ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð¼ÐµÑÐ¾Ð´Ñ Ð² ÑÑÑÐµÑÑÐ²ÑÑÑÐ¸Ð¹ ÐºÐ»Ð°ÑÑ DocumentProcessor
def enhance_document_processor() -> None:
    """Ð¤ÑÐ½ÐºÑÐ¸Ñ Ð´Ð»Ñ Ð¸Ð½Ð¸ÑÐ¸Ð°Ð»Ð¸Ð·Ð°ÑÐ¸Ð¸ AI ÐºÐ¾Ð¼Ð¿Ð¾Ð½ÐµÐ½ÑÐ¾Ð² Ð² DocumentProcessor"""
    # ÐÐ¾Ð´ Ð²ÑÐ¿Ð¾Ð»Ð½ÑÐµÑÑÑ Ð¿ÑÐ¸ Ð¸Ð½Ð¸ÑÐ¸Ð°Ð»Ð¸Ð·Ð°ÑÐ¸Ð¸ Ð¼Ð¾Ð´ÑÐ»Ñ
