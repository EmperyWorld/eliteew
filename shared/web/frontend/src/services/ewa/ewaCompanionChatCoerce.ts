/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion chat response coercion: learned-preferences parsing, task-run normalization,
 * surface-block and action Zod boundaries, and tolerant **`coerceCompanionActions`** for dispatch.
 *
 * Invariants:
 * - **`normalizeLearnedPreferences`** and chat subtree parsing accept plain objects **or** JSON strings.
 * - **`coerceCompanionActions`** tolerates **`type`** casing quirks and **`actions`** delivered as JSON string (legacy serializers).
 * - **`coerceTaskRun`** normalizes **`run_revision`** (defaults to **1**); list/confirm responses validated with Zod first.
 * - Server **`doc_editor_set_body`** is accepted **only from the payload**, never from parsed model ``<<ACTIONS>>`` tails.
 *
 * Related:
 * - ewaCompanionChatMessageApi.ts — HTTP message POST consumes coercions
 * - ewaCompanionChatStreamApi.ts — SSE final/actions consume coercions
 * - ewaCompanionChatTaskRunsApi.ts — task-run list/confirm consumes coercions
 * - src/generated/ewa-companion-chat-openapi.ts
 */
import { sanitizeCompanionVisibleReplyText } from '@/features/ewa/companionVisibleReplySanitize';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import type { components } from '@/generated/ewa-companion-chat-openapi';
import { APIError } from '@/services/api/client';
import { normalizeUnifiedContentId } from '@/services/audio/playerAudioContracts';
import { isAxiosError } from 'axios';
import { z } from 'zod';

type CompanionChatOpenApiSchemas = components['schemas'];
type GeneratedCompanionTaskRun =
	CompanionChatOpenApiSchemas['CompanionTaskRunOut'];

export const EWA_DESKTOP_FRIEND_CHAT_NS = 'desktop_friend_chat_v1' as const;
export const EWA_COMPANION_TURN_PLAN_NS = 'companion_turn_plan_v1' as const;

export type CompanionChatMessageRow = {
	role: 'user' | 'assistant';
	content: string;
};

export type CompanionTurnPlanStep = {
	tool: string;
	args: Record<string, unknown>;
};

export type CompanionTurnPlanSnapshot = {
	source: string | null;
	created_at: string | null;
	steps: CompanionTurnPlanStep[];
};

export type CompanionExecutionReport = {
	schema_version?: number;
	scope: string;
	outcome: string;
	reason_code?: string;
	reason_message_ru?: string;
	reason_message_en?: string;
	resume_conditions?: string[];
	refs?: Record<string, unknown>;
};

export type CompanionToolTraceEntry = {
	tool: string;
	branch?: string;
	status?: string;
};

export type CompanionWebSearchResultItem = {
	title: string;
	url?: string;
	snippet?: string;
};

export type CompanionWebSearchStatus =
	| 'ok'
	| 'empty'
	| 'error'
	| 'quota'
	| 'skipped';

export type CompanionWebSearchResult = {
	schema_version?: number;
	provider?: string;
	query: string;
	/** Wire status when Web toggle ran; omit/legacy means infer from results. */
	status?: CompanionWebSearchStatus;
	error_code?: string;
	result_count: number;
	results: CompanionWebSearchResultItem[];
};

export type CompanionProactiveSuggestion = {
	schema_version?: number;
	suggestion_id?: string;
	kind?: string;
	question_ru?: string;
	question_en?: string;
	quick_replies?: string[];
	source?: string;
	confidence?: number;
	refs?: Record<string, unknown>;
};

export type CompanionChatMessageResponse = {
	reply: string;
	companion_revision: number;
	actions?: CompanionChatAction[];
	task_run?: Record<string, unknown> | null;
	surface_blocks?: CompanionSurfaceBlock[];
	turn_plan_hint?: string | null;
	turn_plan_next_tool?: string | null;
	turn_plan_source?: string | null;
	execution_reports?: CompanionExecutionReport[];
	tool_trace?: CompanionToolTraceEntry[];
	web_search_result?: CompanionWebSearchResult | null;
	orchestration_outcome?: string | null;
	proactive_suggestion?: CompanionProactiveSuggestion | null;
	output_surface?: {
		mode: string;
		payload?: Record<string, unknown>;
	} | null;
	transformed_this_turn?: boolean;
	/** When set with `transformed_this_turn`: `arlika` | `ewa_restore` for video selection. */
	transform_event_kind?: string | null;
	/** Server applied `PATCH /desktop/config` from companion automation (theme / wallpaper subset). */
	desktop_config_patch_applied?: boolean;
};

export type CompanionSurfaceBlockAction = {
	type: string;
	label_ru?: string;
	label_en?: string;
	payload?: Record<string, unknown>;
};

export type CompanionSurfaceBlockKind =
	| 'text'
	| 'result'
	| 'workflow_timeline'
	| 'confirm'
	| 'choice'
	| 'builder'
	| 'history_ref';

export type CompanionSurfaceBlock = {
	id: string;
	kind: CompanionSurfaceBlockKind;
	title: string;
	subtitle?: string;
	status?: string;
	run_id?: string | null;
	payload: Record<string, unknown>;
	actions: CompanionSurfaceBlockAction[];
	created_at?: string | null;
};

