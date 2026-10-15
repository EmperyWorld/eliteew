# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Custom domain binding lifecycle for Site Studio/KIRS internal-only sites.
# Handles hostname normalization, ownership verification state, audit rows, and gateway lookup.
# Invariants:
# - A custom domain never grants admin access; routers still own authorization.
# - MVP is internal-only: activation requires DNS ownership plus an explicit route/TLS readiness gate.
# Related:
# - api/routers/desktop_sites.py
# - api/routers/kirs.py
# - api/routers/site_studio_public.py
# - documentation/platform/docker-re_doc/INTERNAL-SITES-ACCESS.md
# ---
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import logging
import re
import secrets
import socket
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status  # type: ignore[import-untyped]
from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.desktop import ProjectSiteInstance, UserSiteInstance
from api.services.site_studio_public_utils import (
    is_site_studio_public_host,
    normalize_site_studio_request_host,
)
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)

DOMAIN_BINDING_ACTIVE_STATUSES = {"pending_dns", "verified", "route_pending", "active"}
DOMAIN_BINDING_ROUTE_READY_STATUSES = {"verified", "route_pending", "active"}
DOMAIN_BINDING_FORBIDDEN_HOSTS = {
    "app.eliteew.ru",
    "auth.eliteew.ru",
    "meet.eliteew.ru",
    "eliteew.ru",
    "sites.eliteew.ru",
    "localhost",
}
DOMAIN_BINDING_FORBIDDEN_SUFFIXES = (
    ".sites.eliteew.ru",
    ".eliteew.ru",
    ".local",
    ".localhost",
)
DOMAIN_BINDING_TXT_PREFIX = "_eliteew-site"
DOMAIN_BINDING_INTERNAL_TARGET = "sites.eliteew.ru"
DOMAIN_BINDING_TOKEN_SECRET = "site-studio-domain-binding-v1"
_HOST_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


@dataclass(slots=True)
class DomainVerificationCheck:
    ok: bool
    observed_values: list[str]
    error: str | None = None


def _jsonb_param(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, default=str)


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    metadata = data.get("metadata_json")
    data["metadata_json"] = metadata if isinstance(metadata, dict) else {}
    return data


def _token_hash(token: str) -> str:
    return hashlib.sha256(f"{DOMAIN_BINDING_TOKEN_SECRET}:{token}".encode()).hexdigest()


def normalize_custom_domain_hostname(value: str) -> str:
    raw = (value or "").strip().lower()
    if "://" in raw or "/" in raw or "?" in raw or "#" in raw:
        raise ValueError("Domain must be a bare hostname without scheme or path")
    if raw.startswith("*."):
        raise ValueError("Wildcard domains are not supported")
    if ":" in raw:
        raise ValueError("Domain must not include a port")
    normalized = normalize_site_studio_request_host(raw).rstrip(".")
    if not normalized:
        raise ValueError("Domain is required")
    try:
        ipaddress.ip_address(normalized)
    except ValueError:
        pass
    else:
        raise ValueError("IP literals are not supported")
    try:
        normalized = normalized.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise ValueError("Domain contains invalid IDNA characters") from exc
    if len(normalized) > 253:
        raise ValueError("Domain is too long")
    labels = normalized.split(".")
    if len(labels) < 2:
        raise ValueError("Domain must include at least two labels")
    if any(not _HOST_LABEL_RE.match(label) for label in labels):
        raise ValueError("Domain contains invalid labels")
    if normalized in DOMAIN_BINDING_FORBIDDEN_HOSTS or any(
        normalized.endswith(suffix) for suffix in DOMAIN_BINDING_FORBIDDEN_SUFFIXES
    ):
        raise ValueError("This domain is reserved by EliteEW infrastructure")
    if is_site_studio_public_host(normalized):
        raise ValueError("This domain is reserved by EliteEW infrastructure")
    return normalized


def _verification_name(hostname: str) -> str:
    return f"{DOMAIN_BINDING_TXT_PREFIX}.{hostname}"


