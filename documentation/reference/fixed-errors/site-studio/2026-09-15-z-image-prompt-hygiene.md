# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Site Studio / ImperorG 01_top images painted gibberish and repeated scenes.
# ---

# z-image prompt hygiene (quote-bait, Cyrillic, non-native latent)

| Field | Value |
|-------|--------|
| **product_id** | `site-studio` |
| **status** | `fixed` |
| **date** | `2026-09-15` |
| **also_affects** | EWRP / Image Studio `01_top` callers (native latent snap) |
| **canon** | `documentation/product/SITE-STUDIO.md` |
| **commit** | — |

## Symptom

ImperorG / Site Studio Comfy images looked like near-duplicates with random inscriptions (often Cyrillic or fake type). Operator contract: no on-image text except an English project name when actually required.

## Failure layers

- Prompt contract: every slot appended a guard containing example quotes `"Brand Name"`; z-image paints quoted strings.
- Prompt contract: Russian `site_topic` / blueprint mood injected as Latin+Cyrillic; model paints letters.
- Prompt contract: six slots shared similar “premium editorial” leads → near-identical frames.
- Comfy apply: `01_top` ignores negative CLIP (`ConditioningZeroOut`); anti-text in negative was unused.
- Comfy apply: Site Studio requested 1600×900 / 1200×1600; z-image-turbo native is 1024×1024 — non-native latents yield glitch soup and pseudo-text (same lesson as EWRP 2026-07).

## Root cause

The positive prompt and turbo latent were inviting type and collapsing diversity; negative prompt could not compensate on `01_top`.

## What we did

- Shared sanitizer `shared/api/services/ugs/z_image_prompt.py`: strip Cyrillic, drop invalid quotes, scrub text-bait, English wordmark allowlist, native 1024² snap.
- Site Studio / ImperorG builders use it; slot `promptGuidance` made visually distinct.
- `_apply_text_to_image_params` snaps turbo latents to 1024×1024.

## Recommendations

- Never put example quotes in anti-text guards.
- Do not inject `site_title` into default image prompts (Cyrillic or otherwise).
- Do not rely on negative CLIP for `01_top`.

## Verification

```text
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest tests/test_ugs_z_image_prompt.py tests/test_site_studio_image_slots.py tests/test_ewrp_helpers.py tests/test_imperorg_service_resilience.py -k entity_image_prompt -q --tb=short
```

## Residual risk

z-image-turbo can still emit glyph-like texture on rare seeds. Live images update only after stack0 API bake/deploy and a new generate.
