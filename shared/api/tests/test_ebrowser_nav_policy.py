# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for EBrowser nav policy evaluator.
# Related:
# - api/services/ebrowser/nav_policy.py
# - documentation/product/desktop/DESKTOP-EBROWSER.md
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from api.services.ebrowser.nav_policy import (
    EBrowserNavPolicy,
    default_deny_all_policy,
    default_open_policy,
    evaluate_navigation,
    validate_policy_for_save,
)


def test_open_allows_https_denies_http() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    p = default_open_policy(now=now)
    assert evaluate_navigation("https://example.com/x", p, now=now).allowed is True
    assert evaluate_navigation("http://example.com/x", p, now=now).reason == "scheme"
    assert evaluate_navigation("javascript:alert(1)", p, now=now).reason == "scheme"


def test_default_deny_all_blocks_https_allows_blank() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    p = default_deny_all_policy(now=now)
    assert p.mode == "allowlist"
    assert p.allow == ()
    assert evaluate_navigation("https://example.com/", p, now=now).reason == "allowlist_miss"
    assert evaluate_navigation("about:blank", p, now=now).allowed is True
    assert validate_policy_for_save("allowlist", [], []) is None


def test_empty_denylist_evaluates_fail_closed() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    p = EBrowserNavPolicy(mode="denylist", allow=(), deny=(), fetched_at=now)
    assert evaluate_navigation("https://example.com/", p, now=now).reason == "denylist_hit"


def test_userinfo_and_foreign_port_denied() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    p = default_open_policy(now=now)
    assert evaluate_navigation("https://u:p@example.com/", p, now=now).reason == "userinfo"
    assert evaluate_navigation("https://example.com:8443/", p, now=now).reason == "port"


def test_allowlist_and_denylist() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    allow = EBrowserNavPolicy(
        mode="allowlist",
        allow=("example.com", "10.0.0.0/8"),
        deny=(),
        fetched_at=now,
    )
    assert evaluate_navigation("https://sub.example.com/", allow, now=now).allowed is True
    assert evaluate_navigation("https://evil.com/", allow, now=now).reason == "allowlist_miss"
    assert evaluate_navigation("https://10.1.2.3/", allow, now=now).allowed is True

    deny = EBrowserNavPolicy(
        mode="denylist",
        allow=(),
        deny=("evil.com",),
        fetched_at=now,
    )
    assert evaluate_navigation("https://sub.evil.com/", deny, now=now).reason == "denylist_hit"
    assert evaluate_navigation("https://ok.com/", deny, now=now).allowed is True


def test_allowlist_ipv6_cidr() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    allow = EBrowserNavPolicy(
        mode="allowlist",
        allow=("2001:db8::/32",),
        deny=(),
        fetched_at=now,
    )
    assert evaluate_navigation("https://[2001:db8::1]/", allow, now=now).allowed is True
    assert evaluate_navigation("https://[2001:db9::1]/", allow, now=now).reason == "allowlist_miss"


def test_fail_closed_missing_and_expired() -> None:
    now = datetime(2026, 9, 9, 12, 0, tzinfo=UTC)
    assert evaluate_navigation("https://example.com/", None, now=now).reason == "missing_policy"
    stale = EBrowserNavPolicy(
        mode="open",
        fetched_at=now - timedelta(seconds=400),
    )
    assert evaluate_navigation("https://example.com/", stale, now=now).reason == "expired"


def test_validate_policy_for_save_dual_flag() -> None:
    assert validate_policy_for_save("open", ["a.com"], []) == "open_mode_lists_forbidden"
    assert validate_policy_for_save("allowlist", ["a.com"], ["b.com"]) == "allowlist_deny_forbidden"
    assert validate_policy_for_save("denylist", ["a.com"], ["b.com"]) == "denylist_allow_forbidden"
    assert validate_policy_for_save("allowlist", ["a.com"], []) is None
    assert validate_policy_for_save("open", [], []) is None
    assert validate_policy_for_save("denylist", [], []) == "denylist_empty_forbidden"
    assert validate_policy_for_save("denylist", [], ["evil.com"]) is None
