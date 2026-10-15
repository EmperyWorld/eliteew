from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import bindparam, text  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _resolve_workflows_dir() -> Path:
    """
    Prefer runtime-mounted host/comfyui (API bind /app/comfyui), then repo paths.
    """

    candidates = (
        Path("/app/comfyui"),
        Path("/app/comfyui/workflow"),
        PROJECT_ROOT / "comfyui",
        PROJECT_ROOT / "comfyui" / "workflow",
        PROJECT_ROOT / "host" / "comfyui",
    )
    for p in candidates:
        if p.exists() and p.is_dir() and any(p.glob("*.json")):
            return p
    return PROJECT_ROOT / "host" / "comfyui"


COMFYUI_WORKFLOWS_DIR = _resolve_workflows_dir()

MODEL_INPUT_KEYS = {
    "ckpt_name",
    "clip_name",
    "clip_name1",
    "clip_name2",
    "control_net_name",
    "diffusion_model",
    "lora_name",
    "model",
    "model_name",
    "text_encoder_1",
    "text_encoder_2",
    "unet_name",
    "vae_name",
}

# Non-product JSON living next to workflows (batch manifests, drafts).
_SKIP_WORKFLOW_PREFIXES = ("ewdesk_",)

WORKFLOW_DESCRIPTIONS: dict[str, str] = {
    "01_top": "Подготовленный image workflow для генерации рекламных/баннерных изображений.",
    "site_studio_photo": (
        "Site Studio / ImperorG stills: Flux.2 Klein 4B distilled (command-center 3090). "
        "EmptyFlux2LatentImage + Flux2Scheduler 4 / CFG 1 / euler. Not z-image 01_top."
    ),
    "BIG_XL_SFT": "ACE Step 1.5 XL SFT v5 (BIG_XL_SFT) — chained AceStepSFTGenerate + ACE15XL danceability slider.",
    "FL_AceStep_LoRA_train_phase1_label": "AceStep LoRA train phase 1 (labeling).",
    "FL_AceStep_LoRA_train_phase2_train": "AceStep LoRA train phase 2 (train).",
    "Musicv2": "ACE Step 1.5 XL Turbo (ugs_workflow=v2).",
    "Musicv2_base": "ACE Step 1.5 XL Base (ugs_workflow=v2_base).",
    "Musicv2_sft": "ACE Step 1.5 XL SFT via KSampler path (ugs_workflow=v2_sft).",
    "ace_sft_new": "ACE Step 1.5 XL SFT native AceStepSFT nodes (ugs_workflow=v4).",
    "audio_ace_music": "Legacy ACE music graph (не default Студии; MusicForge default = ace_sft_new / v4).",
    "audio_ace_step_1_5_split_4b_v3": "ACE Step 1.5 XL Turbo split 4B (ugs_workflow=v3).",
    "audio_ace_step_1_m2m_editing": "Правка трека по новому тексту (на базе исходного аудио).",
    "audio_diffrhythm_music": "Музыкальный workflow DiffRhythm (альтернативный).",
    "music_forge_ace15_mvp": "MusicForge MVP на AceStep 1.5 SFT.",
    "redactor_image": "Редактирование изображения через Qwen Image Edit.",
    "rotate_image": "Workflow для поворота и генерации нескольких ракурсов изображения.",
    "text_to_image": "Базовый text-to-image workflow (z-image-turbo / Lumina2).",
    "v4_luna_ace_sft_xl": "ACE Step 1.5 XL SFT + Luna (ACE15XL studio-lofi slider, ugs_workflow=v4_luna).",
    "video_wan2_2_14B_image": "Image-to-video workflow на Wan 2.2 14B.",
}


def discover_comfyui_workflow_files() -> list[Path]:
    if not COMFYUI_WORKFLOWS_DIR.exists():
        return []

    files: list[Path] = []
    for path in sorted(COMFYUI_WORKFLOWS_DIR.glob("*.json")):
        if path.name.startswith(_SKIP_WORKFLOW_PREFIXES):
            continue
        files.append(path)
    return files


def _slug_from_path(path: Path) -> str:
    return path.stem.strip()


def _name_from_slug(slug: str) -> str:
    return slug.replace("_", " ").replace("-", " ").title()


def _category_from_slug(slug: str) -> str:
    if (
        slug.startswith("audio_")
        or slug.startswith("Music")
        or slug.startswith("ace_")
        or slug.startswith("BIG_")
        or slug.startswith("v4_")
        or slug.startswith("music_")
        or slug.startswith("FL_AceStep")
    ):
        return "audio"
    if slug.startswith("video_"):
        return "video"
    if "image" in slug or slug in {"01_top", "rotate", "redactor", "site_studio_photo"}:
        return "image"
    return "general"


