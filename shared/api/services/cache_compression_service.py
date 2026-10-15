"""
CACHE COMPRESSION SERVICE — компрессия больших значений

Автоматически сжимает большие значения (>1KB) перед сохранением в Redis.
Прозрачно для пользователя - автоматическая распаковка при чтении.

Использование:
    from api.services.cache_compression_service import compress_value, decompress_value

    # Автоматическая компрессия
    compressed = compress_value(large_dict)

    # Автоматическая декомпрессия
    original = decompress_value(compressed)
"""

import gzip
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Порог для компрессии (в байтах)
COMPRESSION_THRESHOLD = 1024  # 1KB

# Use compression.zstd when available (Python 3.14+ stdlib)
try:
    from compression import zstd as _zstd  # noqa: PLC0415

    _USE_ZSTD = True
except ImportError:
    _USE_ZSTD = False
    _zstd = None

_PREFIX_GZIP = b"__COMPRESSED__"
_PREFIX_ZSTD = b"__COMPRESSED_ZSTD__"


def compress_value(value: Any, threshold: int = COMPRESSION_THRESHOLD) -> bytes | Any:
    """
    Сжать значение если оно больше порога

    Args:
        value: Значение для сжатия
        threshold: Минимальный размер для сжатия (в байтах)

    Returns:
        Сжатые байты (с префиксом __COMPRESSED__ или __COMPRESSED_ZSTD__) или оригинальное значение
    """
    try:
        # Сериализуем в JSON
        json_str = json.dumps(value, default=str)
        json_bytes = json_str.encode("utf-8")

        # Если размер меньше порога - не сжимаем
        if len(json_bytes) < threshold:
            return value

        if _USE_ZSTD and _zstd is not None:
            compressed = _zstd.compress(json_bytes)
            return _PREFIX_ZSTD + compressed
        # gzip fallback (Python < 3.14 or zstd unavailable)
        compressed = gzip.compress(json_bytes, compresslevel=6)
        return _PREFIX_GZIP + compressed

    except Exception as e:
        logger.warning("Cache compression error: %s", e)
        return value  # Возвращаем оригинал при ошибке


def decompress_value(value: bytes | Any) -> Any:
    """
    Распаковать значение если оно сжато

    Args:
        value: Значение для распаковки

    Returns:
        Распакованное значение или оригинал если не сжато
    """
    try:
        if not isinstance(value, bytes):
            return value
        # Zstd (Python 3.14+, new format)
        if value.startswith(_PREFIX_ZSTD):
            if _USE_ZSTD and _zstd is not None:
                compressed_data = value[len(_PREFIX_ZSTD) :]
                json_bytes = _zstd.decompress(compressed_data)
                return json.loads(json_bytes.decode("utf-8"))
            logger.warning("Zstd-compressed value but zstd unavailable, returning raw")
            return value
        # Gzip (legacy format)
        if value.startswith(_PREFIX_GZIP):
            compressed_data = value[len(_PREFIX_GZIP) :]
            json_bytes = gzip.decompress(compressed_data)
            return json.loads(json_bytes.decode("utf-8"))
        return value

    except Exception as e:
        logger.warning("Cache decompression error: %s", e)
        return value  # Возвращаем оригинал при ошибке


def should_compress(value: Any, threshold: int = COMPRESSION_THRESHOLD) -> bool:
    """
    Проверить нужно ли сжимать значение

    Args:
        value: Значение для проверки
        threshold: Порог размера

    Returns:
        True если нужно сжимать
    """
    try:
        json_str = json.dumps(value, default=str)
        json_bytes = json_str.encode("utf-8")
        return len(json_bytes) >= threshold
    except Exception as exc:
        logger.debug("[STEP] cache_compression_should_compress_skip err=%s", exc)
        return False
