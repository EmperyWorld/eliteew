# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Back-compat re-export for chat workflow registry (prefer ``workflows.chat.registry``).
# Related:
# - api/ewa_platform/companion/workflows/chat/registry.py
# ---

from api.ewa_platform.companion.workflows.chat.registry import WorkflowId, match_workflow_id

__all__ = ("WorkflowId", "match_workflow_id")
