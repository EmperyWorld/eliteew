"""Чистые хелперы идемпотентности POST /ewrp (без FastAPI)."""

from __future__ import annotations

import hashlib
import uuid

EWRP_IDEMPOTENCY_TTL_SEC = 86400  # 24h
EWRP_IDEMPOTENCY_KEY_MIN_LEN = 8
EWRP_IDEMPOTENCY_KEY_MAX_LEN = 128
EWRP_IDEMPOTENCY_REDIS_PREFIX = "ewrp_create_idem:"


def normalize_ewrp_create_idempotency_key(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if len(s) < EWRP_IDEMPOTENCY_KEY_MIN_LEN or len(s) > EWRP_IDEMPOTENCY_KEY_MAX_LEN:
        return None
    return s


def ewrp_create_idempotency_redis_key(user_id: uuid.UUID, idem_key: str) -> str:
    digest = hashlib.sha256(idem_key.encode("utf-8")).hexdigest()
    return f"{EWRP_IDEMPOTENCY_REDIS_PREFIX}{user_id}:{digest}"
