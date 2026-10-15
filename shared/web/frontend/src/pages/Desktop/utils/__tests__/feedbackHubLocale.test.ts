/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub locale date formatting.
 */

import { describe, expect, it } from 'vitest';
import { formatFeedbackListDate } from '../feedbackHubLocale';

describe('formatFeedbackListDate', () => {
	it('formats valid ISO timestamps', () => {
		const formatted = formatFeedbackListDate('2026-06-08T12:30:00.000Z', 'en');
		expect(formatted).toBeTruthy();
		expect(formatted).not.toBe('2026-06-08T12:30:00.000Z');
	});

	it('returns raw input when date is invalid', () => {
		expect(formatFeedbackListDate('not-a-date', 'en')).toBe('not-a-date');
	});
});
