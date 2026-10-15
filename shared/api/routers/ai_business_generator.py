#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🚀 AI BUSINESS GENERATOR API - PRODUCTION VERSION
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------


import asyncio
import io
import json
import logging
import re
import shutil
import tempfile
import uuid
import warnings
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import aiofiles  # type: ignore[import-not-found]
import aiohttp  # type: ignore[import-not-found]
from bs4 import BeautifulSoup  # type: ignore[import-untyped]
from docx import Document  # type: ignore[import-not-found]
from docx.enum.style import WD_STYLE_TYPE  # type: ignore[import-not-found]
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT  # type: ignore[import-not-found]
from docx.shared import Pt, RGBColor  # type: ignore[import-not-found]
from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]

from api.core.pdf_engine import PDF_ENGINE_AVAILABLE, extract_text_from_path
from api.utils.blocking import run_blocking_work
from api.utils.llama_models import DEFAULT_MODEL
from api.utils.llm_openai_compat_http import (
    aiohttp_compat_generate_json,
    aiohttp_compat_generate_text_stream,
)

# Импорт настроек - замените на ваш реальный импорт
try:
    from api.core.unified_config import unified_settings
except ImportError:
    # Заглушка для тестирования
    class UnifiedSettings:
        llama_url = "http://localhost:11434"

    unified_settings = UnifiedSettings()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/api/ai-business", tags=["AI Business Generator"])

# ========================================
# ⚙️ КОНФИГУРАЦИЯ
# ========================================

# Constants
HTTP_STATUS_OK = 200
MIN_LINE_LENGTH = 20
MAX_LINE_LENGTH = 200
LLAMA_BASE_URL = unified_settings.llama_url
# Use tempfile for secure temporary directories
UPLOAD_DIR = Path(tempfile.gettempdir()) / "ai_business_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "ai_business_outputs"
CACHE_DIR = Path(tempfile.gettempdir()) / "ai_business_cache"

