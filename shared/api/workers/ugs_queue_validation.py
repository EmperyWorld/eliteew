#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure validation helpers for RabbitMQ payloads (no aiohttp/DB); used by queue handlers and tests.
# Invariants:
# - Fail fast with ValueError and stable English messages for invalid UGS queue payloads.
# Related:
# - api/workers/queue_handlers.py
# ---
"""UGS queue message payload validation (stdlib only)."""

from __future__ import annotations

from typing import Any


def parse_ugs_generation_request_id(payload: dict[str, Any]) -> str:
    """Return trimmed request_id for ``task_type=ugs_generation`` queue messages."""
    raw_id = payload.get("request_id")
    if raw_id is None:
        raise ValueError("ugs_generation payload missing request_id")
    request_id = str(raw_id).strip()
    if not request_id:
        raise ValueError("ugs_generation payload has empty request_id")
    return request_id
