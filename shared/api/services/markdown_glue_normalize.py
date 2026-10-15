"""
Heuristics for AI / export Markdown that lost line breaks (single mega-line or very long lines).

Reprocess alone cannot fix layout if the stored file literally has no newlines between
sections — we normalize only when the text looks "glued", then markdown rendering improves.
"""

from __future__ import annotations

import re


def markdown_needs_glue_normalization(text: str) -> bool:
    if not text or not text.strip():
        return False
    lines = text.split("\n")
    if len(lines) == 1 and len(text) > 400:
        return True
    longest = max((len(line) for line in lines), default=0)
    if longest > 700:
        return True
    return len(text) > 2000 and text.count("\n") < 8


def normalize_glued_markdown_text(text: str) -> str:
    if not text:
        return text
    s = text.replace("\r\n", "\n").replace("\r", "\n")

    # --- glued to next heading: ---# Section
    s = re.sub(r"---+(\s*)(#{1,6}\s+)", r"\n\n---\n\n\2", s)

    # Headings stuck to previous text / punctuation
    s = re.sub(r"(?<=\S)(#{1,6}\s+)", r"\n\n\1", s)

    # JTBD / deck-style field labels after a word (no space before label)
    labels = (
        "Триггер:",
        "Боль:",
        "Желаемый результат:",
        "Ожидаемая выгода:",
        "Барьеры:",
        "Почему это работает:",
        "Headline:",
        "Ценностное предложение:",
        "Что даёт платформа:",
        "Оффер:",
        "CTA:",
    )
    for lab in labels:
        s = re.sub(
            rf"(?<=\w)({re.escape(lab)})",
            r"\n\n\1",
            s,
            flags=re.UNICODE,
        )

    # Horizontal rule mid-paragraph
    s = re.sub(r"(?<=\S)(-{3,})(?=\S|$)", r"\n\n\1\n\n", s)

    s = re.sub(r"\n{4,}", "\n\n\n", s)
    return s.strip()
