/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock device affinity for video_call.accepted → Meet open.
 *
 * Related:
 * - videoCallDeviceAffinity.ts
 */
import { describe, expect, it } from 'vitest';
import { shouldOpenDesktopMeetOnVideoCallAccepted } from '../videoCallDeviceAffinity';

describe('shouldOpenDesktopMeetOnVideoCallAccepted', () => {
	it('opens only when this session owns the outgoing call id', () => {
		const local = new Set(['call-a']);
		expect(shouldOpenDesktopMeetOnVideoCallAccepted(local, 'call-a')).toBe(
			true
		);
		expect(shouldOpenDesktopMeetOnVideoCallAccepted(local, 'call-b')).toBe(
			false
		);
	});

	it('rejects blank call ids', () => {
		expect(shouldOpenDesktopMeetOnVideoCallAccepted(new Set(['x']), '')).toBe(
			false
		);
		expect(shouldOpenDesktopMeetOnVideoCallAccepted(new Set(['x']), '  ')).toBe(
			false
		);
	});
});
