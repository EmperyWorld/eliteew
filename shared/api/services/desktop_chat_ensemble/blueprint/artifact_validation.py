# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Deterministic Desktop AI Chat artifact validation, evidence append, and sanitize.
# Extracted from artifact_finalizer to keep the finalize orchestrator under LOC budget.
# Invariants:
# - Brand allowlist ignores derived_ai_artifact / authority=derived titles.
# - code_architecture_audit requires inventory statuses, domain lock, Keep/Change/Kill.
# - Wave 2: ungrounded research claims and unused W* registry → Evidence / violations.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Deterministic validation and sanitize for Desktop AI Chat team artifacts."""

from __future__ import annotations

import re
from typing import Any

_CITATION_RE = re.compile(r"【([CPDW][1-9]\d{0,3})】")
_FENCE_RE = re.compile(r"(?m)^\s*```")
_HEADING_RE = re.compile(r"(?m)^##\s+(.+?)\s*$")
_INTERNAL_MARKER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # Dump/leak styles only — bare «RAG» / «vault» as product terms must not needs_review.
    (
        "raw_rag_marker",
        re.compile(
            r"(?i)(?:"
            r"\[\s*[^\]]{0,120}\bRAG\b|"
            r"\bRAG\s*[,:]\s*(?:фр|fragment|chunk)|"
            r"\bЧат\s*[—\-]\s*RAG"
            r")"
        ),
    ),
    (
        "raw_vault_marker",
        re.compile(
            r"(?i)(?:"
            r"\[\s*[^\]]{0,120}\bvault\b|"
            r"\bvault\s*[=:]\s*\w|"
            r"\bproject_vault\s*[=:]"
            r")"
        ),
    ),
    ("raw_fragment_marker", re.compile(r"(?i)\b(?:fragment|chunk(?:_index)?)\s*[=:№#]?\s*\d*")),
    ("raw_content_id", re.compile(r"(?i)\bcontent_id\s*[=:]")),
    ("raw_source_label", re.compile(r"(?i)\b(?:source_)?label\s*[=:]")),
    ("raw_score", re.compile(r"(?i)\bscore\s*[=:]\s*\d")),
)
_EVIDENCE_SENSITIVE_ARTIFACTS = frozenset(
    {
        "business_plan",
        "campaign_plan",
        "code_architecture_audit",
        "marketing_brief",
        "project_audit",
        "research_plan",
        "sales_onepager",
        "strategy_options",
    }
)
# Claimed web/code discovery without citation → Wave 2 honesty gate.
_UNGROUNDED_RESEARCH_CLAIM_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"нашли\s+в\s+(?:сети|интернете|веб(?:е)?|коде|документации|доках)|"
    r"найден[оаы]?\s+в\s+(?:сети|интернете|веб(?:е)?|коде)|"
    r"по\s+результатам\s+(?:поиска|web[\s-]?search)|"
    r"found\s+(?:online|on\s+the\s+web|in\s+(?:code|docs))|"
    r"according\s+to\s+(?:our\s+)?(?:web\s+)?search"
    r")"
)
_INVENTORY_EXISTS_MARKERS = (
    "exists",
    "существу",
    "уже есть",
    "уже реализован",
    "реализовано",
)
_INVENTORY_MISSING_MARKERS = (
    "missing",
    "отсутств",
    "нет в коде",
    "не найдено",
)
_INVENTORY_PARTIAL_MARKERS = (
    "partial",
    "частичн",
)
_DOMAIN_LOCK_MARKERS = (
    "execution surface",
    "desktop_ai_chat",
    "ewa_companion",
    "desktop ensemble",
    "не путать",
    "не смешивать",
    "out of scope",
    "вне scope",
)
_KEEP_MARKERS = ("keep", "оставить", "сохранить")
_CHANGE_MARKERS = ("change", "изменить", "доработать", "доделать")
_KILL_MARKERS = (
    "kill",
    "убить",
    "не строить",
    "не invent",
    "не изобретать",
    "не создавать заново",
)
_GREENFIELD_INVENT_RE = re.compile(
    r"(?i)(?:"
    r"построить\s+с\s+нуля|"
    r"создать\s+с\s+нуля|"
    r"create\s+(?:a\s+)?(?:new\s+)?(?:runtime|executor|registry)|"
    r"внедрить\s+новый\s+(?:runtime|path|слой)"
    r")"
)
_GREENFIELD_NEGATION_RE = re.compile(r"(?i)(?:\bне\b|\bнельзя\b|\bdon't\b|\bdo\s+not\b|\bdont\b)\s*$")
_WORD_RE = re.compile(r"[a-zа-яё0-9]{3,}", re.IGNORECASE)
_STOP_WORDS = frozenset(
    {
        "блок",
        "будет",
        "данных",
        "данные",
        "для",
        "если",
        "или",
        "как",
        "который",
        "может",
        "нужно",
        "проект",
        "раздел",
        "также",
        "что",
        "этого",
        "этот",
    }
)
_EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002700-\U000027bf\U0001f900-\U0001f9ff\U00002600-\U000026ff]+",
    flags=re.UNICODE,
)
_MD_DECOR_RE = re.compile(r"[*_`~]+")
_ICE_PRODUCT_RE = re.compile(
    r"(?i)\bICE\b[^\n]{0,160}?"
    r"(\d+(?:[.,]\d+)?)\s*[×x*]\s*(\d+(?:[.,]\d+)?)\s*[×x*]\s*(\d+(?:[.,]\d+)?)"
    r"\s*(?:=|→|->)\s*(\d+(?:[.,]\d+)?)"
)
_ICE_COMPONENT_RE = re.compile(
    r"(?i)\b(?:I|Impact)\s*[=:]\s*(\d+(?:[.,]\d+)?)\D{0,24}"
    r"(?:C|Confidence)\s*[=:]\s*(\d+(?:[.,]\d+)?)\D{0,24}"
    r"(?:E|Ease)\s*[=:]\s*(\d+(?:[.,]\d+)?)"
    r"(?:[^\n]{0,48}?(?:=|→|->)\s*(\d+(?:[.,]\d+)?))?"
)
_BRAND_CANDIDATE_RE = re.compile(r"\b([A-ZА-ЯЁ][A-Za-zА-Яа-яЁё]{1,}[0-9]{1,4}|[A-Z]{2,}[a-z]+[0-9]{0,4})\b")
_BRAND_SENSITIVE_ARTIFACTS = frozenset(
    {
        "business_plan",
        "campaign_plan",
        "marketing_brief",
        "sales_onepager",
        "strategy_options",
        "project_audit",
        "meeting_notes",
        "team_response",
        "research_plan",
    }
)
_PLACEHOLDER_MARKER_RE = re.compile(
    r"\[(?:\s*(?:Текущая\s+дата|Current\s+date|Дата|Date|TODO|"
    r"Расч[её]т\s+в\s+процессе|уточнить\s+позже|n/?a)\s*)\]",
    re.IGNORECASE,
)
_ICE_BARE_SCORE_RE = re.compile(r"(?i)\bICE\b\s*[:=—–-]?\s*(\d+(?:[.,]\d+)?)\b")
_ICE_FORMULA_NEAR_RE = re.compile(r"(?i)(?:\d+(?:[.,]\d+)?\s*[×x*]\s*){2}\d+(?:[.,]\d+)?")
_DERIVED_SOURCE_KINDS = frozenset({"derived_ai_artifact", "derived"})
_DERIVED_AUTHORITIES = frozenset({"derived", "ai", "model"})
_BRAND_ALLOWLIST = frozenset(
    {
        "ice",
        "jtbd",
        "kpi",
        "roi",
        "b2b",
        "b2c",
        "saas",
        "mvp",
        "okrs",
        "okr",
        "crm",
        "seo",
        "cpa",
        "cpc",
        "ltv",
        "arpu",
        "eliteew",
        "empery",
        "brand",
        "tbd",
    }
)


