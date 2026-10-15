# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared line-window + symbol-header chunking for source-code KBSEW drivers.
# Lives under drivers/ (not api.services) to avoid services↔registry circular imports.
# Invariants:
# - Chunks include path/lang/symbol/start_line/end_line in metadata for MCP citations.
# - No tree-sitter dependency in v1 (regex symbol headers).
# Related:
# - api/drivers/code_python.py
# - api/drivers/code_typescript.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import re
from dataclasses import dataclass

_PY_SYMBOL = re.compile(
    r"^(?P<indent>\s*)(?:async\s+)?(?:def|class)\s+(?P<name>[A-Za-z_][\w]*)",
)
_TS_SYMBOL = re.compile(
    r"^(?P<indent>\s*)(?:"
    r"export\s+(?:async\s+)?(?:function|class|const|type|interface)\s+(?P<name>[A-Za-z_$][\w$]*)|"
    r"(?:async\s+)?function\s+(?P<fname>[A-Za-z_$][\w$]*)|"
    r"class\s+(?P<cname>[A-Za-z_$][\w$]*)|"
    r"(?:export\s+)?(?:const|let|var)\s+(?P<vname>[A-Za-z_$][\w$]*)\s*="
    r")",
)


@dataclass(frozen=True, slots=True)
class CodeChunkPart:
    text: str
    symbol: str | None
    start_line: int
    end_line: int


def decode_source_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _symbol_for_line(line: str, *, lang: str) -> str | None:
    if lang == "python":
        m = _PY_SYMBOL.match(line)
        return m.group("name") if m else None
    m = _TS_SYMBOL.match(line)
    if not m:
        return None
    return m.group("name") or m.group("fname") or m.group("cname") or m.group("vname")


def chunk_source_lines(
    text: str,
    *,
    path: str,
    lang: str,
    max_lines: int = 80,
    overlap_lines: int = 8,
) -> list[CodeChunkPart]:
    """Split source into overlapping line windows with optional symbol headers."""
    lines = text.splitlines()
    if not lines:
        return []
    max_lines = max(10, int(max_lines))
    overlap_lines = max(0, min(overlap_lines, max_lines - 1))
    parts: list[CodeChunkPart] = []
    start = 0
    n = len(lines)
    while start < n:
        end = min(n, start + max_lines)
        window = lines[start:end]
        symbol: str | None = None
        for line in window:
            symbol = _symbol_for_line(line, lang=lang)
            if symbol:
                break
        header = f"// file: {path} lang: {lang}"
        if symbol:
            header += f" symbol: {symbol}"
        header += f" lines: {start + 1}-{end}\n"
        body = "\n".join(window).strip()
        if body:
            parts.append(
                CodeChunkPart(
                    text=f"{header}{body}",
                    symbol=symbol,
                    start_line=start + 1,
                    end_line=end,
                )
            )
        if end >= n:
            break
        nxt = max(start + 1, end - overlap_lines)
        if nxt <= start:
            nxt = end
        start = nxt
    return parts
