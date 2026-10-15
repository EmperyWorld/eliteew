#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# SeaweedFS S3-compatible backend for large unified-content files using MinIO client wrappers.
# Invariants:
# - Constructor performs no network I/O; first operational call lazily validates endpoint and bucket.
# - Blocking S3 SDK calls always execute via asyncio.to_thread outside the event loop.
# - Incomplete object reads fail closed; archive export can skip the file via fail_fast.
# Related:
# - api/services/unified_content/storage_factory.py
# - api/core/unified_config.py
# ---
"""
SeaweedFS S3 Storage Backend
Stores large files (≥ 1MB) in SeaweedFS S3-compatible storage

SECURITY FIX #6: Server-side encryption support
Note: SeaweedFS replaced MinIO in this project
"""

import asyncio
import io
import logging
from uuid import UUID

from minio import Minio  # type: ignore[import-not-found]
from minio.error import S3Error  # type: ignore[import-not-found]
from minio.sseconfig import Rule, SSEConfig  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings

from .base import StorageBackend

logger = logging.getLogger(__name__)


class SeaweedFileNotFoundError(ValueError):
    """Raised when SeaweedFS reports that an object does not exist."""


class SeaweedFileCorruptedError(RuntimeError):
    """Raised when SeaweedFS cannot reliably read stored file data."""


class SeaweedStorageUnavailableError(SeaweedFileCorruptedError):
    """Raised when SeaweedFS responds with transient/unavailable storage errors."""


_S3_NOT_FOUND_CODES: frozenset[str] = frozenset(
    {
        "NoSuchKey",
        "NoSuchObject",
        "NoSuchBucket",
        "NotFound",
    }
)

_S3_TRANSIENT_CODES: frozenset[str] = frozenset(
    {
        "ServiceUnavailable",
        "SlowDown",
        "RequestTimeout",
        "RequestTimeoutException",
        "OperationTimedOut",
    }
)

_S3_CORRUPTED_CODES: frozenset[str] = frozenset({"InternalError"})


def _s3_error_code(exc: BaseException) -> str:
    return str(getattr(exc, "code", "") or "").strip()


def _is_s3_not_found_error(exc: BaseException) -> bool:
    return _s3_error_code(exc) in _S3_NOT_FOUND_CODES


def _is_s3_transient_error(exc: BaseException) -> bool:
    code = _s3_error_code(exc)
    if code in _S3_TRANSIENT_CODES:
        return True
    msg = str(getattr(exc, "message", None) or exc).lower()
    return "temporarily unavailable" in msg


def _is_s3_corrupted_error(exc: BaseException) -> bool:
    code = _s3_error_code(exc)
    if code in _S3_CORRUPTED_CODES:
        return True
    msg = str(getattr(exc, "message", None) or exc).lower()
    return "internal error" in msg


