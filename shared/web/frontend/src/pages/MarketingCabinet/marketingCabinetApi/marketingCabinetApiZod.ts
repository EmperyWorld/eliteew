/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime Zod validation for high-traffic Marketing Cabinet pilot endpoints
 * (`marketing-cabinet-openapi`) before data enters TanStack Query cache.
 *
 * Invariants:
 * - Fetch as `unknown`, parse with explicit Zod keys (strip unknown keys; no passthrough), then normalize scalars.
 * - Tool-specific `result` payloads use dedicated coerce helpers — never raw `as` at UI.
 *
 * Related:
 * - `cabinetEntitiesApiSlice.ts`, `dashboardApiSlice.ts`
 * - `generated/marketing-cabinet-openapi.ts`
 * - `documentation/product/marketing/MARKETING-CABINET.md`
 */
import type { components } from '@/generated/marketing-cabinet-openapi';
import type { components as LiveJobsComponents } from '@/generated/live-jobs-summary-openapi';
import { log } from '@/utils/logger';
import { z } from 'zod';

import type { MarketingProjectMembersListResponse } from './marketingCabinetApiCoreEntityTypes';

export type MarketingAiRunDetailOpenApi =
	components['schemas']['MarketingAiRunDetailResponse'];
export type MarketingAiRunListOpenApi =
	components['schemas']['MarketingAiRunListResponse'];
export type MarketingProjectDashboardOpenApi =
	components['schemas']['MarketingProjectDashboardResponse'];
export type MarketingAiRunOpenApi = components['schemas']['MarketingAiRunOut'];

export type MarketingAiRunListParsed = {
	items: MarketingAiRunOpenApi[];
	total: number;
};

/** OpenAPI `MarketingProjectLiveJobsSummaryResponse` (`live-jobs-summary` pilot). */
export type MarketingProjectLiveJobsSummaryParsed =
	LiveJobsComponents['schemas']['MarketingProjectLiveJobsSummaryResponse'];

const marketingProjectLiveJobsSummaryRawSchema = z.object({
	ai_active_total: z.number().int().nonnegative(),
	imc_active_total: z.number().int().nonnegative(),
});

const maybeStringSchema = z.union([z.string(), z.null(), z.undefined()]);
const maybeNumberSchema = z.union([z.number(), z.null(), z.undefined()]);
const maybeRecordSchema = z.union([
	z.record(z.string(), z.unknown()),
	z.null(),
	z.undefined(),
]);

const marketingAiRunOutRawSchema = z
	.object({
		id: z.string(),
		project_id: maybeStringSchema.optional(),
		company_id: maybeStringSchema.optional(),
		request_id: maybeStringSchema.optional(),
		tool_key: z.string(),
		status: maybeStringSchema.optional(),
		prompt_excerpt: maybeStringSchema.optional(),
		result_excerpt: maybeStringSchema.optional(),
		metadata: maybeRecordSchema.optional(),
		started_at: maybeStringSchema.optional(),
		finished_at: maybeStringSchema.optional(),
		created_at: maybeStringSchema.optional(),
		updated_at: maybeStringSchema.optional(),
	})
	.strip();

const marketingAiQueueSnapshotRawSchema = z
	.object({
		status: maybeStringSchema,
		waiting_count: maybeNumberSchema,
		processing_count: maybeNumberSchema,
		estimated_start_at: maybeStringSchema,
	})
	.strip();

export const marketingAiRunDetailRawSchema = z
	.object({
		run: marketingAiRunOutRawSchema,
		poll_after_ms: z.number().int().nonnegative().optional(),
		queue: marketingAiQueueSnapshotRawSchema.nullable().optional(),
		result_type: maybeStringSchema.optional(),
		result: maybeRecordSchema.optional(),
		error: maybeStringSchema.optional(),
	})
	.strip();

export const marketingAiRunListRawSchema = z
	.object({
		items: z.array(marketingAiRunOutRawSchema),
		total: z.number().int().nonnegative(),
	})
	.strip();

