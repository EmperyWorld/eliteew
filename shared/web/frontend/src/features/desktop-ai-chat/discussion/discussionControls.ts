/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Discussion control visibility by session status.
 *
 * Invariants:
 * - Composer enabled on any paused_* awaiting Continue; document never auto-enabled from running.
 * - completed/cancelled must not block the normal chat composer (only queued/running do).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import type { DiscussionControlVisibility, DiscussionStatus } from './types';

/** True while /stream must stay blocked and the dock owns the turn. */
export function discussionBlocksNormalChatSend(
	status: DiscussionStatus | string | null | undefined
): boolean {
	const s = String(status || '');
	return s === 'queued' || s === 'running';
}

export function discussionControlVisibility(
	status: DiscussionStatus | string | null | undefined
): DiscussionControlVisibility {
	const s = String(status || '');
	const pausedDoc =
		s === 'paused_checkpoint' ||
		s === 'paused_goal' ||
		s === 'paused_user' ||
		s === 'paused_error' ||
		s === 'completed';
	const pausedAwaitingUser =
		s === 'paused_checkpoint' ||
		s === 'paused_goal' ||
		s === 'paused_user' ||
		s === 'paused_error';
	return {
		raiseHand: s === 'running' || s === 'queued',
		continue: pausedAwaitingUser,
		finish: s !== 'completed' && s !== 'cancelled' && s !== '',
		cancel: s !== 'completed' && s !== 'cancelled' && s !== '',
		generateDocument: pausedDoc,
		composerEnabled: pausedAwaitingUser,
	};
}
