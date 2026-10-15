/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock desktop outgoing join-poll helpers (awaiting gate + accept detection).
 *
 * Related:
 * - videoCallOutgoingJoinPoll.ts
 */
import { describe, expect, it } from 'vitest';
import { APIError } from '@/services/api/client';
import {
	isOutgoingJoinStillAwaiting,
	shouldTreatJoinAsAccepted,
} from '../videoCallOutgoingJoinPoll';

describe('shouldTreatJoinAsAccepted', () => {
	it('rejects awaiting_accept and blank join_url', () => {
		expect(
			shouldTreatJoinAsAccepted({
				awaiting_accept: true,
				join_url: 'https://meet.example/x',
				status: 'ringing',
			})
		).toBe(false);
		expect(
			shouldTreatJoinAsAccepted({
				awaiting_accept: false,
				join_url: '  ',
				status: 'active',
			})
		).toBe(false);
		expect(
			shouldTreatJoinAsAccepted({
				awaiting_accept: false,
				join_url: 'https://meet.example/x',
				status: 'ringing',
			})
		).toBe(false);
	});

	it('accepts active join with url', () => {
		expect(
			shouldTreatJoinAsAccepted({
				awaiting_accept: false,
				join_url: 'https://meet.example/x',
				status: 'active',
			})
		).toBe(true);
	});
});

describe('isOutgoingJoinStillAwaiting', () => {
	it('treats 409 awaiting as continue-poll', () => {
		expect(
			isOutgoingJoinStillAwaiting(
				new APIError('awaiting', 409, 'awaiting_callee_accept')
			)
		).toBe(true);
		expect(isOutgoingJoinStillAwaiting(new APIError('gone', 410))).toBe(false);
		expect(isOutgoingJoinStillAwaiting(new Error('network'))).toBe(false);
	});
});
