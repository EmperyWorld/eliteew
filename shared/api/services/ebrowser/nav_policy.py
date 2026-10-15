# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure EBrowser HTTPS navigation policy evaluator (open / allowlist / denylist).
# Invariants:
# - Modes exclusive; fail-closed when policy missing or TTL expired.
# - Missing DB row effective default is empty allowlist (deny-all HTTPS).
# - HTTPS only (about:blank allowed); userinfo and non-443 ports denied.
# Related:
# - documentation/product/desktop/DESKTOP-EBROWSER.md
# - shared/web/frontend/src/features/ebrowser/navPolicy.ts
# ---

from __future__ import annotations

import ipaddress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from urllib.parse import urlparse

PolicyMode = Literal["open", "allowlist", "denylist"]
DenyReason = Literal[
    "missing_policy",
    "expired",
    "scheme",
    "userinfo",
    "port",
    "host",
    "allowlist_miss",
    "denylist_hit",
    "invalid_url",
]

POLICY_TTL_SECONDS = 300


@dataclass(frozen=True, slots=True)
class EBrowserNavPolicy:
    mode: PolicyMode
    allow: tuple[str, ...] = ()
    deny: tuple[str, ...] = ()
    fetched_at: datetime | None = None
    ttl_seconds: int = POLICY_TTL_SECONDS

    @property
    def expires_at(self) -> datetime | None:
        if self.fetched_at is None:
            return None
        return self.fetched_at + timedelta(seconds=max(1, int(self.ttl_seconds)))


@dataclass(frozen=True, slots=True)
class NavDecision:
    allowed: bool
    reason: DenyReason | Literal["ok"] = "ok"


def default_open_policy(*, now: datetime | None = None) -> EBrowserNavPolicy:
    """Explicit open-mode fixture (admin-saved open or tests). Not the missing-row default."""
    ts = now or datetime.now(UTC)
    return EBrowserNavPolicy(mode="open", allow=(), deny=(), fetched_at=ts)


def default_deny_all_policy(*, now: datetime | None = None) -> EBrowserNavPolicy:
    """Missing DB row effective policy: empty allowlist → all HTTPS denied except about:blank."""
    ts = now or datetime.now(UTC)
    return EBrowserNavPolicy(mode="allowlist", allow=(), deny=(), fetched_at=ts)


def validate_policy_for_save(
    mode: PolicyMode,
    allow: list[str] | tuple[str, ...],
    deny: list[str] | tuple[str, ...],
) -> str | None:
    """Return error code if dual-flag / list-for-mode is invalid; else None."""
    if mode not in ("open", "allowlist", "denylist"):
        return "invalid_mode"
    allow_n = [x.strip() for x in allow if str(x).strip()]
    deny_n = [x.strip() for x in deny if str(x).strip()]
    if mode == "open" and (allow_n or deny_n):
        return "open_mode_lists_forbidden"
    if mode == "allowlist" and deny_n:
        return "allowlist_deny_forbidden"
    if mode == "denylist" and allow_n:
        return "denylist_allow_forbidden"
    if mode == "denylist" and not deny_n:
        return "denylist_empty_forbidden"
    for entry in allow_n + deny_n:
        if not _entry_well_formed(entry):
            return "invalid_entry"
    return None


def evaluate_navigation(
    url: str,
    policy: EBrowserNavPolicy | None,
    *,
    now: datetime | None = None,
) -> NavDecision:
    """Authoritative navigation decision (SPA mirror; Rust enforces)."""
    if policy is None:
        return NavDecision(False, "missing_policy")
    ts = now or datetime.now(UTC)
    if policy.fetched_at is None:
        return NavDecision(False, "missing_policy")
    fetched = policy.fetched_at
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=UTC)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    if ts > fetched + timedelta(seconds=max(1, int(policy.ttl_seconds))):
        return NavDecision(False, "expired")

    raw = (url or "").strip()
    if not raw:
        return NavDecision(False, "invalid_url")
    if raw == "about:blank" or raw.startswith("about:blank?"):
        return NavDecision(True, "ok")

    try:
        parsed = urlparse(raw)
    except ValueError:
        return NavDecision(False, "invalid_url")

    scheme = (parsed.scheme or "").lower()
    if scheme in ("javascript", "data", "blob", "file", "http"):
        return NavDecision(False, "scheme")
    if scheme != "https":
        return NavDecision(False, "scheme")
    if parsed.username or parsed.password:
        return NavDecision(False, "userinfo")
    if parsed.port is not None and parsed.port != 443:
        return NavDecision(False, "port")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        return NavDecision(False, "host")

    if policy.mode == "open":
        return NavDecision(True, "ok")
    if policy.mode == "allowlist":
        if not policy.allow:
            return NavDecision(False, "allowlist_miss")
        if _host_matches_any(host, policy.allow):
            return NavDecision(True, "ok")
        return NavDecision(False, "allowlist_miss")
    if policy.mode == "denylist":
        # Empty deny list would otherwise allow all HTTPS — fail closed.
        if not policy.deny:
            return NavDecision(False, "denylist_hit")
        if _host_matches_any(host, policy.deny):
            return NavDecision(False, "denylist_hit")
        return NavDecision(True, "ok")
    return NavDecision(False, "missing_policy")


def _entry_well_formed(entry: str) -> bool:
    e = entry.strip().lower()
    if not e or "://" in e:
        return False
    if e.startswith("."):
        e = e[1:]
    try:
        ipaddress.ip_network(e, strict=False)
        return True
    except ValueError:
        pass
    if " " in e or e.startswith("-") or e.endswith("-"):
        return False
    return bool(e) and all(c.isalnum() or c in ".-" for c in e)


def _host_matches_any(host: str, entries: tuple[str, ...] | list[str]) -> bool:
    for raw in entries:
        entry = (raw or "").strip().lower()
        if not entry:
            continue
        if entry.startswith("."):
            entry = entry[1:]
        try:
            net = ipaddress.ip_network(entry, strict=False)
            try:
                ip = ipaddress.ip_address(host)
            except ValueError:
                continue
            if ip in net:
                return True
            continue
        except ValueError:
            pass
        if host == entry or host.endswith("." + entry):
            return True
    return False


__all__ = [
    "POLICY_TTL_SECONDS",
    "DenyReason",
    "EBrowserNavPolicy",
    "NavDecision",
    "PolicyMode",
    "default_deny_all_policy",
    "default_open_policy",
    "evaluate_navigation",
    "validate_policy_for_save",
]
