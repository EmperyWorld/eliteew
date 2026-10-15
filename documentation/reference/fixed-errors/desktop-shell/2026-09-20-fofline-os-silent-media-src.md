# FoFline silent on EmpiierOS after a cancelled media load

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `contained` |
| **date** | `2026-09-20` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md` |
| **commit** | — |

## Symptom

Music Player on the EmpiierOS seat stays on the spinner. The file arrives (`download-ticket` 200, then `download` 200). WebKit cancels `blob:fofline-spa://…`. The whole FoFline surface goes silent because analog PCM stays held by the product WebProcess.

## Failure layers

- Now-playing preferred a ticket URL as `HTMLMediaElement.src` on `fofline-spa:`.
- GStreamer does not play that custom-scheme URL.
- The blob fallback is cancelled too, and the failed element keeps ALSA open.

## Root cause

The pack used Chromium media URLs on a WebKitGTK host that has no sound server. The bytes were already on the seat. The media element was the wrong owner.

## What we did

- On `foflineNative` without Tauri, play from `decodeAudioData` and `AudioBufferSourceNode`.
- Do not assign `download-by-ticket` or `blob:` to `HTMLMediaElement.src`.
- Do not probe those URLs with `Range: bytes=0-0`.
- Pause/stop stops the source, closes the context, and clears leftover media `src`.
- Browser and Tauri keep the living `<audio>` path.

## Recommendations

- Do not add Pulse, PipeWire, or a Tauri playback invoke from this pack.
- If glass still has no sound after a pack with no `blob:` / `download-by-ticket` media src, and ALSA is free, stop. The OS owns the helper.
- Do not set `include_audio=true` for this track.

## Verification

- Vitest: `foflineDecodedPlayback.test.ts`, `nowPlayingTrackAudioSource.test.ts` (fofline skips ticket stream; browser still uses it).
- Packed `1789837366816-w7k51h8btf` contains `decodeAudioData` and `AUDIO_DECODE_ERROR`. `include_audio=false`.
- Seat glass after uptake is still the operator's walk. Status stays `contained` until Play is audible and `aplay -l` is not stuck `0/1` after stop.
