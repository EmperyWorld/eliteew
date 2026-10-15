# Site Studio stills used z-image turbo instead of Flux.2 Klein on the 3090

| Field | Value |
|-------|--------|
| **product_id** | `site-studio` |
| **status** | `fixed` |
| **date** | `2026-09-15` |
| **also_affects** | UGS Comfy apply (`EmptyFlux2LatentImage` / `RandomNoise`) |
| **canon** | `documentation/product/SITE-STUDIO.md`, `documentation/platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md` |
| **commit** | — |

## Symptom

ImperorG / Site Studio photos were glitch soup, near-duplicates, and fake lettering. Prompt hygiene on `01_top` could not produce 16:9 / 3:4 stills because z-image-turbo is native 1024×1024. Command-center already had Flux.2 Klein 4B distilled on the RTX 3090 (`~/podryad/models/comfyui`).

## Failure layers

- Product graph selection: Site Studio called `01_top` (z-image-turbo / `EmptySD3LatentImage`).
- Comfy apply: turbo preserve snapped every size to 1024²; Klein graphs were not wired.
- Seed: Klein uses `RandomNoise.noise_seed`, not `KSampler.seed`.
- Size: Flux2 needs matching width/height on latent **and** `Flux2Scheduler`.

## Root cause

Site Studio stills used the EWRP/Image Studio turbo graph. That model cannot do the slot aspects; this host already had the correct Klein distilled weights and the official Comfy T2I subgraph.

## What we did

- Added `host/comfyui/site_studio_photo.json` from Comfy Flux.2 Klein 4B Distilled (local `flux-2-klein-4b-fp8.safetensors`, CLIP type `flux2`, `flux2-vae.safetensors`).
- Installed the same API graph plus official UI template under `~/podryad/stack2/comfyui-clean/user/default/workflows/`.
- Site Studio / ImperorG `workflow_key` = `site_studio_photo`.
- UGS apply: preserve Klein 4-step sampler, snap step-16 sizes, write Flux2 latent + scheduler + RandomNoise.
- Prompt hygiene unchanged (Klein still paints type if baited).

## Recommendations

- Do not send Site Studio stills through `01_top`.
- Do not snap Klein to 1024².
- Do not overwrite Klein `Flux2Scheduler` steps with Site Studio `steps=20`.
- Keep EWRP / Image Studio on `01_top`.
- After API bake, `host/comfyui/site_studio_photo.json` must exist on prod-core (bind `/app/comfyui`).

## Verification

```bash
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest \
  tests/test_ugs_flux2_klein_workflow.py tests/test_site_studio_image_slots.py \
  tests/test_ewrp_offline_fonts_and_comfy_params.py -q --tb=short
```

Live pixels after stack0 API deploy + new ImperorG generate. Comfy UI: Load `site_studio_photo` / `site_studio_photo_ui` on `:31003`.

## Residual risk

Long-lived Comfy VRAM soup (2026-07-22) still needs `podman restart comfyui` when the 3090 is saturated. Shop/consultations page heroes remain text-only CMS (no new slots in this wave).
