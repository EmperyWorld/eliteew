# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI sidecar for CPU-heavy science stack ops on queue-worker (scipy/sklearn).
# Invariants:
# - Runs on queue-worker only; stack0-api calls via HTTP.
# Related:
# - docker/builders/stack0-api/scripts/start_queue_worker.sh
# ---
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from api.services.science_stack.science_contracts import (
    MergeWavChunksRequest,
    MergeWavChunksResponse,
    SemanticAnalyzeRequest,
    SemanticAnalyzeResponse,
)
from api.services.science_stack.science_engine import (
    merge_wav_chunks_base64,
    semantic_analyze_text,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="EliteEW Science Stack Sidecar", version="1.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "science-stack-sidecar"}


@app.post("/v1/science/semantic-analyze", response_model=SemanticAnalyzeResponse)
async def semantic_analyze(request: SemanticAnalyzeRequest) -> SemanticAnalyzeResponse:
    try:
        result = semantic_analyze_text(request.text, max_features=request.max_features)
    except Exception as exc:
        logger.exception("[STEP] science_sidecar_semantic_fail")
        raise HTTPException(status_code=500, detail="Semantic analysis failed") from exc
    return SemanticAnalyzeResponse.model_validate(result)


@app.post("/v1/science/merge-wav-chunks", response_model=MergeWavChunksResponse)
async def merge_wav(request: MergeWavChunksRequest) -> MergeWavChunksResponse:
    try:
        merged_b64 = merge_wav_chunks_base64(request.chunks_base64, pause_seconds=request.pause_seconds)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("[STEP] science_sidecar_wav_merge_fail")
        raise HTTPException(status_code=500, detail="WAV merge failed") from exc
    return MergeWavChunksResponse(wav_base64=merged_b64)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