export type EwaCompanionTaskStep =
	CompanionChatOpenApiSchemas['CompanionTaskStepOut'];

/** Desktop operations panel row; extends OpenAPI `CompanionTaskRunOut` with client-only SSE overlay. */
export type EwaCompanionTaskRun = GeneratedCompanionTaskRun & {
	/** First-class nested workflow parent (Phase 4.7); legacy plan_payload mirror may still exist. */
	parent_run_id?: string | null;
	/** Client-only overlay from SSE music pipeline (not persisted on server). */
	music_pipeline_progress?: {
		current: number;
		total: number;
		title: string;
	};
	surface_blocks?: CompanionSurfaceBlock[];
};

/**
 * Completed task-orchestrator runs that mutated Unified Content (companion create/rename/delete).
 * Used to trigger Content Manager `fetchContent` when the server emits no `open_app` for CM (e.g. soft-delete).
 */
export function companionTaskRunImpliesContentLibraryMutation(
	taskRun: Record<string, unknown> | null | undefined
): boolean {
	if (!taskRun || typeof taskRun !== 'object') return false;
	if (String(taskRun.status ?? '') !== 'completed') return false;
	const rp = taskRun.result_payload;
	if (!rp || typeof rp !== 'object') return false;
	const r = rp as Record<string, unknown>;
	return (
		('deleted_unified_content_id' in r &&
			r.deleted_unified_content_id != null) ||
		('renamed_unified_content_id' in r &&
			r.renamed_unified_content_id != null) ||
		('created_unified_content_id' in r && r.created_unified_content_id != null)
	);
}

/** Normalize ``learned_preferences`` whether axios handed us an object or a JSON string. */
export function normalizeLearnedPreferences(
	raw: unknown
): Record<string, unknown> {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	if (typeof raw === 'string') {
		try {
			const p = JSON.parse(raw) as unknown;
			if (p && typeof p === 'object' && !Array.isArray(p)) {
				return p as Record<string, unknown>;
			}
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_learned_preferences_parse',
				'learned_preferences JSON string parse failed',
				err
			);
			return {};
		}
	}
	return {};
}

function parseChatSubtree(raw: unknown): Record<string, unknown> | null {
	if (!raw) return null;
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	if (typeof raw === 'string') {
		try {
			const p = JSON.parse(raw) as unknown;
			if (p && typeof p === 'object' && !Array.isArray(p)) {
				return p as Record<string, unknown>;
			}
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_chat_subtree_parse',
				'chat subtree JSON string parse failed',
				err
			);
			return null;
		}
	}
	return null;
}

export function extractCompanionTurnPlanFromLearned(
	learned: unknown
): CompanionTurnPlanSnapshot | null {
	const lp = normalizeLearnedPreferences(learned);
	const raw = lp[EWA_COMPANION_TURN_PLAN_NS];
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return null;
	}
	const plan = raw as Record<string, unknown>;
	const source =
		typeof plan.source === 'string' && plan.source.trim()
			? plan.source.trim()
			: null;
	const createdAt =
		typeof plan.created_at === 'string' && plan.created_at.trim()
			? plan.created_at.trim()
			: null;
	const stepsRaw = Array.isArray(plan.steps) ? plan.steps : [];
	const steps: CompanionTurnPlanStep[] = [];
	for (const row of stepsRaw) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
		const rec = row as Record<string, unknown>;
		const tool = typeof rec.tool === 'string' ? rec.tool.trim() : '';
		if (!tool) continue;
		const args =
			rec.args && typeof rec.args === 'object' && !Array.isArray(rec.args)
				? (rec.args as Record<string, unknown>)
				: {};
		steps.push({ tool, args });
	}
	if (steps.length === 0) {
		return null;
	}
	return {
		source,
		created_at: createdAt,
		steps,
	};
}

export function extractCompanionChatMessagesFromLearned(
	learned: unknown
): CompanionChatMessageRow[] {
	const lp = normalizeLearnedPreferences(learned);
	const raw = lp[EWA_DESKTOP_FRIEND_CHAT_NS];
	const chatObj = parseChatSubtree(raw);
	if (!chatObj) {
		return [];
	}
	const msgs = chatObj.messages;
	if (!Array.isArray(msgs)) {
		return [];
	}
	const out: CompanionChatMessageRow[] = [];
	for (const m of msgs) {
		if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
		const role = (m as Record<string, unknown>).role;
		const content = (m as Record<string, unknown>).content;
		if (role !== 'user' && role !== 'assistant') continue;
		if (typeof content !== 'string' || !content.trim()) continue;
		const text =
			role === 'assistant'
				? sanitizeCompanionVisibleReplyText(content)
				: content.trim();
		if (!text) continue;
		out.push({ role, content: text });
	}
	return out;
}

export function extractLatestCompanionAssistantReplyFromLearned(
	learned: unknown
): CompanionChatMessageRow[] {
	const messages = extractCompanionChatMessagesFromLearned(learned);
	for (let idx = messages.length - 1; idx >= 0; idx--) {
		const row = messages[idx];
		if (row.role === 'assistant' && row.content.trim()) {
			return [row];
		}
	}
	return [];
}

