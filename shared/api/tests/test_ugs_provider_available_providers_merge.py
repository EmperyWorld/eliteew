# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for UGS provider status list construction when DB rows are missing or disabled.
# Invariants:
# - `get_available_providers` must not return an empty hub when active generation_types still reference a seeded runtime provider (e.g. llama).
# - `get_available_providers` must include ComfyUI for `/providers/status` when it is missing from DB rows and from generation-type bootstrap seeds.
# - `get_bootstrap_provider_seeds` must embed `provider_name` for admin bootstrap inserts.
# - Music Comfy timeout floor and contour URL routing must stay deterministic under env/config overrides.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

import asyncio
from typing import Any

from api.services.studio_comfy_workflows import build_music_forge_ace15_mvp_workflow
from api.services.ugs import provider_manager_service_v2 as provider_manager_module
from api.services.ugs.provider_manager_service_v2 import ProviderConfig, ProviderManagerServiceV2


class _MappingRow:
    def __init__(self, mapping: dict[str, Any]) -> None:
        self._mapping = mapping


class _GeneratedProvidersResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def __iter__(self) -> Any:
        yield from (_MappingRow(r) for r in self._rows)


class _BootstrapResult:
    def __init__(self, names: list[tuple[str, ...]]) -> None:
        self._names = names

    def __iter__(self) -> Any:
        yield from self._names


class _SplitDb:
    """Routes raw SQL text() to canned results."""

    def __init__(
        self,
        *,
        enabled_provider_rows: list[dict[str, Any]],
        bootstrap_names: list[tuple[str, ...]],
    ) -> None:
        self.enabled_provider_rows = enabled_provider_rows
        self.bootstrap_names = bootstrap_names

    async def execute(self, query: object) -> Any:
        q = getattr(query, "text", str(query))
        if "FROM generation_types" in q and "DISTINCT provider" in q:
            return _BootstrapResult(self.bootstrap_names)
        if "FROM generation_providers" in q and "ORDER BY provider_name" in q:
            return _GeneratedProvidersResult(self.enabled_provider_rows)
        msg = f"unexpected query in test stub: {q[:120]!s}"
        raise AssertionError(msg)


class _NoopDb:
    async def execute(self, query: object) -> Any:  # pragma: no cover - defensive for this test file
        msg = f"unexpected query in noop db: {query!s}"
        raise AssertionError(msg)


class _FakeComfyProvider:
    def __init__(self, base_url: str, *, output_audio_b64: str = "Zm9v") -> None:
        self.base_url = base_url
        self.last_timeout: int | None = None
        self.output_audio_b64 = output_audio_b64
        self.last_output_audio_fetch: tuple[str, str] | None = None

    async def close(self) -> None:
        return None

    async def generate_audio(self, workflow: dict[str, Any], output_node: str, timeout: int) -> dict[str, Any]:
        self.last_timeout = timeout
        return {
            "audio": [{"filename": "stub.mp3", "subfolder": "output", "data": "Zm9v"}],
            "metadata": {"output_node": output_node, "workflow_nodes": len(workflow)},
        }

    async def fetch_output_file_data_b64(self, filename: str, subfolder: str = "") -> str | None:
        self.last_output_audio_fetch = (filename, subfolder)
        return self.output_audio_b64


def _build_comfy_config(
    *,
    base_url: str = "http://stub-comfy:3000",
    timeout_seconds: int = 300,
    config_json: dict[str, Any] | None = None,
) -> ProviderConfig:
    return ProviderConfig(
        {
            "provider_name": "comfyui",
            "provider_type": "comfyui",
            "base_url": base_url,
            "health_endpoint": "/system_stats",
            "timeout_seconds": timeout_seconds,
            "max_concurrent": 2,
            "enabled": True,
            "config_json": config_json or {},
        }
    )


def test_get_bootstrap_provider_seeds_includes_provider_name() -> None:
    db = _SplitDb(enabled_provider_rows=[], bootstrap_names=[("llama",)])
    mgr = ProviderManagerServiceV2(db)  # type: ignore[arg-type]
    seeds = asyncio.run(mgr.get_bootstrap_provider_seeds())
    assert seeds
    assert seeds[0]["provider_name"] == "llama"
    assert seeds[0]["provider_type"] == "llama"


def test_get_available_providers_merges_seeds_when_db_empty() -> None:
    db = _SplitDb(enabled_provider_rows=[], bootstrap_names=[("llama",)])
    mgr = ProviderManagerServiceV2(db)  # type: ignore[arg-type]
    providers = asyncio.run(mgr.get_available_providers())
    names = sorted(p["name"] for p in providers)
    assert names == ["comfyui", "llama"]