def _public_binding_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "instance_scope": row["instance_scope"],
        "instance_id": row["instance_id"],
        "hostname": row["hostname"],
        "status": row["status"],
        "verification_method": row["verification_method"],
        "verification_name": row["verification_name"],
        "verification_token_preview": row["verification_token_preview"],
        "expected_cname": row.get("expected_cname"),
        "verified_at": row.get("verified_at"),
        "last_checked_at": row.get("last_checked_at"),
        "route_ready_at": row.get("route_ready_at"),
        "tls_status": row["tls_status"],
        "last_error": row.get("last_error"),
        "metadata_json": row.get("metadata_json") if isinstance(row.get("metadata_json"), dict) else {},
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def _insert_audit(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    action: str,
    actor_user_id: UUID | str | None,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO site_studio_domain_binding_audit (
                binding_id, action, actor_user_id, before_json, after_json
            )
            VALUES (:binding_id, :action, :actor_user_id, CAST(:before_json AS jsonb), CAST(:after_json AS jsonb))
            """
        ),
        {
            "binding_id": str(binding_id),
            "action": action,
            "actor_user_id": str(actor_user_id) if actor_user_id else None,
            "before_json": _jsonb_param(before),
            "after_json": _jsonb_param(after),
        },
    )


async def _get_binding_row(db: AsyncSession, binding_id: UUID | str) -> dict[str, Any] | None:
    row = (
        (
            await db.execute(
                text("SELECT * FROM site_studio_domain_bindings WHERE id = :binding_id"),
                {"binding_id": str(binding_id)},
            )
        )
        .mappings()
        .first()
    )
    return _row_to_dict(row)


async def list_domain_bindings(
    db: AsyncSession,
    *,
    instance_scope: str,
    instance_id: UUID | str,
) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                text(
                    """
                    SELECT *
                    FROM site_studio_domain_bindings
                    WHERE instance_scope = :instance_scope
                      AND instance_id = :instance_id
                    ORDER BY created_at DESC
                    """
                ),
                {"instance_scope": instance_scope, "instance_id": str(instance_id)},
            )
        )
        .mappings()
        .all()
    )
    return [_public_binding_payload(_row_to_dict(row) or {}) for row in rows]


async def create_domain_binding(
    db: AsyncSession,
    *,
    instance_scope: str,
    instance_id: UUID | str,
    hostname: str,
    actor_user_id: UUID | str | None,
) -> dict[str, Any]:
    try:
        normalized = normalize_custom_domain_hostname(hostname)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = f"eliteew-site-verification={secrets.token_urlsafe(24)}"
    now = utc_now_naive()
    try:
        row = (
            (
                await db.execute(
                    text(
                        """
                        INSERT INTO site_studio_domain_bindings (
                            instance_scope, instance_id, hostname, status, verification_method,
                            verification_name, verification_token_hash, verification_token_preview,
                            expected_cname, tls_status, metadata_json, created_by_user_id,
                            created_at, updated_at
                        )
                        VALUES (
                            :instance_scope, :instance_id, :hostname, 'pending_dns', 'dns_txt',
                            :verification_name, :verification_token_hash, :verification_token_preview,
                            :expected_cname, 'operator_required', CAST(:metadata_json AS jsonb),
                            :actor_user_id, :now, :now
                        )
                        RETURNING *
                        """
                    ),
                    {
                        "instance_scope": instance_scope,
                        "instance_id": str(instance_id),
                        "hostname": normalized,
                        "verification_name": _verification_name(normalized),
                        "verification_token_hash": _token_hash(token),
                        "verification_token_preview": token,
                        "expected_cname": DOMAIN_BINDING_INTERNAL_TARGET,
                        "metadata_json": _jsonb_param(
                            {
                                "internal_only": True,
                                "dns_txt_value": token,
                                "operator_next_step": "add_txt_record",
                            }
                        ),
                        "actor_user_id": str(actor_user_id) if actor_user_id else None,
                        "now": now,
                    },
                )
            )
            .mappings()
            .first()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain binding could not be created: {exc}",
        ) from exc
    data = _row_to_dict(row) or {}
    await _insert_audit(
        db, binding_id=data["id"], action="create", actor_user_id=actor_user_id, before=None, after=data
    )
    return _public_binding_payload(data)


def _resolve_txt_records_sync(name: str) -> list[str]:
    # dnspython is optional in slim containers. Fallback is intentionally simple and test-injectable.
    try:
        import dns.resolver  # type: ignore[import-not-found]

        answers = dns.resolver.resolve(name, "TXT", lifetime=5.0)
        out: list[str] = []
        for answer in answers:
            chunks = getattr(answer, "strings", None)
            if chunks:
                out.append("".join(part.decode("utf-8", "ignore") for part in chunks))
            else:
                out.append(str(answer).strip('"'))
        return out
    except Exception as exc:
        logger.debug("[STEP] site_studio_dns_txt_resolve_skip name=%s err=%s", name, exc)
        return []


async def check_dns_txt_verification(name: str, expected_token_hash: str) -> DomainVerificationCheck:
    observed = await asyncio.to_thread(_resolve_txt_records_sync, name)
    ok = any(_token_hash(value.strip()) == expected_token_hash for value in observed)
    return DomainVerificationCheck(ok=ok, observed_values=observed, error=None if ok else "TXT record not found")


async def verify_domain_binding(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
    actor_user_id: UUID | str | None,
) -> dict[str, Any]:
    row = await _get_binding_row(db, binding_id)
    if row is None or row["instance_scope"] != instance_scope or str(row["instance_id"]) != str(instance_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain binding not found")
    before = dict(row)
    check = await check_dns_txt_verification(row["verification_name"], row["verification_token_hash"])
    now = utc_now_naive()
    next_status = "verified" if check.ok else "pending_dns"
    last_error = None if check.ok else check.error
    updated = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_bindings
                    SET status = :status,
                        verified_at = CASE WHEN :verified THEN COALESCE(verified_at, :now) ELSE verified_at END,
                        last_checked_at = :now,
                        last_error = :last_error,
                        metadata_json = metadata_json || CAST(:metadata_json AS jsonb),
                        updated_at = :now
                    WHERE id = :binding_id
                    RETURNING *
                    """
                ),
                {
                    "binding_id": str(binding_id),
                    "status": next_status,
                    "verified": check.ok,
                    "last_error": last_error,
                    "metadata_json": _jsonb_param({"observed_txt_values": check.observed_values[-5:]}),
                    "now": now,
                },
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(updated) or {}
    await _insert_audit(
        db,
        binding_id=binding_id,
        action="verify_success" if check.ok else "verify_failed",
        actor_user_id=actor_user_id,
        before=before,
        after=data,
    )
    return _public_binding_payload(data)


