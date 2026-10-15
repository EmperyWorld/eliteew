#!/usr/bin/env python3
"""
🤖 LLAMA AI SERVICE - Production-Ready Business Intelligence
Специализированный AI сервис для бизнес-анализа

Features:
✅ Multiple model support with automatic selection
✅ Streaming and non-streaming responses
✅ Context-aware prompts
✅ Temperature/parameter optimization
✅ Token usage tracking
✅ Retry logic with exponential backoff
"""

import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.utils.llm_openai_compat_http import (
    aiohttp_compat_generate_json,
    aiohttp_compat_generate_text_stream,
)

logger = logging.getLogger(__name__)


class LlamaAIService:
    """Production-ready Llama AI service for business analysis"""

    FALLBACK_MODELS = (
        "rscr/vikhr_llama3.1_8b:Q4_K_M",
        "qwen3.5:9b",
        "qwen2.5:14b",
        "qwen2.5:7b",
    )

    def __init__(self, llama_url: str = "http://stack2-llama-chat:8080"):
        """
        Initialize Llama AI service

        Args:
            llama_url: Llama server URL
        """
        self.llama_url = llama_url
        self.session: aiohttp.ClientSession | None = None
        self.default_model = unified_settings.bi_ai_model or unified_settings.default_ai_model
        self.fallback_models = tuple(
            dict.fromkeys(
                [
                    self.default_model,
                    unified_settings.default_ai_model,
                    "rscr/vikhr_llama3.1_8b:Q4_K_M",
                    "qwen3.5:9b",
                    "qwen2.5:14b",
                    "qwen2.5:7b",
                ]
            )
        )

        # Model configurations (updated to match available models)
        # Вариант A (исторический, под Qwen 3.5 9B, когда она была primary):
        # self.MODEL_CONFIGS = {
        #     "qwen3.5:9b": {
        #         "name": "Qwen 3.5 9B",
        #         "quality": 90,
        #         "speed": 95,
        #         "best_for": "deep_analysis",
        #         "description": "🔥 Топовая модель для глубокого бизнес-анализа (Qwen 3.5 9B через Llama)",
        #         "default_temp": 0.8,
        #         # BI-ответы короче чата: держим лимит 16k, чтобы не упираться в контекст.
        #         "max_tokens": 16000,
        #         "capabilities": [
        #             "analysis",
        #             "strategy",
        #             "financial",
        #             "marketing",
        #             "swot",
        #         ],
        #     }
        # }
        #
        # Вариант B (актуальный, под rscr/vikhr_llama3.1_8b:Q4_K_M без thinking, быстрый и с длинным контекстом):
        self.MODEL_CONFIGS = {
            "rscr/vikhr_llama3.1_8b:Q4_K_M": {
                "name": "Vikhr Llama 3.1 8B (Q4_K_M)",
                "quality": 85,
                "speed": 98,
                "best_for": "deep_analysis",
                "description": "Быстрая модель Vikhr Llama 3.1 8B (Q4_K_M) через Llama, без thinking, с длинным контекстом.",
                "default_temp": 0.8,
                "max_tokens": 16000,
                "capabilities": [
                    "analysis",
                    "strategy",
                    "financial",
                    "marketing",
                    "swot",
                ],
            }
        }

        # Analysis-specific prompts
        self.SYSTEM_PROMPTS = {
            "executive_summary": """Ты - эксперт бизнес-аналитик, специализирующийся на создании Executive Summary.
Твоя задача - создать краткое, но исчерпывающее резюме для руководителей высшего звена.
Фокусируйся на ключевых выводах, критических факторах успеха и рекомендациях.""",
            "detailed_analysis": """Ты - старший бизнес-аналитик с 15+ летним опытом.
Твоя задача - провести глубокий детальный анализ, охватывающий все аспекты бизнеса.
Используй структурированный подход, данные и обоснованные рекомендации.""",
            "swot_analysis": """Ты - эксперт по стратегическому анализу, специалист SWOT-анализа.
Твоя задача - выявить сильные/слабые стороны, возможности и угрозы.
Будь конкретен, используй примеры, предлагай действенные рекомендации.""",
            "competitive_analysis": """Ты - эксперт по конкурентному анализу рынков.
Твоя задача - проанализировать конкурентную среду, позиционирование, преимущества.
Используй фреймворки: Porter's 5 Forces, конкурентная матрица, Blue Ocean Strategy.""",
            "financial_projection": """Ты - финансовый аналитик и эксперт по бизнес-планированию.
Твоя задача - создать реалистичные финансовые прогнозы и модели.
Используй стандартные метрики: ROI, NPV, IRR, Payback Period, Unit Economics.""",
            "marketing_strategy": """Ты - маркетинг-стратег с опытом в digital и traditional каналах.
Твоя задача - разработать комплексную маркетинговую стратегию.
Включи: целевая аудитория, каналы, positioning, messaging, metrics (CAC, LTV).""",
            "action_plan": """Ты - эксперт по операционному управлению и реализации стратегий.
Твоя задача - создать конкретный, реализуемый план действий.
Используй SMART-цели, timeline, ресурсы, ответственных, KPI.""",
            "risk_assessment": """Ты - эксперт по управлению рисками и бизнес-безопасности.
Твоя задача - выявить, оценить и предложить митигацию рисков.
Используй матрицу рисков, вероятность/impact, превентивные меры.""",
        }

    async def __aenter__(self):
        """Async context manager entry"""
        await self.ensure_session()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        """Async context manager exit"""
        await self.close()

    async def ensure_session(self) -> None:
        """Ensure HTTP session is active (uses central client)."""
        if not self.session:
            from api.core.http_clients import get_aiohttp_session

            self.session = get_aiohttp_session()

    async def close(self) -> None:
        """Central session is closed at app shutdown; just clear ref."""
        self.session = None

    async def health_check(self) -> bool:
        """Check if Llama server is available"""
        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Llama session"
                raise RuntimeError(msg)
            base = self.llama_url.rstrip("/")
            for path in ("/v1/models", "/api/tags"):
                async with self.session.get(f"{base}{path}") as response:
                    if response.status == 200:
                        logger.info("LLM server is healthy: %s", self.llama_url)
                        return True
            logger.warning("LLM server returned non-200")
            return False
        except Exception:
            logger.exception("Llama health check failed")
            return False

    async def list_models(self) -> list[dict[str, Any]]:
        """
        Get list of available models

        Returns:
            List of model info dicts
        """
        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Llama session"
                raise RuntimeError(msg)
            base = self.llama_url.rstrip("/")
            data = None
            raw_list = []
            key = ""
            for path, k in (("/v1/models", "data"), ("/api/tags", "models")):
                key = k
                async with self.session.get(f"{base}{path}") as response:
                    if response.status == 200:
                        data = await response.json()
                        raw_list = data.get(key, [])
                        break
            if not data or not raw_list:
                return []
            models = []
            if key == "data":  # vLLM: data[].id
                for m in raw_list:
                    name = m.get("id", "")
                    if name:
                        config = self.MODEL_CONFIGS.get(
                            name.split(":")[0] if ":" in name else name,
                            {
                                "name": name,
                                "quality": 80,
                                "speed": 80,
                                "best_for": "general",
                                "description": "AI модель",
                            },
                        )
                        models.append({"name": name, **config})
            else:
                for model in raw_list:
                    model_name = model.get("name", "")
                    # Get config or use defaults
                    config = self.MODEL_CONFIGS.get(
                        model_name,
                        {
                            "name": model_name,
                            "quality": 80,
                            "speed": 80,
                            "best_for": "general",
                            "description": "AI модель для анализа",
                            "default_temp": 0.7,
                            "max_tokens": 8000,
                            "capabilities": ["general"],
                        },
                    )
                    models.append(
                        {
                            "name": model_name,
                            "display_name": config.get("name", model_name),
                            "size": model.get("size", 0),
                            "quality": config.get("quality", 80),
                            "speed": config.get("speed", 80),
                            "description": config.get("description", ""),
                            "best_for": config.get("best_for", "general"),
                            "capabilities": config.get("capabilities", []),
                            "default_temp": config.get("default_temp", 0.7),
                            "max_tokens": config.get("max_tokens", 8000),
                        }
                    )
            return models

        except Exception:
            logger.exception("Failed to list models")
            return []

    async def generate_business_analysis(
        self,
        analysis_type: str,
        content: str,
        context: str = "",
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 8000,
        stream: bool = False,
        custom_instructions: str = "",
        **kwargs,
    ) -> dict[str, Any] | AsyncGenerator:
        """
        Generate business analysis

        Args:
            analysis_type: Type of analysis (executive_summary, swot_analysis, etc.)
            content: Document content to analyze
            context: Additional context
            model: Model to use
            temperature: Temperature for generation
            max_tokens: Max tokens to generate
            stream: Enable streaming
            custom_instructions: Custom instructions for AI
            **kwargs: Additional generation parameters

        Returns:
            Analysis result dict or AsyncGenerator for streaming
        """
        # Get system prompt for analysis type
        system_prompt = self.SYSTEM_PROMPTS.get(
            analysis_type,
            "Ты - опытный бизнес-аналитик. Проведи тщательный анализ предоставленных данных.",
        )

        # Add custom instructions if provided
        if custom_instructions:
            system_prompt += f"\n\nДополнительные инструкции: {custom_instructions}"

        # Build user prompt
        user_prompt = self._build_analysis_prompt(analysis_type, content, context)

        # Generate
        return await self.generate(
            prompt=user_prompt,
            system=system_prompt,
            model=model or self.default_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            **kwargs,
        )

    def _build_analysis_prompt(self, analysis_type: str, content: str, context: str = "") -> str:
        """Build analysis-specific prompt"""

        base_prompt = f"""Проанализируй следующие данные и создай {self._get_analysis_type_name(analysis_type)}:

"""

        if context:
            base_prompt += f"**Контекст:**\n{context}\n\n"

        base_prompt += f"""**Данные для анализа:**
{content}

**Требования к выходу:**
{self._get_output_requirements(analysis_type)}

Проведи тщательный анализ и предоставь структурированный результат."""

        return base_prompt

    def _get_analysis_type_name(self, analysis_type: str) -> str:
        """Get human-readable analysis type name"""
        names = {
            "executive_summary": "Executive Summary",
            "detailed_analysis": "Детальный бизнес-анализ",
            "swot_analysis": "SWOT-анализ",
            "competitive_analysis": "Конкурентный анализ",
            "financial_projection": "Финансовые прогнозы",
            "marketing_strategy": "Маркетинговую стратегию",
            "action_plan": "План действий",
            "risk_assessment": "Оценку рисков",
        }
        return names.get(analysis_type, "Бизнес-анализ")

    def _get_output_requirements(self, analysis_type: str) -> str:
        """Get output format requirements for analysis type"""
        requirements = {
            "executive_summary": """
- Краткое резюме (2-3 параграфа)
- Ключевые выводы (3-5 пунктов)
- Критические рекомендации (топ-3)
- Приоритетные действия""",
            "swot_analysis": """
- Сильные стороны (Strengths): минимум 5 пунктов
- Слабые стороны (Weaknesses): минимум 5 пунктов
- Возможности (Opportunities): минимум 5 пунктов
- Угрозы (Threats): минимум 5 пунктов
- Стратегические рекомендации на основе SWOT""",
            "competitive_analysis": """
- Обзор конкурентной среды
- Анализ основных конкурентов (топ 3-5)
- Конкурентные преимущества и недостатки
- Позиционирование на рынке
- Рекомендации по конкурентной стратегии""",
            "financial_projection": """
- Ключевые финансовые метрики
- Прогноз выручки (3-5 лет)
- Структура затрат
- Точка безубыточности
- ROI и окупаемость
- Финансовые риски""",
            "marketing_strategy": """
- Целевая аудитория (сегменты, персоны)
- Позиционирование и УТП
- Маркетинговые каналы
- Тактики и активности
- Бюджет и метрики (CAC, LTV, ROMI)
- Roadmap реализации""",
            "action_plan": """
- SMART-цели
- Конкретные задачи с дедлайнами
- Ответственные исполнители
- Необходимые ресурсы
- KPI и метрики успеха
- Риски и митигация""",
            "risk_assessment": """
- Классификация рисков
- Вероятность и impact
- Матрица рисков
- Превентивные меры
- План реагирования
- Мониторинг и контроль""",
        }

        return requirements.get(analysis_type, "Структурированный анализ с конкретными выводами и рекомендациями")

    async def generate(
        self,
        prompt: str,
        system: str = "",
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 8000,
        top_p: float = 0.95,
        top_k: int = 40,
        stream: bool = False,
        **kwargs,
    ) -> dict[str, Any] | AsyncGenerator:
        """
        Generate text using Llama

        Args:
            prompt: User prompt
            system: System prompt
            model: Model name
            temperature: Temperature (0-2)
            max_tokens: Max tokens to generate
            top_p: Top-p sampling
            top_k: Top-k sampling
            stream: Enable streaming
            **kwargs: Additional parameters

        Returns:
            Generation result or AsyncGenerator for streaming
        """
        await self.ensure_session()
        if self.session is None:
            msg = "Failed to establish Llama session"
            raise RuntimeError(msg)

        payload = {
            "model": model or self.default_model,
            "prompt": prompt,
            "system": system,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "top_p": top_p,
                "top_k": top_k,
                **kwargs.get("options", {}),
            },
        }

        if stream:
            return self._generate_stream(payload)
        return await self._generate_non_stream(payload)

    async def _generate_non_stream(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Non-streaming generation"""
        if self.session is None:
            msg = "Session not established. Call ensure_session() first."
            raise RuntimeError(msg)
        try:
            start_time = datetime.now(UTC)
            opts = dict(payload.get("options") or {})
            system_raw = payload.get("system") or ""
            system = system_raw if isinstance(system_raw, str) and system_raw.strip() else None
            result = await aiohttp_compat_generate_json(
                self.session,
                self.llama_url,
                model=payload["model"],
                prompt=payload["prompt"],
                system=system,
                options=opts,
                json_format=False,
                keep_alive=unified_settings.llama_keep_alive,
                timeout=aiohttp.ClientTimeout(total=600, sock_connect=30),
            )

            generation_time = (datetime.now(UTC) - start_time).total_seconds()
            eval_count = int(result.get("eval_count") or 0)

            return {
                "text": result.get("response", ""),
                "model": result.get("model", payload["model"]),
                "tokens_generated": eval_count,
                "tokens_prompt": int(result.get("prompt_eval_count") or 0),
                "generation_time": generation_time,
                "tokens_per_second": eval_count / generation_time if generation_time > 0 else 0,
                "success": True,
                "error": None,
            }

        except RuntimeError as e:
            err_s = str(e).lower()
            if "404" in str(e) or "not found" in err_s:
                fallback_model = await self._resolve_fallback_model(str(payload.get("model") or ""))
                if fallback_model:
                    logger.warning(
                        "BI Llama model %s not available, retrying with %s",
                        payload.get("model"),
                        fallback_model,
                    )
                    retry_payload = dict(payload)
                    retry_payload["model"] = fallback_model
                    return await self._generate_non_stream(retry_payload)
            logger.error("Llama generation failed: %s", e)
            return self._error_response(str(e))
        except TimeoutError:
            logger.exception("Llama generation timeout")
            return self._error_response("Generation timeout")
        except Exception as e:
            logger.exception("Llama generation error")
            return self._error_response(str(e))

    async def _generate_stream(self, payload: dict[str, Any]) -> AsyncGenerator:
        """Streaming generation"""
        if self.session is None:
            msg = "Session not established. Call ensure_session() first."
            raise RuntimeError(msg)
        try:
            opts = dict(payload.get("options") or {})
            system_raw = payload.get("system") or ""
            system = system_raw if isinstance(system_raw, str) and system_raw.strip() else None
            model = payload["model"]
            async for piece in aiohttp_compat_generate_text_stream(
                self.session,
                self.llama_url,
                model=model,
                prompt=payload["prompt"],
                system=system,
                options=opts,
                timeout=aiohttp.ClientTimeout(total=600, sock_connect=30),
            ):
                if piece:
                    yield {"text": piece, "done": False, "model": model, "success": True}
            yield {"text": "", "done": True, "model": model, "success": True}

        except Exception as e:
            logger.exception("Llama stream error")
            yield self._error_response(str(e))

    def _error_response(self, error: str) -> dict[str, Any]:
        """Generate standardized error response"""
        return {
            "text": "",
            "model": "",
            "tokens_generated": 0,
            "tokens_prompt": 0,
            "generation_time": 0,
            "tokens_per_second": 0,
            "success": False,
            "error": error,
        }

    async def _resolve_fallback_model(self, requested_model: str) -> str | None:
        available_models = [model.get("name", "") for model in await self.list_models()]
        available_models = [name for name in available_models if name and name != requested_model]
        for candidate in self.fallback_models:
            if candidate in available_models:
                return candidate
        return available_models[0] if available_models else None

    def select_best_model_for_analysis(self, analysis_type: str, depth: str = "deep") -> str:
        """
        Select best model based on analysis type and depth

        Args:
            analysis_type: Type of analysis
            depth: Analysis depth (basic, standard, deep, expert)

        Returns:
            Recommended model name
        """
        # Depth to model mapping (single base model for now)
        depth_models = {
            "basic": self.default_model,
            "standard": self.default_model,
            "deep": self.default_model,
            "expert": self.default_model,
        }

        return depth_models.get(depth, self.default_model)
