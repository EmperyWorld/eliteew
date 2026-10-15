# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# GAF Chat API request/response schemas for REST, OpenAPI, and client contract validation.
# Invariants:
# - Keep message and E2EE consent DTOs additive/backward-compatible for shipped clients.
# Related:
# - documentation/product/GAF-CHAT-BACKEND.md
# ---

"""GAF Chat API request/response schemas.

Validation mirrors the router: max plaintext body length, pagination and search limits,
optional message cursors, and E2E field bounds. Router still applies domain rules
(e.g. at least one of plaintext ``body`` or ``e2e_ciphertext`` on send).
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --- Limits (single source for service/router docs; list cap matches GafChatService.list_messages) ---
GAF_MAX_BODY_LENGTH = 10_000
GAF_DEFAULT_PAGE_LIMIT = 50
GAF_MAX_PAGE_LIMIT = 100
GAF_DEFAULT_USER_SEARCH_LIMIT = 20
GAF_MAX_USER_SEARCH_LIMIT = 50
GAF_MAX_E2E_CIPHERTEXT_LENGTH = 500_000
GAF_MAX_E2E_NONCE_LENGTH = 512
GAF_MAX_E2E_ALGORITHM_LENGTH = 64
GAF_MAX_E2E_VERSION_LENGTH = 32
GAF_MAX_E2E_SESSION_KEY_LENGTH = 65_536
GAF_MAX_PUBLIC_KEY_PEM_LENGTH = 32_768
GAF_MAX_MESSAGE_ID_LENGTH = 64
GAF_MAX_UUID_STR_LENGTH = 64

# Stable example UUIDs for OpenAPI only
_EX_CHAT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
_EX_USER = "11111111-2222-3333-4444-555555555555"
_EX_MSG = "66666666-7777-8888-9999-aaaaaaaaaaaa"

GafE2eeStatus = Literal["off", "pending", "active", "declined"]

_CHAT_PARTNER_EXAMPLE: dict[str, Any] = {
    "id": _EX_USER,
    "username": "alice",
    "avatar_url": "https://cdn.example/avatars/alice.png",
    "full_name": "Alice Example",
    "bio": "On-site this week",
    "is_trusted": False,
    "admin_badge_label": None,
    "admin_badge_hint": None,
    "is_system_account": False,
    "is_muted": False,
    "is_blocked": False,
    "blocked_by_partner": False,
}

# OpenAPI/query aliases: defaults belong on the route parameter (``= GAF_DEFAULT_*``), not inside
# ``Query()`` here — FastAPI forbids ``Query(default=...)`` inside ``Annotated`` (see dependency utils).
GafListMessagesLimit = Annotated[
    int,
    Query(
        ge=1,
        le=GAF_MAX_PAGE_LIMIT,
        description=(
            f"Messages per page; router default `={GAF_DEFAULT_PAGE_LIMIT}`; range 1..{GAF_MAX_PAGE_LIMIT} "
            "(GET `/gaf-chat/chats/{{chat_id}}/messages`)."
        ),
    ),
]

GafUserSearchLimit = Annotated[
    int,
    Query(
        ge=1,
        le=GAF_MAX_USER_SEARCH_LIMIT,
        description=(
            f"Max search results; router default `={GAF_DEFAULT_USER_SEARCH_LIMIT}`; range 1..{GAF_MAX_USER_SEARCH_LIMIT} "
            "(GET `/gaf-chat/users/search`)."
        ),
    ),
]

GafUserSearchQuery = Annotated[
    str,
    Query(
        min_length=1,
        description="Non-empty search string; matched against username / full_name (GET `/gaf-chat/users/search`).",
        examples=["alice", "ivan petrov"],
    ),
]

GafMessageCursorParam = Annotated[
    str | None,
    Field(
        default=None,
        max_length=GAF_MAX_MESSAGE_ID_LENGTH,
        description=(
            "Optional message id cursor for pagination: ``before`` / ``after`` on "
            "GET `/gaf-chat/chats/{chat_id}/messages` (router default ``None``; passed through to service)."
        ),
        examples=[None, _EX_MSG],
    ),
]

GafForMeOnlyQuery = Annotated[
    bool,
    Field(
        default=False,
        description=(
            "DELETE `/gaf-chat/chats/{chat_id}/messages/{message_id}`: if true, delete only for the "
            "current user. Router default ``Query(False)``."
        ),
    ),
]


def _strip_opt_empty_none(v: object) -> object:
    """Strip strings; map empty/whitespace-only to None; leave non-strings unchanged."""
    if v is None or not isinstance(v, str):
        return v
    s = v.strip()
    return None if s == "" else s


def _strip_required_str(v: object, *, field_name: str) -> str:
    """Strip a required string field; reject non-strings (422 via Pydantic)."""
    if not isinstance(v, str):
        raise ValueError(f"{field_name} must be a string")
    return v.strip()


class ByUsernameBody(BaseModel):
    """Body for POST `/gaf-chat/chats/by-username` (resolve partner by login)."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "examples": [
                {"username": "partner_nick"},
            ]
        },
    )

    username: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Partner login; leading/trailing whitespace is stripped before lookup.",
        examples=["alice"],
    )

    @field_validator("username", mode="before")
    @classmethod
    def strip_username(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class SendMessageBody(BaseModel):
    """
    Body for POST `/gaf-chat/chats/{chat_id}/messages`.

    Plaintext: set ``body``. E2E: you may omit ``body`` and send ``e2e_ciphertext`` (and related fields).
    At least one of non-empty ``body`` or ``e2e_ciphertext`` is required — enforced in the router (HTTP 400).
    """

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "examples": [
                {"body": "Hello!"},
                {
                    "e2e_ciphertext": "base64-or-client-encoding",
                    "e2e_nonce": "QUJD",
                    "e2e_algorithm": "x25519-xsalsa20",
                    "e2e_encryption_version": "1",
                    "e2e_session_key_for_recipient": "optional-envelope-for-recipient",
                },
            ]
        },
    )

    body: str | None = Field(
        None,
        max_length=GAF_MAX_BODY_LENGTH,
        description=f"Plaintext body (server-side encryption path); max {GAF_MAX_BODY_LENGTH} chars after trim.",
    )
    attachment_content_id: str | None = Field(
        None,
        max_length=GAF_MAX_UUID_STR_LENGTH,
        description="Optional unified_content id (sender's file) to attach; allowed with E2E ciphertext send.",
    )
    reply_to_message_id: str | None = Field(
        None,
        max_length=GAF_MAX_UUID_STR_LENGTH,
        description="Optional id of an existing message in this chat to reply to (quote).",
    )
    e2e_ciphertext: str | None = Field(
        None,
        max_length=GAF_MAX_E2E_CIPHERTEXT_LENGTH,
        description="Pre-encrypted message payload (base64 or transport encoding used by client).",
    )
    e2e_nonce: str | None = Field(
        None, max_length=GAF_MAX_E2E_NONCE_LENGTH, description="Nonce / IV for E2E ciphertext."
    )
    e2e_algorithm: str | None = Field(
        None, max_length=GAF_MAX_E2E_ALGORITHM_LENGTH, description="E2E algorithm identifier."
    )
    e2e_encryption_version: str | None = Field(
        None, max_length=GAF_MAX_E2E_VERSION_LENGTH, description="Client E2E format version string."
    )
    e2e_session_key_for_recipient: str | None = Field(
        None,
        max_length=GAF_MAX_E2E_SESSION_KEY_LENGTH,
        description="Optional encrypted session key envelope for the recipient (handshake).",
    )
    e2e_session_key_for_self: str | None = Field(
        None,
        max_length=GAF_MAX_E2E_SESSION_KEY_LENGTH,
        description="Optional encrypted session key envelope for the sender (multi-device read-back).",
    )

    @field_validator("body", mode="before")
    @classmethod
    def strip_optional_body(cls, v: object) -> object:
        return _strip_opt_empty_none(v)

    @model_validator(mode="before")
    @classmethod
    def normalize_e2e_optional_strings(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        keys = (
            "e2e_ciphertext",
            "e2e_nonce",
            "e2e_algorithm",
            "e2e_encryption_version",
            "e2e_session_key_for_recipient",
            "e2e_session_key_for_self",
        )
        out = dict(data)
        for k in keys:
            if k in out:
                out[k] = _strip_opt_empty_none(out[k])
        return out


class EditMessageBody(BaseModel):
    """Body for PATCH `/gaf-chat/chats/{chat_id}/messages/{message_id}`."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "examples": [
                {"body": "Corrected text"},
            ]
        },
    )

    body: str = Field(
        ...,
        min_length=1,
        max_length=GAF_MAX_BODY_LENGTH,
        description=f"New plaintext; max {GAF_MAX_BODY_LENGTH} characters after trim.",
    )

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, v: object) -> str:
        return _strip_required_str(v, field_name="body")


class MarkReadBody(BaseModel):
    """Optional body for POST `/gaf-chat/chats/{chat_id}/read`. Omitted or `{}` marks read through latest."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "examples": [
                {},
                {"up_to_message_id": _EX_MSG},
            ]
        },
    )

    up_to_message_id: str | None = Field(
        None,
        max_length=GAF_MAX_MESSAGE_ID_LENGTH,
        description="Mark read through this message id; omit or null for latest visible message.",
        examples=[_EX_MSG],
    )

    @field_validator("up_to_message_id", mode="before")
    @classmethod
    def strip_message_id(cls, v: object) -> object:
        return _strip_opt_empty_none(v)


