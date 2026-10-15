# Android API Contracts (v1 scope)

Android client lives in `pack-cloud/mobile/` and uses existing backend routes under `/api/v1`.

**Контракт для клиента — HTTP-пути и тела ответов.** Изменения уникальных `operationId` в экспорте OpenAPI (генерация SDK/доков) **не меняют** обязательств Android, пока не меняются метод, путь, коды ответов и схемы JSON. При любой правке перечисленных ниже маршрутов обновляйте этот файл и [`ANDROID-DEVELOPER-HANDBOOK.md`](../product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) синхронно.

_Синхронизация 2026-04-17 (мастер-роадмап):_ дедупликация `operationId` для прокси Site Studio и профиля **не затронула** пути из этого документа (`GET /api/v1/profile/me` и остальное v1 scope без изменений).

## Auth

- Native login starts in MobileAndroid in-app SSO WebView against Keycloak public client `empery-mobile` (PKCE, app-scoped WebView cookies).
  - Legacy `GET /api/v1/auth/sso/login?...` remains a backend facade route for compatibility/perimeter diagnostics, but the native app does not open it as the primary login URL.
- `POST /api/v1/auth/sso/callback`
  - Body: `{ code, state, redirect_uri, code_verifier }`
  - Response: `{ tokens: { access_token, refresh_token, expires_in, token_type, id_token? }, user? }`
  - `409 reason=session_replace_confirmation_required` consumes the one-time OAuth code; after user confirmation the client starts a new in-app WebView PKCE login and calls callback again with `X-SSO-Replace-Confirm: 1`.
- `POST /api/auth/refresh` (host root, **not** under `/api/v1/`)
  - Body: `{ "refresh_token": "..." }`
  - Response: `{ access_token, refresh_token, expires_in, token_type }`
  - Mobile Retrofit: absolute path `@POST("/api/auth/refresh")` with base URL `.../api/v1/`.
- `GET /api/v1/auth/mobile-embedded/webview-shell` (optional embedded SPA bootstrap; **Huawei primary path — origin inject**, см. [MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md](../product/mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md))
  - Query: `spa` — `mobile-ewa-companion` (default) or `mobile-handbook`
  - Headers: `Authorization: Bearer <access>`, `X-EliteEW-Mobile-Refresh: <refresh>`, `X-EliteEW-Mobile-WebView: 1`
  - User-Agent: `EmperyMobileEwaWebView/…` or `EmperyMobileAssistantWebView/…`
  - Response: `200 text/html` — inline script seeds `eliteew.keycloak.mobileEmbedded.oidcTokens.v1` + redirect на `https://<host>/#/{spa}`
  - Unknown `spa` → `400`; access token `azp` must be **`empery-mobile`**
  - Reference: `shared/api/routers/auth_mobile_embedded.py`, tests `test_auth_mobile_embedded.py`
- `POST /api/v1/auth/sso/logout`
  - Body: `{ "refresh_token": "...", "redirect_uri"?: "..." }`
  - Refresh token **must not** be sent in query string.

Reference:

- `shared/api/routers/auth_refresh.py`

## Profile + Notification Center

- `GET /api/v1/profile/me`
- `GET /api/v1/profile/me/privacy`
  - Response includes `discoverability`, `avatar_visibility`, `full_name_visibility`, `bio_visibility`, optional circle ids, and `updated_at`.
- `PATCH /api/v1/profile/me/privacy`
  - Android Profile tab sends account-scoped `discoverability`, `avatar_visibility`, `full_name_visibility`, and `bio_visibility`.
  - Current mobile UI uses `public|hidden` for discoverability and `everyone|friends_only|circle|none` for field visibility.
  - When a field uses `circle`, Android sends the matching `avatar_circle_id`, `full_name_circle_id`, or `bio_circle_id` selected from Social Hub circles loaded via friends overview.
