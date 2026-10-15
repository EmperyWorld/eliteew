# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Issue a single downloadable desktop-client seat package (license + optional
# entitlement + optional WG conf) so users import one file instead of pasting ops artifacts.
# Invariants:
# - Plaintext license_key and private WG material only in issue response (once).
# - mode=offline never requires portal peer; cloud/both create peer when portal configured.
# - Sealed issue critical section holds enrollment advisory lock (one mint per request_id).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md §desktop-client-015
# - api/services/desktop_client/license_modes.py (#011/#015)
# ---

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from api.services.desktop_client.entitlement_sign import (
    DEFAULT_CLIENT_OFFLINE_APPS,
    try_mint_entitlement,
)
from api.services.desktop_client.license_modes import (
    SeatMode,
    edition_for_mode,
    flags_for_mode,
    mode_hint_ru,
    mode_label_ru,
    normalize_email,
    normalize_seat_mode,
    profile_id_for_mode,
)
from api.services.desktop_client.license_service import (
    DesktopClientError,
    DesktopClientLicenseService,
    IssuedLicenseView,
)
from api.services.desktop_client.portal_peer_service import (
    DesktopClientPortalPeerService,
    PortalPeerCreateResult,
)

logger = logging.getLogger(__name__)

SEAT_KIND = "eliteew_desktop_seat"
SEAT_SCHEMA_VERSION = 1

# Re-export for routers / callers that import SeatMode from seat_package.
__all__ = (
    "SEAT_KIND",
    "SEAT_SCHEMA_VERSION",
    "DesktopClientSeatService",
    "SeatIssueResult",
    "SeatMode",
    "build_seat_package",
    "license_id_from_package",
    "parse_seat_package_dict",
)


@dataclass(frozen=True)
class SeatIssueResult:
    package: dict[str, Any]
    filename: str


def _slugify(label: str | None, *, prefix: str) -> str:
    base = (label or "").strip().lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    if not base:
        base = uuid4().hex[:8]
    slug = f"{prefix}-{base}"[:64].rstrip("-")
    if len(slug) < 2:
        slug = f"{prefix}-{uuid4().hex[:8]}"
    return slug


def build_seat_package(
    *,
    mode: SeatMode,
    issued: IssuedLicenseView,
    entitlement: dict[str, Any] | None,
    peer_result: PortalPeerCreateResult | None,
) -> dict[str, Any]:
    peer_meta: dict[str, Any] | None = None
    wg_conf: str | None = None
    if peer_result is not None:
        p = peer_result.peer
        peer_meta = {
            "id": str(p.id),
            "slug": p.slug,
            "assigned_ip": p.assigned_ip,
            "edge_sync_status": p.edge_sync_status,
        }
        wg_conf = peer_result.client_conf

    label_ru = mode_label_ru(mode)
    allow_offline, allow_online = flags_for_mode(mode)
    allow_fofline = bool(getattr(issued, "allow_fofline", False))
    offline_apps = list(DEFAULT_CLIENT_OFFLINE_APPS) if allow_offline else []
    if mode == "offline":
        notes_extra = "Офлайн-приложения откроются сразу без канала."
    elif mode == "both":
        notes_extra = (
            "Офлайн-приложения доступны сразу; для облачного стола канал "
            "поднимается из файла. Вход в облако — только на привязанный аккаунт."
        )
    else:
        notes_extra = "Клиент поднимет канал из файла и активирует лицензию — вставлять конфиг вручную не нужно."
    if allow_fofline:
        notes_extra += " FoFline включён: отдельный вход через empery-fofline после канала."
    return {
        "v": SEAT_SCHEMA_VERSION,
        "kind": SEAT_KIND,
        "mode": mode,
        "mode_label_ru": label_ru,
        "mode_hint_ru": mode_hint_ru(mode),
        "allow_offline": allow_offline,
        "allow_online": allow_online,
        "allow_fofline": allow_fofline,
        "allowed_email": issued.allowed_email,
        "issued_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "label": issued.label,
        "license_id": str(issued.license_id),
        "license_key": issued.license_key,
        "edition": issued.edition,
        "profile_id": issued.profile_id,
        "apps": offline_apps,
        "entitlement": entitlement,
        "wg_conf": wg_conf,
        "peer": peer_meta,
        "notes_ru": (
            f"Режим: {label_ru}. Импортируйте файл в EliteEW Desktop Client (экран «Добро пожаловать»). {notes_extra}"
        ),
    }


