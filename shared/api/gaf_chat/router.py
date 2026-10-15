# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# GAF Chat HTTP API for chat lists, messages, E2EE keys, and mutual-consent state.
# Invariants:
# - Personal chat data is no-cache; realtime emits are best-effort and must not break HTTP success.
# Related:
# - documentation/product/GAF-CHAT-BACKEND.md
# ---

"""
GAF Chat HTTP API: 1:1 chats, messages, user search, E2E public keys.

Mounted with prefix ``/api/v1``; router prefix ``/gaf-chat``. Authentication via
``get_current_user_db_id`` (content user id). Responses are no-cache (personal data).

Realtime: Socket.IO events ``gaf_chat.message_new``, ``gaf_chat.message_read``,
``gaf_chat.chat_created``, ``gaf_chat.message_edited``, ``gaf_chat.message_deleted``.
"""

from __future__ import annotations

import io
from typing import Literal, Never, cast
from urllib.parse import quote

import structlog  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.gaf_chat.admin_desktop_app_link import (
    build_admin_desktop_app_link_message,
    is_gaf_admin_for_user_id,
    list_partner_desktop_apps_for_admin_link,
)
from api.gaf_chat.rate_limit import get_gaf_chat_rate_limiter
from api.gaf_chat.schemas import (
    GAF_DEFAULT_PAGE_LIMIT,
    GAF_DEFAULT_USER_SEARCH_LIMIT,
    AcceptAttachmentResponse,
    ByUsernameBody,
    ChatByUsernameResponse,
    ChatListItem,
    ChatListItemLite,
    ChatPartner,
    E2eeConsentStatusResponse,
    EditMessageBody,
    GafChatMeResponse,
    GafListMessagesLimit,
    GafPartnerDesktopAppsResponse,
    GafUserSearchLimit,
    GafUserSearchQuery,
    MarkReadBody,
    MessageItem,
    OkStatusResponse,
    PublicKeyInfo,
    PublicKeyUploadBody,
    SendDesktopAppLinkBody,
    SendMessageBody,
    SessionKeyEnvelope,
    UserSearchItem,
)
from api.gaf_chat.service import (
    GafChatForbiddenError,
    GafChatService,
    GafMessageAuthorError,
    GafMessageNotFoundError,
)
from api.routers.socketio_handler import (
    GafMessageNewPayload,
    emit_gaf_chat_created,
    emit_gaf_e2ee_consent_changed,
    emit_gaf_message_deleted,
    emit_gaf_message_edited,
    emit_gaf_message_new,
    emit_gaf_message_read,
)
from api.routers.unified_content import get_content_service
from api.schemas.notifications import (
    NotificationCreate,
    NotificationPriority,
    NotificationType,
)
from api.services.friends_service import FriendsService
from api.services.notification_service import get_notification_service
from api.services.unified_content.content_storage_service import ContentStorageService

logger = structlog.get_logger("api.gaf_chat.router")

# OpenAPI: общие ответы об ошибках (контракт ответов не меняется).
_GAF_OPENAPI_ERR = {
    status.HTTP_400_BAD_REQUEST: {"description": "Неверный запрос или доменная ошибка."},
    status.HTTP_403_FORBIDDEN: {"description": "Нет доступа (не участник чата или запрещено)."},
    status.HTTP_404_NOT_FOUND: {"description": "Ресурс не найден."},
    status.HTTP_409_CONFLICT: {"description": "Конфликт (например, действие доступно только автору)."},
    status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Превышен лимит отправки сообщений."},
}

