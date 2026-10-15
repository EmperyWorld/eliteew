# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG-only facade: re-exports sibling modules + `ImcRagResearchProvider` entrypoint для UGS.
# Invariants:
# - Без MISO; live web search только при `use_web_search=true` и user/db контексте.
# Related:
# - api.services.ugs.providers.imc_rag_llama_client
# - api.services.ugs.providers.imc_rag_orchestration
# - api.services.ugs.providers.imc_rag_markdown
# - api.services.ugs.providers.imc_rag_prompts
# ---

"""ИМК исследования (markdown) — RAG-only провайдер UGS (facade)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx  # type: ignore[import-not-found]

from api.services.ugs.providers.imc_rag_llama_client import ImcRagLlamaClient
from api.services.ugs.providers.imc_rag_markdown import (
    normalize_imc_markdown_delivery,
    strip_leaked_merge_instructions,
    strip_trailing_identical_bold_loop,
)
from api.services.ugs.providers.imc_rag_orchestration import (
    concat_orchestrated_sections,
    emit_imc_progress,
    run_imc_rag_generation,
)
from api.services.ugs.providers.imc_rag_prompts import (
    build_merge_prompt,
    build_polish_concat_report_prompt,
    build_rag_research_prompt,
    build_section_expand_addon_prompt,
    imc_output_sections_list,
    truncate_prompt_preserve_instructions,
)

_concat_orchestrated_sections = concat_orchestrated_sections
_strip_leaked_merge_instructions = strip_leaked_merge_instructions
_strip_trailing_identical_bold_loop = strip_trailing_identical_bold_loop

__all__ = [
    "ImcRagResearchProvider",
    "ImcRagLlamaClient",
    "_concat_orchestrated_sections",
    "emit_imc_progress",
    "_strip_leaked_merge_instructions",
    "_strip_trailing_identical_bold_loop",
    "build_merge_prompt",
    "build_polish_concat_report_prompt",
    "build_rag_research_prompt",
    "build_section_expand_addon_prompt",
    "concat_orchestrated_sections",
    "imc_output_sections_list",
    "normalize_imc_markdown_delivery",
    "run_imc_rag_generation",
    "strip_leaked_merge_instructions",
    "strip_trailing_identical_bold_loop",
    "truncate_prompt_preserve_instructions",
]


class ImcRagResearchProvider:
    """Llama + markdown для ИМК RAG-only; не смешивать с MISO."""

    def __init__(self, llama_base_url: str | None = None) -> None:
        self._llama = ImcRagLlamaClient(llama_base_url)
        self.llama_base_url = self._llama.llama_base_url

    @property
    def client(self) -> httpx.AsyncClient | None:
        return self._llama.client

    @client.setter
    def client(self, value: httpx.AsyncClient | None) -> None:
        self._llama.client = value

    async def initialize(self) -> None:
        await self._llama.initialize()

    async def close(self) -> None:
        await self._llama.close()

    async def generate(
        self,
        input_data: dict[str, Any],
        *,
        on_progress: Callable[[float, str], Awaitable[None]] | None = None,
        db: Any | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        if not self._llama.client:
            await self.initialize()
        return await run_imc_rag_generation(
            self._llama,
            emit_progress=on_progress,
            input_data=input_data,
            db=db,
            user_id=user_id,
        )
