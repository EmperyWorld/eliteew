# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Minimal FastAPI sidecar for Playwright HTML slide screenshots on queue-worker.
# Invariants:
# - Only accepts paths under /app/generated_files; Playwright runs here, not in stack0-api.
# Related:
# - docker/builders/stack0-api/scripts/start_queue_worker.sh
# ---
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from api.services.rendering.browser_render_contracts import (
    HtmlSlidesRenderRequest,
    HtmlSlidesRenderResponse,
)
from api.services.rendering.playwright_renderer import (
    screenshot_html_slides,
    validate_generated_files_path,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="EliteEW Browser Render Sidecar", version="1.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "browser-render-sidecar"}


@app.post("/v1/render/html-slides", response_model=HtmlSlidesRenderResponse)
async def render_html_slides(request: HtmlSlidesRenderRequest) -> HtmlSlidesRenderResponse:
    try:
        html_path = validate_generated_files_path(request.html_path)
        screenshot_dir = validate_generated_files_path(request.screenshot_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        paths = await screenshot_html_slides(
            html_path=html_path,
            screenshot_dir=screenshot_dir,
            viewport_width=request.viewport_width,
            viewport_height=request.viewport_height,
            slide_selector=request.slide_selector,
            filename_prefix=request.filename_prefix,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("[STEP] browser_render_sidecar_runtime_fail html=%s", html_path)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("[STEP] browser_render_sidecar_unexpected_fail html=%s", html_path)
        raise HTTPException(status_code=500, detail="Browser render failed") from exc

    return HtmlSlidesRenderResponse(
        screenshot_count=len(paths),
        screenshot_paths=[str(p) for p in paths],
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
