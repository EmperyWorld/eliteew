# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F0 council helper for the sequential speaker brief.
# Speech transcript context is owned by council_speech.py.
# Invariants:
# - The brief names turn order but never carries peer Document sections.
# Related:
# - archive/legacy_freeform/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol)
# ---
"""Council turn-order brief for sequential ensemble speakers."""

from __future__ import annotations

from typing import Literal

from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

CouncilMode = Literal["joint_document", "discussion"]


def resolve_council_mode(delivery_mode: str) -> CouncilMode:
    """Map orchestrator delivery to council interaction contract."""
    if (delivery_mode or "").strip().lower() == "separate":
        return "discussion"
    return "joint_document"


def council_speaker_brief_block(
    *,
    index: int,
    speakers: list[str],
    mode: CouncilMode,
    hero_id: str,
) -> str:
    """Orchestrator handoff lines embedded in the speaker system prompt."""
    total = max(1, len(speakers))
    position = index + 1
    remaining = speakers[index + 1 :]
    remaining_lbl = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in remaining)
    own = HERO_SHORT_LABEL.get(hero_id, hero_id)
    lines = [
        "\n\n[Совещание · brief оркестратора]",
        f"Ты — участник «{own}», ход {position} из {total} в этом круге.",
    ]
    if remaining:
        lines.append(
            f"После тебя ещё выскажутся: {remaining_lbl}. "
            "Не закрывай тему «за всю команду» — оставь пространство следующим."
        )
    else:
        lines.append("Ты последний в этом круге — заверши свою долю, не переписывая чужие блоки целиком.")
    if index > 0:
        lines.append("Учти уже сказанное коллегами (служебное сообщение с их репликами выше).")
    if mode == "discussion":
        lines.append(
            "Режим дискуссии: можно не согласиться, уточнить или оспорить предыдущие реплики по существу; "
            "не копируй чужой текст дословно."
        )
    else:
        lines.append(
            "Режим совместного документа: дополняй свою зону ответственности; "
            "не повторяй уже покрытые списки/реестры/roadmap коллег и не начинай полный документ заново."
        )
    return "\n".join(lines)
