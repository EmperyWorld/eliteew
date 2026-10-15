/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for marketing-cabinet foundation query gating.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - marketingCabinetFoundationGating.ts
 */
import { describe, expect, it } from 'vitest';

import {
	MARKETING_FOUNDATION_COMPANIES_SETUP_VIEWS,
	MARKETING_FOUNDATION_PROJECTS_SKIP_VIEWS,
	marketingCabinetShouldFetchCompaniesList,
	marketingCabinetShouldFetchFoundationCompanyStub,
	marketingCabinetShouldFetchFoundationProjectStub,
	marketingCabinetShouldFetchProjectsList,
} from '../marketingCabinetFoundationGating';

describe('marketingCabinetShouldFetchCompaniesList', () => {
	it('fetches on setup tabs', () => {
		for (const view of MARKETING_FOUNDATION_COMPANIES_SETUP_VIEWS) {
			expect(
				marketingCabinetShouldFetchCompaniesList(view, 'co-1', false)
			).toBe(true);
		}
	});

	it('defers on jtbd when company already selected until engage', () => {
		expect(
			marketingCabinetShouldFetchCompaniesList('jtbd', 'co-1', false)
		).toBe(false);
		expect(marketingCabinetShouldFetchCompaniesList('jtbd', 'co-1', true)).toBe(
			true
		);
	});

	it('bootstraps when no company selected', () => {
		expect(
			marketingCabinetShouldFetchCompaniesList('segments', null, false)
		).toBe(true);
	});
});

describe('marketingCabinetShouldFetchProjectsList', () => {
	it('returns false without company', () => {
		expect(marketingCabinetShouldFetchProjectsList(null, 'projects')).toBe(
			false
		);
		expect(marketingCabinetShouldFetchProjectsList('', 'jtbd')).toBe(false);
	});

	it('does not fetch on companies tab', () => {
		for (const view of MARKETING_FOUNDATION_PROJECTS_SKIP_VIEWS) {
			expect(marketingCabinetShouldFetchProjectsList('co-1', view)).toBe(false);
		}
	});

	it('fetches on projects and working sections', () => {
		expect(marketingCabinetShouldFetchProjectsList('co-1', 'projects')).toBe(
			true
		);
		expect(marketingCabinetShouldFetchProjectsList('co-1', 'jtbd')).toBe(true);
		expect(marketingCabinetShouldFetchProjectsList('co-1', 'overview')).toBe(
			true
		);
	});
});

describe('foundation stub fetches', () => {
	it('company stub when list deferred', () => {
		expect(
			marketingCabinetShouldFetchFoundationCompanyStub('co-1', false)
		).toBe(true);
		expect(marketingCabinetShouldFetchFoundationCompanyStub('co-1', true)).toBe(
			false
		);
		expect(marketingCabinetShouldFetchFoundationCompanyStub(null, false)).toBe(
			false
		);
	});

	it('project stub on companies tab', () => {
		const fetchList = marketingCabinetShouldFetchProjectsList(
			'co-1',
			'companies'
		);
		expect(fetchList).toBe(false);
		expect(
			marketingCabinetShouldFetchFoundationProjectStub('pr-1', fetchList)
		).toBe(true);
		expect(
			marketingCabinetShouldFetchFoundationProjectStub(
				'pr-1',
				marketingCabinetShouldFetchProjectsList('co-1', 'jtbd')
			)
		).toBe(false);
	});
});
