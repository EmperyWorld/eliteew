# Companion voice output and toggle session

Source checkpoint: 2026-10-11. This guide covers the companion's optional reply speech, microphone-to-text input and toggle session, with the gateway/client boundaries they call. It replaces the dated F5/CosyVoice/Silero deployment narrative; complete Live Voice, desktop command, transcription queue, model implementation, voice recording and production acceptance remain separate review scopes.

## Feature and local preference

The [backend flag](../../../shared/api/ewa_platform/companion/voice/config.py) reads `EWA_COMPANION_VOICE_ENABLED` with a false default. [Profile GET](../../../shared/api/ewa_platform/gateways/routers/companion_profile.py) exposes `voice_enabled`; the [frontend feature helper](../../../shared/web/frontend/src/features/ewa/ewaCompanionVoiceFeature.ts) requires exactly `true`. The composer passes that gate to the input, output and session hooks. The generic authenticated voice-gateway endpoints do not independently enforce the companion feature flag.

[Output preference](../../../shared/web/frontend/src/features/ewa/useEwaCompanionVoiceOutput.ts) defaults off and uses localStorage key `ewa_companion_voice_out.v1:<trimmed principal id>`, falling back to suffix `default`. Values `1` and `true` enable speech. Storage errors degrade to an off read or a failed best-effort write; they do not establish a server preference.

The hook reads the preference when its state initializes. It does not reload that state when the principal changes without a remount; DOC-CODE-155 records that bounded case. Generic hook calls default the feature option to enabled, but the actual companion composer passes the profile gate explicitly.

## Reply delivery and speech controls

[Composer wiring](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx) publishes a speech callback to the transcript/submit flow. The [submit helper](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSubmit.ts) invokes it for a sync reply or the final SSE reply. This path does not synthesize every incoming text delta.

The speaker button toggles the local preference while idle. Enabling it can force-speak the latest assistant reply. While playing, its handler calls `stopSpeaking()`. During synthesis the [rail](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionComposerVoiceRail.tsx) disables the button; the hook's explicit stop remains a separate callable operation.

Speech converts Markdown through [companionReplyToTtsPlainText](../../../shared/web/frontend/src/features/ewa/companionTtsPlainText.ts):

- Remove closed code fences; retain inline-code text and link labels.
- Strip common headings, emphasis, quote/list prefixes and table pipes; collapse whitespace.
- Cap at 1,200 JavaScript string units, cutting at a preceding space where possible. There is no two-sentence limit.
- Treat this as a text helper, not a complete Markdown renderer or a guarantee that every markup form survives meaningfully.

The hook submits the prepared text with persona voice, `speed: 1.0` and `maxChars: 1200`. The shared REST helper also caps its input. **The server's current legacy-named TTS client then cleans and truncates again to at most 500 Python characters.** A full 1,200-character frontend request is not a full spoken reply; DOC-CODE-148 records the additional truncation. Its Unicode cleaning also changes Russian `ё` and `й` after decomposition/mark removal (DOC-CODE-149). Provider speech quality was not measured.

Output state is `idle → synthesizing → playing → idle`. A `true` return from `speakAssistantReply` means the audio play promise resolved, not that playback finished. A naturally ended reply records the text/time for a roughly 60-second same-text auto-speech suppression; interrupted or failed playback does not set that marker. `force` bypasses the preference and this duplicate suppression, while the feature gate still applies.

Audio URLs pass through [resolveAudioUrlForPlayback](../../../shared/web/frontend/src/voice-core/utils/resolveAudioUrlForPlayback.ts). Inline data is decoded into a Blob URL, with a fetch fallback when direct decoding fails; unsuccessful data normalization throws. Non-data URLs pass through. Playback end/error/cleanup detaches handlers, pauses the element, revokes the Blob URL and unregisters its [global mic/TTS activity](../../../shared/web/frontend/src/voice-core/micActive.ts), which also drives music ducking.

Explicit `stopSpeaking()` advances the speech epoch so late synthesis/URL resolution cannot start that request's playback. Preference disable, feature-disable cleanup and output-hook unmount only clean current playback; they do not advance that epoch. Late speech can still start in those cases (DOC-CODE-150). No provider request cancellation or HTTP abort is implemented here. The composer ignores empty-text errors and rate-limits output error toasts to 12 seconds; permission/autoplay restrictions and playback/transport failure remain distinct failure paths.

## Microphone input