def _normalized_heading(value: str) -> str:
    text = _EMOJI_RE.sub(" ", value or "")
    text = _MD_DECOR_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip().rstrip(":").casefold()


def _heading_matches_required(required: str, headings: set[str]) -> bool:
    norm = _normalized_heading(required)
    if not norm:
        return True
    if norm in headings:
        return True
    for heading in headings:
        if len(norm) >= 8 and (norm in heading or heading in norm):
            return True
        req_tokens = _meaningful_tokens(norm)
        head_tokens = _meaningful_tokens(heading)
        if len(req_tokens) >= 2 and req_tokens.issubset(head_tokens):
            return True
    return False


def _parse_ice_number(raw: str) -> float:
    return float(raw.replace(",", "."))


def _ice_arithmetic_violations(text: str) -> list[str]:
    """Flag ICE rows where I×C×E does not equal the stated score, or score lacks formula."""
    violations: list[str] = []
    seen_rows: set[tuple[float, float, float, float]] = set()
    found_formula = False

    def _check(i_raw: str, c_raw: str, e_raw: str, score_raw: str | None) -> None:
        nonlocal found_formula
        found_formula = True
        try:
            i_val = _parse_ice_number(i_raw)
            c_val = _parse_ice_number(c_raw)
            e_val = _parse_ice_number(e_raw)
        except ValueError:
            return
        if score_raw is None:
            return
        try:
            score = _parse_ice_number(score_raw)
        except ValueError:
            return
        key = (i_val, c_val, e_val, score)
        if key in seen_rows:
            return
        seen_rows.add(key)
        expected = i_val * c_val * e_val
        if abs(expected - score) > 0.51:
            violations.append(f"ice_arithmetic_mismatch:{i_raw}x{c_raw}x{e_raw}!={score_raw}")

    for match in _ICE_PRODUCT_RE.finditer(text):
        _check(match.group(1), match.group(2), match.group(3), match.group(4))
    for match in _ICE_COMPONENT_RE.finditer(text):
        _check(match.group(1), match.group(2), match.group(3), match.group(4))

    if not found_formula:
        for match in _ICE_BARE_SCORE_RE.finditer(text):
            line_start = text.rfind("\n", 0, match.start()) + 1
            line_end = text.find("\n", match.end())
            if line_end < 0:
                line_end = len(text)
            line = text[line_start:line_end]
            if _ICE_FORMULA_NEAR_RE.search(line):
                continue
            violations.append(f"ice_incomplete:{match.group(1)}")
            break
    return violations


