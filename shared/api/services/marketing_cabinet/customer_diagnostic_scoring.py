# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Authoritative Customer Diagnostic scoring (port of FE diagnosticScoring.ts).
# Invariants:
# - Session PATCH must persist only server-computed results / module metrics.
# - Missing or empty answers → None / omit module key (same as FE).
# Related:
# - api/services/marketing_cabinet/customer_diagnostic_definition.py
# - api/routers/marketing_cabinet/customer_diagnostic.py
# ---

from __future__ import annotations

from typing import Any

from api.services.marketing_cabinet.customer_diagnostic_definition import (
    ARCHETYPE_CATALOG,
    ARCHETYPE_QUESTION_MAPPING,
    BUSINESS_AREAS,
    DIAGNOSTIC_MODULE_ORDER,
    EMOTIONS_JOURNEY_STAGES,
    SERVQUAL_DIMENSIONS,
    get_industry_benchmark,
    load_questions,
)


def score_archetype(answers: dict[str, Any] | None) -> dict[str, Any] | None:
    if not answers:
        return None
    scores: dict[str, float] = {k: 0.0 for k in ARCHETYPE_QUESTION_MAPPING}
    for archetype, question_ids in ARCHETYPE_QUESTION_MAPPING.items():
        for qid in question_ids:
            raw = answers.get(str(qid))
            if isinstance(raw, (int, float)):
                scores[archetype] = scores.get(archetype, 0.0) + float(raw)
    total = sum(scores.values())
    if total <= 0:
        return None
    percentages = {aid: int(round((s / total) * 100)) for aid, s in scores.items()}
    sorted_items = sorted(percentages.items(), key=lambda x: x[1], reverse=True)
    dominant_id, dominant_pct = sorted_items[0]
    secondary_id, secondary_pct = sorted_items[1]
    dc = ARCHETYPE_CATALOG.get(dominant_id) or {
        "name": dominant_id,
        "description": "",
    }
    s2c = ARCHETYPE_CATALOG.get(secondary_id) or {
        "name": secondary_id,
        "description": "",
    }
    return {
        "dominant": {
            "id": dominant_id,
            "percentage": dominant_pct,
            "name": dc["name"],
            "description": dc["description"],
        },
        "secondary": {
            "id": secondary_id,
            "percentage": secondary_pct,
            "name": s2c["name"],
            "description": s2c["description"],
        },
        "percentages": percentages,
    }


def score_values(answers: dict[str, Any] | None) -> dict[str, Any] | None:
    if not answers:
        return None
    value_scores: dict[str, float] = {
        "power": 0.0,
        "achievement": 0.0,
        "hedonism": 0.0,
        "stimulation": 0.0,
        "self_direction": 0.0,
        "universalism": 0.0,
        "benevolence": 0.0,
        "tradition": 0.0,
        "conformity": 0.0,
        "security": 0.0,
    }
    for answer in answers.values():
        if not isinstance(answer, dict):
            continue
        a_type = answer.get("type")
        if a_type == "scale":
            values = answer.get("values")
            if isinstance(values, dict):
                for value, score in values.items():
                    if value in value_scores and isinstance(score, (int, float)):
                        value_scores[value] += float(score)
        elif a_type == "choice":
            value = answer.get("value")
            if isinstance(value, str) and value in value_scores:
                value_scores[value] += 3.0
        elif a_type == "ranking":
            values = answer.get("values")
            if isinstance(values, dict):
                for value, rank in values.items():
                    if value in value_scores and isinstance(rank, (int, float)):
                        value_scores[value] += float(rank) * 2.0
    total_score = sum(value_scores.values())
    if total_score <= 0:
        return None
    percentages = {value: int(round((score / total_score) * 100)) for value, score in value_scores.items()}
    return {"percentages": percentages}


def score_business(
    answers: dict[str, Any] | None,
    industry: str | None = None,
) -> dict[str, Any] | None:
    if not answers:
        return None
    questions = load_questions()["business"]
    area_scores: dict[str, float] = {area: 0.0 for area in BUSINESS_AREAS}
    area_max_scores: dict[str, float] = {area: 0.0 for area in BUSINESS_AREAS}
    for q in questions:
        qid = q.get("id")
        ans = answers.get(str(qid))
        if ans is None or not isinstance(ans, (int, float)):
            continue
        area = str(q.get("area") or "")
        if area not in area_scores:
            continue
        area_scores[area] += float(ans)
        q_type = q.get("type")
        if q_type == "scale" and isinstance(q.get("scale"), dict):
            scale_max = q["scale"].get("max")
            if isinstance(scale_max, (int, float)):
                area_max_scores[area] += float(scale_max)
        elif q_type == "choice":
            area_max_scores[area] += 5.0
    area_percentages: dict[str, int] = {}
    for area in BUSINESS_AREAS:
        max_score = area_max_scores[area] or 1.0
        area_percentages[area] = int(round((area_scores[area] / max_score) * 100)) if max_score > 0 else 0
    total_health_index = int(round(sum(area_percentages.values()) / 5) if area_percentages else 0)
    development_zones = [
        {
            "area": area,
            "score": score,
            "name": BUSINESS_AREAS[area]["name"],
            "gap": get_industry_benchmark(industry, area) - score,
        }
        for area, score in sorted(area_percentages.items(), key=lambda x: x[1])[:3]
    ]
    strengths = [
        {
            "area": area,
            "score": score,
            "name": BUSINESS_AREAS[area]["name"],
        }
        for area, score in sorted(area_percentages.items(), key=lambda x: x[1], reverse=True)[:2]
    ]
    return {
        "areaScores": area_percentages,
        "totalHealthIndex": total_health_index,
        "developmentZones": development_zones,
        "strengths": strengths,
    }