# Create necessary directories
for dir_path in [UPLOAD_DIR, OUTPUT_DIR, CACHE_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# 📝 Ограничения
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_URL_CONTENT = 100000  # символов
ALLOWED_FILE_TYPES = [".pdf", ".txt", ".doc", ".docx", ".md", ".csv"]

# ========================================
# 📊 МОДЕЛИ ДАННЫХ
# ========================================


class AnalysisDepth(StrEnum):
    """Глубина анализа"""

    BASIC = "basic"  # Быстрый поверхностный анализ
    STANDARD = "standard"  # Стандартный анализ
    DEEP = "deep"  # Глубокий анализ
    EXPERT = "expert"  # Expert analysis with multiple iterations


class OutputFormat(StrEnum):
    """Формат вывода документов"""

    WORD = "word"
    PDF = "pdf"
    MARKDOWN = "markdown"
    JSON = "json"
    ALL = "all"


class DocumentType(StrEnum):
    """Типы генерируемых документов"""

    EXECUTIVE_SUMMARY = "executive_summary"
    DETAILED_ANALYSIS = "detailed_analysis"
    SWOT_ANALYSIS = "swot_analysis"
    COMPETITIVE_ANALYSIS = "competitive_analysis"
    FINANCIAL_PROJECTION = "financial_projection"
    MARKETING_STRATEGY = "marketing_strategy"
    ACTION_PLAN = "action_plan"
    RISK_ASSESSMENT = "risk_assessment"


class GenerationSettings(BaseModel):
    """Настройки генерации"""

    model: str = Field(default=DEFAULT_MODEL, description="Модель Llama для использования")
    temperature: float = Field(default=0.8, ge=0.1, le=2.0)
    top_p: float = Field(default=0.95, ge=0.1, le=1.0)
    top_k: int = Field(default=40, ge=1, le=100)
    max_tokens: int = Field(default=8000, ge=100, le=32000)
    seed: int | None = Field(default=None, description="Seed для воспроизводимости")
    analysis_depth: AnalysisDepth = Field(default=AnalysisDepth.DEEP)
    output_formats: list[OutputFormat] = Field(default=[OutputFormat.WORD])
    document_types: list[DocumentType] = Field(
        default_factory=lambda: [
            DocumentType.EXECUTIVE_SUMMARY,
            DocumentType.DETAILED_ANALYSIS,
            DocumentType.ACTION_PLAN,
        ]
    )
    language: str = Field(default="ru", description="Язык генерации")
    custom_instructions: str | None = Field(default=None, description="Дополнительные инструкции")
    use_cache: bool = Field(default=True, description="Использовать кеширование")
    stream_response: bool = Field(default=False, description="Стриминговый ответ")


class DocumentInput(BaseModel):
    """Входной документ для анализа"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # pdf, txt, url, text
    name: str
    content: str | None = None
    url: str | None = None
    file_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v:
            parsed = urlparse(v)
            if not parsed.scheme or not parsed.netloc:
                msg = "Invalid URL format"
                raise ValueError(msg)
        return v


class GenerationRequest(BaseModel):
    """Запрос на генерацию"""

    session_id: str | None = Field(default_factory=lambda: str(uuid.uuid4()))
    settings: GenerationSettings
    documents: list[DocumentInput]
    context: str | None = Field(default=None, description="Дополнительный контекст")


class GenerationProgress(BaseModel):
    """Прогресс генерации"""

    session_id: str
    stage: str
    stage_name: str
    progress: int = Field(ge=0, le=100)
    message: str
    current_step: int
    total_steps: int
    elapsed_time: float
    estimated_remaining: float | None = None
    details: dict[str, Any] | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class GenerationResult(BaseModel):
    """Результат генерации"""

    session_id: str
    status: str  # completed, failed, cancelled
    documents: list[dict[str, Any]]
    analysis_summary: dict[str, Any]
    metrics: dict[str, Any]
    generation_time: float
    model_used: str
    tokens_used: int
    timestamp: str

    model_config = {"protected_namespaces": ()}


# ========================================
# 📝 МЕНЕДЖЕР СЕССИЙ
# ========================================


class SessionManager:
    """Управление активными сессиями генерации"""

    def __init__(self) -> None:
        self.sessions: dict[str, dict[str, Any]] = {}
        self.websockets: dict[str, list[WebSocket]] = {}

    async def create_session(self, session_id: str, request: GenerationRequest) -> None:
        """Создание новой сессии"""
        self.sessions[session_id] = {
            "id": session_id,
            "status": "initializing",
            "request": request,
            "progress": None,
            "results": [],
            "start_time": datetime.now(UTC),
            "websockets": [],
            "cancel_event": asyncio.Event(),
            "metrics": {"tokens_used": 0, "api_calls": 0, "cache_hits": 0},
        }

    async def update_progress(self, session_id: str, progress: GenerationProgress) -> None:
        """Обновление прогресса сессии"""
        if session_id in self.sessions:
            self.sessions[session_id]["progress"] = progress
            # Отправка обновления через WebSocket
            await self.broadcast_to_session(session_id, {"type": "progress", "data": progress.model_dump()})

    async def add_websocket(self, session_id: str, websocket: WebSocket) -> None:
        """Добавление WebSocket к сессии"""
        if session_id not in self.websockets:
            self.websockets[session_id] = []
        self.websockets[session_id].append(websocket)

    async def remove_websocket(self, session_id: str, websocket: WebSocket) -> None:
        """Удаление WebSocket из сессии"""
        if session_id in self.websockets and websocket in self.websockets[session_id]:
            self.websockets[session_id].remove(websocket)

    async def broadcast_to_session(self, session_id: str, message: dict[str, Any]) -> None:
        """Отправка сообщения всем WebSocket сессии"""
        if session_id in self.websockets:
            disconnected = []
            for ws in self.websockets[session_id]:
                try:
                    await ws.send_json(message)
                except (WebSocketDisconnect, ConnectionError, RuntimeError):  # fmt: skip
                    disconnected.append(ws)
            # Удаляем отключенные соединения
            for ws in disconnected:
                await self.remove_websocket(session_id, ws)

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Получение данных сессии"""
        return self.sessions.get(session_id)

    async def cancel_session(self, session_id: str) -> None:
        """Отмена сессии"""
        if session_id in self.sessions:
            self.sessions[session_id]["cancel_event"].set()
            self.sessions[session_id]["status"] = "cancelled"


# Глобальный менеджер сессий
session_manager = SessionManager()

# ========================================
# 🔗 LLAMA API ИНТЕГРАЦИЯ
# ========================================


class LlamaClient:
    """Client for working with Llama API"""

    def __init__(self) -> None:
        self.base_url = LLAMA_BASE_URL
        self.session: aiohttp.ClientSession | None = None
        self.model_cache: dict[str, Any] = {}

    async def __aenter__(self) -> LlamaClient:
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: object,
    ) -> bool:
        if self.session:
            await self.session.close()
        return False

    async def ensure_session(self) -> None:
        """Убедиться что сессия активна"""
        if not self.session:
            self.session = aiohttp.ClientSession()

    async def list_models(self) -> list[dict[str, Any]]:
        """Получение списка доступных моделей"""
        await self.ensure_session()
        if not self.session:
            return []

        try:
            async with self.session.get(f"{self.base_url}/api/tags") as response:
                if response.status == HTTP_STATUS_OK:
                    data = await response.json()
                    models = []

                    for model in data.get("models", []):
                        model_info = {
                            "name": model.get("name", ""),
                            "size": model.get("size", 0),
                            "digest": model.get("digest", ""),
                            "modified": model.get("modified_at", ""),
                            "details": model.get("details", {}),
                            "parameters": self._get_model_parameters(model.get("name", "")),
                        }
                        models.append(model_info)

                    return models
                logger.error("Failed to fetch models: %s", response.status)
                return []
        except (ConnectionError, TimeoutError, aiohttp.ClientError):  # fmt: skip
            logger.exception("Error fetching models")
            return []

    def _get_model_parameters(self, model_name: str) -> dict[str, Any]:
        params = {
            "qwen": {
                "quality": 95,
                "speed": 70,
                "description": "🔥 Топовая модель для глубокого бизнес-анализа",
                "recommended_temp": 0.8,
                "recommended_tokens": 16000,
                "capabilities": ["analysis", "strategy", "financial", "marketing"],
            },
            "llama": {
                "quality": 92,
                "speed": 65,
                "description": "🦙 Meta Llama - баланс качества и скорости",
                "recommended_temp": 0.7,
                "recommended_tokens": 8000,
                "capabilities": ["analysis", "strategy", "general"],
            },
            "gemma": {
                "quality": 85,
                "speed": 90,
                "description": "⚡ Google Gemma - быстрый анализ",
                "recommended_temp": 0.75,
                "recommended_tokens": 8000,
                "capabilities": ["analysis", "summary", "general"],
            },
            "mistral": {
                "quality": 90,
                "speed": 75,
                "description": "🌪️ Mistral - точность и эффективность",
                "recommended_temp": 0.7,
                "recommended_tokens": 12000,
                "capabilities": ["analysis", "technical", "detailed"],
            },
        }

        # Определяем тип модели по имени
        model_lower = model_name.lower()
        for key, value in params.items():
            if key in model_lower:
                return value

        # Дефолтные параметры
        return {
            "quality": 80,
            "speed": 80,
            "description": "🤖 AI модель для анализа",
            "recommended_temp": 0.8,
            "recommended_tokens": 8000,
            "capabilities": ["general"],
        }

    async def generate(
        self,
        prompt: str,
        system: str = "",
        settings: GenerationSettings | None = None,
        *,
        stream: bool = False,
    ) -> str | AsyncGenerator[str]:
        """Генерация текста через Llama"""
        await self.ensure_session()
        if not self.session:
            raise HTTPException(status_code=500, detail="Llama client not initialized")

        if not settings:
            settings = GenerationSettings()

        payload = {
            "model": settings.model,
            "prompt": prompt,
            "system": system,
            "stream": stream,
            "options": {
                "temperature": settings.temperature,
                "top_p": settings.top_p,
                "top_k": settings.top_k,
                "num_predict": settings.max_tokens,
                "seed": settings.seed,
                "repeat_penalty": 1.1,
                "stop": ["</response>", "\n\n---", "###"],
            },
        }

        try:
            if stream:
                return self._generate_stream(payload)

            system_s = system if isinstance(system, str) and system.strip() else None
            data = await aiohttp_compat_generate_json(
                self.session,
                self.base_url,
                model=payload["model"],
                prompt=payload["prompt"],
                system=system_s,
                options=payload.get("options"),
                json_format=False,
                keep_alive=None,
                timeout=aiohttp.ClientTimeout(total=600),
            )
            return (data.get("response") or "").strip()
        except TimeoutError:
            msg = "Generation timeout - try reducing max_tokens or using a faster model"
            raise HTTPException(status_code=504, detail=msg) from TimeoutError
        except (ValueError, RuntimeError, ConnectionError):  # fmt: skip
            logger.exception("Generation error")
            raise

    async def _generate_stream(self, payload: dict[str, Any]) -> AsyncGenerator[str]:
        """Стриминговая генерация"""
        if not self.session:
            return

        system_raw = payload.get("system") or ""
        system = system_raw if isinstance(system_raw, str) and system_raw.strip() else None
        async for piece in aiohttp_compat_generate_text_stream(
            self.session,
            self.base_url,
            model=payload["model"],
            prompt=payload["prompt"],
            system=system,
            options=payload.get("options"),
            timeout=aiohttp.ClientTimeout(total=600),
        ):
            if piece:
                yield piece

    async def pull_model(self, model_name: str) -> bool:
        """Загрузка модели если её нет"""
        await self.ensure_session()
        if not self.session:
            return False

        try:
            async with self.session.post(f"{self.base_url}/api/pull", json={"name": model_name}) as response:
                if response.status == HTTP_STATUS_OK:
                    async for line in response.content:
                        if line:
                            data = json.loads(line)
                            logger.info("Pulling model %s: %s", model_name, data.get("status", ""))
                    return True
                return False
        except (ConnectionError, TimeoutError, aiohttp.ClientError):  # fmt: skip
            logger.exception("Error pulling model")
            return False


