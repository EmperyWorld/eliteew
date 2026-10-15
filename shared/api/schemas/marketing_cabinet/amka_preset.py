"""Схемы API для пресетов AMKA (проектные именованные конфиги)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AmkaPresetExtraPlanTaskIn(BaseModel):
    """Один дополнительный шаг исполнения (форма задачи master plan)."""

    model_config = ConfigDict(extra="ignore")

    insert_after_section_key: str | None = Field(
        default=None,
        max_length=64,
        description="Вставить после последнего шага с этим section_key; если null — в конец списка задач.",
    )
    task: dict[str, Any] = Field(
        ...,
        description="Объект задачи плана: section_key, title, execution_mode, write_policy, operations, …",
    )


class AmkaPresetConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: int = Field(default=1, ge=1, le=1)
    extra_plan_tasks: list[AmkaPresetExtraPlanTaskIn] = Field(
        default_factory=list,
        max_length=32,
        description="Дополнительные execute-задачи; валидируются при сохранении и при планировании.",
    )


class AmkaPresetCreateBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    display_name: str = Field(..., min_length=1, max_length=255)
    slug: str | None = Field(
        default=None,
        max_length=128,
        description="Уникальный ключ в проекте; если пусто — генерируется из display_name.",
    )
    config: AmkaPresetConfigV1 = Field(default_factory=AmkaPresetConfigV1)


class AmkaPresetUpdateBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    config: AmkaPresetConfigV1 | None = None


class AmkaPresetOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    slug: str
    display_name: str
    config: AmkaPresetConfigV1
    created_by_user_id: str
    created_at: str | None = None
    updated_at: str | None = None


class AmkaPresetListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[AmkaPresetOut]
    total: int


class AmkaPresetOneResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    preset: AmkaPresetOut


class AmkaPresetTemplateOut(BaseModel):
    """Системный шаблон пресета (строка из marketing_amka_preset_templates)."""

    model_config = ConfigDict(extra="ignore")

    slug: str = Field(..., max_length=128)
    display_name: str = Field(..., max_length=255)
    description: str | None = None
    config: AmkaPresetConfigV1
    sort_order: int = 0
    category: str = Field(
        default="general",
        max_length=64,
        description="Группа шаблона для UI (basics, imc, autofill, agent, …).",
    )


class AmkaPresetTemplateListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[AmkaPresetTemplateOut]
    total: int


def _slugify_amka_preset(raw: str) -> str:
    s = raw.strip().lower().replace(" ", "-")
    out: list[str] = []
    for ch in s:
        if ch.isalnum() or ch == "-":
            out.append(ch)
    slug = "".join(out).strip("-")[:128]
    return slug or "preset"


class AmkaPresetCreateBodyResolved(AmkaPresetCreateBody):
    """Внутренняя модель с обязательным slug."""

    slug: str = Field(..., min_length=1, max_length=128)

    @classmethod
    def from_body(cls, body: AmkaPresetCreateBody) -> AmkaPresetCreateBodyResolved:
        slug = (body.slug or "").strip() or _slugify_amka_preset(body.display_name)
        return cls(display_name=body.display_name.strip(), slug=slug, config=body.config)


class AmkaPresetIdQuery(BaseModel):
    """Для валидации preset_id в запросе старта."""

    model_config = ConfigDict(extra="ignore")

    preset_id: UUID | None = None

    @field_validator("preset_id", mode="before")
    @classmethod
    def empty_str_none(cls, v: Any) -> Any:
        if v == "":
            return None
        return v
