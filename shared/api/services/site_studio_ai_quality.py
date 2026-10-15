# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Quality guardrails for Site Studio AI-filled content before it is applied to runtime sites.
# Keeps generated blocks from silently applying placeholders, wrong-template residue, or oversized copy.
# Invariants:
# - Hard findings block apply for the affected block; soft findings remain visible in reports.
# - Validator is pure and can run from HTTP routes, ImperorG, tests, or future workers.
# Related:
# - api/services/site_studio_ai_service.py
# - api/services/imperorg_service.py
# - documentation/product/SITE-STUDIO.md
# ---
from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass
from typing import Any

_ELLIPSIS_RE = re.compile(r"^(?:\.{2,}|…+|\s*)$")
_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
_LATIN_RE = re.compile(r"[A-Za-z]")
_BOILERPLATE_RE = re.compile(r"\b(lorem ipsum|your brand|ваш бренд|название бренда)\b", re.IGNORECASE)
_OLENTI_DEMO_TERMS = (
    "olenti",
    "ollenti",
    "оленти",
    "олленти",
    "ольга бутенко",
    "парфюмер",
    "аромат",
    "духи",
)
_PERFUME_ALLOWED_TERMS = ("парф", "аромат", "духи", "perfume", "fragrance", "scent")


@dataclass(frozen=True, slots=True)
class SiteStudioQualityFinding:
    code: str
    severity: str
    message: str
    page: str | None = None
    section: str | None = None
    key: str | None = None
    value_preview: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {key: value for key, value in asdict(self).items() if value is not None}


def _identity(block: Mapping[str, Any]) -> tuple[str | None, str | None, str | None]:
    return (
        str(block.get("page") or "").strip() or None,
        str(block.get("section") or "").strip() or None,
        str(block.get("key") or "").strip() or None,
    )


def _finding(
    block: Mapping[str, Any],
    *,
    code: str,
    severity: str,
    message: str,
    value: str | None = None,
) -> SiteStudioQualityFinding:
    page, section, key = _identity(block)
    preview = " ".join(str(value or block.get("value") or "").split())[:120] or None
    return SiteStudioQualityFinding(
        code=code,
        severity=severity,
        message=message,
        page=page,
        section=section,
        key=key,
        value_preview=preview,
    )


def _topic_allows_perfume_terms(*values: str) -> bool:
    combined = " ".join(values).lower()
    return any(term in combined for term in _PERFUME_ALLOWED_TERMS)


def validate_site_studio_content_blocks(
    blocks: Iterable[Mapping[str, Any]],
    *,
    site_title: str = "",
    site_topic: str = "",
    required_identities: Iterable[tuple[str, str, str]] | None = None,
    expected_language: str = "ru",
) -> list[dict[str, Any]]:
    findings: list[SiteStudioQualityFinding] = []
    seen_identities: set[tuple[str, str, str]] = set()
    normalized_title = site_title.strip().lower()
    perfume_terms_allowed = _topic_allows_perfume_terms(site_title, site_topic)

    for block in blocks:
        page, section, key = _identity(block)
        if page and section and key:
            seen_identities.add((page, section, key))
        value = str(block.get("value") or "").strip()
        max_length = block.get("maxLength") or block.get("max_length")

        if not value:
            findings.append(
                _finding(block, code="empty_value", severity="hard", message="Generated block value is empty.")
            )
            continue
        if _ELLIPSIS_RE.match(value):
            findings.append(
                _finding(
                    block,
                    code="placeholder_ellipsis",
                    severity="hard",
                    message="Generated block contains only ellipsis/placeholder text.",
                    value=value,
                )
            )
        if _BOILERPLATE_RE.search(value):
            findings.append(
                _finding(
                    block,
                    code="boilerplate_placeholder",
                    severity="hard",
                    message="Generated block still contains generic placeholder wording.",
                    value=value,
                )
            )
        try:
            max_length_int = int(max_length)
        except TypeError, ValueError:
            max_length_int = 0
        if max_length_int > 0 and len(value) > max_length_int:
            findings.append(
                _finding(
                    block,
                    code="max_length_overflow",
                    severity="hard",
                    message=f"Generated block is {len(value)} chars, maxLength is {max_length_int}.",
                    value=value,
                )
            )
        lower_value = value.lower()
        if normalized_title and normalized_title not in {"brand", "site"}:
            for term in _OLENTI_DEMO_TERMS:
                if term in lower_value and term not in normalized_title and not perfume_terms_allowed:
                    findings.append(
                        _finding(
                            block,
                            code="template_demo_drift",
                            severity="hard",
                            message="Generated block contains Olenti/perfume demo residue outside perfume context.",
                            value=value,
                        )
                    )
                    break
        if (
            expected_language == "ru"
            and len(value) >= 80
            and _LATIN_RE.search(value)
            and not _CYRILLIC_RE.search(value)
        ):
            findings.append(
                _finding(
                    block,
                    code="language_mismatch",
                    severity="soft",
                    message="Generated block looks non-Russian while Russian content was expected.",
                    value=value,
                )
            )

    if required_identities:
        for page, section, key in required_identities:
            if (page, section, key) not in seen_identities:
                findings.append(
                    SiteStudioQualityFinding(
                        code="missing_required_block",
                        severity="hard",
                        message="Required block was not generated.",
                        page=page,
                        section=section,
                        key=key,
                    )
                )

    return [finding.to_dict() for finding in findings]


def has_hard_quality_findings(findings: Iterable[Mapping[str, Any]]) -> bool:
    return any(str(finding.get("severity") or "") == "hard" for finding in findings)