# ========================================
# 📄 ПРОЦЕССОР ДОКУМЕНТОВ
# ========================================


class DocumentProcessor:
    @staticmethod
    async def extract_pdf(file_path: str) -> str:
        try:
            if not PDF_ENGINE_AVAILABLE:
                return "PyMuPDF не установлен — извлечение PDF недоступно"
            full_text = await run_blocking_work(
                extract_text_from_path,
                file_path,
                blocking_timeout=120.0,
            )
            if not full_text.strip():
                return "PDF не содержит текста"
            pages = [part for part in full_text.split("\n\n") if part.strip()]
            formatted = [f"Страница {idx}]\n{part}" for idx, part in enumerate(pages, 1)]
            return "\n\n".join(formatted)
        except (OSError, ValueError) as e:
            logger.exception("PDF extraction error")
            return f"Ошибка PDF: {e!s}"

    @staticmethod
    async def extract_text(file_path: str) -> str:
        try:
            async with aiofiles.open(file_path, encoding="utf-8") as file:
                return await file.read()
        except UnicodeDecodeError:
            try:
                async with aiofiles.open(file_path, encoding="cp1251") as file:
                    return await file.read()
            except (UnicodeDecodeError, ValueError) as e:
                return f"Ошибка декодирования: {e!s}"

    @staticmethod
    async def extract_url(url: str) -> str:
        try:
            async with (
                aiohttp.ClientSession() as session,
                session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response,
            ):
                if response.status == HTTP_STATUS_OK:
                    html = await response.text()
                    soup = BeautifulSoup(html, "html.parser")

                    for element in soup(["script", "style", "nav", "footer", "header"]):
                        element.decompose()

                    text = soup.get_text(separator="\n", strip=True)

                    if len(text) > MAX_URL_CONTENT:
                        text = text[:MAX_URL_CONTENT] + "\n...[контент обрезан]"

                    return text
                return f"URL ошибка: HTTP {response.status}"
        except (aiohttp.ClientError, TimeoutError, ValueError) as e:
            logger.exception("URL extraction error")
            return f"Ошибка URL: {e!s}"

    @classmethod
    async def process_document(cls, doc: DocumentInput) -> str:
        if doc.type == "pdf" and doc.file_path:
            return await cls.extract_pdf(doc.file_path)
        if doc.type == "txt" and doc.file_path:
            return await cls.extract_text(doc.file_path)
        if doc.type == "url" and doc.url:
            return await cls.extract_url(doc.url)
        if doc.type == "text" and doc.content:
            return doc.content
        return "Неизвестный тип документа"


