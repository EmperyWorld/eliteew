#!/usr/bin/env python3
"""
Rate Limiter Service
Implements token bucket algorithm for upload rate limiting

SECURITY FIX #3: Upload rate limiting per user
"""

import logging
import time
from dataclasses import dataclass
from typing import Any

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)


@dataclass
class TokenBucket:
    """
    Token bucket for rate limiting

    Algorithm:
    - Tokens are added at a constant rate (refill_rate)
    - Each request consumes a token
    - If no tokens available, request is rejected
    - Supports burst capacity
    """

    capacity: int  # Maximum tokens
    tokens: float  # Current tokens
    refill_rate: float  # Tokens per second
    last_refill: float  # Last refill timestamp

    def refill(self) -> None:
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate

        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now

    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens

        Args:
            tokens: Number of tokens to consume

        Returns:
            True if tokens consumed, False if insufficient
        """
        self.refill()

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def get_wait_time(self, tokens: int = 1) -> float:
        """
        Calculate wait time until tokens available

        Args:
            tokens: Number of tokens needed

        Returns:
            Wait time in seconds (0 if tokens available)
        """
        self.refill()

        if self.tokens >= tokens:
            return 0.0

        tokens_needed = tokens - self.tokens
        return tokens_needed / self.refill_rate


class RateLimiter:
    """
    Rate limiter for upload operations

    Features:
    - Per-user rate limiting
    - Token bucket algorithm
    - Configurable limits and burst
    - Automatic cleanup of old entries
    """

    def __init__(
        self,
        requests_per_minute: int = 10,
        burst_capacity: int = 20,
        cleanup_interval: int = 300,  # 5 minutes
    ):
        """
        Initialize rate limiter

        Args:
            requests_per_minute: Sustained request rate per minute
            burst_capacity: Maximum burst size
            cleanup_interval: Cleanup old entries every N seconds
        """
        self.requests_per_minute = requests_per_minute
        self.burst_capacity = burst_capacity
        self.cleanup_interval = cleanup_interval

        # Refill rate: requests per second
        self.refill_rate = requests_per_minute / 60.0

        # Per-user token buckets
        self.buckets: dict[str, TokenBucket] = {}

        # Last cleanup time
        self.last_cleanup = time.time()

        logger.info(f"Rate limiter initialized: {requests_per_minute} req/min, burst={burst_capacity}")

    def _get_bucket(self, user_id: str) -> TokenBucket:
        """
        Get or create token bucket for user

        Args:
            user_id: User ID

        Returns:
            TokenBucket instance
        """
        if user_id not in self.buckets:
            self.buckets[user_id] = TokenBucket(
                capacity=self.burst_capacity,
                tokens=self.burst_capacity,  # Start with full bucket
                refill_rate=self.refill_rate,
                last_refill=time.time(),
            )

        return self.buckets[user_id]

    def check_rate_limit(self, user_id: str) -> tuple[bool, float | None]:
        """
        Check if request is allowed under rate limit

        Args:
            user_id: User ID

        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        # Cleanup old entries periodically
        self._cleanup_old_entries()

        bucket = self._get_bucket(user_id)

        if bucket.consume():
            logger.debug(f"Rate limit OK: user={user_id} | tokens_remaining={bucket.tokens:.1f}/{bucket.capacity}")
            return True, None

        # Rate limit exceeded
        wait_time = bucket.get_wait_time()

        logger.warning(f"Rate limit exceeded: user={user_id} | retry_after={wait_time:.1f}s")

        return False, wait_time

    def _cleanup_old_entries(self) -> None:
        """Remove old token buckets to prevent memory leak"""
        now = time.time()

        if now - self.last_cleanup < self.cleanup_interval:
            return

        # Remove buckets not used in last hour
        cutoff = now - 3600
        to_remove = [user_id for user_id, bucket in self.buckets.items() if bucket.last_refill < cutoff]

        for user_id in to_remove:
            del self.buckets[user_id]

        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old rate limit entries")

        self.last_cleanup = now

    def get_user_stats(self, user_id: str) -> dict[str, Any]:
        """
        Get rate limit stats for user

        Args:
            user_id: User ID

        Returns:
            (dict[str, Any]) with rate limit statistics
        """
        bucket = self._get_bucket(user_id)
        bucket.refill()

        return {
            "user_id": user_id,
            "tokens_remaining": int(bucket.tokens),
            "capacity": bucket.capacity,
            "refill_rate_per_minute": self.requests_per_minute,
            "time_until_refill": max(0, 60 / self.requests_per_minute - (time.time() - bucket.last_refill)),
        }


# Global rate limiter instance
_upload_rate_limiter: RateLimiter | None = None
_feedback_ticket_rate_limiter: RateLimiter | None = None
_product_assistant_chat_rate_limiter: RateLimiter | None = None


def get_upload_rate_limiter() -> RateLimiter:
    """
    Get global upload rate limiter instance

    Configuration from environment variables:
    - UPLOAD_RATE_LIMIT_PER_MINUTE: Requests per minute (default: 10)
    - UPLOAD_RATE_LIMIT_BURST: Burst capacity (default: 20)

    Returns:
        RateLimiter instance
    """
    global _upload_rate_limiter

    if _upload_rate_limiter is None:
        requests_per_minute = unified_settings.upload_rate_limit_per_minute
        burst_capacity = unified_settings.upload_rate_limit_burst

        _upload_rate_limiter = RateLimiter(requests_per_minute=requests_per_minute, burst_capacity=burst_capacity)

    return _upload_rate_limiter


def get_feedback_ticket_rate_limiter() -> RateLimiter:
    """
    Rate limiter for POST /product-desktop/feedback/tickets (per user_id).

    Env: FEEDBACK_TICKET_RATE_LIMIT_PER_MINUTE, FEEDBACK_TICKET_RATE_LIMIT_BURST
    """
    global _feedback_ticket_rate_limiter

    if _feedback_ticket_rate_limiter is None:
        rpm = unified_settings.feedback_ticket_rate_limit_per_minute
        burst = unified_settings.feedback_ticket_rate_limit_burst
        _feedback_ticket_rate_limiter = RateLimiter(
            requests_per_minute=rpm,
            burst_capacity=burst,
        )

    return _feedback_ticket_rate_limiter


def get_product_assistant_chat_rate_limiter() -> RateLimiter:
    """
    Rate limiter for POST /product-desktop/assistant/chat and /assistant/chat/stream (per user_id).

    Env: ASSISTANT_CHAT_RATE_LIMIT_PER_MINUTE, ASSISTANT_CHAT_RATE_LIMIT_BURST
    """
    global _product_assistant_chat_rate_limiter

    if _product_assistant_chat_rate_limiter is None:
        rpm = unified_settings.assistant_chat_rate_limit_per_minute
        burst = unified_settings.assistant_chat_rate_limit_burst
        _product_assistant_chat_rate_limiter = RateLimiter(
            requests_per_minute=rpm,
            burst_capacity=burst,
        )

    return _product_assistant_chat_rate_limiter


def reset_rate_limiter() -> None:
    """Reset global rate limiter (for testing)"""
    global _upload_rate_limiter, _feedback_ticket_rate_limiter, _product_assistant_chat_rate_limiter
    _upload_rate_limiter = None
    _feedback_ticket_rate_limiter = None
    _product_assistant_chat_rate_limiter = None