[Input hook](../../../shared/web/frontend/src/features/ewa/useEwaCompanionVoiceInput.ts) requests `getUserMedia({audio: true})` and starts MediaRecorder with 250 ms data events. It registers active microphone use once recording starts. It does not supply an explicit recording MIME option, voice-activity detector, automatic silence stop, duration cap or client file-size cap.

Input state is `idle → recording → transcribing → idle`. A stop click collects nonempty chunks, constructs a Blob with the recorder MIME type (fallback `audio/webm`), stops stream tracks and unregisters activity in the recorder stop callback. The upload filename is `ewa-companion.webm`; that name does not transcode a different recorder format.

The REST helper posts only multipart `file` to the synchronous gateway transcribe route. It does not add language/model query parameters. The hook trims the returned text and reports permission denied, start failure, empty recording, empty transcript or transcription failure as separate local error codes.

Outside a session, [composer mic handling](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx) appends a nonempty transcript to the draft, truncates it to the existing draft cap, focuses the input and marks the next reply for forced speech. It does not send that draft automatically. Its start/stop handler is gated by feature state, session state, pending chat, transcription and output activity.

Capture cleanup works for an already-held stream on unmount. It does not invalidate an outstanding permission request; a late permission success can create a new recorder after unmount (DOC-CODE-153). Feature-disable while the input hook stays mounted also leaves an existing capture active (DOC-CODE-154). Concurrent starts before the first permission response both observe idle and can overwrite stream/registration references (DOC-CODE-158). These are isolated hook findings; actual browser permission and hardware behavior were not exercised.

## Toggle voice session

[Session hook](../../../shared/web/frontend/src/features/ewa/useEwaCompanionVoiceSession.ts) coordinates the same input/output hooks and ordinary companion chat submission. It provides a manually toggled microphone session rather than a continuously running duplex, WebSocket or automatic-turn detector.

Entering a session saves the previous speech preference, enables voice output and marks the session active. The phase priority is: inactive → no phase; recording → listening; transcribing → recognizing; output synthesizing/playing → speaking; pending chat → thinking; otherwise ready. These labels are derived local states, not backend job progress.

The session microphone starts capture on one click. A second click awaits transcription, marks the next reply for forced speech, then submits a nonempty transcript through the ordinary companion chat callback. While active, the normal composer rail displays the text send control; the [session bar](../../../shared/web/frontend/src/features/ewa/EwaCompanionVoiceSessionBar.tsx) supplies the mic and hang-up controls.

Exiting stops output speech, marks the session inactive and restores the saved preference. The session's active unmount cleanup restores it too. It does not call a recording stop/discard operation. An in-progress recording therefore survives hang-up while its input hook stays mounted (DOC-CODE-151). A transcription already awaited by the mic handler can still trigger send/force-speech after exit because it does not recheck session state (DOC-CODE-152).

The computed mic-disabled flag includes pending chat and transcription. Output activity disables a new recording but permits the recording branch in the handler. Pending chat nevertheless disables the session bar's stop button even while recording; the handler's direct-call recording exception cannot overcome the disabled UI control (DOC-CODE-157). Do not describe session exit or button guards as complete capture/cancellation guarantees.

## Gateway contracts used by the companion

[Voice domain registration](../../../shared/api/domains/voice.py) includes the [voice-gateway router](../../../shared/api/routers/voice_gateway.py) at `/api/v1/voice-gateway`. The following two routes depend on `require_oauth2_user`; no administrator role is required by these route declarations. This source/ASGI review does not establish deployed OAuth, middleware or ingress behavior.

| Method and path | Input and local validation | Success and failure |
|---|---|---|
| `POST /transcribe` | Multipart `file`; MIME begins `audio/`; nonempty; at most 50 MiB after reading it. Optional `language` and `model` are query strings. | Text/language/duration/confidence/segments/timestamp response. Unsupported MIME or empty input: 400; oversized input: 413; caught service failure: 500 with its detail. The companion reads only text. |
| `POST /synthesize` | JSON text 1–5,000 characters; optional voice defaults to the contract profile; speed 0.5–2.0; volume 0–1.0. | Success returns a `data:audio/wav;base64,...` URL and null duration. Schema violations: 422; caught synthesis failure: 500. The companion helper requires an audio URL and uses its long HTTP timeout. |

The gateway passes volume to its service, but that service neither sends it to the TTS client nor adjusts returned audio. Zero and full volume requests therefore share the same provider payload (DOC-CODE-156). The companion helper sends text/voice/speed only; no independent volume UI is established by this guide.