def test_get_available_providers_includes_comfyui_when_only_db_llama() -> None:
    """Hub health grid: ComfyUI must appear even if no generation_types row references it."""
    db = _SplitDb(
        enabled_provider_rows=[
            {
                "provider_name": "llama",
                "provider_type": "llama",
                "base_url": "http://stack2-llama-chat:8080",
                "max_concurrent": 5,
                "config_json": {},
                "cost_per_request": None,
                "display_label": "Текст",
            }
        ],
        bootstrap_names=[],
    )
    mgr = ProviderManagerServiceV2(db)  # type: ignore[arg-type]
    providers = asyncio.run(mgr.get_available_providers())
    names = sorted(p["name"] for p in providers)
    assert names == ["comfyui", "llama"]


def test_get_available_providers_does_not_duplicate_db_rows() -> None:
    db = _SplitDb(
        enabled_provider_rows=[
            {
                "provider_name": "llama",
                "provider_type": "llama",
                "base_url": "http://stack2-llama-chat:8080",
                "max_concurrent": 5,
                "config_json": {},
                "cost_per_request": None,
                "display_label": "Текст",
            }
        ],
        bootstrap_names=[("llama",), ("comfyui",)],
    )
    mgr = ProviderManagerServiceV2(db)  # type: ignore[arg-type]
    providers = asyncio.run(mgr.get_available_providers())
    names = sorted(p["name"] for p in providers)
    assert names == ["comfyui", "llama"]


def test_call_comfyui_music_uses_provider_timeout_floor(monkeypatch: Any) -> None:
    async def _run() -> None:
        config = _build_comfy_config(timeout_seconds=90)
        mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
        fake = _FakeComfyProvider(base_url=str(config.base_url))
        mgr._comfyui_provider = fake  # noqa: SLF001 - test hook for timeout propagation
        mgr._comfyui_providers_by_base_url[str(config.base_url)] = fake  # noqa: SLF001 - test hook for routing

        monkeypatch.setattr(
            provider_manager_module,
            "build_ace_music_workflow",
            lambda _input_data: ({"107": {"class_type": "SaveAudioMP3", "inputs": {}}}, "107"),
        )

        out = await mgr._call_comfyui(  # noqa: SLF001 - test internal routing contract
            config,
            "music_generator_generate_ace_v2",
            {"lyrics": "stub lyrics", "tags": "stub tags"},
        )

        assert out["provider"] == "comfyui"
        assert fake.last_timeout == 600

    asyncio.run(_run())


