#!/usr/bin/env python3
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sequential Comfy smoke for product music builders (v4 SFT, v5 BIG_XL, DiffRhythm)
# using the same studio_comfy_workflows path as the API.
# Invariants:
# - One prompt at a time (avoid GPU thrash/OOM).
# - Fail closed on execution_error or timeout.
# - Default payload: full Russian song (~3 min) — not toy snippets.
# Related:
# - shared/api/services/studio_comfy_workflows.py
# - docker/scripts/music-forge-stack0-smoke.sh
# ---
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

from api.services.studio_comfy_workflows import (
    build_ace_music_v4_luna_sft_workflow,
    build_ace_music_v4_sft_workflow,
    build_ace_music_v5_big_xl_sft_workflow,
    build_diffrhythm_music_workflow,
)

# Full-length Russian smoke song (~3 min product lane).
SMOKE_LYRICS_RU = """[Intro]
(Arrangement: мягкие синт-пэды, приглушённые барабаны, 118 BPM feel)
(Voice: тёплый женский вокал, интимная подача)

[Verse 1]
Город засыпает за окном давно,
На стекле дрожат огни в тишине.
Я помню твой смех, как старый джаз давно,
И как мы плыли сквозь ночную волну.

[Pre-Chorus]
Сердце стучит в такт с далёким поездом,
В груди живёт мелодия без слов.
Если вернёшься — встречу у окна,
Где свет луны рисует наши сны.

[Chorus]
Это не конец, а только переправа,
Между «было» и «ещё впереди».
Пусть этот вечер станет нам отрава
От всех обид, что мы таили в груди.

[Verse 2]
Кофе остыл, а пластинка всё крутится,
Jazz-funk groove в полутьме квартиры.
Ты где-то там, где рассвет не торопится,
А я учусь снова дышать без меры.

[Bridge]
(Arrangement: барабаны отступают, эхо вокала, минимализм)
Если надо — отпущу без крика,
Только музыку оставлю при себе.
Пусть в каждой ноте будет наша лирика,
Что не исчезнет в этой темноте.

[Chorus]
Это не конец, а только переправа,
Между «было» и «ещё впереди».
Пусть этот вечер станет нам отрава
От всех обид, что мы таили в груди.

[Outro]
(Arrangement: затухающие пэды, мягкий reverb)
Свет уходит... мелодия стихает...
Тихий вдох. До утра."""

SMOKE_TAGS_RU = (
    "Style: Russian contemporary pop-soul. 118 BPM, female vocal, A minor, warm Rhodes piano, "
    "soft funk bass, brushed drums feel, intimate lead, [Intro] atmospheric pads, "
    "[Verse] groovy bass and muted guitar, [Pre-Chorus] building strings, "
    "[Chorus] full band layered harmonies, [Bridge] breakdown sparse, "
    "[Chorus] return with energy, [Outro] fade with reverb trails"
)

SMOKE_DURATION_SECONDS = 180


