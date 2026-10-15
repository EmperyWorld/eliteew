# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Facade for EWRP HTML→PNG slide capture — always delegates to remote browser render sidecar.
# Invariants:
# - stack0-api must not import playwright; preserve EWRP call-site semantics.
# Related:
# - api/services/ewrp_service.py
# ---
from __future__ import annotations

from pathlib import Path

from api.services.rendering.browser_render_client import request_html_slide_screenshots


async def screenshot_ewrp_html_slides(
    *,
    html_path: Path,
    screenshot_dir: Path,
    viewport_width: int = 1600,
    viewport_height: int = 1131,
) -> list[Path]:
    """Capture EWRP slide PNGs via queue-worker browser render sidecar."""
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    return await request_html_slide_screenshots(
        html_path=html_path,
        screenshot_dir=screenshot_dir,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        slide_selector=".ewrp-slide",
        filename_prefix="page",
    )