export function extractLatestCompanionUserMessageFromLearned(
	learned: unknown
): string | null {
	const messages = extractCompanionChatMessagesFromLearned(learned);
	for (let idx = messages.length - 1; idx >= 0; idx--) {
		const row = messages[idx];
		if (row.role === 'user' && row.content.trim()) {
			return row.content.trim();
		}
	}
	return null;
}

export function resolveLastUserMessageForRestore(args: {
	messages: CompanionChatMessageRow[];
	pendingTurn: CompanionChatMessageRow[] | null;
}): string | null {
	const pending = args.pendingTurn;
	if (pending?.length) {
		for (let idx = pending.length - 1; idx >= 0; idx--) {
			const row = pending[idx];
			if (row.role === 'user' && row.content.trim()) {
				return row.content.trim();
			}
		}
	}
	for (let idx = args.messages.length - 1; idx >= 0; idx--) {
		const row = args.messages[idx];
		if (row.role === 'user' && row.content.trim()) {
			return row.content.trim();
		}
	}
	return null;
}

export function coerceExecutionReports(
	raw: unknown
): CompanionExecutionReport[] {
	if (!Array.isArray(raw)) return [];
	const out: CompanionExecutionReport[] = [];
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const r = row as Record<string, unknown>;
		const outcome = typeof r.outcome === 'string' ? r.outcome : '';
		const scope = typeof r.scope === 'string' ? r.scope : 'turn';
		if (!outcome) continue;
		out.push({
			schema_version:
				typeof r.schema_version === 'number' ? r.schema_version : 1,
			scope,
			outcome,
			reason_code:
				typeof r.reason_code === 'string' ? r.reason_code : undefined,
			reason_message_ru:
				typeof r.reason_message_ru === 'string'
					? r.reason_message_ru
					: undefined,
			reason_message_en:
				typeof r.reason_message_en === 'string'
					? r.reason_message_en
					: undefined,
			resume_conditions: Array.isArray(r.resume_conditions)
				? r.resume_conditions.filter((x): x is string => typeof x === 'string')
				: undefined,
			refs:
				r.refs && typeof r.refs === 'object' && !Array.isArray(r.refs)
					? (r.refs as Record<string, unknown>)
					: undefined,
		});
	}
	return out;
}

export function coerceToolTrace(raw: unknown): CompanionToolTraceEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: CompanionToolTraceEntry[] = [];
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const item = row as Record<string, unknown>;
		const tool = typeof item.tool === 'string' ? item.tool.trim() : '';
		if (!tool) continue;
		const branch =
			typeof item.branch === 'string' && item.branch.trim()
				? item.branch.trim()
				: undefined;
		const status =
			typeof item.status === 'string' && item.status.trim()
				? item.status.trim()
				: undefined;
		out.push({ tool, branch, status });
	}
	return out;
}

const WEB_SEARCH_STATUSES = new Set<CompanionWebSearchStatus>([
	'ok',
	'empty',
	'error',
	'quota',
	'skipped',
]);

export function coerceCompanionWebSearchResult(
	raw: unknown
): CompanionWebSearchResult | null {
	if (!raw || typeof raw !== 'object') return null;
	const rec = raw as Record<string, unknown>;
	const query = typeof rec.query === 'string' ? rec.query.trim() : '';
	const results: CompanionWebSearchResultItem[] = [];
	for (const row of Array.isArray(rec.results) ? rec.results : []) {
		if (!row || typeof row !== 'object') continue;
		const item = row as Record<string, unknown>;
		const title = typeof item.title === 'string' ? item.title.trim() : '';
		const url = typeof item.url === 'string' ? item.url.trim() : '';
		const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : '';
		if (!title && !url && !snippet) continue;
		results.push({
			title: title || url || snippet.slice(0, 80),
			...(url ? { url } : {}),
			...(snippet ? { snippet } : {}),
		});
	}
	const statusRaw =
		typeof rec.status === 'string' ? rec.status.trim().toLowerCase() : '';
	const status = WEB_SEARCH_STATUSES.has(statusRaw as CompanionWebSearchStatus)
		? (statusRaw as CompanionWebSearchStatus)
		: results.length > 0
			? 'ok'
			: undefined;
	const errorCode =
		typeof rec.error_code === 'string' && rec.error_code.trim()
			? rec.error_code.trim().slice(0, 80)
			: undefined;
	if (!query && results.length === 0 && !status) return null;
	return {
		schema_version:
			typeof rec.schema_version === 'number' ? rec.schema_version : 1,
		provider: typeof rec.provider === 'string' ? rec.provider : undefined,
		query,
		...(status ? { status } : {}),
		...(errorCode ? { error_code: errorCode } : {}),
		result_count:
			typeof rec.result_count === 'number' ? rec.result_count : results.length,
		results,
	};
}

