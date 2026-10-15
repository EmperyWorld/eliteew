# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ImperorG content phase wiring — every _PHASE_TO_PACK entry maps to pipeline phase and pack.
# Related:
# - api/services/imperorg_service.py
# - api/services/site_studio_ai_service.py
# ---
from __future__ import annotations

from api.services.imperorg_service import _PHASE_TO_PACK, IMPERORG_PHASES
from api.services.site_studio_ai_service import _CONTENT_PACKS


def test_imperorg_content_phases_cover_extended_packs() -> None:
    phase_ids = {phase["id"] for phase in IMPERORG_PHASES}
    pack_keys = {pack["key"] for pack in _CONTENT_PACKS}

    for phase_id, pack_key in _PHASE_TO_PACK.items():
        assert phase_id in phase_ids, f"missing pipeline phase: {phase_id}"
        assert pack_key in pack_keys, f"missing content pack: {pack_key}"

    assert "content_trust" in _PHASE_TO_PACK
    assert "content_page_heroes" in _PHASE_TO_PACK
