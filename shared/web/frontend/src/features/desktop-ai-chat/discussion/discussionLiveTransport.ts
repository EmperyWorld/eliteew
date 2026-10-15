/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Discussion live-transport policy: SSE vs poll vs idle.
 *
 * Invariants:
 * - Happy path for queued/running is SSE, never interval poll.
 * - Poll is only a Redis/SSE degrade fallback.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 * - documentation/product/desktop/DESKTOP-AI-CHAT-GROUP-SURFACES-PLAN.md
 */

export type DiscussionLiveStatus =
	| 'queued'
	| 'running'
	| 'paused_checkpoint'
	| 'paused_user'
	| 'paused_goal'
	| 'paused_error'
	| 'completed'
	| 'cancelled';

export type DiscussionLiveMode = 'sse' | 'poll' | 'idle';

/** Interval poll only while `discussionLiveMode` is `poll` (SSE degrade). */
export const DISCUSSION_LIVE_POLL_INTERVAL_MS = 2500;

const ACTIVE_STATUSES = new Set<DiscussionLiveStatus>(['queued', 'running']);

export function discussionLiveMode(
	status: DiscussionLiveStatus | null | undefined,
	sseHealthy: boolean
): DiscussionLiveMode {
	if (status == null || !ACTIVE_STATUSES.has(status)) {
		return 'idle';
	}
	return sseHealthy ? 'sse' : 'poll';
}

export function discussionAllowsIntervalPoll(
	mode: DiscussionLiveMode
): boolean {
	return mode === 'poll';
}
