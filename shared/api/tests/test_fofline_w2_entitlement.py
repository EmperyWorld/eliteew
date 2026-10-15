# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow lock for FoFline W2: session assert channel fofline requires allow_fofline;
# SessionAssertRequest accepts channel desktop|fofline.
# Invariants:
# - fofline_not_allowed when allow_fofline is false (fail closed).
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4 / W2
# ---

from __future__ import annotations

from api.schemas.desktop_client.models import SessionAssertRequest
from api.services.desktop_client.license_service import DesktopClientError


def test_session_assert_request_defaults_desktop_channel() -> None:
    from uuid import uuid4

    body = SessionAssertRequest(license_id=uuid4(), device_id=uuid4())
    assert body.channel == "desktop"


def test_session_assert_request_accepts_fofline_channel() -> None:
    from uuid import uuid4

    body = SessionAssertRequest(
        license_id=uuid4(),
        device_id=uuid4(),
        channel="fofline",
    )
    assert body.channel == "fofline"


def test_fofline_not_allowed_error_shape() -> None:
    err = DesktopClientError(
        "fofline_not_allowed",
        "License does not include FoFline",
        http_status=403,
    )
    assert err.code == "fofline_not_allowed"
    assert err.http_status == 403
