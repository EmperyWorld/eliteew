/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for local chat-list updates after guest leave (personal disappearance).
 *
 * Invariants:
 * - Mirrors delete-chat local teardown: remove row only; no server delete.
 *
 * Related:
 * - app/useDesktopAiChatAppShellActions.ts, DESKTOP-AI-CHAT-COLLABORATION.md
 */
import type { DesktopAiChatItem } from '../api/desktopChatClient';

/** Remove chat from sidebar list after guest leave (same UX as delete for that user). */
export function removeChatFromLocalList(
	chats: DesktopAiChatItem[],
	chatId: string
): DesktopAiChatItem[] {
	return chats.filter((c) => c.id !== chatId);
}