def test_call_comfyui_music_evolution_routes_v4_workflow(monkeypatch: Any) -> None:
    async def _run() -> None:
        config = _build_comfy_config(timeout_seconds=90)
        mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
        fake = _FakeComfyProvider(base_url=str(config.base_url))
        mgr._comfyui_provider = fake  # noqa: SLF001 - test hook for timeout propagation
        mgr._comfyui_providers_by_base_url[str(config.base_url)] = fake  # noqa: SLF001 - test hook for routing
        called: dict[str, str] = {}

        def fake_v4_builder(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
            called["workflow"] = str(input_data.get("ugs_workflow"))
            return {"207": {"class_type": "SaveAudioMP3", "inputs": {}}}, "207"

        def fail_base_builder(_input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
            msg = "Evolution v4 payload must not route through v2/base builder"
            raise AssertionError(msg)

        monkeypatch.setattr(provider_manager_module, "build_ace_music_v4_sft_workflow", fake_v4_builder)
        monkeypatch.setattr(provider_manager_module, "build_ace_music_workflow", fail_base_builder)

        out = await mgr._call_comfyui(  # noqa: SLF001 - test internal routing contract
            config,
            "music_generator_evolution_xl_base",
            {
                "ugs_workflow": "v4",
                "music_evolution_run_id": "11111111-1111-1111-1111-111111111111",
                "lyrics": "[Verse]\nстрока",
                "tags": "Style: Nebula. 116 BPM, female vocal",
            },
        )

        assert called == {"workflow": "v4"}
        assert out["provider"] == "comfyui"
        assert fake.last_timeout == 600

    asyncio.run(_run())


def test_call_comfyui_music_forge_routes_dedicated_workflow(monkeypatch: Any) -> None:
    async def _run() -> None:
        config = _build_comfy_config(timeout_seconds=90)
        mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
        fake = _FakeComfyProvider(base_url=str(config.base_url))
        mgr._comfyui_provider = fake  # noqa: SLF001 - test hook for timeout propagation
        mgr._comfyui_providers_by_base_url[str(config.base_url)] = fake  # noqa: SLF001 - test hook for routing
        called: dict[str, str] = {}

        def fake_forge_builder(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
            called["run_id"] = str(input_data.get("music_forge_run_id"))
            return {"207": {"class_type": "SaveAudioMP3", "inputs": {}}}, "207"

        def fail_base_builder(_input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
            msg = "MusicForge payload must not route through legacy ACE builder"
            raise AssertionError(msg)

        monkeypatch.setattr(provider_manager_module, "build_music_forge_ace15_mvp_workflow", fake_forge_builder)
        monkeypatch.setattr(provider_manager_module, "build_ace_music_workflow", fail_base_builder)

        out = await mgr._call_comfyui(  # noqa: SLF001 - test internal routing contract
            config,
            "music_generator_forge_ace15_mvp",
            {
                "music_forge_run_id": "22222222-2222-2222-2222-222222222222",
                "lyrics": "[Verse]\nline",
                "tags": "Style: warm pop, female vocal",
            },
        )

        assert called == {"run_id": "22222222-2222-2222-2222-222222222222"}
        assert out["provider"] == "comfyui"
        assert fake.last_timeout == 600

    asyncio.run(_run())


def test_music_forge_workflow_applies_negative_prompt_to_text_encoder() -> None:
    workflow, out_node = build_music_forge_ace15_mvp_workflow(
        {
            "music_forge_run_id": "22222222-2222-2222-2222-222222222222",
            "lyrics": "[Verse]\nline\n\n[Chorus]\nline",
            "tags": "Style: warm pop, dry close lead vocal",
            "duration_seconds": 60,
            "bpm": 112,
            "language": "ru",
            "keyscale": "A minor",
            "temperature": 0.62,
            "top_p": 0.82,
            "top_k": 30,
            "min_p": 0.04,
            "cfg_scale": 1.65,
            "cfg": 6.2,
            "negative_prompt": "wordless vocal intro, ooh, aah, vocal wailing",
        }
    )

    assert out_node == "207"
    text_inputs = workflow["203"]["inputs"]
    assert text_inputs["lm_negative_prompt"] == "wordless vocal intro, ooh, aah, vocal wailing"
    assert text_inputs["lm_temperature"] == 0.62
    assert text_inputs["lm_top_p"] == 0.82
    assert text_inputs["lm_top_k"] == 30
    assert text_inputs["lm_min_p"] == 0.04
    assert workflow["202"]["inputs"]["cfg"] == 6.2


def test_resolve_comfyui_base_url_uses_contour_env(monkeypatch: Any) -> None:
    mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
    config = _build_comfy_config(base_url="http://db-comfy:3000")
    monkeypatch.setenv("COMFYUI_AUDIO_URL", "http://audio-comfy:3000")
    monkeypatch.setenv("COMFYUI_IMAGE_URL", "http://image-comfy:3000")

    assert mgr._resolve_comfyui_base_url(config, "music_generator_generate_ace_v3") == "http://audio-comfy:3000"  # noqa: SLF001
    assert mgr._resolve_comfyui_base_url(config, "image_generation_comfyui") == "http://image-comfy:3000"  # noqa: SLF001


def test_resolve_comfyui_base_url_prefers_config_json_contours(monkeypatch: Any) -> None:
    mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
    config = _build_comfy_config(
        base_url="http://db-comfy:3000",
        config_json={
            "audio_base_url": "http://cfg-audio-comfy:3000",
            "image_base_url": "http://cfg-image-comfy:3000",
        },
    )
    monkeypatch.setenv("COMFYUI_AUDIO_URL", "http://audio-env:3000")
    monkeypatch.setenv("COMFYUI_IMAGE_URL", "http://image-env:3000")

    assert mgr._resolve_comfyui_base_url(config, "music_generator_generate_ace_v5") == "http://cfg-audio-comfy:3000"  # noqa: SLF001
    assert mgr._resolve_comfyui_base_url(config, "image_studio_text_to_image") == "http://cfg-image-comfy:3000"  # noqa: SLF001


def test_fetch_comfyui_output_audio_prefers_active_provider_base_url(monkeypatch: Any) -> None:
    async def _run() -> None:
        mgr = ProviderManagerServiceV2(_NoopDb())  # type: ignore[arg-type]
        active = _FakeComfyProvider(base_url="http://active-comfy:3000", output_audio_b64="YXVkaW8=")
        mgr._comfyui_provider = active  # noqa: SLF001 - test hook for active provider preference
        mgr._comfyui_providers_by_base_url["http://active-comfy:3000"] = active  # noqa: SLF001 - test hook
        monkeypatch.setenv("COMFYUI_AUDIO_URL", "http://env-comfy:3000")

        out = await mgr.fetch_comfyui_output_audio("track.mp3", "audio")

        assert out == "YXVkaW8="
        assert active.last_output_audio_fetch == ("track.mp3", "audio")

    asyncio.run(_run())