_GAF_RESP_STD = {
    status.HTTP_400_BAD_REQUEST: _GAF_OPENAPI_ERR[status.HTTP_400_BAD_REQUEST],
    status.HTTP_403_FORBIDDEN: _GAF_OPENAPI_ERR[status.HTTP_403_FORBIDDEN],
    status.HTTP_404_NOT_FOUND: _GAF_OPENAPI_ERR[status.HTTP_404_NOT_FOUND],
}
_GAF_RESP_SEND = {
    **_GAF_RESP_STD,
    status.HTTP_429_TOO_MANY_REQUESTS: _GAF_OPENAPI_ERR[status.HTTP_429_TOO_MANY_REQUESTS],
}
_GAF_RESP_409 = {
    **_GAF_RESP_STD,
    status.HTTP_409_CONFLICT: _GAF_OPENAPI_ERR[status.HTTP_409_CONFLICT],
}
_GAF_RESP_BY_USERNAME = {
    status.HTTP_400_BAD_REQUEST: _GAF_OPENAPI_ERR[status.HTTP_400_BAD_REQUEST],
    status.HTTP_404_NOT_FOUND: _GAF_OPENAPI_ERR[status.HTTP_404_NOT_FOUND],
}
_GAF_RESP_403_ONLY = {status.HTTP_403_FORBIDDEN: _GAF_OPENAPI_ERR[status.HTTP_403_FORBIDDEN]}


def set_gaf_no_cache(response: Response) -> None:
    """Запрет кэширования ответов GAF Chat (персональные данные)."""
    response.headers["Cache-Control"] = "private, no-store, no-cache, max-age=0, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


router = APIRouter(
    prefix="/gaf-chat",
    tags=["GAF Chat"],
    dependencies=[Depends(set_gaf_no_cache)],
)


def _value_error_to_http_exception(
    exc: ValueError,
    *,
    participant_check: Literal["strict", "broad"] = "strict",
    conflict_markers: tuple[str, ...] = (),
) -> HTTPException:
    """Map service ``ValueError`` messages to HTTP errors; ``detail`` stays ``str(exc)`` for clients."""
    err = str(exc).lower()
    detail = str(exc)
    if participant_check == "broad":
        participant_issue = "not a participant" in err or "participant" in err
    else:
        participant_issue = "not a participant" in err
    if participant_issue:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    for marker in conflict_markers:
        if marker in err:
            return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    if "not found" in err:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _raise_value_error_as_http(
    exc: ValueError,
    *,
    participant_check: Literal["strict", "broad"] = "strict",
    conflict_markers: tuple[str, ...] = (),
) -> Never:
    raise _value_error_to_http_exception(
        exc,
        participant_check=participant_check,
        conflict_markers=conflict_markers,
    ) from exc


