# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Music Evolution normalization, lifecycle hardening, and golden ACE workflow payload metadata.
# Invariants:
# - High-level user slots must not be dropped before UGS/audio/content boundaries.
# - Music Evolution keeps one billing/debug type_key while routing soloists to their golden ACE workflow lanes.
# - Idempotent run reuse must not enqueue duplicate backend execution.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/services/music_evolution_prompts.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest

from api.routers.music_evolution import create_music_evolution_run
from api.schemas.music_evolution import MusicEvolutionRunCreate
from api.services.music_evolution_pipeline import (
    MusicEvolutionCancelled,
    MusicEvolutionPipelineService,
    MusicEvolutionRunCreateResult,
    _clamp_evolution_duration_seconds,
    _extract_ugs_request_id,
    _terminalize_stale_music_evolution_run,
    build_music_evolution_audio_input_data,
    build_music_evolution_content_metadata,
    ensure_evolution_vocal_marker,
    estimate_evolution_duration_from_lyrics,
    music_evolution_production_params,
    normalize_evolution_style_tags_raw,
    normalize_music_evolution_input,
    parse_brief_text,
    resolve_evolution_render_duration_seconds,
    soften_evolution_audio_tags,
)
from api.services.music_evolution_prompts import (
    build_brief_messages,
    build_lyrics_messages,
    build_song_recipe_messages,
    build_style_messages,
    fallback_song_recipe,
    parse_song_recipe_text,
    validate_lyrics_against_song_recipe,
    validate_style_tags_against_song_recipe,
)


@dataclass
class _RecordedExecute:
    sql: str
    params: dict[str, Any]


class _FakeMappings:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None

    def all(self) -> list[dict[str, Any]]:
        return self._rows


class _FakeResult:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _FakeAsyncSession:
    def __init__(self, execute_results: list[list[dict[str, Any]]] | None = None) -> None:
        self.executes: list[_RecordedExecute] = []
        self.commits = 0
        self.rollbacks = 0
        self.execute_results = list(execute_results or [])

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        sql = str(getattr(statement, "text", statement))
        self.executes.append(_RecordedExecute(sql=sql, params=dict(params or {})))
        rows = self.execute_results.pop(0) if self.execute_results else []
        return _FakeResult(rows)

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def test_music_evolution_normalization_preserves_user_slots() -> None:
    body = MusicEvolutionRunCreate(
        theme="  Ночная дорога домой  ",
        soloist="mira",
        vocal="duet",
        genre="Alt Pop!",
        language="ru",
        mood="romantic",
        meaning_tags=["love", "road", "love"],
        extra_context="  без клише  ",
        duration_seconds=120,
    )

    normalized = normalize_music_evolution_input(body)

    assert normalized["theme"] == "Ночная дорога домой"
    assert normalized["soloist"] == "ritm"
    assert normalized["vocal"] == "female"
    assert normalized["genre"] == "house"
    assert normalized["language"] == "ru"
    assert normalized["mood"] == "energetic"
    assert normalized["meaning_tags"] == []
    assert normalized["extra_context"] == "без клише"
    assert normalized["ugs_workflow"] == "v5"
    assert normalized["ace_workflow"] == "v5"
    assert normalized["model_scope"] == "xl_sft_lora"
    assert normalized["workflow_file"] == "BIG_XL_SFT.json"
    assert normalized["vocal_locked"] is True


def test_music_evolution_normalization_routes_golden_soloists_to_workflows() -> None:
    cases = {
        "pulse": ("v2_base", "xl_base", "Musicv2_base.json"),
        "velvet": ("v2_sft", "xl_sft", "Musicv2_sft.json"),
        "nebula": ("v4", "xl_sft_lora", "v4_luna_ace_sft_xl.json"),
        "ascent": ("v2", "xl_turbo", "Musicv2.json"),
        "ritm": ("v5", "xl_sft_lora", "BIG_XL_SFT.json"),
    }
    for soloist, (workflow, scope, workflow_file) in cases.items():
        normalized = normalize_music_evolution_input(MusicEvolutionRunCreate(theme="Тест", soloist=soloist))
        assert normalized["ugs_workflow"] == workflow
        assert normalized["model_scope"] == scope
        assert normalized["workflow_file"] == workflow_file
    nebula = normalize_music_evolution_input(MusicEvolutionRunCreate(theme="Тест", soloist="nebula"))
    assert nebula["v4_soloist"] == "luna"