class GafChatMeResponse(BaseModel):
    """Response for GET `/gaf-chat/me` (current content user id)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"user_id": _EX_USER}],
        }
    )

    user_id: str = Field(
        ...,
        description="DB user id for GAF Chat / matching `sender_id` on messages.",
        examples=[_EX_USER],
    )


class OkStatusResponse(BaseModel):
    """Success envelope for mutating endpoints (`{"status": "ok"}`)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"status": "ok"}],
        }
    )

    status: Literal["ok"] = Field(default="ok", description="Operation succeeded.")


class ChatPartner(BaseModel):
    """Other participant in a 1:1 chat (list payload)."""

    model_config = ConfigDict(json_schema_extra={"examples": [_CHAT_PARTNER_EXAMPLE]})

    id: str = Field(..., description="User id (UUID string).", examples=[_EX_USER])
    username: str | None = Field(None, description="Public username.")
    avatar_url: str | None = Field(None, description="Avatar URL if set.")
    full_name: str | None = Field(None, description="Display name.")
    bio: str | None = Field(
        None,
        description="Profile tagline / bio when visible to viewer (privacy + friendship).",
    )
    is_trusted: bool = Field(False, description="Admin-granted trusted badge.")
    admin_badge_label: str | None = Field(None, description="Admin-set custom badge label.")
    admin_badge_hint: str | None = Field(None, description="Tooltip for custom badge.")
    is_system_account: bool = Field(False, description="Internal system user (service messages).")
    is_muted: bool = Field(False, description="Current user muted this partner.")
    is_blocked: bool = Field(False, description="Current user blocked this partner.")
    blocked_by_partner: bool = Field(False, description="Partner blocked current user.")


