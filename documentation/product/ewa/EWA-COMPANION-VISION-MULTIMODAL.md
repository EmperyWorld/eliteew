# Companion image attachments: OCR and multimodal analysis

A companion chat turn can carry one JPEG, PNG or WebP attachment together with text, or without text. The server either extracts text through Stack4 OCR or injects the image into the main chat model. This is the analysis input path; image generation/editing has separate tools and provider contracts.

Source review: 2026-10-11. This guide replaces dated model/host/VRAM and deployment claims. Actual inference placement belongs to [production topology §Current](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living). No live model, OCR service, database or browser was exercised in this review.

## Source ownership

- [Attachment validation and message injection](../../../shared/api/ewa_platform/companion/turn/vision_attachment.py) and [format contract](../../../shared/api/ewa_platform/companion/contracts/vision_formats.py): MIME, base64, magic-prefix/size checks and current-turn multimodal content.
- [OCR adapter](../../../shared/api/ewa_platform/companion/turn/companion_image_ocr_analyze.py) and bounded [Stack4 gateway](../../../shared/api/services/stack4/document_gateway.py): attachment decoding, OCR call and prompt-only OCR context.
- [Turn entry](../../../shared/api/ewa_platform/companion/turn/phases/turn_entry.py), [bootstrap](../../../shared/api/ewa_platform/companion/turn/phases/turn_bootstrap.py), [main preparation](../../../shared/api/ewa_platform/companion/turn/phases/main_llm_prepare.py) and [sync/stream entry](../../../shared/api/ewa_platform/companion/turn/chat_turn.py): phase selection, transcript marker, routing and LLM inputs.
- [HTTP schema](../../../shared/api/ewa_platform/schemas/pydantic/companion_chat.py) and [chat router](../../../shared/api/ewa_platform/gateways/routers/companion_chat.py): typed request and channel-specific error handling.
- [Client reader](../../../shared/web/frontend/src/features/ewa/companionImageAttachment.ts), [client formats](../../../shared/web/frontend/src/features/ewa/companionVisionFormats.ts), composer/submit hooks and preview: file selection, local object URL and wire attachment.

## Request and validation

Both `POST /api/v1/ewa/companion-chat/message` and `POST /api/v1/ewa/companion-chat/stream` accept `CompanionChatMessageIn`, using shared OAuth/content-owner/session dependencies and the EWA pool. They do not expose a separate vision endpoint. The full reply/SSE contract belongs to the [chat-turn guide](EWA-COMPANION-CHAT-TURN-PHASES.md).

Optional `image_attachment` has required snake-case `mime_type` (1–64 characters) and `data_base64` (1–6,000,000 characters). `message` defaults to empty, with an HTTP maximum of 12,000 characters; at least nonblank message or an attachment is required. Turn entry further truncates the text to 8,000 characters. The schema validates field shapes/lengths; image semantics are validated later in turn resolution after profile lookup.

Normal client wire payload:

```json
{
  "message": "Read the visible text in this screenshot.",
  "image_attachment": {
    "mime_type": "image/png",
    "data_base64": "<base64 image bytes>"
  }
}
```

The placeholder is illustrative, not a valid request fixture. Send the actual file bytes. The public schema requires snake-case fields; the internal resolver also tolerates camel-case mappings. The resolver accepts raw base64 or a `data:image/...;base64,...` value. In the data-URL branch the embedded MIME takes precedence over the separate MIME field.

Allowed canonical MIME values are `image/jpeg`, `image/png` and `image/webp`; GIF/BMP/HEIC/SVG/TIFF are rejected. Strict base64 decoding is followed by a best-effort magic-prefix check: JPEG prefix, PNG signature, or RIFF/WEBP markers. Raw-base64 MIME must match detected magic; data-URL MIME must match it as well. These prefix checks are not full image decoding, dimension/pixel-count validation or animation analysis. Decoded payloads above **4 MiB** are rejected after decoding; this is distinct from the schema's encoded-character bound.

