# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge LLM prompt builders and blueprint parsing for song planning stages.
# Invariants:
# - Liked-recipe hints never override explicit user style_hint or constraints.
# - Blueprint JSON must include full song sections with Title Case ACE markers.
# Related:
# - api/services/music_forge/algorithm/constants.py
# - api/services/music_forge/algorithm/lyrics_craft.py
# - api/services/music_forge/algorithm/style.py
# ---

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from api.services.music_forge.algorithm.constants import (
    _ELECTRONIC_INTENT_MARKERS,
    _FULL_SONG_SECTIONS,
)
from api.services.music_forge.algorithm.lyrics_craft import (
    LYRICS_CRAFT_RULES,
    LYRICS_CRAFT_SYSTEM_ADDON,
    craft_examples_for_language,
    dislike_lyrics_hints,
)
from api.services.music_forge.algorithm.style import infer_music_forge_style_key
from api.utils.llm_json_extract import extract_llm_json_payload

if TYPE_CHECKING:
    from api.services.music_forge.config import MusicForgeConfigBundle


def _prompt_template(config: MusicForgeConfigBundle | None, kind: str) -> dict[str, Any]:
    if config is None:
        return {}
    template = config.prompts.get(kind)
    return template if isinstance(template, dict) else {}


def _intent_style_probe(intent: dict[str, Any]) -> str:
    return " ".join(
        [
            str(intent.get("idea") or ""),
            str(intent.get("style_hint") or ""),
            str(intent.get("constraints") or ""),
        ]
    ).lower()


def _intent_wants_electronic(intent: dict[str, Any]) -> bool:
    probe = _intent_style_probe(intent)
    return any(marker in probe for marker in _ELECTRONIC_INTENT_MARKERS)


