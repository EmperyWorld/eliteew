# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Backend module `services/ugs/providers/miso_provider.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
MISO Provider for UGS — маркетинговые исследования (шаблон с разделами, SearXNG при необходимости).

ИМК «Заполнитель» (imc_cabinet_filler) идёт через отдельный провайдер `imc_cabinet_filler_provider`, не через этот класс.
"""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.search_service import (
    BEZ_SEARX_QUERY_MAX_CHARS,
    WebSearchQuotaExceededError,
    _condense_search_query,
    format_search_results_for_prompt,
    web_search,
)
from api.utils.llm_openai_compat_http import httpx_compat_generate_json
from api.utils.llm_wall_clock_context import llm_wall_clock_system_section

HTTP_STATUS_OK = 200

logger = logging.getLogger(__name__)


def _truthy_vector_only(value: Any) -> bool:
    return value is True or (isinstance(value, str) and value.strip().lower() in ("true", "1", "yes"))


class MISOProvider:
    """Marketing research via Llama; не используется для imc_cabinet_filler."""

    def __init__(self, llama_base_url: str = "http://stack2-llama-chat:8080"):
        self.llama_base_url = llama_base_url.rstrip("/")
        self.client = None
        self.timeout = httpx.Timeout(120.0, connect=10.0, read=60.0)
        self.max_retries = 2
        self.retry_delay = 1.0

    async def initialize(self) -> None:
        if self.client:
            logger.info("MISO provider already initialized")
            return
        try:
            self.client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10, keepalive_expiry=30.0),
                follow_redirects=True,
            )
            logger.info("MISO provider initialized with Llama backend at %s", self.llama_base_url)
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
            logger.exception("Failed to initialize MISO provider")
            raise

    async def close(self) -> None:
        if self.client:
            try:
                async with asyncio.timeout(5.0):
                    await self.client.aclose()
            except TimeoutError:
                logger.warning("Timeout closing MISO client")
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
                logger.exception("Error closing MISO client")
            finally:
                self.client = None
                logger.info("MISO provider closed")

    async def generate(
        self,
        input_data: dict[str, Any],
        *,
        db: Any | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        if not self.client:
            await self.initialize()

        try:
            research_query = input_data.get("research_query", "")
            location = input_data.get("location", "")
            research_type = input_data.get("research_type", "business")
            industry = input_data.get("industry", "")
            target_audience = input_data.get("target_audience", "")
            goals = input_data.get("goals", [])
            extra_instructions = input_data.get("prompt_instructions")
            if not isinstance(extra_instructions, str):
                extra_instructions = None

            if _truthy_vector_only(input_data.get("imc_vector_only")) or input_data.get("use_web_search") is not True:
                web_context = ""
            else:
                web_context = await self._imc_websearch_context(input_data, db=db, user_id=user_id)
            project_rag = input_data.get("marketing_project_rag_context")
            if not isinstance(project_rag, str):
                project_rag = ""

            model = input_data.get("model", unified_settings.bi_ai_model)

            prompt = self._build_research_prompt(
                research_query=research_query,
                location=location,
                research_type=research_type,
                industry=industry,
                target_audience=target_audience,
                goals=goals,
                extra_instructions=extra_instructions,
                project_document_rag=project_rag,
                web_context=web_context,
            )
            logger.info("MISO: Generating %s research for: %s", research_type, str(research_query)[:100])

            if not self.client:
                msg = "MISO provider client not initialized"
                raise RuntimeError(msg)  # noqa: TRY301
            result = await httpx_compat_generate_json(
                self.client,
                self.llama_base_url,
                model=model,
                prompt=prompt,
                system=None,
                options={"temperature": 0.7, "num_predict": 4000},
                json_format=False,
                keep_alive=None,
                timeout=httpx.Timeout(180.0, connect=10.0),
            )
            generated_text = result.get("response", "")

            if not generated_text:
                logger.warning("Empty response from MISO generation")
                msg = "Empty response from MISO generation"
                raise RuntimeError(msg)  # noqa: TRY301

            logger.info("MISO: Generated %s chars for research", len(generated_text))

            return {
                "content": generated_text,
                "model": model,
                "research_type": research_type,
                "research_query": research_query,
                "location": location,
                "metadata": {
                    "provider": "miso",
                    "backend": "llama",
                    "generation_time": datetime.now(UTC).isoformat(),
                    "goals": goals,
                    "industry": industry,
                    "target_audience": target_audience,
                    "imc_web_search": bool(web_context),
                },
            }

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, RuntimeError) as e:
            logger.exception("MISO generation error")
            msg = f"MISO generation failed: {e}"
            raise RuntimeError(msg) from e

    async def _imc_websearch_context(
        self,
        input_data: dict[str, Any],
        *,
        db: Any | None,
        user_id: str | None,
    ) -> str:
        if db is None or not user_id:
            logger.debug("[STEP] imc.miso.web_search_skip reason=missing_user_context")
            return ""
        if _truthy_vector_only(input_data.get("imc_vector_only")):
            return ""
        if not input_data.get("imc_type_key"):
            return ""
        raw = str(input_data.get("research_query") or "").strip()
        if not raw:
            return ""
        sq = _condense_search_query(raw)
        if len(sq) < 6:
            sq = raw[:BEZ_SEARX_QUERY_MAX_CHARS].strip()
        sq = sq[:BEZ_SEARX_QUERY_MAX_CHARS]
        if len(sq) < 8:
            return ""
        try:
            hits = await web_search(sq, limit=8, user_id=user_id, db=db, surface="marketing")
        except WebSearchQuotaExceededError as e:
            logger.info("MISO IMC web search quota denied: %s remaining", e.status.total_remaining)
            return ""
        except Exception as e:
            logger.warning("MISO IMC web search failed: %s", e)
            return ""
        if not hits:
            return ""
        block = format_search_results_for_prompt(hits, max_total_chars=2200)
        logger.info("[STEP] imc.miso.searx query=%s hits=%s", sq[:100], len(hits))
        return block

    def _build_research_prompt(
        self,
        research_query: str,
        location: str,
        research_type: str,
        industry: str,
        target_audience: str,
        goals: list[str],
        *,
        extra_instructions: str | None = None,
        project_document_rag: str = "",
        web_context: str = "",
    ) -> str:
        prompt_parts = [
            llm_wall_clock_system_section(),
            "Ты — аналитик маркетинговых исследований (MISO).",
            "",
            "**Не отказывайся от задания и не проси пользователя прислать файлы, URL или дополнительный контекст.** "
            "Все входные данные уже в этом сообщении (бриф, фрагменты документов, веб-поиск при наличии). "
            "Если информации мало — выполни разделы по возможности и явно отметь пробелы в тексте.",
            "",
            "**Язык ответа: только русский.** Пиши весь развёрнутый текст на русском: заголовки разделов, списки, выводы. "
            "Только имена собственных брендов, устоявшиеся термины или цитаты при необходимости можно оставить на языке оригинала.",
            "",
            "# Маркетинговое исследование (MISO)",
            "",
            f"## Тип задания: {research_type}",
            "",
            "## Исследовательский запрос / контекст:",
            research_query,
            "",
        ]

        if extra_instructions and extra_instructions.strip():
            prompt_parts.extend(["## Акцент (по типу исследования):", extra_instructions.strip(), ""])

        if location:
            prompt_parts.extend(["## Регион / рынок:", location, ""])

        if industry:
            prompt_parts.extend(["## Отрасль:", industry, ""])

        if target_audience:
            prompt_parts.extend(["## Целевая аудитория:", target_audience, ""])

        if goals:
            prompt_parts.extend(["## Цели исследования:", *[f"- {goal}" for goal in goals], ""])

        if project_document_rag.strip():
            prompt_parts.extend(
                [
                    "## Фрагменты из документов проекта (семантический поиск)",
                    "Используй как опорные факты из материалов проекта; при противоречии с веб-поиском укажи расхождение.",
                    project_document_rag.strip(),
                    "",
                ]
            )

        if web_context.strip():
            prompt_parts.extend(
                [
                    "## Срез из веб-поиска (SearXNG)",
                    "Используй как фактуру и ориентиры; если бриф или прикреплённые материалы расходятся с выдачей, укажи это явно.",
                    web_context.strip(),
                    "",
                ]
            )

        prompt_parts.extend(
            [
                "## Структура ответа (выполни на русском):",
                "1. Краткое резюме",
                "2. Обзор рынка и тренды",
                "3. Конкурентная среда",
                "4. Инсайты по целевой аудитории",
                "5. Ключевые возможности и риски",
                "6. Стратегические рекомендации",
                "",
                "Оформи ответ с понятными подзаголовками и практичными выводами.",
                "",
                "# Анализ:",
            ]
        )

        return "\n".join(prompt_parts)

    async def health_check(self) -> bool:
        if not self.client:
            return False
        try:
            response = await self.client.get(f"{self.llama_base_url}/api/tags", timeout=httpx.Timeout(5.0))
            return response.status_code == HTTP_STATUS_OK
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
            logger.exception("MISO health check failed")
            return False

    def get_provider_info(self) -> dict[str, Any]:
        return {
            "name": "miso",
            "display_name": "MISO (Marketing Intelligence & Strategic Operations)",
            "backend": "llama",
            "version": "1.0.0",
            "capabilities": [
                "market_research",
                "competitive_analysis",
                "strategic_planning",
                "industry_insights",
                "audience_profiling",
            ],
            "supported_types": [
                "marketing_research_creator",
                "imc_* (кроме imc_cabinet_filler)",
                "business_analysis",
                "market_analysis",
            ],
        }
