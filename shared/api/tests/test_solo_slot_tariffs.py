"""Contract: public tariffs JSON matches total_energy_for_solo_slot."""

from api.services.desktop_chat.solo_slot import (
    ALLOWED_DESKTOP_HERO_IDS,
    SOLO_SLOT_MIN_ENERGY_PER_HOUR,
    build_solo_slot_tariffs_public,
    total_energy_for_solo_slot,
)


def test_tariffs_by_hero_matches_total_energy() -> None:
    public = build_solo_slot_tariffs_public()
    by_hero = public["by_hero"]
    for hid in ALLOWED_DESKTOP_HERO_IDS:
        row = by_hero[hid]
        assert row["1"] == total_energy_for_solo_slot(1, hid)
        assert row["2"] == total_energy_for_solo_slot(2, hid)
        assert row["12"] == total_energy_for_solo_slot(12, hid)


def test_public_payload_shape() -> None:
    public = build_solo_slot_tariffs_public()
    assert public["min_energy_per_hour"] == SOLO_SLOT_MIN_ENERGY_PER_HOUR
    assert public["discount_12h_percent"] == 20
    assert set(public["hero_competence_multiplier"].keys()) == set(ALLOWED_DESKTOP_HERO_IDS)


def test_tiered_hero_twelve_hour_discount() -> None:
    """1.25 tier: hourly 1250, 12h block = 12 * 1250 * 0.8."""
    hourly = total_energy_for_solo_slot(1, "suno_songwriter")
    assert hourly >= SOLO_SLOT_MIN_ENERGY_PER_HOUR
    assert total_energy_for_solo_slot(12, "suno_songwriter") == int(12 * hourly * 0.8)