def _placeholder_marker_violations(text: str) -> list[str]:
    hits = _PLACEHOLDER_MARKER_RE.findall(text or "")
    if not hits:
        return []
    sample = re.sub(r"\s+", " ", hits[0]).strip()[:48]
    return [f"placeholder_marker:{sample}"]


def _allowed_brand_corpus(
    user_request: str,
    source_registry: list[dict[str, Any]],
) -> str:
    """Allow brands only from the user request and non-derived evidence sources."""
    parts = [(user_request or "").casefold()]
    for row in source_registry:
        if not isinstance(row, dict):
            continue
        kind = str(row.get("kind") or "").strip().casefold()
        authority = str(row.get("authority") or "").strip().casefold()
        if kind in _DERIVED_SOURCE_KINDS or authority in _DERIVED_AUTHORITIES:
            continue
        for key in ("title", "url", "label", "citation_id"):
            val = row.get(key)
            if isinstance(val, str) and val.strip():
                parts.append(val.casefold())
    return "\n".join(parts)


def _invented_brand_tokens(
    markdown: str,
    *,
    artifact_type: str,
    user_request: str,
    source_registry: list[dict[str, Any]],
) -> list[str]:
    normalized_type = (artifact_type or "general").strip().casefold() or "general"
    if normalized_type not in _BRAND_SENSITIVE_ARTIFACTS and normalized_type != "general":
        return []
    corpus = _allowed_brand_corpus(user_request, source_registry)
    tokens: list[str] = []
    for match in _BRAND_CANDIDATE_RE.finditer(markdown or ""):
        token = match.group(1).strip()
        folded = token.casefold()
        if folded in _BRAND_ALLOWLIST:
            continue
        if not any(ch.isdigit() for ch in token):
            continue
        if folded in corpus:
            continue
        tokens.append(token)
    return list(dict.fromkeys(tokens))


def _invented_brand_violations(
    markdown: str,
    *,
    artifact_type: str,
    user_request: str,
    source_registry: list[dict[str, Any]],
) -> list[str]:
    return [
        f"invented_brand:{token}"
        for token in _invented_brand_tokens(
            markdown,
            artifact_type=artifact_type,
            user_request=user_request,
            source_registry=source_registry,
        )
    ]


def _markdown_sections(markdown: str) -> list[tuple[str, str]]:
    matches = list(_HEADING_RE.finditer(markdown))
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        sections.append((match.group(1).strip(), markdown[match.end() : end].strip()))
    return sections


def _meaningful_tokens(text: str) -> set[str]:
    return {token.casefold() for token in _WORD_RE.findall(text) if token.casefold() not in _STOP_WORDS}