- `GET /api/v1/profile/notification-center`
- `GET /api/v1/profile/notification-center/delta?since=<ISO-8601>`
  - When the server snapshot `updated_at` is not after `since`, response is `{ "items": [], "updated_at": "...", "unchanged": true }` so the client keeps its local merge.
- `PUT /api/v1/profile/notification-center`
- `PUT /api/v1/profile/mobile-push-token`
  - Body: `{ "token": "<fcm_token>", "platform": "android", "device_id": "<optional_stable_id>" }`
  - Response: `204 No Content` — token is upserted in `user_mobile_push_tokens` (per user, platform, optional `device_id`; omitted `device_id` uses empty key = one row per platform).
- `DELETE /api/v1/profile/mobile-push-token`
  - Body: same shape as `PUT`.
  - Response: `204 No Content` — current-user token row is removed if present. The route is idempotent for logout/reinstall cleanup.

**Server → device FCM fallback (when mobile Socket.IO offline):**

- After realtime emit of `gaf_chat.message_new|message_edited|message_deleted|chat_created`, `video_call.incoming`, or Friends/Social Hub in-app notification metadata, API may send **data-only** FCM to stored Android tokens if Redis presence shows no live mobile-class session.
- Data keys consumed by the app: `sync=chat|friends|light|all|…`, `type=video_call_incoming` (+ `call_id`, optional `chat_id`), and optional deeplink/focus keys (`chat_id`, `message_id`, `request_id`, `friend_user_id`, `tab`, `focus`, `social_hub_section`).
- Permanent FCM failures (`404` from v1 or legacy `NotRegistered`/`InvalidRegistration`) prune stale Android tokens server-side; raw tokens are not logged.
- Configure on API: `MOBILE_FCM_SERVICE_ACCOUNT_JSON` (file path or inline JSON), optional `MOBILE_FCM_PROJECT_ID`, legacy `MOBILE_FCM_SERVER_KEY`; disable with `MOBILE_FCM_ENABLED=false`.

Reference:

- `shared/api/routers/profile.py`
- `shared/api/routers/user_profile.py`

## Trusted Mobile Devices

Canonical design: [`MOBILE-TRUSTED-DEVICE-BINDING.md`](../product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md).

These routes are additive under `/api/v1/mobile-devices`. Backend implements the registry/binding foundation, server-provisioned WireGuard metadata, admin visibility/approval, and no-recovery transfer state machine. Full Android transfer UX and GAF E2EE chat encrypt/decrypt/send are later rollout steps.

- `POST /api/v1/mobile-devices/pairing-challenges`
  - Web starts a 5 minute pairing challenge.
  - Requires authenticated trusted user and fresh Keycloak `auth_time` (10 minute max age).
  - Response: `{ challenge_id, pairing_code, expires_at, qr_payload }`.
  - Server stores only a code hash, never the raw code after response.
- `POST /api/v1/mobile-devices/bind`
  - Mobile submits `{ challenge_id, pairing_code, device_label, device_id, device_public_key, wg_public_key, gaf_public_key?, signed_challenge, capabilities }`.
  - Android uses `device_public_key_algorithm=p256-es256`: DER SubjectPublicKeyInfo public key and ECDSA/SHA-256 signature over the server challenge nonce.
  - Backend also accepts `ed25519` for future clients.
  - Phone-generated private keys never leave the device.
  - Response includes trusted-device status and complete tunnel metadata
    (`interface_address`, `dns`, `allowed_ips`, `endpoint`, `server_public_key`,
    `persistent_keepalive`, `mtu` default 1280).
  - Binding fails with `503` when API WireGuard env is incomplete; it must not create an active trusted-device row without `interface_address`, `endpoint`, `server_public_key`, `dns`, and `allowed_ips`.
  - The phone builds the WireGuard client config locally using its local private key plus server-provided public metadata (including `MTU`).
