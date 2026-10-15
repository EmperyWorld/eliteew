import { describe, expect, it } from 'vitest';

import {
	MARKETING_DASHBOARD_BUNDLE_LOAD_VIEWS,
	MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS,
	marketingCabinetShouldLoadProjectDashboard,
	marketingCabinetShouldPollActiveAiRuns,
} from '../marketingCabinetDashboardGating';

describe('marketingCabinetShouldLoadProjectDashboard', () => {
	it('returns false without a selected project', () => {
		expect(marketingCabinetShouldLoadProjectDashboard(null, 'overview')).toBe(
			false
		);
		expect(marketingCabinetShouldLoadProjectDashboard('', 'jtbd')).toBe(false);
	});

	it('loads dashboard only on overview views', () => {
		for (const view of MARKETING_DASHBOARD_BUNDLE_LOAD_VIEWS) {
			expect(marketingCabinetShouldLoadProjectDashboard('proj-1', view)).toBe(
				true
			);
		}
		expect(
			marketingCabinetShouldLoadProjectDashboard('proj-1', 'segments')
		).toBe(false);
		expect(marketingCabinetShouldLoadProjectDashboard('proj-1', 'jtbd')).toBe(
			false
		);
		expect(marketingCabinetShouldLoadProjectDashboard('proj-1', 'imc')).toBe(
			false
		);
	});

	it('skip views do not load dashboard', () => {
		for (const view of MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS) {
			expect(marketingCabinetShouldLoadProjectDashboard('proj-1', view)).toBe(
				false
			);
		}
	});
});

describe('marketingCabinetShouldPollActiveAiRuns', () => {
	it('returns false without project', () => {
		expect(marketingCabinetShouldPollActiveAiRuns(null, 'jtbd')).toBe(false);
	});

	it('does not poll on skip views', () => {
		for (const view of MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS) {
			expect(marketingCabinetShouldPollActiveAiRuns('proj-1', view)).toBe(
				false
			);
		}
	});

	it('polls on jtbd and segments', () => {
		expect(marketingCabinetShouldPollActiveAiRuns('proj-1', 'jtbd')).toBe(true);
		expect(marketingCabinetShouldPollActiveAiRuns('proj-1', 'segments')).toBe(
			true
		);
	});
});
