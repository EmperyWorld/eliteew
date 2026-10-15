# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Friends API for Social Hub: friends graph, requests, circles, and relationship controls.
# Invariants:
# - All endpoints are scoped to the authenticated current user.
# - Circle and relationship mutations never operate outside the owner-scoped graph.
# Related:
# - api/services/friends_service.py
# - api/services/friends_referral_service.py
# - api/domains/social.py
# ---
"""
Friends API: list friends, send/accept/reject requests by username, remove friend.
All endpoints require auth; current user resolved same as content (users.id by email).
"""

import hashlib
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from api.core.database_manager import get_asyncpg_pool
from api.dependencies.user_context import get_current_user_db_id
from api.routers.friends_admin_reports import router as friends_admin_reports_router
from api.routers.socketio_handler import emit_friends_updated
from api.schemas.notifications import NotificationAction, NotificationCreate, NotificationPriority, NotificationType
from api.services.friends_referral_service import FriendsReferralService
from api.services.friends_service import FriendsService
from api.services.mobile_push_service import maybe_notify_mobile_after_in_app_notification
from api.services.notification_service import NotificationService, get_notification_service

router = APIRouter(prefix="/friends", tags=["Friends"])
router.include_router(friends_admin_reports_router)
logger = logging.getLogger(__name__)


async def get_friends_service() -> FriendsService:
    """Dependency: FriendsService with shared asyncpg pool."""
    pool = await get_asyncpg_pool()
    return FriendsService(pool)


async def get_friends_referral_service() -> FriendsReferralService:
    """Dependency: FriendsReferralService with shared asyncpg pool."""
    pool = await get_asyncpg_pool()
    return FriendsReferralService(pool)


async def get_notification_sender() -> NotificationService:
    """Dependency: NotificationService singleton."""
    return get_notification_service()


def _get_user_display_name(user: dict | None) -> str:
    if not user:
        return "Пользователь"
    return user.get("full_name") or user.get("username") or "Пользователь"


async def _safe_emit_friends_sync(user_ids: list[str], payload: dict) -> None:
    for user_id in dict.fromkeys(user_ids):
        if not user_id:
            continue
        try:
            await emit_friends_updated(user_id, payload)
        except Exception:
            logger.warning("Failed to emit friends.updated for user=%s", user_id, exc_info=True)


async def _safe_send_notification(
    notification_service: NotificationService,
    *,
    user_id: str,
    data: NotificationCreate,
) -> None:
    try:
        await notification_service.send_to_user(user_id, data)
    except Exception:
        logger.warning("Failed to send friends notification to user=%s", user_id, exc_info=True)


async def _safe_mobile_push_notification(
    *,
    user_id: str,
    metadata: dict,
    high_priority: bool,
) -> None:
    try:
        await maybe_notify_mobile_after_in_app_notification(user_id, metadata, high_priority=high_priority)
    except Exception:
        logger.warning("Failed to send friends mobile fallback push to user=%s", user_id, exc_info=True)


async def _notify_friend_request_received(
    notification_service: NotificationService,
    friends_service: FriendsService,
    *,
    from_user_id: str,
    to_user_id: str,
    request_id: str,
) -> None:
    sender = await friends_service.find_user_by_id(from_user_id)
    sender_name = _get_user_display_name(sender)
    metadata = {
        "kind": "friend_request_received",
        "tab": "inbox",
        "focus": "incoming",
        "social_hub_section": "inbox",
        "sync": "friends",
        "request_id": request_id,
        "from_user_id": from_user_id,
        "friend_user_id": from_user_id,
        "open_app": {"appComponent": "SocialHubApp"},
    }
    await _safe_send_notification(
        notification_service,
        user_id=to_user_id,
        data=NotificationCreate(
            type=NotificationType.INFO,
            title="Новый запрос в друзья",
            message=f"{sender_name} отправил вам запрос в друзья.",
            priority=NotificationPriority.HIGH,
            persistent=True,
            source="friends",
            actions=[NotificationAction(label="Открыть Friends", action="open_friends")],
            metadata=metadata,
        ),
    )
    await _safe_mobile_push_notification(user_id=to_user_id, metadata=metadata, high_priority=True)