Relevant resolver errors include `companion_vision_disabled`, `companion_vision_data_required`, `companion_vision_mime_not_allowed`, `companion_vision_invalid_data_url`, `companion_vision_invalid_base64`, `companion_vision_unsupported_format`, `companion_vision_magic_mismatch` and `companion_vision_too_large`. Framework schema failures use `422`. The sync route maps turn `ValueError` to `400` with its string detail, except missing profile (`404`). The stream emits an `error` code from turn resolution after the SSE response has opened; it does not turn that semantic failure into an ordinary HTTP `400`. Pool/profile/LLM gate and terminal-wrapper behavior retain their shared owners.

## Mode and settings

The reviewed settings catalog defines:

| Setting | Source default | Consumer behavior |
|---|---|---|
| `EWA_COMPANION_VISION_ENABLED` | `1` | Attachment gate; false tokens `0/false/no/off` disable it |
| `EWA_COMPANION_VISION_MULTIMODAL` | `0` | `1/true/yes/on` selects multimodal instead of OCR |
| `EWA_COMPANION_VISION_OCR_LANG` | `rus+eng` | OCR language, with blank falling back to `rus+eng` |

Consumers use [ewa_getenv](../../../shared/api/ewa_platform/settings/access.py): present values in the process-local DB-backed cache win, then process environment, then the consumer default. Catalog defaults and local cache updates are not evidence that a deployed service or every worker has identical state. See [settings ownership](EWA-PLATFORM-SETTINGS-DB.md).

Multimodal selection assumes the configured chat backend accepts image content. It does not inspect model capabilities, probe a projector or automatically switch back to OCR on a model rejection. The checked-in [stack2 command](../../../docker/stack/stack2.yml) supplies `--mmproj /models/${LLAMA_CHAT_MMPROJ_FILE:-mmproj-BF16.gguf}` and `--image-max-tokens ${LLAMA_CHAT_IMAGE_MAX_TOKENS:-512}`. That source command is not proof of a running projector or a specific deployed model. Its `:-` substitution supplies the default for an empty variable; an empty `LLAMA_CHAT_MMPROJ_FILE` alone does not turn this command into `--no-mmproj`. Deployment changes require their separately reviewed operator procedure.

## Turn flow and persistence

Resolution first normalizes the text/shell context. With no attachment it retains the text-only path. With an attachment, the vision-enabled gate applies; multimodal mode resolves a data URL, while default OCR mode decodes and calls OCR before later grounding/dedup phases.

Both modes mark `has_image_attachment`. After dedup lookup, turn-entry deterministic/intake routing is bypassed for that turn. Bootstrap also skips ordinary task orchestration when an attachment is present. Trust/mode/affective work and the intent-planner fetch may still occur; this is not a promise that all sidecars/planning/optional grounding disappear. Consequently a public attached turn does not reach the ordinary image-tool orchestration branch merely because its text requests an edit. Direct/provider image-edit behavior requires the separate image-generation review.

The stored user history contains trimmed user text plus `[Изображение]`, or that marker alone. These helpers do not store base64 or full OCR output in `desktop_friend_chat_v1`. Later turns cannot reconstruct the original attachment from this marker. This bounded storage statement does not establish all downstream logging, transport or retention behavior.

Multimodal preparation replaces the latest user row with a text part and `image_url` data URL, or appends it if no user row exists. Empty text uses the Russian fallback `Опиши изображение.`. An added system directive asks the model to answer about the current image rather than recycle previous descriptions. The shared OpenAI-compatible message normalizer preserves user content arrays and image parts. Correct visual analysis still depends on the backend/model and was not measured here.

OCR mode appends a prompt-only context block to the current user line and adds an OCR-mode directive. It uses a Russian fallback request when the user text is empty, caps recognized text at 12,000 characters through the shared truncation helper, and leaves stored history with the image marker. This is text extraction followed by a text-model answer, rather than pixel-level interpretation.

## OCR service and failure boundaries

The adapter derives `companion-attach.jpg/png/webp`, passes configured OCR language and calls `Stack4DocumentGateway.ocr_image_to_text`. The inspected gateway posts multipart file plus `lang` to the configured Tesseract `/recognize`, with a **120-second per-request timeout**. It checks status, reads the JSON `text` field and strips it. This timeout is not a deadline for the whole chat turn.

