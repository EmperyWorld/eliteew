# FoFline on EmpiierOS: hangup left the Meet stage open

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-18` |
| **also_affects** | — |
| **canon** | `documentation/product/INTERNAL-VIDEO-CALLS.md` |
| **commit** | — |

## Symptom

Accept opened Meet in a sibling WebKit. Hanging up closed only the Tauri stage. EmpiierOS left `meet.eliteew.ru` on top of the desktop.

## Failure layers

- `VideoCallApp` called `closeNativeMeetStage` on end, ended, and unmount.
- It never called `window.EmperyDesktopMeetStage.closeMeetStage`.
- `{ok:true}` from open is a sibling surface, not pixels in the call window.

## Root cause

The OS close hook did not exist when the open path shipped, so the SPA had no close call to make. After the OS added `closeMeetStage`, hangup still only knew the Tauri invoke.

## What we did

- `closeEmpiierosMeetStage()` calls `closeMeetStage` with no URL and no JWT. Missing hook returns `meet_stage_unavailable`.
- End, ended, and unmount call it on the EmpiierOS host, same moments as the Tauri close.
- Denied open codes stay non-success. No iframe after `{ok:true}`.

## Recommendations

- Do not send `join_url` or the room JWT on close.
- Do not treat `{ok:true}` as an in-window picture.
- Do not mount a Meet iframe on `isEmpiierosFoflineHost()`.
- A seat still on pack `1789720073125-5fjlwh96mc` has open only. Close is in public SPA pack `1789730765446-d2ufr39pnb`.

## Verification

- `pnpm exec vitest run src/pages/Desktop/utils/__tests__/videoCallNativeMeetStage.test.ts` — 5 passed (2026-09-18).
- `pytest tests/test_fofline_w3_w5.py` — 7 passed. Allowlist unchanged.
