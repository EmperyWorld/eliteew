# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared z-image-turbo (01_top) prompt hygiene: strip Cyrillic, drop quote-bait,
# scrub text-bait subjects, allow only explicit English wordmarks, native 1024² latent.
# Invariants:
# - Default images are text-free. On-image lettering is only a validated ASCII English wordmark.
# - Guard text must never contain example quotes such as "Brand Name".
# - Turbo latents that are not 1024×1024 produce glitch / pseudo-text.
# Related:
# - api/services/ugs/providers/comfyui_observability.py
# - api/services/site_studio_ai_service.py
# - documentation/product/SITE-STUDIO.md
# ---
from __future__ import annotations

import re

Z_IMAGE_NATIVE_SIZE = 1024

_CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]+")
_QUOTED_SPAN_RE = re.compile(r'"([^"]{1,80})"')
_ENGLISH_WORDMARK_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .&'\-]{0,47}$")
_BANNED_EXAMPLE_LABELS = frozenset(
    {
        "brand name",
        "project name",
        "site name",
        "your brand",
        "company name",
        "logo text",
    }
)

# Subjects that make z-image-turbo paint gibberish letters even with anti-text suffixes.
_TEXT_BAIT_REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"(?i)\b(roadside|street|neon|vintage|glowing)\s+signs?\b"),
        "abstract glowing landmark sculpture",
    ),
    (re.compile(r"(?i)\b(billboard|marquee|signage|storefront\s+sign)\b"), "soft light sculpture"),
    (re.compile(r"(?i)\bsigns?\b"), "light form"),
    (
        re.compile(r"(?i)\b(architectural\s+)?blueprints?\b"),
        "clean abstract geometric plan lines without labels",
    ),
    (
        re.compile(r"(?i)\b(business\s+)?documents?\b"),
        "blank paper sheets with empty surface",
    ),
    (re.compile(r"(?i)\b(papers?|forms?)\b(?=[^,]*(desk|table|marble))"), "blank paper"),
    (
        re.compile(r"(?i)\bbusiness\s+cards?\b"),
        "blank matte card rectangle with empty face",
    ),
    (
        re.compile(r"(?i)\b(dashboard|infographic|spreadsheet)\b"),
        "abstract glowing geometric curves",
    ),
    (
        re.compile(r"(?i)\b(data\s+)?(charts?|graphs?|heat\s*maps?)\b"),
        "abstract glowing curves without labels or numbers",
    ),
    (
        re.compile(r"(?i)\b(newspaper|magazine|poster|flyer|brochure|menu)\b"),
        "abstract printed texture without letters",
    ),
    (
        re.compile(r"(?i)\b(ui|hud|interface|screen\s+with\s+text|monitor\s+with\s+text)\b"),
        "blank luminous screen glow",
    ),
    (re.compile(r"(?i)\b(caption|lettering|typography|title\s+block)\b"), "clean empty space"),
)

SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE = (
    "Commercial web imagery; crisp detail; clean negative space. "
    "Text-free image: no letters, numbers, captions, signage, posters, UI, watermarks, or logos. "
    "No Cyrillic anywhere. Render zero text."
)

_Z_IMAGE_NO_TEXT_SUFFIX = (
    ", high quality composition, absolutely no readable text, no typography, no letters or numbers, "
    "no cyrillic or latin characters, no signage, no captions, no logos, no watermarks, "
    "no infographic or poster layout"
)

_Z_IMAGE_WORDMARK_SUFFIX = (
    ", high quality composition, no cyrillic, no extra captions, no signage, no posters, "
    "no UI, no watermarks, no random letters; the only permitted lettering is the English wordmark already named"
)


def is_english_wordmark(label: str) -> bool:
    """True when the label is a short ASCII name safe to optionally paint."""
    inner = (label or "").strip()
    if not inner or inner.lower() in _BANNED_EXAMPLE_LABELS:
        return False
    return bool(_ENGLISH_WORDMARK_RE.fullmatch(inner))


def strip_cyrillic_runs(text: str) -> str:
    """Remove Cyrillic so z-image cannot treat Russian words as type to paint."""
    return re.sub(r"\s+", " ", _CYRILLIC_RE.sub(" ", text or "")).strip()


def scrub_z_image_text_bait_subjects(prompt: str) -> str:
    """Replace subjects that reliably cause z-image to render gibberish text."""
    s = (prompt or "").strip()
    if not s:
        return ""
    for pattern, replacement in _TEXT_BAIT_REPLACEMENTS:
        s = pattern.sub(replacement, s)
    return re.sub(r"\s+", " ", s).strip(" ,")


def _keep_or_drop_quoted(match: re.Match[str]) -> str:
    inner = match.group(1).strip()
    if is_english_wordmark(inner):
        return f'"{inner}"'
    return " "


def strip_invalid_quoted_labels(prompt: str) -> str:
    """Drop quoted bait (Cyrillic, examples). Keep only ASCII English wordmarks."""
    s = (prompt or "").replace("\u201c", '"').replace("\u201d", '"')
    s = _QUOTED_SPAN_RE.sub(_keep_or_drop_quoted, s)
    return re.sub(r"\s+", " ", s).strip(" ,")


def extract_english_wordmarks(prompt: str) -> list[str]:
    """Return validated English wordmarks still present after quote cleanup."""
    found: list[str] = []
    for match in _QUOTED_SPAN_RE.finditer(prompt or ""):
        inner = match.group(1).strip()
        if is_english_wordmark(inner) and inner not in found:
            found.append(inner)
    return found


def sanitize_z_image_visual_prompt(prompt: str) -> str:
    """Cyrillic-free, bait-scrubbed visual prompt with only valid English quotes."""
    s = strip_invalid_quoted_labels(prompt or "")
    s = strip_cyrillic_runs(s)
    s = scrub_z_image_text_bait_subjects(s)
    return s


def snap_z_image_turbo_latent(width: int, height: int) -> tuple[int, int]:
    """z-image-turbo native latent. Non-square / non-1024 sizes yield glitch soup."""
    _ = (width, height)
    return (Z_IMAGE_NATIVE_SIZE, Z_IMAGE_NATIVE_SIZE)


def finalize_z_image_user_prompt(prompt: str) -> str:
    """Positive-prompt SoT for 01_top: anti-text lives here (negative CLIP is unused)."""
    base = sanitize_z_image_visual_prompt(prompt)
    if not base:
        base = "a beautiful image"
    wordmarks = extract_english_wordmarks(base)
    low = base.lower()
    if wordmarks:
        if "english wordmark already named" in low:
            return base
        return f"{base}{_Z_IMAGE_WORDMARK_SUFFIX}"
    if "no readable text" in low or "no typography" in low or "без текста" in low:
        return base
    return f"{base}{_Z_IMAGE_NO_TEXT_SUFFIX}"


# Cross-module import alias kept for Comfy presets / tests.
_finalize_z_image_user_prompt = finalize_z_image_user_prompt
