# Companion: restore last message to draft

Source-backed frontend contract · reviewed 2026-10-11. Restore text replaces the composer draft with a selected user transcript line and focuses the textarea. It does not send a chat request. This is text recovery, not attachment recovery or replay of a previous turn.

## Selection and controls

[Coercion helpers](../../../shared/web/frontend/src/services/ewa/ewaCompanionChatCoerce.ts) parse a plain-object or JSON-string learned-preferences root/subtree at `desktop_friend_chat_v1.messages`. Only nonempty string user/assistant rows survive; user content is trimmed. The restore resolver scans backward for a nonempty user line in optimistic `pendingTurn` first, then in the loaded messages. It does not fetch additional history or search beyond the retained server transcript.

[Transcript display hook](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatTranscriptDisplay.ts) derives the selection and owns the handler:

- While `pending`, the handler returns without changing the draft.
- With a selected line, it calls `updateDraft(text)` and focuses the input. Existing draft text is replaced.
- Without a line, it reports `ewaCompanion.chatRestoreLastMessageEmpty` through the error notification. Normal UI disables the control in this state.

Both [desktop attach controls](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionComposerAttachButtons.tsx) and [mobile toolbar](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionMobileComposerToolbar.tsx) disable restore when `pending || !canRestoreLastMessage`, use `ewa-companion-restore-last-message`, and supply translated title/ARIA label. [Composer bundle](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx) connects both layouts. The chat panel delegates this logic to hooks/components; the helpers are re-exported by the API facade rather than implemented there.

The visible transcript uses the latest assistant reply or optimistic assistant reply; it does not render user bubbles. Restore is a composer control. A non-null optimistic turn can remain after the HTTP request finishes until its user/assistant pair exactly matches the loaded transcript.

## Draft storage and image limitation

[Orchestration base](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatOrchestrationBase.ts) updates React draft state and calls [draft storage helpers](../../../shared/web/frontend/src/services/ewa/ewaCompanionChatMessageApi.ts). The key is `eliteew.ewaCompanion.chatDraft.v1::{trimmedPrincipalId}` in browser `localStorage`. Storage read/write is best effort; saved/read text is capped at 8000 characters. Blank saved text removes the key. This is local per-principal browser state, not server draft synchronization; `updateDraft` itself does not cap its in-memory argument.

Current image behavior differs from the intended text-only recovery. [Submit hook](../../../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSubmit.ts) uses localized image labels in optimistic user content, while [backend history](../../../shared/api/ewa_platform/companion/turn/vision_attachment.py) stores `[Изображение]`. Restore does not remove either marker. Image-only turns can therefore produce a nonempty synthetic draft, and image-plus-text can restore the marker too. The mismatch also prevents exact optimistic-echo clearing after profile reload: [DOC-CODE-033](../../../docs/CODE_ISSUES.md#doc-code-033--image-turn-labels-break-echo-clearing-and-text-only-restore).

No image bytes/attachment are restored by the handler. It does not clear or repopulate a currently attached image. Do not document image-only recovery as an assured “no text” notification until this behavior is corrected in a separately authorized code change.

## Verification

Existing transcript/storage extraction, pending-turn, desktop footer and mobile toolbar suites passed within the 33-test frontend selection for this iteration. They cover helper priority, draft isolation, echo and control rendering; they do not establish complete browser/API acceptance. An isolated probe evaluated the actual pure helper definitions from source and confirmed marker recovery and false echo matching for image-only/image-plus-text examples; no HTTP/storage service was used.

For manual acceptance with an authorized local test account: send a text message, wait until idle, restore, and verify the old text replaces the draft without sending. Repeat with an existing draft, blank history, pending request, image-only and image-plus-text. The last two currently expose the logged limitation; manual smoke was not executed here.

See [chat phases](EWA-COMPANION-CHAT-TURN-PHASES.md), [profile/history contract](EWA-COMPANION-PROFILE-ADR.md) and [user workflows](EWA-COMPANION-USER-WORKFLOWS.md). Linked documents have independent review status.