class SeaweedFSStorage(StorageBackend):
    """
    SeaweedFS S3-compatible storage for large files

    Uses MinIO Python client library for S3-compatible API.
    Backend is SeaweedFS (replaced MinIO).

    SECURITY FIX #6: Server-side encryption at rest
    """

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket_name: str = "unified-content",
        secure: bool | None = None,
        enable_encryption: bool | None = None,
    ) -> None:
        """Initialize SeaweedFS S3 storage backend."""

        settings = unified_settings

        endpoint = endpoint or settings.minio_endpoint  # Backward compatibility: still uses minio_* settings
        access_key = access_key or settings.minio_access_key
        secret_key = secret_key or settings.minio_secret_key
        bucket_name = bucket_name or settings.s3_bucket

        from urllib.parse import urlparse

        parsed_endpoint = urlparse(endpoint if "://" in endpoint else f"http://{endpoint}")
        endpoint_host = parsed_endpoint.netloc or parsed_endpoint.path or endpoint

        if ":" not in endpoint_host and settings.minio.internal_port:
            endpoint_host = f"{endpoint_host}:{settings.minio.internal_port}"

        if secure is None:
            secure = parsed_endpoint.scheme == "https" if parsed_endpoint.scheme else settings.minio_secure
        if enable_encryption is None:
            enable_encryption = settings.s3_use_bucket_default_sse
        region = (settings.aws_s3_region or "us-east-1").strip() or "us-east-1"

        logger.debug(
            "Initializing SeaweedFSStorage",
            extra={
                "endpoint": endpoint_host,
                "bucket": bucket_name,
                "secure": secure,
                "region": region,
                "enable_encryption": enable_encryption,
            },
        )

        # Create HTTP clients with connection pooling:
        # - default client keeps retries for regular downloads
        # - fast client is used by archive export to skip broken files immediately
        # Reachability is validated on self.client (same stack as production I/O), not a throwaway Minio.
        import urllib3
        from urllib3 import Retry
        from urllib3.util import Timeout

        def _build_http_client(
            *,
            retry_total: int | None,
            read_timeout: float,
            status_forcelist: tuple[int, ...] | None = None,
        ) -> urllib3.PoolManager:
            retries: Retry | bool
            if retry_total is None:
                retries = False
            else:
                # SeaweedFS often returns 500 when filer metadata exists but volume chunk is gone (orphan).
                # Retrying 500 here multiplies urllib3 attempts (~5) × retrieve() outer loop → ~90s before failure.
                force = list(status_forcelist or (429, 500, 502, 503, 504))
                retries = Retry(
                    total=retry_total,
                    backoff_factor=0.3,
                    status_forcelist=force,
                )

            return urllib3.PoolManager(
                num_pools=10,
                maxsize=20,
                retries=retries,
                timeout=Timeout(connect=10.0, read=read_timeout),
            )

        def _build_minio_client(http_client: urllib3.PoolManager) -> Minio:
            return Minio(
                endpoint=endpoint_host,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure,
                region=region,
                http_client=http_client,
            )

        # Writes / bucket checks: allow limited retries including transient 500.
        self.client = _build_minio_client(_build_http_client(retry_total=5, read_timeout=600.0))
        # Reads: do not retry HTTP 500 (missing chunk / filer error); still retry classic transient codes.
        self.read_client = _build_minio_client(
            _build_http_client(
                retry_total=3,
                read_timeout=600.0,
                status_forcelist=(429, 502, 503, 504),
            )
        )
        self.fast_client = _build_minio_client(_build_http_client(retry_total=None, read_timeout=30.0))
        self.endpoint = endpoint_host
        self.bucket_name = bucket_name
        self.enable_encryption = enable_encryption

        self._init_done = False
        self._init_lock: asyncio.Lock | None = None
        logger.debug(
            "SeaweedFS storage initialized without eager network I/O",
            extra={"bucket": self.bucket_name, "endpoint": self.endpoint},
        )

    def _get_init_lock(self) -> asyncio.Lock:
        if self._init_lock is None:
            self._init_lock = asyncio.Lock()
        return self._init_lock

    async def _ensure_initialized(self) -> None:
        """One-time lazy init for bucket existence and optional SSE setup."""
        if self._init_done:
            return
        async with self._get_init_lock():
            if self._init_done:
                return
            try:
                await asyncio.to_thread(self.client.list_buckets)
                await asyncio.to_thread(self._ensure_bucket_sync)
                self._init_done = True
                logger.info(
                    "SeaweedFS lazy initialization complete",
                    extra={"bucket": self.bucket_name, "endpoint": self.endpoint},
                )
            except Exception:
                logger.exception("SeaweedFS lazy initialization failed")
                raise

    def _ensure_bucket_sync(self) -> None:
        """Create bucket if it doesn't exist."""

        try:
            exists = self.client.bucket_exists(self.bucket_name)

            if not exists:
                self.client.make_bucket(self.bucket_name)
                logger.info("Created SeaweedFS bucket", extra={"bucket": self.bucket_name})
            else:
                logger.debug("SeaweedFS bucket already exists", extra={"bucket": self.bucket_name})

            if self.enable_encryption:
                self._configure_encryption()

        except Exception:
            logger.exception("Error ensuring SeaweedFS bucket")
            raise

    def _configure_encryption(self) -> None:
        """
        Configure server-side encryption for bucket
        """
        try:
            # Set default encryption for bucket (SSE-S3)
            config = SSEConfig(Rule.new_sse_s3_rule())
            self.client.set_bucket_encryption(self.bucket_name, config)
            logger.info("SeaweedFS encryption configured: bucket=%s | type=SSE-S3", self.bucket_name)
        except S3Error as e:
            code = getattr(e, "code", None) or ""
            if code == "BucketAlreadyExists":
                logger.debug(
                    "Bucket %s already exists (SeaweedFS collection), skipping encryption config",
                    self.bucket_name,
                )
                return
            logger.warning(
                "Failed to configure SeaweedFS encryption: %s. "
                "Encryption may not be supported on this SeaweedFS instance.",
                e,
            )

    async def store(
        self,
        content_id: UUID,
        file_data: bytes,
        filename: str,
        mime_type: str | None = None,
        conn=None,  # type: ignore[type-arg]  # Accept but ignore (SeaweedFS doesn't use transactions)
    ) -> str:
        """
        Store file in SeaweedFS S3 storage

        Returns object path: "unified-content/{content_id}/{filename}"
        """
        await self._ensure_initialized()

        object_name = f"{content_id}/{filename}"

        def _sync_put() -> str:
            """Synchronous put_object wrapped for thread pool."""
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=io.BytesIO(file_data),
                length=len(file_data),
                content_type=mime_type or "application/octet-stream",
            )
            return f"{self.bucket_name}/{object_name}"

        try:
            # Run blocking S3 operation in thread pool to avoid blocking event loop
            result = await asyncio.to_thread(_sync_put)
            return result
        except S3Error as e:
            logger.error(
                "SeaweedFS S3Error on put_object bucket=%s key=%s code=%s message=%s",
                self.bucket_name,
                object_name,
                getattr(e, "code", None),
                getattr(e, "message", None) or str(e),
            )
            msg = f"Failed to store in SeaweedFS: {e}"
            raise RuntimeError(msg) from e

    async def retrieve(
        self,
        storage_path: str,
        content_id: UUID,
        *,
        fail_fast: bool = False,
    ) -> bytes:
        """
        Retrieve file from SeaweedFS S3 storage

        Args:
            storage_path: Format "bucket/content_id/filename"
            fail_fast: Disable retries and partial recovery for best-effort archive export
        """
        from http.client import IncompleteRead as HTTPIncompleteRead

        await self._ensure_initialized()

        try:
            from urllib3.exceptions import ProtocolError as Urllib3ProtocolError
        except ImportError:
            Urllib3ProtocolError = type(None)  # noqa: E731

        # Parse storage_path: "unified-content/uuid/filename"
        parts = storage_path.split("/", 1)
        bucket = parts[0] if len(parts) > 0 else self.bucket_name
        object_name = parts[1] if len(parts) > 1 else str(content_id)
        client = self.fast_client if fail_fast else self.read_client
        max_attempts = 1 if fail_fast else 4

        def _sync_get() -> bytes:
            """Synchronous get_object wrapped for thread pool."""
            response = client.get_object(bucket, object_name)
            try:
                data = response.read()
            except HTTPIncompleteRead as e:
                partial_len = len(getattr(e, "partial", b"") or b"")
                # Seaweed volume needle 404 streams 0 bytes then breaks — treat as not-found.
                if partial_len == 0 or "0 bytes read" in str(e):
                    raise SeaweedFileNotFoundError(
                        f"Content {content_id} not found in SeaweedFS: empty incomplete read"
                    ) from e
                raise SeaweedFileCorruptedError(
                    f"Incomplete SeaweedFS read for content_id={content_id}; partial data refused"
                ) from e
            finally:
                response.close()
                response.release_conn()
            return data

        def _is_retryable(e: BaseException) -> bool:
            # IncompleteRead / needle 404-class → fail-fast (SoT broken-files); do not burn 4 attempts.
            if isinstance(e, HTTPIncompleteRead):
                return False
            if isinstance(e, (SeaweedFileNotFoundError, SeaweedFileCorruptedError)):
                return False
            err_text = str(e)
            if "IncompleteRead" in err_text:
                return False
            if isinstance(e, (ConnectionError, OSError)):
                return True
            if Urllib3ProtocolError is not type(None) and isinstance(e, Urllib3ProtocolError):
                # ProtocolError without IncompleteRead may be transient transport noise.
                return "IncompleteRead" not in err_text
            return False

        last_error: BaseException | None = None
        for attempt in range(max_attempts):
            try:
                return await asyncio.to_thread(_sync_get)
            except SeaweedFileNotFoundError, SeaweedFileCorruptedError, SeaweedStorageUnavailableError:
                raise
            except S3Error as e:
                logger.error(
                    "SeaweedFS S3Error on get_object content_id=%s bucket=%s object=%s code=%s message=%s",
                    content_id,
                    bucket,
                    object_name,
                    getattr(e, "code", None),
                    getattr(e, "message", None) or str(e),
                )
                if _is_s3_not_found_error(e):
                    msg = f"Content {content_id} not found in SeaweedFS: {e}"
                    raise SeaweedFileNotFoundError(msg) from e
                if _is_s3_corrupted_error(e):
                    msg = f"File data appears corrupted or unreadable in SeaweedFS for content_id={content_id}: {e!s}"
                    if not fail_fast:
                        logger.error(msg)
                    raise SeaweedFileCorruptedError(msg) from e
                if _is_s3_transient_error(e):
                    last_error = e
                    if attempt < max_attempts - 1:
                        logger.warning(
                            "SeaweedFS transient S3Error on get_object content_id=%s attempt=%s/%s; retrying",
                            content_id,
                            attempt + 1,
                            max_attempts,
                        )
                        continue
                    msg = (
                        f"SeaweedFS temporarily unavailable for content_id={content_id}: "
                        f"code={_s3_error_code(e) or 'unknown'} message={str(getattr(e, 'message', None) or e)}"
                    )
                    raise SeaweedStorageUnavailableError(msg) from e
                msg = f"File data appears corrupted or unreadable in SeaweedFS for content_id={content_id}: {e!s}"
                if not fail_fast:
                    logger.error(msg)
                raise SeaweedFileCorruptedError(msg) from e
            except Exception as e:
                last_error = e
                if _is_retryable(e) and attempt < max_attempts - 1:
                    logger.warning(
                        "SeaweedFS retrieve attempt %s failed for %s: %s, retrying",
                        attempt + 1,
                        content_id,
                        e,
                    )
                else:
                    err_text = str(e)
                    if "IncompleteRead" in err_text and "0 bytes read" in err_text:
                        msg = f"Content {content_id} not found in SeaweedFS: empty incomplete read"
                        if not fail_fast:
                            logger.error(msg)
                        raise SeaweedFileNotFoundError(msg) from e
                    # After retries, treat as corrupted/missing file for higher-level 404 handling
                    msg = f"File data appears corrupted or unreadable in SeaweedFS for content_id={content_id}: {e!s}"
                    if not fail_fast:
                        logger.error(msg)
                    raise SeaweedFileCorruptedError(msg) from e
        # Should not be reached, but keep a defensive fallback
        msg = f"File data appears corrupted or unreadable in SeaweedFS for content_id={content_id}: {last_error!s}"
        if not fail_fast:
            logger.error(msg)
        raise SeaweedFileCorruptedError(msg) from (last_error or Exception(msg))

    async def delete(self, storage_path: str, content_id: UUID) -> bool:
        """
        Delete file from SeaweedFS S3 storage
        """
        await self._ensure_initialized()

        parts = storage_path.split("/", 1)
        bucket = parts[0] if len(parts) > 0 else self.bucket_name
        object_name = parts[1] if len(parts) > 1 else str(content_id)

        def _sync_delete() -> bool:
            """Synchronous remove_object wrapped for thread pool."""
            self.client.remove_object(bucket, object_name)
            return True

        try:
            return await asyncio.to_thread(_sync_delete)
        except S3Error:
            return False

    async def exists(self, storage_path: str, content_id: UUID) -> bool:
        """
        Check if file exists in SeaweedFS S3 storage
        """
        await self._ensure_initialized()

        parts = storage_path.split("/", 1)
        bucket = parts[0] if len(parts) > 0 else self.bucket_name
        object_name = parts[1] if len(parts) > 1 else str(content_id)

        def _sync_exists() -> bool:
            """Synchronous stat_object wrapped for thread pool."""
            self.read_client.stat_object(bucket, object_name)
            return True

        try:
            return await asyncio.to_thread(_sync_exists)
        except S3Error:
            return False

    async def verify_object_readable(self, storage_path: str, content_id: UUID) -> bool:
        """
        True if the first byte can be read.

        SeaweedFS may leave filer/S3 metadata while the volume chunk is missing (404 on volume);
        stat_object can still succeed, so admin scans must probe a real read.
        """
        await self._ensure_initialized()

        parts = storage_path.split("/", 1)
        bucket = parts[0] if len(parts) > 0 else self.bucket_name
        object_name = parts[1] if len(parts) > 1 else str(content_id)

        def _sync_probe() -> bool:
            try:
                response = self.fast_client.get_object(bucket, object_name, offset=0, length=1)
            except S3Error:
                return False
            try:
                try:
                    response.read(1)
                finally:
                    response.close()
                    response.release_conn()
            except Exception as exc:
                logger.debug(
                    "[STEP] minio_object_probe_read_skip content_id=%s path=%s err=%s",
                    content_id,
                    storage_path,
                    exc,
                )
                return False
            return True

        try:
            return bool(await asyncio.to_thread(_sync_probe))
        except Exception:
            logger.debug(
                "verify_object_readable failed content_id=%s path=%s",
                content_id,
                storage_path,
                exc_info=True,
            )
            return False

    async def probe_health(self) -> dict[str, object]:
        """
        Lightweight SeaweedFS/S3 reachability check for admin diagnostics.

        Returns ok=True when list_buckets and bucket_exists succeed.
        """
        import time

        started = time.perf_counter()
        try:
            await asyncio.to_thread(self.client.list_buckets)
            bucket_ok = await asyncio.to_thread(self.client.bucket_exists, self.bucket_name)
            latency_ms = int((time.perf_counter() - started) * 1000)
            if not bucket_ok:
                return {
                    "ok": False,
                    "latency_ms": latency_ms,
                    "error_code": "bucket_missing",
                    "message": f"SeaweedFS bucket {self.bucket_name!r} is not available",
                    "bucket": self.bucket_name,
                    "endpoint": self.endpoint,
                }
            return {
                "ok": True,
                "latency_ms": latency_ms,
                "error_code": None,
                "message": "SeaweedFS S3 endpoint responded successfully",
                "bucket": self.bucket_name,
                "endpoint": self.endpoint,
            }
        except S3Error as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            code = _s3_error_code(exc) or "s3_error"
            return {
                "ok": False,
                "latency_ms": latency_ms,
                "error_code": code,
                "message": str(getattr(exc, "message", None) or exc),
                "bucket": self.bucket_name,
                "endpoint": self.endpoint,
            }
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            logger.debug("[STEP] seaweed_probe_health_skip err=%s", exc, exc_info=True)
            return {
                "ok": False,
                "latency_ms": latency_ms,
                "error_code": "probe_failed",
                "message": str(exc),
                "bucket": self.bucket_name,
                "endpoint": self.endpoint,
            }

    def get_backend_name(self) -> str:
        return "seaweedfs"  # Changed from "minio" to "seaweedfs"
