# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Helpers to classify infrastructure errors so HTTP responses use 503 where appropriate (DB, queues, remote services).
#
# Invariants:
# Keep detection conservative: only map errors to migration hints when Postgres/SQLAlchemy patterns are unmistakable.
#
# Related:
# - api/main.py (global exception handler)
#
# ---
"""Service-unavailable classification for global HTTP handling and soft-fail collaboration paths."""

from sqlalchemy.exc import ProgrammingError as SAProgrammingError


def is_db_schema_migration_required_error(exc: BaseException) -> bool:
    """PostgreSQL schema drift (missing table/column) often surfaces as SQLAlchemy ProgrammingError.

    Return True so callers can respond with 503 + operator-facing hint instead of a generic HTTP 500.
    """
    if isinstance(exc, SAProgrammingError):
        msg = str(exc).lower()
        if (
            "does not exist" in msg
            or "undefined_column" in msg
            or "42703" in msg
            or "undefined_table" in msg
            or "42p01" in msg
        ):
            return True
    return bool(exc.__cause__ and is_db_schema_migration_required_error(exc.__cause__))


def is_db_connection_error(exc: BaseException) -> bool:
    """Treat SQLAlchemy/DB connection errors as 503 (service unavailable)."""
    t = type(exc)
    if "sqlalchemy" in (t.__module__ or "") and t.__name__ in ("OperationalError", "DBAPIError", "InterfaceError"):
        return True
    return bool(exc.__cause__ and is_db_connection_error(exc.__cause__))


def is_auth_provider_or_config_error(exc: BaseException) -> bool:
    """Treat auth provider config/connection errors as 503 (service unavailable)."""
    msg = str(exc).lower()
    if isinstance(exc, ValueError) and (
        "keycloak_client_secret" in msg or "oidc_provider" in msg or "auth_provider" in msg
    ):
        return True
    t = type(exc)
    mod = t.__module__ or ""
    if "httpx" in mod and t.__name__ in ("ConnectError", "ConnectTimeout", "ReadTimeout"):
        return True
    return bool(exc.__cause__ and is_auth_provider_or_config_error(exc.__cause__))


def is_keycloak_or_config_error(exc: BaseException) -> bool:
    """Backward-compatible alias for legacy callers.

    Deprecated: use :func:`is_auth_provider_or_config_error`.
    """
    return is_auth_provider_or_config_error(exc)


def is_service_unavailable_error(exc: BaseException) -> bool:
    """Treat Redis/AMQP/connection errors as 503 (service unavailable)."""
    msg = str(exc).lower()
    t = type(exc)
    mod = t.__module__ or ""
    if "redis" in mod:
        return True
    if "aiormq" in mod or "aio_pika" in mod:
        return True
    if "access_refused" in msg or "connection refused" in msg:
        return True
    return bool(exc.__cause__ and is_service_unavailable_error(exc.__cause__))


def is_elasticsearch_or_storage_error(exc: BaseException) -> bool:
    """Treat Elasticsearch/S3/Seaweed/MinIO/storage errors as 503 (service unavailable)."""
    t = type(exc)
    mod = t.__module__ or ""
    name = t.__name__
    if "elasticsearch" in mod:
        return True
    if "botocore" in mod or "s3transfer" in mod:
        return True
    if ("minio" in mod or "urllib3" in mod) and name in (
        "ConnectionError",
        "ConnectTimeout",
        "ReadTimeout",
        "ProtocolError",
    ):
        return True
    return bool(exc.__cause__ and is_elasticsearch_or_storage_error(exc.__cause__))


def is_any_service_unavailable(exc: BaseException) -> bool:
    """True if exc should be treated as service unavailable (503)."""
    return (
        is_db_connection_error(exc)
        or is_auth_provider_or_config_error(exc)
        or is_service_unavailable_error(exc)
        or is_elasticsearch_or_storage_error(exc)
        or is_db_schema_migration_required_error(exc)
    )
