# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for ImperorG pipeline resilience and entity adaptation behavior.
# Invariants:
# - AI JSON contract errors must not force rollback (avoid async ORM expiration cascade).
# - Non-AI phase errors must rollback once and continue with reloaded instance state.
# - Entity media rewrite patches update product/masterclass/consultation/gallery image fields.
# Related:
# - api/services/imperorg_service.py
# ---
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest


class _DummySession:
    def __init__(self) -> None:
        self.rollback_calls = 0

    async def rollback(self) -> None:
        self.rollback_calls += 1


class _FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


class _FakeHttpClient:
    def __init__(self, blocks_payload: list[dict[str, object]]) -> None:
        self._blocks_payload = blocks_payload

    async def get(self, url: str, timeout: int = 30) -> _FakeResponse:
        del timeout
        if url.endswith("/content/blocks"):
            return _FakeResponse({"data": self._blocks_payload})
        raise AssertionError(f"Unexpected GET url: {url}")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_research_skips_web_search_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import imperorg_service as mod
    from api.services.imperorg_service import ImperorGConfig, ImperorGContext, ImperorGService

    async def _fail_web_search(*_args, **_kwargs):
        raise AssertionError("web_search must not run without use_web_search=true")

    monkeypatch.setattr(mod, "web_search", _fail_web_search)
    service = ImperorGService(_DummySession())  # type: ignore[arg-type]
    instance = SimpleNamespace(id=uuid4(), site_title="Site", site_topic="Topic")
    ctx = ImperorGContext()

    events = [
        event
        async for event in service._phase_research(  # noqa: SLF001
            ctx,
            instance,  # type: ignore[arg-type]
            str(uuid4()),
            ImperorGConfig(user_prompt="brief"),
        )
    ]

    assert ctx.search_results_text == ""
    assert any("выключен пользователем" in event for event in events)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_research_uses_quota_aware_search_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import imperorg_service as mod
    from api.services.imperorg_service import ImperorGConfig, ImperorGContext, ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    user_id = uuid4()
    calls: list[dict[str, object]] = []

    monkeypatch.setattr(service, "_build_search_queries", lambda _instance, _config: ["q1", "q2", "q3"])

    async def _fake_web_search(query: str, **kwargs):
        calls.append({"query": query, **kwargs})
        return [{"title": query, "content": "snippet", "url": ""}]

    monkeypatch.setattr(mod, "web_search", _fake_web_search)
    instance = SimpleNamespace(id=uuid4(), site_title="Site", site_topic="Topic")

    async for _ in service._phase_research(  # noqa: SLF001
        ImperorGContext(),
        instance,  # type: ignore[arg-type]
        str(user_id),
        ImperorGConfig(user_prompt="brief", use_web_search=True),
    ):
        pass

    assert [row["query"] for row in calls] == ["q1", "q2"]
    assert all(row["user_id"] == user_id for row in calls)
    assert all(row["db"] is db for row in calls)


