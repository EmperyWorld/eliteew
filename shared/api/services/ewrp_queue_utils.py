# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for EWRP queue-worker failure messages (no DB/IO imports).
# Invariants:
# - Safe to import from unit tests without SQLAlchemy or FastAPI stack.
# Related:
# - api/services/ewrp_queue_resilience.py
# ---

from __future__ import annotations


def truncate_ewrp_queue_error_message(error_message: str, *, max_len: int = 500) -> str:
    """Normalize and cap error text stored on `ewrp_jobs.error_message`."""
    msg = (error_message or "").strip() or "queue_worker_error"
    if len(msg) <= max_len:
        return msg
    return msg[: max_len - 3] + "..."
