#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Queue ComfyUI workflow 01_top.json per Music Evolution soloist; download PNG → WebP avatars.
# Invariants:
# - Output paths match frontend `musicEvolutionSoloistAvatarSrc` (`public/music-evolution/soloists/`).
# Related:
# - host/comfyui/generate_desktop_hero_avatars.py
# - shared/web/frontend/src/pages/MusicEvolution/musicEvolutionSoloistTheme.ts
# ---
"""Generate Music Evolution soloist portrait avatars via ComfyUI HTTP API."""

from __future__ import annotations

import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKFLOW_PATH = ROOT / "01_top.json"
OUT_DIR = (
    ROOT.parent / "web" / "frontend" / "public" / "music-evolution" / "soloists"
).resolve()

_STYLE = (
    "high quality editorial music artist portrait, sharp focus, cinematic lighting, "
    "single centered bust portrait, square crop friendly, photorealistic skin, "
    "subtle stage atmosphere, no text, no watermark, no logo, no microphone in frame"
)

SOLOIST_JOBS: list[tuple[str, str]] = [
    (
        "pulse",
        f"{_STYLE}, young Slavic woman late 20s, dark warehouse techno DJ persona, "
        "stark strobe lighting, industrial mood, short dark hair, focused gaze, cyan rim light",
    ),
    (
        "haze",
        f"{_STYLE}, thoughtful Slavic man late 20s, lo-fi chill producer, warm amber lamp light, "
        "knit sweater, soft beard stubble, vinyl records bokeh, rainy window mood",
    ),
    (
        "grit",
        f"{_STYLE}, rugged Slavic man mid 20s, phonk street artist, hooded jacket, "
        "gritty urban neon, hard jawline, Memphis phonk aesthetic, low key lighting",
    ),
    (
        "ray",
        f"{_STYLE}, radiant Slavic woman mid 20s, modern Russian pop star, bright clean lighting, "
        "confident smile, sleek hair, colorful pop styling, hook-first performer energy",
    ),
    (
        "velvet",
        f"{_STYLE}, elegant Slavic woman mid 30s, jazz lounge singer, smoky warm spotlight, "
        "velvet dress, expressive eyes, brushed-drums lounge atmosphere bokeh",
    ),
    (
        "nova",
        f"{_STYLE}, ethereal Slavic woman late 20s, electronic dance artist, cyan-violet club lighting, "
        "futuristic ear cuff, breathy starlit gaze, atmospheric synth mood",
    ),
    (
        "nebula",
        f"{_STYLE}, young Slavic woman late 20s, dream Luna singer, soft violet-indigo mood lighting, "
        "lo-fi night studio vibe, introspective gaze, dark hair loose waves, fuchsia rim light",
    ),
    (
        "ascent",
        f"{_STYLE}, luminous Slavic woman mid 20s, trance vocalist, icy blue uplighting, "
        "wind-swept hair, euphoric lifted expression, supersaw glow background",
    ),
    (
        "ritm",
        f"{_STYLE}, glamorous woman early 30s, club house diva, sleek ponytail, "
        "cyan and magenta neon rim lights, metallic ear cuff, dancefloor performer energy",
    ),
    (
        "tempest",
        f"{_STYLE}, cinematic duet portrait of one man and one woman side by side, "
        "Slavic features, drum and bass storm energy, electric blue-violet lighting, "
        "duet performers, shoulders visible, balanced composition",
    ),
]


def load_workflow() -> dict:
    return json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))


def submit_prompt(
    base: dict,
    *,
    comfy_url: str,
    positive: str,
    seed: int,
    prefix: str,
    steps: int,
) -> str:
    wf = json.loads(json.dumps(base))
    wf["83:27"]["inputs"]["text"] = positive
    wf["83:3"]["inputs"]["seed"] = seed
    wf["83:3"]["inputs"]["steps"] = steps
    wf["60"]["inputs"]["filename_prefix"] = prefix
    client_id = str(uuid.uuid4())
    body = json.dumps({"prompt": wf, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(
        f"{comfy_url.rstrip('/')}/prompt",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if "error" in data:
        raise RuntimeError(data)
    pid = data.get("prompt_id")
    if not pid:
        raise RuntimeError(f"Unexpected response: {data}")
    return pid


def history_entry(comfy_url: str, prompt_id: str) -> dict | None:
    url = f"{comfy_url.rstrip('/')}/history/{prompt_id}"
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        return None
    return data.get(prompt_id)


def wait_for_images(
    comfy_url: str, prompt_id: str, timeout_s: float = 240.0
) -> list[dict]:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        entry = history_entry(comfy_url, prompt_id)
        if entry:
            outputs = entry.get("outputs") or {}
            node60 = outputs.get("60") or {}
            images = node60.get("images") or []
            if images:
                return images
        time.sleep(1.5)
    raise TimeoutError(f"No output for prompt_id={prompt_id}")


def download_image(img: dict, base_url: str) -> bytes:
    q = urllib.parse.urlencode(
        {
            "filename": img["filename"],
            "type": img.get("type", "output"),
            "subfolder": img.get("subfolder", ""),
        }
    )
    url = f"{base_url.rstrip('/')}/view?{q}"
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def png_to_webp(png_path: Path, webp_path: Path, quality: int = 90) -> None:
    from PIL import Image

    with Image.open(png_path) as img:
        rgb = img.convert("RGB")
        fitted = Image.new("RGB", (512, 512), (0, 0, 0))
        rgb.thumbnail((512, 512), Image.Resampling.LANCZOS)
        offset = ((512 - rgb.width) // 2, (512 - rgb.height) // 2)
        fitted.paste(rgb, offset)
        fitted.save(webp_path, format="WEBP", quality=quality, method=6)


if __name__ == "__main__":
    comfy_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8188"
    if "COMFYUI_URL" in os.environ:
        comfy_url = os.environ["COMFYUI_URL"]

    only_ids: set[str] | None = None
    if len(sys.argv) > 2:
        only_ids = {part.strip().lower() for part in sys.argv[2].split(",") if part.strip()}

    try:
        urllib.request.urlopen(f"{comfy_url.rstrip('/')}/system_stats", timeout=5)
    except OSError as exc:
        print(f"ComfyUI not reachable at {comfy_url}: {exc}", file=sys.stderr)
        sys.exit(1)

    base_wf = load_workflow()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    steps = 9

    jobs = SOLOIST_JOBS
    if only_ids:
        jobs = [item for item in SOLOIST_JOBS if item[0] in only_ids]

    for soloist_id, positive in jobs:
        seed = random.randint(1, 2**31 - 1)
        prefix = f"music_evolution_soloist_{soloist_id}"
        print(f"Queue {soloist_id} seed={seed} steps={steps} …", flush=True)
        pid = submit_prompt(
            base_wf,
            comfy_url=comfy_url,
            positive=positive,
            seed=seed,
            prefix=prefix,
            steps=steps,
        )
        imgs = wait_for_images(comfy_url, pid)
        img_meta = imgs[0]
        png_bytes = download_image(img_meta, comfy_url)
        tmp_png = OUT_DIR / f".tmp_{soloist_id}.png"
        tmp_png.write_bytes(png_bytes)
        out_webp = OUT_DIR / f"{soloist_id}.webp"
        png_to_webp(tmp_png, out_webp)
        tmp_png.unlink(missing_ok=True)
        print(f"  -> {out_webp} ({out_webp.stat().st_size} bytes)", flush=True)

    print("Done.", flush=True)
