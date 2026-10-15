"""Pydantic body POST /music-generator/generate: целые поля из JSON float."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.schemas.music_generate_request import MusicGenerateRequest


def test_generate_request_coerces_fractional_floats_to_int() -> None:
    r = MusicGenerateRequest.model_validate(
        {
            "lyrics": "x",
            "bpm": 118.4,
            "duration_seconds": 120.9,
            "steps": 49.6,
            "cfg": 2.25,
        }
    )
    assert r.bpm == 118
    assert r.duration_seconds == 121
    assert r.steps == 50
    assert r.cfg == pytest.approx(2.25)


def test_generate_request_seed_whole_float_ok() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x", "seed": 9007199254740991.0})
    assert r.seed == 9007199254740991


def test_generate_request_seed_fractional_rejected() -> None:
    with pytest.raises(ValidationError):
        MusicGenerateRequest.model_validate({"lyrics": "x", "seed": 1.2})


def test_generate_request_billing_mode_optional() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x"})
    assert r.billing_mode is None
    r2 = MusicGenerateRequest.model_validate({"lyrics": "x", "billing_mode": "wizard"})
    assert r2.billing_mode == "wizard"


def test_generate_request_ugs_workflow_alias_ace_workflow() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x", "ace_workflow": "v2"})
    assert r.ugs_workflow == "v2"
    r2 = MusicGenerateRequest.model_validate({"lyrics": "x", "ugs_workflow": "v2"})
    assert r2.ugs_workflow == "v2"

    r3 = MusicGenerateRequest.model_validate({"lyrics": "x", "ugs_workflow": "v2_base"})
    assert r3.ugs_workflow == "v2_base"
    r4 = MusicGenerateRequest.model_validate({"lyrics": "x", "ace_workflow": "v2_sft"})
    assert r4.ugs_workflow == "v2_sft"
    r5 = MusicGenerateRequest.model_validate({"lyrics": "x", "ugs_workflow": "v4"})
    assert r5.ugs_workflow == "v4"
    r5b = MusicGenerateRequest.model_validate({"lyrics": "x", "ugs_workflow": "v4", "v4_soloist": "luna"})
    assert r5b.v4_soloist == "luna"
    r6 = MusicGenerateRequest.model_validate({"lyrics": "x", "ugs_workflow": "v5"})
    assert r6.ugs_workflow == "v5"


def test_generate_request_source_mode_is_optional_metadata_marker() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x"})
    assert r.source_mode is None

    r2 = MusicGenerateRequest.model_validate({"lyrics": "x", "source_mode": "xl_base_sft_tab"})
    assert r2.source_mode == "xl_base_sft_tab"

    r3 = MusicGenerateRequest.model_validate({"lyrics": "x", "music_generator_source_mode": "xl_base_sft_tab"})
    assert r3.source_mode == "xl_base_sft_tab"

    with pytest.raises(ValidationError):
        MusicGenerateRequest.model_validate({"lyrics": "x", "source_mode": "turbo"})


def test_generate_request_luna_mode_optional_and_validated() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x", "luna_mode": "classic"})
    assert r.luna_mode == "classic"
    r2 = MusicGenerateRequest.model_validate({"lyrics": "x", "luna_mode": "experimental"})
    assert r2.luna_mode == "experimental"
    with pytest.raises(ValidationError):
        MusicGenerateRequest.model_validate({"lyrics": "x", "luna_mode": "other"})


def test_generate_request_promo_vocal_render_optional() -> None:
    r = MusicGenerateRequest.model_validate({"lyrics": "x"})
    assert r.promo_vocal_render is None
    r2 = MusicGenerateRequest.model_validate({"lyrics": "x", "promo_vocal_render": "tts_mix"})
    assert r2.promo_vocal_render == "tts_mix"
    r3 = MusicGenerateRequest.model_validate({"lyrics": "x", "promo_vocal_render": "ace_model"})
    assert r3.promo_vocal_render == "ace_model"
    with pytest.raises(ValidationError):
        MusicGenerateRequest.model_validate({"lyrics": "x", "promo_vocal_render": "other"})
