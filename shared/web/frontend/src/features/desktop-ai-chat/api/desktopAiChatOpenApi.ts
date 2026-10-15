/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OpenAPI SSOT aliases for Desktop AI Chat JSON + stream SSE doc
 * (/api/v1/desktop/ai-chat). Wave B2 JSON + Wave B5 `POST …/stream` /
 * Discussion `GET …/events` payload docs from desktop-openapi.
 *
 * Invariants:
 * - HTTP Out/In aliases track `components['schemas']` from `@/generated/desktop-openapi`.
 * - Message `metadata` may still be narrowed in the client as a FE view over the bag.
 * - Runtime SSE dispatch stays name-based in desktopChatClient; typed docs are SoT.
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - openapi/pilot/desktop.openapi.json
 * - api/schemas/desktop_ai_chat.py
 */

import type { components } from '@/generated/desktop-openapi';

type Schema = components['schemas'];

export type DesktopAiChatOut = Schema['DesktopAiChatOut'];
export type DesktopAiChatListOut = Schema['DesktopAiChatListOut'];
export type DesktopAiChatParticipantOut = Schema['DesktopAiChatParticipantOut'];
export type DesktopAiChatCapabilitiesOut =
	Schema['DesktopAiChatCapabilitiesOut'];
export type DesktopAiChatMeOut = Schema['DesktopAiChatMeOut'];
export type DesktopAiChatMemberOut = Schema['DesktopAiChatMemberOut'];
export type DesktopAiChatMemberListOut = Schema['DesktopAiChatMemberListOut'];
export type DesktopAiMemoryCellOut = Schema['DesktopAiMemoryCellOut'];
export type DesktopAiMemoryCellListOut = Schema['DesktopAiMemoryCellListOut'];
export type DesktopAiMessageOut = Schema['DesktopAiMessageOut'];
export type DesktopAiMessageListOut = Schema['DesktopAiMessageListOut'];
export type DesktopAiMessagesDeleteOut = Schema['DesktopAiMessagesDeleteOut'];
export type DesktopAiAttachmentOut = Schema['DesktopAiAttachmentOut'];
export type DesktopAiAttachmentListOut = Schema['DesktopAiAttachmentListOut'];
export type DesktopAiAttachmentUpsertOut =
	Schema['DesktopAiAttachmentUpsertOut'];
export type DesktopAiStreamLockPeekOut = Schema['DesktopAiStreamLockPeekOut'];
export type DesktopAiVerifyContextOut = Schema['DesktopAiVerifyContextOut'];
export type DesktopAiSoloSlotTariffsOut = Schema['DesktopAiSoloSlotTariffsOut'];
export type DesktopAiEffectiveSettingsOut =
	Schema['DesktopAiEffectiveSettingsOut'];
export type EnsembleBlueprintCommandItemOut =
	Schema['EnsembleBlueprintCommandItemOut'];
export type EnsembleBlueprintCommandsOut =
	Schema['EnsembleBlueprintCommandsOut'];
export type DesktopAiHeroCatalogEntryOut =
	Schema['DesktopAiHeroCatalogEntryOut'];
export type DesktopAiHeroCatalogOut = Schema['DesktopAiHeroCatalogOut'];

export type ChatCreateBody = Schema['ChatCreateBody'];
export type ChatPatchBody = Schema['ChatPatchBody'];
export type MemoryCellExtractBody = Schema['MemoryCellExtractBody'];
export type MemoryCellPatchBody = Schema['MemoryCellPatchBody'];
export type StreamBody = Schema['StreamBody'];
/** OpenAPI Wave B5 doc union for `POST …/chats/{id}/stream` `data:` JSON. */
export type DesktopAiChatStreamSsePayloadDoc =
	Schema['DesktopAiChatStreamSsePayloadDoc'];
export type DesktopAiChatStreamSseTokenOut =
	Schema['DesktopAiChatStreamSseTokenOut'];
export type DesktopAiChatStreamSseDoneOut =
	Schema['DesktopAiChatStreamSseDoneOut'];
export type DesktopAiChatStreamSseErrorOut =
	Schema['DesktopAiChatStreamSseErrorOut'];
export type AttachBody = Schema['AttachBody'];
export type SoloSlotPurchaseBody = Schema['SoloSlotPurchaseBody'];
export type InviteFriendBody = Schema['InviteFriendBody'];

/**
 * UI-compat aliases. Chat capabilities are Partial for FE ACL helpers / tests;
 * server enriched chats still send full maps.
 */
export type DesktopChatCapabilities = Partial<DesktopAiChatCapabilitiesOut>;
export type DesktopAiChatItem = Omit<DesktopAiChatOut, 'capabilities'> & {
	capabilities?: DesktopChatCapabilities | null;
};
export type DesktopAiChatParticipant = DesktopAiChatParticipantOut;
export type DesktopAiChatMe = DesktopAiChatMeOut;
export type DesktopAiChatMember = DesktopAiChatMemberOut;
export type DesktopAiChatStreamLockPeek = DesktopAiStreamLockPeekOut;
export type DesktopAiMemoryCell = DesktopAiMemoryCellOut;
export type DesktopAiAttachment = DesktopAiAttachmentOut;
export type EnsembleBlueprintCommandItem = EnsembleBlueprintCommandItemOut;
export type SoloSlotTariffsResponse = DesktopAiSoloSlotTariffsOut;
