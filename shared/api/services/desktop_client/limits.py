# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-process rate limit + short-lived challenge store for desktop-client enroll.
# Invariants:
# - Fail closed when over limit; challenges expire.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import threading
import time
from dataclasses import dataclass


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


class SlidingTokenBucket:
    """Simple per-key token bucket (process-local; fine for Wave 2 private perimeter)."""

    def __init__(self, *, capacity: float, refill_per_sec: float) -> None:
        self._capacity = capacity
        self._refill = refill_per_sec
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, *, cost: float = 1.0) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(tokens=self._capacity, updated_at=now)
                self._buckets[key] = bucket
            elapsed = now - bucket.updated_at
            bucket.tokens = min(self._capacity, bucket.tokens + elapsed * self._refill)
            bucket.updated_at = now
            if bucket.tokens < cost:
                return False
            bucket.tokens -= cost
            return True


@dataclass
class StoredChallenge:
    nonce: str
    device_pubkey: str
    expires_at: float


class ChallengeStore:
    def __init__(self, *, ttl_sec: float = 300.0) -> None:
        self._ttl = ttl_sec
        self._items: dict[str, StoredChallenge] = {}
        self._lock = threading.Lock()

    def put(self, *, device_pubkey: str, nonce: str) -> StoredChallenge:
        exp = time.monotonic() + self._ttl
        item = StoredChallenge(nonce=nonce, device_pubkey=device_pubkey, expires_at=exp)
        with self._lock:
            self._purge_locked()
            self._items[device_pubkey] = item
        return item

    def pop_valid(self, *, device_pubkey: str, nonce: str) -> bool:
        return self.consume_if_match(device_pubkey=device_pubkey, nonce=nonce) == "matched"

    def consume_if_match(self, *, device_pubkey: str, nonce: str) -> str:
        """Return matched | missing | mismatch. Mismatch does not burn the live challenge."""
        now = time.monotonic()
        with self._lock:
            self._purge_locked()
            item = self._items.get(device_pubkey)
            if item is None:
                return "missing"
            if item.expires_at < now:
                del self._items[device_pubkey]
                return "missing"
            if item.nonce != nonce:
                return "mismatch"
            del self._items[device_pubkey]
            return "matched"

    def _purge_locked(self) -> None:
        now = time.monotonic()
        dead = [k for k, v in self._items.items() if v.expires_at < now]
        for k in dead:
            del self._items[k]


# Shared process singletons for routers (tests may replace on service ctor).
redeem_rate_limiter = SlidingTokenBucket(capacity=10, refill_per_sec=10 / 60)
challenge_store = ChallengeStore(ttl_sec=300.0)
auth_binding_rate_limiter = SlidingTokenBucket(capacity=30, refill_per_sec=30 / 60)
auth_binding_challenge_store = ChallengeStore(ttl_sec=300.0)
air_enroll_ws_rate_limiter = SlidingTokenBucket(capacity=8, refill_per_sec=8 / 60)
