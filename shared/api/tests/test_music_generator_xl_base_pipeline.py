"""Unit tests: XL Base pipeline (lyrics substance, seed extract)."""

from __future__ import annotations

import pytest

from api.services.music_generator_xl_base_pipeline import (
    assess_xl_base_lyrics_pipeline,
    build_xl_base_input_observability,
    count_sung_content_lines,
    extract_comfy_seed_from_workflow,
    extract_xl_base_obs_from_ugs_response,
    persist_xl_base_observability_on_generation_request,
    prepare_xl_base_lyrics_for_comfy,
    strip_llm_rewrite_tail_from_lyrics,
    validate_xl_base_lyrics_substance,
    xl_base_lyrics_retry_user_message,
)


def test_extract_seed_from_workflow_node_109() -> None:
    wf = {
        "3": {"inputs": {"seed": ["109", 0]}},
        "109": {"inputs": {"value": 8136007945702658}, "class_type": "PrimitiveInt"},
    }
    assert extract_comfy_seed_from_workflow(wf) == 8136007945702658


def test_strip_llm_rewrite_tail() -> None:
    raw = '[Outro]\nline\n\n"Я стоял у края" -> "В этот лютый мир я был вброшен." (Better).'
    out = strip_llm_rewrite_tail_from_lyrics(raw)
    assert "(Better)" not in out
    assert "-> " not in out
    assert "[Outro]" in out


def test_validate_blocks_skeleton_glam_rock_style() -> None:
    """Регрессия: comfy history 3da09fb1 — только секции без sung lines."""
    skeleton = (
        "[Intro]\n(Arrangement: glam rock, 124 BPM feel)\n(Voice: male, anticipatory)\n"
        "[Verse 1]\n(Arrangement: drums, 124 BPM feel)\n(Voice: male, confessional)\n"
        "[Chorus]\n(Arrangement: guitars, 124 BPM feel)\n(Voice: male, uplifting)\n"
    )
    sung, _cyr = count_sung_content_lines(skeleton, language="ru")
    assert sung == 0
    errs = validate_xl_base_lyrics_substance(skeleton, language="ru")
    codes = {e["code"] for e in errs}
    assert "lyrics_skeleton_only" in codes

    import pytest

    with pytest.raises(ValueError, match="sung"):
        prepare_xl_base_lyrics_for_comfy(skeleton, language="ru", strict=True)


def test_validate_allows_real_song() -> None:
    lyrics = """[Verse 1]
(Arrangement: 120 BPM, guitar)
(Voice: female, soft)
Первая строка куплета здесь,
Вторая строка для проверки текста.

[Chorus]
(Arrangement: 120 BPM, full band)
(Voice: female, anthemic)
Это припев, который поют,
Снова припев, снова идут.

[Verse 2]
Ещё один куплет для полноты,
Чтобы хватило строк для ACE.
"""
    errs = validate_xl_base_lyrics_substance(lyrics, language="ru")
    assert not errs
    out = prepare_xl_base_lyrics_for_comfy(lyrics, language="ru", strict=True)
    assert "Первая строка" in out


def test_assess_pipeline_skeleton_not_ok() -> None:
    skeleton = "[Intro]\n(Arrangement: a)\n(Voice: b)\n[Verse 1]\n(Arrangement: c)\n(Voice: d)\n"
    prepared, errs, ok = assess_xl_base_lyrics_pipeline(skeleton, language="ru")
    assert not ok
    assert prepared
    assert any(e["code"] == "lyrics_skeleton_only" for e in errs)


def test_build_xl_base_input_observability() -> None:
    lyrics = "[Verse 1]\nline one\nline two\n"
    tags = "120 BPM pop, [intro] pads, [chorus] drop"
    obs = build_xl_base_input_observability(lyrics, tags, language="ru")
    assert obs["xl_base_lyrics_sung_lines"] >= 1
    assert obs["xl_base_tags_len"] == len(tags)
    assert obs["xl_base_alert_sung_lines_zero"] is False


def test_build_xl_base_input_observability_alerts_zero_sung(caplog: pytest.LogCaptureFixture) -> None:
    import logging

    skeleton = "[Intro]\n(Arrangement: a)\n(Voice: b)\n"
    with caplog.at_level(logging.ERROR):
        obs = build_xl_base_input_observability(skeleton, "120 BPM", language="ru")
    assert obs["xl_base_alert_sung_lines_zero"] is True
    assert any("xl_base_gate ALERT" in r.message for r in caplog.records)


def test_extract_xl_base_obs_from_ugs_response() -> None:
    resp = {
        "result": {
            "audio": [],
            "metadata": {"xl_base_seed_applied": 123, "xl_base_lyrics_sung_lines": 8},
        },
        "metadata": {"xl_base_tags_len": 400},
    }
    obs = extract_xl_base_obs_from_ugs_response(resp)
    assert obs["xl_base_seed_applied"] == 123
    assert obs["xl_base_lyrics_sung_lines"] == 8
    assert obs["xl_base_tags_len"] == 400


def test_persist_xl_base_observability_on_generation_request() -> None:
    base = {"lyrics": "x", "xl_base_lyrics_sung_lines": 6}
    merged = persist_xl_base_observability_on_generation_request(
        base,
        {"xl_base_seed_applied": 999, "xl_base_tags_len": 1200},
    )
    assert merged["xl_base_seed_applied"] == 999
    assert merged["xl_base_lyrics_sung_lines"] == 6


def test_xl_base_retry_user_message_mentions_sung_lines() -> None:
    msg = xl_base_lyrics_retry_user_message([{"code": "lyrics_skeleton_only", "message": "x"}])
    assert "куплет" in msg.lower() or "пения" in msg.lower()
    assert "6" in msg