Caught `Stack4ServiceUnavailable` and other call exceptions return an empty string and log a warning. Turn resolution then uses the same marker as a successful no-text result: “text on the image was not found,” alongside the pixel-vision limitation. This conflates unread OCR with empty OCR (`DOC-CODE-131`). Gateway construction happens before that try boundary, so a factory/settings exception can escape resolution and the inner stream's early `ValueError` catch (`132`). The outer stream wrapper has separate terminal behavior; this finding does not prove a deployed connection drop.

The default mode therefore cannot promise a description of objects in a textless photo. Its prompt asks for an honest pixel-vision limitation. A transport/service failure also cannot justify an assertion that the image contains no text. Preserve this distinction in interpretation until the implementation carries separate OCR statuses.

## Client selection, preview and submission

[Composer shell](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionComposerShell.tsx) uses a single hidden file input with JPEG/PNG/WebP accept values and disables it during a pending turn. The reader accepts either allowed browser MIME or a recognized `.jpg/.jpeg/.png/.webp` suffix, checks the 4 MiB file-size bound, reads through `FileReader.readAsDataURL` and allocates an object URL for the pending preview.

The suffix fallback does not establish valid bytes; server magic validation is still authoritative. The reader currently uses `file.type || 'image/jpeg'`, so a PNG/WebP whose browser type is empty is accepted by extension but labeled JPEG and rejected by the server (`DOC-CODE-130`). It does not infer MIME from extension/magic at that point.

The [composer bundle](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx) selects the first file, resets the input, replaces the pending image and revokes the previous preview URL. Its catch displays unsupported-format specifically and otherwise uses the too-large message, including reader failures. The [base hook](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatOrchestrationBase.ts) revokes preview URLs on clear/unmount. There is no image-read generation guard in the inspected selection callback; this source review does not certify races/unmount resource handling.

The [submit hook](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSubmit.ts) reads the pending image alongside trimmed text, permits an image-only turn and supplies both in the same stream body. A sync fallback uses the same image and client-turn id. Successful processing clears text/attachment and refreshes state; a thrown send error keeps the draft/attachment through the reviewed catch. The local echo uses an image label, rather than a persisted transcript thumbnail.

Dedicated OCR instrument/`ocr-turn` and generated-image operations have distinct owners. This review does not establish clipboard paste, multiple attachments, persistent thumbnails, audio/video multimodal or image-edit provider acceptance from the attach control.

## Verification and limits

Existing backend attachment/format/OCR suites: **18 passed**. Actual synthetic probes exercised disabled gating and data-URL MIME precedence; a fake OCR transport error yielded the empty-text claim, and a fake gateway-factory RuntimeError escaped resolution and the inner public stream with zero emitted events. No OCR/network/model/DB call was made by those probes.

An actual client-reader/format helper probe used Node's built-in TypeScript stripping with a fake FileReader/object URL. A type-empty PNG was accepted and serialized as JPEG; the actual backend resolver rejected matching PNG bytes with that wire MIME. This proves the helper contract, rather than real browser MIME behavior on a particular device.

The existing client attachment suite passed **5 tests** through a direct Vitest run. These tests use a DOM/FileReader environment and test helper behavior; they do not establish server byte validation, mounted composer submission or live OCR/model quality. A package-manager invocation/recovery incident is recorded in [audit progress](../../../docs/DOCUMENTATION_PROGRESS.md), including restoration of the existing locked local dependencies without manifest/lockfile changes.

## Related documentation

- [Chat turn phases and HTTP/SSE](EWA-COMPANION-CHAT-TURN-PHASES.md)
- [Image generation and editing](EWA-COMPANION-IMAGE-GENERATION.md)
- [Settings catalog and cache](EWA-PLATFORM-SETTINGS-DB.md)
- [Tool/surface extension and grounding](EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md)
- [Code issues](../../../docs/CODE_ISSUES.md), including `DOC-CODE-130–132`
