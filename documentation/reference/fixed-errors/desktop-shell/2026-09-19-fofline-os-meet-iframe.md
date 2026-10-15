# FoFline on EmpiierOS: Meet overlay hid chat

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-19` |
| **also_affects** | — |
| **canon** | `documentation/product/INTERNAL-VIDEO-CALLS.md` |
| **commit** | — |

## Symptom

Poet’s call opened a second window, then GAF chat vanished. The call window said the picture was over that window. Lady saw presence, not camera. The OS Meet overlay covered the whole product WebView.

## Failure layers

- `VideoCallApp` called `openMeetStage` after join on EmpiierOS.
- The placeholder copy described a Tauri stage under the call window.
- The overlay is GTK fill on the product WebView, so every FoFline window disappeared.

## Root cause

EmpiierOS was treated as the Tauri Meet path. The seat now has WebRTC, so the cloud iframe is the call surface. The overlay is not.

## What we did

- EmpiierOS uses the same Meet iframe as the browser. `join_url` is not rewritten.
- Default calls do not call `openMeetStage` or `closeMeetStage`.
- Hangup stays `POST /end`. Opening `VideoCallApp` does not close `GAFChatApp`.
- Tauri placeholder strings are not selected on this host.

## Recommendations

- Nested Meet iframe on EmpiierOS SIGSEGV'd the product WebProcess. The living path is the clipped sibling (`openMeetStage(joinUrl, bounds)`). See `2026-09-19-fofline-os-meet-sibling-bounds.md`.
- Do not restore a FILL overlay. Do not show the Tauri “over this window” copy on EmpiierOS.
- Do not toast local video from parent chrome.

## Verification

- `VideoCallApp.empiierosIframe.test.tsx` — iframe, no `openMeetStage`, no placeholder, hangup calls `endVideoCall`.
- `desktopDeepLink.test.ts` — video-call open does not close `GAFChatApp`.
- Glass on poet is not this run. Do not claim the iframe is non-white until that walk.
