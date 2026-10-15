# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion workflows package: chat LLM flows + declarative action cycles (WF-1 split).
# Related:
# - api/ewa_platform/companion/workflows/chat/
# - api/ewa_platform/companion/workflows/action/
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md
# ---

from api.ewa_platform.companion.workflows.chat.runner import try_workflow_orchestration_reply

__all__ = ("try_workflow_orchestration_reply",)
