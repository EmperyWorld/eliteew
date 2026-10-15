# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for professional worlds media target resolution by vertical context.
# Invariants:
# - Consultant context raises UnsupportedMediaContextError without DB access.
# Related:
# - api/services/professional_worlds/media_target_adapter.py
# ---

from __future__ import annotations

from uuid import uuid4

import pytest

from api.services.professional_worlds import media_target_adapter as adapter


@pytest.mark.anyio
async def test_resolve_media_target_consultant_is_unsupported() -> None:
    with pytest.raises(adapter.UnsupportedMediaContextError) as exc:
        await adapter.resolve_media_target(
            None,  # type: ignore[arg-type]
            user_id=uuid4(),
            context_type="consultant",
            target_id=uuid4(),
        )
    assert exc.value.context_type == "consultant"


@pytest.mark.anyio
async def test_resolve_media_target_realtor_requires_owned_property(monkeypatch) -> None:
    user_id = uuid4()
    property_id = uuid4()

    async def fake_get_property(_db: object, uid: object, pid: object) -> dict[str, str] | None:
        assert uid == user_id
        assert pid == property_id
        return {"id": str(property_id)}

    monkeypatch.setattr(adapter, "get_property", fake_get_property)

    target = await adapter.resolve_media_target(
        None,  # type: ignore[arg-type]
        user_id=user_id,
        context_type="realtor",
        target_id=property_id,
    )
    assert target.context_type == "realtor"
    assert target.property_id == property_id


@pytest.mark.anyio
async def test_resolve_media_target_realtor_not_found(monkeypatch) -> None:
    async def fake_get_property(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(adapter, "get_property", fake_get_property)

    with pytest.raises(adapter.MediaTargetNotFoundError):
        await adapter.resolve_media_target(
            None,  # type: ignore[arg-type]
            user_id=uuid4(),
            context_type="realtor",
            target_id=uuid4(),
        )


@pytest.mark.anyio
async def test_resolve_media_target_unknown_context() -> None:
    with pytest.raises(adapter.UnsupportedMediaContextError) as exc:
        await adapter.resolve_media_target(
            None,  # type: ignore[arg-type]
            user_id=uuid4(),
            context_type="testo",
            target_id=uuid4(),
        )
    assert exc.value.context_type == "testo"