# ========================================
# 📄 ГЕНЕРАТОР ДОКУМЕНТОВ
# ========================================


class DocumentGenerator:
    def __init__(self) -> None:
        self.templates = self._load_templates()

    def _load_templates(self) -> dict[str, Any]:
        """Загрузка шаблонов промптов"""
        return {
            DocumentType.EXECUTIVE_SUMMARY: {
                "system": """Ты — опытный бизнес-консультант, специализирующийся на создании кратких и информативных резюме для руководителей.  # noqa: RUF001
                Твоя задача - выделить ключевые моменты, риски и возможности.""",
                "prompt": """Based on provided materials create Executive Summary.

                Structure:
                1. Brief business description (2-3 sentences)
                2. Key metrics and indicators
                3. Main strengths
                4. Critical issues requiring attention
                5. Top-3 recommendations for immediate actions
                6. Development forecast for 6-12 months

                Materials: {materials}

                Write clearly, structured, use bullet points.""",
            },
            DocumentType.DETAILED_ANALYSIS: {
                "system": """Ты — эксперт по бизнес-анализу с 20-летним опытом.  # noqa: RUF001
                Проводишь глубокий многоуровневый анализ, выявляешь скрытые проблемы и возможности.""",  # noqa: RUF001
                "prompt": """Проведи детальный анализ бизнеса.  # noqa: RUF001

                Разделы анализа:
                1. ОБЗОР БИЗНЕСА
                   - Бизнес-модель
                   - Целевая аудитория
                   - Ценностное предложение

                2. АНАЛИЗ РЫНКА
                   - Размер и динамика рынка
                   - Конкурентная среда
                   - Барьеры входа и выхода

                3. ВНУТРЕННИЙ АНАЛИЗ
                   - Операционная эффективность
                   - Финансовое состояние
                   - Человеческие ресурсы
                   - Технологии и процессы

                4. SWOT-АНАЛИЗ
                   - Детальная матрица SWOT
                   - Стратегии SO, WO, ST, WT

                5. РИСКИ И ВОЗМОЖНОСТИ
                   - Матрица рисков
                   - Упущенные возможности
                   - Потенциал роста

                6. РЕКОМЕНДАЦИИ
                   - Краткосрочные (1-3 месяца)
                   - Среднесрочные (3-12 месяцев)
                   - Долгосрочные (1-3 года)

                Материалы: {materials}  # noqa: RUF001

                Анализ должен быть глубоким, с конкретными примерами и цифрами.""",  # noqa: RUF001
            },
            DocumentType.ACTION_PLAN: {
                "system": """Ты — специалист по стратегическому планированию.  # noqa: RUF001
                Создаешь четкие, выполнимые планы действий с конкретными шагами и метриками.""",  # noqa: RUF001
                "prompt": """Создай детальный план действий для развития бизнеса.  # noqa: RUF001

                Формат плана:

                ФАЗА 1: QUICK WINS (0-30 дней)
                Для каждого действия укажи:
                - Что сделать (конкретное действие)
                - Кто ответственный
                - Срок выполнения
                - Ресурсы
                - KPI/метрика успеха
                - Ожидаемый результат

                ФАЗА 2: ОПТИМИЗАЦИЯ (1-3 месяца)
                [Аналогичная структура]

                ФАЗА 3: ТРАНСФОРМАЦИЯ (3-6 месяцев)
                [Аналогичная структура]

                ФАЗА 4: МАСШТАБИРОВАНИЕ (6-12 месяцев)
                [Аналогичная структура]

                Материалы: {materials}

                План должен быть максимально конкретным и измеримым.""",
            },
        }

    async def generate_document(
        self,
        doc_type: DocumentType,
        materials: str,
        settings: GenerationSettings,
        llama_client: LlamaClient,
    ) -> str:
        """Генерация документа определенного типа"""

        template = self.templates.get(doc_type, self.templates[DocumentType.EXECUTIVE_SUMMARY])

        # Подготовка промпта
        system_prompt = template["system"]
        user_prompt = template["prompt"].format(
            materials=materials[:30000]  # Ограничиваем размер
        )

        # Добавляем кастомные инструкции если есть
        if settings.custom_instructions:
            user_prompt += f"\n\nДополнительные требования:\n{settings.custom_instructions}"  # noqa: RUF001

        # Генерация через Llama
        response = await llama_client.generate(
            prompt=user_prompt, system=system_prompt, settings=settings, stream=False
        )

        # При stream=False generate всегда возвращает str
        if isinstance(response, str):
            return response
        # Если это AsyncGenerator (не должно быть при stream=False), собираем все части
        result = ""
        async for chunk in response:
            result += chunk
        return result

    def create_word_document(self, title: str, content: str, doc_type: DocumentType) -> bytes:
        """Создание Word документа"""
        doc = Document()

        # Настройка стилей
        self._setup_document_styles(doc)

        # Заголовок
        title_paragraph = doc.add_heading(title, 0)
        title_paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # Метаинформация
        doc.add_paragraph(f"Дата создания: {datetime.now(UTC).strftime('%d.%m.%Y %H:%M')}")
        doc.add_paragraph(f"Тип документа: {doc_type.value}")
        doc.add_page_break()

        # Обработка контента
        self._process_content_to_doc(doc, content)

        # Сохранение в буфер
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        return buffer.getvalue()

    def _setup_document_styles(self, doc: Document) -> None:
        """Настройка стилей документа"""
        # Настройка базового стиля
        style = doc.styles["Normal"]
        style.font.name = "Calibri"
        style.font.size = Pt(11)

        # Создание стиля для заголовков
        if "CustomHeading" not in doc.styles:
            heading_style = doc.styles.add_style("CustomHeading", WD_STYLE_TYPE.PARAGRAPH)
            heading_style.font.bold = True
            heading_style.font.size = Pt(14)
            heading_style.font.color.rgb = RGBColor(0, 0, 139)

    def _process_content_to_doc(self, doc: Document, content: str) -> None:
        """Обработка контента и добавление в документ"""
        lines = content.split("\n")

        for content_line in lines:
            line = content_line.strip()

            if not line:
                continue

            # Обработка заголовков
            if line.startswith("###"):
                doc.add_heading(line[3:].strip(), level=3)
            elif line.startswith("##"):
                doc.add_heading(line[2:].strip(), level=2)
            elif line.startswith("#"):
                doc.add_heading(line[1:].strip(), level=1)
            # Обработка списков
            elif line.startswith(("- ", "* ")):
                doc.add_paragraph(line[2:], style="List Bullet")
            elif re.match(r"^\d+\.", line):
                doc.add_paragraph(line, style="List Number")
            # Обычный параграф
            else:
                doc.add_paragraph(line)


