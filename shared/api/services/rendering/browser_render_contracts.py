# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared request/response models for the stack0 browser render sidecar HTTP contract.
# Invariants:
# - html_path and screenshot_dir must resolve under /app/generated_files on the sidecar host.
# Related:
# - api/services/rendering/render_sidecar_app.py
# - api/services/rendering/browser_render_client.py
# ---
from __future__ import annotations

from pydantic import BaseModel, Field


class HtmlSlidesRenderRequest(BaseModel):
    html_path: str = Field(..., description="Absolute path to index.html on shared generated_files volume")
    screenshot_dir: str = Field(..., description="Directory for page_XX.png outputs")
    viewport_width: int = Field(default=1600, ge=320, le=3840)
    viewport_height: int = Field(default=1131, ge=240, le=2160)
    slide_selector: str = Field(default=".ewrp-slide", min_length=1)
    filename_prefix: str = Field(default="page", min_length=1)


class HtmlSlidesRenderResponse(BaseModel):
    screenshot_count: int = Field(ge=0)
    screenshot_paths: list[str] = Field(default_factory=list)
