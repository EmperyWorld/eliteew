# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP client for stack0 browser render sidecar — used by stack0-api and inline EWRP fallbacks.
# Invariants:
# - Never imports playwright; talks to queue-worker sidecar only.
# Related:
# - api/services/rendering/browser_render_contracts.py
# - api/core/unified_config.py (browser_render_service_url)
# ---
from __future__ import annotations

import logging
from pathlib import Path

import httpx

from api.core.unified_config import unified_settings
from api.services.rendering.browser_render_contracts import (
    HtmlSlidesRenderRequest,
    HtmlSlidesRenderResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_RENDER_TIMEOUT_SEC = 300.0


class BrowserRenderUnavailableError(RuntimeError):
    """Raised when the browser render sidecar is unreachable or misconfigured."""


def browser_render_service_url() -> str:
    explicit = (unified_settings.browser_render_service_url or "").strip().rstrip("/")
    if explicit:
        return explicit
    host = (unified_settings.browser_render_worker_host or "").strip() or "stack0-eliteew-api-worker-prod"
    port = unified_settings.browser_render_service_port
    return f"http://{host}:{port}"


async def request_html_slide_screenshots(
    *,
    html_path: Path,
    screenshot_dir: Path,
    viewport_width: int = 1600,
    viewport_height: int = 1131,
    slide_selector: str = ".ewrp-slide",
    filename_prefix: str = "page",
    timeout_sec: float = DEFAULT_RENDER_TIMEOUT_SEC,
) -> list[Path]:
    """POST render job to queue-worker sidecar; returns local screenshot paths."""
    base_url = browser_render_service_url()
    if not base_url:
        raise BrowserRenderUnavailableError(
            "BROWSER_RENDER_SERVICE_URL is not configured — EWRP PDF screenshots require queue-worker sidecar"
        )

    payload = HtmlSlidesRenderRequest(
        html_path=str(html_path),
        screenshot_dir=str(screenshot_dir),
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        slide_selector=slide_selector,
        filename_prefix=filename_prefix,
    )
    url = f"{base_url}/v1/render/html-slides"
    logger.info(
        "[STEP] browser_render_request url=%s html=%s screenshot_dir=%s",
        url,
        html_path,
        screenshot_dir,
    )
    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            response = await client.post(url, json=payload.model_dump())
            response.raise_for_status()
            body = HtmlSlidesRenderResponse.model_validate(response.json())
    except httpx.HTTPError as exc:
        logger.warning("[STEP] browser_render_http_fail url=%s err=%s", url, exc)
        raise BrowserRenderUnavailableError(f"Browser render sidecar request failed ({base_url}): {exc}") from exc

    if body.screenshot_count <= 0:
        msg = f"Browser render sidecar returned zero screenshots for {html_path}"
        raise BrowserRenderUnavailableError(msg)

    paths = [Path(p) for p in body.screenshot_paths]
    missing = [p for p in paths if not p.is_file()]
    if missing:
        msg = f"Browser render sidecar reported paths that are missing locally: {missing[:3]}"
        raise BrowserRenderUnavailableError(msg)
    return paths