const marketingProjectSummaryOutRawSchema = z
	.object({
		id: z.string(),
		company_id: maybeStringSchema.optional(),
		name: maybeStringSchema.optional(),
		slug: maybeStringSchema.optional(),
		description: maybeStringSchema.optional(),
		goals: maybeStringSchema.optional(),
		key_tasks: maybeStringSchema.optional(),
		category: maybeStringSchema.optional(),
		status: maybeStringSchema.optional(),
		priority: maybeStringSchema.optional(),
		tags: z.array(z.string()).optional(),
		enabled_modules: z.array(z.string()).optional(),
		company_name: maybeStringSchema.optional(),
		company_industry: maybeStringSchema.optional(),
		company_description: maybeStringSchema.optional(),
		company_website: maybeStringSchema.optional(),
	})
	.strip();

const marketingCountsOutRawSchema = z
	.object({
		jtbd: z.number(),
		value_propositions: z.number(),
		swot: z.number(),
		competitors: z.number(),
		researches: z.number(),
		content: z.number(),
		segments: z.number().optional(),
		campaigns: z.number().optional(),
	})
	.strip();

export const marketingProjectDashboardRawSchema = z
	.object({
		project: marketingProjectSummaryOutRawSchema,
		job_stories: z.array(z.unknown()),
		value_propositions: z.array(z.unknown()),
		competitors: z.array(z.unknown()),
		researches: z.array(z.unknown()),
		content: z.array(z.unknown()),
		counts: marketingCountsOutRawSchema,
		readiness_score: z.number(),
	})
	.strip();

const marketingAutofillPreviewItemRawSchema = z
	.object({
		draft_id: z.string(),
		title: maybeStringSchema.optional(),
		description: maybeStringSchema.optional(),
		payload: maybeRecordSchema.optional(),
		evidence: z.array(z.string()).optional(),
	})
	.strip();

const marketingAutofillResultRawSchema = z
	.object({
		summary: maybeStringSchema.optional(),
		warnings: z.array(z.string()).optional(),
		preview_items: z.array(marketingAutofillPreviewItemRawSchema).optional(),
	})
	.strip();

const marketingJtbdExtractResultRawSchema = z
	.object({
		total: maybeNumberSchema,
	})
	.strip();

function normalizeText(value: string | null | undefined): string {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecord(
	value: Record<string, unknown> | null | undefined
): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value
		: {};
}

function normalizeMarketingAiRun(
	run: z.infer<typeof marketingAiRunOutRawSchema>
): MarketingAiRunOpenApi {
	return {
		id: normalizeText(run.id),
		project_id: normalizeText(run.project_id) || null,
		company_id: normalizeText(run.company_id) || null,
		request_id: normalizeText(run.request_id) || null,
		tool_key: normalizeText(run.tool_key),
		status: normalizeText(run.status) || null,
		prompt_excerpt: normalizeText(run.prompt_excerpt) || null,
		result_excerpt: normalizeText(run.result_excerpt) || null,
		metadata: normalizeRecord(
			run.metadata as Record<string, unknown> | undefined
		),
		started_at: normalizeText(run.started_at) || null,
		finished_at: normalizeText(run.finished_at) || null,
		created_at: normalizeText(run.created_at) || null,
		updated_at: normalizeText(run.updated_at) || null,
	};
}

function normalizePollAfterMs(value: number | undefined): number {
	if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
		return Math.trunc(value);
	}
	return 2000;
}

export function parseMarketingAiRunDetail(
	raw: unknown
): MarketingAiRunDetailOpenApi {
	const parsed = marketingAiRunDetailRawSchema.parse(raw);
	return {
		run: normalizeMarketingAiRun(parsed.run),
		poll_after_ms: normalizePollAfterMs(parsed.poll_after_ms),
		queue: parsed.queue ?? null,
		result_type: normalizeText(parsed.result_type) || null,
		result: normalizeRecord(
			parsed.result as Record<string, unknown> | undefined
		),
		error: normalizeText(parsed.error) || null,
	} satisfies MarketingAiRunDetailOpenApi;
}

