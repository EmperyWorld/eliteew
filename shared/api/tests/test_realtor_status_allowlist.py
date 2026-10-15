# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Realtor Pro showing / publication-channel status allowlists.
# Invariants:
# - Unknown statuses raise; schema validators surface as ValidationError.
# Related:
# - api/schemas/realtor_status.py
# - api/schemas/professional_worlds.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from api.schemas.professional_worlds import (
    PublicationChannelPatch,
    PublicationChannelUpsert,
    RealtorPropertyShowingCreate,
    RealtorPropertyShowingUpdate,
)
from api.schemas.realtor_status import (
    normalize_realtor_publication_channel_status,
    normalize_realtor_showing_status,
)


def test_normalize_showing_status_accepts_allowlist() -> None:
    assert normalize_realtor_showing_status("Planned") == "planned"
    assert normalize_realtor_showing_status("follow_up") == "follow_up"


def test_normalize_showing_status_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="invalid realtor showing status"):
        normalize_realtor_showing_status("cancelled")


def test_normalize_publication_channel_status_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="invalid realtor publication channel status"):
        normalize_realtor_publication_channel_status("draft")


def test_showing_create_schema_rejects_invalid_status() -> None:
    with pytest.raises(ValidationError):
        RealtorPropertyShowingCreate(
            property_id=uuid4(),
            scheduled_at=datetime.now(UTC),
            status="nope",
        )


def test_showing_update_and_channel_schemas_reject_invalid_status() -> None:
    with pytest.raises(ValidationError):
        RealtorPropertyShowingUpdate(status="won")
    with pytest.raises(ValidationError):
        PublicationChannelUpsert(channel_key="avito", status="live")
    with pytest.raises(ValidationError):
        PublicationChannelPatch(status="archived")
