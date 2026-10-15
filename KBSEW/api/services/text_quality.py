# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Heuristics to strip PDF/Tika extraction noise and keep readable RAG chunks.
# Invariants:
# - Applied at ingest (before embed) and at search (before returning top-k).
# - Soft hyphens, hyphen+newline, OCR spaced-letter runs, and OCR line-wrap
#   mid-word splits are normalized; residual density can fail the ingest gate.
# - Source-code drivers use profile=source_code (skip OCR density gates).
# Related:
# - api/services/chunking.py
# - api/services/search_service.py
# - api/services/ingestion_service.py
# ---

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)

IngestQualityProfile = Literal["document", "source_code"]
_CODE_DRIVER_TYPES = frozenset({"code_python", "code_typescript"})


def ingest_quality_profile_for_driver(driver_type: str | None) -> IngestQualityProfile:
    """OCR density gates apply to PDF/markdown; source code uses snake_case identifiers."""

    if str(driver_type or "").strip() in _CODE_DRIVER_TYPES:
        return "source_code"
    return "document"

_PDF_META_MARKERS = re.compile(
    r"/(?:SKY|BGR|Length|Type|Filter|Subtype|Font|Parent|Kids|Contents)\b|"
    r"<FEFF|003[dD]043[0-9a-fA-F]{4}|0064006[56]|00410064006[Ff]|"
    r"Adobe Reader|Acrobat Distiller",
    re.IGNORECASE,
)
_HEX_RUN = re.compile(r"(?:[0-9a-fA-F]{4}){10,}")
_LETTERS = re.compile(r"[\u0400-\u04FFa-zA-Z]")
_HEX_CHARS = re.compile(r"[0-9a-fA-F]")
# PDF line-wrap: "brand-\ning" → "branding"
_HYPHEN_NEWLINE_BREAK = re.compile(r"(?<=\w)-\s*\n\s*(?=\w)")
_SOFT_HYPHEN = "\u00ad"
_TOKEN_RE = re.compile(r"[\w\u0400-\u04FF]{3,}", re.UNICODE)
# OCR letter-spacing: "С т р а н и ц а" → "Страница"
_SPACED_LETTER_RUN = re.compile(
    r"(?<![\w\u0400-\u04FF])(?:[\u0400-\u04FFa-zA-Z]\s+){3,}[\u0400-\u04FFa-zA-Z]"
    r"(?![\w\u0400-\u04FF])"
)
# Any letter-token pair split by a single space (candidates for OCR line-wrap residue).
_OCR_LINEWRAP_SPLIT = re.compile(r"(?P<left>[\u0400-\u04FFa-zA-Z]{2,}) (?P<right>[\u0400-\u04FFa-zA-Z]{1,20})\b")
# Genitive/adjective/noun endings — left side is likely a complete word, not OCR stem.
_COMPLETE_LEFT_WORD_END = re.compile(
    r"(?:ого|его|ому|ему|ыми|ами|ями|ая|ое|ые|ие|ия|ии|ой|ый|ий|ою|ею|"
    r"ах|ях|ом|ем|ам|ям|ов|ев|ей|ий|ться|тся|ешь|ите|ать|ять)$",
    re.IGNORECASE,
)
_VOWELS_CYR = frozenset("аеёиоуыэюяaeiouy")
# Closed-class / common short words — never glue across these (either side).
_NEVER_GLUE = frozenset(
    {
        "в",
        "во",
        "на",
        "из",
        "и",
        "к",
        "ко",
        "с",
        "со",
        "у",
        "о",
        "об",
        "по",
        "за",
        "от",
        "до",
        "не",
        "но",
        "то",
        "же",
        "бы",
        "ли",
        "для",
        "при",
        "про",
        "это",
        "как",
        "его",
        "ее",
        "её",
        "их",
        "мы",
        "вы",
        "он",
        "она",
        "они",
        "эта",
        "эти",
        "этой",
        "этом",
        "мир",
        "мире",
        "или",
        "все",
        "всё",
        "уже",
        "еще",
        "ещё",
        "так",
        "там",
        "тут",
        "чем",
        "что",
        "кто",
        "где",
        "под",
        "над",
        "без",
        "лет",
        "год",
        "года",
        "годы",
        "дни",
        "день",
        "раз",
        "два",
        "три",
        "там",
        "тут",
        "при",
        "между",
        "через",
        "перед",
        "после",
        "очень",
        "также",
        "только",
        "можно",
        "нужно",
        "если",
        "когда",
        "чтобы",
        "and",
        "the",
        "of",
        "to",
        "in",
        "on",
        "for",
        "as",
        "is",
        "or",
        "by",
        "an",
        "a",
    }
)