export function coerceProactiveSuggestion(
	raw: unknown
): CompanionProactiveSuggestion | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const qRu = typeof r.question_ru === 'string' ? r.question_ru : '';
	const qEn = typeof r.question_en === 'string' ? r.question_en : '';
	if (!qRu.trim() && !qEn.trim()) return null;
	return {
		schema_version: typeof r.schema_version === 'number' ? r.schema_version : 1,
		suggestion_id:
			typeof r.suggestion_id === 'string' ? r.suggestion_id : undefined,
		kind: typeof r.kind === 'string' ? r.kind : undefined,
		question_ru: qRu,
		question_en: qEn,
		quick_replies: Array.isArray(r.quick_replies)
			? r.quick_replies.filter((x): x is string => typeof x === 'string')
			: [],
		source: typeof r.source === 'string' ? r.source : undefined,
		confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
		refs:
			r.refs && typeof r.refs === 'object' && !Array.isArray(r.refs)
				? (r.refs as Record<string, unknown>)
				: undefined,
	};
}

function coerceTaskStep(raw: unknown): EwaCompanionTaskStep | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const rec = raw as Record<string, unknown>;
	const id = typeof rec.id === 'string' ? rec.id.trim() : '';
	const runId = typeof rec.run_id === 'string' ? rec.run_id.trim() : '';
	if (!id || !runId) return null;
	const asObj = (val: unknown): Record<string, unknown> =>
		val && typeof val === 'object' && !Array.isArray(val)
			? (val as Record<string, unknown>)
			: {};
	const asIso = (val: unknown): string | null =>
		typeof val === 'string' && val.trim() ? val.trim() : null;
	const stepIndex =
		typeof rec.step_index === 'number' && Number.isFinite(rec.step_index)
			? Math.trunc(rec.step_index)
			: 0;
	return {
		id,
		run_id: runId,
		step_index: stepIndex,
		step_kind: typeof rec.step_kind === 'string' ? rec.step_kind.trim() : '',
		status: typeof rec.status === 'string' ? rec.status.trim() : '',
		title: typeof rec.title === 'string' ? rec.title.trim() : '',
		input_payload: asObj(rec.input_payload),
		output_payload: asObj(rec.output_payload),
		error_payload: asObj(rec.error_payload),
		created_at: asIso(rec.created_at),
		updated_at: asIso(rec.updated_at),
		completed_at: asIso(rec.completed_at),
	};
}

/** Normalize server ``run_revision``; missing or invalid values default to **1**. */
export function coerceTaskRunRevision(raw: unknown): number {
	if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
		return Math.trunc(raw);
	}
	return 1;
}

const companionSurfaceBlockActionSchema = z
	.object({
		type: z.string().min(1),
		label_ru: z.string().optional().default(''),
		label_en: z.string().optional().default(''),
		payload: z.record(z.string(), z.unknown()).optional().default({}),
	})
	.strip();

const companionSurfaceBlockSchema = z
	.object({
		id: z.string().min(1),
		kind: z.enum([
			'text',
			'result',
			'workflow_timeline',
			'confirm',
			'choice',
			'builder',
			'history_ref',
		]),
		title: z.string().optional().default(''),
		subtitle: z.string().optional().default(''),
		status: z.string().optional().default(''),
		run_id: z.union([z.string(), z.null()]).optional().default(null),
		payload: z.record(z.string(), z.unknown()).optional().default({}),
		actions: z.array(companionSurfaceBlockActionSchema).optional().default([]),
		created_at: z.union([z.string(), z.null()]).optional().default(null),
	})
	.strip();

export function coerceCompanionSurfaceBlocks(
	raw: unknown
): CompanionSurfaceBlock[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row) => companionSurfaceBlockSchema.safeParse(row))
		.flatMap((parsed) => (parsed.success ? [parsed.data] : []))
		.map((parsed) => ({
			id: parsed.id.trim(),
			kind: parsed.kind,
			title: parsed.title.trim(),
			subtitle: parsed.subtitle.trim(),
			status: parsed.status.trim(),
			run_id:
				typeof parsed.run_id === 'string' && parsed.run_id.trim()
					? parsed.run_id.trim()
					: null,
			payload: parsed.payload,
			actions: parsed.actions.map((action) => ({
				type: action.type.trim(),
				label_ru: action.label_ru?.trim() || '',
				label_en: action.label_en?.trim() || '',
				payload: action.payload ?? {},
			})),
			created_at:
				typeof parsed.created_at === 'string' && parsed.created_at.trim()
					? parsed.created_at.trim()
					: null,
		}));
}

function extractCompanionTaskRunHttpStatus(error: unknown): number | undefined {
	if (error instanceof APIError) return error.statusCode;
	if (isAxiosError(error)) return error.response?.status;
	return undefined;
}

function extractCompanionTaskRunDetailCode(error: unknown): string | null {
	if (error instanceof APIError) {
		const fromCode =
			typeof error.errorCode === 'string' ? error.errorCode.trim() : '';
		if (fromCode) return fromCode;
		const detail = error.details;
		if (typeof detail === 'string') return detail.trim() || null;
		if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
			const code = (detail as { code?: unknown }).code;
			if (typeof code === 'string' && code.trim()) return code.trim();
		}
	}
	if (isAxiosError(error)) {
		const data = error.response?.data;
		if (typeof data === 'string') return data.trim() || null;
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			const row = data as { detail?: unknown; code?: unknown };
			if (typeof row.code === 'string' && row.code.trim())
				return row.code.trim();
			const detail = row.detail;
			if (typeof detail === 'string') return detail.trim() || null;
		}
	}
	return null;
}

