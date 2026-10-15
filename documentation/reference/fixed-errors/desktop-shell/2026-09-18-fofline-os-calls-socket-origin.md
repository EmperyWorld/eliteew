# FoFline on EmpiierOS: calls 403 and Socket.IO opaque origin

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-18` |
| **also_affects** | `desktop-client` |
| **canon** | `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` |
| **commit** | — |

## Symptom

On EmpiierOS glass (`fofline-spa://localhost`), `GET /api/v1/video-calls/pending-incoming` returned 403 `fofline_remote_tools_denied` about every 8 seconds. GAF chrome was mounted while the install profile omitted GAF. Socket.IO had no scheme handler for `/socket.io`.

## Failure layers

- API W5 allowlist omitted `/api/v1/video-calls` and `/api/v1/gaf-chat`.
- FE surface `fofline-connected` hid GAF/VideoCall while taskbar still polled calls.
- Socket.IO origin fell through to `window.location.origin` (`fofline-spa://localhost`).
- Meet stage treated “native FoFline” as Tauri invoke, so OS WebKit kept the white nested iframe.

## Root cause

FoFline-on-OS is the same desktop, but the allowlist, catalog, and host checks still described a Tauri-only shell that was not allowed to call or signal.

## What we did

- Added both prefixes to `_FOFLINE_ALLOW_PREFIXES` (not extra-prefix env).
- Enabled `GAFChatApp` and `VideoCallApp` on the profile and `FOFLINE_CONNECTED_APP_COMPONENTS`.
- One `resolveSocketIoHttpOrigin`: opaque `fofline-spa:` → `https://app.eliteew.ru`.
- EmpiierOS host is `foflineNative` + `EmperyDesktopNativeOidc` without Tauri. No nested Meet iframe. Optional `EmperyDesktopMeetStage.openMeetStage`.

## Recommendations

- Do not re-hide GAF while the taskbar still polls `pending-incoming`.
- Do not point Socket.IO at `fofline-spa:`.
- Do not treat a white Meet iframe as a successful OS call.
- Meet media still needs the OS portal hostmap for `meet.eliteew.ru`.

## Verification

- `pytest tests/test_fofline_w3_w5.py`: 7 passed (video-calls + gaf-chat allow; admin, marketing, factory deny).
- Vitest socket origin, Meet stage, surface, host-link chip, socket auth patch: 20 passed.
- Two `test_desktop_install_profiles.py` failures (`cloud-full` count 45 vs 43, assistant title) are outside this wave.

## Residual risk

EmpiierOS glass is not retested in this session. `join_url` stays `meet.eliteew.ru`; picture waits on the OS hostmap and optional meet-stage hook.