def _description_from_slug(slug: str) -> str:
    return WORKFLOW_DESCRIPTIONS.get(
        slug,
        f"Импортированный ComfyUI workflow из `{slug}.json`.",
    )


def _extract_model_dependencies(workflow_json: dict[str, Any]) -> list[str]:
    dependencies: set[str] = set()

    for node in workflow_json.values():
        if not isinstance(node, dict):
            continue

        inputs = node.get("inputs", {})
        if not isinstance(inputs, dict):
            continue

        for key, value in inputs.items():
            if key not in MODEL_INPUT_KEYS:
                continue
            if isinstance(value, str) and value.strip():
                dependencies.add(value.strip())

    return sorted(dependencies)


def _estimate_time(category: str, slug: str) -> int:
    if category == "video":
        return 360
    if category == "audio":
        if "editing" in slug:
            return 240
        return 180
    if category == "image":
        return 60
    return 90


async def import_comfyui_workflows_from_disk(
    db: AsyncSession,
    *,
    created_by: UUID | None = None,
    overwrite_existing: bool = True,
) -> dict[str, Any]:
    select_sql = text(
        """
        SELECT slug, created_by
        FROM comfyui_workflows
        WHERE lower(slug) = lower(:slug)
        LIMIT 1
        """
    )
    insert_sql = text(
        """
        INSERT INTO comfyui_workflows (
            name,
            slug,
            category,
            description,
            json_body,
            model_dependencies,
            metadata,
            estimated_time,
            version,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            :name,
            :slug,
            :category,
            :description,
            :json_body,
            :model_dependencies,
            :metadata,
            :estimated_time,
            :version,
            :is_active,
            :created_by,
            NOW(),
            NOW()
        )
        """
    ).bindparams(
        bindparam("json_body", type_=JSONB),
        bindparam("model_dependencies", type_=JSONB),
        bindparam("metadata", type_=JSONB),
    )
    update_sql = text(
        """
        UPDATE comfyui_workflows
        SET
            name = :name,
            slug = :slug,
            category = :category,
            description = :description,
            json_body = :json_body,
            model_dependencies = :model_dependencies,
            metadata = :metadata,
            estimated_time = :estimated_time,
            version = :version,
            is_active = :is_active,
            created_by = COALESCE(created_by, :created_by),
            updated_at = NOW()
        WHERE slug = :existing_slug
        """
    ).bindparams(
        bindparam("json_body", type_=JSONB),
        bindparam("model_dependencies", type_=JSONB),
        bindparam("metadata", type_=JSONB),
    )

    workflow_files = discover_comfyui_workflow_files()
    imported = 0
    updated = 0
    skipped = 0
    errors: list[dict[str, str]] = []
    processed_slugs: list[str] = []

    for workflow_file in workflow_files:
        slug = _slug_from_path(workflow_file)

        try:
            workflow_json = json.loads(workflow_file.read_text())
            if not isinstance(workflow_json, dict):
                raise ValueError("workflow JSON must be an object")
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            errors.append({"file": workflow_file.name, "error": str(exc)})
            continue

        category = _category_from_slug(slug)
        payload: dict[str, Any] = {
            "name": _name_from_slug(slug),
            "slug": slug,
            "category": category,
            "description": _description_from_slug(slug),
            "json_body": workflow_json,
            "model_dependencies": _extract_model_dependencies(workflow_json),
            "metadata": {
                "source": "filesystem",
                "source_file": workflow_file.name,
                "source_path": str(workflow_file),
                "node_count": len(workflow_json),
            },
            "estimated_time": _estimate_time(category, slug),
            "version": 1,
            "is_active": True,
        }

        existing_row = (await db.execute(select_sql, {"slug": slug})).mappings().one_or_none()

        if existing_row:
            if not overwrite_existing:
                skipped += 1
                continue

            await db.execute(
                update_sql,
                {
                    **payload,
                    "created_by": created_by,
                    "existing_slug": existing_row["slug"],
                },
            )
            updated += 1
        else:
            await db.execute(insert_sql, {**payload, "created_by": created_by})
            imported += 1

        processed_slugs.append(slug)

    await db.commit()

    return {
        "directory": str(COMFYUI_WORKFLOWS_DIR),
        "total_files": len(workflow_files),
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "slugs": processed_slugs,
    }