class ChatPartnerLite(BaseModel):
    """Smaller partner card for GET `/gaf-chat/chats/lite` (polling / mobile)."""

    id: str = Field(..., description="User id (UUID string).", examples=[_EX_USER])
    username: str | None = Field(None, description="Public username.")
    avatar_url: str | None = Field(None, description="Avatar URL if set.")
    full_name: str | None = Field(None, description="Display name.")
    is_system_account: bool = Field(False, description="Internal system user (service messages).")
    is_muted: bool = Field(False, description="Current user muted this partner.")
    is_blocked: bool = Field(False, description="Current user blocked this partner.")
    blocked_by_partner: bool = Field(False, description="Partner blocked current user.")


class ChatByUsernameResponse(BaseModel):
    """Response for POST `/gaf-chat/chats/by-username`."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "chat_id": _EX_CHAT,
                    "partner": _CHAT_PARTNER_EXAMPLE,
                }
            ]
        }
    )

    chat_id: str = Field(..., description="1:1 chat id (UUID string).", examples=[_EX_CHAT])
    partner: ChatPartner = Field(..., description="Partner profile (Friends/search-shaped dict, validated).")
    e2ee_status: GafE2eeStatus = Field("off", description="Chat-level E2EE mutual-consent state.")
    e2ee_requested_by_user_id: str | None = Field(None, description="User id that requested E2EE, if pending.")
    e2ee_ready: bool = Field(False, description="True when both participants have trusted-device GAF keys.")


class ChatListItem(BaseModel):
    """Single row in GET `/gaf-chat/chats` (partner card + preview + unread)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "chat_id": _EX_CHAT,
                    "partner": _CHAT_PARTNER_EXAMPLE,
                    "last_message_at": "2026-03-24T12:00:00+00:00",
                    "last_message_preview": "See you tomorrow",
                    "unread_count": 3,
                }
            ]
        }
    )

    chat_id: str = Field(..., description="1:1 chat id.", examples=[_EX_CHAT])
    partner: ChatPartner = Field(..., description="The other participant.")
    last_message_at: str | None = Field(None, description="ISO timestamp of last message.")
    last_message_preview: str | None = Field(None, description="Short preview of last message.")
    unread_count: int = Field(..., ge=0, description="Unread count for current user in this chat.")
    partner_last_read_message_id: str | None = Field(
        None,
        description="Watermark: latest message id the partner has read (for read receipts on your messages).",
    )
    e2ee_status: GafE2eeStatus = Field("off", description="Chat-level E2EE mutual-consent state.")
    e2ee_requested_by_user_id: str | None = Field(None, description="User id that requested E2EE, if pending.")
    e2ee_ready: bool = Field(False, description="True when both participants have trusted-device GAF keys.")


