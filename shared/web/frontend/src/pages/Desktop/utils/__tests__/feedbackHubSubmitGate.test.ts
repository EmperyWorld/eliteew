/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub submit gate and quota helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	canSubmitFeedback,
	formatFeedbackRewardCredits,
	getFeedbackSubmitBlockReason,
	hasVisibleFeedbackReward,
	isFeedbackQuotaNearLimit,
} from '../feedbackHubSubmitGate';

describe('feedbackHubSubmitGate', () => {
	it('returns block reasons in priority order', () => {
		expect(
			getFeedbackSubmitBlockReason({
				bodyTrimmed: 'text',
				overLimit: false,
				kindQuotaBlocked: false,
				kind: 'wish',
				pending: true,
			})
		).toBe('pending');
		expect(
			getFeedbackSubmitBlockReason({
				bodyTrimmed: 'text',
				overLimit: true,
				kindQuotaBlocked: true,
				kind: 'bug',
				pending: false,
			})
		).toBe('quota_bug');
		expect(
			getFeedbackSubmitBlockReason({
				bodyTrimmed: '',
				overLimit: false,
				kindQuotaBlocked: false,
				kind: 'wish',
				pending: false,
			})
		).toBe('empty');
		expect(
			getFeedbackSubmitBlockReason({
				bodyTrimmed: 'ok',
				overLimit: false,
				kindQuotaBlocked: false,
				kind: 'wish',
				pending: false,
			})
		).toBe(null);
		expect(canSubmitFeedback(null)).toBe(true);
		expect(canSubmitFeedback('empty')).toBe(false);
	});

	it('detects near-limit quota and visible rewards', () => {
		expect(isFeedbackQuotaNearLimit(1, 2)).toBe(true);
		expect(isFeedbackQuotaNearLimit(2, 2)).toBe(false);
		expect(hasVisibleFeedbackReward(0.5)).toBe(true);
		expect(hasVisibleFeedbackReward(null)).toBe(false);
		expect(formatFeedbackRewardCredits(1.234)).toBe('1.23');
		expect(formatFeedbackRewardCredits(2)).toBe('2');
	});
});
