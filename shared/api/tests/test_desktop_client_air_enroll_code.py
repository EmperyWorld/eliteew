# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure contract locks for the one-code Air enrollment wire format.
# Related:
# - api/services/desktop_client/air_enroll_code.py
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

import pytest

from api.services.desktop_client.air_enroll_code import (
    PORT_MAX,
    PORT_MIN,
    PREFIX,
    generate_access_code,
    normalize_credential,
    parse_access_code,
)
from api.services.desktop_client.license_service import DesktopClientError


def test_air_code_roundtrip_preserves_port_and_credentials() -> None:
    code = generate_access_code(62345)
    rendered = code.render()
    assert rendered.startswith(f"{PREFIX}-62345-")
    parsed = parse_access_code(rendered.lower().replace("-", " "))
    assert parsed.port == 62345
    assert parsed.selector == code.selector
    assert parsed.secret == code.secret
    assert parsed.checksum == code.checksum
    assert parsed.selector_hash == code.selector_hash
    assert parsed.secret_hash == code.secret_hash


def test_air_code_rejects_checksum_tamper() -> None:
    code = generate_access_code(62200)
    parts = code.render().split("-")
    parts[-1] = "0000" if parts[-1] != "0000" else "0001"
    with pytest.raises(ValueError, match="air_code_checksum"):
        parse_access_code("-".join(parts))


def test_air_code_rejects_port_out_of_range() -> None:
    with pytest.raises(ValueError, match="air_enroll_port_range"):
        generate_access_code(PORT_MIN - 1)
    with pytest.raises(ValueError, match="air_enroll_port_range"):
        generate_access_code(PORT_MAX + 1)


def test_normalize_credential_rejects_noncanonical_secret() -> None:
    with pytest.raises(DesktopClientError) as exc:
        normalize_credential("not-a-secret", kind="secret")
    assert exc.value.code == "air_credential_invalid"


def test_oauth_public_path_includes_air_enroll_ws() -> None:
    from pathlib import Path

    src = Path("middleware/oauth2_protection.py").read_text(encoding="utf-8")
    assert r"^/api/v1/desktop-client/air-enroll/ws$" in src
