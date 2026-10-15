# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Phase 5 quality loop для XL Base: сравнение Comfy debug JSON до/после pipeline;
#   подготовка batch UGS input через тот же lyrics/tags контур, что и /generate.
# Invariants:
#   - extract/compare не мутируют входные dict; workflow ищется в history prompt[2] или top-level nodes.
#   - apply_xl_base_pipeline_to_batch_ugs_input при strict=True пробрасывает ValueError skeleton lyrics.
# Related:
#   - api/services/music_generator_xl_base_pipeline.py
#   - api/services/music_batch_tests.py
#   - documentation/product/MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md
# ---

from __future__ import annotations

import re
from typing import Any

from api.services.music_generator_xl_base_pipeline import (
    build_xl_base_input_observability,
    count_sung_content_lines,
    extract_comfy_seed_from_workflow,
    prepare_xl_base_lyrics_for_comfy,
    prepare_xl_base_tags_for_comfy,
    stamp_xl_base_observability_on_input_data,
)

ACE_TEXT_ENCODE_NODE_ID = "94"
KSAMPLER_NODE_ID = "3"


def extract_workflow_from_comfy_debug(data: dict[str, Any]) -> dict[str, Any] | None:
    """
    Достаёт workflow dict из сохранённого Comfy debug/history JSON.
    Поддерживает обёртку eliteew (comfy_history) и плоский workflow с node 94.
    """
    if not isinstance(data, dict):
        return None
    comfy_history = data.get("comfy_history")
    if isinstance(comfy_history, dict) and comfy_history:
        first = next(iter(comfy_history.values()))
        if isinstance(first, dict):
            prompt = first.get("prompt")
            if isinstance(prompt, list) and len(prompt) >= 3 and isinstance(prompt[2], dict):
                return prompt[2]
            if isinstance(prompt, dict):
                return prompt
    if isinstance(data.get(ACE_TEXT_ENCODE_NODE_ID), dict):
        return data
    prompt = data.get("prompt")
    if isinstance(prompt, list) and len(prompt) >= 3 and isinstance(prompt[2], dict):
        return prompt[2]
    return None


def _ace_node_inputs(workflow: dict[str, Any]) -> dict[str, Any]:
    node = workflow.get(ACE_TEXT_ENCODE_NODE_ID)
    if not isinstance(node, dict):
        return {}
    inputs = node.get("inputs")
    return inputs if isinstance(inputs, dict) else {}


def extract_comfy_prompt_summary(data: dict[str, Any]) -> dict[str, Any]:
    """
    Краткий снимок XL Base prompt для сравнения before/after pipeline.
    """
    workflow = extract_workflow_from_comfy_debug(data)
    if not workflow:
        return {"found": False, "reason": "workflow_not_found"}

    ace = _ace_node_inputs(workflow)
    lyrics = str(ace.get("lyrics") or "")
    tags = str(ace.get("tags") or "")
    language = str(ace.get("language") or "ru").strip() or "ru"
    sung, cyr = count_sung_content_lines(lyrics, language=language)
    seed = extract_comfy_seed_from_workflow(workflow)
    ksampler = workflow.get(KSAMPLER_NODE_ID)
    ks_inputs = ksampler.get("inputs") if isinstance(ksampler, dict) else {}
    if not isinstance(ks_inputs, dict):
        ks_inputs = {}

    bpm_raw = ace.get("bpm")
    bpm = int(bpm_raw) if isinstance(bpm_raw, (int, float)) else None
    tags_sections = len(re.findall(r"\[[^\]]+\]", tags))

    meta_raw = data.get("eliteew_meta")
    meta: dict[str, Any] = meta_raw if isinstance(meta_raw, dict) else {}
    seed_meta = meta.get("seed_applied")

    return {
        "found": True,
        "seed_applied": seed if seed is not None else seed_meta,
        "lyrics_len": len(lyrics),
        "tags_len": len(tags),
        "tags_section_count": tags_sections,
        "sung_lines": sung,
        "cyrillic_sung_lines": cyr,
        "bpm": bpm,
        "language": language,
        "keyscale": ace.get("keyscale"),
        "ksampler_cfg": ks_inputs.get("cfg"),
        "ksampler_steps": ks_inputs.get("steps"),
        "ksampler_sampler": ks_inputs.get("sampler_name"),
        "ksampler_scheduler": ks_inputs.get("scheduler"),
        "lyrics_preview": lyrics[:240].replace("\n", "\\n"),
        "tags_preview": tags[:240].replace("\n", "\\n"),
    }


def compare_comfy_debug_prompts(
    before: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    """
    Сравнивает два Comfy debug JSON; возвращает before/after summaries и numeric deltas.
    """
    b = extract_comfy_prompt_summary(before)
    a = extract_comfy_prompt_summary(after)
    deltas: dict[str, Any] = {}
    for key in (
        "lyrics_len",
        "tags_len",
        "tags_section_count",
        "sung_lines",
        "cyrillic_sung_lines",
        "bpm",
        "ksampler_cfg",
        "ksampler_steps",
    ):
        bv, av = b.get(key), a.get(key)
        if isinstance(bv, (int, float)) and isinstance(av, (int, float)):
            deltas[key] = av - bv
        elif bv != av:
            deltas[key] = {"before": bv, "after": av}
    seed_changed = b.get("seed_applied") != a.get("seed_applied")
    return {
        "before": b,
        "after": a,
        "deltas": deltas,
        "seed_changed": seed_changed,
        "pipeline_improved_sung_lines": (
            b.get("found")
            and a.get("found")
            and isinstance(b.get("sung_lines"), int)
            and isinstance(a.get("sung_lines"), int)
            and a["sung_lines"] > b["sung_lines"]
        ),
    }


def apply_xl_base_pipeline_to_batch_ugs_input(
    ugs_input_data: dict[str, Any],
    *,
    strict_lyrics: bool = True,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Применяет XL Base lyrics/tags pipeline к batch UGS payload (копия dict).
    Возвращает (updated_input, observability dict).
    """
    out = dict(ugs_input_data or {})
    language = str(out.get("language") or "ru").strip() or "ru"
    style_key = str(out.get("style") or "pop").strip().lower() or "pop"
    bpm_hint = out.get("bpm")
    bpm_int = int(bpm_hint) if isinstance(bpm_hint, (int, float)) else None

    lyrics = prepare_xl_base_lyrics_for_comfy(
        str(out.get("lyrics") or ""),
        language=language,
        strict=strict_lyrics,
    )
    tags = prepare_xl_base_tags_for_comfy(
        str(out.get("tags") or ""),
        style_key=style_key,
        bpm_hint=bpm_int,
        ace_workflow="v2_base",
    )
    out["lyrics"] = lyrics
    out["tags"] = tags
    obs = build_xl_base_input_observability(lyrics, tags, language=language)
    stamp_xl_base_observability_on_input_data(out, obs)
    return out, obs