def _improvement_potential_label(gap: float) -> str:
    if gap >= -0.5:
        return "Низкий приоритет"
    if gap >= -1.0:
        return "Средний приоритет"
    if gap >= -1.5:
        return "Высокий приоритет"
    return "Критический приоритет"


def score_service(answers: dict[str, Any] | None) -> dict[str, Any] | None:
    if not answers:
        return None
    questions = load_questions()["service"]
    dimension_results: dict[str, dict[str, float]] = {}
    for dim in SERVQUAL_DIMENSIONS:
        if dim == "effort":
            continue
        dimension_results[dim] = {
            "expectation": 0.0,
            "reality": 0.0,
            "gap": 0.0,
            "count": 0.0,
        }
    for q in questions:
        answer = answers.get(str(q.get("id")))
        if not answer or "dimension" not in q:
            continue
        dimension = str(q.get("dimension") or "")
        if dimension == "effort" or dimension not in dimension_results:
            continue
        if isinstance(answer, dict) and "expectation" in answer and "reality" in answer:
            dr = dimension_results[dimension]
            dr["expectation"] += float(answer.get("expectation") or 0)
            dr["reality"] += float(answer.get("reality") or 0)
            dr["gap"] += float(answer.get("gap") or 0)
            dr["count"] += 1.0
    for _dim, result in dimension_results.items():
        count = result["count"]
        if count > 0:
            result["expectation"] = round(result["expectation"] / count, 2)
            result["reality"] = round(result["reality"] / count, 2)
            result["gap"] = round(result["gap"] / count, 2)
    dims = list(dimension_results.values())
    overall_expectation = sum(d["expectation"] for d in dims) / 5
    overall_reality = sum(d["reality"] for d in dims) / 5
    overall_gap = overall_reality - overall_expectation
    service_quality_index = round((overall_reality / 7) * 10, 1)
    critical_points = [
        {
            "dimension": dimension,
            "name": SERVQUAL_DIMENSIONS[dimension]["name"],
            "icon": SERVQUAL_DIMENSIONS[dimension]["icon"],
            "gap": result["gap"],
            "improvement": _improvement_potential_label(result["gap"]),
        }
        for dimension, result in sorted(
            ((d, r) for d, r in dimension_results.items() if r["count"] > 0),
            key=lambda item: item[1]["gap"],
        )[:3]
    ]
    effort_questions = [q for q in questions if q.get("dimension") == "effort"]
    effort_score = 0.0
    effort_count = 0
    for q in effort_questions:
        a = answers.get(str(q.get("id")))
        if isinstance(a, (int, float)):
            effort_score += float(a)
            effort_count += 1
    customer_effort_score = round(effort_score / effort_count, 1) if effort_count > 0 else 0.0
    strengths = [
        {
            "dimension": dimension,
            "name": SERVQUAL_DIMENSIONS[dimension]["name"],
            "icon": SERVQUAL_DIMENSIONS[dimension]["icon"],
            "reality": result["reality"],
        }
        for dimension, result in sorted(
            ((d, r) for d, r in dimension_results.items() if r["count"] > 0 and r["gap"] >= -0.5),
            key=lambda item: item[1]["reality"],
            reverse=True,
        )[:2]
    ]
    return {
        "dimensionResults": dimension_results,
        "overallExpectation": round(overall_expectation, 2),
        "overallReality": round(overall_reality, 2),
        "overallGap": round(overall_gap, 2),
        "serviceQualityIndex": service_quality_index,
        "customerEffortScore": customer_effort_score,
        "criticalPoints": critical_points,
        "strengths": strengths,
    }


def _touchpoint_status(
    emotional_score: float,
    quality_gap: float,
    criticality: float,
) -> dict[str, str]:
    if emotional_score > 1 and quality_gap >= 0:
        return {"type": "excellent", "label": "Превосходно", "color": "#66BB6A"}
    if emotional_score > 0 and quality_gap >= -1:
        return {"type": "good", "label": "Хорошо", "color": "#26A69A"}
    if emotional_score >= -1 and quality_gap >= -2:
        return {"type": "average", "label": "Средне", "color": "#FF8C00"}
    if criticality >= 4:
        return {"type": "critical", "label": "Критично", "color": "#F44336"}
    return {
        "type": "needs_improvement",
        "label": "Требует улучшения",
        "color": "#FF5722",
    }


