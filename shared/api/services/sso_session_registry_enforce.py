#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enforce current Keycloak SSO session per (sub, browser|mobile|desktop|fofline)
# with audit + replace notify and FoFline↔browser XOR (displace/deny/off).
# Invariants:
# - Only session identifiers/metadata stored; raw tokens never persisted.
# - Replacement limited to OAuth/callback flows with allow_session_replace.
# - FoFline XOR never touches mobile/desktop classes.
# Related:
# - api.services.sso_session_claims; api.services.socket_sso_session_watch;
#   documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
#   documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
# ---
"""DB-backed SSO session enforcement."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import Request  # type: ignore[import-untyped]

from api.core.database_manager import get_asyncpg_pool
from api.services.sso_session_claims import (
    SsoClientClass,
    SsoSessionClaims,
    SsoSessionDecision,
    _clean_claim,
    fofline_browser_xor_partner,
    fofline_browser_xor_policy,
    is_ewpower_operator_client_id,
    normalize_sso_token_payload,
    parse_xor_displaced_winner,
    public_client_id_from_token_payload,
    should_replace_existing_session,
    should_require_fofline_browser_xor_confirm,
    should_require_session_replace_confirmation,
    sso_claims_from_payload,
    user_agents_match,
)

logger = logging.getLogger(__name__)

_SESSION_REPLACE_CONFIRM_HEADER = "x-sso-replace-confirm"
_SSO_REGISTRY_TRANSIENT_ATTEMPTS = 3
_SSO_REGISTRY_RETRY_BASE_DELAY_S = 0.05


class SsoSessionRegistryUnavailable(RuntimeError):
    """Raised when the registry cannot check or persist session state."""


def _is_transient_sso_registry_error(exc: BaseException) -> bool:
    """Connection/timeout class failures worth a short retry before 503."""
    name = type(exc).__name__
    if name in {
        "TimeoutError",
        "CancelledError",
        "InterfaceError",
        "InternalClientError",
        "CannotConnectNowError",
        "ConnectionDoesNotExistError",
        "ConnectionFailureError",
        "TooManyConnectionsError",
        "PostgresConnectionError",
    }:
        return True
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "connection was closed",
            "connection does not exist",
            "connection refused",
            "timeout",
            "temporarily unavailable",
            "too many connections",
            "server closed the connection",
        )
    )


def _request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.client.host if request.client else None


def _request_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    value = request.headers.get("user-agent")
    return value[:1024] if value else None


async def _insert_audit_event(
    conn: Any,  # noqa: ANN401 - asyncpg connection
    *,
    event_type: str,
    claims: SsoSessionClaims,
    replaced_session_id: str | None,
    ip_address: str | None,
    user_agent: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO public.sso_session_audit_events (
            event_type, keycloak_sub, username, email, client_class, client_id,
            session_id, replaced_session_id, ip_address, user_agent, details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        """,
        event_type,
        claims.keycloak_sub,
        claims.username,
        claims.email,
        claims.client_class,
        claims.client_id,
        claims.session_id,
        replaced_session_id,
        ip_address,
        user_agent,
        json.dumps(details or {}, ensure_ascii=False),
    )


def _looks_native_mobile_http_client(user_agent: str | None) -> bool:
    ua = (user_agent or "").lower()
    return "okhttp" in ua or "dart/" in ua or "emperyworldandroid" in ua


