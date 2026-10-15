# Image Studio

Desktop creative app for text-to-image, instruction edit, camera-angle change, and personal history. User-facing copy avoids operator jargon (`type_key`, Comfy, UGS internals).

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| `/api/v1/image-studio/*` product UI | UGS Hub / admin queue ops |
| Unified Content history (`source_service=image_studio`) | Professional Worlds photo-presets (separate surface) |
| Style presets + multi-variant generate (client) | Comfy iframe desktop app (retired) |

## Frontend layout (Wave 2+3)

| Path | Role |
|------|------|
| `shared/web/frontend/src/pages/ImageStudio/ImageStudioPage.tsx` | Orchestrator: tabs, API calls, handoffs, i18n hero |
| `…/workspaces/*` | Presentational tabs (text-to-image, edit, rotate, history) |
| `…/imageStudioApi.ts` | Idempotent POSTs, resize, download, `mapApiError` |
| `…/imageStudioHistory.ts` | History list + client tag filter |
| `src/i18n/locales/{ru,en}/imageStudio.json` | Namespace `imageStudio` |

## Product UX

- Hero: one job sentence (create / edit / new angle).
- Advanced (size / seed / negative) collapsed by default.
- Honest states: empty, loading (with energy line when known), error + retry, success with next steps (Edit / New angle).
- One primary CTA per tab.
- Style preset chips append a prompt suffix; last preset id in `localStorage` key `eliteew.imageStudio.stylePreset.v1`.
- Variants (2–4): sequential text-to-image with random seeds; gallery on canvas.
- History filters client-side by tags: `text_to_image` / `image_edit` / `rotate_image`.

## API contract (summary)

Generation runs in the **UGS queue worker** (Comfy/Llama on worker, not API `direct_inline`). Desktop uses **SSE** stream endpoints; legacy sync POST returns **410** with `stream_path`.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/image-studio/text-to-image/stream` | JSON SSE; `Idempotency-Key` header |
| POST | `/api/v1/image-studio/suggest-prompt/stream` | JSON SSE |
| POST | `/api/v1/image-studio/image-edit/stream` | multipart SSE; optional form `idempotency_key` + header |
| POST | `/api/v1/image-studio/image-edit-json/stream` | JSON base64 edit (integrations) |
| POST | `/api/v1/image-studio/image-rotate/stream` | multipart SSE; modes SSOT `api/services/image_studio/rotate_modes.py` |
| POST | `/api/v1/image-studio/text-to-image` (legacy) | **410** `image_studio_sync_retired` → use `/stream` |

**Idempotency:** body key wins over headers (`_idempotency_key_from_body_or_headers`). In-flight duplicate on stream attaches to existing `request_id`; completed replay returns cached result. See [UGS-IDEMPOTENCY.md](../platform/docker-re_doc/UGS-IDEMPOTENCY.md).

**402:** structured `detail: { code: "insufficient_credits", message }` → FE `imageStudio:errors.insufficientCredits`.

**UGS type_keys (queued):** `image_studio_text_to_image`, `image_studio_image_edit`, `image_studio_image_rotate`, `image_studio_image_prompt` — `skip_queue` removed (`20260902_image_studio_queue_enabled.sql`).

**Energy:** `useCreativeStudioUgsCosts` ← `GET /api/v1/ugs/types`.

**ComfyUI:** image gen/edit/rotate depend on prod API `COMFYUI_URL` → gpu141 `192.168.1.141:31003` ([PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current). Same graph as Site Studio / EWRP: **`01_top.json`** (z-image-turbo). If outputs become glitch / horizontal soup while HTTP still `success`, check Comfy VRAM on gpu141 and restart through the gpu141 Comfy host unit — canon [LAN-WORKERS-141.md](../platform/docker-re_doc/LAN-WORKERS-141.md).

**Prompt sanitization:** `suggest-prompt` and `text-to-image` strip Gemma/llama-server `<|channel>thought` / thinking wrappers (`strip_llm_channel_markup` + `strip_llm_thinking_prefix`) before the string reaches Comfy — otherwise CLIP receives control tokens and the image looks like digital garbage.

## Mobile

Android UGS Images uses `ImageStudioApi` for **text-to-image** and **image-edit** only. **Follow-up:** migrate mobile to `/stream` SSE or `POST /api/v1/ugs/generate` + poll — legacy sync POST now returns **410**. Rotate / suggest-prompt are **desktop Image Studio**. Contract tests: `pack-cloud/mobile/core/network/src/test/java/world/empery/mobile/core/network/ImageStudioApiContractsTest.kt`.

## Regression

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_image_studio.py -q
cd shared/web/frontend && pnpm exec vitest run src/pages/ImageStudio/
bash docker/scripts/image-studio-stack0-smoke.sh
```

Manual desktop: Создать → 402 with empty balance; success → handoff to Редактировать / Новый ракурс; Мои работы filter chips.

## Related

- [desktop/UGS-DESKTOP-SHELL.md](desktop/UGS-DESKTOP-SHELL.md) — creative studio energy / 402
- [GUIDED-TOUR-EXCURSION.md](GUIDED-TOUR-EXCURSION.md) — Image Studio tour
- Product card (partner-facing): [eliteew-product-card/ELITEEW-PRODUCT-CARD.md](eliteew-product-card/ELITEEW-PRODUCT-CARD.md) (research 27 soft-retired under `trash/` (id 20260812-150728))
- `api/routers/image_studio.py`, `api/services/image_studio/rotate_modes.py`
