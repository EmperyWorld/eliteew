"""
Detect HTML fragments mislabeled as .md / plain text and extract readable plain text.

Some exports save Word/Google HTML with a .md extension; Markdown parsing then breaks
and reprocess cannot "fix" structure without treating the body as HTML first.
"""

from __future__ import annotations

import html as html_module
import re

_HTML_TAG_PROBE = re.compile(
    r"<(p|div|h[1-6]|span|br|strong|em|table|ul|ol|li|section|article)\b",
    re.IGNORECASE,
)
_BLOCK_CLOSE = re.compile(r"</(p|div|h[1-6]|li|tr|section|article)\s*>", re.IGNORECASE)
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)


def looks_like_html_fragment(text: str) -> bool:
    """True if content starts like an HTML snippet (not Markdown source)."""
    if not text:
        return False
    head = text.lstrip()[:12000]
    if not head.startswith("<"):
        return False
    return bool(_HTML_TAG_PROBE.search(head))


def html_fragment_to_plain_text(fragment: str) -> str:
    """Strip tags conservatively; preserve some structure from block closings and <br>."""
    if not fragment:
        return ""
    s = fragment
    s = _BR.sub("\n", s)
    s = _BLOCK_CLOSE.sub("\n\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html_module.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()