def post_prompt(comfy: str, name: str, wf: dict) -> str:
    payload = {"prompt": wf, "client_id": f"ops-smoke-{name}"}
    req = urllib.request.Request(
        f"{comfy.rstrip('/')}/prompt",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        print(name, "POST_FAIL", e.code, e.read()[:1200], flush=True)
        raise
    pid = out.get("prompt_id")
    print(name, "queued", pid, "nodes", len(wf), flush=True)
    return str(pid)


def wait_done(comfy: str, pid: str, timeout: int) -> bool:
    base = comfy.rstrip("/")
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{base}/history/{pid}", timeout=30) as r:
            hist = json.load(r)
        if pid in hist:
            status = hist[pid].get("status") or {}
            outs = hist[pid].get("outputs") or {}
            msgs = status.get("messages") or []
            fail = any(
                isinstance(m, (list, tuple)) and m and m[0] == "execution_error"
                for m in msgs
            )
            print(
                "  done",
                status.get("status_str"),
                "outs",
                list(outs.keys())[:8],
                "fail",
                fail,
                flush=True,
            )
            if fail:
                for m in msgs:
                    if isinstance(m, (list, tuple)) and m and m[0] == "execution_error":
                        print("  ERR", m[1] if len(m) > 1 else m, flush=True)
            return (not fail) and bool(outs or status.get("completed"))
        with urllib.request.urlopen(f"{base}/queue", timeout=10) as r:
            q = json.load(r)
        print(
            f"  wait {int(time.time() - t0)}s "
            f"running={len(q.get('queue_running') or [])} "
            f"pending={len(q.get('queue_pending') or [])}",
            flush=True,
        )
        time.sleep(15)
    print("  TIMEOUT", pid, flush=True)
    return False


def _ace_smoke_base() -> dict:
    return {
        "lyrics": SMOKE_LYRICS_RU,
        "tags": SMOKE_TAGS_RU,
        "duration": SMOKE_DURATION_SECONDS,
        "duration_seconds": SMOKE_DURATION_SECONDS,
        "bpm": 118,
        "keyscale": "A minor",
        "language": "ru",
        "vocal_language": "ru",
        "vocal": "female",
        "timesignature": "4",
        "temperature": 0.85,
        "cfg_scale": 2.1,
        "top_p": 0.91,
        "seed": 20260901,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--comfy-url",
        default="http://127.0.0.1:31003",
        help="ComfyUI base URL (prod API uses http://192.168.1.136:31003)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=5400,
        help="Per-job timeout seconds (full 3-min SFT/v5 needs headroom)",
    )
    parser.add_argument(
        "--only",
        choices=("v4_sft", "v4_luna", "v5_big", "diffrhythm", "sft_all", "all"),
        default="sft_all",
        help="sft_all = v4 + luna + v5 full Russian song; all includes diffrhythm",
    )
    args = parser.parse_args()

    base = _ace_smoke_base()
    luna = {
        **base,
        "v4_soloist": "luna",
        "keyscale": "G minor",
        "bpm": 134,
        "tags": (
            "Style: Russian psychedelic melancholy pop. 134 BPM, female vocal, G minor, "
            "lo-fi tape haze, detuned synth swirl, trip-hop pulse, breathy half-whisper lead, "
            "[Intro] vapor pads, [Verse] dusty drums and sub, [Chorus] wide chorus wash, "
            "[Bridge] sparse echo, [Outro] tape fade"
        ),
    }
    diff = {
        "lyrics": SMOKE_LYRICS_RU,
        "tags": "Russian pop-soul, female vocal, 118 BPM",
        "duration": 60,
        "bpm": 118,
        "style": "pop",
        "seed": 20260901,
    }
    jobs = [
        ("v4_sft", build_ace_music_v4_sft_workflow, base),
        ("v4_luna", build_ace_music_v4_luna_sft_workflow, luna),
        ("v5_big", build_ace_music_v5_big_xl_sft_workflow, base),
        ("diffrhythm", build_diffrhythm_music_workflow, diff),
    ]
    if args.only == "sft_all":
        jobs = [j for j in jobs if j[0] in ("v4_sft", "v4_luna", "v5_big")]
    elif args.only != "all":
        jobs = [j for j in jobs if j[0] == args.only]

    results: dict[str, bool] = {}
    for name, builder, data in jobs:
        wf, out_node = builder(dict(data))
        gen = next(
            (n for n in wf.values() if isinstance(n, dict) and n.get("class_type") == "AceStepSFTGenerate"),
            None,
        )
        if gen:
            gi = gen.get("inputs") or {}
            print(
                "built",
                name,
                "out",
                out_node,
                "dur",
                gi.get("duration"),
                "steps",
                gi.get("steps"),
                "shift",
                gi.get("shift"),
                "sampler",
                gi.get("sampler_name"),
                flush=True,
            )
        else:
            print("built", name, "out", out_node, "nodes", len(wf), flush=True)
        pid = post_prompt(args.comfy_url, name, wf)
        ok = wait_done(args.comfy_url, pid, args.timeout)
        results[name] = ok
        print("RESULT", name, "OK" if ok else "FAIL", flush=True)

    print("SUMMARY", results, flush=True)
    return 0 if results and all(results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
