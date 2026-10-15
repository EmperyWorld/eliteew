"""
ИМК «Заполнитель» — отдельный провайдер UGS (не MISO).

Только векторные фрагменты проекта → JSON по разделам кабинета. Без SearXNG и без шаблона «маркетинговое исследование».
"""

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.utils.llm_openai_compat_http import httpx_compat_generate_json

logger = logging.getLogger(__name__)

_CABINET_FILLER_JSON_KEYS: tuple[str, ...] = (
    "project_description",
    "project_goals",
    "project_key_tasks",
    "jtbd",
    "value_propositions",
    "swot",
    "competitors",
    "researches",
    "segments",
    "campaigns",
    "funnels",
    "tasks",
    "alerts",
)


def empty_cabinet_filler_json() -> str:
    return json.dumps({k: None for k in _CABINET_FILLER_JSON_KEYS}, ensure_ascii=False)


def build_cabinet_filler_prompt(
    research_query: str,
    *,
    extra_instructions: str | None,
    project_document_rag: str,
) -> str:
    keys_block = ", ".join(f'"{k}"' for k in _CABINET_FILLER_JSON_KEYS)
    parts = [
        "Ты — аналитик маркетингового кабинета. Работаешь только с переданным контекстом проекта и фрагментами документов ниже (как в маркетинговом чате).",
        "Нельзя использовать внешние знания, домыслы и обобщения, не подтверждённые этим контекстом.",
        "Фрагменты могут быть из любых загруженных файлов; часть из них может не относиться к маркетингу (налоги, личные документы, прочее). "
        "**Не переноси** в поля кабинета содержимое про налоги, бухгалтерию, декларации и т.п., если это не про маркетинг/продукт/аудиторию **этого** проекта. В сомнении — null.",
        "Если по разделу нет подходящих фактов в фрагментах — значение этого поля должно быть null.",
        "**Запрещено:** просить пользователя предоставить материалы, ссылки, бриф или уточнения; писать отказ, "
        "что «для выполнения задания необходимы данные». "
        "**Единственный допустимый ответ** — один JSON-объект по схеме ниже, без текста до или после JSON.",
        "Строковые поля: краткий русский текст (markdown допустим внутри строки).",
        "",
        "Ответь одним JSON-объектом с корнями ровно такими ключами (все ключи обязательны):",
        f"[{keys_block}]",
        "Типы: project_description, project_goals, project_key_tasks — строка или null; swot — строка или null.",
        "Остальные поля — строка или null.",
        "Не добавляй markdown-ограждения (```), только сырой JSON.",
        "",
        "## Контекст запроса пользователя:",
        research_query.strip() or "(без дополнительного брифа)",
        "",
    ]
    if extra_instructions and extra_instructions.strip():
        parts.extend(["## Акцент:", extra_instructions.strip(), ""])
    parts.extend(
        [
            "## Контекст проекта и фрагменты документов (единственный источник фактов):",
            project_document_rag.strip(),
            "",
            "JSON:",
        ]
    )
    return "\n".join(parts)


class ImcCabinetFillerProvider:
    """Llama + JSON «Заполнитель»; не смешивать с MISO."""

    def __init__(self, llama_base_url: str = "http://stack2-llama-chat:8080") -> None:
        self.llama_base_url = llama_base_url.rstrip("/")
        self.client: httpx.AsyncClient | None = None
        self.timeout = httpx.Timeout(120.0, connect=10.0, read=60.0)

    async def initialize(self) -> None:
        if self.client:
            return
        self.client = httpx.AsyncClient(
            timeout=self.timeout,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10, keepalive_expiry=30.0),
            follow_redirects=True,
        )
        logger.info("ImcCabinetFillerProvider Llama at %s", self.llama_base_url)

    async def close(self) -> None:
        if self.client:
            try:
                async with asyncio.timeout(5.0):
                    await self.client.aclose()
            except TimeoutError:
                logger.warning("Timeout closing ImcCabinetFillerProvider client")
            finally:
                self.client = None

    async def generate(self, input_data: dict[str, Any]) -> dict[str, Any]:
        if not self.client:
            await self.initialize()

        input_data = dict(input_data) if isinstance(input_data, dict) else {}
        research_query = str(input_data.get("research_query") or "")
        extra = input_data.get("prompt_instructions")
        extra_instructions = extra if isinstance(extra, str) else None
        project_rag = input_data.get("marketing_project_rag_context")
        project_rag = project_rag if isinstance(project_rag, str) else ""
        model = input_data.get("model", unified_settings.bi_ai_model)

        if not project_rag.strip():
            logger.info("[STEP] imc.cabinet_filler.empty_rag")
            return {
                "content": empty_cabinet_filler_json(),
                "model": model,
                "research_type": "cabinet_filler",
                "research_query": research_query,
                "metadata": {
                    "provider": "imc_cabinet_filler",
                    "backend": "llama",
                    "generation_time": datetime.now(UTC).isoformat(),
                    "imc_vector_only": True,
                    "imc_cabinet_filler": True,
                    "imc_cabinet_filler_empty_rag": True,
                },
            }

        prompt = build_cabinet_filler_prompt(
            research_query,
            extra_instructions=extra_instructions,
            project_document_rag=project_rag,
        )

        if not self.client:
            msg = "ImcCabinetFillerProvider client not initialized"
            raise RuntimeError(msg)

        logger.info("[STEP] imc.cabinet_filler.generate rag_len=%s", len(project_rag))
        result = await httpx_compat_generate_json(
            self.client,
            self.llama_base_url,
            model=model,
            prompt=prompt,
            system=None,
            options={"temperature": 0.2, "num_predict": 8192},
            json_format=True,
            keep_alive=None,
            timeout=httpx.Timeout(180.0, connect=10.0),
        )
        generated_text = result.get("response", "")
        if not generated_text:
            msg = "Empty response from ImcCabinetFiller generation"
            raise RuntimeError(msg)

        return {
            "content": generated_text,
            "model": model,
            "research_type": "cabinet_filler",
            "research_query": research_query,
            "metadata": {
                "provider": "imc_cabinet_filler",
                "backend": "llama",
                "generation_time": datetime.now(UTC).isoformat(),
                "imc_vector_only": True,
                "imc_cabinet_filler": True,
            },
        }
