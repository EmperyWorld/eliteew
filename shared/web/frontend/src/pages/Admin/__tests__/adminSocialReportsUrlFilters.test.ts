/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * URL serialize/parse contract for Social Hub admin reports section.
 *
 * Related:
 * - ../adminSocialReportsUrlFilters.ts
 */

import { describe, expect, it } from 'vitest';
import {
	buildAdminSocialReportsSearchParams,
	parseAdminSocialReportsUrl,
} from '../adminSocialReportsUrlFilters';

describe('adminSocialReportsUrlFilters', () => {
	it('builds section=socialReports with report/status/q', () => {
		const sp = buildAdminSocialReportsSearchParams({
			reportId: 'abc',
			status: 'open',
			q: 'spam',
		});
		expect(sp.get('section')).toBe('socialReports');
		expect(sp.get('report')).toBe('abc');
		expect(sp.get('status')).toBe('open');
		expect(sp.get('q')).toBe('spam');
	});

	it('parses managed keys from search params', () => {
		const parsed = parseAdminSocialReportsUrl(
			new URLSearchParams('report=x&status=in_review&q=hi')
		);
		expect(parsed).toEqual({
			reportId: 'x',
			status: 'in_review',
			q: 'hi',
		});
	});

	it('returns null when no managed keys present', () => {
		expect(
			parseAdminSocialReportsUrl(new URLSearchParams('section=users'))
		).toBe(null);
	});
});
