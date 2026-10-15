# Realtime: Socket.IO and WebSocket planes

Living hub for EliteEW realtime transports. Product surfaces (GAF, Doc Editor, Live Voice, EWDesk) own domain behavior; this document owns **transport planes, auth, nginx, and retirement rules**.

**Audit product id:** `socket-io` (see [`reference/fixed-errors/products.json`](../reference/fixed-errors/products.json)).

---

## 0. Library versions (living)

| Side | Package | Pin / lock | Notes |
|------|---------|------------|-------|
| FE | `socket.io-client` | **4.8.3** (`^4.8.3`) | npm latest; **no** v5 published |
| BE | `python-socketio` | **5.16.4** (`>=5.16.4,<6`) | PyPI latest major line; pairs with JS Socket.IO 3.x/4.x (protocol r5) |
| BE | `python-engineio` | **4.13.5** (`>=4.13.5,<5`) | required by python-socketio ≥5.16.4 |

Re-lock: `bash docker/builders/stack0-api/scripts/recompile-locks.sh`. Prod picks up versions only after stack0 baked release.

---

## 1. Planes (do not conflate)

| Plane | Path / mount | Auth | Role |
|-------|----------------|------|------|
| **Socket.IO** | `/socket.io/` via `socketio.ASGIApp` in `shared/api/main.py` | JWT + SSO registry in `socketio_handler.connect`; shared `validate_websocket_token` | GAF delivery, presence, EWDesk feed, Ассистент collab rooms, maintenance, doc **presence/cursors**, notifications. Outbound emits live in `socketio_emit_{gaf,bi,transcription,desktop_ai_chat}` and are **re-exported** from `socketio_handler` (stable import path). |
| **Live Voice WS** | `/api/v1/live-voice/ws/{session_id}` | `validate_websocket_token` in endpoint | Real-time voice pipeline |
| **Doc Yjs WS** | `/api/v1/doc-editor/collaboration/...` | Token query + `validate_websocket_token` | Binary Yjs sync (content) |
| **HTTP `/ws/health`** | `GET /ws/health` | Public probe | Liveness stub only |

**Soft-retired (2026-07-28):** FastAPI echo router `websocket_handler.py` (`/api/ws`, `/api/ai_hub/ws`, …) — unauthenticated demo payloads. Do **not** restore without JWT gate + product owner. FE raw `WebSocketService.ts` / `CollaborationWebSocket.ts` and BI `websocket_manager.py` soft-retired the same day.

---

## 2. Auth contract

Shared helper: `shared/api/core/websocket_auth.py` → `validate_websocket_token`.

| Entry | Must call helper |
|-------|------------------|
| Socket.IO connect | yes |
| Live Voice WS | yes |
| Doc Yjs WS | yes |

Regression: `shared/api/tests/test_realtime_cross_layer_auth_contract.py`.

Socket.IO handshake also enforces:

- Client build gate (soft vs reject — see `client_build_service`)
- Browser Socket.IO **lease** (`try_claim_browser_socket_lease` → on conflict `force_claim_browser_socket_lease`, newest wins; older live sids get `presence_superseded` + disconnect)
- SSO replace confirm / mid-session kill (`socket_sso_session_watch`)

OAuth2 middleware **does not** JWT-inspect Socket.IO upgrades; connect handler is the gate. Public allowlist must **not** include legacy `/api/ws` or bare `/ws` (only `/ws/health` HTTP probe).

---

## 3. Frontend ownership