# ========================================
# 🔍 БИЗНЕС АНАЛИЗАТОР
# ========================================


class BusinessAnalyzer:
    """Основной класс для анализа бизнеса"""

    def __init__(self) -> None:
        self.llama_client = LlamaClient()
        self.doc_processor = DocumentProcessor()
        self.doc_generator = DocumentGenerator()

    async def cleanup(self) -> None:
        """Cleanup resources (close aiohttp session)"""
        if self.llama_client and self.llama_client.session:
            await self.llama_client.session.close()

    def __del__(self) -> None:
        """Destructor - warn if session not closed"""
        if self.llama_client and self.llama_client.session and not self.llama_client.session.closed:
            warnings.warn(
                "BusinessAnalyzer destroyed without calling cleanup(). "
                "aiohttp session may leak. Call 'await analyzer.cleanup()' explicitly.",
                ResourceWarning,
                stacklevel=2,
            )

    async def analyze(
        self,
        session_id: str,
        request: GenerationRequest,
        background_tasks: BackgroundTasks | None = None,
    ) -> None:
        """Запуск анализа бизнеса"""

        try:
            # Создаем сессию
            await session_manager.create_session(session_id, request)

            # Запускаем анализ в фоне если нужно
            if background_tasks:
                background_tasks.add_task(self._run_analysis, session_id, request)
            else:
                await self._run_analysis(session_id, request)

        except (ValueError, RuntimeError, ConnectionError):  # fmt: skip
            logger.exception("Analysis error")
            raise

    async def _run_analysis(self, session_id: str, request: GenerationRequest) -> None:
        """Основная логика анализа"""

        start_time = datetime.now(UTC)
        total_steps = 4 + len(request.settings.document_types)
        current_step = 0

        try:
            # ========================================
            # ШАГ 1: ИЗВЛЕЧЕНИЕ ДАННЫХ
            # ========================================
            current_step += 1
            await self._update_progress(
                session_id,
                "extraction",
                "Извлечение данных",
                0,
                current_step,
                total_steps,
                "Начинаю извлечение данных из документов...",
            )

            materials = []
            for i, doc in enumerate(request.documents):
                # Проверка отмены
                session = session_manager.get_session(session_id)
                if session and session["cancel_event"].is_set():
                    return

                progress = int((i / len(request.documents)) * 100)
                await self._update_progress(
                    session_id,
                    "extraction",
                    "Извлечение данных",
                    progress,
                    current_step,
                    total_steps,
                    f"Обрабатываю документ: {doc.name}",
                )

                # Извлекаем содержимое
                content = await self.doc_processor.process_document(doc)
                materials.append(
                    {
                        "name": doc.name,
                        "type": doc.type,
                        "content": content,
                        "metadata": doc.metadata,
                    }
                )

            # Объединяем материалы
            combined_materials = self._combine_materials(materials)

            await self._update_progress(
                session_id,
                "extraction",
                "Извлечение данных",
                100,
                current_step,
                total_steps,
                "Данные успешно извлечены",
            )

            # ========================================
            # ШАГ 2: ПРЕДВАРИТЕЛЬНЫЙ АНАЛИЗ
            # ========================================
            current_step += 1
            await self._update_progress(
                session_id,
                "analysis",
                "Предварительный анализ",
                0,
                current_step,
                total_steps,
                "Анализирую бизнес-контекст...",
            )

            # Определяем контекст бизнеса
            business_context = await self._analyze_business_context(combined_materials, request.settings)

            await self._update_progress(
                session_id,
                "analysis",
                "Предварительный анализ",
                100,
                current_step,
                total_steps,
                "Контекст бизнеса определен",
            )

            # ========================================
            # ШАГ 3: ГЛУБОКИЙ АНАЛИЗ
            # ========================================
            current_step += 1
            depth_multiplier = {
                AnalysisDepth.BASIC: 1,
                AnalysisDepth.STANDARD: 2,
                AnalysisDepth.DEEP: 3,
                AnalysisDepth.EXPERT: 5,
            }.get(request.settings.analysis_depth, 3)

            await self._update_progress(
                session_id,
                "deep_analysis",
                "Глубокий анализ",
                0,
                current_step,
                total_steps,
                f"Выполняю {request.settings.analysis_depth.value} анализ...",
            )

            # Проводим анализ с выбранной глубиной  # noqa: RUF003
            analysis_results = await self._perform_deep_analysis(
                combined_materials,
                business_context,
                request.settings,
                depth_multiplier,
                lambda p, m: asyncio.create_task(
                    self._update_progress(
                        session_id,
                        "deep_analysis",
                        "Глубокий анализ",
                        p,
                        current_step,
                        total_steps,
                        m,
                    )
                ),
            )

            # ========================================
            # ШАГ 4: ГЕНЕРАЦИЯ ДОКУМЕНТОВ
            # ========================================
            generated_documents = []

            for doc_type in request.settings.document_types:
                current_step += 1

                await self._update_progress(
                    session_id,
                    "generation",
                    f"Генерация: {doc_type.value}",
                    0,
                    current_step,
                    total_steps,
                    f"Создаю документ: {doc_type.value}",
                )

                # Генерируем контент документа
                doc_content = await self.doc_generator.generate_document(
                    doc_type,
                    f"{combined_materials}\n\nANALYSIS:\n{analysis_results}",
                    request.settings,
                    self.llama_client,
                )

                # Создаем файлы в разных форматах
                for format_type in request.settings.output_formats:
                    if format_type == OutputFormat.WORD:
                        doc_bytes = self.doc_generator.create_word_document(
                            f"{doc_type.value} - {datetime.now(UTC).strftime('%Y%m%d')}",
                            doc_content,
                            doc_type,
                        )

                        # Сохраняем файл
                        file_name = f"{session_id}_{doc_type.value}.docx"
                        file_path = OUTPUT_DIR / file_name

                        async with aiofiles.open(file_path, "wb") as f:
                            await f.write(doc_bytes)

                        generated_documents.append(
                            {
                                "type": doc_type.value,
                                "format": "word",
                                "file_name": file_name,
                                "file_path": file_path,
                                "size": len(doc_bytes),
                            }
                        )

                await self._update_progress(
                    session_id,
                    "generation",
                    f"Генерация: {doc_type.value}",
                    100,
                    current_step,
                    total_steps,
                    f"Документ {doc_type.value} создан",
                )

            # ========================================
            # ФИНАЛИЗАЦИЯ
            # ========================================
            current_step += 1
            await self._update_progress(
                session_id,
                "finalization",
                "Завершение",
                50,
                current_step,
                total_steps,
                "Финанализация результатов...",
            )

            # Подсчет метрик
            end_time = datetime.now(UTC)
            generation_time = (end_time - start_time).total_seconds()

            session = session_manager.get_session(session_id)

            # Создаем результат
            result = GenerationResult(
                session_id=session_id,
                status="completed",
                documents=generated_documents,
                analysis_summary={
                    "business_context": business_context,
                    "key_findings": self._extract_key_findings(analysis_results),
                    "recommendations": self._extract_recommendations(analysis_results),
                },
                metrics={
                    "tokens_used": session.get("metrics", {}).get("tokens_used", 0)
                    if session and isinstance(session.get("metrics"), dict)
                    else 0,
                    "api_calls": session.get("metrics", {}).get("api_calls", 0)
                    if session and isinstance(session.get("metrics"), dict)
                    else 0,
                    "documents_processed": len(request.documents),
                    "documents_generated": len(generated_documents),
                },
                generation_time=generation_time,
                model_used=request.settings.model,
                tokens_used=session.get("metrics", {}).get("tokens_used", 0)
                if session and isinstance(session.get("metrics"), dict)
                else 0,
                timestamp=datetime.now(UTC).isoformat(),
            )

            # Сохраняем результат в сессию
            if session:
                session["results"] = result
                session["status"] = "completed"

            await self._update_progress(
                session_id,
                "finalization",
                "Завершение",
                100,
                current_step,
                total_steps,
                "Анализ успешно завершен!",
            )

            # Отправляем финальное уведомление
            await session_manager.broadcast_to_session(session_id, {"type": "complete", "data": result.model_dump()})

        except Exception as e:
            logger.exception("Analysis failed")

            # Обновляем статус сессии
            session = session_manager.get_session(session_id)
            if session:
                session["status"] = "failed"
                session["error"] = str(e)

            # Уведомляем об ошибке  # noqa: RUF003
            await session_manager.broadcast_to_session(session_id, {"type": "error", "data": {"error": str(e)}})

    async def _update_progress(
        self,
        session_id: str,
        stage: str,
        stage_name: str,
        progress: int,
        current_step: int,
        total_steps: int,
        message: str,
    ) -> None:
        """Обновление прогресса"""

        session = session_manager.get_session(session_id)
        if not session:
            return

        elapsed = (datetime.now(UTC) - session["start_time"]).total_seconds()

        # Оценка оставшегося времени
        if progress > 0:
            estimated_total = elapsed / (progress / 100)
            estimated_remaining = estimated_total - elapsed
        else:
            estimated_remaining = None

        progress_update = GenerationProgress(
            session_id=session_id,
            stage=stage,
            stage_name=stage_name,
            progress=progress,
            message=message,
            current_step=current_step,
            total_steps=total_steps,
            elapsed_time=elapsed,
            estimated_remaining=estimated_remaining,
        )

        await session_manager.update_progress(session_id, progress_update)

    def _combine_materials(self, materials: list[dict[str, Any]]) -> str:
        """Объединение материалов в единый текст"""
        combined = []

        for material in materials:
            combined.append(f"=== {material['name']} ({material['type']}) ===")
            combined.append(material["content"])
            combined.append("")

        return "\n".join(combined)

    async def _analyze_business_context(self, materials: str, settings: GenerationSettings) -> dict[str, Any]:
        """Анализ бизнес-контекста"""

        prompt = f"""Проанализируй предоставленные материалы и определи:

        1. Отрасль и тип бизнеса
        2. Размер компании (малый/средний/крупный)
        3. Стадия развития (стартап/рост/зрелость/спад)
        4. Основные продукты/услуги
        5. Целевая аудитория
        6. География деятельности
        7. Ключевые показатели если есть

        Материалы:
        {materials[:10000]}

        Ответ в формате JSON."""

        response = await self.llama_client.generate(
            prompt=prompt,
            system="Ты бизнес-аналитик. Извлекай только факты из материалов.",
            settings=settings,
        )

        # Parse JSON from response
        # При stream=False generate всегда возвращает str
        response_text: str
        if isinstance(response, str):
            response_text = response
        else:
            # Если это AsyncGenerator (не должно быть при stream=False), собираем все части
            response_text = ""
            async for chunk in response:
                response_text += chunk

        try:
            # Извлекаем JSON из ответа
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError, KeyError):  # fmt: skip
            logger.debug("Failed to extract JSON from response")

        return {"raw_analysis": response_text, "parsed": False}

    async def _perform_deep_analysis(
        self,
        materials: str,
        context: dict[str, Any],
        settings: GenerationSettings,
        depth_multiplier: int,
        progress_callback: Any,  # noqa: ANN401
    ) -> str:
        """Выполнение глубокого анализа"""

        analysis_prompts = [
            "Проведи SWOT-анализ бизнеса",
            "Проанализируй конкурентные преимущества и недостатки",
            "Оцени финансовое состояние и устойчивость",
            "Проанализируй операционную эффективность",
            "Выяви ключевые риски и возможности",
            "Предложи стратегии развития",
        ]

        # Ограничиваем количество промптов в зависимости от глубины
        prompts_to_use = analysis_prompts[: min(len(analysis_prompts), 2 * depth_multiplier)]

        results = []

        for i, prompt in enumerate(prompts_to_use):
            progress = int((i / len(prompts_to_use)) * 100)
            await progress_callback(progress, f"Анализ: {prompt[:50]}...")

            full_prompt = f"{prompt}\n\nКонтекст бизнеса:\n{json.dumps(context, ensure_ascii=False)}\n\nМатериалы:\n{materials[:15000]}"  # noqa: RUF001

            response = await self.llama_client.generate(
                prompt=full_prompt,
                system="Ты опытный бизнес-консультант. Проводи глубокий анализ на основе фактов.",
                settings=settings,
            )

            results.append(f"## {prompt}\n\n{response}")

        return "\n\n".join(results)

    def _extract_key_findings(self, analysis: str) -> list[str]:
        """Извлечение ключевых находок из анализа"""
        # Простая эвристика для извлечения ключевых пунктов
        findings = []

        for analysis_line in analysis.split("\n"):
            stripped_line = analysis_line.strip()
            if (
                any(keyword in stripped_line.lower() for keyword in ["ключев", "важн", "критич", "основн"])
                and len(stripped_line) > MIN_LINE_LENGTH
                and len(stripped_line) < MAX_LINE_LENGTH
            ):
                findings.append(stripped_line)

        return findings[:10]  # Топ-10 находок

    def _extract_recommendations(self, analysis: str) -> list[str]:
        """Извлечение рекомендаций из анализа"""
        recommendations = []

        for analysis_line in analysis.split("\n"):
            stripped_line = analysis_line.strip()
            if (
                any(
                    keyword in stripped_line.lower()
                    for keyword in [
                        "рекоменд",
                        "следует",
                        "необходим",
                        "важно",
                        "нужно",
                    ]
                )
                and len(stripped_line) > MIN_LINE_LENGTH
                and len(stripped_line) < MAX_LINE_LENGTH
            ):
                recommendations.append(stripped_line)

        return recommendations[:10]  # Топ-10 рекомендаций