- `GET /api/v1/mobile-devices`
  - Lists current user's trusted devices: label, status, key fingerprints, created/approved timestamps, and last seen metadata.
  - Query `include_inactive=true` (mobile sync only): includes revoked/expired rows so the phone can detect web-side revoke; default `false` matches web «Телефон» panel (active only).
- `POST /api/v1/mobile-devices/{device_id}/revoke`
  - Revokes a device and queues/removes its WireGuard peer.
- `POST /api/v1/mobile-devices/{device_id}/rotate-wg`
  - Rotates WireGuard key for the device without changing device identity or GAF E2EE keys.
  - Android: generate new keypair → POST public key → rebuild local config from device WG fields → import → commit keys (old config kept until import succeeds).
- `GET /api/v1/mobile-devices/transfer`
  - Lists current user's transfer requests.
- `POST /api/v1/mobile-devices/transfer/start`
  - New bound phone starts no-recovery transfer with a temporary transfer public key.
  - Body includes `old_device_id`, `new_device_id`, `transfer_public_key`, `transfer_public_key_algorithm`.
- `POST /api/v1/mobile-devices/transfer/{transfer_id}/confirm-old`
  - Old active phone confirms with device identity signature and uploads an opaque encrypted transfer blob.
  - Body includes `signed_transfer_nonce`, `encrypted_transfer_blob`, and metadata.
- `POST /api/v1/mobile-devices/transfer/{transfer_id}/confirm-email`
  - User confirms the emailed transfer token after admin approval.
- `POST /api/v1/mobile-devices/transfer/{transfer_id}/complete`
  - New phone downloads the encrypted blob and completes transfer.
- `GET /api/v1/mobile-devices/admin/transfers`
  - Admin lists transfer requests, optionally by `user_id` and `status_filter`.
- `POST /api/v1/mobile-devices/admin/transfers/{transfer_id}/approve`
  - Admin approves and triggers email confirmation.
- `POST /api/v1/mobile-devices/admin/transfers/{transfer_id}/reject`
  - Admin rejects transfer.

Security invariants:

- `users.is_trusted` allows a user to start binding; it is not the same as a bound device.
- A Keycloak mobile login without a trusted device is not enough to provision VPN access.
- If the old device is lost, GAF E2EE private keys are not recoverable from the server.
- Email confirmation token is emailed via API SMTP env (`MOBILE_TRUSTED_DEVICE_SMTP_*`) and stored only as a hash.
- Every challenge, bind, revoke, transfer, and key rotation writes an audit event without raw keys, tokens, pairing codes, or plaintext.

Android client (`pack-cloud/mobile/core/network/src/main/java/world/empery/mobile/core/network/api/MobileAppApiContracts.kt`, `MobileTrustedDeviceApi`):

- Implemented: `resolvePairingChallenge`, `bindDevice`, `listDevices`, `revokeDevice`, transfer routes.
- `ProfileTabViewModel` syncs `listDevices` after login/profile refresh; clears local WG config when the server row is not `active`.

## Mobile app (in-app updates)

- `GET /api/v1/mobile-app/overview`
  - Response includes `version_code`, `version_name`, `apk_available`, `apk_size_bytes`, `apk_sha256`, `published_at`, `release_notes`, optional `release_notes_history` (per-version notes for skipped OTA steps), and optional `min_supported_version_code` (from `stack-mobile-release` manifest when reachable, else local sidecar).
  - Optional query `installed_version_code` (client `versionCode`): when server build is newer by more than one step, `release_notes` is pre-aggregated across skipped versions from `release_notes_history` (≥ 0.2.117 app sends this param).
  - Response header **`Cache-Control: private, no-store`** (v0.2.5+ API) — клиент не должен кэшировать overview.
- `GET /api/v1/mobile-app/download`
  - Streams prod APK (`MOBILE_APK_PATH`, mount `local/binaries/empery-mobile.apk`).
- `POST /api/v1/mobile-app/download-ticket`
  - Response: `{ download_url, expires_in_seconds }`; URL points to `download-by-ticket`.
