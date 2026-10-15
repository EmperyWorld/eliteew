#!/usr/bin/env python3
"""
Queue ComfyUI workflow 01_top.json per Desktop AI hero, download PNG, convert to WebP.

Requires reachable ComfyUI HTTP API (default from env COMFYUI_URL).

Usage:
  COMFYUI_URL=http://192.168.1.136:31003 python3 generate_desktop_hero_avatars.py
  COMFYUI_URL=http://127.0.0.1:31003 python3 generate_desktop_hero_avatars.py --only it_kernel,it_schema
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKFLOW_PATH = ROOT / "01_top.json"
OUT_DIR = (ROOT.parent.parent / "shared" / "web" / "frontend" / "public" / "avatars").resolve()

# Shared: user-facing avatars should read as European/Western European professionals (not a specific country).
_EURO = "European appearance, Western European facial features, natural fair to light skin tone, "

# Base style aligned with workflow; hero lines reflect dossier / systemPrompt roles.
HERO_JOBS: list[tuple[str, str]] = [
    (
        "likiy_sorrento",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional corporate headshot, single person only, centered bust portrait, "
            + _EURO
            + "distinguished male executive strategist late 40s, steel-grey eyes, short neat dark hair with silver temples, "
            "charcoal tailored suit white shirt, cold composed analytical expression, "
            "soft neutral grey studio backdrop, subtle rim light, photorealistic skin texture, 8k detail, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "arlyqueen",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot, single woman mid-30s marketing strategist, " + _EURO + "confident warm gaze, "
            "sleek auburn hair in shoulder-length cut, ivory blazer over black top, minimal elegant jewelry, "
            "soft warm beige background, modern commercial photography, photorealistic, 8k, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "akimbo",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "corporate portrait single man early 40s behavioral specialist, " + _EURO + "short trimmed beard, "
            "warm brown eyes, navy sweater over light oxford shirt, open trustworthy posture, "
            "muted teal studio background, soft diffused key light, approachable pragmatic energy, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "arlekino_pravoz",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "stern male lawyer-pragmatist early 50s, "
            + _EURO
            + "sharp jaw, conservative charcoal suit thin black tie, "
            "penetrating calm eyes, subtle dry confidence, dark wood tone bokeh background, "
            "dramatic soft key light, legal gravitas, photorealistic 8k, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "max_safin",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "male product lead early 30s, " + _EURO + "thin metal glasses, black tee under unstructured grey blazer, "
            "focused pragmatic expression slight tired smile, soft office window bokeh background, "
            "startup PM energy, crisp natural light, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "suno_songwriter",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional woman operations lead mid-30s, " + _EURO + "neat blonde low bun, crisp white blouse, "
            "small gold earrings, calm precise neutral expression, light cool grey seamless background, "
            "efficient European corporate operations vibe, soft even studio light, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "dr_vereskov",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "male finance analyst mid-40s, " + _EURO + "round glasses, dark suit burgundy tie, "
            "slight stubble, calculating attentive eyes, cold blue-grey backdrop, "
            "tight disciplined framing, spreadsheet discipline mood, 8k editorial, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "viktor_engineer",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "male software architect early 40s, " + _EURO + "short dark hair with subtle grey streak, "
            "black crew neck under charcoal blazer, calm confident half-smile, "
            "gradient steel to charcoal background, minimalist tech vibe, sharp focus, engineering composure, 8k, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "nikolay_fyodorovich",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional portrait, single man late 50s visionary inventor archetype, "
            + _EURO
            + "intense silver-streaked dark hair, deep thoughtful eyes, modest worn suit, "
            "subtle laboratory inventor energy, soft charcoal studio backdrop, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "albert_emilevich",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "compassionate male doctor-humanitarian early 60s, "
            + _EURO
            + "kind weary eyes, simple white coat over shirt, gentle dignified expression, "
            "warm muted green-grey backdrop, humanitarian service mood, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "yanus_arnievich",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "young male software engineer early 30s Nordic-European look, "
            + _EURO
            + "casual grey hoodie, pragmatic half-smile, home office programmer energy, "
            "soft cool blue backdrop, open-source craft mood, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "yan_genrihovich",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "elderly male educator early 70s, "
            + _EURO
            + "warm firm eyes, tweed jacket, gentle pedagogical dignity, "
            "soft amber studio backdrop, protector of children archetype, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "richard_joshuevich",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "male digital freedom advocate mid 50s, "
            + _EURO
            + "long beard and hair, intense ethical gaze, simple plain shirt, "
            "minimal dark backdrop, principled engineer-reformer mood, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "teresa_agnesovna",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "elderly woman late 60s humble caregiver archetype, "
            + _EURO
            + "modest white headscarf, deeply compassionate face, simple light sari-inspired wrap, "
            "soft warm neutral backdrop, quiet service mood, photorealistic 8k, "
            "no text, no watermark, no logo, not a celebrity likeness"
        ),
    ),
    (
        "it_kernel",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional corporate headshot, single man late 30s systems architect tech lead, "
            + _EURO
            + "closely cropped silver-frosted hair, thin rectangular titanium glasses, deep burgundy merino turtleneck under slate blazer, "
            "cool indigo gradient studio backdrop, calm systems-thinking presence, distinct from generic developer headshots, photorealistic 8k, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "it_schema",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot single woman early 30s backend API engineer, "
            + _EURO
            + "auburn hair in low tight bun, matte forest-green cardigan, sharp attentive hazel eyes, "
            "soft sage seamless background, contract-first backend engineer energy, distinct wardrobe, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "it_canvas",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot single woman late 20s frontend UI engineer, "
            + _EURO
            + "asymmetric dark bob with subtle copper highlights, mustard-yellow linen blazer over white tee, bright curious eyes, "
            "warm sand studio backdrop, design-system craft energy without gimmicks, visually distinct from backend portraits, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "it_pipeliner",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot single man mid-30s devops platform engineer, "
            + _EURO
            + "short curly dark hair, trimmed beard, burnt-orange utility shirt with rolled sleeves, steady confident half-smile, "
            "concrete-grey industrial backdrop with soft green rim light, release-pipeline reliability vibe, distinct from office headshots, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "it_sentinel",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot single woman mid-30s application security engineer, "
            + _EURO
            + "platinum blonde undercut, structured black leather jacket over grey mock neck, piercing calm grey-blue eyes, "
            "deep midnight charcoal backdrop with subtle red edge light, AppSec seriousness without theatrics, distinct silhouette, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
    ),
    (
        "it_relay",
        (
            "high quality editorial photograph, sharp focus, clean composition, "
            "professional headshot single man early 40s SRE on-call lead, "
            + _EURO
            + "wavy salt-and-pepper hair, light stubble, navy henley under unzipped grey fleece, calm incident-ready eyes, "
            "stormy blue-grey backdrop with soft practical key light, on-call reliability engineering presence, distinct from corporate portraits, 8k photorealistic, "
            "no text, no watermark, no logo"
        ),
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


def wait_for_images(comfy_url: str, prompt_id: str, timeout_s: float = 180.0) -> list[dict]:
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


def png_to_webp(png_path: Path, webp_path: Path, quality: int = 92) -> None:
    try:
        subprocess.run(
            [
                "magick",
                str(png_path),
                "-quality",
                str(quality),
                "-define",
                "webp:method=6",
                str(webp_path),
            ],
            check=True,
            capture_output=True,
        )
        return
    except FileNotFoundError:
        pass
    from PIL import Image

    with Image.open(png_path) as im:
        im = im.convert("RGB")
        im.save(webp_path, format="WEBP", quality=quality, method=6)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a]
    only: set[str] | None = None
    url_arg: str | None = None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--only" and i + 1 < len(args):
            only = {x.strip() for x in args[i + 1].split(",") if x.strip()}
            i += 2
            continue
        if a.startswith("--only="):
            only = {x.strip() for x in a.split("=", 1)[1].split(",") if x.strip()}
            i += 1
            continue
        if not a.startswith("-") and url_arg is None:
            url_arg = a
        i += 1

    COMFYUI_URL = url_arg or "http://127.0.0.1:8188"
    if "COMFYUI_URL" in os.environ:
        COMFYUI_URL = os.environ["COMFYUI_URL"]

    # Health check
    try:
        urllib.request.urlopen(f"{COMFYUI_URL.rstrip('/')}/system_stats", timeout=5)
    except OSError as e:
        print(f"ComfyUI not reachable at {COMFYUI_URL}: {e}", file=sys.stderr)
        sys.exit(1)

    base_wf = load_workflow()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STEPS = 9

    jobs = [(hid, pos) for hid, pos in HERO_JOBS if only is None or hid in only]
    if only is not None and not jobs:
        print(f"No HERO_JOBS matched --only={sorted(only)}", file=sys.stderr)
        sys.exit(2)

    for hero_id, positive in jobs:
        seed = random.randint(1, 2**31 - 1)
        prefix = f"desktop_ai_hero_{hero_id}"
        print(f"Queue {hero_id} seed={seed} steps={STEPS} …", flush=True)
        pid = submit_prompt(
            base_wf,
            comfy_url=COMFYUI_URL,
            positive=positive,
            seed=seed,
            prefix=prefix,
            steps=STEPS,
        )
        imgs = wait_for_images(COMFYUI_URL, pid)
        img_meta = imgs[0]
        png_bytes = download_image(img_meta, COMFYUI_URL)
        tmp_png = OUT_DIR / f".tmp_{hero_id}.png"
        tmp_png.write_bytes(png_bytes)
        out_webp = OUT_DIR / f"{hero_id}.webp"
        png_to_webp(tmp_png, out_webp)
        print(f"  -> {out_webp} ({out_webp.stat().st_size} bytes)", flush=True)
        # leave .tmp_*.png for operator trash-move (no silent delete)

    print("Done.", flush=True)
