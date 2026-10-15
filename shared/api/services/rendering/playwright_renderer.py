# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Local Playwright implementation for HTML slide screenshots — runs only on queue-worker sidecar.
# Invariants:
# - Not imported from stack0-api code paths; sidecar and direct worker mode only.
# - Wait for document load + document.fonts.ready (not networkidle — EWRP HTML is offline/file://).
# Related:
# - api/services/rendering/render_sidecar_app.py
# - api/services/ewrp_font_assets.py
# ---
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

GENERATED_FILES_ROOT = Path("/app/generated_files")


def validate_generated_files_path(raw: str | Path) -> Path:
    """Resolve path and ensure it stays under the shared generated_files root."""
    candidate = Path(raw)
    if not candidate.is_absolute():
        msg = f"Path must be absolute under {GENERATED_FILES_ROOT}: {raw!r}"
        raise ValueError(msg)
    resolved = candidate.resolve()
    root = GENERATED_FILES_ROOT.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        msg = f"Path must stay under {root}: {resolved}"
        raise ValueError(msg) from exc
    return resolved


def playwright_launch_kwargs() -> dict[str, Any]:
    """Launch Playwright with a real Chromium binary if headless shell is absent."""
    browsers_dir = Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "/app/playwright-browsers"))
    kwargs: dict[str, Any] = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
    candidates = sorted(browsers_dir.glob("chromium-*/chrome-linux64/chrome"))
    if candidates:
        kwargs["executable_path"] = str(candidates[-1])
    return kwargs


async def screenshot_html_slides(
    *,
    html_path: Path,
    screenshot_dir: Path,
    viewport_width: int = 1600,
    viewport_height: int = 1131,
    slide_selector: str = ".ewrp-slide",
    filename_prefix: str = "page",
) -> list[Path]:
    """Capture one PNG per slide section; returns sorted screenshot paths."""
    try:
        from playwright.async_api import async_playwright  # type: ignore[import-not-found]
    except ImportError as exc:
        msg = (
            "Browser render sidecar requires Playwright. Install: pip install playwright && playwright install chromium"
        )
        raise RuntimeError(msg) from exc

    html_path = validate_generated_files_path(html_path)
    screenshot_dir = validate_generated_files_path(screenshot_dir)
    if not html_path.is_file():
        msg = f"HTML file not found: {html_path}"
        raise FileNotFoundError(msg)

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    for old in screenshot_dir.glob(f"{filename_prefix}_*.png"):
        try:
            old.unlink()
        except OSError:
            logger.warning("[STEP] browser_render_old_screenshot_remove_skip path=%s", old)

    written: list[Path] = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**playwright_launch_kwargs())
        page = await browser.new_page()
        await page.set_viewport_size({"width": viewport_width, "height": viewport_height})
        # file:// + self-hosted fonts: networkidle hangs when any CSS/URL cannot idle (CDN/offline).
        await page.goto(f"file://{html_path}", wait_until="load")
        try:
            await page.evaluate("() => document.fonts.ready")
        except Exception:
            logger.warning(
                "[STEP] browser_render_fonts_ready_skip html=%s",
                html_path,
                exc_info=True,
            )
        await page.wait_for_timeout(200)
        sections = await page.query_selector_all(slide_selector)
        for index, section in enumerate(sections):
            out_path = screenshot_dir / f"{filename_prefix}_{index + 1:02d}.png"
            await section.screenshot(path=str(out_path), type="png")
            written.append(out_path)
        await browser.close()

    return sorted(written)
