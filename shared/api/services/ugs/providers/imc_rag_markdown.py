# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG: детерминированная пост-обработка markdown-ответов (чистка, склейка секций, anti-loop).
# Invariants:
# - Публичный контракт `normalize_imc_markdown_delivery`; без вызовов LLM.
# Related:
# - api.services.ugs.providers.imc_rag_research_provider
# ---

"""ИМК RAG markdown post-process helpers."""

from __future__ import annotations

import re

_BOLD_FRAG_RE = re.compile(r"\*\*([^*]+)\*\*", re.DOTALL)


def strip_leaked_merge_instructions(text: str) -> tuple[str, bool]:
    if not text or len(text) < 60:
        return text, False
    anchors = [
        r"\n\*{0,2}Перед отправкой\*{0,2}\s*:",
        r"\n\*\*Перед отправкой:\*\*",
        r"\n\*\*Тип deep_market_showcase\*\*\s*:",
        r"\n\*\*Тип trends/signals\*\*\s*:",
        r"\n\*\*Сейчас выдай только\*\*",
        r"\n\*\*Метки источников:\*\* перенеси в итог",
    ]
    cut = len(text)
    for pat in anchors:
        m = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if m is not None and m.start() < cut:
            cut = m.start()
    if cut < len(text):
        return text[:cut].rstrip(), True
    return text, False


def strip_trailing_identical_bold_loop(text: str, *, min_repeat: int) -> tuple[str, bool]:
    if min_repeat < 4 or len(text) < 400:
        return text, False
    matches = list(_BOLD_FRAG_RE.finditer(text))
    if len(matches) < min_repeat:
        return text, False
    anchor = matches[-1].group(1).strip().lower()
    if len(anchor) < 2:
        return text, False
    streak = 1
    cut_start = matches[-1].start()
    for idx in range(len(matches) - 2, -1, -1):
        cur = matches[idx].group(1).strip().lower()
        if cur == anchor:
            streak += 1
            cut_start = matches[idx].start()
        else:
            break
    if streak < min_repeat:
        return text, False
    note = "\n\n_Хвост ответа обрезан: обнаружено зацикливание на повторе одной фразы в markdown._\n"
    return text[:cut_start].rstrip() + note, True


def looks_like_assistant_refusal(text: str) -> bool:
    s = (text or "").strip()
    if len(s) > 8000:
        return False
    cf = s.casefold()
    needles = (
        "ваш запрос был обрезан",
        "запрос был обрезан",
        "не могу продолжить ответ",
        "не могу продолжить",
        "не могу продолжить создание",
        "не может быть выполнен",
        "в соответствии с заданными правилами",
        "используя доступные мне данные",
        "на которые у меня есть информацию",
        "если у вас есть другие вопросы",
        "пересмотреть структуру вашего запроса",
        "множества блоков с перечислениями",
        "единый текстовый документ",
    )
    hits = sum(1 for n in needles if n in cf)
    return (
        hits >= 2
        or ("обрезан" in cf and "не могу" in cf)
        or ("правила" in cf and "не могу" in cf)
        or ("запрос не может быть выполнен" in cf)
    )


def _h2_titles_redundant(outer: str, inner: str) -> bool:
    o = outer.casefold().strip()
    i = inner.casefold().strip()
    if not o or not i:
        return False
    if i in o or o in i:
        return True
    o0 = o.split(maxsplit=1)[0] if o else ""
    i0 = i.split(maxsplit=1)[0] if i else ""
    return bool(len(o0) >= 8 and o0 == i0)


def _demote_redundant_h2_in_orchestrated_chunk(chunk: str) -> str:
    raw = chunk.strip("\n")
    if not raw.startswith("## ") or "\n" not in raw:
        return chunk
    first_nl = raw.find("\n")
    outer_title = raw[3:first_nl].strip()
    rest = raw[first_nl + 1 :]
    lines = rest.split("\n")
    k = 0
    while k < len(lines) and not lines[k].strip():
        k += 1
    if k >= len(lines):
        return chunk
    line_k = lines[k]
    if not (line_k.startswith("## ") and not line_k.startswith("### ")):
        return chunk
    inner_title = line_k[3:].strip()
    if not _h2_titles_redundant(outer_title, inner_title):
        return chunk
    lines[k] = "### " + inner_title
    return raw[: first_nl + 1] + "\n".join(lines)


def _unwrap_markdown_code_fences(text: str) -> str:
    out: list[str] = []
    i = 0
    low = text.lower()
    while i < len(text):
        start = low.find("```markdown", i)
        if start < 0:
            out.append(text[i:])
            break
        out.append(text[i:start])
        line_end = text.find("\n", start)
        if line_end < 0:
            out.append(text[start:])
            break
        close = text.find("```", line_end + 1)
        if close < 0:
            out.append(text[line_end + 1 :])
            break
        inner = text[line_end + 1 : close].strip("\n")
        if inner:
            if out and out[-1] and not out[-1].endswith("\n"):
                out.append("\n")
            out.append(inner)
            if not inner.endswith("\n"):
                out.append("\n")
        i = close + 3
    return "".join(out)


def _remove_orphan_markdown_fence_lines(text: str) -> str:
    lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip().lower()
        if stripped in ("```markdown", "```md"):
            continue
        lines.append(line)
    return "\n".join(lines)


def _normalize_orchestrated_markdown_sections(text: str) -> str:
    if "\n---\n\n" in text:
        parts = text.split("\n---\n\n")
        fixed = [_demote_redundant_h2_in_orchestrated_chunk(p) if p.strip() else p for p in parts]
        return "\n---\n\n".join(fixed)
    return _demote_redundant_h2_in_orchestrated_chunk(text)


def _strip_hr_prefaced_disclaimer_notes(text: str) -> str:
    pattern = re.compile(
        r"\n---[ \t]*\n+\s*(?:\*\*Примечание:\*\*|\*\*Примечание\*\*\s*:).*?(?=\n+\s*## |\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    prev = None
    out = text
    iterations = 0
    while prev != out and iterations < 8:
        prev = out
        out = pattern.sub("", out)
        iterations += 1
    return out


def _strip_trailing_placeholder_table_note(text: str) -> str:
    markers = (
        "_примечание: в данном ответе представлены примерные",
        "_примечание: в данном ответе представлены примерные фрагменты",
        "примечание: в данном ответе представлены примерные фрагменты",
    )
    low = text.lower()
    best = -1
    for m in markers:
        idx = low.rfind(m)
        if idx > best:
            best = idx
    if best < 0 or best < len(text) // 3:
        return text
    head = text[:best].rstrip()
    return head.rstrip("-").rstrip()


def normalize_imc_markdown_delivery(text: str) -> str:
    """Детерминированная чистка markdown для отображения в маркетинговом кабинете (ИМК)."""
    if not (text or "").strip():
        return text
    t = _unwrap_markdown_code_fences(text)
    t = _remove_orphan_markdown_fence_lines(t)
    t = _normalize_orchestrated_markdown_sections(t)
    t = _strip_hr_prefaced_disclaimer_notes(t)
    t = _strip_trailing_placeholder_table_note(t)
    t = t.strip()
    return t + "\n" if t else t