def test_music_evolution_prompts_include_semantic_slots() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Город после дождя",
            soloist="mira",
            vocal="female",
            genre="house",
            language="ru",
            mood="warm",
            meaning_tags=["life", "city"],
        )
    )
    corpus = {"items": [{"name": "liked track", "style": "house", "quality_signal": 4}]}
    brief = {"angle": "город как новая жизнь"}

    brief_text = "\n".join(message["content"] for message in build_brief_messages(normalized, corpus))
    lyrics_text = "\n".join(message["content"] for message in build_lyrics_messages(normalized, brief))
    style_text = "\n".join(
        message["content"] for message in build_style_messages(normalized, brief, "[Verse]\nстрока", 124)
    )

    assert "Город после дождя" in brief_text
    assert "Ритм" in brief_text
    assert "female" in lyrics_text
    assert "ru" in lyrics_text
    assert "Ритм" in lyrics_text
    assert "город как новая жизнь" in style_text


def test_music_evolution_song_recipe_parser_fallback_preserves_slots() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Город после дождя",
            soloist="rook",
            vocal="female",
            genre="house",
            language="en",
            mood="dark",
            meaning_tags=["city", "faith"],
        )
    )

    recipe = parse_song_recipe_text("не json", normalized, {"selected_count": 2})

    assert recipe["corpus_selected_count"] == 2
    assert recipe["lyrics_plan"]["language"] == "ru"
    assert recipe["vocal_plan"]["lead"] == "male"
    assert "Grit" in recipe["style_plan"]["primary_style"]
    assert "город" in recipe["lyrics_plan"]["chorus_must_include"]
    assert recipe["style_plan"]["bpm"] >= 60


def test_music_evolution_song_recipe_nested_json_is_validated() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Ночная трасса",
            soloist="rook",
            mood="energetic",
            meaning_tags=["road"],
        )
    )
    raw = """
    {"song_recipe": {
      "angle": "raw",
      "lyrics_plan": {"language": "en", "section_plan": ["Verse"], "chorus_must_include": []},
      "vocal_plan": {"lead": "auto"},
      "style_plan": {"primary_style": "female house", "positive_tags": ["auto vocal"], "bpm": 999}
    }}
    """

    recipe = parse_song_recipe_text(raw, normalized, {})

    assert recipe["lyrics_plan"]["language"] == "ru"
    assert len(recipe["lyrics_plan"]["section_plan"]) >= 3
    assert recipe["vocal_plan"]["lead"] == "male"
    assert recipe["style_plan"]["bpm"] == 220
    assert "male vocal" in recipe["style_plan"]["positive_tags"]


def test_music_evolution_song_recipe_messages_include_full_contract() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(theme="Тёплый город", soloist="vera", mood="romantic", meaning_tags=["love", "city"])
    )

    prompt_text = "\n".join(message["content"] for message in build_song_recipe_messages(normalized, {}))

    assert "lyrics_plan" in prompt_text
    assert "vocal_plan" in prompt_text
    assert "style_plan" in prompt_text
    assert "Velvet" in prompt_text


def test_music_evolution_lyrics_recipe_gate_requires_chorus_hook() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(theme="Ночная дорога домой", soloist="lula", mood="warm", meaning_tags=["road"])
    )
    recipe = fallback_song_recipe(normalized, {})

    missing = validate_lyrics_against_song_recipe(
        "[Verse 1]\nЯ иду сквозь тихий свет\n[Chorus]\nМы будем рядом до утра\n[Verse 2]\nИ снова город ждёт",
        recipe,
    )
    ok = validate_lyrics_against_song_recipe(
        "[Verse 1]\nЯ иду сквозь тихий свет\n[Chorus]\nНочная дорога домой зовёт меня\n[Verse 2]\nИ снова город ждёт",
        recipe,
    )

    assert {error["code"] for error in missing} == {"lyrics_chorus_missing_recipe_hook"}
    assert ok == []


