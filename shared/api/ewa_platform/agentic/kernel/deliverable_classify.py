# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Classify agentic file_create deliverables as research vs personal so expert
# research context is injected only where it belongs.
# Invariants:
# - Classify is SoT: personal → never inject; research → always inject.
# - Think cannot veto research with use_expert_research=false (cause of empty docs after experts).
# - Ambiguous: inject when expert research already exists in session; else honor explicit bool.
# Related:
# - api/ewa_platform/agentic/kernel/plan_tool_args_prepare.py
# - api/ewa_platform/agentic/kernel/tool_args_enrich.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any, Literal

DeliverableKind = Literal["research", "personal", "ambiguous"]

_PERSONAL_RE = re.compile(
    r"(?is)"
    r"(?:правила\s*работы|сонастройк|знакомств|я\s*[-—]\s*твой\s*спутник|"
    r"регламент\s*взаимодейств|внутренняя\s*сонастройк|"
    r"work\s*rules|intro(?:duction)?\s*algorithm|companion\s*intro)"
)

_RESEARCH_RE = re.compile(
    r"(?is)"
    r"(?:презентац|тезис|исследован|гипотез|рынк|ДВФУ|вуз|"
    r"анкет|партн[её]р|бизнес[- ]?сегмент|roadmap|brief|"
    r"описан(?:ие|ия)|лонгрид|инструкц|регистрац|платформ|"
    r"методолог|артефакт|world\s*bible|character\s*sheet|"
    r"visual\s*style|style\s*guide|гайдлайн|шаблон|template|"
    r"мироустройство|хронолог|географи|экспертн|"
    r"presentation|thesis|theses|research|market|hypothesis|"
    r"instruction|platform|long[- ]?form|registration)"
)

_PROCESS_PREFIX_RE = re.compile(r"(?i)^(создание|создать|create|creating|make|making)_+")


def classify_file_create_deliverable(
    *,
    title: str = "",
    instruction: str = "",
    name: str = "",
    user_line: str = "",
) -> DeliverableKind:
    """Return research / personal / ambiguous for a planned file_create node."""

    blob = " ".join(
        str(part or "").strip() for part in (title, instruction, name, user_line) if str(part or "").strip()
    )
    if not blob:
        return "ambiguous"
    personal = bool(_PERSONAL_RE.search(blob))
    research = bool(_RESEARCH_RE.search(blob))
    if personal and not research:
        return "personal"
    if research and not personal:
        return "research"
    if personal and research:
        # Personal deliverables must not inherit research bleed.
        return "personal"
    return "ambiguous"


def _explicit_use_expert_research(raw: Mapping[str, Any]) -> bool | None:
    """Parse Think/tool explicit flag; None when absent or unparseable."""

    if "use_expert_research" not in raw:
        return None
    val = raw.get("use_expert_research")
    if isinstance(val, bool):
        return val
    text = str(val or "").strip().lower()
    if text in {"0", "false", "no", "off"}:
        return False
    if text in {"1", "true", "yes", "on"}:
        return True
    return None


def resolve_use_expert_research(
    args: Mapping[str, Any] | None,
    *,
    title: str = "",
    instruction: str = "",
    name: str = "",
    user_line: str = "",
    has_expert_research: bool = False,
) -> bool:
    """Decide whether file_create compose should prepend expert research.

    Classify wins over Think for personal/research. Ambiguous uses session expert
    presence first, then an explicit bool if present.
    """

    raw = args if isinstance(args, Mapping) else {}
    kind = classify_file_create_deliverable(
        title=title,
        instruction=instruction,
        name=name or str(raw.get("name") or ""),
        user_line=user_line or str(raw.get("user_line") or ""),
    )
    if kind == "personal":
        return False
    if kind == "research":
        return True
    if has_expert_research:
        return True
    explicit = _explicit_use_expert_research(raw)
    return bool(explicit) if explicit is not None else False


def strip_process_filename_prefix(basename: str) -> str:
    """Drop gerund/process prefixes like Создание_ from a filename stem."""

    text = str(basename or "").strip()
    if not text:
        return text
    prev = None
    while prev != text:
        prev = text
        text = _PROCESS_PREFIX_RE.sub("", text)
    return text.strip("_") or str(basename or "").strip()


def normalize_agentic_doc_filename(name: str) -> str:
    """Force generative agentic docs to .md; keep .html; strip process prefixes."""

    raw = str(name or "").strip()
    if not raw:
        return raw
    if "/" in raw or "\\" in raw:
        raw = raw.replace("\\", "/").rsplit("/", 1)[-1]
    stem, dot, ext = raw.rpartition(".")
    if not dot:
        stem, ext = raw, "md"
    else:
        ext_l = ext.lower()
        if ext_l == "txt":
            ext = "md"
        elif ext_l == "html":
            ext = "html"
        elif ext_l == "md":
            ext = "md"
        else:
            # Unknown extension: keep as-is but still strip process prefix on stem.
            cleaned = strip_process_filename_prefix(stem) if stem else raw
            return f"{cleaned}.{ext}"[:512] if stem else raw[:512]
    cleaned = strip_process_filename_prefix(stem) if stem else "document"
    if not cleaned:
        cleaned = "document"
    return f"{cleaned[:200]}.{ext}"[:512]


__all__ = (
    "DeliverableKind",
    "classify_file_create_deliverable",
    "normalize_agentic_doc_filename",
    "resolve_use_expert_research",
    "strip_process_filename_prefix",
)