class SsoSessionRegistry:
    """Persist and enforce the current SSO session for each `(sub, client_class)` tuple."""

    async def enforce_current_session(
        self,
        payload: dict[str, Any],
        *,
        request: Request | None = None,
        audit_first_seen: bool = True,
        oauth_client_id: str | None = None,
        user_agent: str | None = None,
        replace_confirm_header: str | None = None,
        allow_session_replace: bool = False,
    ) -> SsoSessionDecision:
        payload = normalize_sso_token_payload(payload)
        claims = sso_claims_from_payload(payload, oauth_client_id=oauth_client_id)
        if claims is None:
            logger.warning(
                "SSO registry skipped: missing sid/session_state (sub=%s azp=%s oauth_client=%s)",
                _clean_claim(payload, "sub"),
                public_client_id_from_token_payload(payload),
                oauth_client_id,
            )
            return SsoSessionDecision(allowed=True, reason="missing_sso_session_claims")

        if is_ewpower_operator_client_id(claims.client_id):
            return SsoSessionDecision(
                allowed=True,
                claims=claims,
                reason="ewpower_operator_client",
            )

        ip_address = _request_ip(request)
        resolved_user_agent = user_agent if user_agent is not None else _request_user_agent(request)
        resolved_replace_confirm = replace_confirm_header
        if resolved_replace_confirm is None and request is not None:
            resolved_replace_confirm = request.headers.get(_SESSION_REPLACE_CONFIRM_HEADER)
        last_exc: BaseException | None = None
        for attempt in range(_SSO_REGISTRY_TRANSIENT_ATTEMPTS):
            try:
                return await self._enforce_current_session_db(
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                    resolved_replace_confirm=resolved_replace_confirm,
                    audit_first_seen=audit_first_seen,
                    allow_session_replace=allow_session_replace,
                )
            except SsoSessionRegistryUnavailable:
                raise
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if not _is_transient_sso_registry_error(exc) or attempt >= _SSO_REGISTRY_TRANSIENT_ATTEMPTS - 1:
                    logger.exception("SSO session registry unavailable")
                    raise SsoSessionRegistryUnavailable("SSO session registry unavailable") from exc
                delay = _SSO_REGISTRY_RETRY_BASE_DELAY_S * (2**attempt)
                logger.warning(
                    "SSO registry transient error attempt=%s/%s delay=%.3fs: %s",
                    attempt + 1,
                    _SSO_REGISTRY_TRANSIENT_ATTEMPTS,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
        logger.exception("SSO session registry unavailable")
        raise SsoSessionRegistryUnavailable("SSO session registry unavailable") from last_exc

    async def _fetch_partner_session_id(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        *,
        keycloak_sub: str,
        partner_class: SsoClientClass,
    ) -> str | None:
        row = await conn.fetchrow(
            """
            SELECT current_session_id
            FROM public.sso_user_sessions
            WHERE keycloak_sub = $1 AND client_class = $2
            FOR UPDATE
            """,
            keycloak_sub,
            partner_class,
        )
        if row is None or row.get("current_session_id") is None:
            return None
        return str(row["current_session_id"])

    async def _deny_if_xor_conflict(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        claims: SsoSessionClaims,
        *,
        ip_address: str | None,
        resolved_user_agent: str | None,
    ) -> SsoSessionDecision | None:
        """When policy=deny and XOR partner row exists, refuse the incoming class login."""

        if fofline_browser_xor_policy() != "deny":
            return None
        partner = fofline_browser_xor_partner(claims.client_class)
        if partner is None:
            return None
        partner_sid = await self._fetch_partner_session_id(
            conn,
            keycloak_sub=claims.keycloak_sub,
            partner_class=partner,
        )
        if not partner_sid:
            return None
        await _insert_audit_event(
            conn,
            event_type="sso_session_rejected",
            claims=claims,
            replaced_session_id=partner_sid,
            ip_address=ip_address,
            user_agent=resolved_user_agent,
            details={
                "source": "fofline_browser_xor_deny",
                "partner_class": partner,
                "policy": "deny",
            },
        )
        logger.info(
            "[STEP] sso_fofline_browser_xor_deny sub=%s class=%s partner=%s",
            claims.keycloak_sub[:8],
            claims.client_class,
            partner,
        )
        return SsoSessionDecision(
            allowed=False,
            claims=claims,
            replaced_session_id=partner_sid,
            reason="fofline_browser_xor_conflict",
            xor_partner=partner,
        )

    async def _confirm_xor_displace_or_none(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        claims: SsoSessionClaims,
        *,
        ip_address: str | None,
        resolved_user_agent: str | None,
        resolved_replace_confirm: str | None,
    ) -> SsoSessionDecision | None:
        """When displace would kick a live XOR partner, require confirm header first."""

        partner = fofline_browser_xor_partner(claims.client_class)
        if partner is None:
            return None
        partner_sid = await self._fetch_partner_session_id(
            conn,
            keycloak_sub=claims.keycloak_sub,
            partner_class=partner,
        )
        if not should_require_fofline_browser_xor_confirm(
            client_class=claims.client_class,
            replace_confirm_header=resolved_replace_confirm,
            partner_session_id=partner_sid,
        ):
            return None
        await _insert_audit_event(
            conn,
            event_type="sso_session_replace_confirmation_required",
            claims=claims,
            replaced_session_id=partner_sid,
            ip_address=ip_address,
            user_agent=resolved_user_agent,
            details={
                "source": "fofline_browser_xor_confirm",
                "xor_partner": partner,
                "header": _SESSION_REPLACE_CONFIRM_HEADER,
                "policy": "displace",
            },
        )
        logger.info(
            "[STEP] sso_fofline_browser_xor_confirm_required sub=%s class=%s partner=%s",
            claims.keycloak_sub[:8],
            claims.client_class,
            partner,
        )
        return SsoSessionDecision(
            allowed=False,
            claims=claims,
            replaced_session_id=partner_sid,
            reason="session_replace_confirmation_required",
            xor_partner=partner,
        )

    async def _displace_xor_partner(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        claims: SsoSessionClaims,
        *,
        ip_address: str | None,
        resolved_user_agent: str | None,
    ) -> None:
        """Invalidate XOR partner current sid (displace policy) and notify Socket.IO watch."""

        if fofline_browser_xor_policy() != "displace":
            return
        partner = fofline_browser_xor_partner(claims.client_class)
        if partner is None:
            return
        partner_sid = await self._fetch_partner_session_id(
            conn,
            keycloak_sub=claims.keycloak_sub,
            partner_class=partner,
        )
        if not partner_sid:
            return
        # Sentinel sid so partner tokens fail registry match with session_replaced.
        displaced_sid = f"xor-displaced:{claims.client_class}:{claims.session_id}"
        await conn.execute(
            """
            UPDATE public.sso_user_sessions
            SET current_session_id = $3,
                previous_session_id = $4,
                replaced_at = now(),
                replaced_by_session_id = $5,
                last_seen_at = now()
            WHERE keycloak_sub = $1 AND client_class = $2
            """,
            claims.keycloak_sub,
            partner,
            displaced_sid,
            partner_sid,
            claims.session_id,
        )
        partner_claims = SsoSessionClaims(
            keycloak_sub=claims.keycloak_sub,
            session_id=displaced_sid,
            client_id=claims.client_id,
            client_class=partner,
            username=claims.username,
            email=claims.email,
            auth_time_epoch=claims.auth_time_epoch,
            issued_at_epoch=claims.issued_at_epoch,
        )
        await _insert_audit_event(
            conn,
            event_type="sso_session_replaced",
            claims=partner_claims,
            replaced_session_id=partner_sid,
            ip_address=ip_address,
            user_agent=resolved_user_agent,
            details={
                "source": "fofline_browser_xor_displace",
                "winner_class": claims.client_class,
                "winner_session_id": claims.session_id,
                "policy": "displace",
            },
        )
        logger.info(
            "[STEP] sso_fofline_browser_xor_displace sub=%s winner=%s partner=%s",
            claims.keycloak_sub[:8],
            claims.client_class,
            partner,
        )
        try:
            from api.services.socket_sso_session_watch import notify_sso_session_replaced

            await notify_sso_session_replaced(
                keycloak_sub=claims.keycloak_sub,
                client_class=partner,
                replaced_session_id=partner_sid,
            )
        except Exception:
            logger.debug("socket SSO XOR displace notify failed", exc_info=True)

    async def _enforce_current_session_db(
        self,
        claims: SsoSessionClaims,
        *,
        ip_address: str | None,
        resolved_user_agent: str | None,
        resolved_replace_confirm: str | None,
        audit_first_seen: bool,
        allow_session_replace: bool,
    ) -> SsoSessionDecision:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                    SELECT current_session_id, auth_time_epoch, issued_at_epoch, user_agent
                    FROM public.sso_user_sessions
                    WHERE keycloak_sub = $1 AND client_class = $2
                    FOR UPDATE
                    """,
                claims.keycloak_sub,
                claims.client_class,
            )
            if row is None:
                deny = await self._deny_if_xor_conflict(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                )
                if deny is not None:
                    return deny
                confirm = await self._confirm_xor_displace_or_none(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                    resolved_replace_confirm=resolved_replace_confirm,
                )
                if confirm is not None:
                    return confirm
                await self._insert_current_session(conn, claims, ip_address, resolved_user_agent)
                if audit_first_seen:
                    await _insert_audit_event(
                        conn,
                        event_type="sso_login_seen",
                        claims=claims,
                        replaced_session_id=None,
                        ip_address=ip_address,
                        user_agent=resolved_user_agent,
                        details={"source": "registry_first_seen"},
                    )
                await self._displace_xor_partner(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                )
                return SsoSessionDecision(allowed=True, claims=claims)

            current_session_id = str(row["current_session_id"])
            if current_session_id == claims.session_id:
                if claims.client_class == "browser" and _looks_native_mobile_http_client(resolved_user_agent):
                    logger.warning(
                        "SSO registry: browser channel touch from native mobile HTTP client "
                        "(azp=%s user=%s); mobile app may be using empery-web tokens",
                        claims.client_id,
                        claims.username,
                    )
                await conn.execute(
                    """
                        UPDATE public.sso_user_sessions
                        SET last_seen_at = now(),
                            ip_address = COALESCE($3, ip_address),
                            user_agent = COALESCE($4, user_agent)
                        WHERE keycloak_sub = $1 AND client_class = $2
                        """,
                    claims.keycloak_sub,
                    claims.client_class,
                    ip_address,
                    resolved_user_agent,
                )
                return SsoSessionDecision(allowed=True, claims=claims)

            should_replace = should_replace_existing_session(
                existing_auth_time_epoch=row["auth_time_epoch"],
                existing_issued_at_epoch=row["issued_at_epoch"],
                incoming_auth_time_epoch=claims.auth_time_epoch,
                incoming_issued_at_epoch=claims.issued_at_epoch,
            )
            if should_replace:
                if not allow_session_replace:
                    await _insert_audit_event(
                        conn,
                        event_type="sso_session_rejected",
                        claims=claims,
                        replaced_session_id=current_session_id,
                        ip_address=ip_address,
                        user_agent=resolved_user_agent,
                        details={
                            "source": "registry_reject_non_login_replace",
                            "replacement_allowed": False,
                        },
                    )
                    return SsoSessionDecision(
                        allowed=False,
                        claims=claims,
                        replaced_session_id=current_session_id,
                        reason="session_replaced",
                        displaced_by=parse_xor_displaced_winner(current_session_id),
                    )
                existing_user_agent = str(row["user_agent"]).strip() if row["user_agent"] is not None else None
                replace_requires_confirm = should_require_session_replace_confirmation(
                    client_class=claims.client_class,
                    replace_confirm_header=resolved_replace_confirm,
                    existing_user_agent=existing_user_agent,
                    incoming_user_agent=resolved_user_agent,
                )
                if replace_requires_confirm:
                    await _insert_audit_event(
                        conn,
                        event_type="sso_session_replace_confirmation_required",
                        claims=claims,
                        replaced_session_id=current_session_id,
                        ip_address=ip_address,
                        user_agent=resolved_user_agent,
                        details={
                            "source": "registry_replace_confirmation_required",
                            "header": _SESSION_REPLACE_CONFIRM_HEADER,
                        },
                    )
                    return SsoSessionDecision(
                        allowed=False,
                        claims=claims,
                        replaced_session_id=current_session_id,
                        reason="session_replace_confirmation_required",
                    )
                deny = await self._deny_if_xor_conflict(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                )
                if deny is not None:
                    return deny
                confirm = await self._confirm_xor_displace_or_none(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                    resolved_replace_confirm=resolved_replace_confirm,
                )
                if confirm is not None:
                    return confirm
                replace_source = (
                    "registry_replace_same_user_agent"
                    if user_agents_match(existing_user_agent, resolved_user_agent)
                    else "registry_replace"
                )
                await self._replace_current_session(conn, claims, current_session_id, ip_address, resolved_user_agent)
                await _insert_audit_event(
                    conn,
                    event_type="sso_session_replaced",
                    claims=claims,
                    replaced_session_id=current_session_id,
                    ip_address=ip_address,
                    user_agent=resolved_user_agent,
                    details={"source": replace_source},
                )
                try:
                    from api.services.socket_sso_session_watch import notify_sso_session_replaced

                    await notify_sso_session_replaced(
                        keycloak_sub=claims.keycloak_sub,
                        client_class=claims.client_class,
                        replaced_session_id=current_session_id,
                    )
                except Exception:
                    logger.debug("socket SSO replace notify failed", exc_info=True)
                await self._displace_xor_partner(
                    conn,
                    claims,
                    ip_address=ip_address,
                    resolved_user_agent=resolved_user_agent,
                )
                return SsoSessionDecision(
                    allowed=True,
                    claims=claims,
                    replaced_session_id=current_session_id,
                )

            await _insert_audit_event(
                conn,
                event_type="sso_session_rejected",
                claims=claims,
                replaced_session_id=current_session_id,
                ip_address=ip_address,
                user_agent=resolved_user_agent,
                details={"source": "registry_reject_replaced"},
            )
            return SsoSessionDecision(
                allowed=False,
                claims=claims,
                replaced_session_id=current_session_id,
                reason="session_replaced",
                displaced_by=parse_xor_displaced_winner(current_session_id),
            )

    async def _insert_current_session(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        claims: SsoSessionClaims,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        await conn.execute(
            """
            INSERT INTO public.sso_user_sessions (
                keycloak_sub, client_class, current_session_id, client_id, username, email,
                auth_time_epoch, issued_at_epoch, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            claims.keycloak_sub,
            claims.client_class,
            claims.session_id,
            claims.client_id,
            claims.username,
            claims.email,
            claims.auth_time_epoch,
            claims.issued_at_epoch,
            ip_address,
            user_agent,
        )

    async def _replace_current_session(
        self,
        conn: Any,  # noqa: ANN401 - asyncpg connection
        claims: SsoSessionClaims,
        replaced_session_id: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        await conn.execute(
            """
            UPDATE public.sso_user_sessions
            SET current_session_id = $3,
                client_id = $4,
                username = $5,
                email = $6,
                auth_time_epoch = $7,
                issued_at_epoch = $8,
                first_seen_at = now(),
                last_seen_at = now(),
                previous_session_id = $9,
                replaced_at = now(),
                replaced_by_session_id = $3,
                ip_address = $10,
                user_agent = $11
            WHERE keycloak_sub = $1 AND client_class = $2
            """,
            claims.keycloak_sub,
            claims.client_class,
            claims.session_id,
            claims.client_id,
            claims.username,
            claims.email,
            claims.auth_time_epoch,
            claims.issued_at_epoch,
            replaced_session_id,
            ip_address,
            user_agent,
        )

    async def lookup_current_session_id(
        self,
        keycloak_sub: str,
        client_class: SsoClientClass,
    ) -> str | None:
        """Read-only current session id for Socket.IO heartbeat revalidation (no row lock)."""
        sub = str(keycloak_sub).strip()
        if not sub:
            return None
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT current_session_id
                FROM public.sso_user_sessions
                WHERE keycloak_sub = $1 AND client_class = $2
                """,
                sub,
                client_class,
            )
        if row is None or row.get("current_session_id") is None:
            return None
        return str(row["current_session_id"])


_registry_singleton = SsoSessionRegistry()


def get_sso_session_registry() -> SsoSessionRegistry:
    """Return the process-local SSO session registry singleton."""

    return _registry_singleton