| Module | Role |
|--------|------|
| `EmperyworldSocketService.ts` | Primary SPA Socket.IO client (`Services.socket`); types in `emperyworldSocketTypes.ts`; inbound bind in `emperyworldSocketInboundHandlers.ts` |
| `useSocketConnection.tsx` | Admin / non-desktop autoConnect bridge (intentional second `io()` when not under desktop single-tab gate) |
| `socketIoClientPolicy.ts` | Transports `['websocket','polling']`. Same-sid reconnect after transport loss; `forceNew` **only** on stale Engine.IO HTTP 400 (not on `transport close` — that raced Redis browser lease) |
| `authenticatedSocketAuth.ts` | OIDC AT refresh → `patchSocketAuth` **only** (no `disconnect()+connect()`); re-handshake only on auth connect_error / recover |
| `authenticatedSocketAuth.ts` | Token + `sso_replace_confirm` in handshake |
| `desktopRealtimeLeader.ts` + `tabBootstrap.ts` + `SingleTabElectionGate` | One leader tab owns socket; followers passive UI |
| `useCollaboration.ts` + `docEditorCollabSocketPolicy.ts` + `docEditorCollabSocketRecovery.ts` | Prefers borrow `Services.socket`; follower tabs skip dedicated `io()`; under single-tab policy `forceNew` must not open a second client; **auto re-join on `connection-restored`** after presence supersede (no page refresh) |
| `videoCallLeader.ts` + `VideoCallApp.tsx` | One Meet surface per `userId+callId`. Browser uses a Jitsi iframe. Tauri uses a top-level stage. EmpiierOS WebKit does not mount the nested iframe (white frame). Visible tab can steal leadership from a hidden holder via BroadcastChannel |
| `useDesktopSocketLeader.ts` | On `presence_superseded` **yield** (no 800ms fight); probe/visibility reclaim later under newest-wins lease |

Intentional `io()` call sites (SPA): `EmperyworldSocketService` (desktop), `useSocketConnection` (admin/non-desktop), `useCollaboration` fallback only when single-tab policy is off. Deprecated raw `/ws` helpers removed from tree (trash). Config `WS_ENDPOINTS.MAIN` and `SERVICE_CONFIGS.WEBSOCKET` point at Socket.IO. Both SPA clients resolve the Engine.IO origin with `resolveSocketIoHttpOrigin()`: opaque `fofline-spa:` speaks `https://app.eliteew.ru` (EmpiierOS does not scheme-proxy `/socket.io`). Browser `https://app.eliteew.ru` stays `location.origin`. Access-token refresh patches `socket.io.opts.auth` only.

---

## 4. Presence vs SSO vs shell

Canonical operator doc: [`SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`](SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md).

Multi-tab residual (CLOSED 2026-08-02): full multi-tab REST/UI **wontfix** (shared JWT); leader-tab + lease + passive follower remain realtime hygiene. Admin must not treat `веб: N` as Keycloak failure (`anomalyNotKeycloak`). Optional operator smoke A1–A3 stays **watch**, not a Keycloak blocker. Living operator policy: [`SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`](SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) (dated bug dump soft-retired → `trash/`).

---

## 5. Ops / nginx

Prod SPA nginx (`shared/web/frontend/nginx.prod.conf`):

- `location /socket.io/` — upgrade + long timeouts
- `location /api/v1/live-voice/ws/` — upgrade
- `location = /ws/health` — proxy to API `GET /ws/health` (probe only; dynamic JSON)
- **No** catch-all `location /ws/` (legacy FastAPI echo soft-retired 2026-07-28)

Celery → browser emits require Socket.IO **RedisManager** (`AsyncRedisManager` in `socketio_handler`). Outbound helpers: `socketio_emit_gaf.py` / `socketio_emit_bi.py` / `socketio_emit_transcription.py` / `socketio_emit_desktop_ai_chat.py` (lazy `_sio()`; re-exported from `socketio_handler`). If Redis manager fails at startup, HTTP paths still work; worker-originated live emits may not reach clients until REST reload.

**Ассистент collaboration:** delivery room `desktop_ai_chat:{chat_id}:user:{user_id}`; client join `desktop_ai_chat_join`; server events `desktop_ai_chat.turn_started|turn_done|member_changed`. Canon: [product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md](../product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md) §Wave 4.

Maintenance drain: Socket.IO stays up for `system.maintenance` — [`USER-SAFE-RESTARTS-AND-MAINTENANCE.md`](USER-SAFE-RESTARTS-AND-MAINTENANCE.md).

---

## 6. Related product canons

| Topic | Doc |
|-------|-----|
| GAF Socket.IO events | `product/GAF-CHAT-BACKEND.md` |
| Doc collab (Yjs + Socket.IO presence) | `product/DOC-EDITOR-COLLABORATION.md` |
| EWDesk feed push | `product/desktop/EWDESK-NEWS.md` / optimization program |
| Desktop socket perf marks | `product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md` |
| Voice / Live Voice | `product/VOICE-CONTROL-STUDIO.md`, `product/desktop/DESKTOP-VOICE-COMMAND-ON-DEMAND.md` |