const taskRunIdRowSchema = z
	.object({
		id: z.string(),
	})
	.strip();

const taskRunsListResponseSchema = z.object({
	runs: z.array(z.unknown()),
});

const taskRunConfirmResponseSchema = z.object({
	ok: z.boolean().optional(),
	reply: z.union([z.string(), z.null(), z.undefined()]).optional(),
	actions: z.unknown().optional(),
	task_run: taskRunIdRowSchema,
});

/** Zod boundary for **`GET /task-runs`** envelope before per-row **`coerceTaskRun`**. */
export function parseCompanionTaskRunsListResponse(raw: unknown): unknown[] {
	const parsed = taskRunsListResponseSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error('companion_task_runs_list_invalid_response');
	}
	return parsed.data.runs;
}

/** Zod boundary for **`POST /task-runs/{id}/confirm`** before **`coerceTaskRun`**. */
export function parseCompanionTaskRunConfirmResponse(
	raw: unknown
): z.infer<typeof taskRunConfirmResponseSchema> {
	const parsed = taskRunConfirmResponseSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error('companion_task_run_confirm_invalid_response');
	}
	return parsed.data;
}

/** HTTP **409** when ``expect_run_revision`` no longer matches the durable run row. */
export function isCompanionTaskRunRevisionConflictError(
	error: unknown
): boolean {
	if (extractCompanionTaskRunHttpStatus(error) !== 409) return false;
	const code = extractCompanionTaskRunDetailCode(error);
	return code === 'companion_task_run_revision_conflict';
}

export function coerceTaskRun(raw: unknown): EwaCompanionTaskRun | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const rec = raw as Record<string, unknown>;
	const id = typeof rec.id === 'string' ? rec.id.trim() : '';
	if (!id) return null;
	const principalId =
		typeof rec.principal_id === 'string' ? rec.principal_id.trim() : '';
	const status = typeof rec.status === 'string' ? rec.status.trim() : '';
	const intentKind =
		typeof rec.intent_kind === 'string' ? rec.intent_kind.trim() : '';
	const userMessage =
		typeof rec.user_message === 'string' ? rec.user_message.trim() : '';
	const asObj = (val: unknown): Record<string, unknown> =>
		val && typeof val === 'object' && !Array.isArray(val)
			? (val as Record<string, unknown>)
			: {};
	const asIso = (val: unknown): string | null =>
		typeof val === 'string' && val.trim() ? val.trim() : null;
	const stepsRaw = rec.steps;
	const steps = Array.isArray(stepsRaw)
		? stepsRaw
				.map((row) => coerceTaskStep(row))
				.filter((row): row is EwaCompanionTaskStep => row !== null)
		: undefined;
	const surfaceBlocks = coerceCompanionSurfaceBlocks(rec.surface_blocks);
	const parentRunId =
		typeof rec.parent_run_id === 'string' && rec.parent_run_id.trim()
			? rec.parent_run_id.trim()
			: null;
	return {
		id,
		principal_id: principalId,
		status: status || 'pending',
		intent_kind: intentKind || 'unknown',
		user_message: userMessage,
		plan_payload: asObj(rec.plan_payload),
		confirmation_state: asObj(rec.confirmation_state),
		result_payload: asObj(rec.result_payload),
		error_payload: asObj(rec.error_payload),
		execution_mode:
			typeof rec.execution_mode === 'string' && rec.execution_mode.trim()
				? rec.execution_mode.trim()
				: 'sync',
		created_at: asIso(rec.created_at),
		updated_at: asIso(rec.updated_at),
		completed_at: asIso(rec.completed_at),
		run_revision: coerceTaskRunRevision(rec.run_revision),
		...(parentRunId ? { parent_run_id: parentRunId } : {}),
		...(steps && steps.length > 0 ? { steps } : {}),
		...(surfaceBlocks.length > 0 ? { surface_blocks: surfaceBlocks } : {}),
	};
}

export type CompanionTaskRunListProfile = 'summary' | 'full';

/**
 * List/poll coercion — summary profile skips surface-block Zod and heavy nested walks.
 * Full profile delegates to {@link coerceTaskRun}.
 */
