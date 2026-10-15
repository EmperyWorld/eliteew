#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sends trusted-device transfer confirmation emails through operator-configured SMTP.
# Invariants:
# - Email content must never include private keys, encrypted transfer blob contents, or raw bearer/session tokens.
# - Missing SMTP configuration fails closed; transfer cannot advance as email-confirmed without a sent token.
# Related:
# - api.services.mobile_trusted_device_service
# - documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
# ---

from __future__ import annotations

import asyncio
import smtplib
from datetime import datetime
from email.message import EmailMessage
from uuid import UUID

from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings


class MobileTrustedDeviceEmailNotifier:
    """Small SMTP adapter for trusted-device transfer confirmation."""

    async def send_transfer_confirmation(
        self,
        *,
        to_email: str,
        transfer_id: UUID,
        confirmation_token: str,
        expires_at: datetime,
    ) -> None:
        smtp_host = unified_settings.mobile_trusted_device_smtp_host.strip()
        from_email = unified_settings.mobile_trusted_device_smtp_from_email.strip()
        if not smtp_host or not from_email:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Trusted-device transfer email is not configured.",
            )
        message = self._build_message(
            from_email=from_email,
            to_email=to_email,
            transfer_id=transfer_id,
            confirmation_token=confirmation_token,
            expires_at=expires_at,
        )
        await asyncio.to_thread(self._send, message)

    def _build_message(
        self,
        *,
        from_email: str,
        to_email: str,
        transfer_id: UUID,
        confirmation_token: str,
        expires_at: datetime,
    ) -> EmailMessage:
        confirm_url = f"{unified_settings.public_base_url}/api/v1/mobile-devices/transfer/{transfer_id}/confirm-email"
        message = EmailMessage()
        message["Subject"] = "EliteEW trusted-device transfer confirmation"
        message["From"] = from_email
        message["To"] = to_email
        message.set_content(
            "\n".join(
                [
                    "EliteEW trusted-device transfer confirmation",
                    "",
                    "A transfer of encrypted mobile device material was approved by an administrator.",
                    "Confirm it only if you initiated this transfer from your own account.",
                    "",
                    f"Transfer: {transfer_id}",
                    f"Confirmation endpoint: {confirm_url}",
                    f"Confirmation code: {confirmation_token}",
                    f"Expires at: {expires_at.isoformat()}",
                    "",
                    "EliteEW support",
                ]
            )
        )
        return message

    def _send(self, message: EmailMessage) -> None:
        timeout = float(unified_settings.mobile_trusted_device_smtp_timeout_seconds)
        if unified_settings.mobile_trusted_device_smtp_ssl:
            smtp_cls: type[smtplib.SMTP] = smtplib.SMTP_SSL
        else:
            smtp_cls = smtplib.SMTP
        with smtp_cls(
            unified_settings.mobile_trusted_device_smtp_host.strip(),
            int(unified_settings.mobile_trusted_device_smtp_port),
            timeout=timeout,
        ) as smtp:
            if (
                unified_settings.mobile_trusted_device_smtp_starttls
                and not unified_settings.mobile_trusted_device_smtp_ssl
            ):
                smtp.starttls()
            username = unified_settings.mobile_trusted_device_smtp_username.strip()
            password = unified_settings.mobile_trusted_device_smtp_password
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
