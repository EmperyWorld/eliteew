# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Weight-based strategic intent and task-structure scoring for companion intake.
# Invariants:
# - Explicit /agent prefix is a hard override for agentic_mandatory classification.
# Related:
# - api/ewa_platform/agentic/intake/gate.py
# ---

from __future__ import annotations

import re
from dataclasses import dataclass

_AGENTIC_START_PREFIX = "/agent "
_AUTO_START_STRUCTURE_RE = re.compile(r"(?im)(?:^|\n)\s*(?:\d+[\).]|[АБВГДЕРСТABCD][\).])\s+")
_STRATEGIC_LEXICON: tuple[str, ...] = (
    "дорожн",
    "исслед",
    "рынок",
    "аудит",
    "стратег",
    "гипотез",
    "longread",
    "лонгрид",
    "презентац",
    "roadmap",
    "stakeholder",
    "стейкхолдер",
    "конкурент",
    "вуз",
    "университет",
    "кибер",
    "юрид",
    "соглас",
    "миссия",
    "партнер",
    "партнёр",
)
_ARTIFACT_NOUNS: tuple[str, ...] = ("документ", "презентац", "план", "карта", "roadmap", "файл")
_TIME_BOX_RE = re.compile(r"(?i)(\d+)\s*ч\b|в течение\s+\d+|work session")
_IDENTITY_RE = re.compile(r"(?im)(?:знакомимся\s+я\s*[—\-]\s*(\w+)|меня\s+зовут\s+(\w+)|^я[,\s]+(\w+)[,\s])")
_FILENAME_RE = re.compile(r"(?i)\b[\w\-]+\.(?:md|txt|html?)\b")
_FILE_VERB_RE = re.compile(
    r"(?i)(?:перепиши|rewrite|замени\s+содержимое|полностью\s+перепиши|edit\s+file|replace\s+content)"
)
_SINGLE_FILE_MICRO_MAX_CHARS = 400


@dataclass(frozen=True, slots=True)
class StrategicScore:
    explicit_agent_prefix: bool
    task_structure_score: int
    strategic_intent_score: int
    multi_artifact_score: int
    time_box_score: int
    identity_score: int

    @property
    def total_strategic_weight(self) -> int:
        return self.strategic_intent_score + self.multi_artifact_score + self.time_box_score + self.identity_score


def user_line_has_explicit_agent_prefix(user_line: str) -> bool:
    line = str(user_line or "").strip()
    return line.lower().startswith(_AGENTIC_START_PREFIX) or line.lower().startswith("agentic:")


def score_strategic_intent(user_line: str) -> StrategicScore:
    line = str(user_line or "").strip()
    lower = line.lower()
    explicit = user_line_has_explicit_agent_prefix(line)

    structure_hits = len(_AUTO_START_STRUCTURE_RE.findall(line))
    task_structure_score = structure_hits * 3

    lexicon_hits = sum(1 for token in _STRATEGIC_LEXICON if token in lower)
    strategic_intent_score = min(lexicon_hits, 8)

    artifact_hits = sum(1 for noun in _ARTIFACT_NOUNS if noun in lower)
    multi_artifact_score = 4 if artifact_hits >= 2 else 0

    time_box_score = 2 if _TIME_BOX_RE.search(line) else 0

    identity_score = 2 if _IDENTITY_RE.search(line) else 0

    return StrategicScore(
        explicit_agent_prefix=explicit,
        task_structure_score=task_structure_score,
        strategic_intent_score=strategic_intent_score,
        multi_artifact_score=multi_artifact_score,
        time_box_score=time_box_score,
        identity_score=identity_score,
    )


def is_agentic_mandatory_by_score(score: StrategicScore) -> bool:
    if score.explicit_agent_prefix:
        return True
    if score.task_structure_score >= 6:
        return True
    return score.total_strategic_weight >= 8


def is_single_file_micro_intent(user_line: str) -> bool:
    """Narrow deterministic file_rewrite path — one file, one verb, no mission structure."""

    line = str(user_line or "").strip()
    if not line or len(line) > _SINGLE_FILE_MICRO_MAX_CHARS:
        return False
    if user_line_has_explicit_agent_prefix(line):
        return False
    if len(_AUTO_START_STRUCTURE_RE.findall(line)) > 1:
        return False
    if not _FILENAME_RE.search(line):
        return False
    if not _FILE_VERB_RE.search(line):
        return False
    score = score_strategic_intent(line)
    return not is_agentic_mandatory_by_score(score)
