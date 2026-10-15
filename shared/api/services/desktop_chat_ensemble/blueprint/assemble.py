"""Assemble final markdown from template outline and step bodies."""

from __future__ import annotations

import re

from api.services.desktop_chat_ensemble.blueprint.catalog import PlanTemplate


def _clean_step_body(template: PlanTemplate, step_id: str, body: str) -> str:
    text = (body or "").strip()
    if not text:
        return text
    step_title = next((s.title for s in template.steps if s.step_id == step_id), "")
    section_heading = next(
        (sec.heading for sec in template.document_outline if step_id in sec.step_ids),
        "",
    )
    step_low = re.sub(r"\s+", " ", step_title).strip().casefold()
    section_low = re.sub(r"\s+", " ", section_heading).strip().casefold()
    template_low = re.sub(r"\s+", " ", (template.title or "")).strip().casefold()
    lines = text.splitlines()
    while lines:
        raw = lines[0].strip()
        if not raw:
            lines.pop(0)
            continue
        if re.fullmatch(r"#{1,6}", raw):
            lines.pop(0)
            continue
        plain = re.sub(r"^#{1,6}\s*", "", raw).strip().rstrip(":").strip()
        plain_low = re.sub(r"\s+", " ", plain).strip().casefold()
        if plain_low in {step_low, section_low, template_low}:
            lines.pop(0)
            continue
        if step_low and (plain_low.startswith(step_low) or step_low.startswith(plain_low)):
            lines.pop(0)
            continue
        if section_low and (plain_low.startswith(section_low) or section_low.startswith(plain_low)):
            lines.pop(0)
            continue
        if template_low and template_low in plain_low:
            lines.pop(0)
            continue
        break
    return "\n".join(lines).strip()


def assemble_document(template: PlanTemplate, bodies: dict[str, str]) -> str:
    """Собрать единый markdown: `##` из outline, тела шагов; внутри секции второй+ шаг с `### title`."""
    chunks: list[str] = []
    for sec in template.document_outline:
        chunks.append(f"## {sec.heading}\n")
        for i, sid in enumerate(sec.step_ids):
            body = _clean_step_body(template, sid, bodies.get(sid) or "")
            if not body:
                continue
            if i > 0:
                st = next((s for s in template.steps if s.step_id == sid), None)
                if st:
                    chunks.append(f"\n### {st.title}\n\n")
                else:
                    chunks.append("\n\n")
            else:
                chunks.append("\n")
            chunks.append(body)
        chunks.append("\n\n")
    return "".join(chunks).strip()


def stream_prefix_before_step(template: PlanTemplate, step_id: str, sections_started: set[str]) -> str:
    """Префикс для SSE непосредственно перед стримом тела шага (## секции или ### шага)."""
    for sec in template.document_outline:
        if step_id not in sec.step_ids:
            continue
        key = sec.id or sec.heading
        if key not in sections_started:
            sections_started.add(key)
            return f"\n\n## {sec.heading}\n\n"
        st = next((s for s in template.steps if s.step_id == step_id), None)
        if st:
            return f"\n\n### {st.title}\n\n"
        return "\n\n"
    return "\n\n"
