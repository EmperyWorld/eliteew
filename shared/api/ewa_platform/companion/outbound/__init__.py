# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion workflow outbound delivery adapters (Telegram, email).
# Invariants:
# - No secrets in logs; callers must enforce confirm_gate at workflow validation.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from api.ewa_platform.companion.outbound.email_send import send_workflow_email
from api.ewa_platform.companion.outbound.telegram_send import send_telegram_message

__all__ = ("send_telegram_message", "send_workflow_email")
