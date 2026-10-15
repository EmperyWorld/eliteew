#!/usr/bin/env python3
"""
🔥💎 UNIFIED EDITOR SERVICES 💎🔥
Production-ready модульная система документов

Архитектура:
- PostgresDocumentStorage: CRUD операции c документами
- DocumentAnalyzer: Оркестрация обработки документов
- ExportEngine: Генерация экспорта (DOCX/PDF/HTML)
- TikaService: Извлечение текста (reused from BI)
- LlamaAIService: AI обработка (reused from BI)
- ElasticsearchService: Поиск (reused from BI)

Created: 2025-10-02
Author: Empery World Elite Development Team
"""

from api.services.business_intelligence.llama_ai_service import LlamaAIService

# Reuse services from Business Intelligence
from api.services.business_intelligence.tika_service import TikaService
from api.services.elasticsearch_service import ElasticsearchDocumentService as ElasticsearchService

from .document_analyzer import DocumentAnalyzer
from .export_engine import ExportEngine
from .postgres_document_storage import PostgresDocumentStorage

__all__ = [
    "DocumentAnalyzer",
    "ElasticsearchService",
    "ExportEngine",
    "LlamaAIService",
    "PostgresDocumentStorage",
    "TikaService",
]
