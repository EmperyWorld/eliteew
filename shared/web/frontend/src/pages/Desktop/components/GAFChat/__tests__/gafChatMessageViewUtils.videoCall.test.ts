/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for GAF Chat video-call row metadata helpers.
 *
 * Invariants:
 * - Only metadata with kind video_call_event and known event names parse.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/gafChatMessageViewUtils.ts
 */
import { describe, expect, it } from 'vitest';
import {
	formatGafCallDuration,
	getVideoCallEventMeta,
} from '../gafChatMessageViewUtils';

describe('getVideoCallEventMeta', () => {
	it('returns null for non video_call_event metadata', () => {
		expect(getVideoCallEventMeta({ kind: 'other' })).toBeNull();
		expect(getVideoCallEventMeta(null)).toBeNull();
	});

	it('parses ended event with duration', () => {
		expect(
			getVideoCallEventMeta({
				kind: 'video_call_event',
				event: 'ended',
				duration_seconds: 125,
			})
		).toEqual({
			event: 'ended',
			durationSeconds: 125,
			missedReason: null,
		});
	});
});

describe('formatGafCallDuration', () => {
	it('formats sub-hour durations as m:ss', () => {
		expect(formatGafCallDuration(125)).toBe('2:05');
	});

	it('formats hour-plus durations with hours segment', () => {
		expect(formatGafCallDuration(3661)).toBe('1:01:01');
	});
});
