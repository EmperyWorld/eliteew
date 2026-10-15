#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Batch-submit ComfyUI workflow `01_top.json` with per-post CLIP prompts for EWDesk hero images.
# Invariants:
#   - Short Russian theme in manifest is wrapped with Future IT style suffix (no text in frame).
# Related:
#   - ewdesk_batch_manifest*.json, publish_ewdesk_news_batch_direct.py
# ---
"""Batch-submit `01_top.json` to ComfyUI with per-post CLIP prompts for EWDesk heroes."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _find_nodes_by_class(workflow: dict, class_type: str) -> list[str]:
    out: list[str] = []
    for nid, node in workflow.items():
        if not isinstance(node, dict):
            continue
        if node.get("class_type") == class_type:
            out.append(str(nid))
    return out


def load_workflow(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_ewdesk_clip_prompt(theme: str) -> str:
    """Wrap a short Russian theme with Future IT visual style (no in-image text)."""
    t = theme.strip().rstrip(".")
    if not t:
        return (
            "Future IT, абстрактный неон, cyan и violet, 3D иллюстрация, мягкий свет"
        )
    return (
        f"Future IT, {t}, cyan и violet, 3D иллюстрация, мягкий свет, минимализм"
    )


def queue_prompt(comfy_base: str, workflow: dict[str, object]) -> str:
    url = comfy_base.rstrip("/") + "/prompt"
    payload = json.dumps({"prompt": workflow, "client_id": str(uuid.uuid4())}).encode()
    req = Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=300) as resp:
        out = json.loads(resp.read().decode())
    pid = out.get("prompt_id")
    if not pid:
        raise RuntimeError(f"Unexpected /prompt response: {out!r}")
    return str(pid)


def fetch_history(comfy_base: str, prompt_id: str) -> dict[str, object] | None:
    url = comfy_base.rstrip("/") + "/history/" + prompt_id
    try:
        with urlopen(url, timeout=120) as resp:
            raw = json.loads(resp.read().decode())
    except HTTPError as e:
        if e.code == 404:
            return None
        raise
    if not raw:
        return None
    if prompt_id in raw:
        entry = raw[prompt_id]
        return entry if isinstance(entry, dict) else None
    return raw if isinstance(raw, dict) else None


def wait_outputs(comfy_base: str, prompt_id: str, timeout_sec: float) -> dict[str, object]:
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        h = fetch_history(comfy_base, prompt_id)
        if h and h.get("outputs"):
            return h
        time.sleep(1.0)
    raise TimeoutError(f"prompt_id={prompt_id} no outputs after {timeout_sec:.0f}s")


def download_view(comfy_base: str, filename: str, subfolder: str, typ: str, dest: Path) -> None:
    q = urlencode({"filename": filename, "subfolder": subfolder, "type": typ})
    url = comfy_base.rstrip("/") + "/view?" + q
    with urlopen(url, timeout=300) as resp:
        dest.write_bytes(resp.read())


def first_save_image_outputs(history_outputs: dict[str, object]) -> tuple[str, list[dict[str, str]]]:
    for _nid, block in history_outputs.items():
        if not isinstance(block, dict):
            continue
        images = block.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict) and "filename" in first:
                return str(_nid), [dict(first)]
    raise RuntimeError(f"No SaveImage outputs in {history_outputs!r}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--comfy",
        default="http://192.168.1.141:31003",
        help="ComfyUI HTTP API base (LAN mapping; upstream image often uses :8188). Default: %(default)s",
    )
    ap.add_argument(
        "--workflow",
        type=Path,
        default=Path(__file__).resolve().parent / "01_top.json",
        help="Workflow JSON (default: 01_top.json nearby)",
    )
    ap.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).resolve().parent / "ewdesk_batch_manifest.json",
        help="Manifest with posts[].clip_prompt and posts[].id",
    )
    ap.add_argument("--out-dir", type=Path, default=Path("ewdesk_comfy_out"), help="Output images dir")
    ap.add_argument("--timeout", type=float, default=900.0, help="Per-image wait seconds")
    ap.add_argument("--dry-run", action="store_true", help="Print mutations only")
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    posts = manifest.get("posts")
    if not isinstance(posts, list):
        print("manifest.posts must be a list", file=sys.stderr)
        return 2

    wf_template = load_workflow(args.workflow)
    clip_ids = _find_nodes_by_class(wf_template, "CLIPTextEncode")
    sampler_ids = _find_nodes_by_class(wf_template, "KSampler")
    if not clip_ids:
        print("No CLIPTextEncode node in workflow", file=sys.stderr)
        return 2
    if not sampler_ids:
        print("No KSampler node in workflow", file=sys.stderr)
        return 2
    clip_node = clip_ids[0]
    sampler_node = sampler_ids[0]

    args.out_dir.mkdir(parents=True, exist_ok=True)

    for post in posts:
        if not isinstance(post, dict):
            continue
        pid_slug = str(post.get("id", "")).strip()
        clip_prompt = str(post.get("clip_prompt", "")).strip()
        if not pid_slug or not clip_prompt:
            print(f"skip entry without id/clip_prompt: {post!r}", file=sys.stderr)
            continue

        workflow = json.loads(json.dumps(wf_template))
        cn = workflow.get(clip_node)
        if not isinstance(cn, dict):
            print(f"missing node {clip_node}", file=sys.stderr)
            return 2
        inputs = cn.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            print(f"bad inputs for {clip_node}", file=sys.stderr)
            return 2
        inputs["text"] = build_ewdesk_clip_prompt(clip_prompt)

        sn = workflow.get(sampler_node)
        if isinstance(sn, dict) and isinstance(sn.get("inputs"), dict):
            sn["inputs"]["seed"] = random.randint(1, 2**48 - 1)

        meta_path = args.out_dir / f"{pid_slug}.meta.json"
        img_path = args.out_dir / f"{pid_slug}.png"
        side = {"id": pid_slug, "title": post.get("title"), "image_file": img_path.name}

        if args.dry_run:
            print("dry-run", pid_slug, clip_prompt[:80], "...")
            continue

        try:
            prompt_id = queue_prompt(args.comfy, workflow)
        except (URLError, HTTPError, TimeoutError, OSError) as e:
            print(f"queue failed {pid_slug}: {e}", file=sys.stderr)
            return 1

        try:
            hist = wait_outputs(args.comfy, prompt_id, args.timeout)
        except TimeoutError as e:
            print(f"{e}", file=sys.stderr)
            return 1

        outputs = hist.get("outputs")
        if not isinstance(outputs, dict):
            print(f"bad history outputs {hist!r}", file=sys.stderr)
            return 1
        _, imgs = first_save_image_outputs(outputs)
        info = imgs[0]
        download_view(
            args.comfy,
            str(info["filename"]),
            str(info.get("subfolder") or ""),
            str(info.get("type") or "output"),
            img_path,
        )
        meta_path.write_text(
            json.dumps(side, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("ok", pid_slug, img_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
