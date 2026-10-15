#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/ugs/generation_type_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
🔥 GENERATION TYPE SERVICE 🔥
Generation type management in UGS (Unified Generation System)

Main functions:
- CRUD operations for generation types
- Active type management
- Generation parameter validation
"""

import ast
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import GenerationType

logger = logging.getLogger(__name__)


class GenerationTypeService:
    """
    🔥 SERVICE FOR GENERATION TYPES 🔥
    Управляет registry всех доступных типов генерации
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_key(self, type_key: str) -> GenerationType | None:
        """
        Получить тип генерации по ключу

        Args:
            type_key: Уникальный ключ типа (text_chat, image_banner, etc.)

        Returns:
            GenerationType или None
        """
        stmt = select(GenerationType).where(and_(GenerationType.type_key == type_key, GenerationType.is_active))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_types(self, category: str | None = None) -> list[GenerationType]:
        """
        Получить все активные типы генерации

        Args:
            category: Фильтр по категории (text, image, audio, video, document, composite)

        Returns:
            list[GenerationType]
        """
        stmt = select(GenerationType).where(GenerationType.is_active)

        if category:
            stmt = stmt.where(GenerationType.category == category)

        stmt = stmt.order_by(GenerationType.category, GenerationType.display_name)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_type(self, type_data: dict[str, Any]) -> GenerationType:
        """
        Создать новый тип генерации

        Args:
            type_data: Данные для создания типа

        Returns:
            GenerationType: Созданный тип генерации
        """
        # Валидация обязательных полей
        required_fields = ["type_key", "category", "display_name", "provider"]
        for field in required_fields:
            if field not in type_data:
                msg = f"Missing required field: {field}"
                raise ValueError(msg)

        # Проверка уникальности type_key
        stmt = select(GenerationType).where(GenerationType.type_key == type_data["type_key"])
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            msg = f"Generation type with key '{type_data['type_key']}' already exists"
            raise ValueError(msg)

        # Создание типа
        generation_type = GenerationType(
            type_key=type_data["type_key"],
            category=type_data["category"],
            display_name=type_data["display_name"],
            description=type_data.get("description", ""),
            provider=type_data["provider"],
            model_name=type_data.get("model_name"),
            parameters=type_data.get("parameters", {}),
            complexity=type_data.get("complexity", "medium"),
            estimated_time=type_data.get("estimated_time", 30),
            max_retries=type_data.get("max_retries", 3),
            priority=type_data.get("priority", 5),
            cost_credits=type_data.get("cost_credits", 1.0),
            type_metadata=type_data.get("metadata", type_data.get("type_metadata", {})),
            is_active=type_data.get("is_active", True),
        )

        self.db.add(generation_type)
        await self.db.commit()
        await self.db.refresh(generation_type)

        logger.info("Created generation type: %s", generation_type.type_key)
        return generation_type

    async def update_type(self, type_key: str, update_data: dict[str, Any]) -> GenerationType | None:
        """
        Обновить тип генерации

        Args:
            type_key: Ключ типа для обновления
            update_data: Данные для обновления

        Returns:
            GenerationType или None
        """
        stmt = select(GenerationType).where(GenerationType.type_key == type_key)
        result = await self.db.execute(stmt)
        generation_type = result.scalar_one_or_none()

        if not generation_type:
            return None

        # Обновление полей
        for key, value in update_data.items():
            if key == "metadata":
                key = "type_metadata"
            if hasattr(generation_type, key):
                setattr(generation_type, key, value)

        # Convert UTC datetime to naive datetime for TIMESTAMP WITHOUT TIME ZONE
        generation_type.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
        await self.db.commit()
        await self.db.refresh(generation_type)

        logger.info("Updated generation type: %s", type_key)
        return generation_type

    async def deactivate_type(self, type_key: str) -> bool:
        """
        Деактивировать тип генерации

        Args:
            type_key: Ключ типа для деактивации

        Returns:
            bool: True если успешно деактивирован
        """
        stmt = select(GenerationType).where(GenerationType.type_key == type_key)
        result = await self.db.execute(stmt)
        generation_type = result.scalar_one_or_none()

        if not generation_type:
            return False

        generation_type.is_active = False  # type: ignore[assignment]
        await self.db.commit()

        logger.info("Deactivated generation type: %s", type_key)
        return True

    async def get_types_by_provider(self, provider: str) -> list[GenerationType]:
        """
        Получить типы генерации по провайдеру

        Args:
            provider: Название провайдера (llama, comfyui, etc.)

        Returns:
            list[GenerationType]
        """
        stmt = (
            select(GenerationType)
            .where(and_(GenerationType.provider == provider, GenerationType.is_active))
            .order_by(GenerationType.category, GenerationType.display_name)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def validate_parameters(self, type_key: str, parameters: dict[str, Any]) -> dict[str, Any]:
        """
        Валидировать параметры для типа генерации

        Args:
            type_key: Ключ типа генерации
            parameters: Параметры для валидации

        Returns:
            dict[str, Any] with validation result
        """
        generation_type = await self.get_by_key(type_key)
        if not generation_type:
            return {"valid": False, "errors": [f"Generation type '{type_key}' not found"]}

        errors: list[str] = []
        # Convert parameters to dict, handling both dict and bytes keys
        parameters_raw = generation_type.parameters
        if parameters_raw is None:
            type_params: dict[str, Any] = {}
        elif isinstance(parameters_raw, dict):
            # Convert bytes keys to strings if needed
            type_params = {
                (k.decode("utf-8") if isinstance(k, bytes) else str(k)): (
                    v.decode("utf-8") if isinstance(v, bytes) else v
                )
                for k, v in parameters_raw.items()
            }
        else:
            type_params = {}

        # Check required parameters
        required_params = type_params.get("required", [])
        errors.extend(f"Missing required parameter: {param}" for param in required_params if param not in parameters)

        # Check parameter types
        param_types = type_params.get("types", {})
        for param, expected_type in param_types.items():
            if param in parameters:
                actual_value = parameters[param]
                try:
                    expected_type_class = ast.literal_eval(expected_type)
                    if not isinstance(actual_value, expected_type_class):
                        errors.append(f"Parameter '{param}' should be of type {expected_type}")
                except (ValueError, SyntaxError):  # fmt: skip
                    # If literal_eval fails, skip type checking for this parameter
                    logger.warning("Invalid type specification for parameter %s: %s", param, expected_type)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": [],  # Можно добавить предупреждения
        }
