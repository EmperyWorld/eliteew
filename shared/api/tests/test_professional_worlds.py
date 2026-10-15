# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Professional Worlds user scoping, prompt safety, profile/property flows, Realtor object intake parsing, idempotency, and SSE helpers.
# Invariants:
# - Tests avoid a live database; SQL parameters are inspected through a fake AsyncSession.
# - User-owned queries must keep user_id in params.
# Related:
# - api/services/professional_worlds/service.py
# - api/routers/professional_worlds_ai_runtime.py
# - api/routers/professional_worlds_deps.py
# - api/routers/professional_worlds_realtor_media_runtime.py
# - tests/test_professional_worlds_snapshot.py (aggregate snapshot, no router import)
# ---

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

import pytest

from api.routers.professional_worlds_ai_runtime import _extract_result_text, _stream_ugs_text_artifact
from api.routers.professional_worlds_deps import _idempotency_key, _strip_unresolved_prompt_tokens
from api.routers.professional_worlds_realtor_media_runtime import _build_pw_media_enhancement_input_data
from api.schemas.professional_worlds import (
    RealtorJtbdContext,
    RealtorLeadCreate,
    RealtorPropertyCreate,
    SpecialistProfileUpsert,
)
from api.services.professional_worlds.object_intake_parsing import extract_object_intake_text_from_ugs_result
from api.services.professional_worlds.service import ProfessionalWorldsService
from api.services.professional_worlds.snapshot_helpers import (
    _runtime_module_enabled,
    _should_fetch_artifacts_snapshot,
    _should_fetch_deals_snapshot,
    _should_fetch_learning_snapshot,
    _vertical_supports_listing_workspace,
    resolve_pw_ugs_type_key,
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@dataclass
class _FakeRequest:
    headers: dict[str, str]


class _FakeMappings:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def all(self) -> list[dict[str, Any]]:
        return self._rows

    def one(self) -> dict[str, Any]:
        return self._rows[0]

    def one_or_none(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None


class _FakeResult:
    rowcount = 1

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _FakeDb:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows or []
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.committed = False

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        self.calls.append((str(statement), params or {}))
        return _FakeResult(self.rows)

    async def commit(self) -> None:
        self.committed = True


class _QueuedFakeDb:
    """Async session fake that consumes `_FakeResult` instances in FIFO order."""

    def __init__(self, responses: list[_FakeResult]) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.committed = False

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        self.calls.append((str(statement), params or {}))
        if self._responses:
            return self._responses.pop(0)
        return _FakeResult([])

    async def commit(self) -> None:
        self.committed = True


def test_idempotency_key_prefers_body_then_headers() -> None:
    request = _FakeRequest(headers={"Idempotency-Key": "header-key-123"})

    assert _idempotency_key("body-key-123", request) == "body-key-123"
    assert _idempotency_key(None, request) == "header-key-123"


def test_extract_result_text_handles_dict_and_preview() -> None:
    assert _extract_result_text({"result": {"text": "Готово"}}) == "Готово"
    assert _extract_result_text({"result": {}, "result_preview": "Превью"}) == "Превью"


def test_strip_unresolved_prompt_tokens_removes_unknown_placeholders() -> None:
    assert _strip_unresolved_prompt_tokens("A {{unknown}} B").strip() == "A  B"


def test_build_pw_media_enhancement_input_data_uses_db_parameters_as_is() -> None:
    payload = _build_pw_media_enhancement_input_data(
        prompt="Edit facade {{preset_display_name}}",
        image_base64="abc123",
        preset_type_key="marketplace_crop",
        preset_parameters={
            "steps": 22,
            "cfg": 4.2,
            "denoise": 0.68,
            "megapixels": 2.4,
            "resolution_steps": 2,
        },
    )
    assert payload["prompt"] == "Edit facade"
    assert payload["negative_prompt"] == ""
    assert payload["steps"] == 22
    assert payload["cfg"] == 4.2
    assert payload["denoise"] == 0.68
    assert payload["megapixels"] == 2.4
    assert payload["resolution_steps"] == 2


def test_build_pw_media_enhancement_input_data_keeps_defaults_without_db_parameters() -> None:
    payload = _build_pw_media_enhancement_input_data(
        prompt="Interior cleanup",
        image_base64="abc123",
        preset_type_key="qwen_image_plus",
        preset_parameters={},
    )
    assert payload["seed"] == -1
    assert "steps" not in payload


def test_build_pw_media_enhancement_input_data_merges_explicit_negative_prompt() -> None:
    payload = _build_pw_media_enhancement_input_data(
        prompt="Interior cleanup",
        image_base64="abc123",
        preset_type_key="image_studio_image_edit",
        preset_parameters={},
        explicit_negative_prompt="no ad poster, no billboard",
    )
    assert payload["negative_prompt"] == "no ad poster, no billboard"


@pytest.mark.anyio
async def test_get_property_query_is_scoped_by_user_id() -> None:
    user_id = uuid4()
    property_id = uuid4()
    db = _FakeDb()
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    await service.get_property(user_id, property_id)

    statement, params = db.calls[0]
    assert "user_id = :user_id" in statement
    assert params["user_id"] == user_id
    assert params["property_id"] == property_id


@pytest.mark.anyio
async def test_profile_upsert_commits_and_keeps_user_scope() -> None:
    user_id = uuid4()
    profile_id = uuid4()
    db = _FakeDb(
        [
            {
                "id": profile_id,
                "user_id": user_id,
                "vertical_slug": "realtor",
                "display_name": "Анна",
                "headline": "Риэлтор Владивостока",
                "city": "Владивосток",
                "agency_name": "EW Realty",
                "specialization": ["Новостройки"],
                "profile_data": {"areas": ["Центр"]},
                "is_public_ready": False,
                "created_at": "2026-05-05T00:00:00",
                "updated_at": "2026-05-05T00:00:00",
            }
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    row = await service.upsert_profile(
        user_id,
        SpecialistProfileUpsert(
            vertical_slug="realtor",
            display_name="Анна",
            headline="Риэлтор Владивостока",
            city="Владивосток",
            agency_name="EW Realty",
            specialization=["Новостройки"],
            profile_data={"areas": ["Центр"]},
        ),
    )

    assert row["id"] == profile_id
    assert db.calls[-1][1]["user_id"] == user_id
    assert db.committed is True


@pytest.mark.anyio
async def test_property_create_uses_user_id_and_serializes_jtbd() -> None:
    user_id = uuid4()
    property_id = uuid4()
    db = _FakeDb(
        [
            {
                "id": property_id,
                "user_id": user_id,
                "title": "Видовая квартира",
                "property_type": "apartment",
                "deal_type": "sale",
                "city": "Владивосток",
                "district": "Центр",
                "address": None,
                "price": None,
                "area_m2": None,
                "rooms": 2,
                "floor": None,
                "total_floors": None,
                "view": "море",
                "infrastructure": ["набережная"],
                "jtbd_context": {},
                "facts": {},
                "status": "draft",
                "created_at": "2026-05-05T00:00:00",
                "updated_at": "2026-05-05T00:00:00",
            }
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    await service.create_property(
        user_id,
        RealtorPropertyCreate(
            title="Видовая квартира",
            district="Центр",
            rooms=2,
            view="море",
            infrastructure=["набережная"],
            jtbd_context=RealtorJtbdContext(
                trigger_context="хочет жить у моря",
                expected_result="светлая квартира",
                emotional_transformation="спокойствие после работы",
            ),
        ),
    )

    params = db.calls[-1][1]
    assert params["user_id"] == user_id
    assert "спокойствие после работы" in params["jtbd_context"]
    assert db.committed is True


@pytest.mark.anyio
async def test_realtor_lead_list_and_create_are_scoped_by_user() -> None:
    user_id = uuid4()
    lead_id = uuid4()
    db = _FakeDb(
        [
            {
                "id": lead_id,
                "user_id": user_id,
                "vertical_slug": "realtor",
                "name": "Мария",
                "contact": "+7",
                "source": "site",
                "status": "new",
                "notes": "Interested in sea view",
                "converted_client_id": None,
                "lead_data": {"budget": 12000000},
                "created_at": "2026-05-05T00:00:00",
                "updated_at": "2026-05-05T00:00:00",
            }
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    listed = await service.list_realtor_leads(user_id)
    created = await service.create_realtor_lead(
        user_id,
        RealtorLeadCreate(
            name="Мария",
            contact="+7",
            source="site",
            notes="Interested in sea view",
            lead_data={"budget": 12000000},
        ),
    )

    list_statement, list_params = db.calls[0]
    create_params = db.calls[-1][1]
    assert "FROM realtor_leads" in list_statement
    assert "WHERE user_id = :uid" in list_statement
    assert list_params["uid"] == user_id
    assert listed[0]["id"] == lead_id
    assert created["user_id"] == user_id
    assert create_params["uid"] == user_id
    assert '"budget": 12000000' in create_params["ldata"]
    assert db.committed is True


@pytest.mark.anyio
async def test_convert_realtor_lead_to_client_creates_client_and_links_lead() -> None:
    user_id = uuid4()
    lead_id = uuid4()
    client_id = uuid4()
    lead_row = {
        "id": lead_id,
        "user_id": user_id,
        "vertical_slug": "realtor",
        "name": "Мария",
        "contact": "+7",
        "source": "site",
        "status": "new",
        "notes": "Sea view",
        "converted_client_id": None,
        "lead_data": {},
    }
    client_row = {
        "id": client_id,
        "user_id": user_id,
        "vertical_slug": "realtor",
        "name": "Мария",
        "contact": "+7",
        "need_summary": "Sea view",
        "budget_from": None,
        "budget_to": None,
        "preferred_areas": [],
        "emotional_motive": None,
        "next_action": None,
        "status": "lead",
        "created_at": "2026-05-05T00:00:00",
        "updated_at": "2026-05-05T00:00:00",
    }
    updated_lead = {
        **lead_row,
        "converted_client_id": client_id,
        "status": "converted",
        "created_at": "2026-05-05T00:00:00",
        "updated_at": "2026-05-05T00:00:01",
    }
    db = _QueuedFakeDb(
        [
            _FakeResult([lead_row]),
            _FakeResult([client_row]),
            _FakeResult([updated_lead]),
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    result = await service.convert_realtor_lead_to_client(user_id, lead_id)

    assert result["client"]["id"] == client_id
    assert result["lead"]["converted_client_id"] == client_id
    assert "INSERT INTO professional_clients" in db.calls[1][0]
    assert "UPDATE realtor_leads" in db.calls[2][0]
    assert db.committed is True


def test_realtor_prompt_keeps_safety_rules_and_jtbd_context() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]
    property_id = UUID("00000000-0000-0000-0000-000000000001")
    recipe, prompt = service.build_realtor_prompt(
        {
            "id": property_id,
            "title": "Квартира у моря",
            "deal_type": "sale",
            "property_type": "apartment",
            "city": "Владивосток",
            "district": "Центр",
            "address": "Океанский проспект",
            "price": "15000000",
            "area_m2": "58",
            "rooms": 2,
            "floor": 9,
            "total_floors": 18,
            "view": "море",
            "infrastructure": ["набережная", "кафе"],
            "jtbd_context": {
                "trigger_context": "когда хочется жить ближе к морю",
                "expected_result": "дом и рабочее пространство",
                "emotional_transformation": "чувствовать легкость после дня",
                "audience_segment": "семья",
            },
        },
        body=type("Body", (), {"tone": "jtbd", "instruction": None})(),
        content_pack=False,
    )

    assert recipe == "realtor_property_description_jtbd"
    assert "Не выдумывай факты" in prompt
    assert "чувствовать легкость после дня" in prompt


def test_object_intake_parser_normalizes_structured_output_and_warnings() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]

    preview = service.parse_object_intake_result(
        """
        {
          "property": {
            "title": "Квартира у моря",
            "district": "Центр",
            "price": 15000000,
            "area_m2": 58,
            "rooms": 2,
            "infrastructure": ["набережная"],
            "facts": {"balcony": true}
          },
          "confidence": {"price": 0.91},
          "warnings": ["Проверить документы"]
        }
        """,
        "Гарантированная доходность, юридически чистая квартира у моря",
    )

    assert preview["property"]["city"] == "Владивосток"
    assert preview["property"]["rooms"] == 2
    assert preview["confidence"]["price"] == 0.91
    assert any("доходность" in warning for warning in preview["warnings"])
    assert not any("[model_returned_non_json]" in w for w in preview["warnings"])
    assert not any("[intake_parse_fallback]" in w for w in preview["warnings"])
    assert preview["intake_diagnostics"]["intake_fallback"] is False
    assert preview["intake_diagnostics"]["parse_failed"] is False
    assert preview["intake_diagnostics"]["had_property_key"] is True


def test_object_intake_parser_handles_markdown_fenced_json() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]
    text = '```json\n{"property": {"title": "У моря", "rooms": 1}}\n```'
    preview = service.parse_object_intake_result(text, "", idempotency_key="idem-1")
    assert preview["property"]["title"] == "У моря"
    assert preview["property"]["rooms"] == 1
    assert not any("[model_returned_non_json]" in w for w in preview["warnings"])
    assert not any("[intake_parse_fallback]" in w for w in preview["warnings"])


def test_object_intake_parser_warns_when_property_missing() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]
    preview = service.parse_object_intake_result('{"confidence": {}}', "src", idempotency_key=None)
    assert preview["property"]["title"] == "Новый объект"
    assert any("[intake_parse_fallback]" in w for w in preview["warnings"])
    assert not any("[model_returned_non_json]" in w for w in preview["warnings"])
    assert preview["intake_diagnostics"]["intake_fallback"] is True
    assert preview["intake_diagnostics"]["had_property_key"] is False


def test_object_intake_parser_warns_on_non_json() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]
    preview = service.parse_object_intake_result(
        "Сначала текст без JSON вообще", "Примечание без json", idempotency_key="k"
    )
    assert any("[model_returned_non_json]" in w for w in preview["warnings"])
    assert preview["intake_diagnostics"]["parse_failed"] is True
    assert preview["intake_diagnostics"]["intake_fallback"] is True


def test_object_intake_coerces_embedded_property_json_inside_ugs_dict() -> None:
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]
    inner = {"property": {"title": "From nested", "price": 777}}
    text = extract_object_intake_text_from_ugs_result({"wrap": json.dumps(inner, ensure_ascii=False)}, None)
    preview = service.parse_object_intake_result(text, "")
    assert preview["property"]["title"] == "From nested"
    assert preview["property"]["price"] == 777
    assert not any("[model_returned_non_json]" in w for w in preview["warnings"])


@pytest.mark.anyio
async def test_get_media_batch_job_scopes_owner_in_batch_query() -> None:
    user_id = uuid4()
    property_id = uuid4()
    batch_id = uuid4()
    prop_row = {
        "id": property_id,
        "user_id": user_id,
        "title": "t",
        "property_type": "apartment",
        "deal_type": "sale",
        "city": "Vladivostok",
        "district": None,
        "address": None,
        "price": None,
        "area_m2": None,
        "rooms": None,
        "floor": None,
        "total_floors": None,
        "view": None,
        "infrastructure": [],
        "jtbd_context": {},
        "facts": {},
        "status": "draft",
        "created_at": "2026-05-05T00:00:00",
        "updated_at": "2026-05-05T00:00:00",
    }
    db = _QueuedFakeDb(
        [
            _FakeResult([prop_row]),
            _FakeResult([]),
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]
    detail = await service.get_media_batch_job(user_id, property_id, batch_id)
    assert detail is None
    _batch_stmt, batch_params = db.calls[1]
    assert ":user_id" in _batch_stmt
    assert batch_params["user_id"] == user_id


@pytest.mark.anyio
async def test_create_media_batch_is_idempotent_per_user_property_key() -> None:
    user_id = uuid4()
    property_id = uuid4()
    existing_bid = uuid4()
    cid = uuid4()
    ej = uuid4()
    item_id = uuid4()
    now = "2026-05-05T00:00:00"
    prop_row = {
        "id": property_id,
        "user_id": user_id,
        "title": "t",
        "property_type": "apartment",
        "deal_type": "sale",
        "city": "Vladivostok",
        "district": None,
        "address": None,
        "price": None,
        "area_m2": None,
        "rooms": None,
        "floor": None,
        "total_floors": None,
        "view": None,
        "infrastructure": [],
        "jtbd_context": {},
        "facts": {},
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    batch_row = {
        "id": existing_bid,
        "user_id": user_id,
        "property_id": property_id,
        "preset_key": "premium_gallery",
        "status": "queued",
        "instruction": None,
        "idempotency_key": "dup-key",
        "batch_meta": {"source_count": 1},
        "created_at": now,
        "updated_at": now,
    }
    item_row = {
        "id": item_id,
        "batch_job_id": existing_bid,
        "source_content_id": cid,
        "enhancement_job_id": ej,
        "preset_key": "premium_gallery",
        "status": "queued",
        "review_decision": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    job_row = {
        "id": ej,
        "property_id": property_id,
        "source_content_id": cid,
        "output_content_id": None,
        "preset_key": "premium_gallery",
        "status": "queued",
        "instruction": None,
        "provider_result": {},
        "batch_job_id": existing_bid,
        "created_at": now,
        "updated_at": now,
    }
    queue = [
        _FakeResult([prop_row]),
        _FakeResult([{"id": existing_bid}]),
        _FakeResult([prop_row]),
        _FakeResult([batch_row]),
        _FakeResult([item_row]),
        _FakeResult([job_row]),
    ]
    db = _QueuedFakeDb(queue)
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]
    out = await service.create_media_batch_job(
        user_id=user_id,
        property_id=property_id,
        preset_key="premium_gallery",
        instruction=None,
        source_content_ids=[cid],
        idempotency_key="dup-key",
    )
    assert out is not None
    inserts = [c for c in db.calls if "INSERT INTO realtor_media_batch_jobs" in c[0]]
    assert inserts == []
    assert out["batch"]["id"] == existing_bid


@pytest.mark.anyio
async def test_upsert_brand_visual_kit_scopes_conflict_target() -> None:
    uid = uuid4()
    kit_id = uuid4()
    kit = {"primary_color": "#111111"}
    db = _FakeDb(
        [
            {
                "id": kit_id,
                "user_id": uid,
                "vertical_slug": "realtor",
                "kit": kit,
                "created_at": "2026-05-05T00:00:00",
                "updated_at": "2026-05-05T00:00:00",
            },
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]
    row = await service.upsert_brand_visual_kit(uid, kit)
    stmt, params = db.calls[0]
    assert "ON CONFLICT (user_id, vertical_slug)" in stmt
    assert params["user_id"] == uid
    assert row["id"] == kit_id
    assert db.committed


@pytest.mark.anyio
async def test_photo_preset_lookup_requires_active_realtor_preset() -> None:
    db = _FakeDb()
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    await service.get_photo_preset("realtor", "brighten")

    statement, params = db.calls[0]
    assert "professional_photo_presets" in statement
    assert "is_active = true" in statement
    assert params["vertical_slug"] == "realtor"
    assert params["preset_key"] == "brighten"


@pytest.mark.anyio
async def test_list_artifacts_scoped_by_vertical_slug() -> None:
    uid = uuid4()
    db = _FakeDb([])
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    await service.list_artifacts(uid, vertical_slug="testo")

    _stmt, params = db.calls[0]
    assert params["user_id"] == uid
    assert params["vertical_slug"] == "testo"


@pytest.mark.anyio
async def test_list_artifacts_filtered_passes_vertical_slug() -> None:
    uid = uuid4()
    db = _FakeDb([])
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    await service.list_artifacts_filtered(
        uid,
        vertical_slug="consultant",
        module_key="profile",
    )

    _stmt, params = db.calls[0]
    assert params["vertical_slug"] == "consultant"
    assert params["module_key"] == "profile"


def test_router_registers_put_my_profile() -> None:
    """Upsert helper must remain a mounted FastAPI route (regression guard)."""

    from fastapi.routing import APIRoute

    from api.routers import professional_worlds as pw_router

    methods_accum: set[str] = set()
    for route in pw_router.router.routes:
        if not isinstance(route, APIRoute):
            continue
        path = getattr(route, "path", "") or ""
        if path.rstrip("/").endswith("/me/profile"):
            methods_accum.update(route.methods or set())
    assert "GET" in methods_accum and "PUT" in methods_accum


@pytest.mark.anyio
async def test_apply_accepted_enhancement_replaces_listing_media() -> None:
    user_id = uuid4()
    property_id = uuid4()
    source_id = uuid4()
    output_id = uuid4()
    db = _QueuedFakeDb(
        [
            _FakeResult([{"id": property_id}]),
            _FakeResult([{"id": uuid4()}]),
            _FakeResult([]),
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    result = await service.apply_accepted_enhancement_to_property(
        user_id,
        property_id,
        source_content_id=source_id,
        output_content_id=output_id,
        preset_key="premium_interior",
    )

    assert result == {"replaced_count": 1, "attached_new": False}
    assert "UPDATE realtor_property_media" in db.calls[1][0]
    assert db.calls[1][1]["source_id"] == source_id
    assert db.calls[1][1]["output_id"] == output_id
    assert db.committed


@pytest.mark.anyio
async def test_apply_accepted_enhancement_attaches_when_source_not_on_listing() -> None:
    user_id = uuid4()
    property_id = uuid4()
    output_id = uuid4()
    db = _QueuedFakeDb(
        [
            _FakeResult([{"id": property_id}]),
            _FakeResult([]),
            _FakeResult([{"id": property_id}]),
            _FakeResult(
                [
                    {
                        "id": uuid4(),
                        "property_id": property_id,
                        "unified_content_id": output_id,
                        "caption": "AI: premium_interior",
                        "sort_order": 0,
                        "created_at": "2026-06-21T00:00:00",
                    }
                ]
            ),
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    result = await service.apply_accepted_enhancement_to_property(
        user_id,
        property_id,
        source_content_id=uuid4(),
        output_content_id=output_id,
        preset_key="premium_interior",
    )

    assert result == {"replaced_count": 0, "attached_new": True}
    assert "INSERT INTO realtor_property_media" in db.calls[3][0]


def test_resolve_pw_ugs_type_key_prefers_action_config() -> None:
    assert (
        resolve_pw_ugs_type_key({"ugs_type_key": "professional_worlds_realtor_sales_copy"})
        == "professional_worlds_realtor_sales_copy"
    )
    assert resolve_pw_ugs_type_key({}) == "text_chat"


@pytest.mark.anyio
async def test_stream_ugs_text_artifact_uses_action_type_key() -> None:
    captured: dict[str, str] = {}

    class _FakeUgs:
        async def start_generation_for_stream(self, **kwargs: Any) -> dict[str, Any]:
            captured["type_key"] = str(kwargs.get("type_key") or "")
            return {"status": "completed", "result": {"text": "ok"}}

        async def stream_generation_events(self, *_args: Any, **_kwargs: Any) -> Any:
            if False:  # pragma: no cover
                yield {}

    class _FakeService:
        def build_ugs_input(self, prompt: str) -> dict[str, str]:
            return {"prompt": prompt}

        async def save_artifact(self, **_kwargs: Any) -> dict[str, str]:
            return {"id": str(uuid4())}

    events: list[str] = []
    async for chunk in _stream_ugs_text_artifact(
        user_id=uuid4(),
        service=_FakeService(),  # type: ignore[arg-type]
        ugs_service=_FakeUgs(),  # type: ignore[arg-type]
        type_key="professional_worlds_realtor_sales_copy",
        prompt="hello",
        recipe_key="sales_copy",
        artifact_title="t",
        source_type="realtor_property",
        source_id=uuid4(),
        idempotency_key=None,
    ):
        events.append(chunk)

    assert captured["type_key"] == "professional_worlds_realtor_sales_copy"
    assert any("event: result" in line for line in events)


def test_runtime_module_enabled_normalizes_hyphen_and_underscore() -> None:
    modules = [{"module_key": "media_studio", "is_enabled": True}]
    assert _runtime_module_enabled(modules, "media-studio") is True
    assert _runtime_module_enabled(modules, "learning") is False


def test_should_fetch_deals_when_clients_enabled_only() -> None:
    modules = [{"module_key": "clients", "is_enabled": True}]
    assert _should_fetch_deals_snapshot(modules) is True


def test_should_fetch_learning_only_when_learning_enabled() -> None:
    assert _should_fetch_learning_snapshot([{"module_key": "learning", "is_enabled": True}]) is True
    assert _should_fetch_learning_snapshot([{"module_key": "clients", "is_enabled": True}]) is False


def test_should_fetch_artifacts_only_when_artifacts_enabled() -> None:
    assert _should_fetch_artifacts_snapshot([{"module_key": "artifacts", "is_enabled": True}]) is True
    assert _should_fetch_artifacts_snapshot([]) is False


def test_listing_workspace_requires_objects_module() -> None:
    modules = [{"module_key": "objects", "is_enabled": True}]
    assert _vertical_supports_listing_workspace("realtor", modules) is True
    assert _vertical_supports_listing_workspace("realtor", []) is False
    assert _vertical_supports_listing_workspace("testo", modules) is False
