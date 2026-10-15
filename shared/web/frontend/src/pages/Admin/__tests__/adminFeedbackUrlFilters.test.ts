/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Feedback URL filter serialization.
 */

import { describe, expect, it } from 'vitest';
import {
	buildAdminFeedbackSearchParams,
	parseAdminFeedbackUrl,
} from '../adminFeedbackUrlFilters';

describe('adminFeedbackUrlFilters', () => {
	it('round-trips status and search', () => {
		const sp = buildAdminFeedbackSearchParams({
			ticketId: null,
			status: 'open',
			kind: 'bug',
			q: 'login',
			includeClosed: false,
		});
		expect(sp.get('section')).toBe('feedback');
		expect(sp.get('status')).toBe('open');
		expect(sp.get('kind')).toBe('bug');
		expect(sp.get('q')).toBe('login');
		const parsed = parseAdminFeedbackUrl(sp);
		expect(parsed?.status).toBe('open');
		expect(parsed?.kind).toBe('bug');
		expect(parsed?.q).toBe('login');
	});
});
