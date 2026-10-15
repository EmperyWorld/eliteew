# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate and load Desktop AI Chat blueprint templates and their manifest.
# Invariants:
# - Built-in and DB templates share one Pydantic contract; unknown extra fields remain ignored for compatibility.
# - PlanStep.min_roster (1–6) gates expansion steps; core steps use min_roster ≤ 3.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
# ---

"""Plan template manifest + JSON files; Pydantic validation."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

ENSEMBLE_DIR = Path(__file__).resolve().parent.parent
PLAN_TEMPLATES_DIR = ENSEMBLE_DIR / "plan_templates"


class OutlineSubsection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading: str
    step_id: str


class DocumentOutlineSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading: str
    id: str | None = None
    step_ids: list[str] = Field(default_factory=list)
    subsections: list[OutlineSubsection] = Field(default_factory=list)


class PlanStep(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step_id: str
    title: str
    instruction_for_model: str
    required_slots: dict[str, int] = Field(default_factory=dict)
    scope_fence: str = ""
    output_format: list[str] = Field(default_factory=list)
    #: Шаг включается в план только если |ростер| ≥ значения (ядро ≤3; расширение 4–6).
    min_roster: int = Field(default=1, ge=1, le=6)

    @field_validator("required_slots")
    @classmethod
    def _normalize_slots(cls, v: dict[str, int]) -> dict[str, int]:
        out: dict[str, int] = {}
        for k, x in v.items():
            key = str(k).strip()
            if not key:
                continue
            if isinstance(x, bool):
                continue
            try:
                out[key] = int(x)
            except (TypeError, ValueError):  # fmt: skip
                continue
        return out


class PlanTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: int = 1
    id: str
    version: int = 1
    title: str
    description: str = ""
    artifact_type: str = "general"
    required_context: list[str] = Field(default_factory=list)
    quality_rubric: list[str] = Field(default_factory=list)
    output_sections: list[str] = Field(default_factory=list)
    slots: dict[str, int] = Field(default_factory=dict)
    max_steps_per_hero: int = Field(default=2, ge=1, le=10)
    allow_mermaid: bool = False
    steps: list[PlanStep]
    document_outline: list[DocumentOutlineSection]

    @field_validator("steps")
    @classmethod
    def _unique_step_ids(cls, steps: list[PlanStep]) -> list[PlanStep]:
        seen: set[str] = set()
        for s in steps:
            if s.step_id in seen:
                raise ValueError(f"duplicate step_id: {s.step_id}")
            seen.add(s.step_id)
        return steps

    @model_validator(mode="after")
    def _outline_step_refs(self) -> Self:
        ids = {s.step_id for s in self.steps}
        for sec in self.document_outline:
            for sid in sec.step_ids:
                if sid not in ids:
                    raise ValueError(f"outline references unknown step_id: {sid}")
            for sub in sec.subsections:
                if sub.step_id not in ids:
                    raise ValueError(f"outline subsection references unknown step_id: {sub.step_id}")
        return self


class ManifestEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    file: str
    keywords: list[str] = Field(default_factory=list)
    #: Пример пользовательского запроса, гарантированно дающий совпадение по keywords (smoke / документация).
    example_command: str = ""


class PlanManifest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: int = 1
    templates: list[ManifestEntry]


@dataclass(frozen=True)
class PlanCatalog:
    manifest: PlanManifest
    templates_by_id: dict[str, PlanTemplate]
    entries_by_id: dict[str, ManifestEntry]


def _read_json(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw)


def load_plan_catalog(base_dir: Path | None = None) -> PlanCatalog:
    root = base_dir or PLAN_TEMPLATES_DIR
    man_path = root / "manifest.json"
    man_raw = _read_json(man_path)
    manifest = PlanManifest.model_validate(man_raw)
    by_id: dict[str, PlanTemplate] = {}
    entries_by_id: dict[str, ManifestEntry] = {}
    for ent in manifest.templates:
        entries_by_id[ent.id] = ent
        path = root / ent.file
        data = _read_json(path)
        tpl = PlanTemplate.model_validate(data)
        if tpl.id != ent.id:
            raise ValueError(f"template id mismatch manifest={ent.id} file={tpl.id}")
        by_id[tpl.id] = tpl
    catalog = PlanCatalog(manifest=manifest, templates_by_id=by_id, entries_by_id=entries_by_id)
    logger.info(
        "[STEP] ensemble_plan_template catalog_loaded templates=%s dir=%s",
        len(by_id),
        root,
    )
    return catalog


@lru_cache(maxsize=1)
def get_plan_catalog() -> PlanCatalog:
    return load_plan_catalog()


def get_plan_catalog_fresh() -> PlanCatalog:
    """Load plan templates from disk every time (admin/editor; bypass lru_cache)."""

    return load_plan_catalog()


def clear_plan_catalog_cache() -> None:
    """Invalidate file-catalog cache after operator changes (or sync with disk)."""

    get_plan_catalog.cache_clear()


async def get_plan_catalog_for_session(db: AsyncSession) -> PlanCatalog:
    """Файловый каталог + активные шаблоны из БД (по совпадению template id перекрывают файлы)."""
    from api.models.desktop_ai_chat import DesktopEnsemblePlanTemplate

    base = get_plan_catalog()
    r = await db.execute(
        select(DesktopEnsemblePlanTemplate)
        .where(DesktopEnsemblePlanTemplate.is_active.is_(True))
        .order_by(
            DesktopEnsemblePlanTemplate.sort_order.asc(),
            DesktopEnsemblePlanTemplate.created_at.asc(),
        )
    )
    rows = list(r.scalars().all())
    if not rows:
        return base

    overridden_ids = {row.template_id.strip() for row in rows}
    manifest_templates: list[ManifestEntry] = [e for e in base.manifest.templates if e.id not in overridden_ids]
    templates_by_id: dict[str, PlanTemplate] = dict(base.templates_by_id)
    entries_by_id: dict[str, ManifestEntry] = dict(base.entries_by_id)

    for row in rows:
        tid = row.template_id.strip()
        raw_body = dict(row.body) if isinstance(row.body, dict) else {}
        if raw_body.get("id") != tid:
            raw_body = {**raw_body, "id": tid}
        tpl = PlanTemplate.model_validate(raw_body)
        kw_raw = row.keywords if isinstance(row.keywords, list) else []
        kw_str = [str(x).strip() for x in kw_raw if str(x).strip()]
        ent = ManifestEntry(id=tpl.id, file=f"db:{row.id}", keywords=kw_str)
        templates_by_id[tpl.id] = tpl
        entries_by_id[tpl.id] = ent
        manifest_templates.append(ent)

    merged = PlanCatalog(
        manifest=PlanManifest(schema_version=1, templates=manifest_templates),
        templates_by_id=templates_by_id,
        entries_by_id=entries_by_id,
    )
    logger.info(
        "[STEP] ensemble_plan_template catalog_merged builtin=%s db_active=%s",
        len(base.templates_by_id),
        len(rows),
    )
    return merged
