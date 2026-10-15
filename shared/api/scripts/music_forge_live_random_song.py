#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Live MusicForge run: random theme + random style_hint, real LLM + ACE/Comfy render (not a mock smoke).
# Invariants:
# - Requires MUSIC_FORGE_LIVE=1; never runs in CI by default.
# - Creates a durable music_forge_runs row and executes the pipeline in-process.
# Related:
# - api/services/music_forge/pipeline.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""Live random MusicForge song generator for operator quality checks."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
from pathlib import Path

# Allow `python scripts/music_forge_live_random_song.py` from shared/api or /app/api.
_API_ROOT = Path(__file__).resolve().parents[1]
_ELITEEW_ROOT = _API_ROOT.parent
if str(_ELITEEW_ROOT) not in sys.path:
    sys.path.insert(0, str(_ELITEEW_ROOT))

_RANDOM_THEMES_RU = (
    "Курага во дворе без пафоса",
    "Ночной автобус и мокрый асфальт",
    "Чай остыл, а разговор ещё нет",
    "Лифт застрял между этажами надежды",
    "Соседи слушают наш смех сквозь стену",
    "Первый снег на старом велосипеде",
    "Письмо, которое так и не отправили",
    "Рассвет над пустыми путями депо",
    "Ключи от квартиры, где уже никто не ждёт",
    "Город мигает неоном, а я считаю шаги",
)

_RANDOM_STYLES = (
    "modern emotional pop",
    "lofi chill night",
    "phonk drift",
    "fast drum and bass",
    "indie rock",
    "synthwave drive",
    "ballad piano",
    "hip hop melodic",
    "house club groove",
    "rock anthem",
)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Live MusicForge random song (real render)")
    p.add_argument(
        "--user-id",
        default=os.environ.get("MUSIC_FORGE_LIVE_USER_ID", "f1b654a6-56a7-4718-ae95-3c7534a3982e"),
        help="Catalog user UUID that owns the run",
    )
    p.add_argument(
        "--duration",
        type=int,
        default=220,
        help="Track duration seconds (60–240); default 220 for full SFT songs (TOP-like length)",
    )
    p.add_argument("--theme", default="", help="Fixed theme; empty = random")
    p.add_argument("--style", default="", help="Fixed style_hint; empty = random")
    p.add_argument("--seed", type=int, default=0, help="RNG seed; 0 = nondeterministic")
    return p.parse_args()


async def _run(args: argparse.Namespace) -> int:
    if os.environ.get("MUSIC_FORGE_LIVE", "").strip() != "1":
        print("Refusing: set MUSIC_FORGE_LIVE=1 for a real render.", file=sys.stderr)
        return 2

    if args.seed:
        random.seed(args.seed)
    idea = (args.theme or "").strip() or random.choice(_RANDOM_THEMES_RU)
    style_hint = (args.style or "").strip() or random.choice(_RANDOM_STYLES)
    duration = max(60, min(240, int(args.duration)))

    from api.core.database_manager import get_database_manager
    from api.routers.unified_content import get_content_service
    from api.schemas.music_forge import MusicForgeRunCreate
    from api.services.music_forge.algorithm import MUSIC_FORGE_VERSION
    from api.services.music_forge.pipeline import MusicForgePipelineService

    print(
        json.dumps(
            {
                "phase": "start",
                "music_forge_version": MUSIC_FORGE_VERSION,
                "user_id": args.user_id,
                "idea": idea,
                "style_hint": style_hint,
                "duration_seconds": duration,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )

    db_manager = await get_database_manager()
    async with db_manager.get_postgres_session() as db:
        content_service = await get_content_service()
        service = MusicForgePipelineService(db, content_service=content_service)
        try:
            created = await service.create_run(
                user_id=args.user_id,
                body=MusicForgeRunCreate(
                    idea=idea,
                    language="ru",
                    style_hint=style_hint,
                    constraints="Живой вокал, понятные слова, без бессмысленного воя.",
                    duration_seconds=duration,
                    idempotency_key=None,
                ),
            )
            print(
                json.dumps(
                    {
                        "phase": "created",
                        "run_id": str(created.run_id),
                        "status": created.status,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
            await service.execute_run(run_id=str(created.run_id), user_id=args.user_id)
            run = await service.fetch_run(run_id=str(created.run_id), user_id=args.user_id)
        finally:
            await service.ugs.close()

    lyrics = ""
    if isinstance(run.lyrics_payload, dict):
        lyrics = str(run.lyrics_payload.get("lyrics") or "")
    capsule = run.style_capsule if isinstance(run.style_capsule, dict) else {}
    result = run.result_payload if isinstance(run.result_payload, dict) else {}
    summary = {
        "phase": "done",
        "music_forge_version": MUSIC_FORGE_VERSION,
        "run_id": str(run.id),
        "status": run.status,
        "idea": run.idea,
        "style_hint": run.style_hint,
        "model_lane": (run.normalized_input or {}).get("model_lane"),
        "style_key": capsule.get("style_key"),
        "bpm": capsule.get("bpm"),
        "keyscale": capsule.get("keyscale"),
        "vocal": capsule.get("vocal"),
        "temperature": capsule.get("temperature"),
        "caption_preview": str(capsule.get("caption") or "")[:280],
        "lyrics_preview": lyrics[:500],
        "lyrics_chars": len(lyrics),
        "content_id": str(run.content_id) if run.content_id else None,
        "ugs_request_id": str(run.ugs_request_id) if run.ugs_request_id else None,
        "error": run.error_payload or None,
        "result_keys": sorted(result.keys()) if result else [],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    return 0 if run.status == "completed" else 1


def main() -> None:
    raise SystemExit(asyncio.run(_run(_parse_args())))


if __name__ == "__main__":
    main()
