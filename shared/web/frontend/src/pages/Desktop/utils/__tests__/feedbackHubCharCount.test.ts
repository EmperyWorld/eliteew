/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub body length helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	isFeedbackBodyNearLimit,
	isFeedbackBodyOverLimit,
} from '../feedbackHubCharCount';
import { FEEDBACK_BODY_MAX } from '../feedbackHubConstants';

describe('feedbackHubCharCount', () => {
	it('detects over and near limit thresholds', () => {
		expect(
			isFeedbackBodyOverLimit(FEEDBACK_BODY_MAX + 1, FEEDBACK_BODY_MAX)
		).toBe(true);
		expect(isFeedbackBodyNearLimit(19_000, FEEDBACK_BODY_MAX)).toBe(true);
		expect(isFeedbackBodyNearLimit(1000, FEEDBACK_BODY_MAX)).toBe(false);
		expect(
			isFeedbackBodyNearLimit(FEEDBACK_BODY_MAX + 1, FEEDBACK_BODY_MAX)
		).toBe(false);
	});
});