class _EntityHttpClient:
    def __init__(
        self,
        *,
        products: list[dict[str, object]],
        consultations: list[dict[str, object]],
        masterclasses: list[dict[str, object]],
        gallery: list[dict[str, object]],
    ) -> None:
        self._products = products
        self._consultations = consultations
        self._masterclasses = masterclasses
        self._gallery = gallery

    async def get(self, url: str, timeout: int = 30) -> _FakeResponse:
        del timeout
        if url.endswith("/products"):
            return _FakeResponse({"data": self._products})
        if url.endswith("/consultations"):
            return _FakeResponse({"data": self._consultations})
        if url.endswith("/masterclasses"):
            return _FakeResponse({"data": self._masterclasses})
        if url.endswith("/gallery"):
            return _FakeResponse({"data": self._gallery})
        raise AssertionError(f"Unexpected GET url: {url}")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_pipeline_skips_rollback_for_ai_invalid_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGConfig, ImperorGService
    from api.services.site_studio_ai_service import SiteStudioAIError

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    instance_id = uuid4()
    instance = SimpleNamespace(id=instance_id)

    monkeypatch.setattr(
        service,
        "_active_phases",
        lambda _config: [
            {"id": "content_about", "label": "История", "icon": "book-open"},
            {"id": "seo", "label": "Видимость", "icon": "globe"},
        ],
    )

    reload_calls: list[object] = []

    async def _fake_reload(_instance_id: object):
        reload_calls.append(_instance_id)
        return None

    phase_calls: list[str] = []

    async def _fake_run_phase(ctx, phase_id, passed_instance, user_id, config):
        del ctx, passed_instance, user_id, config
        phase_calls.append(phase_id)
        if phase_id == "content_about":
            raise SiteStudioAIError("AI returned invalid JSON")
        yield "event: phase_step\ndata: {}\n\n"

    monkeypatch.setattr(service, "_reload_instance_by_id", _fake_reload)
    monkeypatch.setattr(service, "_run_phase", _fake_run_phase)

    events: list[str] = []
    async for event in service.run_pipeline(instance, "user-1", ImperorGConfig()):
        events.append(event)

    assert db.rollback_calls == 0
    assert reload_calls == []
    assert phase_calls == ["content_about", "seo"]
    assert any("pipeline_complete" in event for event in events)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_pipeline_rolls_back_and_uses_reloaded_instance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGConfig, ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    instance_id = uuid4()
    original_instance = SimpleNamespace(id=instance_id, marker="old")
    reloaded_instance = SimpleNamespace(id=instance_id, marker="new")

    monkeypatch.setattr(
        service,
        "_active_phases",
        lambda _config: [
            {"id": "research", "label": "Контекст", "icon": "search"},
            {"id": "strategy", "label": "Стратегия", "icon": "compass"},
        ],
    )

    reload_calls: list[object] = []

    async def _fake_reload(passed_id: object):
        reload_calls.append(passed_id)
        return reloaded_instance

    passed_markers: list[str] = []

    async def _fake_run_phase(ctx, phase_id, passed_instance, user_id, config):
        del ctx, user_id, config
        passed_markers.append(str(getattr(passed_instance, "marker", "")))
        if phase_id == "research":
            raise RuntimeError("boom")
        yield "event: phase_step\ndata: {}\n\n"

    monkeypatch.setattr(service, "_reload_instance_by_id", _fake_reload)
    monkeypatch.setattr(service, "_run_phase", _fake_run_phase)

    async for _ in service.run_pipeline(original_instance, "user-2", ImperorGConfig()):
        pass

    assert db.rollback_calls == 1
    assert reload_calls == [instance_id]
    assert passed_markers == ["old", "new"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_content_retries_once_on_missing_blocks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGContext, ImperorGService
    from api.services.site_studio_ai_service import SiteStudioAIError

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    instance = SimpleNamespace(id=uuid4())
    ctx = ImperorGContext()
    calls = 0

    async def _fake_generate_content_pack(*_: object, **__: object) -> dict[str, object]:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise SiteStudioAIError("Content pack JSON is missing blocks")
        return {"draft": {"title": "Recovered pack"}}

    monkeypatch.setattr(service._ai_service, "generate_content_pack", _fake_generate_content_pack)

    events: list[str] = []
    async for event in service._phase_content(ctx, instance, "user-3", "content_hero"):
        events.append(event)

    assert calls == 2
    assert len(ctx.content_drafts) == 1
    assert any("Recovered pack" in event for event in events)


@pytest.mark.unit
def test_load_imperorg_research_tuning_reads_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.imperorg_service import _load_imperorg_research_tuning

    monkeypatch.setenv("IMPERORG_SEARCH_QUERY_TIMEOUT_SEC", "9.5")
    monkeypatch.setenv("IMPERORG_CRAWL_URL_TIMEOUT_SEC", "15")
    monkeypatch.setenv("IMPERORG_SEARCH_MAX_QUERIES", "4")
    monkeypatch.setenv("IMPERORG_FALLBACK_MAX_QUERIES", "1")
    monkeypatch.setenv("IMPERORG_CRAWL_URL_LIMIT", "3")

    tuning = _load_imperorg_research_tuning()
    assert tuning.search_query_timeout_sec == pytest.approx(9.5)
    assert tuning.crawl_url_timeout_sec == pytest.approx(15.0)
    assert tuning.search_max_queries == 4
    assert tuning.fallback_max_queries == 1
    assert tuning.crawl_url_limit == 3


@pytest.mark.unit
def test_load_imperorg_entity_image_tuning_defaults_cover_all_gallery(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import _load_imperorg_entity_image_tuning

    for key in (
        "IMPERORG_ENTITY_IMAGES_PRODUCTS_LIMIT",
        "IMPERORG_ENTITY_IMAGES_CONSULTATIONS_LIMIT",
        "IMPERORG_ENTITY_IMAGES_MASTERCLASSES_LIMIT",
        "IMPERORG_ENTITY_IMAGES_GALLERY_LIMIT",
        "IMPERORG_ENTITY_IMAGES_GALLERY_ALLOWED_CATEGORIES",
    ):
        monkeypatch.delenv(key, raising=False)

    tuning = _load_imperorg_entity_image_tuning()
    assert tuning.products_limit == 100
    assert tuning.consultations_limit == 100
    assert tuning.masterclasses_limit == 100
    assert tuning.gallery_limit == 100
    # Empty = rewrite every gallery category (avoid silent skips after Imperorg "simplify").
    assert tuning.gallery_allowed_categories == ()


@pytest.mark.unit
def test_load_imperorg_entity_image_tuning_reads_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.imperorg_service import _load_imperorg_entity_image_tuning

    monkeypatch.setenv("IMPERORG_ENTITY_IMAGES_PRODUCTS_LIMIT", "5")
    monkeypatch.setenv("IMPERORG_ENTITY_IMAGES_CONSULTATIONS_LIMIT", "6")
    monkeypatch.setenv("IMPERORG_ENTITY_IMAGES_MASTERCLASSES_LIMIT", "7")
    monkeypatch.setenv("IMPERORG_ENTITY_IMAGES_GALLERY_LIMIT", "8")
    monkeypatch.setenv(
        "IMPERORG_ENTITY_IMAGES_GALLERY_ALLOWED_CATEGORIES",
        "consultations, masterclasses, diplomas",
    )

    tuning = _load_imperorg_entity_image_tuning()
    assert tuning.products_limit == 5
    assert tuning.consultations_limit == 6
    assert tuning.masterclasses_limit == 7
    assert tuning.gallery_limit == 8
    assert tuning.gallery_allowed_categories == ("consultations", "masterclasses", "diplomas")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_research_respects_tuning_query_caps(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGConfig, ImperorGContext, ImperorGResearchTuning, ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    service._research_tuning = ImperorGResearchTuning(
        search_max_queries=1,
        fallback_max_queries=1,
        crawl_url_limit=1,
        search_pause_sec=0.0,
        fallback_pause_sec=0.0,
    )

    monkeypatch.setattr(service, "_build_search_queries", lambda *_: ["primary-1", "primary-2"])
    monkeypatch.setattr(service, "_build_search_fallback_queries", lambda *_: ["fallback-1", "fallback-2"])
    monkeypatch.setattr("api.services.imperorg_service.format_search_results_for_prompt", lambda *_a, **_k: "")

    seen_queries: list[str] = []

    async def _fake_web_search(query: str, *, limit: int = 5, **_kwargs: object) -> list[dict[str, str]]:
        del limit
        seen_queries.append(query)
        return []

    monkeypatch.setattr("api.services.imperorg_service.web_search", _fake_web_search)

    instance = SimpleNamespace(id=uuid4(), site_title="Lexus ES300h", site_topic="Premium auto")
    ctx = ImperorGContext()

    async for _ in service._phase_research(ctx, instance, str(uuid4()), ImperorGConfig(use_web_search=True)):
        pass

    assert seen_queries == ["primary-1", "fallback-1"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_apply_full_rewrite_fallback_covers_missing_blocks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGContext, ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    ctx = ImperorGContext()
    instance = SimpleNamespace(
        id=uuid4(),
        user_id="user-5",
        compose_project_name="site-test",
        site_title="Brand",
        site_topic="Theme",
        template_key="olenti",
        site_slug="site-test",
    )

    monkeypatch.setattr(
        "api.services.site_studio_runtime_service.build_site_studio_internal_api_base_url",
        lambda _project: "http://site.test/api",
    )

    async def _fake_admin_token(*_: object, **__: object) -> str:
        return "token"

    monkeypatch.setattr(service, "_get_site_admin_token", _fake_admin_token)
    monkeypatch.setattr(service._ai_service, "get_draft_state", lambda _instance: {"brief": "", "siteBlueprint": {}})

    async def _fake_apply_site_settings(*_: object, **__: object) -> None:
        return None

    async def _fake_rewrite_entities(*_: object, **__: object) -> dict[str, int]:
        return {"товары": 0, "консультации": 0, "мастер-классы": 0}

    async def _fake_rewrite_entity_images(*_: object, **__: object) -> dict[str, int]:
        return {"товары": 0, "консультации": 0, "мастер-классы": 0, "галерея": 0}

    monkeypatch.setattr(service, "_apply_site_settings", _fake_apply_site_settings)
    monkeypatch.setattr(service, "_rewrite_site_entities", _fake_rewrite_entities)
    monkeypatch.setattr(service, "_rewrite_entity_images", _fake_rewrite_entity_images)
    monkeypatch.setattr(
        "api.services.imperorg_service.get_httpx_client",
        lambda: _FakeHttpClient(
            [
                {
                    "page": "contacts",
                    "section": "consultation_flow",
                    "key": "step_1",
                    "value": "old-1",
                    "maxLength": 320,
                },
                {
                    "page": "contacts",
                    "section": "consultation_flow",
                    "key": "step_2",
                    "value": "old-2",
                    "maxLength": 320,
                },
            ]
        ),
    )

    ai_calls: list[str] = []

    async def _fake_complete_json_prompt(*_: object, **kwargs: object) -> dict[str, object]:
        prompt = str(kwargs.get("prompt", ""))
        ai_calls.append(prompt)
        if 'Формат: {"blocks":' in prompt:
            return {
                "blocks": [
                    {
                        "page": "contacts",
                        "section": "consultation_flow",
                        "key": "step_1",
                        "value": "new-1",
                    }
                ]
            }
        if 'Формат: {"value":"..."}' in prompt:
            return {"value": "new-2"}
        raise AssertionError(f"Unexpected prompt format: {prompt[:120]}")

    monkeypatch.setattr(service._ai_service, "_complete_json_prompt", _fake_complete_json_prompt)

    write_calls: list[dict[str, object]] = []

    async def _fake_site_api_write(
        method: str, url: str, token: str, json_body: dict[str, object]
    ) -> dict[str, object]:
        del method, token
        if url.endswith("/content/blocks/bulk"):
            write_calls.append(json_body)
        return {"success": True}

    monkeypatch.setattr(service, "_site_api_write", _fake_site_api_write)

    events: list[str] = []
    async for event in service._phase_apply(ctx, instance, "user-5"):
        events.append(event)

    applied_blocks = [
        block for payload in write_calls for block in payload.get("blocks", []) if isinstance(block, dict)
    ]
    applied_identities = {
        (str(block.get("page")), str(block.get("section")), str(block.get("key"))) for block in applied_blocks
    }

    assert applied_identities == {
        ("contacts", "consultation_flow", "step_1"),
        ("contacts", "consultation_flow", "step_2"),
    }
    assert any("2 блоков перезаписано из 2 оставшихся" in event for event in events)
    assert ctx.apply_report["steps"]["full_rewrite"]["applied"] == 2
    assert ctx.apply_report["totals"]["applied"] >= 2
    assert any('Формат: {"value":"..."}' in call for call in ai_calls)


@pytest.mark.unit
def test_normalize_product_category_accepts_human_labels() -> None:
    from api.services.imperorg_service import ImperorGService

    assert ImperorGService._normalize_product_category("ингредиенты") == "ingredients"
    assert ImperorGService._normalize_product_category("Подарочный набор") == "accessories"
    assert ImperorGService._normalize_product_category("Парфюм") == "perfumes"
    assert ImperorGService._normalize_product_category("непонятно", fallback="ingredients") == "ingredients"


@pytest.mark.unit
def test_entity_image_prompt_and_idempotency_keep_guardrails() -> None:
    from api.services.imperorg_service import ImperorGService

    instance = SimpleNamespace(id="site-1", template_key="olenti")
    prompt = ImperorGService._build_entity_image_prompt(
        entity_kind="product",
        brand="Lexus ES300h",
        topic="premium auto",
        title="Executive detail",
        description="Interior care detail for Lexus ES300h Executive detail kit",
        blueprint={"visualDirection": "premium editorial"},
    )
    key = ImperorGService._build_entity_image_idempotency_key(
        instance=instance,
        entity_kind="product",
        entity_id="p-1",
        prompt=prompt,
    )

    assert "Text-free image" in prompt
    assert "no letters" in prompt
    assert "scene domain: premium auto" in prompt
    assert "premium editorial" in prompt
    assert "Interior care detail" in prompt
    # Brand / title must never appear — Comfy paints named literals as on-image text.
    assert "Lexus" not in prompt
    assert "ES300h" not in prompt
    assert "Executive detail" not in prompt
    assert "brand:" not in prompt.lower()
    assert "title:" not in prompt.lower()
    assert key.startswith("imperorg:entity-image:site-1:olenti:product:p-1:")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rewrite_products_patches_category_when_model_returns_valid_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]

    async def _fake_complete_json_prompt(*_: object, **__: object) -> dict[str, object]:
        return {
            "products": [
                {
                    "id": "p-1",
                    "name": "Новый продукт",
                    "shortDescription": "Короткое описание",
                    "category": "ингредиенты",
                }
            ]
        }

    monkeypatch.setattr(service._ai_service, "_complete_json_prompt", _fake_complete_json_prompt)

    patch_calls: list[dict[str, object]] = []

    async def _fake_site_api_write(
        method: str, url: str, token: str, json_body: dict[str, object]
    ) -> dict[str, object]:
        del method, url, token
        patch_calls.append(json_body)
        return {"success": True}

    monkeypatch.setattr(service, "_site_api_write", _fake_site_api_write)

    count = await service._rewrite_products(
        api_base="http://site.test/api",
        admin_token="token",
        products=[
            {
                "id": "p-1",
                "name": "Old",
                "category": "perfumes",
                "price": 1000,
                "collection": "base",
            }
        ],
        brand_context="ctx",
        user_id="user-6",
    )

    assert count == 1
    assert patch_calls
    assert patch_calls[0]["category"] == "ingredients"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rewrite_entity_images_updates_catalog_entities_and_gallery(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import ImperorGContext, ImperorGService

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    ctx = ImperorGContext(blueprint={"visualDirection": "clean editorial", "heroMood": "confident"})
    instance = SimpleNamespace(site_title="Brand", site_topic="Theme")

    monkeypatch.setattr(
        "api.services.imperorg_service.get_httpx_client",
        lambda: _EntityHttpClient(
            products=[
                {
                    "id": "p-1",
                    "name": "Product One",
                    "shortDescription": "Short product description",
                }
            ],
            consultations=[
                {
                    "id": "c-1",
                    "title": "Consultation One",
                    "shortDescription": "Short consultation description",
                }
            ],
            masterclasses=[
                {
                    "id": "m-1",
                    "title": "Masterclass One",
                    "shortDescription": "Short masterclass description",
                }
            ],
            gallery=[
                {
                    "id": "g-1",
                    "alt": "Gallery image alt",
                    "category": "diplomas",
                }
            ],
        ),
    )

    async def _fake_generate_entity_image_url(*_: object, **__: object) -> str:
        return "https://img.test/generated.png"

    async def _fake_resolve_generated_image_bytes(_url: str) -> bytes:
        return b"x" * 2048

    async def _fake_upload_entity_image_asset(
        *,
        api_base: str,
        admin_token: str,
        image_bytes: bytes,
        filename_hint: str,
    ) -> str:
        del api_base, admin_token, image_bytes
        return f"/uploads/{filename_hint}.png"

    monkeypatch.setattr(service, "_generate_entity_image_url", _fake_generate_entity_image_url)
    monkeypatch.setattr(service, "_resolve_generated_image_bytes", _fake_resolve_generated_image_bytes)
    monkeypatch.setattr(service, "_upload_entity_image_asset", _fake_upload_entity_image_asset)

    patch_calls: list[tuple[str, dict[str, object]]] = []

    async def _fake_site_api_write(
        method: str, url: str, token: str, json_body: dict[str, object]
    ) -> dict[str, object]:
        del method, token
        patch_calls.append((url, json_body))
        return {"success": True}

    monkeypatch.setattr(service, "_site_api_write", _fake_site_api_write)

    counts = await service._rewrite_entity_images(
        api_base="http://site.test/api",
        admin_token="token",
        ctx=ctx,
        instance=instance,
        user_id="user-7",
    )

    assert counts == {"товары": 1, "консультации": 1, "мастер-классы": 1, "галерея": 1}
    assert any(
        url.endswith("/products/p-1")
        and payload.get("image") == "/uploads/imperorg-product-p-1.png"
        and payload.get("images") == ["/uploads/imperorg-product-p-1.png"]
        for url, payload in patch_calls
    )
    assert any(
        url.endswith("/masterclasses/m-1") and payload.get("image") == "/uploads/imperorg-masterclass-m-1.png"
        for url, payload in patch_calls
    )
    assert any(
        url.endswith("/consultations/c-1") and payload.get("image") == "/uploads/imperorg-consultation-c-1.png"
        for url, payload in patch_calls
    )
    assert any(
        url.endswith("/gallery/g-1") and payload.get("url") == "/uploads/imperorg-gallery-g-1.png"
        for url, payload in patch_calls
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rewrite_entity_images_respects_limits_and_gallery_category_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.imperorg_service import (
        ImperorGContext,
        ImperorGEntityImageTuning,
        ImperorGService,
    )

    db = _DummySession()
    service = ImperorGService(db)  # type: ignore[arg-type]
    service._entity_image_tuning = ImperorGEntityImageTuning(
        products_limit=1,
        consultations_limit=1,
        masterclasses_limit=1,
        gallery_limit=1,
        gallery_allowed_categories=("diplomas",),
    )
    ctx = ImperorGContext(blueprint={"visualDirection": "clean editorial", "heroMood": "confident"})
    instance = SimpleNamespace(site_title="Brand", site_topic="Theme")

    monkeypatch.setattr(
        "api.services.imperorg_service.get_httpx_client",
        lambda: _EntityHttpClient(
            products=[
                {"id": "p-1", "name": "Product One", "shortDescription": "Short product description"},
                {"id": "p-2", "name": "Product Two", "shortDescription": "Second product description"},
            ],
            consultations=[
                {"id": "c-1", "title": "Consultation One", "shortDescription": "Short consultation description"},
                {"id": "c-2", "title": "Consultation Two", "shortDescription": "Second consultation description"},
            ],
            masterclasses=[
                {"id": "m-1", "title": "Masterclass One", "shortDescription": "Short masterclass description"},
                {"id": "m-2", "title": "Masterclass Two", "shortDescription": "Second masterclass description"},
            ],
            gallery=[
                {"id": "g-2", "alt": "Gallery image second", "category": "diplomas", "order": 2},
                {"id": "g-1", "alt": "Gallery image first", "category": "diplomas", "order": 1},
                {"id": "g-3", "alt": "Filtered category", "category": "brand", "order": 0},
            ],
        ),
    )

    async def _fake_generate_entity_image_url(*_: object, **__: object) -> str:
        return "https://img.test/generated.png"

    async def _fake_resolve_generated_image_bytes(_url: str) -> bytes:
        return b"x" * 2048

    async def _fake_upload_entity_image_asset(
        *,
        api_base: str,
        admin_token: str,
        image_bytes: bytes,
        filename_hint: str,
    ) -> str:
        del api_base, admin_token, image_bytes
        return f"/uploads/{filename_hint}.png"

    monkeypatch.setattr(service, "_generate_entity_image_url", _fake_generate_entity_image_url)
    monkeypatch.setattr(service, "_resolve_generated_image_bytes", _fake_resolve_generated_image_bytes)
    monkeypatch.setattr(service, "_upload_entity_image_asset", _fake_upload_entity_image_asset)

    patch_calls: list[tuple[str, dict[str, object]]] = []

    async def _fake_site_api_write(
        method: str, url: str, token: str, json_body: dict[str, object]
    ) -> dict[str, object]:
        del method, token
        patch_calls.append((url, json_body))
        return {"success": True}

    monkeypatch.setattr(service, "_site_api_write", _fake_site_api_write)

    counts = await service._rewrite_entity_images(
        api_base="http://site.test/api",
        admin_token="token",
        ctx=ctx,
        instance=instance,
        user_id="user-8",
    )

    assert counts == {"товары": 1, "консультации": 1, "мастер-классы": 1, "галерея": 1}
    patched_urls = {url for url, _payload in patch_calls}
    assert "http://site.test/api/products/p-1" in patched_urls
    assert "http://site.test/api/consultations/c-1" in patched_urls
    assert "http://site.test/api/masterclasses/m-1" in patched_urls
    assert "http://site.test/api/gallery/g-1" in patched_urls
    assert "http://site.test/api/products/p-2" not in patched_urls
    assert "http://site.test/api/consultations/c-2" not in patched_urls
    assert "http://site.test/api/masterclasses/m-2" not in patched_urls
    assert "http://site.test/api/gallery/g-2" not in patched_urls
    assert "http://site.test/api/gallery/g-3" not in patched_urls
