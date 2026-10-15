# EWA ↔ ESP TFT display (no voice)

**Status:** Living — turn + GEN image routes shipped (2026-08-20 turn; 2026-08-31 image/LLM prompt). OpenAPI pilot refreshed in-tree (`ewa.openapi.json`).  
**Edition / pack:** cloud + shared API; firmware lives adjacent in `~/ESPEliteEW` (not pack-cloud / pack-organization).

Short button-driven companion replies on an ST7789 desk display. Voice / mic / STT / TTS are **out of scope** for this surface.

## Goal

ESP32-S3 TFT asks EWA companion for a **brief** reply (1–3 lines) using fixed intents and optional ambient scalars (DHT + sound level). Same owner persona/memory as Desktop companion; **no** Desktop tools.

## Non-goals

- Microphone, STT, TTS, MP3 playback.
- Full chat history UI on the TFT (persist may still write companion transcript; device shows last reply only).
- Admin SPA «ESP Devices» app.
- Storing user JWT or admin Bearer on the device.

## HTTP contract

### Text turn

| | |
|---|---|
| Method / path | `POST /api/v1/ewa/esp-display/turn` |
| Auth | Header `X-EliteEW-Esp-Display-Token` = env `ELITEEW_ESP_DISPLAY_DEVICE_TOKEN` (constant-time compare). JWT middleware skips this exact path; router enforces the token. |
| Owner binding | Env `ELITEEW_ESP_DISPLAY_PRINCIPAL_ID` = companion `principal_id` (`User.id`). |
| Feature flag | `ELITEEW_ESP_DISPLAY_AI_ENABLED` — default **off** (`0` / unset). Same flag gates the image route. |

### Request

```json
{
  "intent": "status",
  "client_turn_id": "esp-optional-id",
  "ambient": {
    "temp_c": 24.1,
    "humidity_pct": 48.0,
    "sound_level": 1200,
    "sound_triggered": false
  }
}
```

`intent` ∈ `status` | `encourage` | `next_step` | `ambient`.

### Response

```json
{
  "ok": true,
  "intent": "status",
  "reply_lines": ["Короткая строка 1", "Строка 2"],
  "reply_chars": 42
}
```

Server wraps to at most **3 lines × ~26 characters** (fits the AI panel) and returns **UTF-8 Russian**. Firmware draws replies with a baked Cyrillic GFX bitmap font (`tft_font_ru.h`); the default Adafruit font cannot render Cyrillic.

### Errors (honest)

| Condition | HTTP | Detail (typical) |
|-----------|------|------------------|
| Flag off | 503 | `esp_display_ai_disabled` |
| Missing/wrong token | 401 | `Invalid esp display token` |
| Missing principal env | 503 | `esp_display_principal_unconfigured` |
| Rate limited | 429 | `esp_display_rate_limited` |
| Companion profile missing | 404 | `companion_profile_not_initialized` |
| LLM disabled / failure | 502 | companion chat failure codes |

### Image (ComfyUI → WebP → TFT)

| | |
|---|---|
| Method / path | `POST /api/v1/ewa/esp-display/image?format=rgb565` (default) or `?format=webp` |
| Auth / flag / principal | Same as turn (`X-EliteEW-Esp-Display-Token`, `ELITEEW_ESP_DISPLAY_AI_ENABLED`, `ELITEEW_ESP_DISPLAY_PRINCIPAL_ID`). JWT skip for this path. |
| Pipeline | **LLM** invents a fresh English prompt (preset = theme seed; optional `prompt` overrides) via UGS `image_studio_image_prompt` → Comfy (`desktop_ai_chat_image_01_top` / `01_top`) → always re-encode **WebP 240×280** → optional **RGB565 LE**. On LLM failure, static preset prompt is used (logged degrade). |
| Rate limit | ~**45 s** between image requests (separate from turn’s ~8 s). |

Request:

```json
{ "preset": "scene", "prompt": null, "client_turn_id": "esp-gen-optional" }
```

`preset` ∈ `scene` | `abstract` | `mascot` — style/theme family for the LLM. Optional `prompt` (≥3 chars) skips LLM and goes straight to Comfy.

Response `200`: binary body (`application/octet-stream` for rgb565, `image/webp` for webp) plus headers `X-EliteEW-Image-Width/Height`, `X-EliteEW-Webp-Bytes`, `X-EliteEW-Content-Id`, `X-EliteEW-Preset`, `X-EliteEW-Prompt-Source` (`llm` \| `custom` \| `fallback`).

| Condition | HTTP | Detail |
|-----------|------|--------|
| Rate limited | 429 | `esp_display_image_rate_limited` |
| Comfy/UGS incomplete | 502 | `esp_display_image_incomplete:…` |
| Timeout | 504 | `esp_display_image_timeout` |

## Companion surface

Turns run through `execute_companion_chat_message` with **`surface=esp_display`**:

- Pre-LLM agentic intake and deterministic Desktop routing are **skipped**.
- Task orchestration / Desktop tools are **skipped** at bootstrap.
- User line includes a short display instruction (max 2–3 sentences, no markdown/links/lists).
- Ambient scalars are prefixed into the user line when present (noise level is a number, not speech).
- Main LLM reply is truncated to `reply_lines` for the TFT.