def test_music_evolution_style_recipe_gate_rejects_auto_and_accepts_anchor() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(theme="Гаражный драйв", soloist="rook", mood="energetic", meaning_tags=["road"])
    )
    recipe = fallback_song_recipe(normalized, {})

    bad = validate_style_tags_against_song_recipe("rock, auto, 110 BPM, [verse]", recipe, normalized, bpm=110)
    good = validate_style_tags_against_song_recipe(
        "Style: Memphis phonk Grit. 144 BPM, gritty male vocal, clear vocal, "
        "cowbell hook, distorted 808 bass, [verse] dark street mood, [chorus] phonk energy",
        recipe,
        normalized,
        bpm=144,
    )

    assert "style_tags_auto_vocal" in {error["code"] for error in bad}
    assert good == []


def test_style_recipe_gate_allows_negated_forbidden_tags_and_female_lead() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(theme="Ветер", soloist="atya", mood="custom", meaning_tags=["life"])
    )
    recipe = fallback_song_recipe(normalized, {})
    tags = (
        "Style: Storm Russian vocal trance drum and bass Atya. 172 BPM, adult female lead vocal, "
        "rolling DnB drums, Reese bass, no child lead vocal, no pop ballad. "
        "[verse] storm pulse, [chorus] background children choir call-response"
    )

    errors = validate_style_tags_against_song_recipe(tags, recipe, normalized, bpm=172)

    assert "style_tags_forbidden_recipe_tag" not in {error["code"] for error in errors}


def test_music_evolution_shadow_tags_keep_concrete_vocal_marker_after_xl_base_cleanup() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Ночной город без лица",
            soloist="shadow",
            vocal="auto",
            genre="pop",
            language="ru",
            mood="warm",
            meaning_tags=["city"],
        )
    )
    normalized = {**normalized, "vocal_effective": "female"}
    recipe = fallback_song_recipe(normalized, {})
    tags = (
        "Style: pop noir city story, 118 BPM, clear vocal, close-mic lead, [verse] neon pulse, [chorus] emotional hook"
    )

    final_tags = ensure_evolution_vocal_marker(tags, vocal=str(normalized["vocal_effective"]))
    errors = validate_style_tags_against_song_recipe(final_tags, recipe, normalized, bpm=118)

    assert "female vocal" in final_tags.lower()
    assert "style_tags_missing_vocal" not in {error["code"] for error in errors}


def test_music_evolution_audio_and_content_payloads_keep_golden_workflow() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Победа после долгой работы",
            soloist="nebula",
            mood="romantic",
            meaning_tags=["love"],
        )
    )
    params = music_evolution_production_params(normalized)
    brief = {"angle": "earned victory"}
    corpus = {"items": [{"content_id": "00000000-0000-0000-0000-000000000001"}]}

    audio_input, final_params = build_music_evolution_audio_input_data(
        normalized_input=normalized,
        brief=brief,
        lyrics="[Verse]\nТихий свет в окне\n[Chorus]\nПобеда после долгой работы звучит внутри",
        tags="Style: Vaporwave lo-fi psychedelic melancholy Nebula, 116 BPM, female vocal",
        params=params,
        run_id="11111111-1111-1111-1111-111111111111",
    )
    metadata = build_music_evolution_content_metadata(
        normalized_input=normalized,
        brief=brief,
        corpus=corpus,
        lyrics=audio_input["lyrics"],
        tags=audio_input["tags"],
        params=params,
        run_id="11111111-1111-1111-1111-111111111111",
    )

    assert audio_input["ugs_workflow"] == "v4"
    assert audio_input["ace_workflow"] == "v4_luna"
    assert audio_input["v4_soloist"] == "luna"
    assert audio_input["ksampler_use_comfy_template"] is False
    assert audio_input["music_generator_workflow_file"] == "v4_luna_ace_sft_xl.json"
    assert audio_input["music_generator_model_scope"] == "xl_sft_lora"
    assert audio_input["music_evolution_mood"] == "romantic"
    assert audio_input["music_evolution_meaning_tags"] == []
    assert audio_input["music_evolution_song_recipe"] == brief
    assert audio_input["vocal"] == "female"
    assert audio_input["language"] == "ru"
    assert "input_observability" in final_params
    assert metadata["music_generator_vocal"] == "female"
    assert metadata["music_generator_language"] == "ru"
    assert metadata["music_evolution_mood"] == "romantic"
    assert metadata["music_evolution_meaning_tags"] == []
    assert metadata["music_evolution_song_recipe"] == brief
    assert metadata["ugs_workflow"] == "v4"
    assert metadata["ace_workflow"] == "v4_luna"
    assert metadata["music_generator_workflow_file"] == "v4_luna_ace_sft_xl.json"


