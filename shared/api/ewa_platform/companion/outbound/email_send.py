# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Send workflow emails through operator-configured SMTP (shared mobile trusted-device contour).
# Invariants:
# - Missing SMTP config fails closed with ``delivery_status=failed``.
# Related:
# - api/services/mobile_trusted_device_email.py
# ---

from __future__ import annotations

import asyncio
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Any

from api.core.unified_config import unified_settings


@dataclass(frozen=True, slots=True)
class EmailSendResult:
    ok: bool
    delivery_status: str
    to: str | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"delivery_status": self.delivery_status, "to": self.to}
        if self.error:
            payload["error"] = self.error
        return payload


def _send_sync(message: EmailMessage) -> None:
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
        if unified_settings.mobile_trusted_device_smtp_starttls and not unified_settings.mobile_trusted_device_smtp_ssl:
            smtp.starttls()
        username = unified_settings.mobile_trusted_device_smtp_username.strip()
        password = unified_settings.mobile_trusted_device_smtp_password
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)


async def send_workflow_email(*, to: str, subject: str, body: str, html: str | None = None) -> EmailSendResult:
    to_email = str(to or "").strip()
    subject_text = str(subject or "").strip() or "EliteEW notification"
    body_text = str(body or "").strip()
    if not to_email:
        return EmailSendResult(ok=False, delivery_status="failed", error="to_required")
    if not body_text and not html:
        return EmailSendResult(ok=False, delivery_status="failed", to=to_email, error="body_required")

    smtp_host = unified_settings.mobile_trusted_device_smtp_host.strip()
    from_email = unified_settings.mobile_trusted_device_smtp_from_email.strip()
    if not smtp_host or not from_email:
        return EmailSendResult(
            ok=False,
            delivery_status="failed",
            to=to_email,
            error="smtp_not_configured",
        )

    message = EmailMessage()
    message["Subject"] = subject_text
    message["From"] = from_email
    message["To"] = to_email
    if html:
        message.set_content(body_text or " ")
        message.add_alternative(str(html), subtype="html")
    else:
        message.set_content(body_text)

    try:
        await asyncio.to_thread(_send_sync, message)
    except Exception as exc:  # noqa: BLE001
        return EmailSendResult(
            ok=False,
            delivery_status="failed",
            to=to_email,
            error=str(exc)[:500],
        )
    return EmailSendResult(ok=True, delivery_status="sent", to=to_email)
