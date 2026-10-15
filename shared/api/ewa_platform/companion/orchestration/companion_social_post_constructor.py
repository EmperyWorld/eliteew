# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Multi-pass LLM constructor for long-form social posts: outline → per-section expansion → merge → polish.
# Invariants:
# - Used when pipeline mode is ``constructor`` and channel is not micro-format (Twitter/Threads).
# - Each section expansion is an independent LLM call; merge pass stitches without dropping detail.
# Related:
# - api/ewa_platform/companion/orchestration/companion_social_post_compose.py
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx

from api.ewa_platform.companion.orchestration.companion_social_post_compose import (
    _build_social_post_system_prompt,
    _build_topic_anchor,
    _invoke_social_post_llm,
    _social_post_llm_runtime,
    _social_post_polish_retry_enabled,
    _strip_llm_fences,
    format_social_post_body,
    post_quality_needs_polish,
)
from api.ewa_platform.settings.access import ewa_getenv, ewa_getenv_int

logger = logging.getLogger(__name__)

_ENV_PIPELINE = "EWA_COMPANION_SOCIAL_POST_PIPELINE"
_ENV_SECTION_COUNT = "EWA_COMPANION_SOCIAL_POST_CONSTRUCTOR_SECTIONS"
_ENV_OUTLINE_NUM_PREDICT = "EWA_COMPANION_SOCIAL_POST_OUTLINE_NUM_PREDICT"
_ENV_SECTION_NUM_PREDICT = "EWA_COMPANION_SOCIAL_POST_SECTION_NUM_PREDICT"
_ENV_MERGE_NUM_PREDICT = "EWA_COMPANION_SOCIAL_POST_MERGE_NUM_PREDICT"
_ENV_CONSTRUCTOR_TIMEOUT_SEC = "EWA_COMPANION_SOCIAL_POST_CONSTRUCTOR_TIMEOUT_SEC"

_MICRO_FORMAT_CHANNELS = frozenset({"twitter", "threads", "instagram"})


@dataclass(frozen=True, slots=True)
class _OutlineSection:
    key: str
    title: str
    brief: str


def social_post_pipeline_mode() -> str:
    raw = ewa_getenv(_ENV_PIPELINE, "constructor").strip().lower()
    return raw if raw in {"constructor", "single"} else "constructor"


def uses_constructor_pipeline(*, channel: str, short_mode: bool, long_form: bool = False) -> bool:
    if short_mode:
        return False
    if channel in _MICRO_FORMAT_CHANNELS:
        return False
    if long_form:
        return True
    return social_post_pipeline_mode() == "constructor"


def _target_section_count(channel: str) -> int:
    n = ewa_getenv_int(_ENV_SECTION_COUNT, default=0)
    if n >= 5:
        return min(n, 12)
    defaults = {
        "vk": 9,
        "dzen": 10,
        "blog": 10,
        "telegram": 8,
        "linkedin": 7,
        "facebook": 8,
        "newsletter": 6,
        "generic": 8,
    }
    return defaults.get(channel, 7)


def _env_int(name: str, default: int, *, lo: int, hi: int) -> int:
    return max(lo, min(hi, ewa_getenv_int(name, default=default)))


def parse_post_outline(outline_text: str) -> tuple[str, list[_OutlineSection], str, str]:
    """Parse ``## HOOK / ## SECTION / ## CTA / ## HASHTAGS`` outline into parts."""

    text = (outline_text or "").replace("\r\n", "\n").strip()
    blocks = re.split(r"(?m)^##\s+", text)
    hook = ""
    cta = ""
    hashtags = ""
    sections: list[_OutlineSection] = []

    for raw in blocks:
        block = raw.strip()
        if not block:
            continue
        first_line, _, rest = block.partition("\n")
        heading = first_line.strip()
        body = rest.strip()
        key = heading.upper()
        if key.startswith("HOOK"):
            hook = body
        elif key.startswith("CTA"):
            cta = body
        elif key.startswith("HASHTAGS") or key.startswith("TAGS"):
            hashtags = body.lstrip("#").strip()
            if hashtags and not hashtags.startswith("#"):
                hashtags = "#" + hashtags.replace(" ", " #")
        elif key.startswith("SECTION:"):
            title = heading.split(":", 1)[1].strip() if ":" in heading else heading
            sections.append(_OutlineSection(key="section", title=title, brief=body))
        elif key.startswith("SECTION"):
            title = body.split("\n", 1)[0].strip() if body else heading
            brief = body.split("\n", 1)[1].strip() if "\n" in body else ""
            sections.append(_OutlineSection(key="section", title=title or heading, brief=brief))
        else:
            sections.append(_OutlineSection(key="section", title=heading, brief=body))

    return hook, sections, cta, hashtags