def test_extract_ugs_request_id_from_audio_response_metadata() -> None:
    request_id = "33333333-3333-3333-3333-333333333333"

    parsed = _extract_ugs_request_id(
        {
            "status": "completed",
            "metadata": {"lifecycle": {"request_id": request_id}},
            "result": {"audio": [{"data": "abc"}]},
        }
    )

    assert str(parsed) == request_id


@pytest.mark.anyio
async def test_ugs_request_lookup_uses_music_evolution_correlation() -> None:
    db = _FakeAsyncSession(execute_results=[[{"id": "33333333-3333-3333-3333-333333333333"}]])
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    request_id = await service._find_latest_ugs_request_id_for_run(
        run_id="11111111-1111-1111-1111-111111111111",
        active_only=True,
    )

    sql = db.executes[0].sql
    assert str(request_id) == "33333333-3333-3333-3333-333333333333"
    assert "gr.input_data->>'music_evolution_run_id'" in sql
    assert "gr.request_metadata->>'music_evolution_run_id'" in sql
    assert "gr.status NOT IN ('completed', 'failed', 'cancelled')" in sql


@pytest.mark.anyio
async def test_persist_ugs_request_id_updates_run() -> None:
    db = _FakeAsyncSession()
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    await service._persist_ugs_request_id(
        run_id="11111111-1111-1111-1111-111111111111",
        ugs_request_id="33333333-3333-3333-3333-333333333333",
    )

    assert "SET ugs_request_id = CAST(:ugs_request_id AS uuid)" in db.executes[0].sql
    assert db.executes[0].params["ugs_request_id"] == "33333333-3333-3333-3333-333333333333"
    assert db.commits == 1


@pytest.mark.anyio
async def test_cancel_ugs_request_closes_owned_service(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _FakeAsyncSession()
    calls: list[tuple[str, str]] = []
    closed = False

    class _FakeUgs:
        def __init__(self, db_arg: object) -> None:
            assert db_arg is db

        async def cancel_generation(self, request_id: str, *, user_id: str | None = None) -> None:
            calls.append((request_id, str(user_id)))

        async def close(self) -> None:
            nonlocal closed
            closed = True

    monkeypatch.setattr("api.services.music_evolution_pipeline.UnifiedGenerationService", _FakeUgs)
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]
    await service._cancel_ugs_request(
        ugs_request_id="33333333-3333-3333-3333-333333333333",
        user_id="22222222-2222-2222-2222-222222222222",
    )

    assert calls == [
        (
            "33333333-3333-3333-3333-333333333333",
            "22222222-2222-2222-2222-222222222222",
        )
    ]
    assert closed is True


@pytest.mark.anyio
async def test_set_run_status_without_error_payload_avoids_null_jsonb_param() -> None:
    db = _FakeAsyncSession(execute_results=[[{"status": "running"}]])
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    changed = await service._set_run_status("11111111-1111-1111-1111-111111111111", "running")

    assert len(db.executes) == 1
    sql = db.executes[0].sql
    params = db.executes[0].params
    assert "error_payload" not in sql.lower()
    assert "WHEN :error_payload IS NULL" not in sql
    assert "error_payload" not in params
    assert params["status"] == "running"
    assert db.commits == 1
    assert changed is True


