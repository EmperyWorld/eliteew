# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Music Generator v4 (AceStep SFT XL) — солисты и пресеты отдельно от v3.
# Invariants:
#   - Сейчас единственный солист v4 — Luna (LoRA emew_style_v1 + EMEW_STYLE_V1).
# Related:
#   - api/services/studio_comfy_workflows.py
# ---

from api.services.music_generator_v4.soloists import (
    MUSIC_GENERATOR_V4_SOLOIST_PRESETS,
    apply_v4_luna_soloist_tags,
    coerce_v4_soloist_generate_params,
    normalize_v4_soloist_key,
    v4_soloist_tag_phrase,
)

__all__ = [
    "MUSIC_GENERATOR_V4_SOLOIST_PRESETS",
    "apply_v4_luna_soloist_tags",
    "coerce_v4_soloist_generate_params",
    "normalize_v4_soloist_key",
    "v4_soloist_tag_phrase",
]
