# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SeaweedFS (S3) object storage for raw/processed KBSEW assets.
# ---

from __future__ import annotations

import io
import logging
from uuid import uuid4

from minio import Minio

from api.core.config import get_settings

logger = logging.getLogger(__name__)

_client: Minio | None = None


def get_minio_client() -> Minio:
    global _client  # noqa: PLW0603
    if _client is None:
        settings = get_settings()
        _client = Minio(
            f"{settings.minio_host}:{settings.minio_port}",
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket() -> None:
    settings = get_settings()
    client = get_minio_client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


async def upload_bytes(
    data: bytes,
    *,
    barrel_id: str,
    filename: str,
    content_type: str,
    object_key: str | None = None,
) -> str:
    settings = get_settings()
    ensure_bucket()
    resolved_key = (
        object_key or f"{settings.object_prefix}{barrel_id}/{uuid4().hex}_{filename}"
    )
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        resolved_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    logger.info("[STEP] kbsew_object_uploaded key=%s bytes=%s", resolved_key, len(data))
    return resolved_key


async def download_bytes(object_key: str) -> bytes:
    settings = get_settings()
    client = get_minio_client()
    response = client.get_object(settings.minio_bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