- `GET /api/v1/mobile-app/download-by-ticket?ticket=...`
  - Short-lived ticket download path with a strict single replay grace window (same IP/UA, 20s) for mobile browser retry/prefetch quirks.
  - After the grace replay is consumed or expires, the same ticket returns 401.
  - This is the only mobile-app path exempt from SSO registry enforcement.
- `GET /api/v1/mobile-app/profile`
  - Response: mobile profile preferences (`ui_style`, scale/color/a11y/push/background fields) scoped to current user.
- `PATCH /api/v1/mobile-app/profile`
  - Body: partial mobile profile preferences; server deep-merges into `users.preferences.mobile`.
- `POST /api/v1/mobile-app/support-reports`
  - Body: diagnostic bundle metadata and redacted text; response includes `report_id`, `category`, `message`.
- `PUT /api/v1/mobile-app/realtime-state`
  - Body: `{ "foreground": true|false }`; response `{ "accepted": true, "foreground": <bool> }`.
  - Redis key `presence:v1:mobile_fg:{user_id}`: `foreground=true` stores epoch seconds (TTL **90s**); `false` → `"0"` (TTL **30s**). Client reports on `onStart`/`onStop` and every **30s** while foreground (≥ **0.2.127**).
  - Gates FCM fallback: push skipped only when **both** are fresh — foreground report within **60s** and mobile Socket.IO presence heartbeat within **90s** (≥ **0.2.127** API).

All authenticated `/api/v1/mobile-app/*` routes except `download-by-ticket` must pass the same Keycloak SSO registry check as GAF/profile routes. A replaced mobile session must receive the standard session-replaced auth error.

Mobile GAF video (WebView, not Jitsi SDK): [`../product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md`](../product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md).

Operator OTA stack: `docker/scripts/mobile-release-stack.sh`; env `MOBILE_RELEASE_BASE_URL=http://stack-mobile-release`. See [`MOBILE-RELEASE-SERVER.md`](../platform/docker-re_doc/MOBILE-RELEASE-SERVER.md).

Reference:

- `shared/api/routers/mobile_app.py`
- `shared/api/services/mobile_release_manifest.py`

## EWDesk feed

- `GET /api/v1/product-desktop/news` — paginated envelope `{ items, total, limit, offset, next_cursor }`; list rows use `body_excerpt` (not full `body`). Mobile client follows `next_cursor` until exhausted (v0.1.6+).
- `GET /api/v1/product-desktop/news/{postId}` — full post body for deeplink prefetch.

Reference:

- `shared/api/routers/product_desktop.py`

## Video Calls (GAF 1:1 + group)

Canonical product flow: [`../product/INTERNAL-VIDEO-CALLS.md`](../product/INTERNAL-VIDEO-CALLS.md) (1:1 accept gate, `missed_reason`, Celery watchdog).

HTTP prefix: `/api/v1/video-calls` (authenticated GAF participant).

- `POST /api/v1/video-calls/gaf-chats/{chat_id}`
  - Starts a **1:1** call (`call_kind=direct`).
  - **2026-06-18 accept gate:** while `status=ringing`, response has `awaiting_accept=true` and **`join_url` / `jwt` / `expires_at` / `meet_base_url` are `null`** for the caller. Android/Desktop must show outgoing ringing UI and wait for Socket.IO `video_call.accepted` before calling `/join`.
  - When reusing an existing ringing call for the same chat, same nullable rule applies until `active`.
  - When reusing an **active** call, caller receives fresh `join_url` immediately (`awaiting_accept=false`).
- `POST /api/v1/video-calls/gaf-chats/{chat_id}/group`
  - Body: `{ "additional_participant_ids": ["<uuid>", ...] }` (min one friend beyond chat partner).
  - **Unchanged in accept-gate wave:** host receives `join_url` on create; invitees get `video_call.incoming`.