## Rate limit

About **one request per 8 seconds** per process (in-memory). Multi-worker deployments may allow slightly more; not a substitute for network ACL.

## Firmware (adjacent)

Sketch: `ESPEliteEW/unpacked_11/shield/esp32_s3_zvs_box/`.

- Menu **AI**: Side cycles intent; Under runs ASK → POST turn → draw `reply_lines`.
- Menu **GEN**: Side cycles theme (`scene` / `abstract` / `mascot`) on the empty GEN panel; Under generates. On a **finished** wallpaper, short tap Under **or** Side starts a **new** LLM+Comfy roll; long-press Under/Side = menu next/prev. Footer: `tap=again hold=menu`.
- Device token: local secret / `config.h` — **not** committed to EliteEW git.
- Base URL: public HTTPS edge (`https://app.eliteew.ru`). Prod-core LAN `:80` / bare `http://192.168.1.111` is **not** reachable from STA Wi‑Fi; firmware uses `WiFiClientSecure` (`setInsecure` on desk gadget — device token is the gate).
- Offline / timeout: show connection error on TFT; no fake success.
- Image HTTP timeout ~240 s (LLM prompt + Comfy wait).

## Operator enable (Config Plane)

On command-center plaintext env for stack0 (then rebuild+encrypt SOPS + `eliteew-prod-core-env-push.sh`, then recreate / release stack0):

1. Set `ELITEEW_ESP_DISPLAY_AI_ENABLED=1`.
2. Set a long random `ELITEEW_ESP_DISPLAY_DEVICE_TOKEN`.
3. Set `ELITEEW_ESP_DISPLAY_PRINCIPAL_ID` to the owner’s companion principal (same as Desktop EWA user id).
4. `prod-core-env-bundle-build.sh` → `prod-core-env-sops-encrypt.sh` → `eliteew-prod-core-env-push.sh --yes`.
5. Ship API with the route (`release stack0 --all` or hotfix line B if NFS mount is up).
6. Put the same token on the ESP (`esp_display_secret.h`); flash firmware with AI screen + HTTPS base URL.
7. Smoke via public edge:

```bash
curl -sS -X POST 'https://app.eliteew.ru/api/v1/ewa/esp-display/turn' \
  -H 'Content-Type: application/json' \
  -H "X-EliteEW-Esp-Display-Token: $ELITEEW_ESP_DISPLAY_DEVICE_TOKEN" \
  -d '{"intent":"status","ambient":{"temp_c":24.0,"sound_level":100,"sound_triggered":false}}'
```

Expect JSON with `reply_lines`. Wrong token → 401. Flag off / old image without route → 503/404. Then on device: AI screen → short Under → lines on TFT.

Image smoke (WebP path; returns binary):

```bash
curl -sS -D - -o /tmp/esp-gen.webp -X POST 'https://app.eliteew.ru/api/v1/ewa/esp-display/image?format=webp' \
  -H 'Content-Type: application/json' \
  -H "X-EliteEW-Esp-Display-Token: $ELITEEW_ESP_DISPLAY_DEVICE_TOKEN" \
  -d '{"preset":"scene"}' --max-time 180
file /tmp/esp-gen.webp
```

Expect `image/webp` and headers with width/height. Device GEN tab uses `format=rgb565` (same pipeline, WebP intermediate on server).

**Note:** Device token lives in gitignored firmware secret + Config Plane bundle — never commit plaintext token values.

## Failure / edge matrix

| Axis | Behavior |
|------|----------|
| Offline | ESP timeout → «нет связи»; no auto-retry without button |
| Dual-flag | Flag `0` → 503 for turn **and** image; same enable gate |
| Permission | Device token only; tools forbidden on text surface; image uses owner principal from env |
| Regression | `pytest … -k esp_display`; device ASK → lines; GEN → rgb565 blit |

## OpenAPI / FE types

Regenerable EWA pilot (`pnpm run openapi:pilot:ewa` / bake `--refresh-openapi-pilots`):

| Path | Schemas / notes |
|------|-----------------|
| `POST /api/v1/ewa/esp-display/turn` | `EspDisplayTurnIn` → `EspDisplayTurnOut`; optional `EspDisplayAmbientIn` |
| `POST /api/v1/ewa/esp-display/image` | `EspDisplayImageIn`; binary `rgb565` / `image/webp` + `X-EliteEW-*` metadata headers |

Pilot: `shared/web/frontend/openapi/pilot/ewa.openapi.json` → `src/generated/ewa-openapi.ts`. **No SPA consumer** — firmware is the client; types exist for contract locks (`test_esp_display_turn.py`, `test_esp_display_image.py`) and future admin tooling. Device auth is **not** Keycloak JWT (header token only).

## Related

- [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md)
- [EWA-COMPANION-QUICK-INTENTS.md](EWA-COMPANION-QUICK-INTENTS.md) (Desktop chips; ESP intents are a separate display-safe set)
- Firmware README under `ESPEliteEW/.../esp32_s3_zvs_box/README.md`
