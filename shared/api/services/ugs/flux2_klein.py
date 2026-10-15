# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Flux.2 Klein 4B distilled latent sizing for Site Studio / ImperorG stills.
# Invariants:
# - Width and height are multiples of 16 (EmptyFlux2LatentImage / Flux2Scheduler).
# - Do not snap to 1024×1024 — that is z-image-turbo only.
# Related:
# - api/services/ugs/z_image_prompt.py
# - host/comfyui/site_studio_photo.json
# ---
from __future__ import annotations

FLUX2_SIZE_STEP = 16
FLUX2_MIN_SIZE = 512
FLUX2_MAX_SIZE = 2048


def snap_flux2_klein_latent(width: int, height: int) -> tuple[int, int]:
    """Snap requested size to Flux.2 Klein legal latents (step 16, clamped)."""
    raw_w = int(width or 0) or 1024
    raw_h = int(height or 0) or 1024
    width_i = max(FLUX2_MIN_SIZE, min(FLUX2_MAX_SIZE, raw_w))
    height_i = max(FLUX2_MIN_SIZE, min(FLUX2_MAX_SIZE, raw_h))
    width_i = max(FLUX2_MIN_SIZE, (width_i // FLUX2_SIZE_STEP) * FLUX2_SIZE_STEP)
    height_i = max(FLUX2_MIN_SIZE, (height_i // FLUX2_SIZE_STEP) * FLUX2_SIZE_STEP)
    return width_i, height_i
