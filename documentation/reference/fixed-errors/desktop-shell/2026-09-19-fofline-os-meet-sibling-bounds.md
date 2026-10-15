# FoFline Meet iframe SIGSEGV on EmpiierOS

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `contained` |
| **date** | `2026-09-19` |
| **also_affects** | — |
| **canon** | `documentation/product/INTERNAL-VIDEO-CALLS.md` |
| **commit** | — |

## Symptom

Seat glass 2026-09-19 03:34 +10: Meet loaded in the product WebProcess (`kind=iframe`), then the product `WebKitWebProcess` SIGSEGV (`at 18` / `8d317`). FoFline went white.

## Failure layers

- Pack `1789750041479-4jxqj4w8lj` mounted `<iframe src=meet.eliteew.ru>` inside the product WebView.
- WebKitGTK does not survive a nested Meet document in that process.
- The earlier FILL overlay hid chat. The iframe lock replaced it and crashed the product instead.

## Root cause

EmpiierOS was sent down the Chrome iframe path. Meet on this host must be a sibling WebView clipped to the VideoCall stage, not a child frame and not a fullscreen overlay.

## What we did

- After `/join` 200, `openMeetStage(joinUrl, bounds)` from the stage rect. URL-only is not sent.
- `setMeetStageBounds` on resize, layout, and a short interval while the call window exists.
- Hangup, unmount, and `empiieros-meet-stage-lost` call `closeMeetStage` when this session opened the stage, then `POST /end`. `pagehide` keepalive `/end` stays.
- Chrome still mounts the iframe. Tauri still uses its own bounds invoke.

## Recommendations

- Do not restore the nested iframe as the EmpiierOS default.
- Do not restore FILL. Do not `ToggleFullscreen` `identifier=*`.
- Do not show `videoCallNativeMeetActive*` on this host.
- Seat syslog must show `kind=open` then `kind=bounds`, not `kind=iframe`.

## Verification

- Vitest: EmpiierOS host + join 200 calls `openMeetStage` with the rect; no iframe; hangup calls `endVideoCall` and `closeMeetStage`; lost calls `/end`.
- Packed `VideoCallApp-bs-BnhEY.js` in `1789794743865-pza6u2zqzf` contains `setMeetStageBounds`, `openMeetStage`, and `meet_stage_bounds_required`.
- Seat glass after uptake is still the operator's walk. Status stays `contained` until syslog shows `kind=open` then `kind=bounds` and not `kind=iframe`.