def _fallback_outline_from_text(text: str, *, section_count: int) -> tuple[str, list[_OutlineSection], str, str]:
    """Minimal outline when the model did not follow ## headers."""

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    hook = lines[0] if lines else "Hook"
    sections: list[_OutlineSection] = []
    for i in range(section_count):
        sections.append(
            _OutlineSection(
                key="section",
                title=f"Блок {i + 1}",
                brief="Раскрой тему пользователя подробно с конкретными фактами и примерами по их запросу.",
            )
        )
    return hook, sections, "Вопрос к аудитории", "#тема"


async def _generate_post_outline(
    *,
    client: httpx.AsyncClient,
    base: str,
    model: str,
    timeout: httpx.Timeout,
    system: str,
    user_blob: str,
    channel: str,
    section_count: int,
    ru: bool,
) -> str:
    outline_predict = _env_int(_ENV_OUTLINE_NUM_PREDICT, 4096, lo=1024, hi=8192)
    lang = "Russian" if ru else "English"
    outline_user = (
        f"{user_blob}\n\n"
        f"TASK: Produce a detailed OUTLINE ONLY for a **long-form {channel} article-post** in {lang}.\n"
        f"Target **{section_count} body sections** (plus hook, CTA, hashtags).\n"
        "Use EXACTLY this markdown shape (no other prose):\n"
        "## HOOK\n"
        "One-line hook idea + angle\n"
        "## SECTION: <short title>\n"
        "- bullet fact/angle to expand\n"
        "- bullet\n"
        "(repeat for each section; pick a distinct emoji per section for the final subhead)\n"
        "## CTA\n"
        "Engaging question for comments\n"
        "## HASHTAGS\n"
        "#tag1 #tag2 ...\n"
        "Sections must cover: context, topic-specific details from the user brief, numbers/scenarios, "
        "mistakes, comparison, actionable advice, outlook.\n"
    )
    return _strip_llm_fences(
        await _invoke_social_post_llm(
            client=client,
            base=base,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": outline_user},
            ],
            num_predict=outline_predict,
            timeout=timeout,
            temperature=0.45,
        )
    )


async def _expand_outline_section(
    *,
    client: httpx.AsyncClient,
    base: str,
    model: str,
    timeout: httpx.Timeout,
    system: str,
    user_blob: str,
    channel: str,
    section: _OutlineSection,
    section_index: int,
    section_total: int,
    ru: bool,
) -> str:
    section_predict = _env_int(_ENV_SECTION_NUM_PREDICT, 8192, lo=2048, hi=16384)
    lang = "Russian" if ru else "English"
    expand_user = (
        f"{user_blob}\n\n"
        f"Expand **section {section_index}/{section_total}** for a long {channel} post ({lang}).\n"
        f"Section title: {section.title}\n"
        f"Outline notes:\n{section.brief}\n\n"
        "Rules:\n"
        "- Output ONLY this section (no global intro/outro).\n"
        "- **1000–2200 characters** for this section alone.\n"
        "- Start with a standalone **bold subheading** line: one emoji + section title (e.g. `💡 **Заголовок**`).\n"
        "- Then 3–7 paragraphs; use • bullets for lists; concrete examples from the user's topic.\n"
        "- No MBA clichés; no repetition of generic advice.\n"
    )
    return _strip_llm_fences(
        await _invoke_social_post_llm(
            client=client,
            base=base,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": expand_user},
            ],
            num_predict=section_predict,
            timeout=timeout,
            temperature=0.58,
        )
    )


async def _merge_expanded_sections(
    *,
    client: httpx.AsyncClient,
    base: str,
    model: str,
    timeout: httpx.Timeout,
    system: str,
    channel: str,
    hook: str,
    expanded_sections: list[str],
    cta: str,
    hashtags: str,
    ru: bool,
) -> str:
    merge_predict = _env_int(_ENV_MERGE_NUM_PREDICT, 16384, lo=4096, hi=32000)
    lang = "Russian" if ru else "English"
    body = "\n\n---SECTION---\n\n".join(expanded_sections)
    merge_user = (
        f"Merge the section drafts below into ONE seamless **long-form {channel} post** ({lang}).\n"
        f"HOOK idea: {hook}\n"
        f"CTA idea: {cta}\n"
        f"Hashtags line (keep at end): {hashtags}\n\n"
        "Rules:\n"
        "- Keep ALL topic-specific detail — do not shorten; smooth transitions only.\n"
        "- Opening: 1 emoji + **bold hook headline**, then 1–2 teaser lines.\n"
        "- Every major block keeps emoji + **bold** subhead; preserve • bullets; blank line between blocks.\n"
        "- End with CTA question (optional 👇), then hashtags on the last line.\n"
        "- Output ONLY the final post.\n\n"
        f"SECTION DRAFTS:\n{body[:88000]}\n"
    )
    return _strip_llm_fences(
        await _invoke_social_post_llm(
            client=client,
            base=base,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": merge_user},
            ],
            num_predict=merge_predict,
            timeout=timeout,
            temperature=0.5,
        )
    )


