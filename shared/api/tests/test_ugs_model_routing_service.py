# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for DB-backed UGS model routing fallback order and request override handling.
# Invariants:
# - Route scope priority must stay stable because runtime text providers delegate model selection here.
# - Request-supplied models are ignored unless explicitly allowed by the route contract.
# Related:
# - api/services/ugs/model_routing_service.py
# ---

from __future__ import annotations

import asyncio

from api.services.ugs.model_routing_service import UGSModelRoutingService, infer_ugs_domain
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2


class _Setting:
    def __init__(self, value: dict[str, object]) -> None:
        self.value = value


class _Result:
    def __init__(self, setting: _Setting | None) -> None:
        self._setting = setting

    def scalar_one_or_none(self) -> _Setting | None:
        return self._setting


class _Db:
    def __init__(self, value: dict[str, object]) -> None:
        self._setting = _Setting(value)

    async def execute(self, _query: object) -> _Result:
        return _Result(self._setting)


class _ProviderManagerProbe(ProviderManagerServiceV2):
    def __init__(self) -> None:
        super().__init__(_Db({}))  # type: ignore[arg-type]
        self.seen_categories: list[str | None] = []

    async def _call_provider(
        self,
        provider_name: str,
        generation_type: str,
        input_data: dict[str, object],
        *,
        generation_category: str | None = None,
    ) -> dict[str, object]:
        self.seen_categories.append(generation_category)
        return {"provider": provider_name, "generation_type": generation_type, "input_data": input_data}

    async def _record_provider_success(self, provider_name: str) -> None:
        return None


def test_model_routing_prefers_specific_scope_over_provider_defaults() -> None:
    service = UGSModelRoutingService(
        _Db(
            {
                "global_default_model": "global-model",
                "provider_defaults": {"llama": "provider-model"},
                "category_defaults": {"text": "category-model"},
                "domain_defaults": {"professional_worlds": "domain-model"},
                "type_overrides": {"professional_worlds_realtor_object_intake": "type-model"},
            }
        )  # type: ignore[arg-type]
    )

    result = asyncio.run(
        service.resolve_for_type(
            type_key="professional_worlds_realtor_object_intake",
            provider_name="llama",
            category="text",
            provider_config={"default_model": "config-model"},
        )
    )

    assert result.model == "type-model"
    assert result.source == "type_overrides.professional_worlds_realtor_object_intake"


def test_model_routing_uses_category_default_when_runtime_passes_category() -> None:
    service = UGSModelRoutingService(
        _Db(
            {
                "global_default_model": "global-model",
                "provider_defaults": {"llama": "provider-model"},
                "category_defaults": {"music": "category-model"},
            }
        )  # type: ignore[arg-type]
    )

    result = asyncio.run(
        service.resolve_for_type(
            type_key="freeform_song_idea",
            provider_name="llama",
            category="music",
            provider_config={"default_model": "config-model"},
        )
    )

    assert result.model == "category-model"
    assert result.source == "category_defaults.music"


def test_provider_manager_execute_generation_forwards_generation_category() -> None:
    manager = _ProviderManagerProbe()

    asyncio.run(
        manager.execute_generation(
            "llama",
            "freeform_song_idea",
            {"prompt": "write a chorus"},
            generation_category="music",
        )
    )

    assert manager.seen_categories == ["music"]


def test_model_routing_ignores_request_model_without_allowlist() -> None:
    service = UGSModelRoutingService(
        _Db(
            {
                "provider_defaults": {"llama": "provider-model"},
                "request_model_override_allowlist": [],
            }
        )  # type: ignore[arg-type]
    )

    result = asyncio.run(
        service.resolve_for_type(
            type_key="text_chat",
            provider_name="llama",
            category="text",
            provider_config={},
            request_model="client-model",
        )
    )

    assert result.model == "provider-model"
    assert result.source == "provider_defaults.llama"
    assert result.warnings == ["input_data.model ignored; configure model routing in DB."]


def test_model_routing_allows_request_model_for_explicit_allowlist() -> None:
    service = UGSModelRoutingService(
        _Db({"request_model_override_allowlist": ["text_chat"]})  # type: ignore[arg-type]
    )

    result = asyncio.run(
        service.resolve_for_type(
            type_key="text_chat",
            provider_name="llama",
            category="text",
            provider_config={"default_model": "config-model"},
            request_model="client-model",
        )
    )

    assert result.model == "client-model"
    assert result.source == "request.input_data.model"


def test_infer_ugs_domain_uses_known_prefixes_before_category() -> None:
    assert infer_ugs_domain("music_generator_lyrics", "text") == "music"
    assert infer_ugs_domain("image_studio_image_prompt", "text") == "image_studio"
    assert infer_ugs_domain("video_studio_image_prompt", "text") == "image_studio"
    assert infer_ugs_domain("video_studio_image_to_video", "video") == "video_studio"
    assert infer_ugs_domain("text_chat", "text") == "text"