def _duplicate_section_violations(markdown: str) -> list[str]:
    sections = [(heading, body) for heading, body in _markdown_sections(markdown) if len(body) >= 180]
    violations: list[str] = []
    for left_index, (left_heading, left_body) in enumerate(sections):
        left_tokens = _meaningful_tokens(left_body)
        if len(left_tokens) < 18:
            continue
        for right_heading, right_body in sections[left_index + 1 :]:
            right_tokens = _meaningful_tokens(right_body)
            if len(right_tokens) < 18:
                continue
            overlap = len(left_tokens.intersection(right_tokens)) / max(
                1,
                min(len(left_tokens), len(right_tokens)),
            )
            if overlap >= 0.65:
                violations.append(
                    f"duplicate_sections:{_normalized_heading(left_heading)}|{_normalized_heading(right_heading)}"
                )
    paragraph_owner: dict[str, str] = {}
    for heading, body in sections:
        for paragraph in re.split(r"\n\s*\n", body):
            normalized = re.sub(r"\W+", " ", paragraph.casefold()).strip()
            if len(normalized) < 140:
                continue
            previous = paragraph_owner.get(normalized)
            if previous and previous != heading:
                violations.append(f"duplicate_paragraph:{_normalized_heading(previous)}|{_normalized_heading(heading)}")
            else:
                paragraph_owner[normalized] = heading
    return violations


def _strategy_option_count(markdown: str) -> int:
    candidates = re.findall(
        r"(?im)^(?:#{2,4}\s+|[-*]\s+|\|\s*)?(?:вариант|стратегия)\s*(?:№\s*)?([1-9])\b",
        markdown,
    )
    return len(set(candidates))


def _body_without_markdown_headings(text: str) -> str:
    """Drop ATX headings so outline titles cannot satisfy vocabulary gates."""
    return "\n".join(line for line in (text or "").splitlines() if not re.match(r"^\s*#{1,6}\s+", line))


def _affirmative_greenfield_invent(text: str) -> bool:
    """True when invent-from-scratch wording is not locally negated."""
    for match in _GREENFIELD_INVENT_RE.finditer(text or ""):
        prefix = (text or "")[max(0, match.start() - 48) : match.start()]
        if _GREENFIELD_NEGATION_RE.search(prefix.rstrip()):
            continue
        return True
    return False


def _code_architecture_audit_violations(text: str) -> list[str]:
    """Deterministic inventory-before-invent + domain-lock gates for code audits."""
    body = _body_without_markdown_headings(text)
    folded = body.casefold()
    if not folded.strip():
        return ["inventory_status_missing"]

    violations: list[str] = []
    has_exists = any(m in folded for m in _INVENTORY_EXISTS_MARKERS)
    has_missing = any(m in folded for m in _INVENTORY_MISSING_MARKERS)
    has_partial = any(m in folded for m in _INVENTORY_PARTIAL_MARKERS)
    if not ((has_exists and has_missing) or (has_partial and (has_exists or has_missing))):
        violations.append("inventory_status_missing")

    if not any(m in folded for m in _DOMAIN_LOCK_MARKERS):
        violations.append("domain_surface_lock_missing")

    has_keep = any(m in folded for m in _KEEP_MARKERS)
    has_change = any(m in folded for m in _CHANGE_MARKERS)
    has_kill = any(m in folded for m in _KILL_MARKERS)
    if not (has_keep and has_change and has_kill):
        violations.append("keep_change_kill_missing")

    if _affirmative_greenfield_invent(body) and has_exists:
        violations.append("reinvents_existing")

    return violations


def validate_artifact_markdown(
    markdown: str,
    *,
    artifact_type: str,
    required_sections: list[str],
    source_registry: list[dict[str, Any]],
    user_request: str = "",
) -> list[str]:
    """Return deterministic contract violations for a candidate artifact."""
    text = (markdown or "").strip()
    if not text:
        return ["empty_artifact"]

    violations: list[str] = []
    if len(_FENCE_RE.findall(text)) % 2:
        violations.append("unclosed_fence")

    headings = {_normalized_heading(heading) for heading, _body in _markdown_sections(text)}
    for required in required_sections:
        normalized = _normalized_heading(required)
        if normalized and not _heading_matches_required(required, headings):
            violations.append(f"missing_section:{normalized}")

    for code, pattern in _INTERNAL_MARKER_PATTERNS:
        if pattern.search(text):
            violations.append(code)

    known_citations = {str(row.get("citation_id") or "").strip() for row in source_registry if isinstance(row, dict)}
    cited = set(_CITATION_RE.findall(text))
    for citation_id in sorted(cited - known_citations):
        violations.append(f"unknown_citation:{citation_id}")

    normalized_type = (artifact_type or "general").strip().casefold()
    if normalized_type == "code_architecture_audit":
        violations.extend(_code_architecture_audit_violations(text))

    if normalized_type in _EVIDENCE_SENSITIVE_ARTIFACTS:
        folded = text.casefold()
        has_fact_boundary = any(
            marker in folded
            for marker in (
                "факт",
                "подтвержден",
                "основани",
                "evidence",
            )
        )
        has_hypothesis_boundary = any(
            marker in folded
            for marker in (
                "гипотез",
                "допущен",
                "неизвест",
                "нужно добрать",
                "что проверить",
            )
        )
        if not has_fact_boundary or not has_hypothesis_boundary:
            violations.append("fact_hypothesis_boundary_missing")
        if source_registry and not cited:
            violations.append("source_citation_missing")

    if _UNGROUNDED_RESEARCH_CLAIM_RE.search(text) and not cited:
        violations.append("ungrounded_research_claim")

    web_cids = {cid for cid in known_citations if cid.startswith("W")}
    if web_cids and not (cited & web_cids):
        violations.append("web_citation_missing")

    if normalized_type == "strategy_options":
        option_count = _strategy_option_count(text)
        if option_count < 3 or option_count > 5:
            violations.append(f"strategy_option_count:{option_count}")
        if not re.search(r"(?i)\bICE\b[^\n]{0,80}(?:=|×|\*)[^\n]{0,60}\d", text):
            violations.append("ice_calculation_missing")

    violations.extend(_ice_arithmetic_violations(text))
    violations.extend(_placeholder_marker_violations(text))
    violations.extend(
        _invented_brand_violations(
            text,
            artifact_type=normalized_type,
            user_request=user_request,
            source_registry=source_registry,
        )
    )
    violations.extend(_duplicate_section_violations(text))
    return list(dict.fromkeys(violations))


