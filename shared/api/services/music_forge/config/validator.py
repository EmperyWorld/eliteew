# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hard-gate validation for MusicForge config revision activation.
# Invariants:
# - Empty reasons list means bundle may be activated.
# - Wave A: Modes + pipelines required; stage_type ∈ closed registry.
# Related:
# - api/services/music_forge/config/repository.py
# - api/services/music_forge/config/stage_types.py
# - api/services/music_forge/config/types.py
# ---

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.config.repository import (
    fetch_lanes,
    fetch_modes,
    fetch_pipelines,
    fetch_product_row,
    fetch_prompts,
    fetch_styles,
)
from api.services.music_forge.config.stage_types import (
    ALLOWED_LLM_UGS_TYPE_KEYS,
    ALLOWED_STAGE_TYPES,
)
from api.services.music_forge.config.types import ALLOWED_UGS_WORKFLOWS, REQUIRED_PROMPT_KINDS


class ConfigBundleValidator:
    """Validate MusicForge config bundles before revision activation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def validate_revision_for_activation(self, revision_id: UUID) -> list[str]:
        """Hard-gate: reasons empty means bundle may be activated."""
        reasons: list[str] = []
        exists = (
            await self.db.execute(
                text(
                    """
                    SELECT id FROM music_forge_config_revisions
                    WHERE id = CAST(:revision_id AS uuid)
                    LIMIT 1
                    """
                ),
                {"revision_id": str(revision_id)},
            )
        ).first()
        if exists is None:
            return [f"music_forge_config_revision_not_found:{revision_id}"]

        lanes = await fetch_lanes(self.db, revision_id)
        if not lanes:
            reasons.append("lanes_empty")
        elif not any(bool(lane.get("is_default")) for lane in lanes.values()):
            reasons.append("lanes_missing_is_default")
        for lane_key, lane in lanes.items():
            wf = str(lane.get("ugs_workflow") or "").strip()
            if wf not in ALLOWED_UGS_WORKFLOWS:
                reasons.append(f"lane_ugs_workflow_invalid:{lane_key}:{wf or 'empty'}")
            if not str(lane.get("workflow_file") or "").strip():
                reasons.append(f"lane_workflow_file_empty:{lane_key}")

        styles = await fetch_styles(self.db, revision_id)
        if not styles:
            reasons.append("styles_empty")

        prompts = await fetch_prompts(self.db, revision_id)
        missing_prompts = sorted(REQUIRED_PROMPT_KINDS - set(prompts.keys()))
        if missing_prompts:
            reasons.append(f"prompts_missing:{','.join(missing_prompts)}")

        product = await fetch_product_row(self.db, revision_id)
        if product is None:
            reasons.append("product_settings_missing")

        modes = await fetch_modes(self.db, revision_id)
        pipelines = await fetch_pipelines(self.db, revision_id)
        reasons.extend(_validate_modes_and_pipelines(modes, pipelines, lanes, prompts))
        return reasons


def _validate_modes_and_pipelines(
    modes: dict[str, dict],
    pipelines: dict[str, list[dict]],
    lanes: dict[str, dict],
    prompts: dict[str, dict],
) -> list[str]:
    reasons: list[str] = []
    if not modes:
        reasons.append("modes_empty")
        return reasons

    enabled_modes = [m for m in modes.values() if m.get("enabled")]
    if not enabled_modes:
        reasons.append("modes_none_enabled")
    elif not any(bool(m.get("is_default")) for m in enabled_modes):
        reasons.append("modes_missing_is_default")

    for mode_key, mode in modes.items():
        if not mode.get("enabled"):
            continue
        lane_key = str(mode.get("lane_key") or "").strip()
        if not lane_key:
            reasons.append(f"mode_lane_key_empty:{mode_key}")
        elif lane_key not in lanes:
            reasons.append(f"mode_lane_key_unknown:{mode_key}:{lane_key}")

        stages = [s for s in pipelines.get(mode_key, []) if s.get("enabled")]
        if not stages:
            reasons.append(f"pipeline_empty:{mode_key}")
            continue

        stage_keys: set[str] = set()
        has_audio = False
        for stage in stages:
            sk = str(stage.get("stage_key") or "").strip()
            st = str(stage.get("stage_type") or "").strip()
            if not sk:
                reasons.append(f"stage_key_empty:{mode_key}")
                continue
            if sk in stage_keys:
                reasons.append(f"stage_key_duplicate:{mode_key}:{sk}")
            stage_keys.add(sk)
            if st not in ALLOWED_STAGE_TYPES:
                reasons.append(f"stage_type_invalid:{mode_key}:{sk}:{st or 'empty'}")
                continue
            raw_settings = stage.get("settings")
            settings: dict = raw_settings if isinstance(raw_settings, dict) else {}
            if st == "audio_comfy":
                has_audio = True
                audio_lane = str(settings.get("lane_key") or lane_key).strip()
                if audio_lane not in lanes:
                    reasons.append(f"audio_lane_unknown:{mode_key}:{sk}:{audio_lane or 'empty'}")
            if st == "llm_generate":
                ugs_key = str(settings.get("ugs_type_key") or "").strip()
                if ugs_key and ugs_key not in ALLOWED_LLM_UGS_TYPE_KEYS:
                    reasons.append(f"llm_ugs_type_invalid:{mode_key}:{sk}:{ugs_key}")
                prompt_kind = str(settings.get("prompt_kind") or "").strip()
                if prompt_kind and prompt_kind not in prompts:
                    reasons.append(f"llm_prompt_kind_unknown:{mode_key}:{sk}:{prompt_kind}")
            if st == "style_build":
                prompt_kind = str(settings.get("prompt_kind") or "style").strip()
                if prompt_kind not in prompts:
                    reasons.append(f"style_prompt_kind_unknown:{mode_key}:{sk}:{prompt_kind}")
        if not has_audio:
            reasons.append(f"pipeline_missing_audio_comfy:{mode_key}")
    return reasons