- `POST /api/v1/video-calls/{call_id}/join`
  - Returns fresh Jitsi JWT + `join_url` when authorized.
  - **1:1 ringing:** callee join → `status=active`, `accepted_now` server-side → caller gets `video_call.accepted`.
  - **1:1 ringing:** caller join before accept → HTTP **409** / `awaiting_callee_accept` (client shows wait state, not fatal error).
- `POST /api/v1/video-calls/{call_id}/end`
  - Response includes `call_status` (`ended` | `missed`) and optional `missed_reason` (`declined`, `caller_cancelled`, `no_answer`, `callee_unreachable`).
  - Idempotent: `already_ended=true` on repeat.
- `POST /api/v1/video-calls/{call_id}/invite` — group only; notifies new invitees.

**Create/join JSON (1:1 ringing, caller):**

```json
{
  "call_id": "uuid",
  "chat_id": "uuid",
  "room_name": "ew-gaf-…",
  "status": "ringing",
  "call_kind": "direct",
  "callee_user_id": "uuid",
  "awaiting_accept": true,
  "join_url": null,
  "jwt": null
}
```

**Join JSON (after accept, both parties):**

```json
{
  "call_id": "uuid",
  "status": "active",
  "join_url": "https://meet.eliteew.ru/ew-gaf-…?jwt=…",
  "jwt": "eyJ…",
  "awaiting_accept": false
}
```

Realtime (Socket.IO, room `gaf_user_{uuid}`):

- `video_call.incoming` — callee (and delivery retries); FCM fallback `type=video_call_incoming` when mobile socket offline.
- `video_call.accepted` — **caller only (1:1):** `{ call_id, chat_id, accepted_by_user_id }` → client should `POST …/join` then open WebView.
- `video_call.ended` — `{ call_id, ended_by_user_id, status?, missed_reason? }`; clear outgoing/incoming overlays; optional toast by `missed_reason`.

Android implementation:

- `MainViewModel.startGafVideoCallFromChat` — if `awaiting_accept==true` or blank `join_url`, show `OutgoingGafVideoCallScreen` (no WebView).
- `onVideoCallAccepted` — `joinVideoCall` + `GafVideoCallOverlayUi`.
- DTO: `VideoCallJoinResponseDto` — nullable `join_url`, `jwt`; optional `awaiting_accept`.

Reference:

- `shared/api/video_calls/router.py`
- `shared/api/video_calls/schemas.py`
- `shared/api/tasks/video_call_ringing_watchdog.py`
- Mobile WebView: [`../product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md`](../product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md)

## GAF Chat Lite

- `GET /api/v1/gaf-chat/me`
- `GET /api/v1/gaf-chat/chats`
- `GET /api/v1/gaf-chat/chats/lite` — same order as `/chats`, smaller partner object (no `bio`, badges, `is_trusted`, etc.); includes `e2ee_status`, `e2ee_requested_by_user_id`, `e2ee_ready` for send gate
- `GET /api/v1/gaf-chat/chats/{chat_id}/messages`
- `POST /api/v1/gaf-chat/chats/{chat_id}/messages`
- `POST /api/v1/gaf-chat/chats/{chat_id}/read`

Realtime (Socket.IO events):

- `gaf_chat.message_new`
- `gaf_chat.message_read`
- `gaf_chat.chat_created`

GAF E2EE key/session endpoints:

- `GET /api/v1/gaf-chat/chats/{chat_id}/e2ee`
  - Returns chat-level consent state: `off|pending|active|declined`, readiness, requester, and timestamps.
- `POST /api/v1/gaf-chat/chats/{chat_id}/e2ee/propose|accept|decline|disable`
  - Mutates chat-level E2EE consent state. Proposal/accept require active trusted-device GAF keys for both participants.
  - Ordinary chat is default. Android does not expose E2EE compose in this phase.
- `POST /api/v1/gaf-chat/keys/public`
  - Legacy/user public key upload. Trusted-device GAF key discovery is preferred for Phase 7.
