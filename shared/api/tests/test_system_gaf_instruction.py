"""System GAF instruction template validation and body builder."""

import pytest

from api.gaf_chat.message_metadata import message_metadata_dict_from_db
from api.gaf_chat.system_gaf_instruction import (
    ALLOWED_DESKTOP_APP_COMPONENTS,
    build_instruction_body_and_metadata,
    instruction_locale_from_user_preferences,
    normalize_instruction_locale,
    validate_instruction_payload,
)


def test_normalize_instruction_locale_maps_en_and_defaults_ru() -> None:
    assert normalize_instruction_locale("en") == "en"
    assert normalize_instruction_locale("en-US") == "en"
    assert normalize_instruction_locale("ru") == "ru"
    assert normalize_instruction_locale(None) == "ru"
    assert normalize_instruction_locale("de") == "ru"


def test_instruction_locale_from_user_preferences() -> None:
    assert instruction_locale_from_user_preferences(None) == "ru"
    assert instruction_locale_from_user_preferences({}) == "ru"
    assert instruction_locale_from_user_preferences({"language": "en"}) == "en"
    assert instruction_locale_from_user_preferences({"language": "ru"}) == "ru"
    assert instruction_locale_from_user_preferences({"language": "de"}) == "ru"
    assert instruction_locale_from_user_preferences('{"language": "en"}') == "en"


def test_validate_rejects_bad_component() -> None:
    with pytest.raises(ValueError, match="Invalid open_app_component"):
        validate_instruction_payload(
            "hi",
            "",
            [{"title": "x", "body": "y", "open_app_component": "NotARealApp"}],
        )


def test_validate_rejects_html() -> None:
    with pytest.raises(ValueError, match="angle"):
        validate_instruction_payload("<b>x</b>", "", [])


def test_build_body_and_metadata() -> None:
    body, meta = build_instruction_body_and_metadata(
        "Welcome",
        "Thanks",
        [
            {"title": "Step 1", "body": "Do this", "open_app_component": "GAFChatApp"},
        ],
    )
    assert "Welcome" in body
    assert "Thanks" in body
    assert "Step 1" in body
    assert meta.get("kind") == "onboarding_instruction"
    assert meta.get("welcome_text") == "Welcome"
    assert meta.get("thanks_text") == "Thanks"
    steps = meta.get("steps") or []
    assert len(steps) == 1
    assert steps[0].get("open_app_component") == "GAFChatApp"
    assert "button_label" in steps[0]


def test_allowlist_contains_gaf_chat() -> None:
    assert "GAFChatApp" in ALLOWED_DESKTOP_APP_COMPONENTS


def test_message_metadata_dict_from_db_accepts_json_string() -> None:
    raw = '{"kind": "onboarding_instruction", "steps": []}'
    assert message_metadata_dict_from_db(raw) == {
        "kind": "onboarding_instruction",
        "steps": [],
    }


def test_message_metadata_dict_from_db_accepts_dict() -> None:
    d = {"kind": "onboarding_instruction"}
    assert message_metadata_dict_from_db(d) is d