# ========================================
# 🚀 API ENDPOINTS
# ========================================


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Проверка здоровья сервиса"""
    llama_status = "unknown"

    try:
        async with LlamaClient() as client:
            models = await client.list_models()
            llama_status = "healthy" if models else "no_models"
    except (ConnectionError, TimeoutError, aiohttp.ClientError):  # fmt: skip
        llama_status = "unavailable"

    return {
        "status": "healthy",
        "llama_status": llama_status,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/models")
async def get_available_models() -> dict[str, Any]:
    """Получение списка доступных моделей Llama"""
    try:
        async with LlamaClient() as client:
            models = await client.list_models()

            # Форматируем для фронтенда
            formatted_models = []
            for model in models:
                params = model.get("parameters", {})
                formatted_models.append(
                    {
                        "name": model["name"],
                        "size": f"{model.get('size', 0) / (1024**3):.1f}GB" if model.get("size") else "Unknown",
                        "quality": params.get("quality", 80),
                        "speed": params.get("speed", 80),
                        "description": params.get("description", ""),
                        "capabilities": params.get("capabilities", []),
                        "recommended_settings": {
                            "temperature": params.get("recommended_temp", 0.8),
                            "max_tokens": params.get("recommended_tokens", 8000),
                        },
                    }
                )

            return {"models": formatted_models, "count": len(formatted_models)}

    except (ConnectionError, TimeoutError, aiohttp.ClientError) as e:
        logger.exception("Error fetching models")
        raise HTTPException(status_code=500, detail=str(e)) from e
    # Все пути выполнения покрыты: либо return, либо raise
    # Type checker требует явный return, хотя raise всегда выбрасывает исключение
    return {}  # Never reached, but satisfies type checker


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)) -> dict[str, Any]:  # noqa: B008
    """Загрузка файлов для анализа"""
    uploaded_files = []

    for file in files:
        try:
            # Проверка размера
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(  # noqa: TRY301
                    status_code=413,
                    detail=f"Файл {file.filename} превышает лимит {MAX_FILE_SIZE / 1024 / 1024}MB",
                )

            # Проверка типа файла
            if file.filename is None:
                raise HTTPException(status_code=400, detail="Filename is required")  # noqa: TRY301
            file_path_obj = Path(file.filename)
            file_ext = file_path_obj.suffix.lower()
            if file_ext not in ALLOWED_FILE_TYPES:
                raise HTTPException(  # noqa: TRY301
                    status_code=415,
                    detail=f"Тип файла {file_ext} не поддерживается",
                )

            # Сохранение файла
            file_id = str(uuid.uuid4())
            file_path = UPLOAD_DIR / f"{file_id}{file_ext}"

            async with aiofiles.open(file_path, "wb") as f:
                await f.write(content)

            # Определение типа
            file_type = "txt"
            if file_ext == ".pdf":
                file_type = "pdf"
            elif file_ext in [".doc", ".docx"]:
                file_type = "word"

            uploaded_files.append(
                {
                    "id": file_id,
                    "name": file.filename,
                    "type": file_type,
                    "path": file_path,
                    "size": len(content),
                    "extension": file_ext,
                }
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Upload error for %s", file.filename)
            raise HTTPException(status_code=500, detail=f"Ошибка загрузки {file.filename}: {e!s}") from e

    return {"uploaded_files": uploaded_files}


@router.post("/generate")
async def start_generation(request: GenerationRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Запуск генерации бизнес-анализа"""

    try:
        # Валидация запроса
        if not request.documents:
            raise HTTPException(
                status_code=400,
                detail="Необходим хотя бы один документ для анализа",
            )

        if not request.session_id:
            request.session_id = str(uuid.uuid4())

        # Создаем анализатор
        analyzer = BusinessAnalyzer()

        # Запускаем анализ
        await analyzer.analyze(session_id=request.session_id, request=request, background_tasks=background_tasks)

        return {
            "session_id": request.session_id,
            "status": "started",
            "message": "Анализ запущен",
            "estimated_time": 60 * len(request.settings.document_types),  # секунд
        }

    except (ValueError, RuntimeError, ConnectionError) as e:
        logger.exception("Generation start error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/session/{session_id}/status")
