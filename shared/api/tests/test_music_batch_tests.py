from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.schemas.music_batch_tests import (
    MusicBatchBasePrompt,
    MusicBatchCreateRequest,
    MusicBatchGenerationFeedbackRequest,
)
from api.services.music_batch_tests import (
    _build_payloads,
    _default_music_batch_approach_name,
    batch_limits_snapshot,
    music_batch_capabilities,
)


def _good_lyrics() -> str:
    return """[Verse 1]
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


def _request(**overrides: object) -> MusicBatchCreateRequest:
    data = {
        "workflow_key": "v2_sft",
        "style": "pop",
        "count": 3,
        "duration_seconds": 30,
        "base_prompt": MusicBatchBasePrompt(
            lyrics="[verse]\nhello\n[chorus]\nhook",
            tags="120 BPM pop, female vocal",
            language="en",
        ),
        "fixed_params": {"vocal": "female", "keyscale": "A minor", "timesignature": "4"},
        "random_params": {
            "bpm": {"type": "number", "min": 120, "max": 122, "step": 1},
            "seed": {"type": "seed", "mode": "sequential", "start": 900},
            "sampler_name": {"type": "enum", "values": ["euler"]},
            "scheduler": {"type": "enum", "values": ["simple"]},
        },
    }
    data.update(overrides)
    return MusicBatchCreateRequest(**data)


def test_batch_payloads_resolve_effective_params_per_row() -> None:
    rows = _build_payloads(_request())

    assert [row["row_index"] for row in rows] == [1, 2, 3]
    assert [row["seed_used"] for row in rows] == [900, 901, 902]
    assert {row["effective_params"]["sampler_name"] for row in rows} == {"euler"}
    assert {row["effective_params"]["scheduler"] for row in rows} == {"simple"}
    assert all(row["effective_params"]["duration_seconds"] == 30 for row in rows)
    assert all(row["ugs_input_data"]["batch_size"] == 1 for row in rows)
    assert all(row["ugs_input_data"]["ugs_workflow"] == "v2_sft" for row in rows)


def test_batch_payloads_reject_unsupported_workflow_param() -> None:
    request = _request(
        workflow_key="v2",
        random_params={"sampler_name": {"type": "enum", "values": ["euler"]}},
    )

    with pytest.raises(ValueError, match="Unsupported batch parameters"):
        _build_payloads(request)


def test_batch_payloads_reject_fixed_and_random_overlap() -> None:
    request = _request(
        fixed_params={"vocal": "female", "bpm": 120},
        random_params={"bpm": {"type": "number", "min": 120, "max": 130}},
    )

    with pytest.raises(ValueError, match="both fixed and random"):
        _build_payloads(request)


def test_capabilities_expose_operator_limits_and_payload_params() -> None:
    caps = music_batch_capabilities()

    assert caps["limits"]["max_duration_seconds"] == 30
    assert caps["limits"]["max_items_per_approach"] <= 50
    assert "stale_running_reap_after_seconds" in caps["limits"]
    assert isinstance(caps["limits"]["stale_running_reap_after_seconds"], int)
    assert "v3" in {workflow["key"] for workflow in caps["workflows"]}
    assert "sampler_name" in caps["params"]
    assert "seed" in caps["params"]
    assert isinstance(caps.get("feedback_highlights"), list)
    assert any(item.get("key") == "vocal" for item in caps["feedback_highlights"])


def test_batch_limits_snapshot_includes_stale_running_reaper() -> None:
    lim = batch_limits_snapshot()
    assert "stale_running_reap_after_seconds" in lim
    assert lim["stale_running_reap_after_seconds"] >= 0


def test_tagged_feedback_requires_highlights() -> None:
    with pytest.raises(ValidationError):
        MusicBatchGenerationFeedbackRequest(rating="tagged", highlights=[])


def test_tagged_feedback_normalizes_highlights() -> None:
    body = MusicBatchGenerationFeedbackRequest(
        rating="tagged",
        highlights=["transition", "vocal", "vocal"],
    )
    assert body.highlights == ["transition", "vocal"]


def test_non_tagged_feedback_drops_highlights() -> None:
    body = MusicBatchGenerationFeedbackRequest(rating="positive", highlights=["vocal"])
    assert body.highlights is None


def test_default_batch_approach_name_includes_version_genre_count_stamp() -> None:
    req = _request()
    name = _default_music_batch_approach_name(req)
    assert "SFT" in name or "XL" in name
    assert "pop" in name
    assert "_3_" in name
    assert "T" in name.split("_")[-1]


def test_v2_base_batch_payload_applies_xl_pipeline() -> None:
    req = MusicBatchCreateRequest(
        workflow_key="v2_base",
        style="pop",
        count=1,
        duration_seconds=30,
        base_prompt=MusicBatchBasePrompt(
            lyrics=_good_lyrics(),
            tags="120 BPM pop, female vocal",
            language="ru",
        ),
        fixed_params={"vocal": "female"},
    )
    rows = _build_payloads(req)
    assert rows[0]["ugs_input_data"]["ugs_workflow"] == "v2_base"
    assert rows[0]["ugs_input_data"].get("xl_base_lyrics_sung_lines", 0) >= 6