class ChatListItemLite(BaseModel):
    """Single row in GET `/gaf-chat/chats/lite` — same ordering as `/chats`, smaller partner object."""

    chat_id: str = Field(..., description="1:1 chat id.", examples=[_EX_CHAT])
    partner: ChatPartnerLite = Field(..., description="Other participant (trimmed fields).")
    last_message_at: str | None = Field(None, description="ISO timestamp of last message.")
    last_message_preview: str | None = Field(None, description="Short preview of last message.")
    unread_count: int = Field(..., ge=0, description="Unread count for current user in this chat.")
    partner_last_read_message_id: str | None = Field(
        None,
        description="Watermark: latest message id the partner has read.",
    )
    e2ee_status: GafE2eeStatus = Field("off", description="Chat-level E2EE mutual-consent state.")
    e2ee_requested_by_user_id: str | None = Field(None, description="User id that requested E2EE, if pending.")
    e2ee_ready: bool = Field(False, description="True when both participants have trusted-device GAF keys.")


class E2eeConsentStatusResponse(BaseModel):
    """Chat-level E2EE mutual-consent status."""

    chat_id: str = Field(..., description="Chat id.", examples=[_EX_CHAT])
    status: GafE2eeStatus = Field(..., description="Current mutual-consent state.")
    requested_by_user_id: str | None = Field(None, description="User that requested E2EE, if pending.")
    user_1_consented_at: str | None = Field(None, description="User 1 consent timestamp, if any.")
    user_2_consented_at: str | None = Field(None, description="User 2 consent timestamp, if any.")
    activated_at: str | None = Field(None, description="When both participants accepted E2EE.")
    declined_at: str | None = Field(None, description="When the request was declined.")
    disabled_at: str | None = Field(None, description="When future E2EE was disabled.")
    updated_at: str | None = Field(None, description="Last E2EE state update.")
    ready: bool = Field(False, description="Both participants currently have trusted-device GAF keys.")
    current_user_consented: bool = Field(False, description="Current user has accepted the current request.")
    partner_consented: bool = Field(False, description="Partner has accepted the current request.")
    partner_user_id: str = Field(..., description="Other participant user id.")


