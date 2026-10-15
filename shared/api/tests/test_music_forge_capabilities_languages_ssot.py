# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock MusicForgeCapabilitiesOut.languages to named MusicForgeLanguageOption rows
# (OpenAPI must not emit open dict items).
# Invariants:
# - Runtime defaults keep value + label_ru keys.
# Related:
# - api/schemas/music_forge.py
# - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 1
# ---

from __future__ import annotations

from api.schemas.music_forge import (
    MusicForgeCapabilitiesOut,
    MusicForgeLanguageOption,
)


def test_music_forge_languages_are_named_options() -> None:
    caps = MusicForgeCapabilitiesOut()
    assert caps.languages
    assert all(isinstance(row, MusicForgeLanguageOption) for row in caps.languages)
    assert {row.value for row in caps.languages} == {"auto", "ru", "en"}
    dumped = caps.model_dump(mode="json")
    assert dumped["languages"][0] == {"value": "auto", "label_ru": "Авто"}


def test_music_forge_capabilities_openapi_languages_not_open_dict() -> None:
    schema = MusicForgeCapabilitiesOut.model_json_schema()
    languages = schema["properties"]["languages"]
    items = languages.get("items") or {}
    # Pydantic v2 $ref or inline properties — never additionalProperties-only object.
    if "$ref" in items:
        defs = schema.get("$defs") or schema.get("definitions") or {}
        ref_name = items["$ref"].rsplit("/", 1)[-1]
        item_schema = defs[ref_name]
    else:
        item_schema = items
    props = item_schema.get("properties") or {}
    assert "value" in props
    assert "label_ru" in props
    assert item_schema.get("additionalProperties") is not True
