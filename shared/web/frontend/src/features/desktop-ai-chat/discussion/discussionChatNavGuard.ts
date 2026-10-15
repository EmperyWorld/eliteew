/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure guard: Discussion setup is chat-scoped; switching chat while open needs confirm.
 *
 * Invariants:
 * - Same chat id never blocks; null/other targets block when setup is open for a chat.
 *
 * Related:
 * - DiscussionSetupSheet.tsx
 * - useDesktopAiChatAppCompose.ts
 */

export function shouldBlockChatSwitchForDiscussionSetup(opts: {
	discussionSetupOpen: boolean;
	discussionSetupChatId: string | null;
	targetChatId: string | null;
}): boolean {
	if (!opts.discussionSetupOpen) return false;
	const owner = opts.discussionSetupChatId?.trim() || null;
	if (!owner) return true;
	const target = opts.targetChatId?.trim() || null;
	return target !== owner;
}
