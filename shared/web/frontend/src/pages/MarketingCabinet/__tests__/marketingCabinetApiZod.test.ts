/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod boundary tests for Marketing Cabinet pilot API parsers (AI runs + dashboard).
 *
 * Invariants:
 * - Invalid payloads throw before entering React Query cache paths.
 *
 * Related:
 * - `marketingCabinetApi/marketingCabinetApiZod.ts`
 */
import { describe, expect, it } from 'vitest';
import {
	coerceMarketingAutofillResult,
	coerceMarketingJtbdExtractTotal,
	parseMarketingAiRunDetail,
	parseMarketingAiRunList,
	parseMarketingProjectLiveJobsSummary,
	parseMarketingProjectDashboard,
	parseMarketingProjectMembersList,
} from '../marketingCabinetApi/marketingCabinetApiZod';

const baseRun = {
	id: 'run-1',
	tool_key: 'document_autofill',
	status: 'processing',
};

describe('parseMarketingAiRunDetail', () => {
	it('normalizes poll_after_ms default and run scalars', () => {
		const parsed = parseMarketingAiRunDetail({
			run: {
				...baseRun,
				project_id: ' proj ',
				status: ' queued ',
			},
		});
		expect(parsed.poll_after_ms).toBe(2000);
		expect(parsed.run.project_id).toBe('proj');
		expect(parsed.run.status).toBe('queued');
	});

	it('rejects payload without run.id', () => {
		expect(() =>
			parseMarketingAiRunDetail({
				run: { tool_key: 'x' },
				poll_after_ms: 1000,
			})
		).toThrow();
	});
});

describe('parseMarketingAiRunList', () => {
	it('maps items/total envelope', () => {
		const parsed = parseMarketingAiRunList({
			items: [baseRun],
			total: 1,
		});
		expect(parsed.total).toBe(1);
		expect(parsed.items[0]?.id).toBe('run-1');
	});
});

describe('parseMarketingProjectLiveJobsSummary', () => {
	it('parses ai and imc active totals', () => {
		const parsed = parseMarketingProjectLiveJobsSummary({
			ai_active_total: 2,
			imc_active_total: 1,
		});
		expect(parsed.ai_active_total).toBe(2);
		expect(parsed.imc_active_total).toBe(1);
	});
});

describe('parseMarketingProjectDashboard', () => {
	it('requires core dashboard keys from pilot schema', () => {
		const parsed = parseMarketingProjectDashboard({
			project: { id: 'proj-1', name: 'Demo' },
			job_stories: [],
			value_propositions: [],
			competitors: [],
			researches: [],
			content: [],
			counts: {
				jtbd: 0,
				value_propositions: 0,
				swot: 0,
				competitors: 0,
				researches: 0,
				content: 0,
			},
			readiness_score: 42,
		});
		expect(parsed.project.id).toBe('proj-1');
		expect(parsed.readiness_score).toBe(42);
	});
});

describe('parseMarketingProjectMembersList', () => {
	it('requires full ProjectMemberResponse fields and total', () => {
		const parsed = parseMarketingProjectMembersList({
			items: [
				{
					id: 'm1',
					project_id: 'p1',
					user_id: 'u1',
					invited_by: null,
					role: 'member',
					permissions: [],
					status: 'active',
					joined_at: null,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z',
				},
			],
			total: 1,
		});
		expect(parsed.items).toHaveLength(1);
		expect(parsed.items[0]?.project_id).toBe('p1');
		expect(parsed.total).toBe(1);
	});

	it('rejects incomplete member rows', () => {
		expect(() =>
			parseMarketingProjectMembersList({
				items: [{ id: 'm1', user_id: 'u1', role: 'member' }],
				total: 1,
			})
		).toThrow();
	});

	it('rejects missing total', () => {
		expect(() => parseMarketingProjectMembersList({ items: [] })).toThrow();
	});
});

describe('tool result coercers', () => {
	it('coerceMarketingAutofillResult extracts preview fields', () => {
		const detail = parseMarketingAiRunDetail({
			run: { ...baseRun, status: 'completed' },
			poll_after_ms: 1500,
			result: {
				summary: ' ok ',
				warnings: ['w1'],
				preview_items: [{ draft_id: 'd1', title: 'T' }],
			},
		});
		const result = coerceMarketingAutofillResult(detail);
		expect(result?.summary).toBe('ok');
		expect(result?.warnings).toEqual(['w1']);
		expect(result?.preview_items[0]).toEqual({
			draft_id: 'd1',
			title: 'T',
			description: null,
			payload: {},
			evidence: [],
		});
	});

	it('coerceMarketingAutofillResult fills missing title/payload/evidence', () => {
		const detail = parseMarketingAiRunDetail({
			run: { ...baseRun, status: 'completed' },
			poll_after_ms: 1500,
			result: {
				preview_items: [{ draft_id: 'd2' }],
			},
		});
		const result = coerceMarketingAutofillResult(detail);
		expect(result?.preview_items[0]).toEqual({
			draft_id: 'd2',
			title: '',
			description: null,
			payload: {},
			evidence: [],
		});
	});

	it('coerceMarketingJtbdExtractTotal returns 0 for invalid result', () => {
		const detail = parseMarketingAiRunDetail({
			run: { ...baseRun, status: 'completed' },
			poll_after_ms: 1500,
			result: { total: 'nope' },
		});
		expect(coerceMarketingJtbdExtractTotal(detail)).toBe(0);
	});

	it('coerceMarketingJtbdExtractTotal reads numeric total', () => {
		const detail = parseMarketingAiRunDetail({
			run: { ...baseRun, status: 'completed' },
			poll_after_ms: 1500,
			result: { total: 7 },
		});
		expect(coerceMarketingJtbdExtractTotal(detail)).toBe(7);
	});
});