export function parseMarketingAiRunList(
	raw: unknown
): MarketingAiRunListParsed {
	const parsed = marketingAiRunListRawSchema.parse(raw);
	return {
		items: parsed.items.map(normalizeMarketingAiRun),
		total: parsed.total,
	} satisfies MarketingAiRunListParsed;
}

export function parseMarketingProjectLiveJobsSummary(
	raw: unknown
): MarketingProjectLiveJobsSummaryParsed {
	const parsed = marketingProjectLiveJobsSummaryRawSchema.parse(raw);
	return {
		ai_active_total: parsed.ai_active_total,
		imc_active_total: parsed.imc_active_total,
	} satisfies MarketingProjectLiveJobsSummaryParsed;
}

export function parseMarketingProjectDashboard(
	raw: unknown
): MarketingProjectDashboardOpenApi {
	return marketingProjectDashboardRawSchema.parse(
		raw
	) as MarketingProjectDashboardOpenApi;
}

const marketingProjectMemberRawSchema = z.object({
	id: z.string(),
	project_id: z.string(),
	user_id: z.string(),
	invited_by: z.string().nullable().optional(),
	role: z.string(),
	permissions: z.array(z.string()),
	status: z.string(),
	joined_at: z.string().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

const marketingProjectMembersListRawSchema = z.object({
	items: z.array(marketingProjectMemberRawSchema),
	total: z.number().int().nonnegative(),
});

export function parseMarketingProjectMembersList(
	raw: unknown
): MarketingProjectMembersListResponse {
	return marketingProjectMembersListRawSchema.parse(raw);
}

export type MarketingAutofillPreviewItemCoerced = {
	draft_id: string;
	title: string;
	description?: string | null;
	payload: Record<string, unknown>;
	evidence: string[];
};

export type MarketingAutofillResultCoerced = {
	summary: string | null;
	warnings: string[];
	preview_items: MarketingAutofillPreviewItemCoerced[];
};

function normalizeAutofillPreviewItem(
	raw: z.infer<typeof marketingAutofillPreviewItemRawSchema>
): MarketingAutofillPreviewItemCoerced {
	const payloadRaw = raw.payload;
	const payload =
		payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)
			? payloadRaw
			: {};
	const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
	return {
		draft_id: raw.draft_id,
		title: typeof raw.title === 'string' ? raw.title : '',
		description: typeof raw.description === 'string' ? raw.description : null,
		payload,
		evidence,
	};
}

export function coerceMarketingAutofillResult(
	detail: Pick<MarketingAiRunDetailOpenApi, 'result'>
): MarketingAutofillResultCoerced | null {
	if (!detail.result || typeof detail.result !== 'object') {
		return null;
	}
	const parsed = marketingAutofillResultRawSchema.safeParse(detail.result);
	if (!parsed.success) {
		log.warn(
			'marketingCabinetApiZod',
			'Invalid autofill result payload',
			parsed.error
		);
		return null;
	}
	return {
		summary: normalizeText(parsed.data.summary) || null,
		warnings: Array.isArray(parsed.data.warnings)
			? parsed.data.warnings.filter((row) => typeof row === 'string')
			: [],
		preview_items: (parsed.data.preview_items ?? []).map((item) =>
			normalizeAutofillPreviewItem(item)
		),
	};
}

export function coerceMarketingJtbdExtractTotal(
	detail: Pick<MarketingAiRunDetailOpenApi, 'result'>
): number {
	if (!detail.result || typeof detail.result !== 'object') {
		return 0;
	}
	const parsed = marketingJtbdExtractResultRawSchema.safeParse(detail.result);
	if (!parsed.success) {
		log.warn(
			'marketingCabinetApiZod',
			'Invalid JTBD extract result payload',
			parsed.error
		);
		return 0;
	}
	const total = parsed.data.total;
	return typeof total === 'number' && Number.isFinite(total) ? total : 0;
}