async def _notify_friend_request_accepted(
    notification_service: NotificationService,
    friends_service: FriendsService,
    *,
    from_user_id: str,
    to_user_id: str,
    request_id: str,
) -> None:
    accepter = await friends_service.find_user_by_id(to_user_id)
    accepter_name = _get_user_display_name(accepter)
    metadata = {
        "kind": "friend_request_accepted",
        "tab": "friends",
        "focus": "friend_detail",
        "social_hub_section": "friends",
        "sync": "friends",
        "request_id": request_id,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "friend_user_id": to_user_id,
        "open_app": {"appComponent": "SocialHubApp"},
    }
    await _safe_send_notification(
        notification_service,
        user_id=from_user_id,
        data=NotificationCreate(
            type=NotificationType.SUCCESS,
            title="Запрос в друзья принят",
            message=f"{accepter_name} принял ваш запрос в друзья.",
            priority=NotificationPriority.HIGH,
            persistent=True,
            source="friends",
            actions=[NotificationAction(label="Открыть Friends", action="open_friends")],
            metadata=metadata,
        ),
    )
    await _safe_mobile_push_notification(user_id=from_user_id, metadata=metadata, high_priority=True)


# --- Request/response models ---


class FriendRequestSendBody(BaseModel):
    username: str = Field(..., min_length=1, description="Username to send request to")


class FriendRequestSendResponse(BaseModel):
    request_id: str
    status: str = "pending"


class FriendCircleItem(BaseModel):
    id: str
    name: str
    members_count: int = 0
    sort_order: int = 0
    color: str | None = None
    icon: str | None = None


class FriendUser(BaseModel):
    id: str
    username: str | None
    avatar_url: str | None
    full_name: str | None
    is_favorite: bool = False
    is_muted: bool = False
    is_blocked: bool = False
    share_activity_with_friend: bool = True
    activity_visible_to_current_user: bool = True
    last_activity_at: str | None = None
    last_interaction_at: str | None = None
    circles: list[FriendCircleItem] = []


class FriendSearchCandidate(BaseModel):
    id: str
    username: str | None
    avatar_url: str | None
    full_name: str | None
    relationship_status: str
    request_id: str | None = None
    is_muted: bool = False
    is_blocked: bool = False
    share_activity_with_friend: bool = True
    activity_visible_to_current_user: bool = True
    last_activity_at: str | None = None
    last_interaction_at: str | None = None


class FriendProfileResponse(FriendUser):
    private_note: str | None = None
    note_updated_at: str | None = None
    friendship_created_at: str | None = None


class FriendRelationshipUpdateBody(BaseModel):
    is_favorite: bool | None = None
    is_muted: bool | None = None
    is_blocked: bool | None = None
    share_activity_with_friend: bool | None = None
    circle_ids: list[str] | None = None
    private_note: str | None = Field(default=None, max_length=2000)


class FriendReportBody(BaseModel):
    reason: str = Field(..., min_length=1, max_length=80)
    details: str | None = Field(default=None, max_length=2000)


class FriendReportResponse(BaseModel):
    id: str
    status: str


class FriendsReferralInviteResponse(BaseModel):
    referral_code: str
    invite_url: str
    inviter_display_name: str
    share_message: str


class FriendsReferralPreviewResponse(BaseModel):
    valid: bool = True
    referral_code: str
    inviter_display_name: str
    invite_url: str


class FriendCircleCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class FriendCircleUpdateBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int | None = None
    color: str | None = Field(default=None, max_length=40)
    icon: str | None = Field(default=None, max_length=80)


class IncomingRequestItem(BaseModel):
    id: str
    from_user_id: str
    created_at: str | None
    username: str | None
    avatar_url: str | None
    full_name: str | None


class SentRequestItem(BaseModel):
    id: str
    to_user_id: str
    created_at: str | None
    username: str | None
    avatar_url: str | None
    full_name: str | None


class FriendsOverviewStats(BaseModel):
    friends_count: int
    incoming_requests_count: int
    sent_requests_count: int


class FriendsOverviewResponse(BaseModel):
    friends: list[FriendUser]
    incoming_requests: list[IncomingRequestItem]
    sent_requests: list[SentRequestItem]
    circles: list[FriendCircleItem] = []
    stats: FriendsOverviewStats


def _friends_overview_etag(payload: FriendsOverviewResponse) -> str:
    canonical = payload.model_dump_json()
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f'"{digest}"'


