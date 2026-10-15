/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	PENDING_INCOMING_EMPTY_BACKOFF_AFTER,
	PENDING_INCOMING_EMPTY_BACKOFF_MS,
	PENDING_INCOMING_VIDEO_POLL_MS,
} from '../gafChatProviderTypes';
import { resolvePendingIncomingPollDelayMs } from '../usePendingIncomingVideoCallPoll';

describe('resolvePendingIncomingPollDelayMs', () => {
	it('uses base interval until empty streak threshold', () => {
		expect(resolvePendingIncomingPollDelayMs(0)).toBe(
			PENDING_INCOMING_VIDEO_POLL_MS
		);
		expect(
			resolvePendingIncomingPollDelayMs(
				PENDING_INCOMING_EMPTY_BACKOFF_AFTER - 1
			)
		).toBe(PENDING_INCOMING_VIDEO_POLL_MS);
	});

	it('backs off after consecutive empty responses', () => {
		expect(
			resolvePendingIncomingPollDelayMs(PENDING_INCOMING_EMPTY_BACKOFF_AFTER)
		).toBe(PENDING_INCOMING_EMPTY_BACKOFF_MS);
	});
});
