/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: Discussion live transport prefers SSE; poll only on degrade.
 *
 * Related:
 * - ../discussionLiveTransport.ts
 */
import { describe, expect, it } from 'vitest';
import {
	discussionAllowsIntervalPoll,
	discussionLiveMode,
	type DiscussionLiveStatus,
} from '../discussionLiveTransport';

const PAUSED: DiscussionLiveStatus[] = [
	'paused_checkpoint',
	'paused_user',
	'paused_goal',
	'paused_error',
	'completed',
	'cancelled',
];

describe('discussionLiveMode', () => {
	it('uses SSE for queued/running when the event stream is healthy', () => {
		expect(discussionLiveMode('queued', true)).toBe('sse');
		expect(discussionLiveMode('running', true)).toBe('sse');
		expect(discussionAllowsIntervalPoll('sse')).toBe(false);
	});

	it('falls back to poll only when queued/running and SSE is unhealthy', () => {
		expect(discussionLiveMode('running', false)).toBe('poll');
		expect(discussionAllowsIntervalPoll('poll')).toBe(true);
	});

	it('stays idle on paused/terminal statuses even if SSE looks healthy', () => {
		for (const status of PAUSED) {
			expect(discussionLiveMode(status, true)).toBe('idle');
			expect(discussionLiveMode(status, false)).toBe('idle');
		}
		expect(discussionLiveMode(null, true)).toBe('idle');
		expect(discussionAllowsIntervalPoll('idle')).toBe(false);
	});
});
