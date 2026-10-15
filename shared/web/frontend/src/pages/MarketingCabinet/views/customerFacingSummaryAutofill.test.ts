import { describe, expect, it } from 'vitest';

import type {
	MarketingProjectDashboard,
	MarketingProjectSummary,
} from '../marketingCabinetApi';
import {
	buildCustomerSummaryAutofillAll,
	buildCustomerSummaryAutofillBasics,
	buildCustomerSummaryAutofillBullets,
	buildCustomerSummaryAutofillMetrics,
} from './customerFacingSummaryAutofill';

const baseProject: MarketingProjectSummary = {
	id: 'p1',
	company_id: 'c1',
	name: 'Alpha',
	slug: 'alpha',
};

const baseCounts: MarketingProjectDashboard['counts'] = {
	jtbd: 0,
	value_propositions: 0,
	swot: 0,
	competitors: 0,
	researches: 0,
	content: 0,
	segments: 0,
	campaigns: 0,
	funnels: 0,
	tasks: 0,
	alerts: 0,
	ai_runs: 0,
	open_alerts: 0,
	critical_alerts: 0,
};

function minimalDashboard(
	over: Partial<Omit<MarketingProjectDashboard, 'project'>> & {
		project?: Partial<MarketingProjectSummary>;
	} = {}
): MarketingProjectDashboard {
	const { project: pOver, counts: cOver, ...rest } = over;
	return {
		project: { ...baseProject, ...pOver },
		counts: { ...baseCounts, ...cOver },
		readiness_score: 0,
		strategy_integrity_score: 0,
		strategy_integrity: [],
		strategy_integrity_issues: [],
		issue_remediation: [],
		freshness: [],
		gaps: [],
		highlights: [],
		recommended_actions: [],
		activity_feed: [],
		recent_content: [],
		recent_researches: [],
		segments: [],
		campaigns: [],
		funnels: [],
		tasks: [],
		alerts: [],
		ai_runs: [],
		job_stories: [],
		value_propositions: [],
		competitors: [],
		researches: [],
		content: [],
		coverage: [],
		...rest,
	} as MarketingProjectDashboard;
}

describe('buildCustomerSummaryAutofillBasics', () => {
	it('builds headline with company and intro from description and goals', () => {
		const d = minimalDashboard({
			project: {
				name: 'Project X',
				slug: 'px',
				company_name: 'ACME',
				description: 'First line.',
				goals: 'Grow revenue.',
				key_tasks: 'Launch Q2.',
			},
		});
		const { headline, intro } = buildCustomerSummaryAutofillBasics(d, '—');
		expect(headline).toBe('Project X — ACME');
		expect(intro).toContain('First line.');
		expect(intro).toContain('Grow revenue.');
		expect(intro).toContain('Launch Q2.');
	});

	it('uses fallback when project name empty', () => {
		const d = minimalDashboard({
			project: {
				name: '',
				slug: 'x',
			},
		});
		const { headline } = buildCustomerSummaryAutofillBasics(d, 'Fallback');
		expect(headline).toBe('Fallback');
	});
});

describe('buildCustomerSummaryAutofillBullets', () => {
	it('collects JTBD titles and value props', () => {
		const jtbd = {
			id: 'j1',
			project_id: 'p1',
			title: 'When I commute',
			statement: 'Long statement',
			situation: '',
			motivation: '',
			outcome: '',
			tags: [],
			is_validated: false,
		} satisfies NonNullable<MarketingProjectDashboard['job_stories']>[number];
		const vp = {
			id: 'v1',
			project_id: 'p1',
			headline: 'Save time',
			proof_points: [],
			addressed_job_ids: [],
			target_channels: [],
			is_ai_generated: false,
		} satisfies NonNullable<
			MarketingProjectDashboard['value_propositions']
		>[number];
		const d = minimalDashboard({
			job_stories: [jtbd],
			value_propositions: [vp],
		});
		const bullets = buildCustomerSummaryAutofillBullets(d);
		expect(bullets).toContain('When I commute');
		expect(bullets).toContain('Save time');
	});
});

describe('buildCustomerSummaryAutofillMetrics', () => {
	it('maps counts and scores to metric keys', () => {
		const d = minimalDashboard({
			project: {
				name: 'N',
				slug: 'n',
				company_name: 'Co',
				company_industry: 'IT',
			},
			counts: {
				...baseCounts,
				jtbd: 3,
				value_propositions: 2,
			},
			readiness_score: 71.2,
			strategy_integrity_score: 68.9,
		});
		const m = buildCustomerSummaryAutofillMetrics(d);
		expect(m.find((x) => x.metricKey === 'company')?.value).toBe('Co');
		expect(m.find((x) => x.metricKey === 'industry')?.value).toBe('IT');
		expect(m.find((x) => x.metricKey === 'jtbdCount')?.value).toBe('3');
		expect(m.find((x) => x.metricKey === 'vpCount')?.value).toBe('2');
		expect(m.find((x) => x.metricKey === 'readiness')?.value).toBe('71');
		expect(m.find((x) => x.metricKey === 'strategyIntegrity')?.value).toBe(
			'69'
		);
	});
});

describe('buildCustomerSummaryAutofillAll', () => {
	it('combines parts', () => {
		const d = minimalDashboard({
			project: {
				name: 'P',
				slug: 'p',
				company_name: 'C',
				description: 'D',
			},
		});
		const all = buildCustomerSummaryAutofillAll(d, '—');
		expect(all.headline).toBe('P — C');
		expect(all.intro).toBe('D');
		expect(Array.isArray(all.bullets)).toBe(true);
		expect(Array.isArray(all.metrics)).toBe(true);
	});
});