- `GET /api/v1/gaf-chat/keys/public/me`
  - Current user's public key metadata.
- `GET /api/v1/gaf-chat/keys/public/{user_id}`
  - Public key discovery. Backend first checks active trusted-device `gaf_public_key`, then legacy `gaf_user_public_keys`.
- `GET /api/v1/gaf-chat/chats/{chat_id}/session-key`
  - Returns the latest opaque encrypted session-key envelope for the current participant.

Mobile display rule for this phase:

- If `GafMessageDto.algorithm` starts with `e2e_`, Android shows a generic encrypted/unsupported message and must not render `body_ciphertext` as text.
- Android compose remains ordinary plaintext-to-server mode by default and does not offer E2EE send/decrypt yet.

Attachment upload (активный Android flow):

- `POST /api/v1/content` (multipart form-data, field `file`)
  - Query: `name` (+ опционально `folder_item_id`)
  - Response: `{ id, name, mime_type, ... }`
- `POST /api/v1/gaf-chat/chats/{chat_id}/messages`
  - Body: `{ body, attachment_content_id? }`
  - `attachment_content_id` берется из предыдущего шага (`/content`) и привязывает бинарное вложение к сообщению.
- `GET /api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}/attachment`
  - Возвращает бинарный поток исходного вложения (Android использует для preview/open/download в системное хранилище).
- `POST /api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}/accept-attachment`
  - Сохраняет входящее вложение в файловый менеджер пользователя и возвращает `content_id` (опциональный сценарий).

Reference:

- `shared/api/gaf_chat/router.py`
- `shared/api/routers/socketio_handler.py`

## Friends Lite

- Push/deeplink focus:
  - `tab=friends&focus=request&request_id=<uuid>` opens Friends and promotes the matching incoming request row after refresh.
  - `tab=friends&focus=friend_detail&friend_user_id=<uuid>` opens Friends and loads the friend detail dialog after refresh.
  - Notification data `kind=friend_request_received` maps to request focus; `kind=friend_request_accepted` maps to friend detail focus when the matching id is present.
  - Backend friend notification metadata includes `sync=friends`, `focus`, `request_id`, recipient-relative `friend_user_id`, and `social_hub_section`; incoming-request notifications now target `tab=inbox`, accepted-request notifications keep `tab=friends`.
- `GET /api/v1/friends/overview`
  - Response includes `ETag` (quoted SHA-256 of JSON body). Repeat poll with header `If-None-Match: <etag>` → **`304 Not Modified`** (empty body) when the snapshot is unchanged.
  - Android reads `friends`, `incoming_requests`, `sent_requests`, `circles`, and optional `stats`.
- `GET /api/v1/friends/referral`
  - Authenticated owner invite payload for Social Hub / mobile share UI (DEBT-X-06).
  - Response: `{ referral_code, invite_url, inviter_display_name, share_message }`.
  - `invite_url` is built from `MOBILE_APP_DOWNLOAD_PAGE_URL` with `?ref=<referral_code>` (stable per user; code stored in `user_referral_codes`).
  - **Android client:** `FriendsReferralInviteSection` on Friends tab; share text from API only (`FriendsReferralInviteSupport.kt`).
- `GET /api/v1/friends/referral/preview?code=<10-char-code>`
  - **Public** bounded preview for `/mobile-app/?ref=…` landing (JWT middleware skip + SSO registry N/A).
  - Response: `{ valid: true, referral_code, inviter_display_name, invite_url }`; unknown/invalid code → **404**.
  - Exposes display name only — no email, username, or private profile fields.
  - **Android client:** `FriendReferralPreviewResponseDto` + `FriendsApi.previewFriendReferralCode` (landing parity; not used by share sheet).
- `GET /api/v1/friends/users/search?q=<query>&limit=8`
  - Response is relationship-aware candidates with `relationship_status`; Android enables direct request only for `can_send`.