async def get_session_status(session_id: str) -> dict[str, Any]:
    """Получение статуса сессии"""

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    progress_data = None
    if session.get("progress"):
        progress_data = session["progress"].model_dump()

    start_time = session.get("start_time")
    return {
        "session_id": session_id,
        "status": session.get("status", "unknown"),
        "progress": progress_data,
        "results": session.get("results"),
        "error": session.get("error"),
        "start_time": start_time.isoformat() if start_time is not None else None,
        "metrics": session.get("metrics"),
    }


@router.post("/session/{session_id}/cancel")
async def cancel_session(session_id: str) -> dict[str, Any]:
    """Отмена сессии генерации"""

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    await session_manager.cancel_session(session_id)

    return {"session_id": session_id, "status": "cancelled", "message": "Сессия отменена"}


@router.get("/download/{session_id}/{file_name}")
async def download_file(session_id: str, file_name: str) -> FileResponse:  # noqa: ARG001
    """Скачивание сгенерированного файла"""

    file_path = OUTPUT_DIR / file_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Определяем MIME тип
    mime_type = "application/octet-stream"
    if file_name.endswith(".docx"):
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif file_name.endswith(".pdf"):
        mime_type = "application/pdf"

    return FileResponse(path=file_path, filename=file_name, media_type=mime_type)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    """WebSocket для отслеживания прогресса генерации"""

    await websocket.accept()
    await session_manager.add_websocket(session_id, websocket)

    try:
        # Отправляем текущий статус
        session = session_manager.get_session(session_id)
        if session:
            progress_data = None
            if session.get("progress"):
                progress_data = session["progress"].model_dump()

            await websocket.send_json(
                {
                    "type": "status",
                    "data": {
                        "status": session.get("status", "unknown"),
                        "progress": progress_data,
                    },
                }
            )

        # Держим соединение открытым
        while True:
            data = await websocket.receive_text()

            # Обработка команд от клиента
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        await session_manager.remove_websocket(session_id, websocket)