class DesktopClientSeatService:
    def __init__(
        self,
        *,
        license_service: DesktopClientLicenseService,
        peer_service: DesktopClientPortalPeerService,
    ) -> None:
        self._licenses = license_service
        self._peers = peer_service

    async def issue_seat(
        self,
        *,
        mode: SeatMode,
        label: str | None,
        slug: str | None,
        client_ip: str | None,
        allowed_email: str | None = None,
        allow_fofline: bool = False,
        expires_at: datetime | None = None,
        device_request: dict | None = None,
    ) -> SeatIssueResult:
        from api.services.desktop_client.capsule_seal import (
            allow_plaintext_issue,
        )
        from api.services.desktop_client.device_request import parse_and_verify_device_request
        from api.services.desktop_client.enrollment_service import (
            EnrollmentService,
            issue_body_hash,
        )

        mode_n = normalize_seat_mode(mode)
        edition = edition_for_mode(mode_n)
        profile_id = profile_id_for_mode(mode_n)
        allow_offline, allow_online = flags_for_mode(mode_n)
        email_n = normalize_email(allowed_email)
        offline_apps = list(DEFAULT_CLIENT_OFFLINE_APPS) if allow_offline else []
        fofline = bool(allow_fofline)

        recipient_hex = None
        enrollment = None
        verified_req = None
        body_hash = None
        if not allow_plaintext_issue():
            verified_req = parse_and_verify_device_request(device_request)
            recipient_hex = verified_req["capsule_recipient_pubkey"]
            enrollment = EnrollmentService(self._licenses._pool)
            body_hash = issue_body_hash(
                mode=mode_n,
                label=label,
                slug=slug,
                allowed_email=email_n,
                allow_fofline=fofline,
                request_id=verified_req["request_id"],
                expires_at=(expires_at.astimezone(UTC).isoformat() if expires_at is not None else None),
            )
            async with enrollment.issue_serialization_lock(verified_req["request_id"]):
                cached = await enrollment.get_idempotent_package(
                    request_id=verified_req["request_id"],
                    body_hash=body_hash,
                )
                if cached is not None:
                    return SeatIssueResult(package=cached["package"], filename=cached["filename"])
                return await self._issue_seat_package_unlocked(
                    mode_n=mode_n,
                    edition=edition,
                    profile_id=profile_id,
                    allow_offline=allow_offline,
                    allow_online=allow_online,
                    fofline=fofline,
                    email_n=email_n,
                    offline_apps=offline_apps,
                    label=label,
                    slug=slug,
                    client_ip=client_ip,
                    expires_at=expires_at,
                    recipient_hex=recipient_hex,
                    enrollment=enrollment,
                    verified_req=verified_req,
                    body_hash=body_hash,
                )

        return await self._issue_seat_package_unlocked(
            mode_n=mode_n,
            edition=edition,
            profile_id=profile_id,
            allow_offline=allow_offline,
            allow_online=allow_online,
            fofline=fofline,
            email_n=email_n,
            offline_apps=offline_apps,
            label=label,
            slug=slug,
            client_ip=client_ip,
            expires_at=expires_at,
            recipient_hex=None,
            enrollment=None,
            verified_req=None,
            body_hash=None,
        )

    async def _issue_seat_package_unlocked(
        self,
        *,
        mode_n: str,
        edition: str,
        profile_id: str,
        allow_offline: bool,
        allow_online: bool,
        fofline: bool,
        email_n: str | None,
        offline_apps: list[str],
        label: str | None,
        slug: str | None,
        client_ip: str | None,
        expires_at: datetime | None,
        recipient_hex: str | None,
        enrollment: Any,
        verified_req: dict[str, str] | None,
        body_hash: str | None,
    ) -> SeatIssueResult:
        from api.services.desktop_client.capsule_seal import maybe_seal_for_issue

        issued = await self._licenses.issue(
            label=label,
            edition=edition,
            profile_id=profile_id,
            client_ip=client_ip,
            allow_offline=allow_offline,
            allow_online=allow_online,
            allow_fofline=fofline,
            allowed_email=email_n,
            apps=offline_apps,
            expires_at=expires_at,
        )

        entitlement = try_mint_entitlement(
            license_id=issued.license_id,
            edition=issued.edition,
            profile_id=issued.profile_id,
            apps=offline_apps,
            machine_fingerprint=None,
            device_id=None,
            expires_at=issued.expires_at,
            allow_fofline=fofline,
            allow_online=allow_online,
        )
        if allow_offline and entitlement is None:
            logger.warning(
                "[STEP] desktop_client_seat_offline_no_entitlement license_id=%s",
                issued.license_id,
            )

        peer_result: PortalPeerCreateResult | None = None
        if allow_online or fofline:
            peer_slug = (slug or "").strip() or _slugify(label, prefix="seat")
            try:
                peer_result = await self._peers.create_peer(
                    slug=peer_slug,
                    label=label,
                    license_id=issued.license_id,
                    client_ip=client_ip,
                )
            except DesktopClientError:
                logger.exception(
                    "[STEP] desktop_client_seat_peer_fail license_id=%s slug=%s",
                    issued.license_id,
                    peer_slug,
                )
                raise

        package = build_seat_package(
            mode=mode_n,
            issued=issued,
            entitlement=entitlement,
            peer_result=peer_result,
        )
        package, suffix, activation_token_hash = maybe_seal_for_issue(
            package,
            recipient_public_key_hex=recipient_hex,
            verified_request=verified_req,
        )
        safe_label = _slugify(label or mode_n, prefix="seat")
        if suffix.endswith(".ecap"):
            filename = f"eliteew-capsule-{safe_label}.ecap"
        elif suffix.endswith(".capsule.json"):
            filename = f"eliteew-capsule-{safe_label}.json"
        else:
            filename = f"eliteew-seat-{safe_label}.json"
        sealed_v3 = package.get("encoding") == "ecap_v3"
        sealed_v2 = package.get("kind") == "eliteew_desktop_capsule"
        logger.info(
            "[STEP] desktop_client_seat_issued mode=%s license_id=%s has_entitlement=%s has_wg=%s sealed=%s encoding=%s",
            mode_n,
            issued.license_id,
            entitlement is not None,
            peer_result is not None,
            sealed_v3 or sealed_v2,
            package.get("encoding") or package.get("v") or "plaintext",
        )
        if enrollment is not None and verified_req is not None and body_hash is not None:
            peer_slug_issued = peer_result.peer.slug if peer_result is not None else None
            await enrollment.mark_issued(
                verified=verified_req,
                license_id=issued.license_id,
                package=package,
                filename=filename,
                body_hash=body_hash,
                activation_token_hash=activation_token_hash,
                issued_peer_slug=peer_slug_issued,
            )
        return SeatIssueResult(package=package, filename=filename)


