"""IMC domain service: orchestration and persistence; execution via UGS."""

from __future__ import annotations

import contextlib
import logging
import re
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from sqlalchemy import and_, delete, func, select  # type: ignore[import-not-found]
from sqlalchemy.exc import IntegrityError  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.models.database_models import GenerationRequest, GenerationType, ImcResearchRun, User
from api.schemas.imc import (
    ImcRagHintsResponse,
    ImcResearchRunDetail,
    ImcResearchRunSummary,
    ImcResearchStatusResponse,
    ImcResearchTypeOut,
    ImcRunResearchRequest,
    ImcRunResearchResponse,
)
from api.services.imc.imc_errors import ImcDeprecatedTypeKeyError, ImcInsufficientProjectContextError
from api.services.imc.imc_legacy_type_successors import successor_for_deprecated_imc_type
from api.services.imc.imc_rag_enrichment import coerce_meta_bool, resolve_imc_use_merged_context
from api.services.marketing_project_rag_service import MarketingRagInfrastructureError
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)


def _type_metadata_dict(generation_type: GenerationType) -> dict[str, Any]:
    raw = getattr(generation_type, "type_metadata", None) or {}
    return raw if isinstance(raw, dict) else {}


def is_imc_generation_type(generation_type: GenerationType) -> bool:
    key = str(generation_type.type_key or "")
    if key.startswith("imc_"):
        return True
    if key == "marketing_research_creator":
        return True
    meta = _type_metadata_dict(generation_type)
    if meta.get("imc_cabinet") is True:
        return True
    return meta.get("category") == "marketing_cabinet"


def ugs_public_status_to_imc_api_status(ugs_status: str | None) -> str:
    s = (ugs_status or "").lower()
    if s in ("queued", "pending", "processing", "retrying"):
        return "running"
    if s == "completed":
        return "completed"
    if s == "failed":
        return "failed"
    if s == "cancelled":
        return "cancelled"
    return "pending"


def ugs_public_status_to_imc_db_status(ugs_status: str | None) -> str:
    s = (ugs_status or "").lower()
    if s in ("queued", "pending", "processing", "retrying"):
        return "running"
    if s in ("completed", "failed", "cancelled"):
        return s
    return "pending"


def extract_result_text(result: Any) -> str | None:
    if result is None:
        return None
    if isinstance(result, str) and result.strip():
        return result
    if isinstance(result, dict):
        for key in ("text", "content", "markdown", "output"):
            v = result.get(key)
            if isinstance(v, str) and v.strip():
                return v
    return None


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
    return dt.isoformat().replace("+00:00", "Z")


def _preview_text(text: str | None, limit: int = 500) -> str | None:
    if not text:
        return None
    t = text.strip()
    if len(t) <= limit:
        return t
    return t[:limit] + "…"


def _result_text_line_count(text: str) -> int:
    """Согласовано с фронтом `imcMarkdownTextStats`: split по \\r\\n|\\r|\\n."""
    if not text:
        return 0
    return len(re.split(r"\r\n|\r|\n", text))


def _result_text_stats(text: str | None) -> tuple[int | None, int | None]:
    """Длина полного результата для списка ИМК (без передачи всего текста в карточке)."""
    if text is None:
        return None, None
    if not text:
        return 0, 0
    return len(text), _result_text_line_count(text)


def _format_started_by_label(full_name: str | None, username: str | None, email: str | None) -> str | None:
    fn = (full_name or "").strip()
    if fn:
        return fn
    un = (username or "").strip()
    if un:
        return un
    em = (email or "").strip()
    return em or None


def _try_parse_swot_from_text(text: str) -> dict[str, Any] | None:
    """Best-effort SWOT bullets from markdown-ish research output (RU/EN)."""
    if not text or len(text.strip()) < 20:
        return None
    specs: tuple[tuple[str, re.Pattern[str]], ...] = (
        (
            "strengths",
            re.compile(r"(?is)(?:^|\n)\s*(?:#{1,6}\s*)?(strengths?|сильные(?:\s+стороны)?)\b"),
        ),
        (
            "weaknesses",
            re.compile(r"(?is)(?:^|\n)\s*(?:#{1,6}\s*)?(weaknesses?|слабые(?:\s+стороны)?|слабости)\b"),
        ),
        (
            "opportunities",
            re.compile(r"(?is)(?:^|\n)\s*(?:#{1,6}\s*)?(opportunities|возможности)\b"),
        ),
        (
            "threats",
            re.compile(r"(?is)(?:^|\n)\s*(?:#{1,6}\s*)?(threats|угрозы)\b"),
        ),
    )
    sections: dict[str, list[str]] = {}
    for key, pat in specs:
        m = pat.search(text)
        if not m:
            continue
        chunk = text[m.end() : m.end() + 6000]
        bullets: list[str] = []
        for raw in chunk.splitlines():
            s = raw.strip()
            if not s:
                if bullets:
                    break
                continue
            if re.match(r"^(#{1,3}\s+|\*\*\s*[A-ZА-Яa-zа-я])", s):
                break
            if s.startswith(("-", "*", "•")) or re.match(r"^\d+[\.)]\s", s):
                bullets.append(re.sub(r"^[-*•]\s+|^\d+[\.)]\s+", "", s).strip())
            elif bullets:
                break
        if bullets:
            sections[key] = bullets[:50]
    if len(sections) >= 2:
        return {"kind": "swot", "sections": sections}
    return None


