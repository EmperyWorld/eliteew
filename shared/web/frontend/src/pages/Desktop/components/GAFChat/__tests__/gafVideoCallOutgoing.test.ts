/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for localized GAF video-call ended/missed toast helper.
 *
 * Related:
 * - gafVideoCallOutgoing.ts
 */
import { describe, expect, it } from 'vitest';
import { createGafChatTFunction } from '../../../__fixtures__/desktopTestHelpers';
import { videoCallMissedToastMessage } from '../gafVideoCallOutgoing';

describe('videoCallMissedToastMessage', () => {
	const t = createGafChatTFunction();

	it('maps missed reason through i18n keys', () => {
		expect(videoCallMissedToastMessage('no_answer', 'missed', t)).toBe(
			'i18n:videoCallEvent.missedReason.no_answer'
		);
		expect(t).toHaveBeenCalledWith('videoCallEvent.missedReason.no_answer');
		expect(
			videoCallMissedToastMessage('callee_mobile_unreachable', 'missed', t)
		).toBe('i18n:videoCallEvent.missedReason.callee_mobile_unreachable');
	});

	it('falls back to missed event label for unknown reason', () => {
		expect(videoCallMissedToastMessage('unknown', 'missed', t)).toBe(
			'i18n:videoCallEvent.missed'
		);
	});

	it('returns ended toast when status is not missed', () => {
		expect(videoCallMissedToastMessage(undefined, 'ended', t)).toBe(
			'i18n:videoCallEndedToast'
		);
	});
});
