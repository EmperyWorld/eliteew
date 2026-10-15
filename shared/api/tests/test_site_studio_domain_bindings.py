# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for custom Site Studio domain binding normalization and DNS verification.
# Invariants:
# - Internal control hosts and malformed host strings must be rejected before persistence.
# - DNS TXT verification compares hashed tokens instead of storing plaintext in the primary column.
# Related:
# - api/services/site_studio_domain_bindings.py
# - api/routers/site_studio_public.py
# ---
from __future__ import annotations

import pytest

from api.services import site_studio_domain_bindings as domains


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Site.Example.COM", "site.example.com"),
        ("bücher.example", "xn--bcher-kva.example"),
        ("tenant.example.com.", "tenant.example.com"),
    ],
)
def test_normalize_custom_domain_hostname_accepts_valid_hosts(raw: str, expected: str) -> None:
    assert domains.normalize_custom_domain_hostname(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "https://site.example.com",
        "site.example.com/admin",
        "*.example.com",
        "127.0.0.1",
        "localhost",
        "app.eliteew.ru",
        "demo-site.eliteew.ru",
        "site.local",
    ],
)
def test_normalize_custom_domain_hostname_rejects_control_or_unsafe_hosts(raw: str) -> None:
    with pytest.raises(ValueError):
        domains.normalize_custom_domain_hostname(raw)


@pytest.mark.asyncio
async def test_dns_txt_verification_matches_hashed_token(monkeypatch: pytest.MonkeyPatch) -> None:
    token = "eliteew-site-verification=test-token"
    monkeypatch.setattr(domains, "_resolve_txt_records_sync", lambda _name: ["other", token])

    check = await domains.check_dns_txt_verification(
        "_eliteew-site.site.example.com",
        domains._token_hash(token),
    )

    assert check.ok is True
    assert token in check.observed_values