export function coerceTaskRunListRow(
	raw: unknown,
	listProfile: CompanionTaskRunListProfile = 'summary'
): EwaCompanionTaskRun | null {
	if (listProfile === 'full') {
		return coerceTaskRun(raw);
	}
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const rec = raw as Record<string, unknown>;
	const id = typeof rec.id === 'string' ? rec.id.trim() : '';
	if (!id) return null;
	const asObj = (val: unknown): Record<string, unknown> =>
		val && typeof val === 'object' && !Array.isArray(val)
			? (val as Record<string, unknown>)
			: {};
	const asIso = (val: unknown): string | null =>
		typeof val === 'string' && val.trim() ? val.trim() : null;
	const stepsRaw = rec.steps;
	const steps = Array.isArray(stepsRaw)
		? stepsRaw
				.map((row) => coerceTaskStep(row))
				.filter((row): row is EwaCompanionTaskStep => row !== null)
		: undefined;
	const parentRunId =
		typeof rec.parent_run_id === 'string' && rec.parent_run_id.trim()
			? rec.parent_run_id.trim()
			: null;
	return {
		id,
		principal_id:
			typeof rec.principal_id === 'string' ? rec.principal_id.trim() : '',
		status:
			(typeof rec.status === 'string' ? rec.status.trim() : '') || 'pending',
		intent_kind:
			(typeof rec.intent_kind === 'string' ? rec.intent_kind.trim() : '') ||
			'unknown',
		user_message:
			typeof rec.user_message === 'string' ? rec.user_message.trim() : '',
		plan_payload: asObj(rec.plan_payload),
		confirmation_state: asObj(rec.confirmation_state),
		result_payload: asObj(rec.result_payload),
		error_payload: asObj(rec.error_payload),
		execution_mode:
			typeof rec.execution_mode === 'string' && rec.execution_mode.trim()
				? rec.execution_mode.trim()
				: 'sync',
		created_at: asIso(rec.created_at),
		updated_at: asIso(rec.updated_at),
		completed_at: asIso(rec.completed_at),
		run_revision: coerceTaskRunRevision(rec.run_revision),
		...(parentRunId ? { parent_run_id: parentRunId } : {}),
		...(steps && steps.length > 0 ? { steps } : {}),
	};
}

export type CompanionChatActionOutcome =
	CompanionChatOpenApiSchemas['CompanionActionOutcome'];

type CompanionChatActionOutcomeFields = {
	outcome?: CompanionChatActionOutcome;
	/** Durable background operation id when action originated from orchestrator task run (Phase 5.2). */
	task_run_id?: string;
};

export type CompanionChatActionOpenApp = CompanionChatActionOutcomeFields & {
	type: 'open_app';
	app_component: string;
	rationale?: string;
	/** When true, companion chat opens only the embedded document surface (no desktop DocEditor window). */
	companion_surface_only?: boolean;
	/**
	 * Unified Workspace: when true with DocEditor + unified_content_id, also open the desktop DocEditor
	 * (default is in-companion only).
	 */
	open_on_desk?: boolean;
	/** Allowed for **DocEditor** when server echoed it from the LLM (`unified_content_id`). */
	unified_content_id?: string;
	/** Allowed for **ContentManagerPro** when server echoed **`content_manager_focus_unified_content_id`**. */
	content_manager_focus_unified_content_id?: string;
	/**
	 * **ContentManagerPro** catalogue search preview (keyword `search_query` only from server augmentation).
	 * Coerced onto `desktop-open-app` as `contentManagerInitialFilter.searchQuery`.
	 */
	content_manager_initial_filter?: { search_query?: string };
	/** **ContentManagerPro** explorer scope — companion catalogue opens **EwaFile** (`ewa_file`). */
	content_manager_folder_item_id?: string;
	/** **EWRP** — open a specific completed presentation job (`ewrp_job_id` from companion). */
	ewrp_job_id?: string;
};

export type CompanionChatActionCloseApp = CompanionChatActionOutcomeFields & {
	type: 'close_app';
	app_component: string;
	rationale?: string;
};

export type CompanionChatActionFocusApp = CompanionChatActionOutcomeFields & {
	type: 'focus_app';
	app_component: string;
	rationale?: string;
};

export type CompanionChatActionMinimizeApp =
	CompanionChatActionOutcomeFields & {
		type: 'minimize_app';
		app_component: string;
		rationale?: string;
	};

/** Server-injected: start unified-content audio via global now-playing (no MusicPlayer window required). */
export type CompanionChatActionMusicPlayTrack =
	CompanionChatActionOutcomeFields & {
		type: 'music_play_track';
		unified_content_id: string;
		track_name: string;
		thumbnail_url?: string | null;
		rationale?: string;
	};

/** Injected by the server after full-document replace/translate; SPA applies HTML in the open Doc Editor. */
export type CompanionChatActionDocEditorSetBody =
	CompanionChatActionOutcomeFields & {
		type: 'doc_editor_set_body';
		app_component: string;
		body_html: string;
		rationale?: string;
		unified_content_id?: string;
	};

/** Tray-only notice when a server tool failed without emitting a desktop action. */
export type CompanionChatActionNotice =
	CompanionChatOpenApiSchemas['CompanionActionNotice'] &
		CompanionChatActionOutcomeFields;

export type CompanionChatAction =
	| CompanionChatActionOpenApp
	| CompanionChatActionCloseApp
	| CompanionChatActionFocusApp
	| CompanionChatActionMinimizeApp
	| CompanionChatActionMusicPlayTrack
	| CompanionChatActionDocEditorSetBody
	| CompanionChatActionNotice;

/** OpenAPI `CompanionActionOutcome` — tray/dispatch result for companion actions. */
export const companionActionOutcomeSchema = z.enum(['ok', 'blocked', 'failed']);

/**
 * OpenAPI `CompanionChatAction` base envelope (`type`, optional `outcome`, optional `rationale`).
 * Additional action fields are allowed (`additionalProperties: true` in the pilot).
 */
export const companionChatActionEnvelopeSchema = z
	.object({
		type: z.string(),
		outcome: companionActionOutcomeSchema.optional(),
		rationale: z.string().optional(),
	})
	.catchall(z.unknown());

