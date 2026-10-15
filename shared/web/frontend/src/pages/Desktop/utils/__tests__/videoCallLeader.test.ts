/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for video-call leadership visibility handoff and BC naming.
 *
 * Invariants:
 * - Hidden holder yields on request-leadership from another tab.
 * - Visible/self messages must not yield.
 *
 * Related:
 * - videoCallLeader.ts
 */

import { describe, expect, it } from 'vitest';
import {
	VIDEO_CALL_LEADER_BC,
	VIDEO_CALL_LEADER_STALE_MS,
	shouldYieldVideoCallLeadershipForVisibility,
} from '../videoCallLeader';

describe('videoCallLeader', () => {
	it('uses stable BroadcastChannel name', () => {
		expect(VIDEO_CALL_LEADER_BC).toBe('eliteew-video-call-leader-v1');
	});

	it('exposes stale window for heartbeat fallback', () => {
		expect(VIDEO_CALL_LEADER_STALE_MS).toBe(6000);
	});

	it('hidden holder yields when another tab requests leadership', () => {
		expect(
			shouldYieldVideoCallLeadershipForVisibility({
				documentHidden: true,
				holdingLeadership: true,
				messageType: 'request-leadership',
				fromTabId: 'other-tab',
				selfTabId: 'self-tab',
			})
		).toBe(true);
	});

	it('does not yield when document is visible', () => {
		expect(
			shouldYieldVideoCallLeadershipForVisibility({
				documentHidden: false,
				holdingLeadership: true,
				messageType: 'request-leadership',
				fromTabId: 'other-tab',
				selfTabId: 'self-tab',
			})
		).toBe(false);
	});

	it('does not yield for self request or when not holding', () => {
		expect(
			shouldYieldVideoCallLeadershipForVisibility({
				documentHidden: true,
				holdingLeadership: true,
				messageType: 'request-leadership',
				fromTabId: 'self-tab',
				selfTabId: 'self-tab',
			})
		).toBe(false);
		expect(
			shouldYieldVideoCallLeadershipForVisibility({
				documentHidden: true,
				holdingLeadership: false,
				messageType: 'request-leadership',
				fromTabId: 'other-tab',
				selfTabId: 'self-tab',
			})
		).toBe(false);
		expect(
			shouldYieldVideoCallLeadershipForVisibility({
				documentHidden: true,
				holdingLeadership: true,
				messageType: 'leader-alive',
				fromTabId: 'other-tab',
				selfTabId: 'self-tab',
			})
		).toBe(false);
	});
});
