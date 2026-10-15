/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Message id helpers for Desktop AI Chat (local optimistic vs persisted server ids).
 *
 * Invariants:
 * - Local optimistic ids use the `local-` prefix from the stream hook.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts, DesktopAiChatMessagesPane.tsx
 * ---
 */

export function isPersistedDesktopAiMessageId(id: string): boolean {
	return Boolean(id?.length) && !id.startsWith('local-');
}