@router.delete("/cleanup")
async def cleanup_old_files() -> dict[str, Any]:
    """Очистка старых файлов"""

    try:
        cutoff_time = datetime.now(UTC) - timedelta(hours=24)
        cleaned = {"uploads": 0, "outputs": 0, "cache": 0}

        # Очистка загруженных файлов
        for file_path in UPLOAD_DIR.iterdir():
            if file_path.is_file() and file_path.stat().st_ctime < cutoff_time.timestamp():
                file_path.unlink()
                cleaned["uploads"] += 1

        # Очистка выходных файлов
        for file_path in OUTPUT_DIR.iterdir():
            if file_path.is_file() and file_path.stat().st_ctime < cutoff_time.timestamp():
                file_path.unlink()
                cleaned["outputs"] += 1

        # Очистка кеша
        if CACHE_DIR.exists():
            shutil.rmtree(CACHE_DIR)
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cleaned["cache"] = 1

        return {
            "status": "success",
            "cleaned": cleaned,
            "message": f"Очищено: uploads={cleaned['uploads']}, outputs={cleaned['outputs']}",
        }

    except OSError as e:
        logger.exception("Cleanup error")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# 📝 ИНИЦИАЛИЗАЦИЯ
# ========================================

logger.info("AI Business Generator API initialized")
logger.info("Llama URL: %s", LLAMA_BASE_URL)
logger.info("Upload dir: %s", UPLOAD_DIR)
logger.info("Output dir: %s", OUTPUT_DIR)
