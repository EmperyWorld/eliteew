/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect Discussion anchor chat rows (empty assistant stubs) vs visible messages.
 *
 * Invariants:
 * - Anchors carry `metadata.desktop_discussion`; they must not render as empty bubbles.
 *
 * Related:
 * - buildMessageListWithDays.ts
 * - useDiscussionSession.ts
 */
import type { DesktopAiMessage } from '../api/desktopChatClient';

export function isDesktopDiscussionAnchorMessage(
	message: DesktopAiMessage
): boolean {
	return message.metadata?.desktop_discussion === true;
}

/** Newest discussion session id referenced by chat message anchors, if any. */
export function latestDiscussionSessionIdFromMessages(
	messages: readonly DesktopAiMessage[]
): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const row = messages[i];
		if (!isDesktopDiscussionAnchorMessage(row)) continue;
		const raw = row.metadata?.discussion_session_id;
		if (typeof raw === 'string' && raw.trim()) return raw.trim();
	}
	return null;
}
