# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI application entrypoint for KBSEW microservice.
# Invariants:
# - GET /health is liveness-only; GET /ready probes PG/Qdrant/MinIO.
# Related:
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST

from api.core.config import get_settings
from api.core.database import close_pool, init_pool
from api.core.health import collect_readiness
from api.monitoring.metrics import render_prometheus_metrics
from api.routers.barrels import router as barrels_router
from api.routers.search import router as search_router
from api.services.ingestion_worker import start_ingestion_worker, stop_ingestion_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO)
    )
    await init_pool()
    await start_ingestion_worker()
    logger.info("[STEP] kbsew_app_started service=%s", settings.service_name)
    try:
        yield
    finally:
        await stop_ingestion_worker()
        await close_pool()
        logger.info("[STEP] kbsew_app_stopped")


app = FastAPI(title="KBSEW", version="0.1.0", lifespan=lifespan)
app.include_router(barrels_router)
app.include_router(search_router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness: process is up (no dependency probes)."""
    return {"status": "ok", "service": get_settings().service_name}


@app.get("/ready")
async def ready() -> dict[str, object]:
    """Readiness: PG, Qdrant, and Seaweed/MinIO lightweight checks."""
    payload = await collect_readiness()
    if not payload.get("ready"):
        raise HTTPException(status_code=503, detail=payload)
    return payload


@app.get("/metrics")
async def metrics() -> Response:
    return Response(content=render_prometheus_metrics(), media_type=CONTENT_TYPE_LATEST)