class MessageItem(BaseModel):
    """One message in list/detail responses."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": _EX_MSG,
                    "chat_id": _EX_CHAT,
                    "sender_id": _EX_USER,
                    "body": "Hello",
                    "created_at": "2026-03-24T12:00:00+00:00",
                    "edited_at": None,
                    "deleted_for_sender": False,
                    "deleted_for_recipient": False,
                    "algorithm": "v1",
                    "encryption_version": "v1",
                    "body_ciphertext": None,
                    "nonce": None,
                }
            ]
        }
    )

    id: str = Field(..., description="Message id.", examples=[_EX_MSG])
    chat_id: str = Field(..., description="Owning chat id.", examples=[_EX_CHAT])
    sender_id: str = Field(..., description="Author user id.", examples=[_EX_USER])
    body: str = Field(..., description="Decrypted or placeholder body for the client.")
    created_at: str = Field(..., description="Creation time (ISO).")
    edited_at: str | None = Field(None, description="Last edit time (ISO), if edited.")
    deleted_for_sender: bool = Field(..., description="Hidden for sender (soft delete).")
    deleted_for_recipient: bool = Field(..., description="Hidden for recipient (soft delete).")
    algorithm: str | None = Field(None, description="Storage / encryption algorithm tag.")
    encryption_version: str | None = Field(None, description="Encryption scheme version.")
    body_ciphertext: str | None = Field(None, description="Ciphertext when not returned as plain body.")
    nonce: str | None = Field(None, description="Nonce for ciphertext.")
    attachment_content_id: str | None = Field(
        None, description="Sender's unified_content id when message carries a file."
    )
    attachment_mime_type: str | None = Field(None, description="MIME type of attached file (metadata).")
    attachment_name: str | None = Field(None, description="Original file name for display.")
    attachment_size: int | None = Field(None, description="Attachment size in bytes.")
    attachment_recipient_saved_id: str | None = Field(
        None, description="Recipient's unified_content id after «accept» (their copy)."
    )
    metadata: dict[str, object] | None = Field(
        None,
        description="Structured payload for system messages (e.g. onboarding steps, app actions).",
    )
    reply_to_message_id: str | None = Field(
        None,
        description="When set, this message is a reply to another message in the same chat.",
    )
    e2ee_session_key_envelope: str | None = Field(
        None,
        description="RSA-wrapped AES session key for the current viewer and this message (E2EE).",
    )


class AcceptAttachmentResponse(BaseModel):
    """POST `/gaf-chat/chats/{chat_id}/messages/{message_id}/accept-attachment`."""

    content_id: str = Field(..., description="Recipient's new unified_content id (unfiled).")
    already_saved: bool = Field(False, description="True if the file was already imported earlier.")


class UserSearchItem(BaseModel):
    """One user row from GET `/gaf-chat/users/search`."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": _EX_USER,
                    "username": "alice",
                    "display_name": "Alice",
                    "avatar_url": None,
                    "full_name": "Alice Example",
                }
            ]
        }
    )

    id: str = Field(..., description="User id.")
    username: str | None = Field(None, description="Username match.")
    display_name: str | None = Field(None, description="Short display label.")
    avatar_url: str | None = Field(None, description="Avatar URL.")
    full_name: str | None = Field(None, description="Full name.")


class PublicKeyUploadBody(BaseModel):
    """Body for POST `/gaf-chat/keys/public` (E2E public key)."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "examples": [
                {
                    "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA…\n-----END PUBLIC KEY-----",
                    "algorithm": "ed25519",
                }
            ]
        },
    )

    public_key_pem: str = Field(
        ...,
        min_length=1,
        max_length=GAF_MAX_PUBLIC_KEY_PEM_LENGTH,
        description="PEM-encoded public key.",
    )
    algorithm: str = Field(
        ...,
        min_length=1,
        max_length=GAF_MAX_E2E_ALGORITHM_LENGTH,
        description="Key algorithm label (e.g. curve or RSA variant).",
    )

    @field_validator("public_key_pem", mode="before")
    @classmethod
    def strip_public_key_pem(cls, v: object) -> str:
        return _strip_required_str(v, field_name="public_key_pem")

    @field_validator("algorithm", mode="before")
    @classmethod
    def strip_algorithm(cls, v: object) -> str:
        return _strip_required_str(v, field_name="algorithm")


class PublicKeyInfo(BaseModel):
    """Response for `/gaf-chat/keys/public`, `/keys/public/me`, `/keys/public/{user_id}`."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"has_key": False, "algorithm": None, "public_key_pem": None},
                {
                    "has_key": True,
                    "algorithm": "ed25519",
                    "public_key_pem": "-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----",
                },
            ]
        }
    )

    has_key: bool = Field(..., description="Whether a public key is stored.")
    algorithm: str | None = Field(None, description="Stored algorithm, if any.")
    public_key_pem: str | None = Field(None, description="Stored PEM, if any.")


