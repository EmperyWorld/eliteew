# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Social Hub API surface for privacy-safe feed, inbox, preview, and shared read-model endpoints.
# Invariants:
# - Read-model endpoints require authenticated viewer scope and return bounded payloads.
# - Event/shared rows are summaries, not private message bodies or private profile fields.
# Related:
# - api/services/social_hub_feed_service.py
# - api/domains/social.py
# ---

from __future__ import annotations

from typing import Annotated

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.core.database_manager import get_asyncpg_pool
from api.dependencies.user_context import get_current_user_db_id
from api.services.social_hub_feed_service import SocialHubFeedService

router = APIRouter(prefix="/social-hub", tags=["Social Hub"])


class SocialHubFeedItem(BaseModel):
    id: str
    type: str
    created_at: str
    actor_user_id: str | None = None
    target_user_id: str | None = None
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    summary: str | None = None


class SocialHubFeedResponse(BaseModel):
    items: list[SocialHubFeedItem] = Field(default_factory=list)
    next_cursor: str | None = None


class SocialHubActionInboxItem(BaseModel):
    id: str
    type: str
    severity: str
    title: str
    summary: str
    count: int = 0
    target_tab: str | None = None
    target_id: str | None = None
    created_at: str | None = None


class SocialHubActionInboxResponse(BaseModel):
    items: list[SocialHubActionInboxItem] = Field(default_factory=list)


class SocialHubPrivacyFieldPreview(BaseModel):
    visibility: str
    circle_id: str | None = None


class SocialHubPrivacyAudiencePreview(BaseModel):
    id: str
    label: str
    visible_fields: list[str] = Field(default_factory=list)
    people_count: int | None = None


class SocialHubPrivacyPreviewResponse(BaseModel):
    discoverability: str
    fields: dict[str, SocialHubPrivacyFieldPreview] = Field(default_factory=dict)
    audiences: list[SocialHubPrivacyAudiencePreview] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SocialHubSharedContentItem(BaseModel):
    id: str
    name: str | None = None
    title: str | None = None
    content_type: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    visibility: str | None = None
    direction: str
    shared_reason: str
    created_at: str
    updated_at: str
    thumbnail_url: str | None = None


class SocialHubSharedContentResponse(BaseModel):
    items: list[SocialHubSharedContentItem] = Field(default_factory=list)


def get_social_hub_feed_service(
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),
) -> SocialHubFeedService:
    return SocialHubFeedService(db_pool)


@router.get("/feed", response_model=SocialHubFeedResponse)
async def get_social_hub_feed(
    content_user_id: str = Depends(get_current_user_db_id),
    service: SocialHubFeedService = Depends(get_social_hub_feed_service),
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    cursor: str | None = None,
    circle_id: str | None = None,
    types: Annotated[list[str] | None, Query()] = None,
) -> dict:
    try:
        return await service.list_feed(
            content_user_id,
            limit=limit,
            cursor=cursor,
            circle_id=circle_id,
            types=types,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/inbox", response_model=SocialHubActionInboxResponse)
async def get_social_hub_action_inbox(
    content_user_id: str = Depends(get_current_user_db_id),
    service: SocialHubFeedService = Depends(get_social_hub_feed_service),
    limit: Annotated[int, Query(ge=1, le=24)] = 12,
) -> dict:
    try:
        return await service.get_action_inbox(
            content_user_id,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/profile/privacy-preview", response_model=SocialHubPrivacyPreviewResponse)
async def get_social_hub_privacy_preview(
    content_user_id: str = Depends(get_current_user_db_id),
    service: SocialHubFeedService = Depends(get_social_hub_feed_service),
) -> dict:
    try:
        return await service.get_privacy_preview(content_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/friends/{friend_user_id}/shared-content", response_model=SocialHubSharedContentResponse)
async def get_social_hub_shared_content(
    friend_user_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: SocialHubFeedService = Depends(get_social_hub_feed_service),
    limit: Annotated[int, Query(ge=1, le=24)] = 12,
) -> dict:
    try:
        return await service.list_shared_content(
            content_user_id,
            friend_user_id,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