The [STT service](../../../shared/api/services/voice/stt_service.py) forwards to its configured whisper-fast URL after FFmpeg conversion, trying WebM first and then 16 kHz mono raw PCM. Its conversion calls each have a 10-second subprocess timeout; the provider HTTP session has a 90-second total timeout. Its loaded URL comes from source configuration. Gateway `model` is not forwarded to STT or used to switch provider weights; the model actually loaded by the separately configured inference service determines that behavior. General codec compatibility and the full transcription subsystem remain pending.

The generic gateway also exposes voice catalog/health, queued transcription/status and full audio-process routes. The companion hooks above use the two synchronous routes, not queued transcription, `/process`, UGS or the separate Live Voice LLM pipeline. Their existence is not acceptance of those workflows.

## Voice IDs and provider resolution

[Frontend persona mapping](../../../shared/web/frontend/src/features/ewa/ewaCompanionSileroVoice.ts) reads the [bundled Qwen3 voice contract](../../../shared/web/frontend/src/data/qwen3_tts_voice_contract.json). The eight persona keys map to their corresponding `companion_*` profiles; unknown persona input falls back through the default parent mapping. The deprecated name `ewaPersonaSileroVoice` is an alias for this mapping, not a choice of a Silero model.

[Backend voice metadata](../../../shared/api/services/qwen3_tts_voices.py) loads an existing explicit contract/profile path first, then bundled API files, then the repository stack9 copies; loads are cached. Registered aliases such as `parent` and `xenia` resolve to profile IDs. Unknown IDs can pass through to the remote service. The three contract JSON copies were byte-identical at this checkpoint. File parity does not certify voice WAV content, audio quality or installed remote profiles.

[Gateway synthesis](../../../shared/api/services/voice_gateway_service.py) obtains the shared legacy-named [SileroService / Qwen3TtsHttpClient](../../../shared/api/services/voice/legacy_tts/silero_service.py), binds a URL, maps the voice and posts text/voice/speed/requested sample rate 48,000 to `/synthesize`. The [base HTTP client](../../../shared/api/services/base_http_tts_service.py) accepts nonempty audio or octet-stream response bytes, or legacy JSON `audio_base64`. The posted sample rate is not a check of the returned file's encoding.

[Endpoint resolver](../../../shared/api/services/voice/tts_endpoint_resolver.py) selects an enabled nonblank `generation_providers.silero` URL only, then falls back to `SILERO_SERVICE_URL` on no match or DB error. It caches a nonempty endpoint for 15 seconds. It does not select Piper, F5 or Qwen3 by policy-label priority. A blank resolution leaves an existing client URL unchanged; the client constructor has its own legacy F5 hostname fallback. The actual model behind the configured URL cannot be deduced from the row name or Python class name.

[Provider policy normalization](../../../shared/api/core/voice_provider_contract.py) maps several legacy labels to `cosyvoice3` and leaves `piper` separate. Gateway synthesis computes that normalization but does not use it to select this transport. Consequently the old “F5 default,” “CosyVoice canonical deployment” and “Silero GPU runtime” statements cannot serve as simultaneous current-runtime guarantees.

A catalog request can return source profile metadata even when a live profile lookup fails; that is not proof that every profile is available. Use [production topology](../../platform/PRODUCTION-TOPOLOGY-STATE.md#current-2026-07-30--living) for dated living placement. No restart commands, current GPU/VRAM numbers, license/commercial assertions or model quality preset are established by this bounded companion audit.

## Verification and outstanding scope

Seven existing backend flag/resolver tests and seventeen frontend text/voice-contract/session-phase/rail/playback-URL tests passed. The phase/rail tests do not cover capture or speech races. Actual transformed hooks with fake React state/effects, Audio, MediaRecorder, permission/STT/TTS and storage reproduced the lifecycle findings and verified explicit-stop/empty-transcript controls. Actual TTS service and async ASGI probes with fake authentication/provider/endpoint boundaries verified the 500-character cap, Cyrillic changes, volume no-op and HTTP validation.

[CODE_ISSUES.md](../../../docs/CODE_ISSUES.md) records DOC-CODE-148–158 separately; no application fix is included. No real microphone, browser playback, provider, model, DB, broker, deployed KB, recording asset or production service was touched. The F5 historical recipes were removed from this active guide; this companion document retains a useful distinct contract and was rewritten in place.

## Related

- [Desktop voice commands](../desktop/DESKTOP-VOICE-COMMAND-ON-DEMAND.md): independent detailed review pending.
- [API domains](../../api/API-ENTRY-POINTS-AND-DOMAINS.md).
- [Audit progress](../../../docs/DOCUMENTATION_PROGRESS.md).