@pytest.mark.anyio
async def test_set_run_status_with_error_payload_casts_jsonb() -> None:
    db = _FakeAsyncSession(execute_results=[[{"status": "failed"}]])
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]
    error = {"stage": "intake_normalize", "message": "boom"}

    changed = await service._set_run_status(
        "11111111-1111-1111-1111-111111111111",
        "failed",
        error_payload=error,
    )

    assert len(db.executes) == 1
    sql = db.executes[0].sql
    params = db.executes[0].params
    assert "CAST(:error_payload AS jsonb)" in sql
    assert "WHEN :error_payload IS NULL" not in sql
    assert params["status"] == "failed"
    assert '"stage"' in params["error_payload"]
    assert db.commits == 1
    assert changed is True


@pytest.mark.anyio
async def test_set_run_status_does_not_overwrite_terminal_status() -> None:
    db = _FakeAsyncSession()
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    changed = await service._set_run_status(
        "11111111-1111-1111-1111-111111111111",
        "completed",
    )

    sql = db.executes[0].sql
    assert "status NOT IN ('completed', 'failed', 'cancelled')" in sql
    assert db.commits == 1
    assert changed is False


@pytest.mark.anyio
async def test_raise_if_cancelled_stops_pipeline() -> None:
    db = _FakeAsyncSession(execute_results=[[{"status": "cancelled"}]])
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    with pytest.raises(MusicEvolutionCancelled):
        await service._raise_if_cancelled(run_id="11111111-1111-1111-1111-111111111111")


@pytest.mark.anyio
async def test_pipeline_failure_persists_after_rollback() -> None:
    db = _FakeAsyncSession(execute_results=[[], [{"status": "failed"}]])
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]
    error = {"stage": "creative_brief", "message": "llm down"}

    await service._fail_step("11111111-1111-1111-1111-111111111111", "creative_brief", error)
    await service._set_run_status(
        "11111111-1111-1111-1111-111111111111",
        "failed",
        error_payload=error,
    )

    assert db.rollbacks == 0
    assert db.commits == 2
    assert any("music_evolution_run_steps" in item.sql for item in db.executes)
    assert any(item.params.get("status") == "failed" for item in db.executes)


@pytest.mark.anyio
async def test_create_run_reports_idempotency_reuse_created_false() -> None:
    db = _FakeAsyncSession(
        execute_results=[
            [{"id": "11111111-1111-1111-1111-111111111111", "status": "running", "created": False}],
            *([] for _ in range(11)),
        ]
    )
    service = MusicEvolutionPipelineService(db)  # type: ignore[arg-type]

    result = await service.create_run(
        user_id="22222222-2222-2222-2222-222222222222",
        body=MusicEvolutionRunCreate(theme="Ночная дорога", idempotency_key="same-key"),
    )

    assert result == MusicEvolutionRunCreateResult(
        run_id=result.run_id,
        status="running",
        created=False,
    )
    assert "ON CONFLICT (user_id, idempotency_key)" in db.executes[0].sql