# Near-duplicate suppression defaults (search post-filter).
_NEAR_DUP_JACCARD = 0.82
_NEAR_DUP_PREFIX_LEN = 160
_NEAR_DUP_PREFIX_COMPARE = 80

# Ingest quality gate — residual OCR damage after normalize must stay low.
_MIN_INGEST_READABLE_RATIO = 0.85
_MAX_SPACED_LETTER_CHUNK_RATIO = 0.05
_MAX_MIDWORD_BREAK_CHUNK_RATIO = 0.08
_MAX_OCR_BREAKS_PER_100_TOKENS = 2.5


def collapse_spaced_letter_runs(text: str) -> str:
    """Collapse OCR runs of single letters separated by spaces."""

    def _join(match: re.Match[str]) -> str:
        return match.group(0).replace(" ", "")

    return _SPACED_LETTER_RUN.sub(_join, text)


def _should_glue_ocr_parts(left: str, right: str) -> bool:
    """True when the space is likely PDF/OCR hyphenation residue, not a real word break."""

    lf = left.casefold()
    rf = right.casefold()
    if lf in _NEVER_GLUE or rf in _NEVER_GLUE:
        return False
    left_len = len(left)
    right_len = len(right)
    # Do not glue when left already looks like a finished Russian word.
    if left_len >= 6 and _COMPLETE_LEFT_WORD_END.search(lf):
        return False
    # Long stem + short suffix: "индивидуальнос ти", "необходи мо"
    if left_len >= 8 and 1 <= right_len <= 3:
        return True
    # Medium stem + short continuation: "определ яющим"
    if left_len >= 7 and 2 <= right_len <= 5:
        return True
    # Very short left OCR fragment: "ха рактеристикой", "наи более"
    if 2 <= left_len <= 3 and 2 <= right_len <= 20:
        return True
    # 4-letter incomplete prefix: "кото рый", "куль туры", "руко водителей"
    # Avoid gluing real words like "знак мастера" (consonant-final + long right).
    if left_len == 4 and 2 <= right_len <= 12:
        if right_len <= 5:
            return True
        if left[-1].casefold() in _VOWELS_CYR:
            return True
        return False
    # 5-letter prefix + short suffix: "задав шись"
    if left_len == 5 and 2 <= right_len <= 6:
        return True
    return False


def _looks_like_residual_ocr_split(left: str, right: str) -> bool:
    """Residual OCR signal after normalize (unglued damage, not normal word pairs)."""

    lf = left.casefold()
    rf = right.casefold()
    if lf in _NEVER_GLUE or rf in _NEVER_GLUE:
        return False
    if _should_glue_ocr_parts(left, right):
        return True
    left_len = len(left)
    right_len = len(right)
    # Orphan soft-sign / short-i moved to the next token: "управленчески йконтур"
    if right_len >= 2 and rf[0] in "йьъ" and left_len >= 6:
        return True
    # Short fragment still present after normalize.
    if 2 <= left_len <= 3 and right_len >= 5:
        return True
    return False


def ocr_linewrap_break_count(text: str) -> int:
    """Count residual OCR line-wrap spaces (broader than glue predicate)."""

    hits = 0
    for match in _OCR_LINEWRAP_SPLIT.finditer(text or ""):
        if _looks_like_residual_ocr_split(match.group("left"), match.group("right")):
            hits += 1
    return hits


def glue_ocr_midword_breaks(text: str) -> str:
    """Join OCR mid-word spaces (multi-pass for overlapping splits)."""

    def _repl(match: re.Match[str]) -> str:
        left = match.group("left")
        right = match.group("right")
        if _should_glue_ocr_parts(left, right):
            return left + right
        return match.group(0)

    current = text or ""
    for _ in range(4):
        nxt = _OCR_LINEWRAP_SPLIT.sub(_repl, current)
        if nxt == current:
            break
        current = nxt
    return current


def normalize_readable_text(text: str) -> str:
    """Join hyphenated line-breaks, strip soft hyphens, fix OCR spacing, collapse WS."""
    if not text:
        return ""
    joined = _HYPHEN_NEWLINE_BREAK.sub("", text)
    joined = joined.replace(_SOFT_HYPHEN, "")
    joined = collapse_spaced_letter_runs(joined)
    joined = glue_ocr_midword_breaks(joined)
    return " ".join(joined.split()).strip()


def clean_pdf_extracted_text(text: str) -> str:
    """Drop lines dominated by PDF object streams / UTF-16 hex before chunking."""
    # Fix soft hyphens / hyphen+newline before line-oriented noise filtering.
    text = _HYPHEN_NEWLINE_BREAK.sub("", text)
    text = text.replace(_SOFT_HYPHEN, "")
    kept: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if _is_noise_line(line):
            continue
        kept.append(line)
    return normalize_readable_text(" ".join(kept))


