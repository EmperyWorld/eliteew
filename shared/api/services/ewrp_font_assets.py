# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stage vendored EWRP fonts next to job index.html for offline Playwright PDF screenshots.
# Invariants:
# - Runtime HTML must not depend on fonts.googleapis.com / fonts.gstatic.com.
# - Relative fonts/ URLs resolve under the job directory (file:// and static serve).
# Related:
# - api/static/ewrp/vendor_ewrp_fonts.py
# - api/services/ewrp_templates.py
# - api/services/rendering/playwright_renderer.py
# ---

from __future__ import annotations

import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

_STATIC_EWRP = Path(__file__).resolve().parents[1] / "static" / "ewrp"
EWRP_FONTS_DIR = _STATIC_EWRP / "fonts"
EWRP_FONTS_CSS_PATH = _STATIC_EWRP / "fonts.css"


def ewrp_fonts_available() -> bool:
    return EWRP_FONTS_CSS_PATH.is_file() and EWRP_FONTS_DIR.is_dir() and any(EWRP_FONTS_DIR.iterdir())


def ewrp_font_face_css() -> str:
    """Return @font-face CSS with relative fonts/ URLs, or empty when not vendored."""
    if not EWRP_FONTS_CSS_PATH.is_file():
        logger.error("[STEP] ewrp_fonts_css_missing path=%s", EWRP_FONTS_CSS_PATH)
        return ""
    return EWRP_FONTS_CSS_PATH.read_text(encoding="utf-8").strip()


def stage_ewrp_fonts(output_dir: Path) -> Path:
    """
    Copy vendored fonts into ``output_dir/fonts`` so index.html relative urls resolve offline.

    Raises FileNotFoundError when vendor assets are missing (run vendor_ewrp_fonts.py).
    """
    if not ewrp_fonts_available():
        msg = f"EWRP fonts not vendored at {EWRP_FONTS_DIR}. Run: python3 shared/api/static/ewrp/vendor_ewrp_fonts.py"
        raise FileNotFoundError(msg)

    dest = output_dir / "fonts"
    dest.mkdir(parents=True, exist_ok=True)
    for src in EWRP_FONTS_DIR.iterdir():
        if src.is_file():
            shutil.copy2(src, dest / src.name)
    logger.info("[EWRP][STEP] fonts_staged dir=%s count=%s", dest, sum(1 for _ in dest.iterdir()))
    return dest