async def compose_social_post_via_constructor(
    *,
    user_line: str,
    brief: str,
    channel: str,
    source_text: str | None,
    source_label: str | None,
    principal_id: str,
    profile: Mapping[str, Any] | None,
    companion_pool: Any,
    ru: bool,
    persona: str,
    memory_blob: str,
) -> str | None:
    """Multi-LLM long-form post constructor."""

    line = (user_line or "").strip()
    system = _build_social_post_system_prompt(channel=channel, ru=ru, short_mode=False)
    system += (
        "\nLong-form constructor mode: you are building an **article-scale** social post "
        "(10000–25000+ characters total). Depth, topic-specific detail, scannable **bold** structure, "
        "and **emoji per section** are mandatory. Write ONLY about the user's topic — "
        "do not substitute another subject.\n"
    )

    topic_anchor = _build_topic_anchor(user_line=line, brief=brief)
    user_blob = f"Persona seed: {persona}\nUser request:\n{line}\n"
    if topic_anchor:
        user_blob += f"\n{topic_anchor}"
    if brief and brief.lower() != line.lower():
        user_blob += f"\nTopic/brief:\n{brief}\n"
    if source_text:
        label = (source_label or "document").strip()
        user_blob += f"\nSource document ({label}):\n---\n{source_text[:48000]}\n---\n"
    if memory_blob:
        user_blob += f"\nRecent chat snippets (tone only):\n{memory_blob}\n"

    base, model, _num_predict, _timeout_sec, max_output_chars = _social_post_llm_runtime()
    if not base:
        return None

    raw_timeout = ewa_getenv(_ENV_CONSTRUCTOR_TIMEOUT_SEC, "").strip()
    if not raw_timeout:
        raw_timeout = ewa_getenv("EWA_COMPANION_SOCIAL_POST_TIMEOUT_SEC", "600").strip() or "600"
    try:
        timeout_sec = float(raw_timeout)
    except ValueError:
        timeout_sec = 600.0
    timeout_sec = max(60.0, min(timeout_sec, 900.0))
    timeout = httpx.Timeout(timeout_sec)

    section_count = _target_section_count(channel)
    expanded: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            outline_raw = await _generate_post_outline(
                client=client,
                base=base,
                model=model,
                timeout=timeout,
                system=system,
                user_blob=user_blob,
                channel=channel,
                section_count=section_count,
                ru=ru,
            )
            hook, sections, cta, hashtags = parse_post_outline(outline_raw)
            if len(sections) < 3:
                hook, sections, cta, hashtags = _fallback_outline_from_text(
                    outline_raw or user_blob,
                    section_count=section_count,
                )

            logger.info(
                "[STEP] companion_social_post_constructor_outline sections=%s channel=%s",
                len(sections),
                channel,
            )

            for idx, section in enumerate(sections, start=1):
                part = await _expand_outline_section(
                    client=client,
                    base=base,
                    model=model,
                    timeout=timeout,
                    system=system,
                    user_blob=user_blob,
                    channel=channel,
                    section=section,
                    section_index=idx,
                    section_total=len(sections),
                    ru=ru,
                )
                if part and len(part.strip()) >= 40:
                    expanded.append(part.strip())

            if not expanded:
                logger.warning("[STEP] companion_social_post_constructor_no_sections channel=%s", channel)
                return None

            merged = await _merge_expanded_sections(
                client=client,
                base=base,
                model=model,
                timeout=timeout,
                system=system,
                channel=channel,
                hook=hook,
                expanded_sections=expanded,
                cta=cta,
                hashtags=hashtags,
                ru=ru,
            )

            post = merged or "\n\n".join(expanded)
            if hashtags and hashtags not in post:
                post = f"{post.rstrip()}\n\n{hashtags}"

            if post and _social_post_polish_retry_enabled() and post_quality_needs_polish(post, channel=channel):
                polish_user = (
                    f"Polish this long {channel} post: remove clichés, strengthen **bold** hooks, "
                    f"ensure • bullet blocks and \\n\\n between paragraphs. Do NOT shorten.\n\n{post[:64000]}"
                )
                polished = _strip_llm_fences(
                    await _invoke_social_post_llm(
                        client=client,
                        base=base,
                        model=model,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": polish_user},
                        ],
                        num_predict=_env_int(_ENV_MERGE_NUM_PREDICT, 16384, lo=4096, hi=32000),
                        timeout=timeout,
                        temperature=0.45,
                    )
                )
                if polished and len(polished) >= max(200, len(post) // 2):
                    post = polished

    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("[STEP] companion_social_post_constructor_failed err=%s", exc)
        return None

    post = format_social_post_body(post, channel=channel)
    if len(post) < 200:
        logger.info("[STEP] companion_social_post_constructor_empty len=%s", len(post))
        return None

    logger.info(
        "[STEP] companion_social_post_constructor_ok chars=%s channel=%s sections=%s",
        len(post),
        channel,
        len(expanded),
    )
    return post[:max_output_chars]


__all__ = (
    "compose_social_post_via_constructor",
    "parse_post_outline",
    "social_post_pipeline_mode",
    "uses_constructor_pipeline",
)
