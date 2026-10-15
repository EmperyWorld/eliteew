# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/base_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Base Service - Standardized Error Handling and Response Patterns
=================================================================

Purpose:
    Provides a standardized base class for all API services with consistent
    error handling, logging, and response patterns.

Features:
    ✅ Standardized HTTPException raising with consistent error codes
    ✅ Structured logging with context
    ✅ Database transaction management
    ✅ Common validation patterns
    ✅ Response formatting utilities

Usage:
    from api.services.base_service import BaseService

    class MyService(BaseService):
        async def my_method(self, param):
            with self.db_transaction():
                # Business logic here
                self.validate_required(param, "param")
                return await self.db_execute("SELECT * FROM table WHERE id = $1", param)

Author: Claude Code AI (Backend Developer Agent)
Created: 2025-10-26
Priority: P1 HIGH
"""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any, Never
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)


class ServiceError(Exception):
    """Base exception for service-level errors"""

    def __init__(self, message: str, status_code: int = 500, details: dict[str, Any] | None = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class ValidationError(ServiceError):
    """Validation error with 400 status"""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message, 400, {"field": field} if field else {})


class NotFoundError(ServiceError):
    """Resource not found error with 404 status"""

    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            f"{resource} with id {identifier} not found",
            404,
            {"resource": resource, "id": identifier},
        )


class PermissionError(ServiceError):
    """Permission denied error with 403 status"""

    def __init__(self, message: str = "Access denied"):
        super().__init__(message, 403)


class BaseService:
    """
    Base service class providing standardized error handling and utilities.

    All API services should inherit from this class to ensure consistent behavior.
    """

    def __init__(self, db_pool: asyncpg.Pool | None = None):
        self.db_pool = db_pool
        self.logger = logging.getLogger(self.__class__.__name__)

    def set_db_pool(self, db_pool: asyncpg.Pool) -> None:
        """Set database connection pool"""
        self.db_pool = db_pool

    @asynccontextmanager
    async def db_transaction(self) -> AsyncIterator[asyncpg.Connection]:  # type: ignore[return-value]
        """
        Database transaction context manager.

        Usage:
            async with self.db_transaction():
                await self.db_execute("INSERT INTO...")
                await self.db_execute("UPDATE...")
        """
        if not self.db_pool:
            msg = "Database pool not initialized"
            raise ServiceError(msg, 500)

        async with self.db_pool.acquire() as conn, conn.transaction():  # type: ignore[assignment]
            yield conn  # type: ignore[misc]

    async def db_execute(self, query: str, *args, conn: asyncpg.Connection | None = None) -> Any:
        """
        Execute database query with error handling.

        Args:
            query: SQL query string
            *args: Query parameters
            conn: Optional connection (uses pool if not provided)

        Returns:
            Query result

        Raises:
            HTTPException: On database errors
        """
        if not self.db_pool and not conn:
            raise HTTPException(status_code=500, detail="Database pool not initialized")

        try:
            if conn:
                return await conn.execute(query, *args)  # type: ignore
            # Type narrowing: after None check, db_pool is guaranteed to be not None
            assert self.db_pool is not None  # Type narrowing for type checker
            async with self.db_pool.acquire() as conn_acquired:  # type: ignore
                return await conn_acquired.execute(query, *args)
        except asyncpg.exceptions.UniqueViolationError as e:
            self.logger.warning("Unique constraint violation: %s", e)
            raise HTTPException(status_code=409, detail="Resource already exists") from e
        except asyncpg.exceptions.ForeignKeyViolationError as e:
            self.logger.warning("Foreign key violation: %s", e)
            raise HTTPException(status_code=400, detail="Invalid reference") from e
        except asyncpg.exceptions.CheckViolationError as e:
            self.logger.warning("Check constraint violation: %s", e)
            raise HTTPException(status_code=400, detail="Invalid data") from e
        except Exception as e:
            self.logger.exception("Database error in {query}")
            raise HTTPException(status_code=500, detail="Database operation failed") from e

    async def db_fetchrow(self, query: str, *args, conn: asyncpg.Connection | None = None) -> asyncpg.Record | None:
        """
        Fetch single row from database.

        Args:
            query: SQL query string
            *args: Query parameters
            conn: Optional connection

        Returns:
            Single row or None
        """
        if not self.db_pool and not conn:
            raise HTTPException(status_code=500, detail="Database pool not initialized")

        try:
            if conn:
                return await conn.fetchrow(query, *args)  # type: ignore
            # Type narrowing: after None check, db_pool is guaranteed to be not None
            assert self.db_pool is not None  # Type narrowing for type checker
            async with self.db_pool.acquire() as conn_acquired:  # type: ignore
                return await conn_acquired.fetchrow(query, *args)
        except Exception as e:
            self.logger.exception("Database fetch error in {query}")
            raise HTTPException(status_code=500, detail="Database query failed") from e

    async def db_fetch(self, query: str, *args, conn: asyncpg.Connection | None = None) -> list[asyncpg.Record]:
        """
        Fetch multiple rows from database.

        Args:
            query: SQL query string
            *args: Query parameters
            conn: Optional connection

        Returns:
            List of rows
        """
        if not self.db_pool and not conn:
            raise HTTPException(status_code=500, detail="Database pool not initialized")

        try:
            if conn:
                return await conn.fetch(query, *args)  # type: ignore
            # Type narrowing: after None check, db_pool is guaranteed to be not None
            assert self.db_pool is not None  # Type narrowing for type checker
            async with self.db_pool.acquire() as conn_acquired:  # type: ignore
                return await conn_acquired.fetch(query, *args)
        except Exception as e:
            self.logger.exception("Database fetch error in {query}")
            raise HTTPException(status_code=500, detail="Database query failed") from e

    def validate_required(self, value: Any, field_name: str) -> None:
        """
        Validate that a required field is not None/empty.

        Args:
            value: Value to validate
            field_name: Field name for error message

        Raises:
            ValidationError: If value is None/empty
        """
        if value is None or (isinstance(value, str) and not value.strip()):
            msg = f"{field_name} is required"
            raise ValidationError(msg, field_name)

    def validate_uuid(self, value: Any, field_name: str) -> UUID:
        """
        Validate and convert to UUID.

        Args:
            value: Value to validate
            field_name: Field name for error message

        Returns:
            UUID object

        Raises:
            ValidationError: If not a valid UUID
        """
        try:
            if isinstance(value, str):
                return UUID(value)
            if isinstance(value, UUID):
                return value
            msg = f"{field_name} must be a valid UUID"
            raise ValidationError(msg, field_name)
        except ValueError:
            msg = f"{field_name} is not a valid UUID format"
            raise ValidationError(msg, field_name) from ValueError

    def validate_positive_int(self, value: Any, field_name: str, min_value: int = 1) -> int:
        """
        Validate positive integer.

        Args:
            value: Value to validate
            field_name: Field name for error message
            min_value: Minimum allowed value

        Returns:
            Integer value

        Raises:
            ValidationError: If not a valid positive integer
        """
        try:
            int_value = int(value)
            if int_value < min_value:
                msg = f"{field_name} must be at least {min_value}"
                raise ValidationError(msg, field_name)
            return int_value
        except (ValueError, TypeError):  # fmt: skip
            msg = f"{field_name} must be a positive integer"
            raise ValidationError(msg, field_name) from None

    def validate_string_length(self, value: str, field_name: str, max_length: int, min_length: int = 0) -> None:
        """
        Validate string length.

        Args:
            value: String to validate
            field_name: Field name for error message
            max_length: Maximum allowed length
            min_length: Minimum allowed length

        Raises:
            ValidationError: If length is invalid
        """
        if not isinstance(value, str):
            msg = f"{field_name} must be a string"
            raise ValidationError(msg, field_name)

        if len(value) < min_length:
            msg = f"{field_name} must be at least {min_length} characters"
            raise ValidationError(msg, field_name)

        if len(value) > max_length:
            msg = f"{field_name} must not exceed {max_length} characters"
            raise ValidationError(msg, field_name)

    def log_operation(self, operation: str, **context) -> None:
        """
        Log service operation with structured context.

        Args:
            operation: Operation name
            **context: Additional context key-value pairs
        """
        context_str = " ".join(f"{k}={v}" for k, v in context.items())
        self.logger.info("🔧 %s %s", operation, context_str)

    def log_error(self, operation: str, error: Exception, **context) -> None:
        """
        Log service error with structured context.

        Args:
            operation: Operation name
            error: Exception that occurred
            **context: Additional context key-value pairs
        """
        context_str = " ".join(f"{k}={v}" for k, v in context.items())
        self.logger.exception("%s failed %s: %s", operation, context_str, error)

    def create_response(self, data: Any = None, message: str = "", **metadata) -> dict[str, Any]:
        """
        Create standardized API response.

        Args:
            data: Response data
            message: Optional message
            **metadata: Additional metadata

        Returns:
            Standardized response dict
        """
        response: dict[str, Any] = {"success": True}

        if data is not None:
            response["data"] = data

        if message:
            response["message"] = message

        if metadata:
            response.update(metadata)

        return response

    def create_paginated_response(
        self, items: list, total: int, page: int, page_size: int, **metadata
    ) -> dict[str, Any]:
        """
        Create standardized paginated response.

        Args:
            items: List of items
            total: Total number of items
            page: Current page number
            page_size: Items per page
            **metadata: Additional metadata

        Returns:
            Paginated response dict
        """
        return self.create_response(
            data=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(page * page_size) < total,
            **metadata,
        )

    def handle_service_error(self, error: ServiceError) -> Never:
        """
        Handle service errors by raising appropriate HTTPException.

        Args:
            error: ServiceError instance

        Raises:
            HTTPException: With appropriate status code and message
        """
        self.logger.warning("Service error: %s (status: %s)", error.message, error.status_code)
        raise HTTPException(status_code=error.status_code, detail=error.message)

    async def execute_with_retry(self, operation: Callable, max_retries: int = 3, *args, **kwargs) -> Any:
        """
        Execute operation with retry logic for transient failures.

        Args:
            operation: Async callable to execute
            max_retries: Maximum number of retries
            *args: Arguments for operation
            **kwargs: Keyword arguments for operation

        Returns:
            Operation result

        Raises:
            Last exception if all retries fail
        """
        last_error: Exception = RuntimeError("No attempts made")

        for attempt in range(max_retries + 1):
            try:
                return await operation(*args, **kwargs)
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    self.logger.warning(f"Operation failed (attempt {attempt + 1}/{max_retries + 1}): {e}")
                    await asyncio.sleep(0.1 * (2**attempt))  # Exponential backoff
                else:
                    self.logger.exception(f"Operation failed after {max_retries + 1} attempts: {e}")

        raise last_error