def score_emotions(emotions_answers: dict[str, Any] | None) -> dict[str, Any] | None:
    if not emotions_answers:
        return None
    touchpoints = emotions_answers.get("selectedTouchpoints")
    if not isinstance(touchpoints, list) or not touchpoints:
        return None
    ids = [x for x in touchpoints if isinstance(x, str)]
    stages_by_id = {s["id"]: s for s in EMOTIONS_JOURNEY_STAGES}
    total_emotional_score = 0.0
    total_touchpoints = 0.0
    touchpoint_results: list[dict[str, Any]] = []
    for touchpoint_id in ids:
        stage = stages_by_id.get(touchpoint_id)
        emotions_answer = emotions_answers.get(f"touchpoint_{touchpoint_id}_emotions")
        impact_answer = emotions_answers.get(f"touchpoint_{touchpoint_id}_impact")
        if not isinstance(emotions_answer, dict) or not isinstance(impact_answer, dict) or stage is None:
            continue
        positive_score = 0.0
        negative_score = 0.0
        emotion_count = 0
        for emotion in emotions_answer.values():
            if not isinstance(emotion, dict):
                continue
            valence = emotion.get("valence")
            intensity = emotion.get("intensity")
            if not isinstance(intensity, (int, float)):
                continue
            if valence == 1:
                positive_score += float(intensity)
            elif valence == -1:
                negative_score += float(intensity)
            emotion_count += 1
        emotional_balance = positive_score - negative_score
        touchpoint_score = (emotional_balance + positive_score * 0.5) / max(1, emotion_count)
        importance = float(impact_answer.get("importance") or 0)
        influence = float(impact_answer.get("influence") or 0)
        quality = float(impact_answer.get("quality") or 0)
        criticality_score = (importance + influence) / 2
        quality_gap = quality - criticality_score
        total_emotional_score += touchpoint_score * criticality_score
        total_touchpoints += criticality_score
        touchpoint_results.append(
            {
                "id": touchpoint_id,
                "name": stage["name"],
                "icon": stage["icon"],
                "status": _touchpoint_status(touchpoint_score, quality_gap, criticality_score),
            }
        )
    if not touchpoint_results:
        return None
    overall_emotional_index = (
        int(round((total_emotional_score / total_touchpoints) * 20)) if total_touchpoints > 0 else 0
    )
    return {
        "overallEmotionalIndex": overall_emotional_index,
        "touchpointResults": touchpoint_results,
    }


def _answers_by_module(state_or_answers: dict[str, Any]) -> dict[str, Any]:
    """Accept session.state (with answers) or a bare answers map."""
    if "answers" in state_or_answers and isinstance(state_or_answers.get("answers"), dict):
        return state_or_answers["answers"]
    return state_or_answers


def compute_all_results(
    answers: dict[str, Any],
    industry: str | None = None,
) -> dict[str, Any]:
    by_module = _answers_by_module(answers)
    return {
        "archetype": score_archetype(
            by_module.get("archetype") if isinstance(by_module.get("archetype"), dict) else None
        ),
        "values": score_values(by_module.get("values") if isinstance(by_module.get("values"), dict) else None),
        "business": score_business(
            by_module.get("business") if isinstance(by_module.get("business"), dict) else None,
            industry,
        ),
        "service": score_service(by_module.get("service") if isinstance(by_module.get("service"), dict) else None),
        "emotions": score_emotions(by_module.get("emotions") if isinstance(by_module.get("emotions"), dict) else None),
    }


def compute_module_metrics(
    module_id: str,
    answers: dict[str, Any],
    industry: str | None = None,
) -> dict[str, Any]:
    by_module = _answers_by_module(answers)
    if module_id == "archetype":
        return {
            "archetype": score_archetype(
                by_module.get("archetype") if isinstance(by_module.get("archetype"), dict) else None
            )
        }
    if module_id == "values":
        return {"values": score_values(by_module.get("values") if isinstance(by_module.get("values"), dict) else None)}
    if module_id == "business":
        return {
            "business": score_business(
                by_module.get("business") if isinstance(by_module.get("business"), dict) else None,
                industry,
            )
        }
    if module_id == "service":
        return {
            "service": score_service(by_module.get("service") if isinstance(by_module.get("service"), dict) else None)
        }
    if module_id == "emotions":
        return {
            "emotions": score_emotions(
                by_module.get("emotions") if isinstance(by_module.get("emotions"), dict) else None
            )
        }
    return {}


def compute_completed_module_metrics(
    *,
    old_completed: set[str],
    new_completed: set[str],
    answers: dict[str, Any],
    industry: str | None = None,
) -> dict[str, dict[str, Any]]:
    additions = [m for m in DIAGNOSTIC_MODULE_ORDER if m in new_completed and m not in old_completed]
    return {mod: compute_module_metrics(mod, answers, industry) for mod in additions}