def corpus_hints_for_prompt(
    corpus: dict[str, Any] | None,
    *,
    intent: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compact liked-recipe hints for blueprint/style LLM prompts (no verbatim lyrics)."""
    if not corpus:
        return {}
    summary = corpus.get("quality_summary")
    if not isinstance(summary, dict):
        summary = {}
    hints: list[dict[str, Any]] = []
    for item in (corpus.get("items") or [])[:4]:
        if not isinstance(item, dict) or int(item.get("quality_signal") or 0) <= 0:
            continue
        hints.append(
            {
                "style": item.get("style"),
                "vocal": item.get("vocal"),
                "bpm": item.get("bpm"),
                "sung_line_count": item.get("sung_line_count"),
                "primary_style": item.get("primary_style"),
                "hook_idea": item.get("hook_idea"),
                "avoid": item.get("avoid"),
                "positive_tags": item.get("positive_tags"),
                "model_scope": item.get("model_scope"),
            }
        )
    if intent and _intent_wants_electronic(intent):
        hints = [
            hint
            for hint in hints
            if not (
                "pop" in str(hint.get("primary_style") or hint.get("style") or "").lower()
                and int(hint.get("bpm") or 120) < 130
            )
        ]
    dislike_src = corpus.get("dislike_hints")
    dislike_raw: list[Any] = dislike_src if isinstance(dislike_src, list) else []
    dislike_hints: list[dict[str, str]] = []
    for item in dislike_raw[:6]:
        if not isinstance(item, dict):
            continue
        code = str(item.get("reason_code") or "").strip()
        if not code:
            continue
        dislike_hints.append(
            {
                "reason_code": code,
                "reason_custom": str(item.get("reason_custom") or "").strip()[:160],
            }
        )
    return {
        "selected_count": corpus.get("selected_count"),
        "quality_summary": summary,
        "liked_hints": hints,
        "dislike_hints": dislike_hints,
        "prioritize_user_style": bool(intent and _intent_wants_electronic(intent)),
    }


def fallback_song_blueprint(intent: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback blueprint used when model JSON is incomplete."""
    idea = str(intent.get("idea") or "").strip()
    style_hint = str(intent.get("style_hint") or "").strip()
    language = str(intent.get("language") or "ru")
    if language == "en":
        hook = idea[:80] or "new light"
        arc = [
            "concrete scene from the idea",
            "personal turn without abstract filler",
            "memorable hook repeated with variation",
        ]
        scene_beats = [
            "one specific place from the idea",
            "one object or gesture the singer notices",
            "one spoken line or choice that changes the night",
        ]
    else:
        hook = idea[:80] or "новый свет"
        arc = [
            "конкретная сцена из идеи",
            "личный поворот без общей воды",
            "запоминающийся хук с вариацией",
        ]
        scene_beats = [
            "конкретное место из идеи",
            "предмет или жест, который замечает герой",
            "реплика или выбор, который меняет вечер",
        ]
    return {
        "title": idea[:64] or ("MusicForge song" if language == "en" else "Песня MusicForge"),
        "hook": hook,
        "language": language,
        "narrative_arc": arc,
        "scene_beats": scene_beats,
        "sections": list(_FULL_SONG_SECTIONS),
        "vocal_identity": "natural lead vocal, close and human",
        "arrangement": style_hint or "modern emotional pop with clean drums and warm synth texture",
        "avoid": [
            "generic inspirational filler",
            "JSON or markdown in sung lyrics",
            "model names, sampler names, workflow jargon",
            "sung words ритм/пульс/бит/такт describing the groove",
        ],
    }


def build_blueprint_messages(
    intent: dict[str, Any],
    *,
    corpus: dict[str, Any] | None = None,
    config: MusicForgeConfigBundle | None = None,
) -> list[dict[str, str]]:
    """Ask the LLM for a compact JSON song blueprint."""
    fallback = fallback_song_blueprint(intent)
    liked_hints = corpus_hints_for_prompt(corpus, intent=intent)
    template = _prompt_template(config, "blueprint")
    system_prompt = template.get("system_prompt") or (
        "You are MusicForge, a backend song architect. Return only valid JSON. "
        "Design one full-length memorable song plan for AceStep SFT vocal production. No markdown."
    )
    rules_src = template.get("rules")
    rules: list[Any] = (
        rules_src
        if isinstance(rules_src, list)
        else [
            "When liked_recipe_hints conflict with user_intent style_hint or constraints, follow user_intent first.",
            "Use liked hints for vocal clarity and hook structure, not to override explicit genre/tempo requests.",
            "Respect dislike_hints reason codes as soft avoid list (vocal, mix, tempo, lyrics) without copying jargon into sung text.",
        ]
    )
    return [
        {
            "role": "system",
            "content": str(system_prompt),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "contract": {
                        "title": "short song title",
                        "hook": "exact hook phrase to repeat in chorus",
                        "language": intent["language"],
                        "narrative_arc": ["scene", "turn", "payoff"],
                        "scene_beats": [
                            "concrete place or object from the idea",
                            "body gesture or weather detail",
                            "spoken line or choice",
                        ],
                        "sections": list(_FULL_SONG_SECTIONS),
                        "vocal_identity": "voice and performance direction",
                        "arrangement": "genre and texture without raw model names",
                        "avoid": ["cliches", "forbidden content"],
                    },
                    "user_intent": intent,
                    "liked_recipe_hints": liked_hints,
                    "fallback_shape": fallback,
                    "rules": rules,
                },
                ensure_ascii=False,
            ),
        },
    ]


