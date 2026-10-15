# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP request/response models for DocEditor document CRUD and list endpoints.
# Defines the compatibility fields and explicit normalized text projections consumed by EWA surfaces.
# Invariants:
# - content remains the legacy rendered HTML field for existing clients.
# - content_markdown/content_html/plain_text/source_format are the stable normalized document contract.
# Related:
# - api/routers/doc_editor.py
# - api/services/doc_editor_text_normalizer.py
# ---
"""HTTP models for Ultimate Document Editor — documents list and CRUD."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator  # type: ignore[import-untyped]


class DocumentCreate(BaseModel):
    """Request to create new document"""

    title: str = Field(..., min_length=1, max_length=500, description="Document title")
    content: str = Field(default="", description="Document content (HTML, Markdown, or plain text)")
    content_type: str = Field(default="html", description="Content format: html, markdown, text")
    metadata: dict[str, Any] | None = Field(default={}, description="Additional metadata")
    tags: list[str] | None = Field(default=[], description="Document tags")
    is_public: bool = Field(default=False, description="Public visibility")


class DocumentUpdate(BaseModel):
    """Request to update document"""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = None
    content_type: str | None = Field(default=None, description="Content format: html, markdown, text")
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    expected_version: int | None = Field(default=None, ge=0)
    force_save: bool = Field(
        default=False,
        description="Если true — записать без проверки expected_version (после явного выбора пользователя при конфликте).",
    )


class DocumentResponse(BaseModel):
    """Document response model"""

    id: UUID
    user_id: str
    title: str
    content: str
    content_markdown: str | None = None
    content_html: str | None = None
    plain_text: str | None = None
    source_format: Literal["html", "markdown", "text"] | str | None = None
    parse_warnings: list[str] = Field(default_factory=list)
    mime_type: str
    tags: list[str]
    is_public: bool
    word_count: int
    character_count: int
    version: int
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime | None = None
    # Use doc_metadata to avoid Pydantic reserved word 'metadata'
    doc_metadata: dict[str, Any] | None = Field(default={}, alias="metadata")
    document_access_role: Literal["owner", "collaborator"] = "owner"
    collaboration_can_save: bool = True
    preview_text: str | None = Field(
        default=None,
        description="Краткий превью-текст для списков (list_profile=compact), без HTML тела.",
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("user_id", mode="before")
    @classmethod
    def normalize_user_id(cls, value: Any) -> str:
        return str(value)


class DocumentListResponse(BaseModel):
    """List of documents with pagination"""

    documents: list[DocumentResponse]
    total: int
    skip: int
    limit: int
