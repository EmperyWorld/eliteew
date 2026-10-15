/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import facade for Desktop AI Chat SSE stream hook; implementation
 * lives under hooks/desktopAiChatStream/.
 *
 * Invariants:
 * - DesktopAiChatApp and tests import this path only; no behavior here.
 *
 * Related:
 * - hooks/desktopAiChatStream/useDesktopAiChatStream.ts
 */
export { useDesktopAiChatStream } from './desktopAiChatStream/useDesktopAiChatStream';
export type {
	LastFailedSendState,
	UseDesktopAiChatStreamParams,
} from './desktopAiChatStream/types';