@pytest.mark.anyio
async def test_router_does_not_enqueue_existing_idempotent_run(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = "11111111-1111-1111-1111-111111111111"
    calls: list[tuple[str, str]] = []

    class _FakeRequest:
        headers = {"Idempotency-Key": "same-key"}

    class _FakeUser:
        id = "22222222-2222-2222-2222-222222222222"

    class _FakeTask:
        @staticmethod
        def delay(run_id_arg: str, user_id_arg: str) -> None:
            calls.append((run_id_arg, user_id_arg))

    class _FakeService:
        def __init__(self, db: object) -> None:
            self.db = db

        async def create_run(self, *, user_id: str, body: MusicEvolutionRunCreate) -> MusicEvolutionRunCreateResult:
            assert user_id == _FakeUser.id
            assert body.idempotency_key == "same-key"
            return MusicEvolutionRunCreateResult(run_id=result_uuid, status="running", created=False)

    result_uuid = UUID(run_id)
    monkeypatch.setattr("api.routers.music_evolution.MusicEvolutionPipelineService", _FakeService)
    monkeypatch.setattr("api.routers.music_evolution.run_music_evolution_pipeline_task", _FakeTask)

    response = await create_music_evolution_run(
        MusicEvolutionRunCreate(theme="Ночная дорога"),
        request=_FakeRequest(),  # type: ignore[arg-type]
        user=_FakeUser(),  # type: ignore[arg-type]
        db=object(),  # type: ignore[arg-type]
    )

    assert str(response.run_id) == run_id
    assert response.status == "running"
    assert calls == []


@pytest.mark.anyio
async def test_terminalize_stale_music_evolution_run_guards_terminal_status() -> None:
    db = _FakeAsyncSession(execute_results=[[{"status": "failed"}], []])

    changed = await _terminalize_stale_music_evolution_run(
        db,  # type: ignore[arg-type]
        run_id="11111111-1111-1111-1111-111111111111",
        status="failed",
        stage="stale-reaper",
        message="stale_music_evolution_run_timeout",
        ugs_request_id="33333333-3333-3333-3333-333333333333",
    )

    sql = db.executes[0].sql
    assert "status NOT IN ('completed', 'failed', 'cancelled')" in sql
    assert db.executes[1].params["status"] == "failed"
    assert db.commits == 1
    assert changed is True


def test_clamp_evolution_duration_seconds() -> None:
    assert _clamp_evolution_duration_seconds(225.4) == 225
    assert _clamp_evolution_duration_seconds(12) == 30
    assert _clamp_evolution_duration_seconds(400) == 300
    assert _clamp_evolution_duration_seconds(None, fallback=195) == 195


def test_normalize_evolution_style_tags_raw_replaces_auto() -> None:
    raw = "124,dark,auto,industrial,heavy,[intro],[verse],[chorus]"
    out = normalize_evolution_style_tags_raw(raw, vocal="auto", genre="edm")
    assert "auto" not in out.lower()
    assert "female" in out.lower()
    assert "edm" in out.lower()


def test_soften_evolution_audio_tags_replaces_distortion_for_cinematic() -> None:
    raw = "cinematic, 78, female, dark, strings, distorted bass, gritty mix, [verse], [chorus]"
    out = soften_evolution_audio_tags(raw, genre="cinematic", mood="dark")
    assert "distorted" not in out.lower()
    assert "gritty" not in out.lower()
    assert "clear vocal" in out.lower()


def test_soften_evolution_audio_tags_keeps_vocal_trance_dnb_power() -> None:
    raw = "vocal_trance, 172 BPM, rolling DnB drums, Reese bass, distorted bass, gritty mix, [chorus]"
    out = soften_evolution_audio_tags(raw, genre="vocal_trance", mood="custom")
    low = out.lower()
    assert "rolling dnb drums" in low
    assert "reese bass" in low
    assert "distorted bass" in low
    assert "gritty mix" in low


def test_music_evolution_production_params_use_calmer_dark_defaults() -> None:
    params = music_evolution_production_params({"genre": "cinematic", "mood": "dark", "duration_seconds": 90})
    assert params["temperature"] <= 0.82
    assert params["cfg_scale"] <= 1.95
    assert params["top_p"] <= 0.89


def test_estimate_evolution_duration_from_long_lyrics() -> None:
    lines: list[str] = []
    for block in range(8):
        lines.append(f"[Verse {block + 1}]")
        lines.extend(f"Строка номер {j} для пения здесь" for j in range(4))
    lyrics = "\n".join(lines)
    estimated = estimate_evolution_duration_from_lyrics(lyrics=lyrics, bpm=124, language="ru")
    assert estimated > 90


def test_estimate_evolution_duration_short_lyrics_at_least_floor() -> None:
    lyrics = "[Verse 1]\nОдна короткая строка для пения\n[Chorus]\nЕщё одна строка припева"
    estimated = estimate_evolution_duration_from_lyrics(lyrics=lyrics, bpm=115, language="ru")
    assert estimated >= 165


def test_resolve_evolution_render_duration_soloist_locked_caps_at_baseline() -> None:
    lines = ["[Intro]", "Строка вступления для пения здесь"]
    for block in range(6):
        lines.append(f"[Verse {block + 1}]")
        lines.extend(f"Длинная строка куплета номер {j} для XL Base" for j in range(3))
    lines.append("[Chorus]")
    lines.extend(f"Припевная строка {j} с ярким образом" for j in range(4))
    lyrics = "\n".join(lines)
    params = music_evolution_production_params({"genre": "pop", "mood": "warm", "duration_seconds": 195})
    resolved = resolve_evolution_render_duration_seconds(
        normalized_input={
            "language": "ru",
            "duration_seconds": 195,
            "soloist": "ray",
            "vocal_locked": True,
        },
        params=params,
        lyrics=lyrics,
        corpus_snapshot={"quality_summary": {"median_duration_seconds": 247}},
    )
    assert resolved == 195


def test_resolve_evolution_render_duration_uses_corpus_and_lyrics() -> None:
    lines = ["[Intro]", "Строка вступления для пения здесь"]
    for block in range(6):
        lines.append(f"[Verse {block + 1}]")
        lines.extend(f"Длинная строка куплета номер {j} для XL Base" for j in range(3))
    lines.append("[Chorus]")
    lines.extend(f"Припевная строка {j} с ярким образом" for j in range(4))
    lyrics = "\n".join(lines)
    params = music_evolution_production_params({"genre": "pop", "mood": "warm", "duration_seconds": 195})
    resolved = resolve_evolution_render_duration_seconds(
        normalized_input={"language": "ru", "duration_seconds": 195},
        params=params,
        lyrics=lyrics,
        corpus_snapshot={"quality_summary": {"median_duration_seconds": 210}},
    )
    assert resolved >= 195
    assert resolved <= 300


def test_parse_brief_text_recovers_unescaped_inner_quotes() -> None:
    normalized = {
        "theme": "Я такая скоростная как",
        "meaning_tags": ["irony", "faith"],
        "genre": "house",
        "mood": "calm",
    }
    corpus = {"selected_count": 6}
    raw = (
        '{"angle":"Ироничное противопоставление","story_arc":"От быстрого движения к остановке",'
        '"avoid":["Чрезмерно агрессивный бит"],"hook_idea":"Метафора "скорости" как бег от потерь",'
        '"production_hint":"Глубокие басы и мягкие пэды"}'
    )

    brief = parse_brief_text(raw, normalized, corpus)

    assert brief["angle"] == "Ироничное противопоставление"
    assert "скорости" in brief["hook_idea"]
    assert brief["avoid"] == ["Чрезмерно агрессивный бит"]
    assert "irony" not in brief["angle"]


def test_music_evolution_ugs_text_types_are_llama_chat_routed() -> None:
    """Music Evolution text steps must use the same Llama messages path as music_generator_lyrics."""
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "services" / "ugs" / "provider_manager_service_v2.py"
    text = src.read_text(encoding="utf-8")
    for key in (
        "music_generator_evolution_brief",
        "music_generator_evolution_lyrics",
        "music_generator_evolution_style",
    ):
        assert f'"{key}"' in text


def test_plain_text_from_ugs_llm_result_strips_gemma_thinking() -> None:
    from api.services.music_evolution_pipeline import _plain_text_from_ugs_llm_result

    raw = {
        "result": {
            "text": "<|channel>thought\n<channel|>[Verse 1]\nПервая строка\nВторая строка",
        }
    }
    text = _plain_text_from_ugs_llm_result(raw)
    assert "<|channel" not in text
    assert text.startswith("[Verse 1]")
    assert "Первая строка" in text