class ImcService:
    def __init__(self, db: AsyncSession, ugs: UnifiedGenerationService | None = None) -> None:
        self._db = db
        self._ugs = ugs

    def _require_ugs(self) -> UnifiedGenerationService:
        if self._ugs is None:
            msg = "UGS is required for this IMC operation"
            raise RuntimeError(msg)
        return self._ugs

    async def _load_run_by_id(self, research_id: UUID) -> ImcResearchRun | None:
        stmt = select(ImcResearchRun).where(ImcResearchRun.id == research_id)
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def _project_lead_id(self, marketing_db_pool: asyncpg.Pool, project_id: UUID) -> UUID | None:
        async with marketing_db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT created_by
                FROM projects
                WHERE id = $1
                  AND deleted_at IS NULL
                """,
                project_id,
            )
        if row is None or row["created_by"] is None:
            return None
        return row["created_by"]

    async def _ensure_imc_project_readable(
        self,
        row: ImcResearchRun,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> None:
        if row.project_id is None:
            msg = "У записи запуска нет project_id"
            raise ValueError(msg)
        from api.routers.marketing_cabinet.common import get_accessible_project

        await get_accessible_project(marketing_db_pool, row.project_id, user_id, for_mutation=False)

    async def _ensure_imc_control_author_or_lead(
        self,
        row: ImcResearchRun,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> None:
        await self._ensure_imc_project_readable(row, user_id, marketing_db_pool)
        lead = await self._project_lead_id(marketing_db_pool, row.project_id)  # type: ignore[arg-type]
        if row.user_id != user_id and lead != user_id:
            msg = "Действие доступно только автору запуска или руководителю проекта"
            raise PermissionError(msg)

    async def delete_research(
        self,
        *,
        research_id: UUID,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> bool:
        row = await self._load_run_by_id(research_id)
        if row is None or row.project_id is None:
            return False
        await self._ensure_imc_project_readable(row, user_id, marketing_db_pool)
        lead = await self._project_lead_id(marketing_db_pool, row.project_id)
        if lead != user_id:
            raise PermissionError("Удаление исследований доступно только руководителю проекта")
        await self._db.execute(delete(ImcResearchRun).where(ImcResearchRun.id == research_id))
        await self._db.commit()
        return True

    async def list_types_for_cabinet(self) -> list[ImcResearchTypeOut]:
        stmt = select(GenerationType).where(GenerationType.is_active.is_(True)).order_by(GenerationType.display_name)
        res = await self._db.execute(stmt)
        rows = list(res.scalars().all())
        out: list[ImcResearchTypeOut] = []
        for gt in rows:
            if not is_imc_generation_type(gt):
                continue
            # Вариант 1 плана: marketing_research_creator остаётся на MISO, в кабинете не показываем
            if str(gt.type_key or "") == "marketing_research_creator":
                continue
            meta = _type_metadata_dict(gt)
            is_comp = bool(meta.get("is_composite")) or str(gt.category or "").lower() == "composite"
            tk = str(gt.type_key or "")
            rag_project_only = bool(meta.get("imc_rag_project_only")) or tk.startswith("imc_rag_")
            out.append(
                ImcResearchTypeOut(
                    type_key=tk,
                    display_name=str(gt.display_name or gt.type_key),
                    description=gt.description,
                    estimated_time_seconds=int(gt.estimated_time or 30),
                    is_composite=is_comp,
                    complexity=str(gt.complexity or "medium"),
                    rag_project_only=rag_project_only,
                )
            )
        return out

    async def get_generation_type_for_imc(self, type_key: str) -> GenerationType | None:
        stmt = select(GenerationType).where(
            and_(GenerationType.type_key == type_key, GenerationType.is_active.is_(True))
        )
        res = await self._db.execute(stmt)
        gt = res.scalar_one_or_none()
        if gt is None or not is_imc_generation_type(gt):
            return None
        return gt

    @staticmethod
    def _focus_suffix(ctx: dict[str, Any]) -> str:
        raw = ctx.get("focus")
        if not isinstance(raw, str):
            return ""
        f = raw.strip().lower()
        if f == "rf":
            return (
                " Акцент анализа: рынок РФ и локальный контекст (опирайся только на то, что есть в документах проекта)."
            )
        if f == "global":
            return " Акцент анализа: глобальный рынок (опирайся только на материалы проекта)."
        if f == "mixed":
            return " Акцент анализа: сопоставь глобальный и российский контекст по фактам из документов проекта."
        return ""

    @staticmethod
    def _default_imc_research_query(body: ImcRunResearchRequest) -> str:
        # Не формулировать как «нужны материалы от пользователя» — иначе модель отвечает отказом с просьбой прислать URL/файлы.
        base = (
            "Маркетинговое исследование по выбранному проекту. Опирайся только на переданные фрагменты документов проекта "
            "и поля контекста запроса. "
            "Не проси пользователя прислать файлы или ссылки — работай с тем, что уже передано."
        )
        url = (body.source_url or "").strip()
        if url:
            return f"{base} Указанный источник: {url}"
        return base

    @staticmethod
    def _imc_research_type_slug(gt: GenerationType) -> str:
        key = str(gt.type_key or "")
        if key == "marketing_research_creator":
            return "marketing"
        if key.startswith("imc_"):
            return key[4:].replace("_", " ")
        return "marketing"

    def _build_ugs_input_data(self, body: ImcRunResearchRequest, gt: GenerationType) -> dict[str, Any]:
        ctx = dict(body.context) if isinstance(body.context, dict) else {}
        params = gt.parameters if isinstance(gt.parameters, dict) else {}
        meta = _type_metadata_dict(gt)
        brief = str(ctx.get("brief") or ctx.get("research_query") or "").strip()
        if brief:
            research_query = brief
        elif meta.get("imc_cabinet_filler") is True:
            research_query = (
                "Заполнение разделов маркетингового кабинета по фрагментам документов проекта ниже. "
                "Дополнительные вложения или URL от пользователя не требуются."
            )
        else:
            research_query = self._default_imc_research_query(body)
        rt_param = params.get("research_type")
        research_type = rt_param.strip() if isinstance(rt_param, str) and rt_param.strip() else None
        if not research_type:
            rtm = meta.get("miso_research_type")
            research_type = rtm.strip() if isinstance(rtm, str) and rtm.strip() else self._imc_research_type_slug(gt)
        prompt_instructions = params.get("prompt_instructions")
        if not (isinstance(prompt_instructions, str) and prompt_instructions.strip()):
            pi = meta.get("imc_prompt_instructions")
            prompt_instructions = pi if isinstance(pi, str) and pi.strip() else None
        payload: dict[str, Any] = {
            "imc_version": 1,
            # Результаты ИМК в продукте — только на русском; игнорируем english из клиента
            "language": "russian",
            "company_id": body.company_id,
            "project_id": body.project_id,
            "file_ids": list(body.input_file_ids),
            "source_url": (body.source_url or "").strip() or None,
            "context": ctx,
            "research_query": research_query,
            "research_type": research_type,
            "imc_type_key": body.type_key,
            "use_web_search": body.use_web_search is True,
            "web_search_quality": body.web_search_quality,
        }
        mdl = params.get("model")
        if isinstance(mdl, str) and mdl.strip():
            payload["model"] = mdl.strip()
        else:
            mn_col = getattr(gt, "model_name", None)
            if isinstance(mn_col, str) and mn_col.strip() and mn_col.strip().lower() != "llama":
                payload["model"] = mn_col.strip()
        ios = meta.get("imc_output_sections")
        if ios is not None:
            payload["imc_output_sections"] = ios
        # type_key — источник истины; type_metadata может отличаться по десериализации
        if body.type_key == "imc_cabinet_filler" or meta.get("imc_cabinet_filler") is True:
            payload["imc_cabinet_filler"] = True
        if (
            body.type_key == "imc_cabinet_filler"
            or meta.get("imc_vector_only") is True
            or str(body.type_key or "").startswith("imc_rag_")
        ):
            payload["imc_vector_only"] = True
        if prompt_instructions:
            payload["prompt_instructions"] = prompt_instructions
        ipv = meta.get("imc_prompt_version")
        if isinstance(ipv, (int, float)):
            payload["imc_prompt_version"] = int(ipv)
        elif isinstance(ipv, str) and ipv.strip():
            stripped = ipv.strip()
            payload["imc_prompt_version"] = int(stripped) if stripped.isdigit() else stripped
        irf = meta.get("imc_response_format")
        if isinstance(irf, str) and irf.strip().lower() in ("json", "markdown"):
            payload["imc_response_format"] = irf.strip().lower()
        if meta.get("imc_streaming") is True:
            payload["imc_streaming"] = True
        inp_n = meta.get("imc_num_predict")
        if isinstance(inp_n, (int, float)) and int(inp_n) >= 512:
            payload["imc_num_predict"] = min(int(inp_n), 131_072)
        iad = meta.get("imc_answer_depth")
        if isinstance(iad, str) and iad.strip().lower() in ("brief", "standard", "deep"):
            payload["imc_answer_depth"] = iad.strip().lower()
        if meta.get("imc_rag_orchestrate") is True:
            payload["imc_rag_orchestrate"] = True
            mode = meta.get("imc_rag_orchestrate_mode")
            if isinstance(mode, str) and mode.strip():
                payload["imc_rag_orchestrate_mode"] = mode.strip()
            step_cap = int(getattr(unified_settings, "imc_rag_orchestrate_max_steps_cap", 12) or 12)
            oms = meta.get("imc_rag_orchestrate_max_steps")
            if isinstance(oms, (int, float)) and int(oms) >= 1:
                payload["imc_rag_orchestrate_max_steps"] = max(1, min(int(oms), step_cap))
            ssp = meta.get("imc_rag_step_num_predict")
            if isinstance(ssp, (int, float)) and int(ssp) >= 512:
                payload["imc_rag_step_num_predict"] = min(int(ssp), 131_072)
            mgp = meta.get("imc_rag_merge_num_predict")
            if isinstance(mgp, (int, float)) and int(mgp) >= 512:
                payload["imc_rag_merge_num_predict"] = min(int(mgp), 131_072)
            mmode = meta.get("imc_rag_merge_mode")
            if isinstance(mmode, str) and mmode.strip():
                payload["imc_rag_merge_mode"] = mmode.strip().lower()
            pnp = meta.get("imc_rag_polish_num_predict")
            if isinstance(pnp, (int, float)) and int(pnp) >= 512:
                payload["imc_rag_polish_num_predict"] = min(int(pnp), 131_072)
            msc = meta.get("imc_rag_min_section_chars")
            if isinstance(msc, (int, float)) and int(msc) >= 400:
                payload["imc_rag_min_section_chars"] = min(int(msc), 50_000)
        return payload

    async def _attach_imc_metadata_to_ugs_request(
        self,
        ugs_request_id: UUID,
        *,
        research_id: UUID,
        workflow_key: str | None,
        step_key: str | None,
    ) -> None:
        stmt = select(GenerationRequest).where(GenerationRequest.id == ugs_request_id)
        res = await self._db.execute(stmt)
        gr = res.scalar_one_or_none()
        if gr is None:
            return
        md = dict(gr.request_metadata or {}) if isinstance(gr.request_metadata, dict) else {}
        md["imc"] = True
        md["imc_research_id"] = str(research_id)
        md["imc_workflow_key"] = workflow_key
        md["imc_step_key"] = step_key
        gr_mut: Any = gr
        gr_mut.request_metadata = md
        await self._db.commit()

    async def run_research(
        self,
        *,
        user_id: UUID,
        body: ImcRunResearchRequest,
        marketing_db_pool: asyncpg.Pool | None = None,
    ) -> ImcRunResearchResponse:
        if body.workflow_key:
            msg = "Составные workflow (workflow_key) пока не поддерживаются"
            raise ValueError(msg)

        gt = await self.get_generation_type_for_imc(body.type_key)
        if gt is None:
            succ = successor_for_deprecated_imc_type(body.type_key)
            if succ:
                raise ImcDeprecatedTypeKeyError(
                    deprecated_type_key=str(body.type_key).strip(),
                    successor_type_key=succ,
                )
            msg = f"Неизвестный или недоступный type_key: {body.type_key}"
            raise ValueError(msg)

        if body.idempotency_key:
            stmt = select(ImcResearchRun).where(
                and_(
                    ImcResearchRun.user_id == user_id,
                    ImcResearchRun.idempotency_key == body.idempotency_key,
                )
            )
            existing = (await self._db.execute(stmt)).scalar_one_or_none()
            if existing is not None:
                if existing.ugs_request_id is None:
                    msg = "Предыдущий запуск с этим idempotency_key не дошёл до UGS; используйте другой ключ"
                    raise ValueError(msg)
                return await self._build_run_response_from_row(existing, gt)

        meta_snapshot = _type_metadata_dict(gt)
        ip_ver_snap = meta_snapshot.get("imc_prompt_version")
        ip_rf_snap = meta_snapshot.get("imc_response_format")
        run = ImcResearchRun(
            user_id=user_id,
            company_id=UUID(body.company_id),
            project_id=UUID(body.project_id),
            type_key=body.type_key,
            workflow_key=None,
            status="pending",
            idempotency_key=body.idempotency_key,
            input_payload={
                "type_key": body.type_key,
                "input_file_ids": body.input_file_ids,
                "source_url": body.source_url,
                "context": body.context,
                "language": body.language,
                "priority": body.priority,
                "use_web_search": body.use_web_search,
                "web_search_quality": body.web_search_quality,
                "imc_prompt_version": ip_ver_snap if isinstance(ip_ver_snap, (int, float, str)) else None,
                "imc_response_format": str(ip_rf_snap).strip().lower()
                if isinstance(ip_rf_snap, str) and ip_rf_snap.strip()
                else None,
            },
            display_name=str(gt.display_name or body.type_key),
        )
        self._db.add(run)
        try:
            await self._db.commit()
            await self._db.refresh(run)
        except IntegrityError:
            await self._db.rollback()
            stmt = select(ImcResearchRun).where(
                and_(
                    ImcResearchRun.user_id == user_id,
                    ImcResearchRun.idempotency_key == body.idempotency_key,
                )
            )
            existing = (await self._db.execute(stmt)).scalar_one_or_none()
            if existing is not None:
                return await self._build_run_response_from_row(existing, gt)
            raise

        input_data = self._build_ugs_input_data(body, gt)
        ctx_for_focus = dict(body.context) if isinstance(body.context, dict) else {}
        focus_x = self._focus_suffix(ctx_for_focus)
        if focus_x:
            rq0 = str(input_data.get("research_query") or "").strip()
            input_data["research_query"] = f"{rq0}{focus_x}".strip()

        t_rag0 = time.perf_counter()
        imc_trace = bool(getattr(unified_settings, "imc_rag_trace", False))
        ctx_body = dict(body.context) if isinstance(body.context, dict) else {}
        doc_text_for_imc = str(ctx_body.get("document_text") or "").strip()
        meta_for_imc = _type_metadata_dict(gt)
        diagnostic_answers_only = coerce_meta_bool(meta_for_imc.get("imc_diagnostic_answers_only"))
        rag_project_only = coerce_meta_bool(meta_for_imc.get("imc_rag_project_only"))
        fail_rag_infra = marketing_db_pool is not None and rag_project_only and not diagnostic_answers_only
        rag_chunk_count: int | None = None

        if marketing_db_pool is not None and diagnostic_answers_only:
            if doc_text_for_imc:
                input_data["marketing_project_rag_context"] = (
                    "## Данные клиентской диагностики (ответы представителя и снимок сессии из запроса)\n\n"
                    + doc_text_for_imc
                )
            else:
                logger.warning(
                    "[STEP] imc.run_research.diagnostic_answers_only_empty_document research_id=%s type_key=%s",
                    run.id,
                    body.type_key,
                )
        elif marketing_db_pool is not None:
            try:
                from api.services.marketing_project_rag_service import (
                    format_rag_chunks_for_prompt,
                    merge_project_context_text_with_rag,
                    search_marketing_project_rag_chunks,
                )

                research_query = str(input_data.get("research_query") or "").strip()
                if not research_query:
                    research_query = self._default_imc_research_query(body)
                meta = meta_for_imc
                rag_limit = 16
                rl = meta.get("imc_rag_limit")
                if isinstance(rl, int) and rl > 0:
                    rag_limit = min(rl, 64)
                elif isinstance(rl, float) and rl > 0:
                    rag_limit = min(int(rl), 64)
                use_merged = resolve_imc_use_merged_context(type_key=body.type_key, meta=meta)
                is_filler = coerce_meta_bool(meta.get("imc_cabinet_filler"))
                min_rag_score: float | None = None
                ms = meta.get("imc_rag_min_score")
                if ms is None:
                    min_rag_score = 0.35
                elif isinstance(ms, (int, float)) and float(ms) <= 0:
                    min_rag_score = None
                else:
                    min_rag_score = float(ms)
                if is_filler or use_merged:
                    # Как в маркетинговом чате (chat.py): PG-контекст + RAG по смыслу брифа пользователя.
                    from api.routers.marketing_cabinet.common import (
                        build_project_context,
                        format_project_context_for_prompt,
                    )

                    ctx = dict(body.context) if isinstance(body.context, dict) else {}
                    brief = str(ctx.get("brief") or ctx.get("research_query") or "").strip()
                    rag_query_text = brief if brief else research_query
                    if not (rag_query_text or "").strip():
                        rag_query_text = self._default_imc_research_query(body)
                    if imc_trace:
                        logger.info(
                            "[STEP] imc.rag_trace.imc_enrich_path type_key=%s project_id=%s mode=pg_plus_rag "
                            "filler=%s research_query_preview=%s rag_query_for_vector_preview=%s",
                            body.type_key,
                            body.project_id,
                            is_filler,
                            (research_query[:320] if research_query else ""),
                            (rag_query_text[:320] if rag_query_text else ""),
                        )
                    context_dict = await build_project_context(
                        marketing_db_pool,
                        UUID(body.project_id),
                        user_id,
                    )
                    context_text = format_project_context_for_prompt(context_dict)
                    merged = await merge_project_context_text_with_rag(
                        marketing_db_pool,
                        project_id=UUID(body.project_id),
                        user_id=user_id,
                        query=rag_query_text,
                        context_text=context_text,
                        limit=rag_limit,
                        min_score=min_rag_score,
                        fail_on_infrastructure_error=fail_rag_infra,
                    )
                    if merged.strip():
                        input_data["marketing_project_rag_context"] = merged
                    logger.info(
                        "[STEP] imc.context_merge type_key=%s merged_len=%s rag_limit=%s min_score=%s",
                        body.type_key,
                        len(merged) if merged else 0,
                        rag_limit,
                        min_rag_score,
                    )
                    from api.services.marketing_web_search_context import build_imc_web_search_queries
                    from api.services.marketing_web_search_quality import (
                        normalize_web_search_quality,
                        web_search_enabled,
                    )

                    ws_quality = normalize_web_search_quality(
                        str(body.web_search_quality or "off"),
                        use_web_search=body.use_web_search is True,
                    )
                    input_data["web_search_quality"] = ws_quality
                    if web_search_enabled(ws_quality):
                        project_row = context_dict.get("project") or {}
                        brief_for_web = str(ctx.get("brief") or ctx.get("research_query") or "").strip()
                        ws_queries = build_imc_web_search_queries(
                            imc_type_key=body.type_key,
                            quality=ws_quality,
                            project_name=str(project_row.get("name") or ""),
                            company_name=str(project_row.get("company_name") or ""),
                            industry=str(project_row.get("company_industry") or ""),
                            project_description=str(
                                project_row.get("description")
                                or project_row.get("key_tasks")
                                or project_row.get("goals")
                                or ""
                            ),
                            brief=brief_for_web or None,
                        )
                        input_data["web_search_queries"] = ws_queries
                        if ws_queries:
                            input_data["web_search_query"] = ws_queries[0]
                        logger.info(
                            "[STEP] imc.web_search_queries type_key=%s quality=%s count=%s first=%s",
                            body.type_key,
                            ws_quality,
                            len(ws_queries),
                            (ws_queries[0][:160] if ws_queries else ""),
                        )
                else:
                    rag_query = research_query
                    if imc_trace:
                        logger.info(
                            "[STEP] imc.rag_trace.imc_enrich_path type_key=%s project_id=%s mode=rag_only "
                            "use_merged=%s rag_query_preview=%s rag_limit=%s min_score=%s",
                            body.type_key,
                            body.project_id,
                            use_merged,
                            (rag_query[:320] if rag_query else ""),
                            rag_limit,
                            min_rag_score,
                        )
                    rag_chunks = await search_marketing_project_rag_chunks(
                        marketing_db_pool,
                        query=rag_query,
                        project_id=UUID(body.project_id),
                        user_id=user_id,
                        limit=rag_limit,
                        min_score=min_rag_score,
                        fail_on_infrastructure_error=fail_rag_infra,
                    )
                    rag_chunk_count = len(rag_chunks)
                    if imc_trace:
                        logger.info(
                            "[STEP] imc.rag_trace.imc_rag_only_chunks type_key=%s project_id=%s count=%s",
                            body.type_key,
                            body.project_id,
                            len(rag_chunks),
                        )
                    rag_block = format_rag_chunks_for_prompt(rag_chunks)
                    if rag_block:
                        input_data["marketing_project_rag_context"] = rag_block

                if doc_text_for_imc:
                    doc_block = "## Данные клиентской диагностики (из запроса)\n\n" + doc_text_for_imc
                    existing_ctx = str(input_data.get("marketing_project_rag_context") or "").strip()
                    input_data["marketing_project_rag_context"] = (
                        f"{doc_block}\n\n{existing_ctx}" if existing_ctx else doc_block
                    )
            except MarketingRagInfrastructureError:
                run_mut_infra: Any = run
                run_mut_infra.status = "failed"
                run_mut_infra.completed_at = datetime.now(UTC).replace(tzinfo=None)
                await self._db.commit()
                raise
            except Exception as rag_exc:
                if fail_rag_infra:
                    run_mut_infra = run
                    run_mut_infra.status = "failed"
                    run_mut_infra.completed_at = datetime.now(UTC).replace(tzinfo=None)
                    await self._db.commit()
                    raise MarketingRagInfrastructureError("Ошибка обогащения контекста проекта (RAG).") from rag_exc
                logger.exception(
                    "[IMC] marketing RAG enrichment failed research_id=%s type_key=%s",
                    run.id,
                    body.type_key,
                )

        rag_ctx = str(input_data.get("marketing_project_rag_context") or "").strip()
        empty_rag = not rag_ctx
        rag_ms = int((time.perf_counter() - t_rag0) * 1000)
        logger.info(
            "[STEP] imc.run_research.rag_done research_id=%s type_key=%s project_id=%s user_id=%s "
            "ctx_len=%s empty_rag=%s rag_enrich_ms=%s rag_chunk_count=%s",
            run.id,
            body.type_key,
            body.project_id,
            user_id,
            len(rag_ctx),
            empty_rag,
            rag_ms,
            rag_chunk_count,
        )

        requires_nonempty_ctx = rag_project_only and not diagnostic_answers_only
        if requires_nonempty_ctx and not rag_ctx:
            run_mut_ctx: Any = run
            run_mut_ctx.status = "failed"
            run_mut_ctx.completed_at = datetime.now(UTC).replace(tzinfo=None)
            await self._db.commit()
            raise ImcInsufficientProjectContextError(type_key=body.type_key)

        run_mut: Any = run
        try:
            t_ugs0 = time.perf_counter()
            gen_out = await self._require_ugs().generate(
                user_id=str(user_id),
                type_key=body.type_key,
                input_data=input_data,
                project_id=body.project_id,
                company_id=body.company_id,
                priority=body.priority,
                idempotency_key=body.idempotency_key,
            )
        except Exception:
            logger.exception(
                "[IMC] UGS generate failed research_id=%s type_key=%s user_id=%s",
                run.id,
                body.type_key,
                user_id,
            )
            run_mut.status = "failed"
            run_mut.completed_at = datetime.now(UTC).replace(tzinfo=None)
            await self._db.commit()
            raise

        ugs_rid = gen_out.get("request_id")
        if not ugs_rid:
            run_mut.status = "failed"
            await self._db.commit()
            msg = "UGS не вернул request_id"
            raise RuntimeError(msg)

        run_mut.ugs_request_id = UUID(str(ugs_rid))
        run_mut.status = "running"
        est = gen_out.get("estimated_time")
        sec = int(est) if est is not None else int(gt.estimated_time or 30)
        run_mut.started_at = datetime.now(UTC).replace(tzinfo=None)
        await self._db.commit()

        await self._attach_imc_metadata_to_ugs_request(
            UUID(str(ugs_rid)),
            research_id=run.id,
            workflow_key=None,
            step_key=None,
        )

        ugs_ms = int((time.perf_counter() - t_ugs0) * 1000)
        eta = (datetime.now(UTC) + timedelta(seconds=sec)).isoformat().replace("+00:00", "Z")
        logger.info(
            "[STEP] imc.research_started research_id=%s ugs_request_id=%s type_key=%s project_id=%s "
            "user_id=%s ctx_len=%s empty_rag=%s ugs_enqueue_ms=%s",
            run.id,
            ugs_rid,
            body.type_key,
            body.project_id,
            user_id,
            len(rag_ctx),
            empty_rag,
            ugs_ms,
        )
        return ImcRunResearchResponse(
            id=str(run.id),
            status="pending",
            ugs_request_id=str(ugs_rid),
            estimated_completion=eta,
            message="Принято в работу",
        )

    async def _build_run_response_from_row(self, row: ImcResearchRun, gt: GenerationType) -> ImcRunResearchResponse:
        if row.ugs_request_id is None:
            msg = "Запись ИМК без ugs_request_id"
            raise ValueError(msg)
        sec = int(gt.estimated_time or 30)
        eta = (datetime.now(UTC) + timedelta(seconds=sec)).isoformat().replace("+00:00", "Z")
        return ImcRunResearchResponse(
            id=str(row.id),
            status="pending",
            ugs_request_id=str(row.ugs_request_id),
            estimated_completion=eta,
            message="Идемпотентный повтор: тот же запуск",
        )

    async def _load_run_for_user(self, research_id: UUID, user_id: UUID) -> ImcResearchRun | None:
        stmt = select(ImcResearchRun).where(and_(ImcResearchRun.id == research_id, ImcResearchRun.user_id == user_id))
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def sync_row_from_ugs(self, row: ImcResearchRun) -> None:
        if row.ugs_request_id is None:
            return
        ugs = self._require_ugs()
        row_mut: Any = row
        try:
            st = await ugs.get_status(str(row.ugs_request_id))
        except ValueError:
            return
        pub = str(st.get("status") or "")
        row_mut.status = ugs_public_status_to_imc_db_status(pub)
        sa = st.get("started_at")
        if isinstance(sa, str):
            with contextlib.suppress(ValueError):
                row_mut.started_at = datetime.fromisoformat(sa.replace("Z", "+00:00")).replace(tzinfo=None)
        ca = st.get("completed_at")
        if isinstance(ca, str):
            with contextlib.suppress(ValueError):
                row_mut.completed_at = datetime.fromisoformat(ca.replace("Z", "+00:00")).replace(tzinfo=None)
        if row_mut.status == "completed":
            try:
                res = await ugs.get_result(str(row.ugs_request_id))
            except ValueError:
                await self._db.commit()
                return
            if str(res.get("status") or "").lower() == "completed":
                text = extract_result_text(res.get("result"))
                if text:
                    row_mut.result_text = text
                if row_mut.result_text and (row_mut.parsed_data is None or row_mut.parsed_data == {}):
                    tk = (row_mut.type_key or "").lower()
                    if "swot" in tk:
                        parsed = _try_parse_swot_from_text(row_mut.result_text)
                        if parsed:
                            row_mut.parsed_data = parsed
        if row_mut.status == "failed":
            err = st.get("error")
            if isinstance(err, str) and err.strip():
                row_mut.result_text = row_mut.result_text or err
        row_mut.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self._db.commit()

    def _row_to_summary(
        self,
        row: ImcResearchRun,
        *,
        started_by_label: str | None = None,
    ) -> ImcResearchRunSummary:
        duration: float | None = None
        if row.started_at and row.completed_at:
            duration = (row.completed_at - row.started_at).total_seconds()
        ugs_id = str(row.ugs_request_id) if row.ugs_request_id else ""
        rc, rl = _result_text_stats(row.result_text)
        return ImcResearchRunSummary(
            id=str(row.id),
            type_key=row.type_key,
            display_name=str(row.display_name or row.type_key),
            status=row.status,  # type: ignore[arg-type]
            company_id=str(row.company_id) if row.company_id else "",
            project_id=str(row.project_id) if row.project_id else "",
            created_at=_iso(row.created_at) or "",
            started_at=_iso(row.started_at),
            completed_at=_iso(row.completed_at),
            duration_seconds=duration,
            result_preview=_preview_text(row.result_text),
            result_char_count=rc,
            result_line_count=rl,
            parsed_data=row.parsed_data if isinstance(row.parsed_data, dict) else None,
            ugs_request_id=ugs_id,
            workflow_id=None,
            started_by_user_id=str(row.user_id) if row.user_id else None,
            started_by_label=started_by_label,
        )

    async def get_research_detail(
        self,
        research_id: UUID,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> ImcResearchRunDetail | None:
        row = await self._load_run_by_id(research_id)
        if row is None:
            return None
        await self._ensure_imc_project_readable(row, user_id, marketing_db_pool)
        su = (await self._db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
        slabel = None
        if su is not None:
            slabel = _format_started_by_label(su.full_name, su.username, su.email)
        await self.sync_row_from_ugs(row)
        await self._db.refresh(row)
        base = self._row_to_summary(row, started_by_label=slabel)
        pd = row.parsed_data if isinstance(row.parsed_data, dict) else None
        ip = row.input_payload if isinstance(row.input_payload, dict) else None
        return ImcResearchRunDetail(
            **base.model_dump(),
            result_text=row.result_text,
            result_structured=pd,
            input_payload=ip,
            steps=[],
            errors=[],
        )

    async def get_research_status(
        self,
        research_id: UUID,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> ImcResearchStatusResponse | None:
        row = await self._load_run_by_id(research_id)
        if row is None:
            return None
        await self._ensure_imc_project_readable(row, user_id, marketing_db_pool)
        await self.sync_row_from_ugs(row)
        await self._db.refresh(row)
        if row.ugs_request_id is None:
            return ImcResearchStatusResponse(
                id=str(row.id),
                status=row.status,  # type: ignore[arg-type]
                progress=0.0,
                progress_message=None,
                ugs_request_id="",
            )
        try:
            st = await self._require_ugs().get_status(str(row.ugs_request_id))
        except ValueError:
            api_status = ugs_public_status_to_imc_api_status(row.status)
            return ImcResearchStatusResponse(
                id=str(row.id),
                status=api_status,  # type: ignore[arg-type]
                progress=0.0,
                progress_message=None,
                ugs_request_id=str(row.ugs_request_id),
            )
        api_status = ugs_public_status_to_imc_api_status(str(st.get("status")))
        prog = float(st.get("progress") or 0.0)
        return ImcResearchStatusResponse(
            id=str(row.id),
            status=api_status,  # type: ignore[arg-type]
            progress=prog,
            progress_message=st.get("progress_message") if isinstance(st.get("progress_message"), str) else None,
            ugs_request_id=str(row.ugs_request_id),
        )

    async def list_for_company(
        self,
        *,
        user_id: UUID,
        company_id: UUID,
        type_key: str | None,
        status: str | None,
        active_only: bool,
        limit: int,
        offset: int,
    ) -> tuple[int, list[ImcResearchRunSummary]]:
        filters = [
            ImcResearchRun.user_id == user_id,
            ImcResearchRun.company_id == company_id,
        ]
        if type_key:
            filters.append(ImcResearchRun.type_key == type_key)
        if active_only:
            filters.append(ImcResearchRun.status.in_(("pending", "running")))
        elif status:
            filters.append(ImcResearchRun.status == status)
        cnt_stmt = select(func.count()).select_from(ImcResearchRun).where(and_(*filters))
        total = int((await self._db.execute(cnt_stmt)).scalar_one())
        stmt = (
            select(ImcResearchRun, User.username, User.full_name, User.email)
            .outerjoin(User, User.id == ImcResearchRun.user_id)
            .where(and_(*filters))
            .order_by(ImcResearchRun.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        pairs = list((await self._db.execute(stmt)).all())
        return total, [
            self._row_to_summary(
                r,
                started_by_label=_format_started_by_label(fn, un, em),
            )
            for r, un, fn, em in pairs
        ]

    async def count_active_for_project(self, *, project_id: UUID) -> int:
        """COUNT pending/running IMC runs for project (rail/badge, без выборки строк)."""
        filters = [
            ImcResearchRun.project_id == project_id,
            ImcResearchRun.status.in_(("pending", "running")),
        ]
        cnt_stmt = select(func.count()).select_from(ImcResearchRun).where(and_(*filters))
        return int((await self._db.execute(cnt_stmt)).scalar_one())

    async def count_active_for_company(self, *, company_id: UUID) -> int:
        """COUNT pending/running IMC runs for company scope (toolbar Job Center)."""
        filters = [
            ImcResearchRun.company_id == company_id,
            ImcResearchRun.status.in_(("pending", "running")),
        ]
        cnt_stmt = select(func.count()).select_from(ImcResearchRun).where(and_(*filters))
        return int((await self._db.execute(cnt_stmt)).scalar_one())

    async def list_for_project(
        self,
        *,
        user_id: UUID,
        project_id: UUID,
        type_key: str | None,
        status: str | None,
        active_only: bool,
        limit: int,
        offset: int,
    ) -> tuple[int, list[ImcResearchRunSummary]]:
        filters = [
            ImcResearchRun.project_id == project_id,
        ]
        if type_key:
            filters.append(ImcResearchRun.type_key == type_key)
        if active_only:
            filters.append(ImcResearchRun.status.in_(("pending", "running")))
        elif status:
            filters.append(ImcResearchRun.status == status)
        cnt_stmt = select(func.count()).select_from(ImcResearchRun).where(and_(*filters))
        total = int((await self._db.execute(cnt_stmt)).scalar_one())
        stmt = (
            select(ImcResearchRun, User.username, User.full_name, User.email)
            .outerjoin(User, User.id == ImcResearchRun.user_id)
            .where(and_(*filters))
            .order_by(ImcResearchRun.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        pairs = list((await self._db.execute(stmt)).all())
        return total, [
            self._row_to_summary(
                r,
                started_by_label=_format_started_by_label(fn, un, em),
            )
            for r, un, fn, em in pairs
        ]

    async def cancel_research(
        self,
        research_id: UUID,
        user_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> str | None:
        """
        Returns: 'cancelled' | 'already_done' | None if not found.
        """
        row = await self._load_run_by_id(research_id)
        if row is None:
            return None
        row_mut: Any = row
        await self._ensure_imc_control_author_or_lead(row, user_id, marketing_db_pool)
        if row.ugs_request_id is None:
            row_mut.status = "cancelled"
            row_mut.completed_at = datetime.now(UTC).replace(tzinfo=None)
            await self._db.commit()
            return "cancelled"
        try:
            out = await self._require_ugs().cancel_generation(str(row.ugs_request_id), user_id=str(user_id))
        except PermissionError:
            raise
        except ValueError:
            return None
        msg = str(out.get("message") or "").lower()
        if "уже завершена" in msg or "already" in msg:
            return "already_done"
        row_mut.status = "cancelled"
        row_mut.completed_at = datetime.now(UTC).replace(tzinfo=None)
        await self._db.commit()
        return "cancelled"

    async def get_rag_hints(
        self,
        *,
        user_id: UUID,
        project_id: UUID,
        marketing_db_pool: asyncpg.Pool,
    ) -> ImcRagHintsResponse:
        from api.services.marketing_project_rag_service import (
            count_marketing_project_rag_points,
            count_vault_documents_with_text,
        )

        qn = await count_marketing_project_rag_points(
            marketing_db_pool,
            project_id=project_id,
            user_id=user_id,
        )
        vault_n = await count_vault_documents_with_text(
            marketing_db_pool,
            project_id=project_id,
            user_id=user_id,
        )
        weak = vault_n == 0 or (qn >= 0 and qn == 0)
        return ImcRagHintsResponse(
            project_id=str(project_id),
            qdrant_points_count=qn,
            vault_documents_with_text=vault_n,
            weak_coverage=weak,
        )

    async def rerun_research(
        self,
        *,
        user_id: UUID,
        research_id: UUID,
        marketing_db_pool: asyncpg.Pool | None,
    ) -> ImcRunResearchResponse:
        row = await self._load_run_by_id(research_id)
        if row is None:
            msg = "Запуск не найден"
            raise ValueError(msg)
        if marketing_db_pool is None or row.project_id is None:
            msg = "Для повтора запуска нужен маркетинговый пул и project_id в записи"
            raise ValueError(msg)
        await self._ensure_imc_control_author_or_lead(row, user_id, marketing_db_pool)
        from api.routers.marketing_cabinet.common import get_accessible_project

        await get_accessible_project(
            marketing_db_pool, row.project_id, user_id, for_mutation=True, required_mc_module="imc"
        )
        if row.status not in ("completed", "failed", "cancelled"):
            msg = "Повтор доступен только для завершённых, с ошибкой или отменённых запусков"
            raise ValueError(msg)
        if row.company_id is None or row.project_id is None:
            msg = "В записи запуска нет company_id или project_id"
            raise ValueError(msg)
        pl = row.input_payload if isinstance(row.input_payload, dict) else {}
        raw_ids = pl.get("input_file_ids")
        file_ids = [str(x) for x in raw_ids] if isinstance(raw_ids, list) else []
        su = pl.get("source_url")
        ctx_raw = pl.get("context")
        body = ImcRunResearchRequest(
            type_key=str(pl.get("type_key") or row.type_key or ""),
            company_id=str(row.company_id),
            project_id=str(row.project_id),
            input_file_ids=file_ids,
            source_url=str(su).strip() if su else None,
            context=dict(ctx_raw) if isinstance(ctx_raw, dict) else None,
            language="russian",
            idempotency_key=str(uuid.uuid4()),
            priority=int(pl.get("priority") or 5),
            workflow_key=None,
            use_web_search=pl.get("use_web_search") is True,
            web_search_quality=str(pl.get("web_search_quality") or "off"),  # type: ignore[arg-type]
        )
        return await self.run_research(
            user_id=user_id,
            body=body,
            marketing_db_pool=marketing_db_pool,
        )
