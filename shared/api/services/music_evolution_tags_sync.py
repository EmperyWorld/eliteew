# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Rebuild Evolution XL Base style tags so bracket sections mirror lyrics order and labels
# ([Verse 1], [Pre-Chorus], …) with per-section production hints.
# Invariants:
# - Style preamble (before first [Section]) is preserved from incoming tags.
# - Section hints reuse parsed tags when possible, else soloist arrangement profiles.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/services/studio_comfy_workflows.py
# - api/routers/music_lyrics_validation.py
# ---

from __future__ import annotations

import re

from api.routers.music_lyrics_validation import (
    _canonical_vocal_section_from_header,
    lyrics_section_labels_ordered_exact,
    parse_music_section_header,
)
from api.services.music_evolution_soloists import resolve_soloist_id
from api.services.music_evolution_vocal import (
    _ACE_STYLE_SECTION_TAG_RE,
    _capitalize_ace_style_section_label,
    evolution_section_arrangement_hint,
)

_FIRST_SECTION_IN_TAGS_RE = re.compile(
    r"\[(?:Intro|Verse|Pre-Chorus|Chorus|Bridge|Outro|Hook)\b",
    re.I,
)


def _split_tags_style_prefix(tags: str) -> tuple[str, str]:
    text = (tags or "").strip()
    m = _FIRST_SECTION_IN_TAGS_RE.search(text)
    if not m:
        return text, ""
    prefix = text[: m.start()].strip().rstrip(".,; ")
    body = text[m.start() :].strip()
    return prefix, body


def _parse_tags_section_hints(tags: str) -> dict[tuple[str, int], str]:
    """Map (canonical kind, occurrence) -> production hint from existing tags."""
    _, body = _split_tags_style_prefix(tags)
    scan = body or (tags or "").strip()
    hints: dict[tuple[str, int], str] = {}
    markers = list(_ACE_STYLE_SECTION_TAG_RE.finditer(scan))
    kind_occ: dict[str, int] = {}
    for i, m in enumerate(markers):
        label_inner = m.group(1)
        display = _capitalize_ace_style_section_label(label_inner)
        kind = _canonical_vocal_section_from_header(display) or "verse"
        kind_occ[kind] = kind_occ.get(kind, 0) + 1
        start = m.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(scan)
        desc = scan[start:end].strip().rstrip(".,; ")
        if desc:
            hints[(kind, kind_occ[kind])] = desc
    return hints


def _hint_from_lyrics_arrangement(lyrics: str, display_label: str) -> str | None:
    """Use enriched header or following ``(Arrangement: …)`` line from lyrics."""
    target = display_label.strip().lower()
    lines = (lyrics or "").splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("["):
            continue
        parsed = parse_music_section_header(stripped)
        if not parsed:
            continue
        label = _capitalize_ace_style_section_label(parsed["section_name_raw"])
        if label.lower() != target:
            continue
        hint = (parsed.get("arrangement_hint") or "").strip()
        if hint:
            return hint
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines):
            nxt = lines[j].strip()
            m = re.match(r"^\(Arrangement:\s*(.+?)\)\s*$", nxt, re.I)
            if m:
                return m.group(1).strip()
    return None


def sync_evolution_tags_sections_to_lyrics(
    tags: str,
    lyrics: str,
    *,
    soloist_id: str,
    bpm: int,
) -> str:
    """
    After ``Style: …`` block, emit one ``[Section] production…`` per lyrics header in order.
    Labels match lyrics exactly (``[Verse 1]``, ``[Pre-Chorus]``, repeated ``[Chorus]``).
    """
    labels = lyrics_section_labels_ordered_exact(lyrics)
    if not labels:
        return tags or ""
    style_prefix, _ = _split_tags_style_prefix(tags)
    if not style_prefix:
        style_prefix = (tags or "").split("[", 1)[0].strip().rstrip(".,; ") or "Style: XL Base track"
    parsed_hints = _parse_tags_section_hints(tags)
    sid = resolve_soloist_id(soloist_id)
    kind_occurrence: dict[str, int] = {}
    blocks: list[str] = []
    for display_label in labels:
        kind = _canonical_vocal_section_from_header(display_label) or "verse"
        kind_occurrence[kind] = kind_occurrence.get(kind, 0) + 1
        occ = kind_occurrence[kind]
        tag_label = display_label
        # Lula/Luna ACE: numbered [Chorus 2] in tags causes mid-song section reset (~1:06).
        if sid == "nebula" and kind == "chorus":
            tag_label = "Chorus"
        hint = (
            _hint_from_lyrics_arrangement(lyrics, display_label)
            or parsed_hints.get((kind, occ))
            or parsed_hints.get((kind, 1))
            or evolution_section_arrangement_hint(soloist_id=sid, kind=kind, bpm=bpm)
        )
        hint = re.sub(r"\s+", " ", hint).strip().rstrip(".,; ")
        blocks.append(f"[{tag_label}] {hint}")
    return f"{style_prefix} " + " ".join(blocks)


def evolution_tags_section_labels(tags: str) -> list[str]:
    """Bracket labels present in tags (for tests/diagnostics)."""
    return [_capitalize_ace_style_section_label(m.group(1)) for m in _ACE_STYLE_SECTION_TAG_RE.finditer(tags or "")]
