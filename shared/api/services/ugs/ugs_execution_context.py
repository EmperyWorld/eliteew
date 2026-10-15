# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ContextVar tracking the active UGS queue-worker request_id to guard nested generate() calls.
# Invariants:
# - Only queue worker entry sets the context; nested generate() must not re-publish to RabbitMQ.
# Related:
# - api/services/ugs/queue_worker_execution.py
# - api/services/ugs/unified_generation_service.py
# ---
"""UGS execution context for nested generate() guards."""

from __future__ import annotations

from contextvars import ContextVar, Token

_active_ugs_worker_request_id: ContextVar[str | None] = ContextVar(
    "ugs_active_worker_request_id",
    default=None,
)


def get_active_ugs_worker_request_id() -> str | None:
    """Return request_id when code runs inside a UGS queue worker handler."""
    return _active_ugs_worker_request_id.get()


def enter_ugs_worker_request_context(request_id: str) -> Token[str | None]:
    """Bind worker request_id for nested generate() auto skip_queue."""
    return _active_ugs_worker_request_id.set(str(request_id).strip())


def exit_ugs_worker_request_context(token: Token[str | None]) -> None:
    """Restore previous worker context."""
    _active_ugs_worker_request_id.reset(token)