def _is_noise_line(line: str) -> bool:
    if _PDF_META_MARKERS.search(line):
        return True
    if _HEX_RUN.search(line):
        return True
    letters = len(_LETTERS.findall(line))
    if len(line) >= 60 and letters / len(line) < 0.35:
        return True
    hex_count = len(_HEX_CHARS.findall(line))
    if len(line) >= 80 and hex_count / len(line) > 0.45:
        return True
    return False


def spaced_letter_hit_count(text: str) -> int:
    return len(_SPACED_LETTER_RUN.findall(text or ""))


def midword_break_hit_count(text: str) -> int:
    """Count OCR line-wrap residue spaces (same predicate as glue)."""

    return ocr_linewrap_break_count(text)


def is_readable_chunk(
    text: str,
    *,
    min_len: int = 80,
    min_letters: int = 40,
    min_letter_ratio: float = 0.52,
    max_hex_ratio: float = 0.32,
    min_spaces: int = 4,
) -> bool:
    normalized = normalize_readable_text(text)
    if len(normalized) < min_len:
        return False
    if _PDF_META_MARKERS.search(normalized):
        return False
    if _HEX_RUN.search(normalized):
        return False
    if spaced_letter_hit_count(normalized) > 0:
        return False
    # Two+ residual OCR line-wrap breaks → not fit for RAG.
    if ocr_linewrap_break_count(normalized) >= 2:
        return False
    letters = len(_LETTERS.findall(normalized))
    if letters < min_letters:
        return False
    if letters / len(normalized) < min_letter_ratio:
        return False
    if len(_HEX_CHARS.findall(normalized)) / len(normalized) > max_hex_ratio:
        return False
    return normalized.count(" ") >= min_spaces


@dataclass(frozen=True)
class ChunkSetQuality:
    total: int
    readable: int
    spaced_letter_chunks: int
    midword_break_chunks: int
    ocr_breaks_total: int
    token_count: int

    @property
    def readable_ratio(self) -> float:
        if self.total <= 0:
            return 0.0
        return self.readable / self.total

    @property
    def spaced_letter_ratio(self) -> float:
        if self.total <= 0:
            return 0.0
        return self.spaced_letter_chunks / self.total

    @property
    def midword_break_ratio(self) -> float:
        if self.total <= 0:
            return 0.0
        return self.midword_break_chunks / self.total

    @property
    def ocr_breaks_per_100_tokens(self) -> float:
        if self.token_count <= 0:
            return 0.0 if self.ocr_breaks_total == 0 else 999.0
        return (100.0 * self.ocr_breaks_total) / float(self.token_count)


def assess_chunk_set_quality(chunks: list[str]) -> ChunkSetQuality:
    """Score residual OCR damage after normalize (fail-closed ingest gate)."""

    total = len(chunks)
    readable = 0
    spaced = 0
    midword = 0
    ocr_breaks = 0
    tokens = 0
    for chunk in chunks:
        raw = chunk or ""
        normalized = normalize_readable_text(raw)
        tokens += len(_TOKEN_RE.findall(normalized))
        residual_breaks = ocr_linewrap_break_count(normalized)
        ocr_breaks += residual_breaks
        if spaced_letter_hit_count(raw) > 0 or spaced_letter_hit_count(normalized) > 0:
            spaced += 1
        if residual_breaks > 0:
            midword += 1
        if is_readable_chunk(raw):
            readable += 1
    return ChunkSetQuality(
        total=total,
        readable=readable,
        spaced_letter_chunks=spaced,
        midword_break_chunks=midword,
        ocr_breaks_total=ocr_breaks,
        token_count=tokens,
    )


