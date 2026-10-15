#!/usr/bin/env bash
# Upsert host/comfyui/*.json into Postgres comfyui_workflows (stack1-postgres / ai_services).
# Usage (on the host that has the checkout + stack1-postgres):
#   bash docker/scripts/sync-comfyui-workflows-to-db.sh
# Env:
#   COMFYUI_DIR   default: <repo>/host/comfyui
#   PG_CONTAINER  default: stack1-postgres
#   PG_USER       default: ai_user
#   PG_DB         default: ai_services
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMFYUI_DIR="${COMFYUI_DIR:-$ROOT/host/comfyui}"
PG_CONTAINER="${PG_CONTAINER:-stack1-postgres}"
PG_USER="${PG_USER:-ai_user}"
PG_DB="${PG_DB:-ai_services}"
RUNTIME="${CONTAINER_RUNTIME:-podman}"

if [[ ! -d "$COMFYUI_DIR" ]]; then
  echo "missing COMFYUI_DIR=$COMFYUI_DIR" >&2
  exit 1
fi

python3 - "$COMFYUI_DIR" <<'PY' | "$RUNTIME" exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1
import json, sys
from pathlib import Path

comfy = Path(sys.argv[1])
skip_prefixes = ("ewdesk_",)

MODEL_KEYS = {
    "ckpt_name","clip_name","clip_name1","clip_name2","control_net_name",
    "diffusion_model","lora_name","model","model_name","text_encoder_1",
    "text_encoder_2","unet_name","vae_name",
}

DESCRIPTIONS = {
    "01_top": "Подготовленный image workflow для генерации рекламных/баннерных изображений.",
    "BIG_XL_SFT": "ACE Step 1.5 XL SFT v5 (BIG_XL_SFT) — chained AceStepSFTGenerate + ACE15XL danceability slider.",
    "FL_AceStep_LoRA_train_phase1_label": "AceStep LoRA train phase 1 (labeling).",
    "FL_AceStep_LoRA_train_phase2_train": "AceStep LoRA train phase 2 (train).",
    "Musicv2": "ACE Step 1.5 XL Turbo (ugs_workflow=v2).",
    "Musicv2_base": "ACE Step 1.5 XL Base (ugs_workflow=v2_base).",
    "Musicv2_sft": "ACE Step 1.5 XL SFT via KSampler path (ugs_workflow=v2_sft).",
    "ace_sft_new": "ACE Step 1.5 XL SFT native AceStepSFT nodes (ugs_workflow=v4).",
    "audio_ace_music": "Музыкальный workflow (основной, генератор песен).",
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

def category(slug: str) -> str:
    if slug.startswith(("audio_", "Music", "ace_", "BIG_", "v4_", "music_", "FL_AceStep")):
        return "audio"
    if slug.startswith("video_"):
        return "video"
    if "image" in slug or slug in {"01_top", "rotate", "redactor"}:
        return "image"
    return "general"

def deps(body: dict) -> list[str]:
    out=set()
    for node in body.values():
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs") or {}
        if not isinstance(inputs, dict):
            continue
        for k,v in inputs.items():
            if k in MODEL_KEYS and isinstance(v,str) and v.strip():
                out.add(v.strip())
    return sorted(out)

def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"

def sql_json(obj) -> str:
    return sql_str(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))

print("BEGIN;")
count=0
for path in sorted(comfy.glob("*.json")):
    if path.name.startswith(skip_prefixes):
        continue
    body = json.loads(path.read_text())
    if not isinstance(body, dict):
        raise SystemExit(f"not an object: {path}")
    slug = path.stem
    name = slug.replace("_"," ").replace("-"," ").title()
    cat = category(slug)
    desc = DESCRIPTIONS.get(slug, f"Импортированный ComfyUI workflow из `{slug}.json`.")
    model_deps = deps(body)
    meta = {
        "source": "filesystem",
        "source_file": path.name,
        "source_path": str(path),
        "node_count": len(body),
        "synced_by": "sync-comfyui-workflows-to-db.sh",
    }
    est = 360 if cat=="video" else (180 if cat=="audio" else (60 if cat=="image" else 90))
    if cat=="audio" and "editing" in slug:
        est = 240

    print(f"""
INSERT INTO comfyui_workflows (
  name, slug, category, description, json_body, model_dependencies, metadata,
  estimated_time, version, is_active, created_at, updated_at
) VALUES (
  {sql_str(name)},
  {sql_str(slug)},
  {sql_str(cat)},
  {sql_str(desc)},
  {sql_json(body)}::jsonb,
  {sql_json(model_deps)}::jsonb,
  {sql_json(meta)}::jsonb,
  {est},
  1,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  json_body = EXCLUDED.json_body,
  model_dependencies = EXCLUDED.model_dependencies,
  metadata = EXCLUDED.metadata,
  estimated_time = EXCLUDED.estimated_time,
  version = comfyui_workflows.version + 1,
  is_active = TRUE,
  updated_at = NOW();
""")
    count += 1

print("COMMIT;")
print(f"-- upserted {count} workflows", file=sys.stderr)
PY
