# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIP Phase 2 block schema, normalization, and markdown stitcher for incremental unified_content updates.
# Invariants:
# - Blocks are ordered by order_index; stitcher preserves attribution via HTML comments.
# - Monolithic extracted_text is represented as a single human block when content_payload is empty.
# Related:
# - api/services/unified_content/content_storage_service.py
# - documentation/product/ewa/EWA-AGENTIC-RECOVERY-ROUTING.md
# ---

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class ContentBlockType(StrEnum):
    TEXT = "text"
    MARKDOWN = "markdown"
    IMAGE_REF = "image_ref"


_AUTHOR_ROLES = frozenset({"agent", "human", "expert"})


def _normalize_author_role_value(value: object) -> str:
    raw = str(value or "agent").strip().lower()
    return raw or "agent"


_CONTENT_PAYLOAD_SCHEMA_VERSION = 1


class ContentBlock(BaseModel):
    """One attributable fragment inside a unified_content document."""

    id: UUID
    type: ContentBlockType = ContentBlockType.MARKDOWN
    content: str = ""
    author_role: str = "agent"
    order_index: int = Field(ge=0, default=0)

    @field_validator("author_role", mode="before")
    @classmethod
    def _normalize_author_role(cls, value: object) -> str:
        return _normalize_author_role_value(value)

    @field_validator("type", mode="before")
    @classmethod
    def _normalize_type(cls, value: object) -> ContentBlockType:
        raw = str(value or ContentBlockType.MARKDOWN.value).strip().lower()
        try:
            return ContentBlockType(raw)
        except ValueError:
            return ContentBlockType.TEXT


class ContentPayloadDocument(BaseModel):
    schema_version: int = _CONTENT_PAYLOAD_SCHEMA_VERSION
    blocks: list[ContentBlock] = Field(default_factory=list)


def new_content_block(
    *,
    content: str,
    block_type: str | ContentBlockType = ContentBlockType.MARKDOWN,
    author_role: str = "agent",
    order_index: int | None = None,
    block_id: UUID | None = None,
) -> ContentBlock:
    return ContentBlock(
        id=block_id or uuid4(),
        type=block_type,
        content=content,
        author_role=author_role,
        order_index=0 if order_index is None else order_index,
    )


def parse_block_input(raw: Mapping[str, Any]) -> ContentBlock:
    block_id = raw.get("id")
    try:
        parsed_id = UUID(str(block_id)) if block_id else uuid4()
    except TypeError, ValueError:
        parsed_id = uuid4()
    order_raw = raw.get("order_index")
    order_index = int(order_raw) if order_raw is not None else 0
    return ContentBlock(
        id=parsed_id,
        type=raw.get("type") or ContentBlockType.MARKDOWN,
        content=str(raw.get("content") or ""),
        author_role=str(raw.get("author_role") or "agent"),
        order_index=max(0, order_index),
    )


def load_blocks_from_row(
    content_payload: dict[str, Any] | str | None,
    extracted_text: str | None,
) -> list[ContentBlock]:
    payload_dict: dict[str, Any] | None = None
    if isinstance(content_payload, dict):
        payload_dict = content_payload
    elif isinstance(content_payload, str) and content_payload.strip():
        try:
            loaded = json.loads(content_payload)
            payload_dict = loaded if isinstance(loaded, dict) else None
        except json.JSONDecodeError:
            payload_dict = None
    if payload_dict and isinstance(payload_dict.get("blocks"), list):
        blocks = [parse_block_input(item) for item in payload_dict["blocks"] if isinstance(item, dict)]
        if blocks:
            return normalize_block_order(blocks)
    text = (extracted_text or "").strip()
    if text:
        return [
            ContentBlock(
                id=uuid4(),
                type=ContentBlockType.MARKDOWN,
                content=text,
                author_role="human",
                order_index=0,
            )
        ]
    return []


def serialize_content_payload(blocks: list[ContentBlock]) -> dict[str, Any]:
    ordered = normalize_block_order(blocks)
    doc = ContentPayloadDocument(blocks=ordered)
    return doc.model_dump(mode="json")


def normalize_block_order(blocks: list[ContentBlock]) -> list[ContentBlock]:
    if not blocks:
        return []
    sorted_blocks = sorted(blocks, key=lambda b: (b.order_index, str(b.id)))
    out: list[ContentBlock] = []
    for idx, block in enumerate(sorted_blocks):
        if block.order_index != idx:
            out.append(block.model_copy(update={"order_index": idx}))
        else:
            out.append(block)
    return out


def append_blocks(existing: list[ContentBlock], incoming: list[ContentBlock]) -> list[ContentBlock]:
    base = normalize_block_order(existing)
    next_index = len(base)
    appended: list[ContentBlock] = []
    for offset, block in enumerate(incoming):
        appended.append(
            block.model_copy(
                update={
                    "order_index": next_index + offset,
                    "id": block.id or uuid4(),
                }
            )
        )
    return normalize_block_order(base + appended)


def patch_block(existing: list[ContentBlock], block_id: UUID, patch: dict[str, Any]) -> list[ContentBlock]:
    found = False
    out: list[ContentBlock] = []
    for block in existing:
        if block.id != block_id:
            out.append(block)
            continue
        found = True
        updates: dict[str, Any] = {}
        if "content" in patch:
            updates["content"] = str(patch.get("content") or "")
        if "type" in patch and patch.get("type") is not None:
            updates["type"] = patch.get("type")
        if "author_role" in patch and patch.get("author_role") is not None:
            updates["author_role"] = patch.get("author_role")
        if "order_index" in patch and patch.get("order_index") is not None:
            updates["order_index"] = int(patch.get("order_index"))
        out.append(block.model_copy(update=updates))
    if not found:
        msg = f"Content block {block_id} not found"
        raise ValueError(msg)
    return normalize_block_order(out)


def remove_block(existing: list[ContentBlock], block_id: UUID) -> list[ContentBlock]:
    filtered = [b for b in existing if b.id != block_id]
    if len(filtered) == len(existing):
        msg = f"Content block {block_id} not found"
        raise ValueError(msg)
    return normalize_block_order(filtered)


def blocks_to_markdown(
    blocks: list[ContentBlock],
    *,
    include_attribution_comments: bool = True,
) -> str:
    """Stitch blocks into one markdown/plain document with optional attribution markers."""
    ordered = normalize_block_order(blocks)
    parts: list[str] = []
    for block in ordered:
        if include_attribution_comments and block.author_role:
            parts.append(f"<!-- aip:block={block.id} role={block.author_role} -->")
        body = block.content.strip()
        if block.type == ContentBlockType.IMAGE_REF and body:
            alt = re.sub(r"[^\w\-]+", "_", block.author_role or "image")[:40]
            body = f"![{alt}]({body})"
        if body:
            parts.append(body)
    return "\n\n".join(parts).strip()


def count_words_and_chars(markdown: str) -> tuple[int, int]:
    text = markdown.strip()
    if not text:
        return 0, 0
    return len(text.split()), len(text)