---

## 7. Verification

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_realtime_cross_layer_auth_contract.py \
  tests/test_socketio_inbound_event_validation.py \
  tests/test_socketio_inbound_event_validation_p2.py \
  tests/test_socket_sso_replacement_kill.py \
  tests/test_websocket_session_kill.py \
  tests/test_browser_presence_single_session.py \
  tests/architecture/test_ais_static_socketio_contract.py -q

cd shared/web/frontend && pnpm exec vitest run \
  src/services/auth/__tests__/socketIoClientPolicy.test.ts \
  src/services/communication/__tests__/emperyworldSocketService.selfHeal.test.ts \
  src/services/communication/__tests__/emperyworldSocketService.waveC.contract.test.ts \
  src/services/core/__tests__/serviceConfigPaths.contract.test.ts \
  src/hooks/__tests__/useSocketConnection.selfHeal.test.ts \
  src/services/__tests__/realtimeAuthSourceContract.test.ts \
  src/pages/Desktop/utils/__tests__/videoCallLeader.test.ts \
  src/components/UltimateDocEditor/hooks/__tests__/docEditorCollabSocketPolicy.test.ts
```

Operator prod smoke after the next baked release:

1. Open 6 `#/desktop` tabs under one browser profile.
2. Users hub must show `веб: 1` for the user.
3. Close the leader tab; another tab must take over without `веб: N`.
4. Start one GAF video call; Meet must show one tile for that user.

---

## 8. Follow-ups

- ~~API emit split from `socketio_handler.py`~~ **done 2026-07-28 Wave B** — `socketio_emit_gaf.py` / `socketio_emit_bi.py` / `socketio_emit_transcription.py`; parent re-exports (Layer E). Inbound connect/doc/collab stay in handler (~1100 LOC; further split deferred — optional structural, not open product follow-up).
- ~~FE god-file `EmperyworldSocketService.ts`~~ **done 2026-07-28 Wave C** — types + inbound handlers extracted; dead outbound emits (`joinChat`/`sendMessage`/…) removed (zero call sites; prior snapshot under `trash/`). Parent ~720 LOC; connect lifecycle remains in service.
- ~~Optional: remove nginx `location /ws/`~~ **done 2026-07-28 Wave A** (`/ws/health` → API proxy)
- ~~Jitsi A3 client Cause~~ **done 2026-07-30** — `videoCallLeader` visibility handoff (hidden holder yields on `request-leadership`); Vitest locks; collab policy: under single-tab, `forceNew` cannot open a second `io()`.
- **Watch (optional):** operator may still smoke multi-tab **A1–A3** on prod after baked releases; not a Keycloak/SSO outage signal. Bug doc CLOSED wontfix for blocking multi-tab REST.
- **Open (deferred):** server-side Meet kick of duplicate `context.user.id` occupants; Playwright 6-tab Meet E2E.

## Private subscription authorization

Generic `subscribe`/`unsubscribe` requires an authenticated SID. Allowed public channels are `general` and `ewdesk_feed`; personal subscription is limited to the connection's own `gaf_user_{user_id}`. Unknown names, raw SIDs, collaboration/document rooms and both transcription namespaces are denied. Transcription push subscriptions remain unavailable until a durable task-owner contract is defined.

The existing `business_intelligence_{session_id}` client channel is authorized against the stored session owner and mapped to an internal `business_intelligence_{session_id}:user:{user_id}` room. Every BI emit resolves the current owner again, so a stale subscriber cannot receive a subsequent owner's events. Storage failure drops private delivery. Session-owner overwrite remains a separate BI write-path issue; this transport policy does not remediate that write path.

Desktop chat uses its dedicated ACL-checked join event. UUIDs are canonicalized, and internal delivery rooms bind both chat and user. Each emit resolves the owner and currently accepted members from the database; it does not iterate a worker-local SID map. Remove/leave closes the target room via the Socket.IO manager. A failed eviction cannot authorize subsequent events because recipients are checked again. An event whose recipient snapshot preceded a concurrent revoke may already be in flight.

Deployment requires coordinated API/worker updates and reconnecting existing sockets; mixed old/new emitters or pre-existing arbitrary subscriptions must not remain active. No database migration is needed. The dedicated document/collaboration-session join policies are separate boundaries and are not covered by this generic subscription fix.