def parse_seat_package_dict(raw: dict[str, Any]) -> dict[str, Any]:
    """Validate seat package shape (ops/tests / future server re-issue)."""
    if not isinstance(raw, dict):
        raise DesktopClientError("invalid_seat", "seat package must be an object", http_status=400)
    if raw.get("kind") != SEAT_KIND:
        raise DesktopClientError("invalid_seat", "kind must be eliteew_desktop_seat", http_status=400)
    try:
        ver = int(raw.get("v") or 0)
    except (TypeError, ValueError) as exc:
        raise DesktopClientError("invalid_seat", "invalid v", http_status=400) from exc
    if ver != SEAT_SCHEMA_VERSION:
        raise DesktopClientError(
            "invalid_seat",
            f"unsupported seat schema v={ver}",
            http_status=400,
        )
    try:
        mode_n = normalize_seat_mode(str(raw.get("mode") or ""))
    except DesktopClientError as exc:
        raise DesktopClientError(
            "invalid_seat",
            "mode must be offline|cloud|both",
            http_status=400,
        ) from exc
    raw = {**raw, "mode": mode_n}
    if not raw.get("mode_label_ru"):
        raw["mode_label_ru"] = mode_label_ru(mode_n)
    if not raw.get("mode_hint_ru"):
        raw["mode_hint_ru"] = mode_hint_ru(mode_n)
    license_key = (raw.get("license_key") or "").strip()
    entitlement = raw.get("entitlement")
    if not license_key and not isinstance(entitlement, dict):
        raise DesktopClientError(
            "invalid_seat",
            "seat needs license_key or entitlement",
            http_status=400,
        )
    return raw


def license_id_from_package(package: dict[str, Any]) -> UUID | None:
    raw = package.get("license_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None