- `POST /api/v1/friends/request`
- `POST /api/v1/friends/request/by-user/{user_id}`
- `GET /api/v1/friends/{user_id}/profile`
  - Android detail dialog reads relationship flags, circles, `private_note`, `note_updated_at`, `friendship_created_at`, and activity timestamps from this route before editing friend-specific metadata.
- `PATCH /api/v1/friends/{user_id}/relationship`
  - Android row controls send one flag at a time: `is_favorite`, `is_muted`, `is_blocked`, or `share_activity_with_friend`.
  - Android detail dialog sends `private_note` plus full selected `circle_ids` when saving friend-specific notes/list membership.
- `POST /api/v1/friends/circles`
- `PATCH /api/v1/friends/circles/{circle_id}`
- `DELETE /api/v1/friends/circles/{circle_id}`
  - Retrofit declares these owner-scoped circle create/edit/delete routes for mobile parity. Current UI may stay read-mostly, but DTOs tolerate `sort_order`, `color`, and `icon`.
- `POST /api/v1/friends/{user_id}/report`
  - Android Friends Lite opens a report dialog and sends `reason` (required, max 80) plus optional `details` (max 2000).
- `POST /api/v1/friends/requests/{request_id}/accept`
- `POST /api/v1/friends/requests/{request_id}/reject`
- `POST /api/v1/friends/requests/{request_id}/cancel`
- `GET /api/v1/social-hub/inbox`
  - Response: `{ items: [{ id, type, severity, title, summary, count, target_tab, target_id, created_at }] }`.
  - Items are bounded summaries only; Android must not expect private notes, message bodies, or raw profile fields.
- `GET /api/v1/social-hub/feed`
  - Privacy-safe activity timeline summaries for Social Hub home / Friends timeline parity.
  - Query: `limit` (1–50, default 30), optional `cursor`, optional `circle_id`, optional repeated `types[]`.
  - Response: `{ items: [{ id, type, created_at, actor_user_id, target_user_id, username, full_name, avatar_url, summary }], next_cursor }`.
  - Invalid cursor/circle → HTTP **400**; rows never include private notes, message bodies, or hidden profile fields.
- `GET /api/v1/social-hub/friends/{friend_user_id}/shared-content`
  - Bounded Friend Card shared-content read model between mutual non-blocked friends.
  - Query: `limit` (1–24, default 12).
  - Response: `{ items: [{ id, name, title, content_type, mime_type, file_size, visibility, direction, shared_reason, created_at, updated_at, thumbnail_url }] }`.
- `GET /api/v1/social-hub/profile/privacy-preview`
  - Response includes `discoverability`, `fields`, `audiences`, and `warnings`; Android DTOs keep field/audience lists optional for additive backend rollout.
- `GET /api/v1/friends/referral`
  - Authenticated referral invite readiness for Friends share UI (DEBT-X-06).
  - Response: `{ referral_code, invite_url, inviter_display_name, share_message }`.
  - `invite_url` targets `MOBILE_APP_DOWNLOAD_PAGE_URL` with `?ref=<code>`; codes are opaque 10-char uppercase (no raw user ids).
  - Server persists codes in `user_referral_codes` (stack1 migration `20260630_user_referral_codes.sql`).
  - **Android client:** `FriendsApi.getFriendReferralInvite` → `FriendReferralInviteResponseDto`; `FriendsTabViewModel` loads on Friends refresh; `FriendsReferralInviteSection` opens system share sheet with server `share_message` (fallback: `invite_url` only).
- `GET /api/v1/friends/referral/preview?code=<10-char-code>`
  - Public landing preview (SSO-exempt); response `{ valid, referral_code, inviter_display_name, invite_url }`.
  - Unknown/invalid code → HTTP **404**.
  - **Android client:** `FriendsApi.previewFriendReferralCode`, DTO `FriendReferralPreviewResponseDto` (optional landing/deeplink parity); Friends share UI uses authenticated `getFriendReferralInvite` only — must not fabricate `?ref=` URLs client-side.

