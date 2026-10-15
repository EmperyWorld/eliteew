/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub list filter default state helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FEEDBACK_LIST_FILTER_STATE,
	isFeedbackListFiltersActive,
} from '../feedbackHubListFilterState';

describe('feedbackHubListFilterState', () => {
	it('detects active filters against defaults', () => {
		expect(
			isFeedbackListFiltersActive(DEFAULT_FEEDBACK_LIST_FILTER_STATE)
		).toBe(false);
		expect(
			isFeedbackListFiltersActive({
				...DEFAULT_FEEDBACK_LIST_FILTER_STATE,
				listQueryText: 'bug',
			})
		).toBe(true);
		expect(
			isFeedbackListFiltersActive({
				...DEFAULT_FEEDBACK_LIST_FILTER_STATE,
				kindFilter: 'wish',
			})
		).toBe(true);
	});
});
