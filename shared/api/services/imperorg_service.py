# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ImperorG multi-phase orchestration for Site Studio: research -> strategy -> content -> SEO -> visuals -> apply.
# Invariants:
# - Phase failures are reported via SSE and must not poison subsequent phases with stale/expired ORM state.
# - JSON-only AI contracts are retried once for transient malformed responses.
# - Image and optional audio generation go through UnifiedGenerationService (no direct ComfyUIProvider).
# Related:
# - api/services/site_studio_ai_service.py
# - api/routers/site_studio_ai.py
# - documentation/product/UGS-AI-ROUTES-AUDIT.md
# ---
"""
ImperorG -- multi-phase AI pipeline orchestrator for Site Studio.

Takes user input + Content Studio document, enriches via SearXNG + Crawl4AI,
then sequentially generates brief, content packs, SEO, images and optionally
audio through UGS, yielding SSE events for every phase/step.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import os
import re
from collections.abc import AsyncGenerator, Mapping
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from api.core.http_clients import get_httpx_client
from api.models.desktop import UserSiteInstance
from api.services.crawl_service import scrape_url, truncate_markdown_for_context
from api.services.imperorg_search_utils import (
    build_imperorg_fallback_queries,
    build_imperorg_search_queries,
    count_imperorg_unique_domains,
    dedupe_imperorg_search_results,
    normalize_imperorg_search_queries,
    select_imperorg_crawl_urls,
    should_stop_imperorg_primary_search,
)
from api.services.search_service import WebSearchQuotaExceededError, format_search_results_for_prompt, web_search
from api.services.site_studio_ai_quality import validate_site_studio_content_blocks
from api.services.site_studio_ai_service import (
    _IMAGE_SLOTS,
    _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE,
    _SITE_STUDIO_IMAGE_WORKFLOW_KEY,
    SiteStudioAIError,
    SiteStudioAIService,
    site_studio_image_negative_prompt,
)
from api.services.ugs.flux2_klein import snap_flux2_klein_latent
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.ugs.z_image_prompt import sanitize_z_image_visual_prompt
from api.utils.llm_wall_clock_context import llm_wall_clock_system_section

logger = logging.getLogger(__name__)

_RESEARCH_CONTEXT_BUDGET = 8000
_CRAWL_CONTEXT_BUDGET = 6000
_SEARCH_QUERY_TIMEOUT_SEC = 12.0
_CRAWL_URL_TIMEOUT_SEC = 18.0
_SEARCH_EARLY_STOP_RESULTS_TARGET = 8
_SEARCH_EARLY_STOP_DOMAINS_TARGET = 2
_ENTITY_IMAGE_PRODUCTS_LIMIT = 100
_ENTITY_IMAGE_CONSULTATIONS_LIMIT = 100
_ENTITY_IMAGE_MASTERCLASSES_LIMIT = 100
_ENTITY_IMAGE_GALLERY_LIMIT = 100
# Empty tuple = no category filter (rewrite every gallery item). Env CSV or "*" overrides.
_ENTITY_IMAGE_GALLERY_ALLOWED_CATEGORIES: tuple[str, ...] = ()


@dataclass(frozen=True)
class ImperorGResearchTuning:
    """Runtime-tunable guardrails for research phase latency/quality."""

    research_context_budget: int = _RESEARCH_CONTEXT_BUDGET
    crawl_context_budget: int = _CRAWL_CONTEXT_BUDGET
    search_query_timeout_sec: float = _SEARCH_QUERY_TIMEOUT_SEC
    crawl_url_timeout_sec: float = _CRAWL_URL_TIMEOUT_SEC
    search_early_stop_results_target: int = _SEARCH_EARLY_STOP_RESULTS_TARGET
    search_early_stop_domains_target: int = _SEARCH_EARLY_STOP_DOMAINS_TARGET
    search_max_queries: int = 6
    fallback_max_queries: int = 2
    search_results_limit: int = 5
    crawl_url_limit: int = 2
    search_pause_sec: float = 1.0
    fallback_pause_sec: float = 0.8


@dataclass(frozen=True)
class ImperorGEntityImageTuning:
    """Runtime caps and filters for entity/gallery image rewrite stage."""

    products_limit: int = _ENTITY_IMAGE_PRODUCTS_LIMIT
    consultations_limit: int = _ENTITY_IMAGE_CONSULTATIONS_LIMIT
    masterclasses_limit: int = _ENTITY_IMAGE_MASTERCLASSES_LIMIT
    gallery_limit: int = _ENTITY_IMAGE_GALLERY_LIMIT
    # Empty tuple means "no category filter" (accept all categories).
    gallery_allowed_categories: tuple[str, ...] = _ENTITY_IMAGE_GALLERY_ALLOWED_CATEGORIES


def _read_env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("[ImperorG] Invalid %s=%r, using default %s", name, raw, default)
        return default
    if value < minimum:
        logger.warning(
            "[ImperorG] %s=%s is below minimum %s, using default %s",
            name,
            value,
            minimum,
            default,
        )
        return default
    return value


def _read_env_float(name: str, default: float, *, minimum: float = 0.1) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        logger.warning("[ImperorG] Invalid %s=%r, using default %.2f", name, raw, default)
        return default
    if value < minimum:
        logger.warning(
            "[ImperorG] %s=%.3f is below minimum %.3f, using default %.2f",
            name,
            value,
            minimum,
            default,
        )
        return default
    return value


def _read_env_csv_lower(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    if raw == "*":
        return tuple()

    values: list[str] = []
    for chunk in raw.split(","):
        normalized = chunk.strip().lower()
        if not normalized:
            continue
        if normalized not in values:
            values.append(normalized)

    if not values:
        logger.warning("[ImperorG] Invalid %s=%r, using default list", name, raw)
        return default
    return tuple(values)


def _load_imperorg_research_tuning() -> ImperorGResearchTuning:
    """Read ImperorG research tuning from environment with safe defaults."""
    return ImperorGResearchTuning(
        research_context_budget=_read_env_int(
            "IMPERORG_RESEARCH_CONTEXT_BUDGET",
            _RESEARCH_CONTEXT_BUDGET,
            minimum=1200,
        ),
        crawl_context_budget=_read_env_int(
            "IMPERORG_CRAWL_CONTEXT_BUDGET",
            _CRAWL_CONTEXT_BUDGET,
            minimum=800,
        ),
        search_query_timeout_sec=_read_env_float(
            "IMPERORG_SEARCH_QUERY_TIMEOUT_SEC",
            _SEARCH_QUERY_TIMEOUT_SEC,
            minimum=2.0,
        ),
        crawl_url_timeout_sec=_read_env_float(
            "IMPERORG_CRAWL_URL_TIMEOUT_SEC",
            _CRAWL_URL_TIMEOUT_SEC,
            minimum=3.0,
        ),
        search_early_stop_results_target=_read_env_int(
            "IMPERORG_SEARCH_EARLY_STOP_RESULTS_TARGET",
            _SEARCH_EARLY_STOP_RESULTS_TARGET,
            minimum=1,
        ),
        search_early_stop_domains_target=_read_env_int(
            "IMPERORG_SEARCH_EARLY_STOP_DOMAINS_TARGET",
            _SEARCH_EARLY_STOP_DOMAINS_TARGET,
            minimum=1,
        ),
        search_max_queries=_read_env_int("IMPERORG_SEARCH_MAX_QUERIES", 6, minimum=1),
        fallback_max_queries=_read_env_int("IMPERORG_FALLBACK_MAX_QUERIES", 2, minimum=1),
        search_results_limit=_read_env_int("IMPERORG_SEARCH_RESULTS_LIMIT", 5, minimum=1),
        crawl_url_limit=_read_env_int("IMPERORG_CRAWL_URL_LIMIT", 2, minimum=1),
        search_pause_sec=_read_env_float("IMPERORG_SEARCH_PAUSE_SEC", 1.0, minimum=0.0),
        fallback_pause_sec=_read_env_float("IMPERORG_FALLBACK_PAUSE_SEC", 0.8, minimum=0.0),
    )


def _load_imperorg_entity_image_tuning() -> ImperorGEntityImageTuning:
    """Read ImperorG entity-image stage tuning from environment."""
    return ImperorGEntityImageTuning(
        products_limit=_read_env_int(
            "IMPERORG_ENTITY_IMAGES_PRODUCTS_LIMIT",
            _ENTITY_IMAGE_PRODUCTS_LIMIT,
            minimum=0,
        ),
        consultations_limit=_read_env_int(
            "IMPERORG_ENTITY_IMAGES_CONSULTATIONS_LIMIT",
            _ENTITY_IMAGE_CONSULTATIONS_LIMIT,
            minimum=0,
        ),
        masterclasses_limit=_read_env_int(
            "IMPERORG_ENTITY_IMAGES_MASTERCLASSES_LIMIT",
            _ENTITY_IMAGE_MASTERCLASSES_LIMIT,
            minimum=0,
        ),
        gallery_limit=_read_env_int(
            "IMPERORG_ENTITY_IMAGES_GALLERY_LIMIT",
            _ENTITY_IMAGE_GALLERY_LIMIT,
            minimum=0,
        ),
        gallery_allowed_categories=_read_env_csv_lower(
            "IMPERORG_ENTITY_IMAGES_GALLERY_ALLOWED_CATEGORIES",
            _ENTITY_IMAGE_GALLERY_ALLOWED_CATEGORIES,
        ),
    )


IMPERORG_PHASES = [
    {"id": "research", "label": "Погружение в контекст", "icon": "search"},
    {"id": "strategy", "label": "Архитектура смысла", "icon": "compass"},
    {"id": "content_hero", "label": "Голос бренда", "icon": "megaphone"},
    {"id": "content_about", "label": "История", "icon": "book-open"},
    {"id": "content_trust", "label": "Доверие", "icon": "shield"},
    {"id": "content_formats", "label": "Форматы работы", "icon": "layers"},
    {"id": "content_catalog", "label": "Каталог на главной", "icon": "shopping-bag"},
    {"id": "content_about_depth", "label": "Экспертиза", "icon": "book-marked"},
    {"id": "content_page_heroes", "label": "Страницы витрины", "icon": "layout"},
    {"id": "content_cta", "label": "Призыв к действию", "icon": "target"},
    {"id": "seo", "label": "Видимость в сети", "icon": "globe"},
    {"id": "images", "label": "Визуальный язык", "icon": "palette"},
    {"id": "audio", "label": "Звуковая идентичность", "icon": "music"},
    {"id": "apply", "label": "Финализация и запуск", "icon": "rocket"},
]

_PHASE_TO_PACK = {
    "content_hero": "hero_pack",
    "content_about": "about_pack",
    "content_trust": "trust_pack",
    "content_formats": "formats_pack",
    "content_catalog": "catalog_section_pack",
    "content_about_depth": "about_depth_pack",
    "content_page_heroes": "page_heroes_pack",
    "content_cta": "cta_pack",
}

_IMPERORG_AUDIO_TYPE_KEY = "music_generator_generate_ace"


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _empty_apply_report() -> dict[str, Any]:
    return {
        "steps": {},
        "totals": {"applied": 0, "skipped": 0, "failed": 0, "retried": 0},
        "quality_findings": [],
    }


def _report_step(
    report: dict[str, Any],
    step_id: str,
    *,
    applied: int = 0,
    skipped: int = 0,
    failed: int = 0,
    retried: int = 0,
    status: str | None = None,
    summary: str | None = None,
    quality_findings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    steps = report.setdefault("steps", {})
    step = steps.setdefault(
        step_id,
        {"applied": 0, "skipped": 0, "failed": 0, "retried": 0, "status": "pending"},
    )
    for key, value in (("applied", applied), ("skipped", skipped), ("failed", failed), ("retried", retried)):
        step[key] = int(step.get(key) or 0) + int(value or 0)
        report["totals"][key] = int(report["totals"].get(key) or 0) + int(value or 0)
    if status:
        step["status"] = status
    if summary:
        step["summary"] = summary
    if quality_findings:
        step["quality_findings"] = [*step.get("quality_findings", []), *quality_findings]
        report["quality_findings"] = [*report.get("quality_findings", []), *quality_findings]
    return step


@dataclass
class ImperorGConfig:
    document_id: str | None = None
    user_prompt: str | None = None
    include_audio: bool = False
    use_web_search: bool = False
    search_queries: list[str] | None = None


@dataclass
class ImperorGContext:
    """Accumulates results across pipeline phases."""

    pipeline_id: str = field(default_factory=lambda: str(uuid4()))
    research_brief: str = ""
    document_text: str = ""
    search_results_text: str = ""
    crawl_text: str = ""
    blueprint: dict[str, Any] | None = None
    content_drafts: list[dict[str, Any]] = field(default_factory=list)
    seo_draft: dict[str, Any] | None = None
    image_drafts: list[dict[str, Any]] = field(default_factory=list)
    audio_draft: dict[str, Any] | None = None
    phase_errors: dict[str, str] = field(default_factory=dict)
    apply_report: dict[str, Any] = field(default_factory=_empty_apply_report)


class ImperorGService:
    """Orchestrates the full ImperorG pipeline."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._ai_service = SiteStudioAIService(db)
        self._research_tuning = _load_imperorg_research_tuning()
        self._entity_image_tuning = _load_imperorg_entity_image_tuning()

    async def close(self) -> None:
        await self._ai_service.close()

    @staticmethod
    def _filter_quality_accepted_blocks(
        blocks: list[dict[str, Any]],
        *,
        instance: UserSiteInstance,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        findings = validate_site_studio_content_blocks(
            blocks,
            site_title=str(getattr(instance, "site_title", "") or ""),
            site_topic=str(getattr(instance, "site_topic", "") or ""),
        )
        hard_identities = {
            (str(item.get("page") or ""), str(item.get("section") or ""), str(item.get("key") or ""))
            for item in findings
            if str(item.get("severity") or "") == "hard"
        }
        accepted = [
            block
            for block in blocks
            if (str(block.get("page") or ""), str(block.get("section") or ""), str(block.get("key") or ""))
            not in hard_identities
        ]
        return accepted, findings

    async def _reload_instance_by_id(self, instance_id: Any) -> UserSiteInstance | None:
        """Reload instance after rollback to avoid expired async-ORM state."""
        from sqlalchemy import select as sa_select

        try:
            result = await self.db.execute(sa_select(UserSiteInstance).where(UserSiteInstance.id == instance_id))
            return result.scalar_one_or_none()
        except Exception as exc:
            logger.warning("[ImperorG] Failed to reload instance %s: %s", instance_id, exc)
            return None

    async def _recreate_session_and_reload_instance(self, instance_id: Any) -> UserSiteInstance | None:
        """Recreate async session when current one enters MissingGreenlet state."""
        try:
            from api.core.database_manager import get_database_manager

            manager = await get_database_manager()
            factory = manager.postgres_session_factory
            if factory is None:
                raise RuntimeError("postgres_session_factory not initialized")
            new_session = factory()
            self.db = new_session
            self._ai_service = SiteStudioAIService(new_session)
            return await self._reload_instance_by_id(instance_id)
        except Exception as exc:
            logger.error("[ImperorG] Session recovery failed for %s: %s", instance_id, exc)
            return None

    def _active_phases(self, config: ImperorGConfig) -> list[dict[str, str]]:
        return [p for p in IMPERORG_PHASES if p["id"] != "audio" or config.include_audio]

    async def run_pipeline(
        self,
        instance: UserSiteInstance,
        user_id: str,
        config: ImperorGConfig,
    ) -> AsyncGenerator[str]:
        ctx = ImperorGContext()
        phases = self._active_phases(config)
        instance_id = instance.id

        yield _sse(
            "pipeline_start",
            {
                "pipeline_id": ctx.pipeline_id,
                "phases": phases,
                "total_phases": len(phases),
            },
        )

        for idx, phase_def in enumerate(phases):
            phase_id = phase_def["id"]
            yield _sse(
                "phase_start",
                {
                    "phase_id": phase_id,
                    "phase_index": idx,
                    "label": phase_def["label"],
                    "icon": phase_def["icon"],
                },
            )

            try:
                async for ev in self._run_phase(ctx, phase_id, instance, user_id, config):
                    yield ev
            except Exception as exc:
                logger.exception("[ImperorG] Phase %s failed", phase_id)
                ctx.phase_errors[phase_id] = str(exc)[:500]
                # SiteStudioAIError is a content-generation contract error; no DB rollback needed.
                # Rollback expires ORM attrs and can trigger MissingGreenlet on later phases.
                if isinstance(exc, SiteStudioAIError):
                    logger.info("[ImperorG] Skip rollback for AI contract error in phase %s", phase_id)
                else:
                    with contextlib.suppress(Exception):
                        await self.db.rollback()
                    refreshed = await self._reload_instance_by_id(instance_id)
                    if refreshed is not None:
                        instance = refreshed

                if "greenlet_spawn" in str(exc):
                    logger.warning("[ImperorG] MissingGreenlet detected, recreating session")
                    recovered = await self._recreate_session_and_reload_instance(instance_id)
                    if recovered is not None:
                        instance = recovered

                yield _sse(
                    "phase_step",
                    {
                        "phase_id": phase_id,
                        "step_id": "error",
                        "label": "Ошибка",
                        "status": "error",
                        "summary": str(exc)[:300],
                    },
                )

            yield _sse(
                "phase_complete",
                {
                    "phase_id": phase_id,
                    "phase_index": idx,
                },
            )

        summary_parts = []
        if ctx.blueprint:
            summary_parts.append("strategy")
        summary_parts.append(f"{len(ctx.content_drafts)} content packs")
        if ctx.seo_draft:
            summary_parts.append("SEO")
        summary_parts.append(f"{len(ctx.image_drafts)} images")
        if ctx.audio_draft:
            summary_parts.append("audio")
        errors = len(ctx.phase_errors)
        if errors:
            summary_parts.append(f"{errors} errors")

        yield _sse(
            "pipeline_complete",
            {
                "pipeline_id": ctx.pipeline_id,
                "summary": ", ".join(summary_parts),
                "drafts_count": len(ctx.content_drafts) + (1 if ctx.seo_draft else 0),
                "images_count": len(ctx.image_drafts),
                "errors": ctx.phase_errors if ctx.phase_errors else None,
                "apply_report": ctx.apply_report if ctx.apply_report.get("steps") else None,
            },
        )

    async def _run_phase(
        self,
        ctx: ImperorGContext,
        phase_id: str,
        instance: UserSiteInstance,
        user_id: str,
        config: ImperorGConfig,
    ) -> AsyncGenerator[str]:
        if phase_id == "research":
            async for ev in self._phase_research(ctx, instance, user_id, config):
                yield ev
        elif phase_id == "strategy":
            async for ev in self._phase_strategy(ctx, instance, user_id):
                yield ev
        elif phase_id in _PHASE_TO_PACK:
            async for ev in self._phase_content(ctx, instance, user_id, phase_id):
                yield ev
        elif phase_id == "seo":
            async for ev in self._phase_seo(ctx, instance, user_id):
                yield ev
        elif phase_id == "images":
            async for ev in self._phase_images(ctx, instance, user_id):
                yield ev
        elif phase_id == "audio":
            async for ev in self._phase_audio(ctx, instance, user_id):
                yield ev
        elif phase_id == "apply":
            async for ev in self._phase_apply(ctx, instance, user_id):
                yield ev

    # ------------------------------------------------------------------
    # Phase 1: Research
    # ------------------------------------------------------------------
    async def _phase_research(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
        config: ImperorGConfig,
    ) -> AsyncGenerator[str]:
        tuning = self._research_tuning
        research_started_at = perf_counter()
        search_telemetry: dict[str, Any] = {
            "query_attempts_primary": 0,
            "query_timeouts_primary": 0,
            "query_errors_primary": 0,
            "query_attempts_fallback": 0,
            "query_timeouts_fallback": 0,
            "query_errors_fallback": 0,
            "fallback_used": False,
            "early_stop_primary": False,
            "early_stop_target_hit": False,
            "results_raw": 0,
            "results_unique": 0,
            "result_unique_domains": 0,
            "crawl_candidates": 0,
            "crawl_attempts": 0,
            "crawl_timeouts": 0,
            "crawl_errors": 0,
            "crawl_success": 0,
            "elapsed_ms": 0.0,
            "search_max_queries": tuning.search_max_queries,
            "fallback_max_queries": tuning.fallback_max_queries,
            "crawl_url_limit": tuning.crawl_url_limit,
        }
        search_enabled = bool(config.use_web_search)
        if config.document_id:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "research",
                    "step_id": "document_load",
                    "label": "Изучение материалов",
                    "status": "running",
                },
            )
            ctx.document_text = await self._load_document_text(config.document_id)
            yield _sse(
                "phase_step",
                {
                    "phase_id": "research",
                    "step_id": "document_load",
                    "label": "Изучение материалов",
                    "status": "done",
                    "summary": f"{len(ctx.document_text)} символов" if ctx.document_text else "Документ пуст",
                },
            )
        yield ": keep-alive\n\n"

        yield _sse(
            "phase_step",
            {
                "phase_id": "research",
                "step_id": "web_search",
                "label": "Анализ рынка и конкурентов",
                "status": "running",
            },
        )
        raw_results: list[dict[str, str]] = []
        research_queries: list[str] = []
        if search_enabled:
            research_queries = (
                normalize_imperorg_search_queries(config.search_queries)
                if config.search_queries
                else self._build_search_queries(instance, config)
            )
            queries = research_queries
            query_cap = min(tuning.search_max_queries, 2)
            fallback_cap = min(tuning.fallback_max_queries, 1)
            logger.info("[ImperorG] Web search queries: %s", queries[:query_cap])
            empty_streak = 0
            quota_blocked = False
            for qi, q in enumerate(queries[:query_cap]):
                search_telemetry["query_attempts_primary"] += 1
                if qi > 0:
                    await asyncio.sleep(tuning.search_pause_sec)
                try:
                    async with asyncio.timeout(tuning.search_query_timeout_sec):
                        results = await web_search(
                            q,
                            limit=tuning.search_results_limit,
                            user_id=UUID(user_id),
                            db=self.db,
                            surface="imperorg",
                        )
                except WebSearchQuotaExceededError as exc:
                    quota_blocked = True
                    search_telemetry["query_errors_primary"] += 1
                    logger.info("[ImperorG] Query %r denied by quota: %s remaining", q, exc.status.total_remaining)
                    results = []
                except TimeoutError:
                    search_telemetry["query_timeouts_primary"] += 1
                    logger.warning(
                        "[ImperorG] Query %r timed out after %.1fs",
                        q,
                        tuning.search_query_timeout_sec,
                    )
                    results = []
                except Exception as exc:
                    search_telemetry["query_errors_primary"] += 1
                    logger.warning("[ImperorG] Query %r failed: %s", q, exc)
                    results = []
                logger.info("[ImperorG] Query %r returned %d results", q, len(results))
                if quota_blocked:
                    break
                if results:
                    raw_results.extend(results)
                    empty_streak = 0
                    if should_stop_imperorg_primary_search(
                        raw_results,
                        min_unique_results=tuning.search_early_stop_results_target,
                        min_unique_domains=tuning.search_early_stop_domains_target,
                    ):
                        search_telemetry["early_stop_target_hit"] = True
                        logger.info(
                            "[ImperorG] Early-stop primary search after target hit (>= %d results, >= %d domains)",
                            tuning.search_early_stop_results_target,
                            tuning.search_early_stop_domains_target,
                        )
                        break
                else:
                    empty_streak += 1
                # Optimization: when search backend gives consecutive empty answers,
                # stop extra probes and switch to lighter fallback strategy.
                if empty_streak >= 2 and not raw_results:
                    search_telemetry["early_stop_primary"] = True
                    logger.info("[ImperorG] Early-stop primary search after %d empty responses", empty_streak)
                    break

            if not raw_results and not config.search_queries and not quota_blocked:
                search_telemetry["fallback_used"] = True
                fallback_queries = self._build_search_fallback_queries(instance, config)
                logger.info(
                    "[ImperorG] Primary search empty, trying fallback queries: %s", fallback_queries[:fallback_cap]
                )
                for qi, q in enumerate(fallback_queries[:fallback_cap]):
                    search_telemetry["query_attempts_fallback"] += 1
                    if qi > 0:
                        await asyncio.sleep(tuning.fallback_pause_sec)
                    try:
                        async with asyncio.timeout(tuning.search_query_timeout_sec):
                            fallback_results = await web_search(
                                q,
                                limit=tuning.search_results_limit,
                                user_id=UUID(user_id),
                                db=self.db,
                                surface="imperorg",
                            )
                    except WebSearchQuotaExceededError as exc:
                        search_telemetry["query_errors_fallback"] += 1
                        logger.info(
                            "[ImperorG] Fallback query %r denied by quota: %s remaining",
                            q,
                            exc.status.total_remaining,
                        )
                        fallback_results = []
                    except TimeoutError:
                        search_telemetry["query_timeouts_fallback"] += 1
                        logger.warning(
                            "[ImperorG] Fallback query %r timed out after %.1fs",
                            q,
                            tuning.search_query_timeout_sec,
                        )
                        fallback_results = []
                    except Exception as exc:
                        search_telemetry["query_errors_fallback"] += 1
                        logger.warning("[ImperorG] Fallback query %r failed: %s", q, exc)
                        fallback_results = []
                    logger.info("[ImperorG] Fallback query %r returned %d results", q, len(fallback_results))
                    raw_results.extend(fallback_results)
                    if fallback_results:
                        break

        elif config.search_queries:
            research_queries = normalize_imperorg_search_queries(config.search_queries)
        else:
            research_queries = self._build_search_queries(instance, config)

        all_results = dedupe_imperorg_search_results(raw_results)
        search_telemetry["results_raw"] = len(raw_results)
        search_telemetry["results_unique"] = len(all_results)
        search_telemetry["result_unique_domains"] = count_imperorg_unique_domains(all_results)
        ctx.search_results_text = format_search_results_for_prompt(all_results, max_total_chars=3000)
        kbsew_query = research_queries[0] if research_queries else ""
        if kbsew_query:
            from api.services.kbsew.kbsew_agent_runtime import resolve_kbsew_context_for_surface

            kbsew_block = await resolve_kbsew_context_for_surface(
                agent_id="imperorg",
                query=str(kbsew_query),
                db=self.db,
                max_total_chars=2500,
            )
            if kbsew_block:
                ctx.search_results_text = (
                    f"{ctx.search_results_text.rstrip()}\n\n{kbsew_block}".strip()
                    if ctx.search_results_text
                    else kbsew_block
                )
        search_summary = f"{len(all_results)} результатов"
        if not search_enabled:
            search_summary = "выключен пользователем (используем локальный бриф без web-контекста)"
        elif not all_results:
            search_summary = "0 результатов (используем локальный бриф без web-контекста)"
        yield _sse(
            "phase_step",
            {
                "phase_id": "research",
                "step_id": "web_search",
                "label": "Анализ рынка и конкурентов",
                "status": "done",
                "summary": search_summary,
                "telemetry": {
                    "fallback_used": search_telemetry["fallback_used"],
                    "timeouts_total": search_telemetry["query_timeouts_primary"]
                    + search_telemetry["query_timeouts_fallback"],
                    "unique_domains": search_telemetry["result_unique_domains"],
                    "early_stop_target_hit": search_telemetry["early_stop_target_hit"],
                },
            },
        )
        yield ": keep-alive\n\n"

        crawl_urls = select_imperorg_crawl_urls(all_results, limit=tuning.crawl_url_limit)
        search_telemetry["crawl_candidates"] = len(crawl_urls)
        if crawl_urls:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "research",
                    "step_id": "deep_analysis",
                    "label": "Глубокий анализ источников",
                    "status": "running",
                },
            )
            crawl_parts: list[str] = []
            for url in crawl_urls:
                search_telemetry["crawl_attempts"] += 1
                try:
                    async with asyncio.timeout(tuning.crawl_url_timeout_sec):
                        raw = await scrape_url(url)
                    if raw:
                        crawl_parts.append(truncate_markdown_for_context(raw, tuning.crawl_context_budget))
                        search_telemetry["crawl_success"] += 1
                except TimeoutError:
                    search_telemetry["crawl_timeouts"] += 1
                    logger.warning(
                        "[ImperorG] Crawl timed out for %s after %.1fs",
                        url[:120],
                        tuning.crawl_url_timeout_sec,
                    )
                except Exception:
                    search_telemetry["crawl_errors"] += 1
                    logger.warning("[ImperorG] Crawl failed for %s", url[:120])
            ctx.crawl_text = "\n\n---\n\n".join(crawl_parts)[: tuning.crawl_context_budget]
            yield _sse(
                "phase_step",
                {
                    "phase_id": "research",
                    "step_id": "deep_analysis",
                    "label": "Глубокий анализ источников",
                    "status": "done",
                    "summary": f"{len(crawl_parts)} источников обработано",
                    "telemetry": {
                        "attempts": search_telemetry["crawl_attempts"],
                        "timeouts": search_telemetry["crawl_timeouts"],
                    },
                },
            )

        parts = [llm_wall_clock_system_section()]
        if config.user_prompt:
            parts.append(f"Описание проекта от пользователя:\n{config.user_prompt[:2000]}")
        if ctx.document_text:
            parts.append(f"Из документа:\n{ctx.document_text[:3000]}")
        if ctx.search_results_text:
            parts.append(f"Результаты веб-исследования:\n{ctx.search_results_text}")
        if ctx.crawl_text:
            parts.append(f"Глубокий анализ источников:\n{ctx.crawl_text[:2000]}")
        ctx.research_brief = "\n\n".join(parts)[: tuning.research_context_budget]
        search_telemetry["elapsed_ms"] = round((perf_counter() - research_started_at) * 1000.0, 1)
        logger.info(
            "[ImperorG] Research telemetry: %s", json.dumps(search_telemetry, ensure_ascii=False, sort_keys=True)
        )

    # ------------------------------------------------------------------
    # Phase 2: Strategy
    # ------------------------------------------------------------------
    async def _phase_strategy(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> AsyncGenerator[str]:
        yield _sse(
            "phase_step",
            {
                "phase_id": "strategy",
                "step_id": "blueprint",
                "label": "Формирование идентичности",
                "status": "running",
            },
        )

        enriched_prompt = (
            (instance.site_topic or instance.site_title or "")
            + "\n\n--- Контекст исследования ---\n"
            + ctx.research_brief
        )

        result = await self._ai_service.generate_brief_blueprint(
            instance,
            user_id=user_id,
            prompt=enriched_prompt,
        )

        ctx.blueprint = (result or {}).get("siteBlueprint")

        yield _sse(
            "phase_step",
            {
                "phase_id": "strategy",
                "step_id": "blueprint",
                "label": "Формирование идентичности",
                "status": "done",
                "summary": "Стратегия и blueprint готовы",
            },
        )

    # ------------------------------------------------------------------
    # Content pack phases (hero, about, trust, formats, catalog, …)
    # ------------------------------------------------------------------
    async def _phase_content(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
        phase_id: str,
    ) -> AsyncGenerator[str]:
        pack_key = _PHASE_TO_PACK[phase_id]

        yield _sse(
            "phase_step",
            {
                "phase_id": phase_id,
                "step_id": "generate",
                "label": "Создание контента",
                "status": "running",
            },
        )

        result: dict[str, Any] | None = None
        for attempt in range(2):
            try:
                result = await self._ai_service.generate_content_pack(
                    instance,
                    user_id=user_id,
                    pack_key=pack_key,
                )
                break
            except SiteStudioAIError as exc:
                retryable_contract_errors = (
                    "AI returned invalid JSON",
                    "Content pack JSON is missing blocks",
                    "Content pack generation returned empty values",
                )
                if attempt > 0 or not any(token in str(exc) for token in retryable_contract_errors):
                    raise
                logger.info("[ImperorG] %s transient content-pack error, retrying once: %s", pack_key, exc)
                await asyncio.sleep(0.5)

        if result is None:
            raise SiteStudioAIError(f"Failed to generate content pack: {pack_key}")

        draft = result.get("draft", {})
        ctx.content_drafts.append(draft)

        yield _sse(
            "phase_step",
            {
                "phase_id": phase_id,
                "step_id": "generate",
                "label": "Создание контента",
                "status": "done",
                "summary": draft.get("title", pack_key),
            },
        )

    # ------------------------------------------------------------------
    # Phase 6: SEO
    # ------------------------------------------------------------------
    async def _phase_seo(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> AsyncGenerator[str]:
        yield _sse(
            "phase_step",
            {
                "phase_id": "seo",
                "step_id": "generate",
                "label": "Оптимизация позиционирования",
                "status": "running",
            },
        )

        result = await self._ai_service.generate_seo_pack(
            instance,
            user_id=user_id,
        )

        ctx.seo_draft = result.get("draft")

        yield _sse(
            "phase_step",
            {
                "phase_id": "seo",
                "step_id": "generate",
                "label": "Оптимизация позиционирования",
                "status": "done",
                "summary": (ctx.seo_draft or {}).get("title", "SEO Pack"),
            },
        )

    # ------------------------------------------------------------------
    # Phase 7: Images
    # ------------------------------------------------------------------
    async def _phase_images(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> AsyncGenerator[str]:
        shared_ugs = UnifiedGenerationService(self.db)
        try:
            logger.info("[ImperorG] Reusing shared UGS client for %d image slots", len(_IMAGE_SLOTS))
            for slot_idx, slot in enumerate(_IMAGE_SLOTS):
                slot_id = slot["slotId"]
                step_id = f"image_{slot_idx}"
                yield _sse(
                    "phase_step",
                    {
                        "phase_id": "images",
                        "step_id": step_id,
                        "label": slot["title"],
                        "status": "running",
                    },
                )

                try:
                    image_result = await self._generate_single_image(
                        instance,
                        user_id,
                        slot_id,
                        ugs_service=shared_ugs,
                    )
                    ctx.image_drafts.append(image_result)
                    yield _sse(
                        "phase_step",
                        {
                            "phase_id": "images",
                            "step_id": step_id,
                            "label": slot["title"],
                            "status": "done",
                            "summary": image_result.get("slotId", slot_id),
                        },
                    )
                except Exception as exc:
                    logger.warning("[ImperorG] Image %s failed: %s", slot_id, exc)
                    yield _sse(
                        "phase_step",
                        {
                            "phase_id": "images",
                            "step_id": step_id,
                            "label": slot["title"],
                            "status": "error",
                            "summary": str(exc)[:200],
                        },
                    )

                yield ": keep-alive\n\n"
        finally:
            await shared_ugs.close()

    async def _generate_single_image(
        self,
        instance: UserSiteInstance,
        user_id: str,
        slot_id: str,
        *,
        ugs_service: UnifiedGenerationService | None = None,
    ) -> dict[str, Any]:
        from api.routers.site_studio_ai import _normalize_site_studio_image_result

        gen_payload = self._ai_service.build_image_generation_input(instance, slot_id=slot_id)
        slot = gen_payload["slot"]
        input_data = gen_payload["input"]

        active_ugs = ugs_service or UnifiedGenerationService(self.db)
        owns_ugs = ugs_service is None
        try:
            start_payload = await active_ugs.start_generation_for_stream(
                user_id=user_id,
                type_key="image_generation_comfyui",
                input_data=input_data,
                priority=5,
                idempotency_key=self._build_entity_image_idempotency_key(
                    instance=instance,
                    entity_kind="slot",
                    entity_id=str(slot.get("slotId") or slot_id),
                    prompt=str(input_data.get("prompt") or ""),
                ),
            )

            if start_payload.get("status") == "completed":
                normalized = _normalize_site_studio_image_result(start_payload)
                image_url = (normalized or {}).get("image_url") or (normalized or {}).get("imageUrl")
                if not image_url:
                    logger.warning(
                        "[ImperorG] Immediate result has no image_url. payload keys: %s", list(start_payload.keys())
                    )
                    raise RuntimeError("No image URL in immediate UGS result")
                return await self._save_image_draft(instance, slot, input_data, image_url)

            request_id = start_payload.get("request_id")
            if not request_id:
                raise RuntimeError("No request_id from UGS")

            async for event in active_ugs.stream_generation_events(
                request_id,
                user_id,
                poll_interval=2.5,
                keep_alive_interval=8.0,
            ):
                event_type = event.get("event", "")
                if event_type == "result":
                    result_data = event.get("data") or event.get("result") or event
                    normalized = _normalize_site_studio_image_result(result_data)
                    image_url = (normalized or {}).get("image_url") or (normalized or {}).get("imageUrl")
                    if not image_url:
                        logger.warning(
                            "[ImperorG] UGS stream result has no image_url. normalized keys: %s, result_data keys: %s",
                            list((normalized or {}).keys()),
                            list(result_data.keys()) if isinstance(result_data, dict) else type(result_data).__name__,
                        )
                        raise RuntimeError("No image URL in UGS stream result")
                    return await self._save_image_draft(instance, slot, input_data, image_url)
                if event_type == "error":
                    raise RuntimeError(event.get("error", "UGS image generation failed"))

            raise RuntimeError("UGS stream ended without result")
        finally:
            if owns_ugs:
                await active_ugs.close()

    async def _save_image_draft(
        self,
        instance: UserSiteInstance,
        slot: dict[str, Any],
        input_data: dict[str, Any],
        image_url: str,
    ) -> dict[str, Any]:
        result = await self._ai_service.save_image_draft(
            instance,
            slot_id=slot["slotId"],
            image_url=image_url,
            prompt=input_data["prompt"],
            negative_prompt=input_data.get("negative_prompt"),
            width=input_data.get("width"),
            height=input_data.get("height"),
        )
        return result.get("draft", {})

    # ------------------------------------------------------------------
    # Phase 8: Audio (optional) -- UGS music_generator_generate_ace (Comfy via bus)
    # ------------------------------------------------------------------
    async def _phase_audio(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> AsyncGenerator[str]:
        from api.routers.music_generator_generate_support import unwrap_audio_block

        yield _sse(
            "phase_step",
            {
                "phase_id": "audio",
                "step_id": "generate",
                "label": "Создание звуковой идентичности",
                "status": "running",
            },
        )

        brand_mood = ""
        if ctx.blueprint:
            mood_parts = []
            if ctx.blueprint.get("brandCore"):
                mood_parts.append(str(ctx.blueprint["brandCore"]))
            if ctx.blueprint.get("toneOfVoice"):
                tone = ctx.blueprint["toneOfVoice"]
                mood_parts.append(", ".join(tone) if isinstance(tone, list) else str(tone))
            if ctx.blueprint.get("heroMood"):
                mood_parts.append(str(ctx.blueprint["heroMood"]))
            brand_mood = ". ".join(mood_parts)

        site_name = instance.site_topic or instance.site_title or "brand"
        tags = f"ambient, brand music, {site_name}"
        if brand_mood:
            tags += f", {brand_mood[:200]}"
        tags = tags[:2000]

        input_data: dict[str, Any] = {
            "tags": tags,
            "lyrics": "",
            "duration": 30,
            "language": "en",
        }
        idempotency_key = f"imperorg:audio:{instance.id}:{hashlib.sha256(tags.encode('utf-8')).hexdigest()[:16]}"

        active_ugs = UnifiedGenerationService(self.db)
        try:
            resp = await active_ugs.generate(
                user_id=user_id,
                type_key=_IMPERORG_AUDIO_TYPE_KEY,
                input_data=input_data,
                idempotency_key=idempotency_key,
            )
        except Exception as exc:
            logger.warning("[ImperorG] Audio UGS generation failed: %s", exc)
            yield _sse(
                "phase_step",
                {
                    "phase_id": "audio",
                    "step_id": "generate",
                    "label": "Создание звуковой идентичности",
                    "status": "error",
                    "summary": str(exc)[:200],
                },
            )
            return
        finally:
            await active_ugs.close()

        if str(resp.get("status") or "") != "completed":
            summary = str(resp.get("message") or resp.get("error") or "UGS audio did not complete")[:200]
            yield _sse(
                "phase_step",
                {
                    "phase_id": "audio",
                    "step_id": "generate",
                    "label": "Создание звуковой идентичности",
                    "status": "error",
                    "summary": summary,
                },
            )
            return

        audio_list = unwrap_audio_block(resp).get("audio") or []
        if audio_list:
            ctx.audio_draft = {"status": "completed", "result": resp.get("result") or resp}
            yield _sse(
                "phase_step",
                {
                    "phase_id": "audio",
                    "step_id": "generate",
                    "label": "Создание звуковой идентичности",
                    "status": "done",
                    "summary": "Аудио готово",
                },
            )
        else:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "audio",
                    "step_id": "generate",
                    "label": "Создание звуковой идентичности",
                    "status": "error",
                    "summary": "UGS вернул пустой аудиорезультат",
                },
            )

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Helper: login to site admin API and get JWT token
    # ------------------------------------------------------------------
    async def _get_site_admin_token(self, api_base: str, instance: UserSiteInstance) -> str | None:
        from api.services.site_studio_runtime_service import decrypt_site_studio_secret

        decrypted_password = decrypt_site_studio_secret(instance.admin_password_encrypted or "")
        if not decrypted_password:
            logger.warning("[ImperorG] No admin password for site %s", instance.site_slug)
            return None
        try:
            client = get_httpx_client()
            resp = await client.post(
                f"{api_base}/admin/login",
                json={"email": instance.admin_email, "password": decrypted_password},
                timeout=15,
            )
            resp.raise_for_status()
            token = resp.json().get("token")
            if token:
                logger.info("[ImperorG] Admin login OK for %s", instance.site_slug)
                return str(token)
        except Exception as exc:
            logger.error("[ImperorG] Admin login failed for %s: %s", instance.site_slug, exc)
        return None

    # ------------------------------------------------------------------
    # Helper: PUT/PATCH to site API with auth, check response body
    # ------------------------------------------------------------------
    async def _site_api_write(
        self,
        method: str,
        url: str,
        token: str,
        json_body: dict[str, Any],
    ) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {token}"}
        client = get_httpx_client()
        if method.upper() == "PATCH":
            resp = await client.patch(url, json=json_body, headers=headers, timeout=30)
        else:
            resp = await client.put(url, json=json_body, headers=headers, timeout=30)
        resp.raise_for_status()
        body = resp.json()
        if isinstance(body, dict) and body.get("success") is False:
            raise RuntimeError(f"Site API rejected: {body.get('message', 'unknown')}")
        return body

    @staticmethod
    def _extract_batch_rewrite_updates(
        rewritten_blocks: Any,
        *,
        batch: list[dict[str, Any]],
    ) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
        """Normalize batch rewrite output and return (updates, missing-blocks)."""
        batch_by_identity: dict[tuple[str, str, str], dict[str, Any]] = {}
        batch_by_key: dict[str, list[tuple[str, str, str]]] = {}
        for block in batch:
            page = str(block.get("page") or "").strip()
            section = str(block.get("section") or "").strip()
            key = str(block.get("key") or "").strip()
            if not (page and section and key):
                continue
            identity = (page, section, key)
            batch_by_identity[identity] = block
            batch_by_key.setdefault(key, []).append(identity)

        updates_by_identity: dict[tuple[str, str, str], dict[str, str]] = {}
        if isinstance(rewritten_blocks, list):
            for item in rewritten_blocks:
                if not isinstance(item, Mapping):
                    continue
                value = str(item.get("value") or "").strip()
                if not value:
                    continue

                identity = (
                    str(item.get("page") or "").strip(),
                    str(item.get("section") or "").strip(),
                    str(item.get("key") or "").strip(),
                )
                if identity not in batch_by_identity:
                    key_matches = batch_by_key.get(identity[2], [])
                    if len(key_matches) != 1:
                        continue
                    identity = key_matches[0]

                updates_by_identity[identity] = {
                    "page": identity[0],
                    "section": identity[1],
                    "key": identity[2],
                    "value": value,
                }

        missing_blocks = [
            block
            for block in batch
            if (block.get("page"), block.get("section"), block.get("key")) not in updates_by_identity
        ]
        return list(updates_by_identity.values()), missing_blocks

    async def _rewrite_single_remaining_block(
        self,
        *,
        block: dict[str, Any],
        brand_context: str,
        user_id: str,
    ) -> str | None:
        """Fallback rewrite for one unresolved content block."""
        page = str(block.get("page") or "").strip()
        section = str(block.get("section") or "").strip()
        key = str(block.get("key") or "").strip()
        if not (page and section and key):
            return None

        prompt = (
            "Перепиши ОДИН контент-блок под бренд клиента. "
            "Сохрани стиль и лимит maxLength, язык — русский. "
            "Ответь ТОЛЬКО валидным JSON без markdown.\n"
            'Формат: {"value":"..."}'
        )
        context = (
            f"{brand_context}\n\n"
            "Блок для перезаписи:\n"
            f'- page="{page}", section="{section}", key="{key}", '
            f"maxLength={int(block.get('maxLength', 300) or 300)}, "
            f'current="{str(block.get("value", ""))[:180]}"'
        )

        try:
            parsed = await self._ai_service._complete_json_prompt(
                prompt=prompt,
                context=context,
                user_id=user_id,
                temperature=0.35,
                max_tokens=800,
            )
        except Exception as exc:
            logger.warning("[ImperorG] Single-block rewrite failed for %s.%s.%s: %s", page, section, key, exc)
            return None

        if not isinstance(parsed, Mapping):
            return None
        value = str(parsed.get("value") or "").strip()
        return value or None

    # Phase 9: Apply — full dynamic rewrite + apply
    # ------------------------------------------------------------------
    async def _phase_apply(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> AsyncGenerator[str]:
        from api.services.site_studio_runtime_service import build_site_studio_internal_api_base_url

        api_base = build_site_studio_internal_api_base_url(instance.compose_project_name)

        if not api_base:
            instance_id = str(instance.id)
            owner_user_id = str(instance.user_id)
            need_provision = not (instance.compose_file_path or "").strip()
            task_type = "site_studio_provision" if need_provision else "site_studio_start"
            from api.services.site_studio_lifecycle_jobs import (
                create_lifecycle_job,
                mark_lifecycle_job_failed,
                mark_lifecycle_job_queued,
            )

            job_id = await create_lifecycle_job(
                self.db,
                instance=instance,
                instance_scope="user",
                task_type=task_type,
                metadata={"source": "imperorg_apply"},
            )
            inst_mut: Any = instance
            inst_mut.status = "provisioning" if need_provision else "starting"
            inst_mut.last_error = None
            await self.db.commit()

            payload = {
                "task_type": task_type,
                "instance_id": instance_id,
                "user_id": owner_user_id,
                "instance_scope": "user",
                "job_id": str(job_id),
            }

            from api.services.queue_features import QUEUE_FLAG_SITE_STUDIO, env_flag, is_queue_enabled
            from api.services.rabbitmq_service import QUEUE_SITE_STUDIO, get_rabbitmq_service
            from api.services.site_studio_runtime_service import execute_site_studio_runtime_task as _exec_ss

            published = False
            ran_inline = False
            if not is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
                await mark_lifecycle_job_queued(self.db, job_id, queued=False)
                await self.db.commit()
                asyncio.create_task(_exec_ss(instance.id, task_type, instance_scope="user", job_id=job_id))
                ran_inline = True
            else:
                published = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
                if published:
                    await mark_lifecycle_job_queued(self.db, job_id, queued=True)
                    await self.db.commit()

            if (
                not ran_inline
                and not published
                and env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False)
            ):
                await mark_lifecycle_job_queued(self.db, job_id, queued=False)
                await self.db.commit()
                asyncio.create_task(_exec_ss(instance.id, task_type, instance_scope="user", job_id=job_id))
                ran_inline = True
            if not published and not ran_inline:
                from api.monitoring.metrics import record_site_studio_queue_publish_failure

                record_site_studio_queue_publish_failure(task_type=task_type)
                await mark_lifecycle_job_failed(
                    self.db,
                    job_id,
                    stage="queue_publish_failed",
                    error="RabbitMQ publish failed",
                )
                await self.db.commit()
                yield _sse(
                    "phase_step",
                    {
                        "phase_id": "apply",
                        "step_id": "runtime_start",
                        "label": "Запуск сайта",
                        "status": "error",
                        "summary": (
                            "Не удалось поставить задачу Site Studio в RabbitMQ. "
                            "Проверьте брокер и site-studio-worker или включите "
                            "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK=1 (только dev)."
                        ),
                    },
                )
                return

            label = "Provision запущен" if need_provision else "Запуск инициирован"
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "runtime_start",
                    "label": "Запуск сайта",
                    "status": "done",
                    "summary": f"{label} — нажмите «Применить + Запуск» когда сайт будет готов",
                },
            )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "complete",
                    "label": "Черновики сохранены",
                    "status": "done",
                    "summary": "Сайт запускается. Используйте кнопки ниже для применения.",
                },
            )
            return

        yield ": keep-alive\n\n"

        # --- Authenticate with site admin API ---
        admin_token = await self._get_site_admin_token(api_base, instance)
        if not admin_token:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "auth_error",
                    "label": "Авторизация в API сайта",
                    "status": "error",
                    "summary": "Не удалось авторизоваться — проверьте admin credentials",
                },
            )
            return

        # --- Step 1: apply existing generated drafts ---
        applied_keys: set[tuple[str, str, str]] = set()
        if ctx.content_drafts:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "content",
                    "label": "Применение сгенерированного контента",
                    "status": "running",
                },
            )
            all_blocks: list[dict[str, Any]] = []
            for draft in ctx.content_drafts:
                for block in draft.get("blocks", []):
                    if block.get("value"):
                        all_blocks.append(
                            {
                                "page": block["page"],
                                "section": block["section"],
                                "key": block["key"],
                                "value": block["value"],
                                "maxLength": block.get("maxLength"),
                            }
                        )
                        applied_keys.add((block["page"], block["section"], block["key"]))
            accepted_blocks, quality_findings = self._filter_quality_accepted_blocks(all_blocks, instance=instance)
            skipped_by_quality = len(all_blocks) - len(accepted_blocks)
            accepted_identities = {
                (str(block.get("page") or ""), str(block.get("section") or ""), str(block.get("key") or ""))
                for block in accepted_blocks
            }
            applied_keys.intersection_update(accepted_identities)
            wire_blocks = [
                {
                    "page": block["page"],
                    "section": block["section"],
                    "key": block["key"],
                    "value": block["value"],
                }
                for block in accepted_blocks
            ]
            write_failed = False
            if wire_blocks:
                try:
                    await self._site_api_write(
                        "PUT", f"{api_base}/content/blocks/bulk", admin_token, {"blocks": wire_blocks}
                    )
                except Exception as exc:
                    write_failed = True
                    logger.warning("[ImperorG] Apply generated content failed: %s", exc)
            _report_step(
                ctx.apply_report,
                "content",
                applied=0 if write_failed else len(wire_blocks),
                skipped=skipped_by_quality,
                failed=len(wire_blocks) if write_failed else 0,
                status="error" if write_failed or skipped_by_quality else "done",
                summary=f"{len(wire_blocks)} applied, {skipped_by_quality} skipped by quality",
                quality_findings=quality_findings,
            )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "content",
                    "label": "Применение сгенерированного контента",
                    "status": "error" if write_failed else "done",
                    "summary": f"{len(wire_blocks)} блоков; quality-skip: {skipped_by_quality}",
                    "report": ctx.apply_report["steps"].get("content"),
                },
            )

        yield ": keep-alive\n\n"

        if ctx.seo_draft:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "seo",
                    "label": "Применение SEO",
                    "status": "running",
                },
            )
            site_settings = ctx.seo_draft.get("siteSettings", {})
            try:
                await self._site_api_write(
                    "PATCH",
                    f"{api_base}/admin/site-settings",
                    admin_token,
                    {
                        "siteTitle": site_settings.get("siteTitle", instance.site_title),
                        "siteDescription": site_settings.get("siteDescription", instance.site_topic or ""),
                    },
                )
                _report_step(ctx.apply_report, "seo", applied=1, status="done", summary="Site settings SEO updated")
            except Exception as exc:
                _report_step(ctx.apply_report, "seo", failed=1, status="error", summary=str(exc)[:160])
                logger.warning("[ImperorG] Apply SEO failed: %s", exc)
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "seo",
                    "label": "Применение SEO",
                    "status": ctx.apply_report["steps"].get("seo", {}).get("status", "done"),
                    "report": ctx.apply_report["steps"].get("seo"),
                },
            )

        yield ": keep-alive\n\n"

        # --- Step 2: fetch ALL blocks from site, rewrite uncovered ones ---
        yield _sse(
            "phase_step",
            {
                "phase_id": "apply",
                "step_id": "full_rewrite",
                "label": "Адаптация всего контента сайта",
                "status": "running",
                "summary": "Загрузка блоков...",
            },
        )

        remaining: list[dict[str, Any]] = []
        try:
            client = get_httpx_client()
            resp = await client.get(f"{api_base}/content/blocks", timeout=30)
            resp.raise_for_status()
            raw = resp.json()
            site_blocks = raw.get("data", raw) if isinstance(raw, dict) else raw
            if isinstance(site_blocks, list):
                for b in site_blocks:
                    if not isinstance(b, dict):
                        continue
                    bk = (b.get("page", ""), b.get("section", ""), b.get("key", ""))
                    if bk not in applied_keys:
                        remaining.append(b)
        except Exception as exc:
            logger.warning("[ImperorG] Failed to fetch site blocks: %s", exc)

        if remaining:
            draft_state = self._ai_service.get_draft_state(instance)
            brand_context = (
                f"БРЕНД КЛИЕНТА: {instance.site_title}\n"
                f"Позиционирование / тема: {instance.site_topic or 'не указана'}\n"
                f"Шаблон (ключ): {(instance.template_key or 'olenti').strip().lower()}\n"
                "Структура шаблона: витрина (каталог), консультации, мастер-классы, блоки about/home. "
                "Адаптируй контент СТРОГО под тематику клиента, сохраняя структуру page/section/key.\n"
                f"Brief: {(draft_state.get('brief') or '')[:800]}\n"
                f"Blueprint: {json.dumps(draft_state.get('siteBlueprint') or {}, ensure_ascii=False)[:600]}\n"
                f"Поисковый контекст: {ctx.search_results_text[:600]}"
            )
            rewrite_prompt = (
                "Перепиши ВСЕ блоки ниже под бренд клиента. "
                "Сохрани формат, уложись в maxLength, язык — русский. "
                "Не используй чужие демо-имена брендов и устаревшие отраслевые клише, если они не соответствуют теме клиента. "
                "ВАЖНО: ответь ТОЛЬКО валидным JSON без markdown.\n"
                'Формат: {"blocks":[{"page":"...","section":"...","key":"...","value":"..."}]}'
            )
            total_rewritten = 0
            unresolved_blocks: list[tuple[str, str, str]] = []
            batch_size = 10
            for batch_idx in range(0, len(remaining), batch_size):
                batch = remaining[batch_idx : batch_idx + batch_size]
                schema_lines = [
                    f'- page="{b["page"]}", section="{b["section"]}", key="{b["key"]}", '
                    f'maxLength={b.get("maxLength", 300)}, current="{str(b.get("value", ""))[:80]}"'
                    for b in batch
                ]
                prompt = rewrite_prompt
                context = brand_context + "\n\nБлоки для перезаписи:\n" + "\n".join(schema_lines)

                batch_updates: list[dict[str, str]] = []
                missing_blocks: list[dict[str, Any]] = list(batch)
                for attempt in range(2):
                    try:
                        parsed = await self._ai_service._complete_json_prompt(
                            prompt=prompt,
                            context=context,
                            user_id=user_id,
                            temperature=0.4,
                            max_tokens=4000,
                        )
                        rewritten = parsed.get("blocks", []) if isinstance(parsed, Mapping) else []
                        batch_updates, missing_blocks = self._extract_batch_rewrite_updates(
                            rewritten,
                            batch=batch,
                        )
                        break
                    except Exception as exc:
                        if attempt == 0:
                            logger.info("[ImperorG] Batch %d attempt 1 failed, retrying: %s", batch_idx, exc)
                            await asyncio.sleep(1)
                        else:
                            logger.warning("[ImperorG] Batch rewrite failed (batch %d): %s", batch_idx, exc)

                updates_by_identity: dict[tuple[str, str, str], dict[str, str]] = {
                    (item["page"], item["section"], item["key"]): item for item in batch_updates
                }
                max_lengths_by_identity: dict[tuple[str, str, str], Any] = {
                    (
                        str(item.get("page") or ""),
                        str(item.get("section") or ""),
                        str(item.get("key") or ""),
                    ): item.get("maxLength")
                    for item in batch
                }
                unresolved_in_batch: list[tuple[str, str, str]] = []
                for missing_block in missing_blocks:
                    page = str(missing_block.get("page") or "").strip()
                    section = str(missing_block.get("section") or "").strip()
                    key = str(missing_block.get("key") or "").strip()
                    if not (page and section and key):
                        continue
                    fallback_value = await self._rewrite_single_remaining_block(
                        block=missing_block,
                        brand_context=brand_context,
                        user_id=user_id,
                    )
                    if fallback_value:
                        updates_by_identity[(page, section, key)] = {
                            "page": page,
                            "section": section,
                            "key": key,
                            "value": fallback_value,
                        }
                    else:
                        unresolved_in_batch.append((page, section, key))

                if updates_by_identity:
                    validation_input = [
                        {
                            **item,
                            "maxLength": max_lengths_by_identity.get(identity),
                        }
                        for identity, item in updates_by_identity.items()
                    ]
                    accepted_updates, quality_findings = self._filter_quality_accepted_blocks(
                        validation_input,
                        instance=instance,
                    )
                    accepted_identities = {
                        (str(item.get("page") or ""), str(item.get("section") or ""), str(item.get("key") or ""))
                        for item in accepted_updates
                    }
                    skipped_by_quality = len(updates_by_identity) - len(accepted_updates)
                    unresolved_in_batch.extend(
                        identity for identity in updates_by_identity if identity not in accepted_identities
                    )
                    wire_updates = [
                        {
                            "page": item["page"],
                            "section": item["section"],
                            "key": item["key"],
                            "value": item["value"],
                        }
                        for item in accepted_updates
                    ]
                    try:
                        if wire_updates:
                            await self._site_api_write(
                                "PUT",
                                f"{api_base}/content/blocks/bulk",
                                admin_token,
                                {"blocks": wire_updates},
                            )
                        total_rewritten += len(wire_updates)
                        _report_step(
                            ctx.apply_report,
                            "full_rewrite",
                            applied=len(wire_updates),
                            skipped=skipped_by_quality,
                            status="done" if not skipped_by_quality else "error",
                            quality_findings=quality_findings,
                        )
                    except Exception as exc:
                        logger.warning("[ImperorG] Failed to apply rewritten batch %d: %s", batch_idx, exc)
                        unresolved_in_batch.extend(accepted_identities)
                        _report_step(
                            ctx.apply_report,
                            "full_rewrite",
                            failed=len(wire_updates),
                            skipped=skipped_by_quality,
                            status="error",
                            summary=str(exc)[:160],
                            quality_findings=quality_findings,
                        )

                if unresolved_in_batch:
                    unresolved_blocks.extend(unresolved_in_batch)

                yield ": keep-alive\n\n"

            summary = f"{total_rewritten} блоков перезаписано из {len(remaining)} оставшихся"
            if unresolved_blocks:
                summary = f"{summary}; пропущено: {len(unresolved_blocks)}"
                unresolved_preview = ", ".join(f"{p}.{s}.{k}" for p, s, k in unresolved_blocks[:8])
                logger.warning(
                    "[ImperorG] Unresolved full rewrite blocks: %s%s",
                    unresolved_preview,
                    " ..." if len(unresolved_blocks) > 8 else "",
                )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "full_rewrite",
                    "label": "Адаптация всего контента сайта",
                    "status": "done",
                    "summary": summary,
                    "report": ctx.apply_report["steps"].get("full_rewrite"),
                },
            )
        else:
            _report_step(ctx.apply_report, "full_rewrite", skipped=0, status="done", summary="No remaining blocks")
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "full_rewrite",
                    "label": "Адаптация контента",
                    "status": "done",
                    "summary": "Все блоки уже обновлены",
                    "report": ctx.apply_report["steps"].get("full_rewrite"),
                },
            )

        # --- Step 3: upload generated images to site ---
        if ctx.image_drafts:
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "images_upload",
                    "label": "Загрузка изображений на сайт",
                    "status": "running",
                    "summary": f"0/{len(ctx.image_drafts)} картинок",
                },
            )
            uploaded_count = 0
            failed_count = 0
            for draft in ctx.image_drafts:
                try:
                    image_bytes = await self._download_image_from_draft(draft)
                    if image_bytes:
                        page = draft.get("page", "")
                        section = draft.get("section", "")
                        key = draft.get("key", "")
                        alt = draft.get("alt", "")
                        hint = draft.get("prompt", "")[:500]
                        await self._upload_image_to_site(
                            api_base,
                            admin_token,
                            image_bytes,
                            page=page,
                            section=section,
                            key=key,
                            alt=alt,
                            hint=hint,
                        )
                        uploaded_count += 1
                        logger.info("[ImperorG] Uploaded image %s.%s.%s", page, section, key)
                except Exception as exc:
                    failed_count += 1
                    logger.warning(
                        "[ImperorG] Image upload failed for %s: %s",
                        draft.get("slotId", "?"),
                        exc,
                    )
                yield ": keep-alive\n\n"

            _report_step(
                ctx.apply_report,
                "images_upload",
                applied=uploaded_count,
                failed=failed_count,
                skipped=max(0, len(ctx.image_drafts) - uploaded_count - failed_count),
                status="error" if failed_count else "done",
                summary=f"{uploaded_count}/{len(ctx.image_drafts)} uploaded",
            )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "images_upload",
                    "label": "Загрузка изображений на сайт",
                    "status": "error" if failed_count else "done",
                    "summary": f"{uploaded_count}/{len(ctx.image_drafts)} загружено",
                    "report": ctx.apply_report["steps"].get("images_upload"),
                },
            )

        # --- Step 4: full site settings (contacts, theme, brand name) ---
        yield _sse(
            "phase_step",
            {
                "phase_id": "apply",
                "step_id": "site_settings",
                "label": "Настройки сайта и тема",
                "status": "running",
            },
        )
        try:
            await self._apply_site_settings(api_base, admin_token, ctx, instance, user_id)
            _report_step(ctx.apply_report, "site_settings", applied=1, status="done", summary="Settings updated")
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "site_settings",
                    "label": "Настройки сайта и тема",
                    "status": "done",
                    "summary": "Контакты, тема и бренд обновлены",
                    "report": ctx.apply_report["steps"].get("site_settings"),
                },
            )
        except Exception as exc:
            logger.warning("[ImperorG] Site settings update failed: %s", exc)
            _report_step(ctx.apply_report, "site_settings", failed=1, status="error", summary=str(exc)[:160])
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "site_settings",
                    "label": "Настройки сайта и тема",
                    "status": "error",
                    "summary": str(exc)[:120],
                    "report": ctx.apply_report["steps"].get("site_settings"),
                },
            )
        yield ": keep-alive\n\n"

        # --- Step 5: rewrite products, consultations, masterclasses ---
        yield _sse(
            "phase_step",
            {
                "phase_id": "apply",
                "step_id": "entities_rewrite",
                "label": "Адаптация товаров и услуг",
                "status": "running",
                "summary": "Перезапись каталога...",
            },
        )
        try:
            rewritten_counts = await self._rewrite_site_entities(
                api_base,
                admin_token,
                ctx,
                instance,
                user_id,
            )
            parts = []
            for k, v in rewritten_counts.items():
                if v > 0:
                    parts.append(f"{k}: {v}")
            _report_step(
                ctx.apply_report,
                "entities_rewrite",
                applied=sum(int(v or 0) for v in rewritten_counts.values()),
                status="done",
                summary=", ".join(parts) if parts else "No entity data updated",
            )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "entities_rewrite",
                    "label": "Адаптация товаров и услуг",
                    "status": "done",
                    "summary": ", ".join(parts) if parts else "Нет данных для обновления",
                    "report": ctx.apply_report["steps"].get("entities_rewrite"),
                },
            )
        except Exception as exc:
            logger.warning("[ImperorG] Entity rewrite failed: %s", exc)
            _report_step(ctx.apply_report, "entities_rewrite", failed=1, status="error", summary=str(exc)[:160])
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "entities_rewrite",
                    "label": "Адаптация товаров и услуг",
                    "status": "error",
                    "summary": str(exc)[:120],
                    "report": ctx.apply_report["steps"].get("entities_rewrite"),
                },
            )
        yield ": keep-alive\n\n"

        # --- Step 6: rewrite catalog/gallery images ---
        yield _sse(
            "phase_step",
            {
                "phase_id": "apply",
                "step_id": "entities_images",
                "label": "Адаптация изображений каталога и галереи",
                "status": "running",
                "summary": "Генерация и замена изображений...",
            },
        )
        try:
            image_counts = await self._rewrite_entity_images(
                api_base,
                admin_token,
                ctx,
                instance,
                user_id,
            )
            parts = []
            for key, value in image_counts.items():
                if value > 0:
                    parts.append(f"{key}: {value}")
            _report_step(
                ctx.apply_report,
                "entities_images",
                applied=sum(int(value or 0) for value in image_counts.values()),
                status="done",
                summary=", ".join(parts) if parts else "No entity images updated",
            )
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "entities_images",
                    "label": "Адаптация изображений каталога и галереи",
                    "status": "done",
                    "summary": ", ".join(parts) if parts else "Нет данных для обновления",
                    "report": ctx.apply_report["steps"].get("entities_images"),
                },
            )
        except Exception as exc:
            logger.warning("[ImperorG] Entity image rewrite failed: %s", exc)
            _report_step(ctx.apply_report, "entities_images", failed=1, status="error", summary=str(exc)[:160])
            yield _sse(
                "phase_step",
                {
                    "phase_id": "apply",
                    "step_id": "entities_images",
                    "label": "Адаптация изображений каталога и галереи",
                    "status": "error",
                    "summary": str(exc)[:120],
                    "report": ctx.apply_report["steps"].get("entities_images"),
                },
            )
        yield ": keep-alive\n\n"

        failed_total = int(ctx.apply_report.get("totals", {}).get("failed") or 0)
        skipped_total = int(ctx.apply_report.get("totals", {}).get("skipped") or 0)
        terminal_status = "error" if failed_total or skipped_total else "done"
        terminal_summary = (
            f"Применено: {ctx.apply_report['totals']['applied']}; пропущено: {skipped_total}; ошибок: {failed_total}"
        )
        yield _sse(
            "phase_step",
            {
                "phase_id": "apply",
                "step_id": "complete",
                "label": "Применение завершено" if terminal_status == "done" else "Применение завершено с ошибками",
                "status": terminal_status,
                "summary": terminal_summary,
                "report": ctx.apply_report,
            },
        )

    # ------------------------------------------------------------------
    # Site settings + theme helper
    # ------------------------------------------------------------------
    async def _apply_site_settings(
        self,
        api_base: str,
        admin_token: str,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> None:

        brand = instance.site_title or "Brand"
        topic = instance.site_topic or ""
        blueprint = ctx.blueprint or {}
        seo = ctx.seo_draft or {}
        site_settings = seo.get("siteSettings", {})

        theme_id = self._pick_theme_for_brand(blueprint)

        settings_payload: dict[str, Any] = {
            "siteTitle": site_settings.get("siteTitle") or f"{brand}",
            "siteDescription": site_settings.get("siteDescription") or topic,
            "defaultTheme": theme_id,
        }

        contact_data = await self._generate_brand_contacts(ctx, instance, user_id)
        if contact_data:
            if contact_data.get("contactEmail"):
                settings_payload["contactEmail"] = contact_data["contactEmail"]
            if contact_data.get("contactPhone"):
                settings_payload["contactPhone"] = contact_data["contactPhone"]
            if contact_data.get("contactAddress"):
                settings_payload["contactAddress"] = contact_data["contactAddress"]
            if contact_data.get("workingHours"):
                settings_payload["workingHours"] = contact_data["workingHours"]

        await self._site_api_write("PATCH", f"{api_base}/admin/site-settings", admin_token, settings_payload)
        logger.info("[ImperorG] Site settings updated: theme=%s", theme_id)

    @staticmethod
    def _pick_theme_for_brand(blueprint: dict[str, Any]) -> str:
        mood = str(blueprint.get("heroMood", "")).lower()
        visual = str(blueprint.get("visualDirection", "")).lower()
        combined = f"{mood} {visual}"

        theme_map = [
            (["энерги", "сил", "спорт", "фитнес", "огон", "blaze", "fire"], "sunset-blaze"),
            (["океан", "мор", "вод", "cool", "ocean", "sea"], "ocean-depths"),
            (["ночь", "тёмн", "dark", "midnight", "ночн"], "midnight-sky"),
            (["роз", "нежн", "женств", "pink", "rose"], "rose-garden"),
            (["лес", "зелен", "природ", "forest", "green"], "emerald-forest"),
            (["золот", "люкс", "premium", "gold"], "golden-hour"),
            (["лаванд", "спокой", "relax", "lavend"], "lavender-dream"),
            (["корал", "ярк", "coral", "bright"], "coral-reef"),
            (["минимал", "чист", "белый", "minimal", "ivory"], "minimal-ivory"),
            (["персик", "тёпл", "peach", "warm"], "peach-dawn"),
            (["сакура", "вишн", "japan", "sakura"], "sakura-blossom"),
            (["туман", "мягк", "серый", "sage", "mist"], "sage-mist"),
        ]
        for keywords, theme_id in theme_map:
            for kw in keywords:
                if kw in combined:
                    return theme_id

        return "sunset-blaze"

    async def _generate_brand_contacts(
        self,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> dict[str, str]:
        brand = instance.site_title or "Brand"
        topic = instance.site_topic or ""
        prompt = (
            f"Сгенерируй контактные данные для бренда '{brand}' (тематика: {topic}). "
            "Данные должны быть реалистичными, в российском формате. "
            'Верни JSON: {"contactEmail":"...","contactPhone":"+7 (XXX) XXX-XX-XX","contactAddress":"...","workingHours":"..."}'
        )
        try:
            return await self._ai_service._complete_json_prompt(
                prompt=prompt,
                context=f"Бренд: {brand}\nТематика: {topic}\nBrief: {(ctx.research_brief or '')[:400]}",
                user_id=user_id,
                temperature=0.5,
                max_tokens=500,
            )
        except Exception as exc:
            logger.warning("[ImperorG] Contact gen failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # Entity rewrite (products, consultations, masterclasses)
    # ------------------------------------------------------------------
    async def _rewrite_site_entities(
        self,
        api_base: str,
        admin_token: str,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> dict[str, int]:
        brand = instance.site_title or "Brand"
        topic = instance.site_topic or ""
        template_key = (instance.template_key or "olenti").strip().lower()
        counts: dict[str, int] = {"товары": 0, "консультации": 0, "мастер-классы": 0}

        if template_key == "olenti":
            brand_context = (
                f"БРЕНД КЛИЕНТА: {brand}\n"
                f"Тематика: {topic}\n"
                "Структура шаблона: витрина товаров, консультации, мастер-классы. "
                "Адаптируй контент СТРОГО под тематику клиента, вписывая её в этот формат. "
                "Не используй чужие демо-имена брендов и устаревшие отраслевые клише, если они не соответствуют теме клиента.\n"
                f"Brief: {(ctx.research_brief or '')[:500]}\n"
                f"Blueprint: {json.dumps(ctx.blueprint or {}, ensure_ascii=False)[:400]}"
            )
        else:
            brand_context = (
                f"НОВЫЙ БРЕНД: {brand}\n"
                f"ТЕМАТИКА: {topic}\n"
                f"Шаблон (ключ): {template_key}\n"
                f"Создавай контент СТРОГО по тематике: {topic}\n"
                f"Brief: {(ctx.research_brief or '')[:500]}\n"
                f"Blueprint: {json.dumps(ctx.blueprint or {}, ensure_ascii=False)[:400]}"
            )

        client = get_httpx_client()
        # --- Products ---
        try:
            resp = await client.get(f"{api_base}/products", timeout=30)
            resp.raise_for_status()
            products_data = resp.json()
            products = products_data.get("data", products_data) if isinstance(products_data, dict) else products_data
            if isinstance(products, list) and products:
                counts["товары"] = await self._rewrite_products(
                    api_base,
                    admin_token,
                    products,
                    brand_context,
                    user_id,
                )
        except Exception as exc:
            logger.warning("[ImperorG] Products fetch/rewrite: %s", exc)

        await asyncio.sleep(0.5)

        # --- Consultations ---
        try:
            resp = await client.get(f"{api_base}/consultations", timeout=30)
            resp.raise_for_status()
            consultations = resp.json()
            if not isinstance(consultations, list):
                consultations = consultations.get("data", []) if isinstance(consultations, dict) else []
            if consultations:
                counts["консультации"] = await self._rewrite_consultations(
                    api_base,
                    admin_token,
                    consultations,
                    brand_context,
                    user_id,
                )
        except Exception as exc:
            logger.warning("[ImperorG] Consultations fetch/rewrite: %s", exc)

        await asyncio.sleep(0.5)

        # --- Masterclasses ---
        try:
            resp = await client.get(f"{api_base}/masterclasses", timeout=30)
            resp.raise_for_status()
            masterclasses = resp.json()
            if not isinstance(masterclasses, list):
                masterclasses = masterclasses.get("data", []) if isinstance(masterclasses, dict) else []
            if masterclasses:
                counts["мастер-классы"] = await self._rewrite_masterclasses(
                    api_base,
                    admin_token,
                    masterclasses,
                    brand_context,
                    user_id,
                )
        except Exception as exc:
            logger.warning("[ImperorG] Masterclasses fetch/rewrite: %s", exc)

        return counts

    async def _rewrite_entity_images(
        self,
        api_base: str,
        admin_token: str,
        ctx: ImperorGContext,
        instance: UserSiteInstance,
        user_id: str,
    ) -> dict[str, int]:
        """Generate and replace visuals for catalog entities and gallery."""
        brand = instance.site_title or "Brand"
        topic = instance.site_topic or ""
        blueprint = ctx.blueprint if isinstance(ctx.blueprint, dict) else {}
        counts: dict[str, int] = {"товары": 0, "консультации": 0, "мастер-классы": 0, "галерея": 0}

        client = get_httpx_client()

        try:
            resp = await client.get(f"{api_base}/products", timeout=30)
            resp.raise_for_status()
            products_data = resp.json()
            products = products_data.get("data", products_data) if isinstance(products_data, dict) else products_data
            if isinstance(products, list):
                product_items = [item for item in products if isinstance(item, Mapping)]
                for product in self._limit_entities_for_image_rewrite(
                    product_items,
                    limit=self._entity_image_tuning.products_limit,
                    entity_label="products",
                ):
                    if not isinstance(product, Mapping):
                        continue
                    product_id = str(product.get("id") or "").strip()
                    if not product_id:
                        continue
                    product_title = str(product.get("name") or "").strip()
                    product_description = str(
                        product.get("shortDescription") or product.get("description") or ""
                    ).strip()
                    prompt = self._build_entity_image_prompt(
                        entity_kind="product",
                        brand=brand,
                        topic=topic,
                        title=product_title,
                        description=product_description,
                        blueprint=blueprint,
                    )
                    try:
                        image_url = await self._generate_entity_image_url(
                            user_id=user_id,
                            prompt=prompt,
                            width=1200,
                            height=1200,
                            idempotency_key=self._build_entity_image_idempotency_key(
                                instance=instance,
                                entity_kind="product",
                                entity_id=product_id,
                                prompt=prompt,
                            ),
                        )
                        if not image_url:
                            continue
                        image_bytes = await self._resolve_generated_image_bytes(image_url)
                        if not image_bytes:
                            continue
                        uploaded_url = await self._upload_entity_image_asset(
                            api_base=api_base,
                            admin_token=admin_token,
                            image_bytes=image_bytes,
                            filename_hint=f"imperorg-product-{product_id}",
                        )
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/products/{product_id}",
                            admin_token,
                            {"image": uploaded_url, "images": [uploaded_url]},
                        )
                        counts["товары"] += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Product image rewrite %s failed: %s", product_id, exc)
                    await asyncio.sleep(0.15)
        except Exception as exc:
            logger.warning("[ImperorG] Products image rewrite fetch failed: %s", exc)

        try:
            resp = await client.get(f"{api_base}/masterclasses", timeout=30)
            resp.raise_for_status()
            masterclasses_data = resp.json()
            masterclasses = (
                masterclasses_data.get("data", masterclasses_data)
                if isinstance(masterclasses_data, dict)
                else masterclasses_data
            )
            if isinstance(masterclasses, list):
                masterclass_items = [item for item in masterclasses if isinstance(item, Mapping)]
                for masterclass in self._limit_entities_for_image_rewrite(
                    masterclass_items,
                    limit=self._entity_image_tuning.masterclasses_limit,
                    entity_label="masterclasses",
                ):
                    if not isinstance(masterclass, Mapping):
                        continue
                    masterclass_id = str(masterclass.get("id") or "").strip()
                    if not masterclass_id:
                        continue
                    masterclass_title = str(masterclass.get("title") or "").strip()
                    masterclass_description = str(
                        masterclass.get("shortDescription") or masterclass.get("fullDescription") or ""
                    ).strip()
                    prompt = self._build_entity_image_prompt(
                        entity_kind="masterclass",
                        brand=brand,
                        topic=topic,
                        title=masterclass_title,
                        description=masterclass_description,
                        blueprint=blueprint,
                    )
                    try:
                        image_url = await self._generate_entity_image_url(
                            user_id=user_id,
                            prompt=prompt,
                            width=1600,
                            height=1000,
                            idempotency_key=self._build_entity_image_idempotency_key(
                                instance=instance,
                                entity_kind="masterclass",
                                entity_id=masterclass_id,
                                prompt=prompt,
                            ),
                        )
                        if not image_url:
                            continue
                        image_bytes = await self._resolve_generated_image_bytes(image_url)
                        if not image_bytes:
                            continue
                        uploaded_url = await self._upload_entity_image_asset(
                            api_base=api_base,
                            admin_token=admin_token,
                            image_bytes=image_bytes,
                            filename_hint=f"imperorg-masterclass-{masterclass_id}",
                        )
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/masterclasses/{masterclass_id}",
                            admin_token,
                            {"image": uploaded_url},
                        )
                        counts["мастер-классы"] += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Masterclass image rewrite %s failed: %s", masterclass_id, exc)
                    await asyncio.sleep(0.15)
        except Exception as exc:
            logger.warning("[ImperorG] Masterclasses image rewrite fetch failed: %s", exc)

        try:
            resp = await client.get(f"{api_base}/consultations", timeout=30)
            resp.raise_for_status()
            consultations_data = resp.json()
            consultations = (
                consultations_data.get("data", consultations_data)
                if isinstance(consultations_data, dict)
                else consultations_data
            )
            if isinstance(consultations, list):
                consultation_items = [item for item in consultations if isinstance(item, Mapping)]
                for consultation in self._limit_entities_for_image_rewrite(
                    consultation_items,
                    limit=self._entity_image_tuning.consultations_limit,
                    entity_label="consultations",
                ):
                    if not isinstance(consultation, Mapping):
                        continue
                    consultation_id = str(consultation.get("id") or "").strip()
                    if not consultation_id:
                        continue
                    consultation_title = str(consultation.get("title") or "").strip()
                    consultation_description = str(
                        consultation.get("shortDescription") or consultation.get("fullDescription") or ""
                    ).strip()
                    prompt = self._build_entity_image_prompt(
                        entity_kind="consultation",
                        brand=brand,
                        topic=topic,
                        title=consultation_title,
                        description=consultation_description,
                        blueprint=blueprint,
                    )
                    try:
                        image_url = await self._generate_entity_image_url(
                            user_id=user_id,
                            prompt=prompt,
                            width=1400,
                            height=1000,
                            idempotency_key=self._build_entity_image_idempotency_key(
                                instance=instance,
                                entity_kind="consultation",
                                entity_id=consultation_id,
                                prompt=prompt,
                            ),
                        )
                        if not image_url:
                            continue
                        image_bytes = await self._resolve_generated_image_bytes(image_url)
                        if not image_bytes:
                            continue
                        uploaded_url = await self._upload_entity_image_asset(
                            api_base=api_base,
                            admin_token=admin_token,
                            image_bytes=image_bytes,
                            filename_hint=f"imperorg-consultation-{consultation_id}",
                        )
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/consultations/{consultation_id}",
                            admin_token,
                            {"image": uploaded_url},
                        )
                        counts["консультации"] += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Consultation image rewrite %s failed: %s", consultation_id, exc)
                    await asyncio.sleep(0.15)
        except Exception as exc:
            logger.warning("[ImperorG] Consultations image rewrite fetch failed: %s", exc)

        try:
            resp = await client.get(f"{api_base}/gallery", timeout=30)
            resp.raise_for_status()
            gallery_data = resp.json()
            gallery_items = gallery_data.get("data", gallery_data) if isinstance(gallery_data, dict) else gallery_data
            if isinstance(gallery_items, list):
                gallery_candidates = [item for item in gallery_items if isinstance(item, Mapping)]
                for gallery_item in self._select_gallery_items_for_image_rewrite(gallery_candidates):
                    if not isinstance(gallery_item, Mapping):
                        continue
                    gallery_id = str(gallery_item.get("id") or "").strip()
                    if not gallery_id:
                        continue
                    gallery_category = str(gallery_item.get("category") or "").strip().lower()
                    # Never pass gallery title/alt into the image prompt — Comfy paints names as text.
                    gallery_description = f"gallery category mood: {gallery_category}" if gallery_category else ""
                    prompt = self._build_entity_image_prompt(
                        entity_kind="gallery",
                        brand=brand,
                        topic=topic,
                        title="",
                        description=gallery_description,
                        blueprint=blueprint,
                    )
                    try:
                        image_url = await self._generate_entity_image_url(
                            user_id=user_id,
                            prompt=prompt,
                            width=1600,
                            height=1000,
                            idempotency_key=self._build_entity_image_idempotency_key(
                                instance=instance,
                                entity_kind="gallery",
                                entity_id=gallery_id,
                                prompt=prompt,
                            ),
                        )
                        if not image_url:
                            continue
                        image_bytes = await self._resolve_generated_image_bytes(image_url)
                        if not image_bytes:
                            continue
                        uploaded_url = await self._upload_entity_image_asset(
                            api_base=api_base,
                            admin_token=admin_token,
                            image_bytes=image_bytes,
                            filename_hint=f"imperorg-gallery-{gallery_id}",
                        )
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/gallery/{gallery_id}",
                            admin_token,
                            {"url": uploaded_url},
                        )
                        counts["галерея"] += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Gallery image rewrite %s failed: %s", gallery_id, exc)
                    await asyncio.sleep(0.15)
        except Exception as exc:
            logger.warning("[ImperorG] Gallery image rewrite fetch failed: %s", exc)

        return counts

    def _limit_entities_for_image_rewrite(
        self,
        entities: list[Mapping[str, Any]],
        *,
        limit: int,
        entity_label: str,
    ) -> list[Mapping[str, Any]]:
        if limit <= 0:
            logger.info("[ImperorG] %s image rewrite is disabled (limit=%d)", entity_label, limit)
            return []
        if len(entities) > limit:
            logger.info("[ImperorG] %s image rewrite limited: %d/%d", entity_label, limit, len(entities))
        return entities[:limit]

    @staticmethod
    def _gallery_sort_key(gallery_item: Mapping[str, Any]) -> tuple[int, str, str]:
        order_raw = gallery_item.get("order")
        try:
            order_value = int(order_raw)
        except (TypeError, ValueError):  # fmt: skip
            order_value = 10**9
        created_at = str(gallery_item.get("createdAt") or "")
        gallery_id = str(gallery_item.get("id") or "")
        return (order_value, created_at, gallery_id)

    def _select_gallery_items_for_image_rewrite(
        self,
        gallery_items: list[Mapping[str, Any]],
    ) -> list[Mapping[str, Any]]:
        allowed_categories = self._entity_image_tuning.gallery_allowed_categories
        filtered: list[Mapping[str, Any]] = []
        for item in gallery_items:
            category = str(item.get("category") or "").strip().lower()
            if allowed_categories and category and category not in allowed_categories:
                continue
            filtered.append(item)

        filtered.sort(key=self._gallery_sort_key)
        return self._limit_entities_for_image_rewrite(
            filtered,
            limit=self._entity_image_tuning.gallery_limit,
            entity_label="gallery",
        )

    @staticmethod
    def _strip_named_phrases_from_image_text(text: str, *forbidden: str) -> str:
        """Remove brand/title literals so Comfy does not paint them as on-image text."""
        result = " ".join(str(text or "").split())
        for phrase in forbidden:
            needle = " ".join(str(phrase or "").split())
            if len(needle) < 2:
                continue
            result = re.sub(re.escape(needle), " ", result, flags=re.IGNORECASE)
        return " ".join(result.split())

    @staticmethod
    def _build_entity_image_prompt(
        *,
        entity_kind: str,
        brand: str,
        topic: str,
        title: str,
        description: str,
        blueprint: Mapping[str, Any] | None = None,
    ) -> str:
        """Build a compact visual-only prompt for entity-level image generation.

        Never inject brand names or entity titles: ComfyUI / z-image still paints
        readable text when names appear even if the positive prompt asks for text-free output.
        ``brand`` / ``title`` are only used to scrub those literals out of description text.
        """
        normalized_kind = (entity_kind or "").strip().lower()
        scene_topic = ImperorGService._strip_named_phrases_from_image_text(
            topic.strip() or "premium services",
            brand,
            title,
        )
        visual_cues = ImperorGService._strip_named_phrases_from_image_text(
            " ".join(str(description or "").split())[:220],
            brand,
            title,
        )

        visual_direction = ""
        hero_mood = ""
        if isinstance(blueprint, Mapping):
            visual_direction = str(blueprint.get("visualDirection") or "").strip()
            hero_mood = str(blueprint.get("heroMood") or "").strip()

        if normalized_kind == "masterclass":
            lead = (
                "Workshop circle around a table in a bright loft, empty boards, "
                "dynamic group interaction, cinematic natural light"
            )
        elif normalized_kind == "consultation":
            lead = (
                "Two people talking in a quiet lounge, no screens, welcoming specialist, "
                "cinematic natural light, trustworthy atmosphere"
            )
        elif normalized_kind == "gallery":
            lead = (
                "Architectural interior vignette for a website gallery, balanced composition, "
                "photorealistic textures, empty walls without print"
            )
        else:
            lead = (
                "Single unlabeled object on seamless paper, centered e-commerce photography, "
                "soft studio light, crisp materials and details"
            )

        # Visual-only context — never "brand:" / "title:" / product names.
        context_bits: list[str] = []
        topic_visual = sanitize_z_image_visual_prompt(scene_topic)
        cues_visual = sanitize_z_image_visual_prompt(visual_cues)
        direction_visual = sanitize_z_image_visual_prompt(visual_direction)
        mood_visual = sanitize_z_image_visual_prompt(hero_mood)
        if topic_visual:
            context_bits.append(f"scene domain: {topic_visual}")
        if cues_visual:
            context_bits.append(f"visual cues: {cues_visual}")
        if direction_visual:
            context_bits.append(f"visual direction: {direction_visual}")
        if mood_visual:
            context_bits.append(f"mood: {mood_visual}")

        quality_line = _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE
        assembled = (
            f"{lead}. {'; '.join(context_bits)}. {quality_line}." if context_bits else f"{lead}. {quality_line}."
        )
        cleaned = sanitize_z_image_visual_prompt(assembled)
        if quality_line not in cleaned:
            cleaned = f"{cleaned.rstrip('.')}. {quality_line}."
        return cleaned

    @staticmethod
    def _build_entity_image_idempotency_key(
        *,
        instance: UserSiteInstance,
        entity_kind: str,
        entity_id: str,
        prompt: str,
    ) -> str:
        instance_key = str(
            getattr(instance, "id", None)
            or getattr(instance, "site_slug", None)
            or getattr(instance, "compose_project_name", None)
            or "site"
        )
        template_key = str(getattr(instance, "template_key", "") or "template")
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        return f"imperorg:entity-image:{instance_key}:{template_key}:{entity_kind}:{entity_id}:{digest}"

    async def _generate_entity_image_url(
        self,
        *,
        user_id: str,
        prompt: str,
        width: int,
        height: int,
        negative_prompt: str | None = None,
        steps: int = 20,
        idempotency_key: str | None = None,
    ) -> str | None:
        """Generate an image for catalog/gallery entities and return URL from UGS stream."""
        from api.routers.site_studio_ai import _normalize_site_studio_image_result

        snapped_w, snapped_h = snap_flux2_klein_latent(int(width), int(height))
        input_data = {
            "prompt": sanitize_z_image_visual_prompt(prompt),
            "negative_prompt": site_studio_image_negative_prompt(negative_prompt),
            "width": snapped_w,
            "height": snapped_h,
            "steps": int(steps),
            "workflow_key": _SITE_STUDIO_IMAGE_WORKFLOW_KEY,
            "workflow_template": _SITE_STUDIO_IMAGE_WORKFLOW_KEY,
        }

        active_ugs = UnifiedGenerationService(self.db)
        try:
            start_payload = await active_ugs.start_generation_for_stream(
                user_id=str(user_id),
                type_key="image_generation_comfyui",
                input_data=input_data,
                priority=5,
                idempotency_key=idempotency_key,
            )

            if start_payload.get("status") == "completed":
                normalized = _normalize_site_studio_image_result(start_payload)
                image_url = (normalized or {}).get("image_url") or (normalized or {}).get("imageUrl")
                return str(image_url or "").strip() or None

            request_id = start_payload.get("request_id")
            if not request_id:
                logger.warning("[ImperorG] Entity image generation returned no request_id")
                return None

            async for event in active_ugs.stream_generation_events(
                request_id,
                str(user_id),
                poll_interval=2.5,
                keep_alive_interval=8.0,
            ):
                event_type = str(event.get("event") or "")
                if event_type == "result":
                    result_data = event.get("data") or event.get("result") or event
                    normalized = _normalize_site_studio_image_result(result_data)
                    image_url = (normalized or {}).get("image_url") or (normalized or {}).get("imageUrl")
                    return str(image_url or "").strip() or None
                if event_type == "error":
                    logger.warning(
                        "[ImperorG] Entity image generation error: %s",
                        event.get("error", "unknown"),
                    )
                    return None
        finally:
            await active_ugs.close()
        return None

    async def _resolve_generated_image_bytes(self, image_url: str) -> bytes | None:
        """Resolve generated image URL into raw bytes (Comfy view or direct URL)."""
        normalized_url = str(image_url or "").strip()
        if not normalized_url:
            return None

        with contextlib.suppress(Exception):
            comfy_bytes = await self._download_image_from_draft({"imageUrl": normalized_url})
            if comfy_bytes:
                return comfy_bytes

        fetch_url = normalized_url
        if fetch_url.startswith("/"):
            from api.core.unified_config import unified_settings

            comfyui_base = (os.environ.get("COMFYUI_URL") or unified_settings.comfyui_url).rstrip("/")
            fetch_url = f"{comfyui_base}{fetch_url}"

        if not fetch_url.startswith(("http://", "https://")):
            return None

        client = get_httpx_client()
        response = await client.get(fetch_url, timeout=60)
        response.raise_for_status()
        if len(response.content) < 1000:
            logger.warning("[ImperorG] Entity image too small (%d bytes): %s", len(response.content), fetch_url)
            return None
        return response.content

    async def _upload_entity_image_asset(
        self,
        *,
        api_base: str,
        admin_token: str,
        image_bytes: bytes,
        filename_hint: str,
    ) -> str:
        """Upload generated entity image via `/admin/upload` and return uploaded URL."""
        files = {"file": (f"{filename_hint}.png", image_bytes, "image/png")}
        headers = {"Authorization": f"Bearer {admin_token}"}
        client = get_httpx_client()
        response = await client.post(
            f"{api_base}/admin/upload",
            files=files,
            headers=headers,
            timeout=60,
        )
        response.raise_for_status()
        body = response.json()

        uploaded_url = ""
        if isinstance(body, Mapping):
            uploaded_url = str(body.get("url") or "").strip()
            if not uploaded_url:
                data_payload = body.get("data")
                if isinstance(data_payload, Mapping):
                    uploaded_url = str(data_payload.get("url") or "").strip()

        if not uploaded_url:
            raise RuntimeError("Site API returned no URL for uploaded entity image")
        return uploaded_url

    async def _rewrite_products(
        self,
        api_base: str,
        admin_token: str,
        products: list[dict[str, Any]],
        brand_context: str,
        user_id: str,
    ) -> int:
        existing_categories: dict[str, str] = {}
        for product in products:
            product_id = str(product.get("id") or "").strip()
            if not product_id:
                continue
            existing_categories[product_id] = str(product.get("category") or "perfumes").strip().lower()

        items_desc = "\n".join(
            f'- id="{p["id"]}", name="{p.get("name", "")}", '
            f"price={p.get('price', '')}, "
            f'collection="{p.get("collection", "")}", category="{p.get("category", "")}"'
            for p in products[:15]
        )
        prompt = (
            "Ты обновляешь каталог товаров для бренда клиента. "
            "Адаптируй названия, описания и коллекции под бренд клиента, строго соблюдая тематику из контекста. "
            "Не используй чужие демо-имена брендов и устаревшие отраслевые клише, если они не соответствуют теме клиента. "
            "Сохрани id для привязки. Для category используй ТОЛЬКО одно из значений: perfumes, ingredients, accessories.\n"
            "ВАЖНО: Ответь ТОЛЬКО валидным JSON без markdown.\n"
            'Формат: {"products":[{"id":"...","name":"...","description":"...","shortDescription":"...","collection":"...","collectionDescription":"...","category":"..."}]}'
        )
        context = brand_context + "\n\nID существующих товаров (содержимое заменить полностью):\n" + items_desc

        try:
            parsed = await self._ai_service._complete_json_prompt(
                prompt=prompt,
                context=context,
                user_id=user_id,
                temperature=0.5,
                max_tokens=4000,
            )
            rewritten = parsed.get("products", [])
            count = 0
            for item in rewritten:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                patch = {}
                for field in ("name", "description", "shortDescription", "collection", "collectionDescription"):
                    if item.get(field):
                        patch[field] = item[field]
                current_category = existing_categories.get(str(item["id"]), "perfumes")
                normalized_category = self._normalize_product_category(item.get("category"), fallback=current_category)
                if normalized_category and normalized_category != current_category:
                    patch["category"] = normalized_category
                if patch:
                    try:
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/products/{item['id']}",
                            admin_token,
                            patch,
                        )
                        count += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Product patch %s failed: %s", item["id"], exc)
            return count
        except Exception as exc:
            logger.warning("[ImperorG] Products AI rewrite: %s", exc)
            return 0

    @staticmethod
    def _normalize_product_category(value: Any, *, fallback: str = "perfumes") -> str:
        normalized = str(value or "").strip().lower()
        if not normalized:
            return fallback

        if normalized in {"perfumes", "ingredients", "accessories"}:
            return normalized

        if any(token in normalized for token in ("ingredient", "ингредиент", "сырь", "компонент")):
            return "ingredients"
        if any(token in normalized for token in ("accessor", "аксесс", "набор", "gift", "подар")):
            return "accessories"
        if any(token in normalized for token in ("perf", "парф", "аромат", "дух")):
            return "perfumes"
        return fallback

    async def _rewrite_consultations(
        self,
        api_base: str,
        admin_token: str,
        consultations: list[dict[str, Any]],
        brand_context: str,
        user_id: str,
    ) -> int:
        items_desc = "\n".join(
            f'- id="{c["id"]}", price={c.get("price", "")}, duration="{c.get("duration", "")}"' for c in consultations
        )
        prompt = (
            "Ты обновляешь список услуг/консультаций для бренда клиента. "
            "Адаптируй названия и описания под бренд клиента, строго соблюдая тематику из контекста. "
            "Не используй чужие демо-имена брендов и устаревшие отраслевые клише, если они не соответствуют теме клиента. "
            "Сохрани id для привязки.\n"
            "ВАЖНО: Ответь ТОЛЬКО валидным JSON без markdown.\n"
            'Формат: {"consultations":[{"id":"...","title":"...","shortDescription":"...","fullDescription":"..."}]}'
        )
        context = brand_context + "\n\nID существующих консультаций (содержимое заменить полностью):\n" + items_desc

        try:
            parsed = await self._ai_service._complete_json_prompt(
                prompt=prompt,
                context=context,
                user_id=user_id,
                temperature=0.5,
                max_tokens=3000,
            )
            rewritten = parsed.get("consultations", [])
            count = 0
            for item in rewritten:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                patch = {}
                for field in ("title", "shortDescription", "fullDescription"):
                    if item.get(field):
                        patch[field] = item[field]
                if patch:
                    try:
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/consultations/{item['id']}",
                            admin_token,
                            patch,
                        )
                        count += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Consultation patch %s: %s", item["id"], exc)
            return count
        except Exception as exc:
            logger.warning("[ImperorG] Consultations AI rewrite: %s", exc)
            return 0

    async def _rewrite_masterclasses(
        self,
        api_base: str,
        admin_token: str,
        masterclasses: list[dict[str, Any]],
        brand_context: str,
        user_id: str,
    ) -> int:
        items_desc = "\n".join(
            f'- id="{m["id"]}", price={m.get("price", "")}, duration="{m.get("duration", "")}"' for m in masterclasses
        )
        prompt = (
            "Ты обновляешь список мероприятий/мастер-классов для бренда клиента. "
            "Адаптируй названия и описания под бренд клиента, строго соблюдая тематику из контекста. "
            "Не используй чужие демо-имена брендов и устаревшие отраслевые клише, если они не соответствуют теме клиента. "
            "Сохрани id для привязки. Категории адаптируй под тематику.\n"
            "ВАЖНО: Ответь ТОЛЬКО валидным JSON без markdown.\n"
            'Формат: {"masterclasses":[{"id":"...","title":"...","shortDescription":"...","fullDescription":"...","category":"..."}]}'
        )
        context = brand_context + "\n\nID существующих мастер-классов (содержимое заменить полностью):\n" + items_desc

        try:
            parsed = await self._ai_service._complete_json_prompt(
                prompt=prompt,
                context=context,
                user_id=user_id,
                temperature=0.5,
                max_tokens=3000,
            )
            rewritten = parsed.get("masterclasses", [])
            count = 0
            for item in rewritten:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                patch = {}
                for field in ("title", "shortDescription", "fullDescription", "category"):
                    if item.get(field):
                        patch[field] = item[field]
                if patch:
                    try:
                        await self._site_api_write(
                            "PATCH",
                            f"{api_base}/masterclasses/{item['id']}",
                            admin_token,
                            patch,
                        )
                        count += 1
                    except Exception as exc:
                        logger.warning("[ImperorG] Masterclass patch %s: %s", item["id"], exc)
            return count
        except Exception as exc:
            logger.warning("[ImperorG] Masterclasses AI rewrite: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Image download & upload helpers
    # ------------------------------------------------------------------
    async def _download_image_from_draft(self, draft: dict[str, Any]) -> bytes | None:
        """Download raw image bytes from ComfyUI given a draft's imageUrl."""
        import os
        import urllib.parse

        image_url = draft.get("imageUrl") or draft.get("image_url") or ""
        if not image_url:
            return None

        if "filename=" in image_url:
            parsed = urllib.parse.urlparse(image_url)
            params = urllib.parse.parse_qs(parsed.query)
            filename = (params.get("filename") or [""])[0]
            subfolder = (params.get("subfolder") or [""])[0]
        else:
            filename = image_url.rsplit("/", 1)[-1]
            subfolder = ""

        if not filename:
            return None

        from api.core.unified_config import unified_settings

        comfyui_base = (os.environ.get("COMFYUI_URL") or unified_settings.comfyui_url).rstrip("/")
        url = f"{comfyui_base}/view?filename={urllib.parse.quote(filename)}"
        if subfolder:
            url += f"&subfolder={urllib.parse.quote(subfolder)}"

        client = get_httpx_client()
        resp = await client.get(url, timeout=60)
        resp.raise_for_status()
        if len(resp.content) < 1000:
            logger.warning("[ImperorG] Image too small (%d bytes): %s", len(resp.content), filename)
            return None
        return resp.content

    async def _upload_image_to_site(
        self,
        api_base: str,
        admin_token: str,
        image_bytes: bytes,
        *,
        page: str,
        section: str,
        key: str,
        alt: str,
        hint: str,
    ) -> dict[str, Any]:
        """Upload image to site template via POST /content/images/upload (multipart)."""
        files = {"image": (f"{page}-{section}-{key}.png", image_bytes, "image/png")}
        data = {"page": page, "section": section, "key": key, "alt": alt, "hint": hint}
        headers = {"Authorization": f"Bearer {admin_token}"}
        client = get_httpx_client()
        resp = await client.post(
            f"{api_base}/content/images/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
        body = resp.json()
        if isinstance(body, dict) and body.get("success") is False:
            raise RuntimeError(f"Image upload rejected: {body.get('message', 'unknown')}")
        return body

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _load_document_text(self, document_id: str) -> str:
        try:
            from sqlalchemy import select

            from api.models.database_models import UnifiedContent

            result = await self.db.execute(
                select(UnifiedContent.extracted_text).where(
                    UnifiedContent.id == document_id,
                    UnifiedContent.deleted_at.is_(None),
                )
            )
            row = result.scalar_one_or_none()
            return (row or "").strip()[:4000]
        except Exception as exc:
            logger.warning("[ImperorG] Failed to load document %s: %s", document_id, exc)
            return ""

    @staticmethod
    def _build_search_queries(
        instance: UserSiteInstance,
        config: ImperorGConfig,
    ) -> list[str]:
        return build_imperorg_search_queries(
            site_title=instance.site_title or "",
            site_topic=instance.site_topic or "",
            user_prompt=config.user_prompt or "",
        )

    @staticmethod
    def _build_search_fallback_queries(
        instance: UserSiteInstance,
        config: ImperorGConfig,
    ) -> list[str]:
        return build_imperorg_fallback_queries(
            site_title=instance.site_title or "",
            site_topic=instance.site_topic or "",
            user_prompt=config.user_prompt or "",
        )