async def _require_gaf_admin(
    auth_user: AuthUser,
    service: GafChatService,
) -> AuthUser:
    if not await is_gaf_admin_for_user_id(service.db_pool, auth_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return auth_user


async def _emit_gaf_new_message_to_participants(
    *,
    service: GafChatService,
    chat_id: str,
    sender_id: str,
    msg: dict,
) -> None:
    """Realtime refresh for recipient and sender's other clients (web ↔ mobile sync)."""
    try:
        chat = await service.get_chat_or_403(chat_id, sender_id)
        recipient_id = service._other_user_id(chat, sender_id)
        friends_svc = await _friends_service_same_pool(service)
        recipient_controls = await friends_svc.get_relationship_controls(
            recipient_id,
            sender_id,
        )
        base_payload: dict[str, object] = {
            "chat_id": chat_id,
            "message_id": msg["id"],
            "sender_id": msg["sender_id"],
            "body": msg.get("body", ""),
            "created_at": msg.get("created_at") or "",
            "algorithm": msg.get("algorithm"),
            "encryption_version": msg.get("encryption_version"),
            "body_ciphertext": msg.get("body_ciphertext"),
            "nonce": msg.get("nonce"),
            "attachment_content_id": msg.get("attachment_content_id"),
            "attachment_mime_type": msg.get("attachment_mime_type"),
            "attachment_name": msg.get("attachment_name"),
            "attachment_size": msg.get("attachment_size"),
            "attachment_recipient_saved_id": msg.get("attachment_recipient_saved_id"),
        }
        if msg.get("metadata") is not None:
            base_payload["metadata"] = msg["metadata"]
        if msg.get("reply_to_message_id") is not None:
            base_payload["reply_to_message_id"] = msg["reply_to_message_id"]
        recipient_envelope = await service.get_message_key_envelope_for_viewer(
            chat_id,
            str(msg["id"]),
            recipient_id,
        )
        sender_envelope = await service.get_message_key_envelope_for_viewer(
            chat_id,
            str(msg["id"]),
            sender_id,
        )
        recipient_payload = {
            **base_payload,
            "recipient_is_muted": bool(recipient_controls.get("is_muted")),
        }
        if recipient_envelope:
            recipient_payload["e2ee_session_key_envelope"] = recipient_envelope
        await emit_gaf_message_new(
            recipient_id,
            cast(GafMessageNewPayload, recipient_payload),
        )
        sender_payload = {
            **base_payload,
            "recipient_is_muted": True,
        }
        if sender_envelope:
            sender_payload["e2ee_session_key_envelope"] = sender_envelope
        await emit_gaf_message_new(
            sender_id,
            cast(GafMessageNewPayload, sender_payload),
        )
        if not recipient_controls.get("is_muted"):
            try:
                preview = (msg.get("body") or "").strip()
                if len(preview) > 140:
                    preview = preview[:137] + "..."
                if not preview and msg.get("attachment_content_id"):
                    preview = "Вложение"
                ns = get_notification_service()
                await ns.send_to_user(
                    recipient_id,
                    NotificationCreate(
                        type=NotificationType.INFO,
                        title="Новое сообщение",
                        message=preview or "Сообщение",
                        priority=NotificationPriority.NORMAL,
                        persistent=False,
                        source="gaf_chat",
                        metadata={
                            "chat_id": chat_id,
                            "open_app": {
                                "appComponent": "GAFChatApp",
                                "targetChatId": chat_id,
                            },
                        },
                    ),
                )
            except Exception as notif_exc:
                logger.debug(
                    "gaf_chat: in-app notification after message_new failed",
                    exc_info=notif_exc,
                )
    except Exception as emit_exc:
        _log_emit_skip("message_new", chat_id, emit_exc)


async def _emit_gaf_new_message_to_recipient(
    *,
    service: GafChatService,
    chat_id: str,
    sender_id: str,
    msg: dict,
) -> None:
    """Backward-compatible alias: emit to both chat participants."""
    await _emit_gaf_new_message_to_participants(
        service=service,
        chat_id=chat_id,
        sender_id=sender_id,
        msg=msg,
    )


async def get_gaf_chat_service() -> GafChatService:
    """DI: ``GafChatService`` на общем asyncpg-пуле."""
    pool = await get_asyncpg_pool()
    return GafChatService(pool)


async def _friends_service_same_pool(service: GafChatService) -> FriendsService:
    """``FriendsService`` на том же пуле, что и ``GafChatService`` (без второго ``get_asyncpg_pool`` в проде)."""
    pool = getattr(service, "db_pool", None)
    if pool is not None:
        return FriendsService(pool)
    return FriendsService(await get_asyncpg_pool())


def _chat_row_to_lite(row: dict) -> dict:
    """Strip heavy partner fields for GET `/chats/lite` (same rows as ``list_chats``)."""
    p = row["partner"]
    return {
        "chat_id": row["chat_id"],
        "partner": {
            "id": p["id"],
            "username": p.get("username"),
            "avatar_url": p.get("avatar_url"),
            "full_name": p.get("full_name"),
            "is_system_account": bool(p.get("is_system_account")),
            "is_muted": bool(p.get("is_muted")),
            "is_blocked": bool(p.get("is_blocked")),
            "blocked_by_partner": bool(p.get("blocked_by_partner")),
        },
        "last_message_at": row.get("last_message_at"),
        "last_message_preview": row.get("last_message_preview"),
        "unread_count": row["unread_count"],
        "partner_last_read_message_id": row.get("partner_last_read_message_id"),
        "e2ee_status": row.get("e2ee_status") or "off",
        "e2ee_requested_by_user_id": row.get("e2ee_requested_by_user_id"),
        "e2ee_ready": bool(row.get("e2ee_ready")),
    }


def _log_emit_skip(socket_event: str, chat_id: str, error: BaseException) -> None:
    logger.debug(
        "gaf_chat_socket_emit_skipped",
        socket_event=socket_event,
        chat_id=chat_id,
        error=str(error),
    )


def _public_key_info_from_row(row: dict | None) -> PublicKeyInfo:
    """Единый ответ для GET ключей и зеркало формы POST ``/keys/public``."""
    if not row:
        return PublicKeyInfo(has_key=False, algorithm=None, public_key_pem=None)
    return PublicKeyInfo(
        has_key=True,
        algorithm=row.get("algorithm"),
        public_key_pem=row.get("public_key_pem"),
    )


@router.get(
    "/me",
    response_model=GafChatMeResponse,
    summary="Текущий пользователь GAF Chat",
)
async def get_me(content_user_id: str = Depends(get_current_user_db_id)) -> GafChatMeResponse:
    """Текущий пользователь: ``user_id`` (DB id) для сопоставления с ``sender_id`` в сообщениях."""
    return GafChatMeResponse(user_id=content_user_id)


@router.get(
    "/chats",
    response_model=list[ChatListItem],
    summary="Список чатов",
    responses=_GAF_RESP_403_ONLY,
)
async def list_chats(
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> list[dict]:
    """Список чатов: собеседник, превью, ``last_message_at``, ``unread_count``."""
    return await service.list_chats(content_user_id)


@router.get(
    "/chats/lite",
    response_model=list[ChatListItemLite],
    summary="Список чатов (облегчённый)",
    responses=_GAF_RESP_403_ONLY,
)
async def list_chats_lite(
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> list[ChatListItemLite]:
    """Те же чаты и порядок, что GET ``/chats``, но без bio и прочих тяжёлых полей карточки партнёра."""
    full = await service.list_chats(content_user_id)
    return [ChatListItemLite.model_validate(_chat_row_to_lite(x)) for x in full]


@router.post(
    "/chats/by-username",
    response_model=ChatByUsernameResponse,
    summary="Найти или создать чат по username",
    responses=_GAF_RESP_BY_USERNAME,
)
async def get_or_create_chat_by_username(
    body: ByUsernameBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> ChatByUsernameResponse:
    """
    Найти или создать личный чат по нику собеседника.

    Тело: ``{"username": "nick"}``. Ответ: ``chat_id``, ``partner`` (карточка пользователя).
    """
    username = body.username.strip()
    friends_svc = await _friends_service_same_pool(service)
    partner = await friends_svc.find_user_by_username(username)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    try:
        created = await service.get_or_create_chat(content_user_id, partner["id"])
        chat_id = str(created["id"])
        if created.get("created"):
            try:
                await emit_gaf_chat_created(partner["id"], {"chat_id": chat_id, "initiator_id": content_user_id})
            except Exception as emit_exc:
                _log_emit_skip("chat_created", chat_id, emit_exc)
        partner_card = await service.partner_chat_card_for_viewer(content_user_id, partner["id"])
        e2ee_status = await service.get_e2ee_status(chat_id, content_user_id)
        return ChatByUsernameResponse(
            chat_id=chat_id,
            partner=ChatPartner.model_validate(partner_card),
            e2ee_status=e2ee_status["status"],
            e2ee_requested_by_user_id=e2ee_status["requested_by_user_id"],
            e2ee_ready=bool(e2ee_status["ready"]),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


async def _emit_gaf_e2ee_status_to_participants(
    *,
    service: GafChatService,
    chat_id: str,
    actor_user_id: str,
    status_row: dict,
) -> None:
    try:
        chat = await service.get_chat_or_403(chat_id, actor_user_id)
        payload = {
            "chat_id": chat_id,
            "status": status_row.get("status") or "off",
            "requested_by_user_id": status_row.get("requested_by_user_id"),
            "actor_user_id": actor_user_id,
            "ready": bool(status_row.get("ready")),
            "activated_at": status_row.get("activated_at"),
            "disabled_at": status_row.get("disabled_at"),
            "declined_at": status_row.get("declined_at"),
        }
        if status_row.get("suspend_reason"):
            payload["suspend_reason"] = status_row["suspend_reason"]
        for participant_id in (str(chat["user_id_1"]), str(chat["user_id_2"])):
            await emit_gaf_e2ee_consent_changed(participant_id, payload)
    except Exception as emit_exc:
        _log_emit_skip("e2ee_consent_changed", chat_id, emit_exc)


@router.get(
    "/chats/{chat_id}/e2ee",
    response_model=E2eeConsentStatusResponse,
    summary="Статус взаимного согласия GAF E2EE",
    responses=_GAF_RESP_STD,
)
async def get_e2ee_status(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> E2eeConsentStatusResponse:
    try:
        return E2eeConsentStatusResponse.model_validate(await service.get_e2ee_status(chat_id, content_user_id))
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/e2ee/propose",
    response_model=E2eeConsentStatusResponse,
    summary="Предложить включить GAF E2EE",
    responses=_GAF_RESP_STD,
)
async def propose_e2ee(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> E2eeConsentStatusResponse:
    try:
        result = await service.propose_e2ee(chat_id, content_user_id)
        await _emit_gaf_e2ee_status_to_participants(
            service=service,
            chat_id=chat_id,
            actor_user_id=content_user_id,
            status_row=result,
        )
        return E2eeConsentStatusResponse.model_validate(result)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/e2ee/accept",
    response_model=E2eeConsentStatusResponse,
    summary="Принять предложение GAF E2EE",
    responses=_GAF_RESP_STD,
)
async def accept_e2ee(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> E2eeConsentStatusResponse:
    try:
        result = await service.accept_e2ee(chat_id, content_user_id)
        await _emit_gaf_e2ee_status_to_participants(
            service=service,
            chat_id=chat_id,
            actor_user_id=content_user_id,
            status_row=result,
        )
        return E2eeConsentStatusResponse.model_validate(result)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/e2ee/decline",
    response_model=E2eeConsentStatusResponse,
    summary="Отклонить предложение GAF E2EE",
    responses=_GAF_RESP_STD,
)
async def decline_e2ee(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> E2eeConsentStatusResponse:
    try:
        result = await service.decline_e2ee(chat_id, content_user_id)
        await _emit_gaf_e2ee_status_to_participants(
            service=service,
            chat_id=chat_id,
            actor_user_id=content_user_id,
            status_row=result,
        )
        return E2eeConsentStatusResponse.model_validate(result)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/e2ee/disable",
    response_model=E2eeConsentStatusResponse,
    summary="Отключить будущие GAF E2EE сообщения",
    responses=_GAF_RESP_STD,
)
async def disable_e2ee(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> E2eeConsentStatusResponse:
    try:
        result = await service.disable_e2ee(chat_id, content_user_id)
        await _emit_gaf_e2ee_status_to_participants(
            service=service,
            chat_id=chat_id,
            actor_user_id=content_user_id,
            status_row=result,
        )
        return E2eeConsentStatusResponse.model_validate(result)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.get(
    "/chats/{chat_id}/messages",
    response_model=list[MessageItem],
    summary="Сообщения чата (пагинация)",
    responses=_GAF_RESP_STD,
)
async def list_messages(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
    limit: GafListMessagesLimit = GAF_DEFAULT_PAGE_LIMIT,
    before: str | None = None,
    after: str | None = None,
) -> list[dict]:
    """Сообщения с курсорной пагинацией: ``before`` / ``after`` (id сообщения)."""
    try:
        return await service.list_messages(chat_id, content_user_id, limit=limit, before=before, after=after)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/messages",
    response_model=MessageItem,
    summary="Отправить сообщение",
    responses=_GAF_RESP_SEND,
)
async def send_message(
    chat_id: str,
    body: SendMessageBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> dict:
    """
    Отправить сообщение (plain или E2E ciphertext).

    Лимит отправки: переменная окружения ``GAF_CHAT_RATE_LIMIT_PER_MIN`` (см.
    ``api.gaf_chat.rate_limit``): по умолчанию 60 сообщений в минуту на пользователя,
    значение после разбора ограничивается диапазоном 30–120.
    """
    rate_limiter = get_gaf_chat_rate_limiter()
    allowed, retry_after = rate_limiter.check_rate_limit(content_user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит отправки сообщений. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    att_raw = (body.attachment_content_id or "").strip()
    if not ((body.body and body.body.strip()) or body.e2e_ciphertext or att_raw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тело сообщения не может быть пустым",
        )
    try:
        reply_raw = (body.reply_to_message_id or "").strip()
        msg = await service.send_message(
            chat_id,
            content_user_id,
            body.body,
            e2e_ciphertext=body.e2e_ciphertext,
            e2e_nonce=body.e2e_nonce,
            e2e_algorithm=body.e2e_algorithm,
            e2e_encryption_version=body.e2e_encryption_version,
            e2e_session_key_for_recipient=body.e2e_session_key_for_recipient,
            e2e_session_key_for_self=body.e2e_session_key_for_self,
            attachment_content_id=att_raw or None,
            reply_to_message_id=reply_raw or None,
        )
        await _emit_gaf_new_message_to_participants(
            service=service,
            chat_id=chat_id,
            sender_id=content_user_id,
            msg=msg,
        )
        return msg
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.get(
    "/chats/{chat_id}/partner-desktop-apps",
    response_model=GafPartnerDesktopAppsResponse,
    summary="Приложения рабочего стола собеседника (админ)",
    responses=_GAF_RESP_STD,
)
async def list_partner_desktop_apps_for_admin(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    auth_user: AuthUser = Depends(require_oauth2_user),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> GafPartnerDesktopAppsResponse:
    """Admin-only: catalog apps the chat partner may open (by app access group)."""
    await _require_gaf_admin(auth_user, service)
    try:
        chat = await service.get_chat_or_403(chat_id, content_user_id)
        partner_id = service._other_user_id(chat, content_user_id)
        apps = await list_partner_desktop_apps_for_admin_link(
            service.db_pool,
            partner_user_id=partner_id,
        )
        return GafPartnerDesktopAppsResponse(apps=apps)
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/messages/desktop-app-link",
    response_model=MessageItem,
    summary="Отправить ссылку на приложение (админ)",
    responses=_GAF_RESP_SEND,
)
async def send_desktop_app_link_message(
    chat_id: str,
    body: SendDesktopAppLinkBody,
    content_user_id: str = Depends(get_current_user_db_id),
    auth_user: AuthUser = Depends(require_oauth2_user),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> dict:
    """Admin-only: send partner-visible desktop app open button in chat."""
    await _require_gaf_admin(auth_user, service)
    rate_limiter = get_gaf_chat_rate_limiter()
    allowed, retry_after = rate_limiter.check_rate_limit(content_user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит отправки сообщений. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    try:
        chat = await service.get_chat_or_403(chat_id, content_user_id)
        partner_id = service._other_user_id(chat, content_user_id)
        plain_body, metadata = await build_admin_desktop_app_link_message(
            service.db_pool,
            partner_user_id=partner_id,
            app_id=body.app_id,
            note=body.note,
        )
        msg = await service.send_admin_desktop_app_link_message(
            chat_id,
            content_user_id,
            body=plain_body,
            metadata=metadata,
        )
        await _emit_gaf_new_message_to_recipient(
            service=service,
            chat_id=chat_id,
            sender_id=content_user_id,
            msg=msg,
        )
        return msg
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="broad")


@router.post(
    "/chats/{chat_id}/read",
    response_model=OkStatusResponse,
    summary="Отметить сообщения прочитанными",
    responses=_GAF_RESP_STD,
)
async def mark_read(
    chat_id: str,
    body: MarkReadBody | None = None,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> OkStatusResponse:
    """Отметить прочитанным до ``up_to_message_id`` (опционально в теле). Ответ: ``{"status": "ok"}``."""
    try:
        up_to = body.up_to_message_id if body else None
        chat = await service.get_chat_or_403(chat_id, content_user_id)
        other_id = service._other_user_id(chat, content_user_id)
        last_read_id = await service.mark_read(chat_id, content_user_id, up_to_message_id=up_to)
        try:
            await emit_gaf_message_read(
                other_id,
                {
                    "chat_id": chat_id,
                    "user_id": content_user_id,
                    "up_to_message_id": last_read_id,
                },
            )
        except Exception as emit_exc:
            _log_emit_skip("message_read", chat_id, emit_exc)
        return OkStatusResponse()
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")


@router.patch(
    "/chats/{chat_id}/messages/{message_id}",
    response_model=MessageItem,
    summary="Редактировать своё сообщение",
    responses=_GAF_RESP_409,
)
async def edit_message(
    chat_id: str,
    message_id: str,
    body: EditMessageBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> dict:
    """Редактирование собственного сообщения."""
    try:
        msg = await service.edit_message(chat_id, message_id, content_user_id, body.body)
        try:
            chat = await service.get_chat_or_403(chat_id, content_user_id)
            other_id = service._other_user_id(chat, content_user_id)
            await emit_gaf_message_edited(
                other_id,
                {
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "sender_id": content_user_id,
                    "body": msg.get("body", ""),
                    "edited_at": msg.get("edited_at") or "",
                },
            )
        except Exception as emit_exc:
            _log_emit_skip("message_edited", chat_id, emit_exc)
        return msg
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict", conflict_markers=("not the author",))


@router.delete(
    "/chats/{chat_id}/messages/{message_id}",
    response_model=OkStatusResponse,
    summary="Удалить сообщение",
    responses=_GAF_RESP_409,
)
async def delete_message(
    chat_id: str,
    message_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
    for_me_only: bool = Query(False),
) -> OkStatusResponse:
    """Мягкое удаление; ``for_me_only=true`` — скрыть только у текущего пользователя."""
    try:
        chat = await service.get_chat_or_403(chat_id, content_user_id)
        other_id = service._other_user_id(chat, content_user_id)
        await service.delete_message(chat_id, message_id, content_user_id, for_me_only=for_me_only)
        try:
            await emit_gaf_message_deleted(
                other_id,
                {
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "user_id": content_user_id,
                    "for_me_only": for_me_only,
                },
            )
        except Exception as emit_exc:
            _log_emit_skip("message_deleted", chat_id, emit_exc)
        return OkStatusResponse()
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict", conflict_markers=("only the author",))


@router.post(
    "/chats/{chat_id}/messages/{message_id}/accept-attachment",
    response_model=AcceptAttachmentResponse,
    summary="Сохранить вложение в файловый менеджер (получатель)",
    responses=_GAF_RESP_STD,
)
async def accept_attachment(
    chat_id: str,
    message_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
    content_service: ContentStorageService = Depends(get_content_service),
) -> AcceptAttachmentResponse:
    """Копирует файл из сообщения в «Без папки» как контент текущего пользователя."""
    try:
        out = await service.accept_attachment(chat_id, message_id, content_user_id, content_service)
        return AcceptAttachmentResponse(content_id=out["content_id"], already_saved=bool(out.get("already_saved")))
    except GafMessageNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except GafChatForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except GafMessageAuthorError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")


@router.get(
    "/chats/{chat_id}/messages/{message_id}/attachment",
    summary="Скачать вложение сообщения (участник чата)",
    responses={
        **_GAF_RESP_STD,
        status.HTTP_200_OK: {"description": "Бинарное тело файла (тот же поток, что и unified_content download)."},
    },
)
async def download_message_attachment(
    chat_id: str,
    message_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
    content_service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """
    Отдаёт байты вложения участнику чата без опоры на content_shares.

    Нужен для предпросмотра/воспроизведения у получателя (GAF voice и др.).
    """
    try:
        file_data, mime, raw_name = await service.get_message_attachment_for_participant(
            chat_id, message_id, content_user_id, content_service
        )
        try:
            encoded_name = quote(str(raw_name), safe="")
            content_disp = f"inline; filename*=UTF-8''{encoded_name}"
        except Exception:
            content_disp = 'inline; filename="attachment"'
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=mime or "application/octet-stream",
            headers={
                "Content-Disposition": content_disp,
                "Content-Length": str(len(file_data)),
            },
        )
    except GafMessageNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except GafChatForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e


@router.post(
    "/chats/{chat_id}/clear",
    response_model=OkStatusResponse,
    summary="Очистить историю для себя",
    responses=_GAF_RESP_STD,
)
async def clear_history(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> OkStatusResponse:
    """
    Очистить историю чата для текущего пользователя.

    Сообщения помечаются удалёнными только для него; у собеседника история сохраняется.
    """
    try:
        await service.clear_history_for_user(chat_id, content_user_id)
        return OkStatusResponse()
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")


@router.post(
    "/chats/{chat_id}/archive",
    response_model=OkStatusResponse,
    summary="Архивировать чат",
    responses=_GAF_RESP_STD,
)
async def archive_chat(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> OkStatusResponse:
    """
    Скрыть чат из списка для текущего пользователя (архив).

    История для него помечается как очищенная; запись чата остаётся в БД.
    """
    try:
        await service.archive_chat_for_user(chat_id, content_user_id)
        return OkStatusResponse()
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")


@router.delete(
    "/chats/{chat_id}",
    response_model=OkStatusResponse,
    summary="Полностью удалить чат",
    responses=_GAF_RESP_STD,
)
async def hard_delete_chat(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> OkStatusResponse:
    """
    Полное удаление чата и истории для обоих участников.

    При следующем обращении по нику будет создан новый чат.
    """
    try:
        await service.hard_delete_chat(chat_id, content_user_id)
        return OkStatusResponse()
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")


@router.get(
    "/users/search",
    response_model=list[UserSearchItem],
    summary="Поиск пользователей для нового чата",
    responses=_GAF_RESP_403_ONLY,
)
async def search_users(
    q: GafUserSearchQuery,
    limit: GafUserSearchLimit = GAF_DEFAULT_USER_SEARCH_LIMIT,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> list[dict]:
    """Поиск пользователей по username / full_name для нового чата (безопасные поля)."""
    return await service.search_users(q, limit=limit, current_user_id=content_user_id)


@router.post(
    "/keys/public",
    response_model=PublicKeyInfo,
    summary="Сохранить публичный ключ E2E",
    responses={status.HTTP_400_BAD_REQUEST: _GAF_OPENAPI_ERR[status.HTTP_400_BAD_REQUEST]},
)
async def upload_public_key(
    body: PublicKeyUploadBody,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> PublicKeyInfo:
    """
    Сохранить или обновить публичный ключ текущего пользователя (E2E).

    На сервере только PEM и алгоритм; приватный ключ не передаётся.
    """
    try:
        await service.upsert_user_public_key(content_user_id, body.public_key_pem, body.algorithm)
        return PublicKeyInfo(
            has_key=True,
            algorithm=body.algorithm,
            public_key_pem=body.public_key_pem,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "gaf_chat_public_key_upsert_failed",
            user_id=content_user_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get(
    "/keys/public/me",
    response_model=PublicKeyInfo,
    summary="Мой публичный ключ",
    responses=_GAF_RESP_403_ONLY,
)
async def get_my_public_key(
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> PublicKeyInfo:
    """Публичный ключ текущего пользователя; без ключа — ``has_key: false``."""
    row = await service.get_user_public_key(content_user_id)
    return _public_key_info_from_row(row)


@router.get(
    "/keys/public/{user_id}",
    response_model=PublicKeyInfo,
    summary="Публичный ключ пользователя",
    responses=_GAF_RESP_403_ONLY,
)
async def get_user_public_key(
    user_id: str,
    content_user_id: str = Depends(get_current_user_db_id),  # noqa: ARG001 - auth only
    service: GafChatService = Depends(get_gaf_chat_service),
) -> PublicKeyInfo:
    """Публичный ключ указанного пользователя (для шифрования сессионного ключа)."""
    row = await service.get_user_public_key(user_id)
    return _public_key_info_from_row(row)


@router.get(
    "/chats/{chat_id}/session-key",
    response_model=SessionKeyEnvelope | None,
    summary="Конверт сессионного ключа для участника",
    responses=_GAF_RESP_STD,
)
async def get_session_key_envelope(
    chat_id: str,
    content_user_id: str = Depends(get_current_user_db_id),
    service: GafChatService = Depends(get_gaf_chat_service),
) -> SessionKeyEnvelope | None:
    """
    Последняя «посылка» с зашифрованным сессионным ключом для текущего участника чата.

    Содержимое ключа сервер не расшифровывает.
    """
    try:
        await service.get_chat_or_403(chat_id, content_user_id)
        raw = await service.get_session_key_envelope_for_user(chat_id, content_user_id)
        return SessionKeyEnvelope.model_validate(raw) if raw else None
    except ValueError as e:
        _raise_value_error_as_http(e, participant_check="strict")
