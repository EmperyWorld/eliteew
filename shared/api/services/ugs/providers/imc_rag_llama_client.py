# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG: httpx-клиент Llama/OpenAI-compat generate с ctx-cap и peg-gemma4 retry.
# Invariants:
# - `model` должен совпадать с GET /v1/models text-сервера; client init перед generate.
# Related:
# - api.utils.llm_openai_compat_http
# ---

"""ИМК RAG Llama HTTP client."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.ugs.providers.imc_rag_markdown import strip_trailing_identical_bold_loop
from api.services.ugs.text_llm_constants import (
    coerce_imc_rag_research_llm_base_url,
    resolve_ugs_text_llm_base_url,
)
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import httpx_compat_generate_json

logger = logging.getLogger(__name__)

_PEG_GEMMA4_FORMAT_ERR = "peg-gemma4 format"
_IMC_LLAMA_PEG_RETRIES = 3
NUM_PREDICT_FLOOR = 512


def imc_trace_enabled() -> bool:
    return bool(getattr(unified_settings, "imc_rag_trace", False))


def imc_trace_full_enabled() -> bool:
    return bool(getattr(unified_settings, "imc_rag_trace_full", False))


def trace_preview(text: str, max_len: int = 280) -> str:
    t = (text or "").replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return f"{t[: max_len - 1]}…"


def resolve_imc_rag_llama_base_url(llama_base_url: str | None = None) -> str:
    raw = resolve_ugs_text_llm_base_url(
        llama_base_url,
        env_llama_url=unified_settings.llama_url,
    )
    coerced, changed = coerce_imc_rag_research_llm_base_url(
        raw,
        embedding_base_url=getattr(unified_settings, "llama_embedding_url", None),
    )
    if changed:
        logger.warning(
            "[STEP] imc.rag_research.llm_url_coerced from=%s to=%s "
            "(ИМК требует chat/text LLM; embed/rerank дают малый n_ctx)",
            raw,
            coerced,
        )
    return coerced


class ImcRagLlamaClient:
    """Async Llama generate client for IMC RAG provider."""

    def __init__(self, llama_base_url: str | None = None) -> None:
        self.llama_base_url = resolve_imc_rag_llama_base_url(llama_base_url)
        self.client: httpx.AsyncClient | None = None

    async def initialize(self) -> None:
        if self.client:
            return
        self.client = httpx.AsyncClient(
            timeout=self.gen_timeout(),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10, keepalive_expiry=30.0),
            follow_redirects=True,
        )
        logger.info("ImcRagResearchProvider Llama at %s", self.llama_base_url)

    async def close(self) -> None:
        if self.client:
            try:
                async with asyncio.timeout(5.0):
                    await self.client.aclose()
            except TimeoutError:
                logger.warning("Timeout closing ImcRagResearchProvider client")
            finally:
                self.client = None

    def gen_timeout(self) -> httpx.Timeout:
        gen_timeout = float(getattr(unified_settings, "imc_rag_llama_generate_timeout_seconds", 1200.0) or 1200.0)
        gen_timeout = max(60.0, min(gen_timeout, 7200.0))
        return httpx.Timeout(gen_timeout, connect=30.0)

    def cap_num_predict_for_ctx(self, prompt: str, num_predict: int, *, trace_label: str | None) -> int:
        raw_ctx = int(getattr(unified_settings, "imc_rag_llama_num_ctx", 0) or 0)
        ctx_budget = raw_ctx if raw_ctx >= 512 else 32_768
        est_in = max(64, len(prompt) // 3)
        reserve = 192
        room = ctx_budget - est_in - reserve
        floor = NUM_PREDICT_FLOOR
        if room < floor:
            logger.warning(
                "[STEP] imc.rag_research.ctx_budget_tight label=%s prompt_chars=%s est_in_tok~=%s ctx=%s",
                trace_label or "llama",
                len(prompt),
                est_in,
                ctx_budget,
            )
            room = floor
        capped = min(int(num_predict), int(room))
        if capped < int(num_predict):
            logger.warning(
                "[STEP] imc.rag_research.num_predict_ctx_cap label=%s requested=%s capped=%s ctx=%s est_in_tok~=%s",
                trace_label or "llama",
                num_predict,
                capped,
                ctx_budget,
                est_in,
            )
        return max(floor, capped)

    async def llama_generate(
        self,
        prompt: str,
        *,
        model: Any,
        num_predict: int,
        json_mode: bool,
        temperature: float,
        trace_label: str | None = None,
    ) -> tuple[str, dict[str, Any]]:
        if not self.client:
            msg = "ImcRagResearchProvider client not initialized"
            raise RuntimeError(msg)
        num_predict = self.cap_num_predict_for_ctx(prompt, num_predict, trace_label=trace_label)
        opts: dict[str, Any] = {"temperature": temperature, "num_predict": num_predict}
        raw_ctx = int(getattr(unified_settings, "imc_rag_llama_num_ctx", 0) or 0)
        if raw_ctx >= 512:
            opts["num_ctx"] = min(raw_ctx, 262_144)
        rp = float(getattr(unified_settings, "imc_rag_llama_repeat_penalty", 1.0) or 1.0)
        if rp > 1.0:
            opts["repeat_penalty"] = min(rp, 2.0)
        rln = int(getattr(unified_settings, "imc_rag_llama_repeat_last_n", 0) or 0)
        if rln > 0:
            opts["repeat_last_n"] = min(rln, 2048)
        top_p = float(getattr(unified_settings, "imc_rag_llama_top_p", 0.92) or 0)
        if 0.0 < top_p < 1.0:
            opts["top_p"] = top_p
        lbl = trace_label or "llama"
        trace = imc_trace_enabled()
        if trace:
            logger.info(
                "[STEP] imc.rag_trace.llama_req label=%s model=%s prompt_chars=%s num_predict=%s "
                "json_mode=%s temperature=%s llama_options=%s prompt_preview=%s",
                lbl,
                model,
                len(prompt),
                num_predict,
                json_mode,
                temperature,
                dict(sorted(opts.items())),
                trace_preview(prompt, 400),
            )
        assert self.client is not None
        template_kwargs = {"enable_thinking": False}
        last_exc: Exception | None = None
        for attempt in range(_IMC_LLAMA_PEG_RETRIES):
            try:
                result = await httpx_compat_generate_json(
                    self.client,
                    self.llama_base_url,
                    model=str(model),
                    prompt=prompt,
                    system=None,
                    options=opts,
                    json_format=json_mode,
                    keep_alive=llama_keep_alive_from_settings(),
                    timeout=self.gen_timeout(),
                    chat_template_kwargs=template_kwargs,
                )
                break
            except RuntimeError as exc:
                last_exc = exc
                err_text = str(exc)
                if _PEG_GEMMA4_FORMAT_ERR not in err_text.lower() or attempt >= _IMC_LLAMA_PEG_RETRIES - 1:
                    raise
                logger.warning(
                    "[STEP] imc.rag_research.llama_peg_retry label=%s attempt=%s/%s err=%s",
                    lbl,
                    attempt + 1,
                    _IMC_LLAMA_PEG_RETRIES,
                    err_text[:240],
                )
                await asyncio.sleep(0.35 * (attempt + 1))
        else:
            if last_exc is not None:
                raise last_exc
            msg = "ImcRagResearch llama generate failed without response"
            raise RuntimeError(msg)
        generated_text = result.get("response", "")
        if not generated_text:
            msg = (
                "Empty response from ImcRagResearch generation "
                f"(model={model!s}). For llama.cpp OpenAI API, model_name must match "
                "GET /v1/models on the text server (Llama-style names like rscr/... often yield empty text)."
            )
            raise RuntimeError(msg)
        out = str(generated_text)
        min_b = int(getattr(unified_settings, "imc_rag_repetition_trim_min_bold", 18) or 18)
        out, rep_trimmed = strip_trailing_identical_bold_loop(out, min_repeat=max(6, min_b))
        if rep_trimmed:
            logger.warning(
                "[STEP] imc.rag_research.repetition_trim len_after=%s min_bold_streak=%s",
                len(out),
                min_b,
            )
        telemetry: dict[str, Any] = {
            "done_reason": result.get("done_reason"),
            "eval_count": result.get("eval_count"),
            "prompt_eval_count": result.get("prompt_eval_count"),
            "imc_rag_repetition_trimmed": rep_trimmed,
        }
        if trace:
            logger.info(
                "[STEP] imc.rag_trace.llama_res label=%s out_chars=%s preview=%s telemetry=%s",
                lbl,
                len(out),
                trace_preview(out, 520),
                telemetry,
            )
        if imc_trace_full_enabled():
            logger.debug("[STEP] imc.rag_trace.llama_prompt_full label=%s\n%s", lbl, prompt)
            logger.debug("[STEP] imc.rag_trace.llama_response_full label=%s\n%s", lbl, out)
        return out, telemetry
