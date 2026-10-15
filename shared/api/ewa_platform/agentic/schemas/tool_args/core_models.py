# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Strict Pydantic arg models for the agentic core toolset (10 registry tools).
# ---

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CatalogListArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    mode: Literal["search", "browse", "recent"] = "browse"


class RecallMemoryArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)


class FileOpenArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    name: str | None = Field(default=None, max_length=512)


class FileSaveTextArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    name: str = Field(min_length=1, max_length=512)
    body: str = Field(default="", max_length=120_000)
    text: str | None = Field(default=None, max_length=120_000)
    create_folder: bool | None = None
    reuse_folder: bool | None = None
    folder_name: str | None = Field(default=None, max_length=80)
    folder_label: str | None = Field(default=None, max_length=80)
    folder_item_id: str | None = Field(default=None, max_length=120)
    task_key: str | None = Field(default=None, max_length=80)


class FileCreateArgs(BaseModel):
    # Generative documents may carry a request plus bounded expert research.
    user_line: str = Field(min_length=1, max_length=64_000)
    name: str = Field(min_length=1, max_length=512)
    body: str = Field(default="", max_length=120_000)
    use_expert_research: bool | None = None
    create_folder: bool | None = None
    reuse_folder: bool | None = None
    folder_name: str | None = Field(default=None, max_length=80)
    folder_label: str | None = Field(default=None, max_length=80)
    folder_item_id: str | None = Field(default=None, max_length=120)
    task_key: str | None = Field(default=None, max_length=80)
    node_title: str | None = Field(default=None, max_length=80)


class CheckTaskStatusArgs(BaseModel):
    user_line: str = Field(default="", max_length=8000)
    task_id: str | None = Field(default=None, max_length=64)
    run_id: str | None = Field(default=None, max_length=64)


class ImageGenerationArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    prompt_preview: str | None = Field(default=None, max_length=4000)
    aspect_ratio: str | None = Field(default=None, max_length=16)


class EmailDispatcherArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    subject: str | None = Field(default=None, max_length=512)
    body: str | None = Field(default=None, max_length=32_000)


class PlanV1Args(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    plan_focus: str | None = Field(default=None, max_length=4000)
    horizon: str | None = Field(default=None, max_length=128)


class LlmSummarizeArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    text: str | None = Field(default=None, max_length=120_000)


class OperationsStatusArgs(BaseModel):
    user_line: str = Field(default="", max_length=8000)


class PaperlessImportArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    paperless_id: str | None = Field(default=None, max_length=128)


class FileDeleteArgs(BaseModel):
    user_line: str = Field(min_length=1, max_length=8000)
    name: str = Field(min_length=1, max_length=512)
