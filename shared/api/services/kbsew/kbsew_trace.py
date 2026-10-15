# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Propagate trace_id from stack0 desktop/AMKA turns into KBSEW HTTP calls for correlated logs.
# Invariants:
# - trace_id is optional; callers must not fail when unset.
# Related:
# - api/services/kbsew/kbsew_client.py
# ---

from __future__ import annotations

import contextlib
import contextvars
from collections.abc import Iterator
from uuid import uuid4

_kbsew_trace_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "kbsew_trace_id",
    default=None,
)


def get_kbsew_trace_id() -> str | None:
    return _kbsew_trace_id.get()


def set_kbsew_trace_id(trace_id: str | None) -> contextvars.Token[str | None]:
    return _kbsew_trace_id.set((trace_id or "").strip() or None)


def new_kbsew_trace_id() -> str:
    return str(uuid4())


@contextlib.contextmanager
def kbsew_trace_scope(trace_id: str | None = None) -> Iterator[str]:
    tid = (trace_id or new_kbsew_trace_id()).strip()
    token = set_kbsew_trace_id(tid)
    try:
        yield tid
    finally:
        _kbsew_trace_id.reset(token)
