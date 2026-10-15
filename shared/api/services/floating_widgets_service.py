# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/floating_widgets_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Floating Widgets Service
Business logic for floating widget operations
"""

import json
import logging
from typing import Any

from api.models.floating_widgets import (
    FloatingWidgetCreate,
    FloatingWidgetDataConfig,
    FloatingWidgetDisplayConfig,
    FloatingWidgetIconConfig,
    FloatingWidgetResponse,
    FloatingWidgetTemplateResponse,
    FloatingWidgetUpdate,
)
from api.services.base_service import BaseService

logger = logging.getLogger(__name__)


class FloatingWidgetsService(BaseService):
    """
    Business logic service for floating widget operations.

    Provides:
    - CRUD operations for user widgets
    - Template management
    - Widget creation from templates
    - Position and state management
    """

    async def get_user_widgets(self, user_id: str) -> list[FloatingWidgetResponse]:
        """
        Get all visible floating widgets for user.

        Args:
            user_id: User ID

        Returns:
            List of widget responses
        """
        self.log_operation("get_user_widgets", user_id=user_id)

        rows = await self.db_fetch(
            """
            SELECT
                id, user_id, widget_type, widget_key, title,
                position_x, position_y, is_collapsed, is_visible,
                icon_config, data_config, display_config, settings,
                created_at, updated_at
            FROM floating_widgets
            WHERE user_id = $1 AND is_visible = true
            ORDER BY created_at
            """,
            user_id,
        )

        return [
            FloatingWidgetResponse(
                id=str(row[0]),
                user_id=str(row[1]),
                widget_type=row[2],
                widget_key=row[3],
                title=row[4],
                position_x=row[5],
                position_y=row[6],
                is_collapsed=row[7],
                is_visible=row[8],
                icon_config=(
                    FloatingWidgetIconConfig(**json.loads(row[9]))
                    if row[9] and isinstance(row[9], str)
                    else (
                        FloatingWidgetIconConfig(**row[9])
                        if row[9] and isinstance(row[9], dict)
                        else FloatingWidgetIconConfig()
                    )
                ),
                data_config=(
                    FloatingWidgetDataConfig(**json.loads(row[10]))
                    if row[10] and isinstance(row[10], str)
                    else (
                        FloatingWidgetDataConfig(**row[10])
                        if row[10] and isinstance(row[10], dict)
                        else FloatingWidgetDataConfig()
                    )
                ),
                display_config=(
                    FloatingWidgetDisplayConfig(**json.loads(row[11]))
                    if row[11] and isinstance(row[11], str)
                    else (
                        FloatingWidgetDisplayConfig(**row[11])
                        if row[11] and isinstance(row[11], dict)
                        else FloatingWidgetDisplayConfig()
                    )
                ),
                settings=json.loads(row[12])
                if row[12] and isinstance(row[12], str)
                else row[12]
                if row[12] and isinstance(row[12], dict)
                else {},
                created_at=row[13],
                updated_at=row[14],
            )
            for row in rows
        ]

    async def get_widget(self, widget_id: str, user_id: str) -> FloatingWidgetResponse | None:
        """
        Get specific widget by ID.

        Args:
            widget_id: Widget ID
            user_id: User ID (for authorization)

        Returns:
            Widget response or None if not found
        """
        self.log_operation("get_widget", widget_id=widget_id, user_id=user_id)

        row = await self.db_fetchrow(
            """
            SELECT
                id, user_id, widget_type, widget_key, title,
                position_x, position_y, is_collapsed, is_visible,
                icon_config, data_config, display_config, settings,
                created_at, updated_at
            FROM floating_widgets
            WHERE id = $1 AND user_id = $2
            """,
            widget_id,
            user_id,
        )

        if not row:
            return None

        return FloatingWidgetResponse(
            id=str(row[0]),
            user_id=str(row[1]),
            widget_type=row[2],
            widget_key=row[3],
            title=row[4],
            position_x=row[5],
            position_y=row[6],
            is_collapsed=row[7],
            is_visible=row[8],
            icon_config=FloatingWidgetIconConfig(**row[9]) if row[9] else FloatingWidgetIconConfig(),
            data_config=FloatingWidgetDataConfig(**row[10]) if row[10] else FloatingWidgetDataConfig(),
            display_config=FloatingWidgetDisplayConfig(**row[11]) if row[11] else FloatingWidgetDisplayConfig(),
            settings=json.loads(row[12])
            if row[12] and isinstance(row[12], str)
            else row[12]
            if row[12] and isinstance(row[12], dict)
            else {},
            created_at=row[13],
            updated_at=row[14],
        )

    async def create_widget(self, widget_data: FloatingWidgetCreate, user_id: str) -> FloatingWidgetResponse:
        """
        Create new floating widget for user.

        Args:
            widget_data: Widget creation data
            user_id: User ID

        Returns:
            Created widget response

        Raises:
            ValueError: If widget_key already exists for user
        """
        self.log_operation("create_widget", user_id=user_id, widget_type=widget_data.widget_type)

        # Check if widget_key already exists
        existing = await self.db_fetchrow(
            """
            SELECT id FROM floating_widgets
            WHERE user_id = $1 AND widget_key = $2
            """,
            user_id,
            widget_data.widget_key,
        )

        if existing:
            msg = f"Widget with key '{widget_data.widget_key}' already exists for this user"
            raise ValueError(msg)

        # Create widget
        row = await self.db_fetchrow(
            """
            INSERT INTO floating_widgets (
                user_id, widget_type, widget_key, title,
                position_x, position_y, is_collapsed, is_visible,
                icon_config, data_config, display_config, settings
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
            RETURNING id, created_at, updated_at
            """,
            user_id,
            widget_data.widget_type,
            widget_data.widget_key,
            widget_data.title,
            widget_data.position_x,
            widget_data.position_y,
            widget_data.is_collapsed,
            widget_data.is_visible,
            json.dumps(widget_data.icon_config.model_dump()),
            json.dumps(widget_data.data_config.model_dump()),
            json.dumps(widget_data.display_config.model_dump()),
            json.dumps(widget_data.settings),
        )

        if not row:
            msg = "Failed to create widget"
            raise RuntimeError(msg)

        return FloatingWidgetResponse(
            id=str(row[0]),
            user_id=user_id,
            widget_type=widget_data.widget_type,
            widget_key=widget_data.widget_key,
            title=widget_data.title,
            position_x=widget_data.position_x,
            position_y=widget_data.position_y,
            is_collapsed=widget_data.is_collapsed,
            is_visible=widget_data.is_visible,
            icon_config=widget_data.icon_config,
            data_config=widget_data.data_config,
            display_config=widget_data.display_config,
            settings=widget_data.settings,
            created_at=row[1],
            updated_at=row[2],
        )

    async def create_widget_from_template(
        self,
        template_type: str,
        widget_key: str,
        user_id: str,
        title: str | None = None,
        icon_config_override: FloatingWidgetIconConfig | None = None,
        data_config_override: FloatingWidgetDataConfig | None = None,
        display_config_override: FloatingWidgetDisplayConfig | None = None,
        settings: dict[str, Any] | None = None,
    ) -> FloatingWidgetResponse:
        """
        Create widget from template with optional overrides.

        Args:
            template_type: Template widget type
            widget_key: Unique key for widget instance
            user_id: User ID
            title: Custom title
            icon_config_override: Override default icon config
            data_config_override: Override default data config
            display_config_override: Override default display config
            settings: Additional settings

        Returns:
            Created widget response

        Raises:
            ValueError: If template not found or widget_key exists
        """
        self.log_operation("create_widget_from_template", user_id=user_id, template_type=template_type)

        # Get template
        template_row = await self.db_fetchrow(
            """
            SELECT
                default_icon_type, default_icon_name, default_icon_size, default_icon_color,
                default_data_type, default_data_source, default_data_config,
                default_display_mode, default_size_config
            FROM floating_widget_templates
            WHERE widget_type = $1 AND is_active = true
            """,
            template_type,
        )

        if not template_row:
            msg = f"Template '{template_type}' not found or inactive"
            raise ValueError(msg)

        # Build configs from template defaults and overrides
        icon_config = FloatingWidgetIconConfig(
            icon_type=icon_config_override.icon_type if icon_config_override else template_row[0],
            icon_name=icon_config_override.icon_name
            if icon_config_override and icon_config_override.icon_name
            else template_row[1],
            icon_size=icon_config_override.icon_size if icon_config_override else template_row[2],
            icon_color=icon_config_override.icon_color
            if icon_config_override and icon_config_override.icon_color
            else template_row[3],
        )

        data_config = FloatingWidgetDataConfig(
            data_type=data_config_override.data_type if data_config_override else template_row[4],
            data_source=data_config_override.data_source
            if data_config_override and data_config_override.data_source
            else template_row[5],
            data_config=data_config_override.data_config if data_config_override else (template_row[6] or {}),
        )

        display_config = FloatingWidgetDisplayConfig(
            display_mode=display_config_override.display_mode if display_config_override else template_row[7],
            size_config=display_config_override.size_config if display_config_override else (template_row[8] or {}),
        )

        # Create widget
        widget_data = FloatingWidgetCreate(
            widget_type=template_type,
            widget_key=widget_key,
            title=title,
            position_x=None,
            position_y=None,
            icon_config=icon_config,
            data_config=data_config,
            display_config=display_config,
            settings=settings or {},
        )

        return await self.create_widget(widget_data, user_id)

    async def update_widget(
        self, widget_id: str, updates: FloatingWidgetUpdate, user_id: str
    ) -> FloatingWidgetResponse | None:
        """
        Update floating widget.

        Args:
            widget_id: Widget ID
            updates: Update data
            user_id: User ID (for authorization)

        Returns:
            Updated widget response or None if not found
        """
        self.log_operation("update_widget", widget_id=widget_id, user_id=user_id)

        # Build update query dynamically
        # Whitelist of allowed field names to prevent SQL injection
        allowed_fields = {
            "title": "title",
            "position_x": "position_x",
            "position_y": "position_y",
            "is_collapsed": "is_collapsed",
            "is_visible": "is_visible",
            "icon_config": "icon_config",
            "data_config": "data_config",
            "display_config": "display_config",
            "settings": "settings",
        }
        update_fields: list[str] = []
        update_values: list[Any] = []
        param_index = 1

        if updates.title is not None:
            update_fields.append(f"{allowed_fields['title']} = ${param_index}")
            update_values.append(updates.title)
            param_index += 1

        if updates.position_x is not None:
            update_fields.append(f"{allowed_fields['position_x']} = ${param_index}")
            update_values.append(updates.position_x)
            param_index += 1

        if updates.position_y is not None:
            update_fields.append(f"{allowed_fields['position_y']} = ${param_index}")
            update_values.append(updates.position_y)
            param_index += 1

        if updates.is_collapsed is not None:
            update_fields.append(f"{allowed_fields['is_collapsed']} = ${param_index}")
            update_values.append(updates.is_collapsed)
            param_index += 1

        if updates.is_visible is not None:
            update_fields.append(f"{allowed_fields['is_visible']} = ${param_index}")
            update_values.append(updates.is_visible)
            param_index += 1

        if updates.icon_config is not None:
            update_fields.append(f"{allowed_fields['icon_config']} = ${param_index}::jsonb")
            # Handle both Pydantic model and dict/str
            if isinstance(updates.icon_config, (dict, str)):
                icon_config_data = (
                    json.loads(updates.icon_config) if isinstance(updates.icon_config, str) else updates.icon_config
                )
            else:
                icon_config_data = updates.icon_config.model_dump()
            update_values.append(json.dumps(icon_config_data))
            param_index += 1

        if updates.data_config is not None:
            update_fields.append(f"{allowed_fields['data_config']} = ${param_index}::jsonb")
            # Handle both Pydantic model and dict/str
            if isinstance(updates.data_config, (dict, str)):
                data_config_data = (
                    json.loads(updates.data_config) if isinstance(updates.data_config, str) else updates.data_config
                )
            else:
                data_config_data = updates.data_config.model_dump()
            update_values.append(json.dumps(data_config_data))
            param_index += 1

        if updates.display_config is not None:
            update_fields.append(f"{allowed_fields['display_config']} = ${param_index}::jsonb")
            # Handle both Pydantic model and dict/str
            if isinstance(updates.display_config, (dict, str)):
                display_config_data = (
                    json.loads(updates.display_config)
                    if isinstance(updates.display_config, str)
                    else updates.display_config
                )
            else:
                display_config_data = updates.display_config.model_dump()
            update_values.append(json.dumps(display_config_data))
            param_index += 1

        if updates.settings is not None:
            update_fields.append(f"{allowed_fields['settings']} = ${param_index}::jsonb")
            update_values.append(json.dumps(updates.settings))
            param_index += 1

        if not update_fields:
            # No updates provided, return current widget
            return await self.get_widget(widget_id, user_id)

        # Add widget_id and user_id to params
        update_values.extend([widget_id, user_id])

        # Execute update - fields are whitelisted, values are parameterized
        # Fields come from allowed_fields whitelist, not user input
        query = f"""
            UPDATE floating_widgets
            SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${param_index} AND user_id = ${param_index + 1}
            RETURNING id, user_id, widget_type, widget_key, title,
                position_x, position_y, is_collapsed, is_visible,
                icon_config, data_config, display_config, settings,
                created_at, updated_at
            """  # noqa: S608
        row = await self.db_fetchrow(query, *update_values)

        if not row:
            return None

        return FloatingWidgetResponse(
            id=str(row[0]),
            user_id=str(row[1]),
            widget_type=row[2],
            widget_key=row[3],
            title=row[4],
            position_x=row[5],
            position_y=row[6],
            is_collapsed=row[7],
            is_visible=row[8],
            icon_config=FloatingWidgetIconConfig(**row[9]) if row[9] else FloatingWidgetIconConfig(),
            data_config=FloatingWidgetDataConfig(**row[10]) if row[10] else FloatingWidgetDataConfig(),
            display_config=FloatingWidgetDisplayConfig(**row[11]) if row[11] else FloatingWidgetDisplayConfig(),
            settings=json.loads(row[12])
            if row[12] and isinstance(row[12], str)
            else row[12]
            if row[12] and isinstance(row[12], dict)
            else {},
            created_at=row[13],
            updated_at=row[14],
        )

    async def delete_widget(self, widget_id: str, user_id: str) -> bool:
        """
        Delete floating widget.

        Args:
            widget_id: Widget ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted, False if not found
        """
        self.log_operation("delete_widget", widget_id=widget_id, user_id=user_id)

        result = await self.db_execute(
            """
            DELETE FROM floating_widgets
            WHERE id = $1 AND user_id = $2
            """,
            widget_id,
            user_id,
        )

        # result is typically a string like "DELETE 1" or "DELETE 0"
        # Check if deletion was successful by checking if result contains "1" or is truthy
        if isinstance(result, str):
            return ("1" in result) or (result.upper().startswith("DELETE") and ("0" not in result.split()[-1]))
        # If result is numeric, compare directly
        return bool(result) if isinstance(result, (int, float)) else result is not None

    async def get_templates(
        self, category: str | None = None, *, active_only: bool = True
    ) -> list[FloatingWidgetTemplateResponse]:
        """
        Get widget templates.

        Args:
            category: Filter by category
            active_only: Only return active templates

        Returns:
            List of template responses
        """
        self.log_operation("get_templates", category=category, active_only=active_only)

        query = """
            SELECT
                id, widget_type, name, description, category,
                default_icon_type, default_icon_name, default_icon_size, default_icon_color,
                default_data_type, default_data_source, default_data_config,
                default_display_mode, default_size_config,
                available_icon_types, available_icon_sizes,
                available_data_types, available_display_modes,
                is_system, is_active, created_at, updated_at
            FROM floating_widget_templates
            WHERE 1=1
        """
        params: list[bool | str] = []
        param_index = 1

        if active_only:
            query += f" AND is_active = ${param_index}"
            params.append(True)
            param_index += 1

        if category:
            query += f" AND category = ${param_index}"
            params.append(category)
            param_index += 1

        query += " ORDER BY category, name"

        try:
            rows = await self.db_fetch(query, *params)
        except Exception:
            logger.exception("Database error in get_templates")
            raise
        else:
            # Parse JSONB fields - asyncpg may return them as strings
            def parse_jsonb(
                value: dict[str, Any] | list[Any] | str | None, default: dict[str, Any] | list[Any]
            ) -> dict[str, Any] | list[Any]:
                if value is None:
                    return default
                if isinstance(value, (dict, list)):
                    return value
                if isinstance(value, str):
                    try:
                        parsed = json.loads(value)
                    except (json.JSONDecodeError, TypeError):  # fmt: skip
                        return default
                    else:
                        return parsed if parsed is not None else default
                return default

            def parse_jsonb_dict(
                value: dict[str, Any] | list[Any] | str | None, default: dict[str, Any]
            ) -> dict[str, Any]:
                result = parse_jsonb(value, default)
                if isinstance(result, dict):
                    return result
                return default

            def parse_jsonb_list_str(value: dict[str, Any] | list[Any] | str | None, default: list[str]) -> list[str]:
                result = parse_jsonb(value, default)
                if isinstance(result, list) and all(isinstance(item, str) for item in result):
                    return result
                return default

            def parse_jsonb_list_int(value: dict[str, Any] | list[Any] | str | None, default: list[int]) -> list[int]:
                result = parse_jsonb(value, default)
                if isinstance(result, list) and all(isinstance(item, int) for item in result):
                    return result
                return default

            return [
                FloatingWidgetTemplateResponse(
                    id=str(row[0]),
                    widget_type=row[1],
                    name=row[2],
                    description=row[3],
                    category=row[4],
                    default_icon_type=row[5],
                    default_icon_name=row[6],
                    default_icon_size=row[7],
                    default_icon_color=row[8],
                    default_data_type=row[9],
                    default_data_source=row[10],
                    default_data_config=parse_jsonb_dict(row[11], {}),
                    default_display_mode=row[12],
                    default_size_config=parse_jsonb_dict(row[13], {}),
                    available_icon_types=parse_jsonb_list_str(row[14], ["default"]),
                    available_icon_sizes=parse_jsonb_list_int(row[15], [16, 20, 24, 32, 48]),
                    available_data_types=parse_jsonb_list_str(row[16], ["default"]),
                    available_display_modes=parse_jsonb_list_str(row[17], ["collapsed", "mini", "expanded"]),
                    is_system=row[18],
                    is_active=row[19],
                    created_at=row[20],
                    updated_at=row[21],
                )
                for row in rows
            ]

    async def get_template(self, widget_type: str) -> FloatingWidgetTemplateResponse | None:
        """
        Get specific template by widget type.

        Args:
            widget_type: Template widget type

        Returns:
            Template response or None if not found
        """
        self.log_operation("get_template", widget_type=widget_type)

        row = await self.db_fetchrow(
            """
            SELECT
                id, widget_type, name, description, category,
                default_icon_type, default_icon_name, default_icon_size, default_icon_color,
                default_data_type, default_data_source, default_data_config,
                default_display_mode, default_size_config,
                available_icon_types, available_icon_sizes,
                available_data_types, available_display_modes,
                is_system, is_active, created_at, updated_at
            FROM floating_widget_templates
            WHERE widget_type = $1 AND is_active = true
            """,
            widget_type,
        )

        if not row:
            return None

        return FloatingWidgetTemplateResponse(
            id=str(row[0]),
            widget_type=row[1],
            name=row[2],
            description=row[3],
            category=row[4],
            default_icon_type=row[5],
            default_icon_name=row[6],
            default_icon_size=row[7],
            default_icon_color=row[8],
            default_data_type=row[9],
            default_data_source=row[10],
            default_data_config=row[11] or {},
            default_display_mode=row[12],
            default_size_config=row[13] or {},
            available_icon_types=row[14] or [],
            available_icon_sizes=row[15] or [16, 20, 24, 32, 48],
            available_data_types=row[16] or [],
            available_display_modes=row[17] or ["collapsed", "mini", "expanded"],
            is_system=row[18],
            is_active=row[19],
            created_at=row[20],
            updated_at=row[21],
        )