def parse_song_blueprint(raw_text: str, intent: dict[str, Any]) -> dict[str, Any]:
    """Parse and normalize a model blueprint JSON object."""
    fallback = fallback_song_blueprint(intent)
    try:
        parsed = extract_llm_json_payload(raw_text)
    except ValueError:
        parsed = {}
    data = parsed if isinstance(parsed, dict) else {}
    out = dict(fallback)
    for key in ("title", "hook", "language", "vocal_identity", "arrangement"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = " ".join(value.strip().split())
    for key in ("narrative_arc", "sections", "avoid", "scene_beats"):
        value = data.get(key)
        if isinstance(value, list):
            items = [" ".join(str(item).strip().split()) for item in value if str(item).strip()]
            if items:
                out[key] = items[:8]
    out["language"] = "en" if str(out.get("language")).lower().startswith("en") else str(intent.get("language") or "ru")
    if "Chorus" not in {str(item).title() for item in out.get("sections", [])}:
        out["sections"] = list(_FULL_SONG_SECTIONS)
    return out


def build_lyrics_messages(
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    *,
    config: MusicForgeConfigBundle | None = None,
    corpus: dict[str, Any] | None = None,
    rewrite_notes: list[str] | None = None,
) -> list[dict[str, str]]:
    """Build lyrics prompt from the backend blueprint."""
    language = str(intent.get("language") or "ru")
    language_note = "Russian" if language == "ru" else "English"
    examples = craft_examples_for_language(language)
    template = _prompt_template(config, "lyrics")
    system_template = template.get("system_prompt") or (
        "Write only sung lyrics in {language_note}. Use ACE section markers: "
        "[Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Chorus 2], [Outro]. "
        "No JSON, no markdown fences, no explanations. "
        "Write a full song: short singable lines, clear stress, audible rhyme or near-rhyme in chorus. "
        "Every sung line must contain real words — no standalone ooh/aah/mm adlibs."
    )
    system_prompt = str(system_template).format(language_note=language_note)
    craft_addon = (
        f"{LYRICS_CRAFT_SYSTEM_ADDON} "
        f"Match craft_examples.good_sung: one camera shot per line. "
        f"Never imitate craft_examples.bad_sung."
    )
    if craft_addon not in system_prompt:
        system_prompt = f"{system_prompt}\n{craft_addon}"
    rules_src = template.get("rules")
    template_rules: list[Any] = rules_src if isinstance(rules_src, list) else []
    rules = [
        *([str(item) for item in template_rules if str(item).strip()]),
        *LYRICS_CRAFT_RULES,
    ]
    notes = [str(item) for item in (rewrite_notes or []) if str(item).strip()]
    dislike_hints = dislike_lyrics_hints(corpus)
    payload: dict[str, Any] = {
        "user_idea": intent["idea"],
        "style_hint": intent.get("style_hint") or "",
        "style_hint_role": "arrangement_only_not_sung_vocabulary",
        "constraints": intent.get("constraints") or "",
        "blueprint": blueprint,
        "scene_beats": blueprint.get("scene_beats") or [],
        "required_sections": list(_FULL_SONG_SECTIONS),
        "rules": rules,
        "forbidden_sung_tokens": ["ритм", "пульс", "бит", "такт", "rhythm", "pulse", "beat", "groove", "BPM"],
        "craft_examples": examples,
    }
    if dislike_hints:
        payload["dislike_lyrics_hints"] = dislike_hints
    if notes:
        payload["rewrite_notes"] = notes
    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=False),
        },
    ]


def build_style_messages(
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    lyrics: str,
    *,
    config: MusicForgeConfigBundle | None = None,
) -> list[dict[str, str]]:
    """Ask for a hierarchical AceStep caption (sparse section arc) from blueprint and lyrics."""
    style_key = infer_music_forge_style_key(intent, blueprint)
    template = _prompt_template(config, "style")
    system_prompt = template.get("system_prompt") or (
        "Return only one English AceStep style caption, no JSON and no markdown. "
        "Start with BPM, one vocal gender, and genre, then a full song arc with Title Case bracket sections: "
        "[Intro], [Verse], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus 2], [Chorus 2], "
        "[Bridge], [Chorus 3], [Outro]. Never use lowercase [intro]/[verse]. "
        "Hierarchy per section (≤2 short cues): (1) kick/tempo, (2) bass, (3) lead vocal, (4) optional one texture. "
        "Do NOT stack production jargon (sidechain, acid, granular, sub-bass, pluck, supersaw) in one section."
    )
    rules_src = template.get("rules")
    rules: list[Any] = (
        rules_src
        if isinstance(rules_src, list)
        else [
            "Do not mention ACE, ComfyUI, model, sampler, LoRA or workflow.",
            "Match resolved_style_key and style_hint with simple instruments — not a DAW mix recipe.",
            "Lead vocal must be forward, human, and syllable-clear; one gender only.",
            "Include an explicit BPM number early in the caption.",
            "Section markers must be Title Case to match lyrics headers ([Intro] not [intro]).",
            "Keep under 720 characters; prefer sparse hierarchy over dense production prose.",
            "Never combine sidechain + acid + granular + sub-bass in the same caption.",
        ]
    )
    return [
        {
            "role": "system",
            "content": str(system_prompt),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "intent": intent,
                    "blueprint": blueprint,
                    "resolved_style_key": style_key,
                    "lyrics_preview": lyrics[:1600],
                    "rules": rules,
                },
                ensure_ascii=False,
            ),
        },
    ]