def _if_none_match_matches(header_value: str | None, etag_quoted: str) -> bool:
    if not header_value:
        return False
    stripped = header_value.strip()
    if stripped == "*":
        return True
    inner = etag_quoted.strip('"')
    for part in stripped.split(","):
        token = part.strip()
        if token.startswith("W/"):
            token = token[2:].strip()
        if token.startswith('"') and token.endswith('"'):
            token = token[1:-1]
        if token == inner:
            return True
    return False


# --- Endpoints ---


@router.get("", response_model=list[FriendUser])
async def list_friends(
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> list[dict]:
    """List current user's friends (id, username, avatar_url, full_name)."""
    return await service.list_friends(content_user_id)


@router.get(
    "/overview",
    response_model=FriendsOverviewResponse,
    responses={304: {"description": "Not Modified — If-None-Match matched ETag."}},
)
async def get_friends_overview(
    request: Request,
    response: Response,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> FriendsOverviewResponse | Response:
    """Return the main Friends app payload in a single API call.

    Sets ``ETag`` (SHA-256 of the JSON body). With ``If-None-Match``, returns 304 and no body when unchanged.
    """
    raw = await service.get_overview(content_user_id)
    payload = FriendsOverviewResponse.model_validate(raw)
    etag = _friends_overview_etag(payload)
    response.headers["ETag"] = etag
    if _if_none_match_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    return payload


@router.get("/users/search", response_model=list[FriendSearchCandidate])
async def search_friend_users(
    q: str = Query(..., min_length=1, max_length=100, description="Username or full name query"),
    limit: int = Query(8, ge=1, le=20, description="Max number of results"),
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> list[dict]:
    """Search users and return relationship-aware candidates for the Friends UI."""
    return await service.search_users(content_user_id, q, limit)


@router.get("/referral", response_model=FriendsReferralInviteResponse)
async def get_friends_referral_invite(
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsReferralService = Depends(get_friends_referral_service),
) -> dict:
    """Return a stable referral code and invite URL for Social Hub / mobile share UI."""
    try:
        return await service.get_referral_invite(content_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/referral/preview", response_model=FriendsReferralPreviewResponse)
async def preview_friends_referral_code(
    code: str = Query(..., min_length=10, max_length=10, description="Referral invite code"),
    service: FriendsReferralService = Depends(get_friends_referral_service),
) -> dict:
    """Public preview for mobile landing pages opened from a referral link."""
    try:
        return await service.preview_referral_code(code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/request", response_model=FriendRequestSendResponse)
async def send_friend_request(
    body: FriendRequestSendBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
    notification_service: NotificationService = Depends(get_notification_sender),
) -> dict:
    """Send friend request by username. No user search/list — exact username only."""
    try:
        result = await service.send_request(content_user_id, body.username)
        await _safe_emit_friends_sync(
            [result.get("from_user_id"), result.get("to_user_id")],
            {
                "event": "request_sent",
                "request_id": result.get("request_id"),
                "actor_user_id": result.get("from_user_id"),
                "friend_user_id": result.get("to_user_id"),
            },
        )
        await _notify_friend_request_received(
            notification_service,
            service,
            from_user_id=result["from_user_id"],
            to_user_id=result["to_user_id"],
            request_id=result["request_id"],
        )
        return {"request_id": result["request_id"], "status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/request/by-user/{user_id}", response_model=FriendRequestSendResponse)
async def send_friend_request_to_user(
    user_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
    notification_service: NotificationService = Depends(get_notification_sender),
) -> dict:
    """Send friend request directly to a target user id."""
    try:
        result = await service.send_request_to_user(content_user_id, user_id)
        await _safe_emit_friends_sync(
            [result.get("from_user_id"), result.get("to_user_id")],
            {
                "event": "request_sent",
                "request_id": result.get("request_id"),
                "actor_user_id": result.get("from_user_id"),
                "friend_user_id": result.get("to_user_id"),
            },
        )
        await _notify_friend_request_received(
            notification_service,
            service,
            from_user_id=result["from_user_id"],
            to_user_id=result["to_user_id"],
            request_id=result["request_id"],
        )
        return {"request_id": result["request_id"], "status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/circles", response_model=list[FriendCircleItem])
async def list_friend_circles(
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> list[dict]:
    """List owner-scoped friend circles for segmentation and filtering."""
    return await service.list_circles(content_user_id)


@router.post("/circles", response_model=FriendCircleItem)
async def create_friend_circle(
    body: FriendCircleCreateBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Create a new owner-scoped friend circle."""
    try:
        return await service.create_circle(content_user_id, body.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch("/circles/{circle_id}", response_model=FriendCircleItem)
async def update_friend_circle(
    circle_id: str,
    body: FriendCircleUpdateBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Update an owner-scoped friend circle label, order, or visual metadata."""
    try:
        return await service.update_circle(
            content_user_id,
            circle_id,
            name=body.name,
            sort_order=body.sort_order,
            color=body.color,
            icon=body.icon,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete("/circles/{circle_id}")
async def delete_friend_circle(
    circle_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Delete an owner-scoped friend circle and its memberships."""
    try:
        await service.delete_circle(content_user_id, circle_id)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{user_id}/profile", response_model=FriendProfileResponse)
async def get_friend_profile(
    user_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Return detailed friend profile for the current user."""
    try:
        return await service.get_friend_profile(content_user_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch("/{user_id}/relationship", response_model=FriendProfileResponse)
async def update_friend_relationship(
    user_id: str,
    body: FriendRelationshipUpdateBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Update private relationship metadata like favorite flag and private note."""
    try:
        return await service.update_friend_relationship(
            content_user_id,
            user_id,
            is_favorite=body.is_favorite,
            is_muted=body.is_muted,
            is_blocked=body.is_blocked,
            share_activity_with_friend=body.share_activity_with_friend,
            circle_ids=body.circle_ids,
            private_note=body.private_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/requests", response_model=list[IncomingRequestItem])
async def list_incoming_requests(
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> list[dict]:
    """List incoming pending friend requests."""
    return await service.list_incoming_requests(content_user_id)


@router.get("/requests/sent", response_model=list[SentRequestItem])
async def list_sent_requests(
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> list[dict]:
    """List outgoing pending friend requests."""
    return await service.list_sent_requests(content_user_id)


@router.post("/requests/{request_id}/accept")
async def accept_request(
    request_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
    notification_service: NotificationService = Depends(get_notification_sender),
) -> dict:
    """Accept an incoming friend request."""
    try:
        result = await service.accept_request(request_id, content_user_id)
        await _safe_emit_friends_sync(
            [result.get("from_user_id"), result.get("to_user_id")],
            {
                "event": "request_accepted",
                "request_id": str(request_id),
                "actor_user_id": content_user_id,
                "friend_user_id": result.get("from_user_id"),
            },
        )
        await _notify_friend_request_accepted(
            notification_service,
            service,
            from_user_id=result["from_user_id"],
            to_user_id=result["to_user_id"],
            request_id=str(request_id),
        )
        return {"status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/requests/{request_id}/reject")
async def reject_request(
    request_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Reject an incoming friend request."""
    try:
        result = await service.reject_request(request_id, content_user_id)
        await _safe_emit_friends_sync(
            [result.get("from_user_id"), result.get("to_user_id")],
            {
                "event": "request_rejected",
                "request_id": str(request_id),
                "actor_user_id": content_user_id,
                "friend_user_id": result.get("from_user_id"),
            },
        )
        return {"status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/requests/{request_id}/cancel")
async def cancel_request(
    request_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Cancel an outgoing (sent) friend request."""
    try:
        result = await service.cancel_request(request_id, content_user_id)
        await _safe_emit_friends_sync(
            [result.get("from_user_id"), result.get("to_user_id")],
            {
                "event": "request_cancelled",
                "request_id": str(request_id),
                "actor_user_id": content_user_id,
                "friend_user_id": result.get("to_user_id"),
            },
        )
        return {"status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete("/{user_id}")
async def remove_friend(
    user_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Remove friend (mutual removal from friendships)."""
    try:
        result = await service.remove_friend(content_user_id, user_id)
        await _safe_emit_friends_sync(
            [result.get("current_user_id"), result.get("friend_user_id")],
            {
                "event": "friend_removed",
                "actor_user_id": content_user_id,
                "friend_user_id": user_id,
            },
        )
        return {"status": result["status"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/{user_id}/report", response_model=FriendReportResponse)
async def report_friend_user(
    user_id: str,
    body: FriendReportBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: FriendsService = Depends(get_friends_service),
) -> dict:
    """Submit a moderation report for a user from Social Hub."""
    try:
        return await service.report_user(
            content_user_id,
            user_id,
            reason=body.reason,
            details=body.details,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