/** OpenAPI `CompanionActionNotice` — tray-only row when a tool fails without desktop actions. */
export const companionActionNoticeSchema = z
	.object({
		type: z.literal('companion_action_notice'),
		outcome: companionActionOutcomeSchema.optional(),
		rationale: z.string().max(500).optional(),
	})
	.strict();

function parseCompanionActionOutcome(
	raw: unknown
): CompanionChatActionOutcome | undefined {
	if (typeof raw !== 'string') return undefined;
	const v = raw.trim().toLowerCase();
	const parsed = companionActionOutcomeSchema.safeParse(v);
	return parsed.success ? parsed.data : undefined;
}

function companionActionTaskRunIdFromRec(
	rec: Record<string, unknown>
): string | undefined {
	const snake =
		typeof rec.task_run_id === 'string' ? rec.task_run_id.trim() : '';
	const camel = typeof rec.taskRunId === 'string' ? rec.taskRunId.trim() : '';
	const id = snake || camel;
	return id || undefined;
}

function withCompanionActionTaskRunId<T extends CompanionChatAction>(
	action: T,
	rec: Record<string, unknown>
): T {
	const taskRunId = companionActionTaskRunIdFromRec(rec);
	return taskRunId ? { ...action, task_run_id: taskRunId } : action;
}