class SessionKeyEnvelope(BaseModel):
    """Response for GET `/gaf-chat/chats/{chat_id}/session-key` (opaque envelope for the current user)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "chat_id": _EX_CHAT,
                    "encrypted_key_payload": "base64-or-client-opaque-payload",
                }
            ]
        }
    )

    chat_id: str = Field(
        ...,
        min_length=1,
        max_length=GAF_MAX_UUID_STR_LENGTH,
        description="Chat id this envelope belongs to.",
        examples=[_EX_CHAT],
    )
    encrypted_key_payload: str = Field(
        ...,
        min_length=1,
        max_length=GAF_MAX_E2E_SESSION_KEY_LENGTH,
        description="Opaque encrypted session key bytes (client encoding).",
    )

    @field_validator("chat_id", mode="before")
    @classmethod
    def strip_chat_id(cls, v: object) -> str:
        return _strip_required_str(v, field_name="chat_id")

    @field_validator("encrypted_key_payload", mode="before")
    @classmethod
    def strip_encrypted_key_payload(cls, v: object) -> str:
        return _strip_required_str(v, field_name="encrypted_key_payload")


class GafPartnerDesktopAppOption(BaseModel):
    """One desktop catalog app visible to the chat partner (admin GAF link picker)."""

    app_id: str = Field(..., description="Catalog app_id slug.")
    name: str = Field(..., description="Display name from catalog.")
    app_component: str = Field(..., description="Desktop React component to open.")
    category: str = Field("", description="Store category label.")


class GafPartnerDesktopAppsResponse(BaseModel):
    """GET `/gaf-chat/chats/{chat_id}/partner-desktop-apps` (admin only)."""

    apps: list[GafPartnerDesktopAppOption] = Field(default_factory=list)


class SendDesktopAppLinkBody(BaseModel):
    """POST `/gaf-chat/chats/{chat_id}/messages/desktop-app-link` (admin only)."""

    app_id: str = Field(..., min_length=1, max_length=120, description="Partner-visible catalog app_id.")
    note: str | None = Field(
        None,
        max_length=500,
        description="Optional short note appended under the app line in message body.",
    )

    @field_validator("app_id", mode="before")
    @classmethod
    def strip_app_id(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, v: object) -> object:
        return _strip_opt_empty_none(v)


__all__ = [
    "ByUsernameBody",
    "ChatByUsernameResponse",
    "ChatListItem",
    "ChatPartner",
    "EditMessageBody",
    "GafChatMeResponse",
    "GafForMeOnlyQuery",
    "GafListMessagesLimit",
    "GafMessageCursorParam",
    "GafUserSearchLimit",
    "GafUserSearchQuery",
    "GAF_DEFAULT_PAGE_LIMIT",
    "GAF_DEFAULT_USER_SEARCH_LIMIT",
    "GAF_MAX_BODY_LENGTH",
    "GAF_MAX_E2E_ALGORITHM_LENGTH",
    "GAF_MAX_E2E_CIPHERTEXT_LENGTH",
    "GAF_MAX_E2E_NONCE_LENGTH",
    "GAF_MAX_E2E_SESSION_KEY_LENGTH",
    "GAF_MAX_E2E_VERSION_LENGTH",
    "GAF_MAX_MESSAGE_ID_LENGTH",
    "GAF_MAX_PAGE_LIMIT",
    "GAF_MAX_PUBLIC_KEY_PEM_LENGTH",
    "GAF_MAX_USER_SEARCH_LIMIT",
    "GAF_MAX_UUID_STR_LENGTH",
    "MarkReadBody",
    "MessageItem",
    "OkStatusResponse",
    "PublicKeyInfo",
    "PublicKeyUploadBody",
    "SendMessageBody",
    "SessionKeyEnvelope",
    "UserSearchItem",
]
