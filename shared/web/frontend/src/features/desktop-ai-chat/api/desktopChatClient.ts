/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import facade for Desktop AI Chat client API (`./desktopChatClient/*`).
 *
 * Invariants:
 * - Public path re-export only (≤50 LOC); no apiClient/SSE body here.
 *
 * Related:
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-011)
 */

export type {
	DesktopAiAttachment,
	DesktopAiChatItem,
	DesktopAiChatMe,
	DesktopAiChatMember,
	DesktopAiChatParticipant,
	DesktopAiChatStreamLockPeek,
	DesktopAiMemoryCell,
	DesktopChatCapabilities,
	EnsembleBlueprintCommandItem,
	SoloSlotTariffsResponse,
} from './desktopAiChatOpenApi';

export * from './desktopChatClient/types';
export {
	classifyDesktopStreamError,
	formatDesktopStreamErrorBubble,
} from './desktopChatClient/streamErrors';
export * from './desktopChatClient/rest';
export { streamDesktopAiChat } from './desktopChatClient/stream';