async def request_domain_route(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
    actor_user_id: UUID | str | None,
) -> dict[str, Any]:
    row = await _get_binding_row(db, binding_id)
    if row is None or row["instance_scope"] != instance_scope or str(row["instance_id"]) != str(instance_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain binding not found")
    if row["status"] not in DOMAIN_BINDING_ROUTE_READY_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Verify domain ownership before routing")
    before = dict(row)
    now = utc_now_naive()
    updated = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_bindings
                    SET status = 'route_pending',
                        route_ready_at = COALESCE(route_ready_at, :now),
                        last_error = NULL,
                        updated_at = :now
                    WHERE id = :binding_id
                    RETURNING *
                    """
                ),
                {"binding_id": str(binding_id), "now": now},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(updated) or {}
    await db.execute(
        text(
            """
            INSERT INTO site_studio_domain_dns_outbox (binding_id, hostname, target_hostname, metadata_json)
            VALUES (:binding_id, :hostname, :target_hostname, CAST(:metadata_json AS jsonb))
            """
        ),
        {
            "binding_id": str(binding_id),
            "hostname": data["hostname"],
            "target_hostname": DOMAIN_BINDING_INTERNAL_TARGET,
            "metadata_json": _jsonb_param({"internal_only": True}),
        },
    )
    await _insert_audit(
        db, binding_id=binding_id, action="request_route", actor_user_id=actor_user_id, before=before, after=data
    )
    return _public_binding_payload(data)


async def activate_domain_binding(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
    actor_user_id: UUID | str | None,
) -> dict[str, Any]:
    row = await _get_binding_row(db, binding_id)
    if row is None or row["instance_scope"] != instance_scope or str(row["instance_id"]) != str(instance_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain binding not found")
    if row["status"] not in {"route_pending", "active"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Domain must be verified before activation")
    if row["tls_status"] != "ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="TLS certificate is not marked ready by operator yet",
        )
    before = dict(row)
    now = utc_now_naive()
    updated = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_bindings
                    SET status = 'active',
                        route_ready_at = COALESCE(route_ready_at, :now),
                        last_error = NULL,
                        updated_at = :now
                    WHERE id = :binding_id
                    RETURNING *
                    """
                ),
                {"binding_id": str(binding_id), "now": now},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(updated) or {}
    await _insert_audit(
        db, binding_id=binding_id, action="activate", actor_user_id=actor_user_id, before=before, after=data
    )
    return _public_binding_payload(data)


async def disable_domain_binding(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
    actor_user_id: UUID | str | None,
) -> dict[str, Any]:
    row = await _get_binding_row(db, binding_id)
    if row is None or row["instance_scope"] != instance_scope or str(row["instance_id"]) != str(instance_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain binding not found")
    before = dict(row)
    updated = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_bindings
                    SET status = 'disabled',
                        updated_at = :now
                    WHERE id = :binding_id
                    RETURNING *
                    """
                ),
                {"binding_id": str(binding_id), "now": utc_now_naive()},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(updated) or {}
    await _insert_audit(
        db, binding_id=binding_id, action="disable", actor_user_id=actor_user_id, before=before, after=data
    )
    return _public_binding_payload(data)


async def resolve_domain_binding_instance(
    db: AsyncSession,
    *,
    hostname: str,
) -> UserSiteInstance | ProjectSiteInstance | None:
    normalized = normalize_site_studio_request_host(hostname)
    if not normalized:
        return None
    row = (
        (
            await db.execute(
                text(
                    """
                    SELECT instance_scope, instance_id
                    FROM site_studio_domain_bindings
                    WHERE hostname = :hostname
                      AND status = 'active'
                    LIMIT 1
                    """
                ),
                {"hostname": normalized},
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        return None
    model = ProjectSiteInstance if row["instance_scope"] == "project" else UserSiteInstance
    return await db.get(model, row["instance_id"])


def resolve_internal_dns_target() -> str:
    return socket.getfqdn(DOMAIN_BINDING_INTERNAL_TARGET)