Reference:

- `shared/api/routers/friends.py`
- `shared/api/routers/social_hub.py`
- `shared/api/services/friends_referral_service.py`

## Desktop Hub (web parity block)

Android добавил отдельный блок интеграции с desktop API, чтобы закрывать функционал веб-рабочего стола напрямую с телефона.

- `GET /api/v1/desktop/config`
  - Response includes `ETag` (quoted SHA-256 of JSON body). With `If-None-Match: <etag>` → **`304 Not Modified`** when unchanged.
- `PATCH /api/v1/desktop/config`
- `GET /api/v1/desktop/shell-state`
  - Same `ETag` / `If-None-Match` → **`304`** semantics as `config`.
  - Android `DesktopShellStateDto` mirrors backend `DesktopShellStateOut`: MRU (`recent_app_ids`, `recent_app_ids_by_desktop`, `recent_file_ids`), `clipboard_history`, `virtual_desktops`, `windows_snapshot`, `workspace_profiles`, `window_layout_presets`, `widgets_layout`, `app_collections`, `content_shortcuts`, `assistant_context_actions`, clock/timezone/quiet-mode, `now_playing`, `music_playback`, tray/GAF sound flags, `music_playlists`, `visual_style_presets`, optional `ewa_hints`.
- `PATCH /api/v1/desktop/shell-state`
  - Partial merge; null/absent keys are ignored server-side (same field set as GET).
- `GET /api/v1/desktop/store`
- `GET /api/v1/desktop/installed`
  - Response includes `ETag` (quoted SHA-256 of JSON body). With `If-None-Match: <etag>` → **`304 Not Modified`** when unchanged.
- `POST /api/v1/desktop/installed`
- `DELETE /api/v1/desktop/installed/{app_id}`
- `GET /api/v1/desktop/widget-notes`
- `POST /api/v1/desktop/widget-notes`
- `PATCH /api/v1/desktop/widget-notes/{note_id}`
- `DELETE /api/v1/desktop/widget-notes/{note_id}`
- `GET /api/v1/desktop/widget-todos`
- `POST /api/v1/desktop/widget-todos`
- `PATCH /api/v1/desktop/widget-todos/{todo_id}`
- `DELETE /api/v1/desktop/widget-todos/{todo_id}`
- `GET /api/v1/desktop/favorites`
- `POST /api/v1/desktop/favorites`
- `PATCH /api/v1/desktop/favorites/reorder` — body `{ "favorite_ids": ["uuid", …] }` (полный упорядоченный список id пользователя)
- `DELETE /api/v1/desktop/favorites/{favorite_id}`

Reference:

- `shared/api/routers/desktop.py`

## Compatibility backlog (non-breaking)

These are additive improvements for mobile, without changing desktop/web behavior:

1. ~~Mobile push token endpoint~~ — implemented: `PUT /api/v1/profile/mobile-push-token` (durable storage: `user_mobile_push_tokens`).
2. ~~Notification center delta endpoint~~ — implemented: `GET /api/v1/profile/notification-center/delta?since=...`
3. ~~Lightweight chat list endpoint~~ — implemented: `GET /api/v1/gaf-chat/chats/lite`
4. ~~Friends overview ETag support~~ — implemented: `ETag` + `If-None-Match` → `304` on `GET /api/v1/friends/overview`.
5. ~~Desktop Hub conditional GET~~ — implemented: `ETag` + `If-None-Match` → `304` on `GET /api/v1/desktop/config` and `GET /api/v1/desktop/shell-state`.
6. ~~Desktop installed list ETag~~ — implemented: `ETag` + `If-None-Match` → `304` on `GET /api/v1/desktop/installed`.

## DTO policy

- Keep Android DTOs tolerant to optional fields.
- Avoid strict dependency on desktop-only metadata.
- Use additive migrations for new fields (never require immediate mobile update for backend deploy).