export function coerceCompanionActions(raw: unknown): CompanionChatAction[] {
	let list = raw;
	if (typeof raw === 'string') {
		const s = raw.trim();
		if (!s.startsWith('[')) {
			return [];
		}
		try {
			list = JSON.parse(s) as unknown;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_actions_json_coerce',
				'companion actions JSON string parse failed',
				err
			);
			return [];
		}
	}
	if (!Array.isArray(list)) return [];
	const out: CompanionChatAction[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const rec = item as Record<string, unknown>;
		const rawType = rec.type;
		const normalizedType =
			typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';

		const componentRaw =
			typeof rec.app_component === 'string'
				? rec.app_component
				: typeof rec.appComponent === 'string'
					? rec.appComponent
					: null;
		const component = componentRaw?.trim() || '';

		if (normalizedType === 'companion_action_notice') {
			const noticeCandidate: {
				type: 'companion_action_notice';
				outcome?: CompanionChatActionOutcome;
				rationale?: string;
			} = { type: 'companion_action_notice' };
			if (rec.outcome !== undefined && rec.outcome !== null) {
				const outcomeNotice = parseCompanionActionOutcome(rec.outcome);
				if (outcomeNotice === undefined) continue;
				noticeCandidate.outcome = outcomeNotice;
			}
			const rationaleNotice =
				typeof rec.rationale === 'string' && rec.rationale.trim()
					? rec.rationale.trim()
					: undefined;
			if (rationaleNotice) noticeCandidate.rationale = rationaleNotice;
			const validated = companionActionNoticeSchema.safeParse(noticeCandidate);
			if (!validated.success) continue;
			const notice: CompanionChatActionNotice = {
				type: 'companion_action_notice',
				outcome: validated.data.outcome ?? 'failed',
				...(validated.data.rationale
					? { rationale: validated.data.rationale }
					: {}),
			};
			out.push(withCompanionActionTaskRunId(notice, rec));
			continue;
		}

		if (normalizedType === 'music_play_track') {
			const unified = normalizeUnifiedContentId(rec) ?? '';
			if (!unified) continue;
			const tnSnake =
				typeof rec.track_name === 'string' ? rec.track_name.trim() : '';
			const tnCamel =
				typeof rec.trackName === 'string' ? rec.trackName.trim() : '';
			const nameSnake = typeof rec.name === 'string' ? rec.name.trim() : '';
			const trackName = (tnSnake || tnCamel || nameSnake || unified).slice(
				0,
				240
			);
			const thumbSnake =
				typeof rec.thumbnail_url === 'string' ? rec.thumbnail_url.trim() : '';
			const thumbCamel =
				typeof rec.thumbnailUrl === 'string' ? rec.thumbnailUrl.trim() : '';
			const thumb = thumbSnake || thumbCamel;
			const rationaleMp =
				typeof rec.rationale === 'string' && rec.rationale.trim()
					? rec.rationale.trim()
					: undefined;
			const outcomeMp = parseCompanionActionOutcome(rec.outcome);
			const mpt: CompanionChatActionMusicPlayTrack = {
				type: 'music_play_track',
				unified_content_id: unified,
				track_name: trackName,
				...(thumb ? { thumbnail_url: thumb } : {}),
				...(rationaleMp ? { rationale: rationaleMp } : {}),
				...(outcomeMp ? { outcome: outcomeMp } : {}),
			};
			out.push(withCompanionActionTaskRunId(mpt, rec));
			continue;
		}

		if (normalizedType === 'doc_editor_set_body') {
			if (component !== 'DocEditor') continue;
			const bodySnake =
				typeof rec.body_html === 'string' ? rec.body_html.trim() : '';
			const bodyCamel =
				typeof rec.bodyHtml === 'string' ? rec.bodyHtml.trim() : '';
			const body = bodySnake || bodyCamel;
			if (!body) continue;
			const rationaleEarly =
				typeof rec.rationale === 'string' && rec.rationale.trim()
					? rec.rationale.trim()
					: undefined;
			const outcomeEarly = parseCompanionActionOutcome(rec.outcome);
			const setBodyAct: CompanionChatActionDocEditorSetBody = {
				type: 'doc_editor_set_body',
				app_component: component,
				body_html: body,
				...(rationaleEarly ? { rationale: rationaleEarly } : {}),
				...(outcomeEarly ? { outcome: outcomeEarly } : {}),
			};
			const unifiedEarly = normalizeUnifiedContentId(rec) ?? '';
			if (unifiedEarly) setBodyAct.unified_content_id = unifiedEarly;
			out.push(withCompanionActionTaskRunId(setBodyAct, rec));
			continue;
		}

		if (
			normalizedType !== 'open_app' &&
			normalizedType !== 'close_app' &&
			normalizedType !== 'focus_app' &&
			normalizedType !== 'minimize_app'
		) {
			continue;
		}
		if (!component) continue;
		const rationale =
			typeof rec.rationale === 'string' && rec.rationale.trim()
				? rec.rationale.trim()
				: undefined;
		const outcome = parseCompanionActionOutcome(rec.outcome);

		if (normalizedType === 'open_app') {
			const openAct: CompanionChatActionOpenApp = {
				type: 'open_app',
				app_component: component,
				...(rationale ? { rationale } : {}),
				...(outcome ? { outcome } : {}),
			};
			const unified = normalizeUnifiedContentId(rec) ?? '';
			if (unified) openAct.unified_content_id = unified;
			const cmSnake =
				typeof rec.content_manager_focus_unified_content_id === 'string'
					? rec.content_manager_focus_unified_content_id.trim()
					: '';
			const cmCamel =
				typeof rec.contentManagerFocusUnifiedContentId === 'string'
					? rec.contentManagerFocusUnifiedContentId.trim()
					: '';
			const cm = cmSnake || cmCamel;
			if (cm) openAct.content_manager_focus_unified_content_id = cm;
			const cifRaw =
				rec.content_manager_initial_filter ?? rec.contentManagerInitialFilter;
			if (cifRaw && typeof cifRaw === 'object' && !Array.isArray(cifRaw)) {
				const cifRec = cifRaw as Record<string, unknown>;
				const cqSnake =
					typeof cifRec.search_query === 'string'
						? cifRec.search_query.trim()
						: '';
				const cqCamel =
					typeof cifRec.searchQuery === 'string'
						? cifRec.searchQuery.trim()
						: '';
				const cq = cqSnake || cqCamel;
				if (cq && component.trim().toLowerCase() === 'contentmanagerpro') {
					openAct.content_manager_initial_filter = {
						search_query: cq.slice(0, 500),
					};
				}
			}
			const folderSnake =
				typeof rec.content_manager_folder_item_id === 'string'
					? rec.content_manager_folder_item_id.trim()
					: '';
			const folderCamel =
				typeof rec.contentManagerFolderItemId === 'string'
					? rec.contentManagerFolderItemId.trim()
					: '';
			const folderId = folderSnake || folderCamel;
			if (folderId && component.trim().toLowerCase() === 'contentmanagerpro') {
				openAct.content_manager_folder_item_id = folderId.slice(0, 128);
			}
			const ewrpJobSnake =
				typeof rec.ewrp_job_id === 'string' ? rec.ewrp_job_id.trim() : '';
			const ewrpJobCamel =
				typeof rec.ewrpJobId === 'string' ? rec.ewrpJobId.trim() : '';
			const ewrpJobId = ewrpJobSnake || ewrpJobCamel;
			const normalizedComponent = component.trim().toLowerCase();
			if (
				ewrpJobId &&
				(normalizedComponent === 'ewrp' ||
					normalizedComponent === 'presentations' ||
					normalizedComponent === 'presentationsarchive')
			) {
				openAct.ewrp_job_id = ewrpJobId.slice(0, 128);
			}
			const surfaceOnlyRaw =
				rec.companion_surface_only ?? rec.companionSurfaceOnly;
			if (surfaceOnlyRaw === true) {
				openAct.companion_surface_only = true;
			}
			const openOnDeskRaw = rec.open_on_desk ?? rec.openOnDesk;
			if (openOnDeskRaw === true) {
				openAct.open_on_desk = true;
			}
			out.push(withCompanionActionTaskRunId(openAct, rec));
			continue;
		}

		const simple: CompanionChatAction =
			normalizedType === 'close_app'
				? {
						type: 'close_app',
						app_component: component,
						...(rationale ? { rationale } : {}),
						...(outcome ? { outcome } : {}),
					}
				: normalizedType === 'focus_app'
					? {
							type: 'focus_app',
							app_component: component,
							...(rationale ? { rationale } : {}),
							...(outcome ? { outcome } : {}),
						}
					: {
							type: 'minimize_app',
							app_component: component,
							...(rationale ? { rationale } : {}),
							...(outcome ? { outcome } : {}),
						};
		out.push(withCompanionActionTaskRunId(simple, rec));
	}
	return out;
}