def assert_chunks_ingest_quality(
    chunks: list[str],
    *,
    profile: IngestQualityProfile = "document",
) -> ChunkSetQuality:
    """Raise ValueError when chunk set is too noisy to index (fail-closed).

    ``profile=source_code`` skips OCR mid-word / spaced-letter density gates —
    identifiers like ``mcp_host_enabled`` are not PDF line-wrap damage.
    """

    report = assess_chunk_set_quality(chunks)
    if report.total < 1:
        raise ValueError("Ingest quality reject: zero chunks")
    if profile == "source_code":
        # Source identifiers (snake_case) trip OCR mid-word heuristics; do not use
        # PDF is_readable_chunk / spaced-letter / midword density gates.
        nonempty = 0
        for chunk in chunks:
            raw = str(chunk or "").strip()
            if len(raw) < 8:
                continue
            if len(_LETTERS.findall(raw)) >= 4:
                nonempty += 1
        if nonempty < 1:
            logger.warning(
                "[STEP] kbsew_ingest_quality_reject profile=source_code reason=no_source_text total=%s",
                report.total,
            )
            raise ValueError("Ingest quality reject: source_code profile has no source text")
        return report
    if report.readable_ratio + 1e-9 < _MIN_INGEST_READABLE_RATIO:
        logger.warning(
            "[STEP] kbsew_ingest_quality_reject reason=readable_ratio readable=%s total=%s ratio=%.3f",
            report.readable,
            report.total,
            report.readable_ratio,
        )
        raise ValueError(
            f"Ingest quality reject: readable_ratio={report.readable_ratio:.3f} < {_MIN_INGEST_READABLE_RATIO}"
        )
    if report.spaced_letter_ratio > _MAX_SPACED_LETTER_CHUNK_RATIO:
        logger.warning(
            "[STEP] kbsew_ingest_quality_reject reason=spaced_letters hits=%s total=%s ratio=%.3f",
            report.spaced_letter_chunks,
            report.total,
            report.spaced_letter_ratio,
        )
        raise ValueError(
            f"Ingest quality reject: spaced_letter_ratio={report.spaced_letter_ratio:.3f} "
            f"> {_MAX_SPACED_LETTER_CHUNK_RATIO}"
        )
    if report.midword_break_ratio > _MAX_MIDWORD_BREAK_CHUNK_RATIO:
        logger.warning(
            "[STEP] kbsew_ingest_quality_reject reason=midword_breaks hits=%s total=%s ratio=%.3f",
            report.midword_break_chunks,
            report.total,
            report.midword_break_ratio,
        )
        raise ValueError(
            f"Ingest quality reject: midword_break_ratio={report.midword_break_ratio:.3f} "
            f"> {_MAX_MIDWORD_BREAK_CHUNK_RATIO}"
        )
    if report.ocr_breaks_per_100_tokens > _MAX_OCR_BREAKS_PER_100_TOKENS:
        logger.warning(
            "[STEP] kbsew_ingest_quality_reject reason=ocr_breaks_per_100_tokens breaks=%s tokens=%s rate=%.3f",
            report.ocr_breaks_total,
            report.token_count,
            report.ocr_breaks_per_100_tokens,
        )
        raise ValueError(
            f"Ingest quality reject: ocr_breaks_per_100_tokens="
            f"{report.ocr_breaks_per_100_tokens:.3f} > {_MAX_OCR_BREAKS_PER_100_TOKENS}"
        )
    return report


def filter_readable_chunks(chunks: list[str], limit: int) -> list[str]:
    out: list[str] = []
    for chunk in chunks:
        normalized = normalize_readable_text(chunk)
        if not is_readable_chunk(normalized):
            continue
        out.append(normalized)
        if len(out) >= limit:
            break
    return out


def _token_set(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = len(a | b)
    if union == 0:
        return 0.0
    return len(a & b) / union


def suppress_near_duplicate_chunks(
    chunks: list[str],
    *,
    jaccard_threshold: float = _NEAR_DUP_JACCARD,
) -> list[str]:
    """Drop near-identical snippets after retrieval ranking (order preserved).

    Uses Jaccard over 3+ letter tokens and normalized prefix similarity.
    Logs ``[STEP] kbsew_search_dedupe_drop`` at debug when any drop occurs.
    """
    kept: list[str] = []
    kept_tokens: list[set[str]] = []
    kept_prefixes: list[str] = []
    dropped = 0

    for chunk in chunks:
        normalized = normalize_readable_text(chunk)
        if not normalized:
            dropped += 1
            continue
        prefix = normalized.lower()[:_NEAR_DUP_PREFIX_LEN]
        tokens = _token_set(normalized)
        is_dup = False
        for prev_tokens, prev_prefix in zip(kept_tokens, kept_prefixes, strict=True):
            if prefix and prev_prefix:
                a = prefix[:_NEAR_DUP_PREFIX_COMPARE]
                b = prev_prefix[:_NEAR_DUP_PREFIX_COMPARE]
                if a and b and (a.startswith(b) or b.startswith(a)):
                    is_dup = True
                    break
            if _jaccard(tokens, prev_tokens) >= jaccard_threshold:
                is_dup = True
                break
        if is_dup:
            dropped += 1
            continue
        kept.append(normalized)
        kept_tokens.append(tokens)
        kept_prefixes.append(prefix)

    if dropped:
        logger.debug(
            "[STEP] kbsew_search_dedupe_drop count=%s kept=%s",
            dropped,
            len(kept),
        )
    return kept


def finalize_search_chunks(chunks: list[str], limit: int) -> list[str]:
    """Readable filter → near-duplicate suppress → top_k (search response path)."""
    if limit <= 0:
        return []
    # Over-collect so dedupe drops can still fill ``limit`` when possible.
    candidate_cap = min(len(chunks), max(limit * 4, limit))
    readable = filter_readable_chunks(chunks, candidate_cap)
    return suppress_near_duplicate_chunks(readable)[:limit]