def ensure_web_evidence_section(
    markdown: str,
    source_registry: list[dict[str, Any]],
    *,
    max_items: int = 12,
) -> str:
    """Append a non-invented Evidence block when web sources exist but body cites none.

    Builds lines only from registry ``title`` / ``url`` + ``【Wn】``. Does not invent facts
    or attach citations into arbitrary sentences (avoids wrong attribution).
    """
    text = (markdown or "").rstrip()
    web_rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in source_registry:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("citation_id") or "").strip()
        if not cid.startswith("W") or cid in seen:
            continue
        seen.add(cid)
        web_rows.append(row)
    if not web_rows:
        return text
    cited = set(_CITATION_RE.findall(text))
    if cited & {str(r.get("citation_id") or "").strip() for r in web_rows}:
        return text
    # Avoid duplicating an existing Evidence heading's content by appending a distinct block.
    lines = ["", "## Evidence", ""]
    for row in web_rows[: max(1, max_items)]:
        cid = str(row.get("citation_id") or "").strip()
        title = str(row.get("title") or row.get("label") or cid).strip() or cid
        url = str(row.get("url") or "").strip()
        if url:
            lines.append(f"- 【{cid}】 {title} — {url}")
        else:
            lines.append(f"- 【{cid}】 {title}")
    return f"{text}\n" + "\n".join(lines) + "\n"


def sanitize_artifact_markdown(
    markdown: str,
    *,
    source_registry: list[dict[str, Any]],
    user_request: str = "",
    artifact_type: str = "general",
    scrub_brands: bool = True,
) -> str:
    """Remove known internal leakage without inventing replacement content."""
    text = (markdown or "").strip()
    if not text:
        return ""
    text = re.sub(
        r"(?i)\[[^\]\n]{0,220}(?:\bRAG\b|\bvault\b|\bfragment\b|фр\.\s*\d+)[^\]\n]{0,220}\]",
        "",
        text,
    )
    text = re.sub(r"(?i)\b(?:content_id|chunk_index|source_label|score)\s*=\s*[^\s,;)\]]+", "", text)
    known_citations = {str(row.get("citation_id") or "").strip() for row in source_registry if isinstance(row, dict)}
    text = _CITATION_RE.sub(
        lambda match: match.group(0) if match.group(1) in known_citations else "",
        text,
    )
    # Strip editor placeholders that leak into user-visible docs.
    text = _PLACEHOLDER_MARKER_RE.sub("[уточнить]", text)
    if scrub_brands:
        for token in _invented_brand_tokens(
            text,
            artifact_type=artifact_type,
            user_request=user_request,
            source_registry=source_registry,
        ):
            text = re.sub(rf"(?<!\w){re.escape(token)}(?!\w)", "[Brand TBD]", text)
    lines: list[str] = []
    for line in text.splitlines():
        folded = line.strip().casefold()
        if folded.startswith(("контекст запроса:", "исходник:", "формат вывода:")):
            continue
        lines.append(line.rstrip())
    text = "\n".join(lines).strip()
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if len(_FENCE_RE.findall(text)) % 2:
        text = f"{text}\n```"
    return text.strip()
