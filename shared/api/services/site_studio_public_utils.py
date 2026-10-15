# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared host/path helpers for Site Studio public wildcard routing and auth/cache middleware decisions.
# Invariants:
# - Public user-site hosts are exactly one label under the configured base domain.
# - Interim product shape: label must end with USER_SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX (default -site)
#   so app/auth/meet under *.eliteew.ru are never treated as public site hosts.
# - Admin and desktop API paths are never treated as public wildcard-surface routes.
# Related:
# - api/domains/site_studio_public.py
# - api/routers/site_studio_public.py
# - documentation/product/SITE-STUDIO.md
# ---
"""Shared helpers for Site Studio public wildcard host routing."""

from __future__ import annotations

import os

SITE_STUDIO_PUBLIC_SCHEME = os.environ.get("USER_SITE_STUDIO_PUBLIC_SCHEME", "https").strip().lower() or "https"
SITE_STUDIO_PUBLIC_BASE_DOMAIN = (
    os.environ.get("USER_SITE_STUDIO_PUBLIC_BASE_DOMAIN", "eliteew.ru").strip().lower().strip(".") or "eliteew.ru"
)


def _normalize_host_label_suffix(raw: str | None) -> str:
    normalized = (raw or "").strip().lower()
    if not normalized:
        return "-site"
    if not normalized.startswith("-"):
        return f"-{normalized}"
    return normalized


SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX = _normalize_host_label_suffix(
    os.environ.get("USER_SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX", "-site")
)
SITE_STUDIO_PUBLIC_HOST_PATTERN = (
    f"{{site_slug}}{SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX}.{SITE_STUDIO_PUBLIC_BASE_DOMAIN}"
)
SITE_STUDIO_PUBLIC_BLOCKED_PATH_PREFIXES = (
    "/admin",
    "/api/admin",
    "/api/v1/desktop",
)


def normalize_site_studio_request_host(host: str | None) -> str:
    normalized = (host or "").strip().lower()
    if not normalized:
        return ""
    if normalized.startswith("[") and "]" in normalized:
        return normalized.partition("]")[0].lstrip("[")
    return normalized.partition(":")[0]


def public_host_label_from_slug(site_slug: str) -> str:
    """Build the single DNS label for a product public host (idempotent -site suffix)."""
    normalized_slug = (site_slug or "").strip().lower()
    if not normalized_slug:
        raise ValueError("Site slug is required to build a public hostname")
    if "." in normalized_slug:
        raise ValueError("Site slug must be a single DNS label")
    suffix = SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX
    if suffix and normalized_slug.endswith(suffix):
        return normalized_slug
    return f"{normalized_slug}{suffix}"


def is_site_studio_public_host(host: str | None) -> bool:
    normalized = normalize_site_studio_request_host(host)
    if not normalized or normalized == SITE_STUDIO_PUBLIC_BASE_DOMAIN:
        return False
    base_suffix = f".{SITE_STUDIO_PUBLIC_BASE_DOMAIN}"
    if not normalized.endswith(base_suffix):
        return False
    site_label = normalized.removesuffix(base_suffix)
    if not site_label or "." in site_label:
        return False
    label_suffix = SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX
    if label_suffix:
        return site_label.endswith(label_suffix)
    return True


def is_site_studio_public_gateway_path(path: str | None) -> bool:
    normalized_path = (path or "/").rstrip("/") or "/"
    for blocked in SITE_STUDIO_PUBLIC_BLOCKED_PATH_PREFIXES:
        if normalized_path == blocked or normalized_path.startswith(f"{blocked}/"):
            return False
    return True


def build_site_studio_public_hostname(site_slug: str) -> str:
    return f"{public_host_label_from_slug(site_slug)}.{SITE_STUDIO_PUBLIC_BASE_DOMAIN}"


def build_site_studio_public_origin(public_hostname: str) -> str:
    normalized_host = normalize_site_studio_request_host(public_hostname)
    if not normalized_host:
        raise ValueError("Public hostname is required to build a Site Studio origin")
    return f"{SITE_STUDIO_PUBLIC_SCHEME}://{normalized_host}"


def build_site_studio_public_api_base_url(public_hostname: str) -> str:
    return f"{build_site_studio_public_origin(public_hostname)}/api"
