/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion chat SSE streaming: POST /stream consumer, Zod boundaries for SSE payloads,
 * task lifecycle event parsers, and shared SSE block iteration helpers.
 *
 * Invariants:
 * - Streaming consumer tolerates torn connections; callers fall back to synchronous POST /message.
 * - Primary SSE `data:` payloads (`delta`, `final`, `actions`, `error`) validated with Zod before handlers run.
 * - SSE may emit `transform` before `delta` (`kind`: `arlika` forward clip or `ewa_restore` reverse clip).
 *
 * Related:
 * - ewaCompanionChatMessageApi.ts — CompanionChatRequestBody and sync fallback
 * - ewaCompanionChatCoerce.ts — final/actions coercion
 * - src/generated/ewa-companion-chat-openapi.ts
 */
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import type { components } from '@/generated/ewa-companion-chat-openapi';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiFetchWithAuth } from '@/services/api/client';
import { z } from 'zod';
import {
	type CompanionChatAction,
	type CompanionChatMessageResponse,
	type EwaCompanionTaskRun,
	coerceCompanionActions,
	coerceCompanionSurfaceBlocks,
	coerceCompanionWebSearchResult,
	coerceExecutionReports,
	coerceProactiveSuggestion,
	coerceToolTrace,
} from './ewaCompanionChatCoerce';
import type { CompanionChatRequestBody } from './ewaCompanionChatMessageApi';

type CompanionChatOpenApiSchemas = components['schemas'];

/** OpenAPI pilot SSE `data:` payloads — regenerate via `pnpm run openapi:pilot:ewa-companion-chat`. */
export type CompanionChatStreamDeltaEvent =
	CompanionChatOpenApiSchemas['CompanionChatStreamDelta'];
export type CompanionChatStreamFinalEvent =
	CompanionChatOpenApiSchemas['CompanionChatStreamFinal'];
export type CompanionChatStreamActionsEvent =
	CompanionChatOpenApiSchemas['CompanionChatStreamActions'];
export type CompanionChatStreamErrorEvent =
	CompanionChatOpenApiSchemas['CompanionChatStreamError'];
/** Stream POST body (`CompanionChatMessageIn` in the pilot). */
export type CompanionChatMessageInBody =
	CompanionChatOpenApiSchemas['CompanionChatMessageIn'];

/** SSE `task_accepted` when async companion work is enqueued. */
export type CompanionTaskAcceptedPayload = {
	run_id: string;
	status?: string;
	intent_kind?: string;
	execution_mode?: string;
	orchestration_branch?: string;
};

/** SSE `task_step` progress for a durable companion run. */
export type CompanionTaskStepPayload = {
	run_id: string;
	step_index?: number;
	step_kind?: string;
	status?: string;
	title?: string;
	progress?: { current?: number; total?: number };
};

/** SSE terminal task lifecycle payloads. */
export type CompanionTaskTerminalPayload = {
	run_id: string;
	status?: string;
	intent_kind?: string;
	result_payload?: Record<string, unknown>;
	error_payload?: Record<string, unknown>;
	stage?: string;
};

/** SSE `task_awaiting_confirmation` when a durable run needs explicit confirm (Phase 3). */
export type CompanionTaskAwaitingConfirmationPayload = {
	run_id: string;
	status?: string;
	intent_kind?: string;
	plan_kind?: string;
};

/** SSE `transform` event before deltas when Arlika transformation fires. */
export type CompanionChatTransformPayload = {
	kind?: string;
	show_dramatic_video?: boolean;
};

export type CompanionTurnStagePayload = {
	stage: 'preparing_context' | 'composing_reply' | string;
	heavy_steps_skipped?: boolean;
	orchestration_branch?: string | null;
};

export const COMPANION_CHAT_STREAM_PATH = '/ewa/companion-chat/stream' as const;

/** OpenAPI `CompanionChatStreamDelta` — SSE `delta` payload (`chunk` required). */
export const companionChatStreamDeltaSchema = z
	.object({
		chunk: z.string(),
	})
	.strict();

/** OpenAPI `CompanionChatStreamFinal` — SSE `final` payload (`reply`, `companion_revision` required). */
export const companionChatStreamFinalSchema = z
	.object({
		reply: z.string(),
		companion_revision: z.number().int().min(1),
		actions: z.array(z.unknown()).optional(),
		task_run: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
		transformed_this_turn: z.boolean().optional(),
		transform_event_kind: z.union([z.string(), z.null()]).optional(),
		desktop_config_patch_applied: z.boolean().optional(),
		turn_plan_hint: z.union([z.string(), z.null()]).optional(),
		turn_plan_next_tool: z.union([z.string(), z.null()]).optional(),
		turn_plan_source: z.union([z.string(), z.null()]).optional(),
		surface_blocks: z.array(z.unknown()).optional(),
		output_surface: z
			.union([z.record(z.string(), z.unknown()), z.null()])
			.optional(),
	})
	.catchall(z.unknown());

/** OpenAPI `CompanionChatStreamActions` — SSE `actions` envelope. */
export const companionChatStreamActionsSchema = z
	.object({
		actions: z.array(z.unknown()),
	})
	.strict();

/** OpenAPI `CompanionChatStreamError` — SSE `error` payload (`code` required). */
export const companionChatStreamErrorSchema = z
	.object({
		code: z.string().min(1),
	})
	.strict();

function parseCompanionChatStreamJsonPayload<T>(
	raw: string,
	schema: z.ZodType<T>,
	context: string
): T | null {
	try {
		const parsed = schema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch (err) {
		ewaCompanionDegradeDebug(
			context,
			'companion chat SSE JSON payload parse failed',
			err
		);
		return null;
	}
}

/** Zod boundary for SSE **`delta`** `data:` JSON before **`onDelta`**. */
export function parseCompanionChatStreamDeltaPayload(
	raw: string
): CompanionChatStreamDeltaEvent | null {
	return parseCompanionChatStreamJsonPayload(
		raw,
		companionChatStreamDeltaSchema,
		'companion_chat_sse_delta'
	);
}

/** Zod boundary for SSE **`final`** `data:` JSON before **`onFinal`**. */
export function parseCompanionChatStreamFinalPayload(
	raw: string
): CompanionChatStreamFinalEvent | null {
	const parsed = parseCompanionChatStreamJsonPayload(
		raw,
		companionChatStreamFinalSchema,
		'companion_chat_sse_final'
	);
	return parsed as CompanionChatStreamFinalEvent | null;
}

/** Zod boundary for SSE **`actions`** `data:` JSON before **`coerceCompanionActions`**. */
export function parseCompanionChatStreamActionsPayload(
	raw: string
): CompanionChatStreamActionsEvent | null {
	const parsed = parseCompanionChatStreamJsonPayload(
		raw,
		companionChatStreamActionsSchema,
		'companion_chat_sse_actions'
	);
	return parsed as CompanionChatStreamActionsEvent | null;
}

/** Zod boundary for SSE **`error`** `data:` JSON before **`onError`**. */
export function parseCompanionChatStreamErrorPayload(
	raw: string
): CompanionChatStreamErrorEvent | null {
	return parseCompanionChatStreamJsonPayload(
		raw,
		companionChatStreamErrorSchema,
		'companion_chat_sse_error'
	);
}

function buildCompanionChatMessageFromStreamFinal(
	parsed: z.infer<typeof companionChatStreamFinalSchema>
): CompanionChatMessageResponse {
	const tph = parsed.turn_plan_hint;
	const tpt = parsed.turn_plan_next_tool;
	const tps = parsed.turn_plan_source;
	const fk = parsed.transform_event_kind;
	const toolTraceRaw = parsed.tool_trace;
	const webSearchRaw = parsed.web_search_result;
	return {
		reply: parsed.reply,
		companion_revision: parsed.companion_revision,
		task_run: parsed.task_run ?? null,
		actions: coerceCompanionActions(parsed.actions),
		surface_blocks: coerceCompanionSurfaceBlocks(parsed.surface_blocks),
		output_surface:
			parsed.output_surface && typeof parsed.output_surface === 'object'
				? {
						mode:
							typeof parsed.output_surface.mode === 'string'
								? parsed.output_surface.mode
								: '',
						payload:
							parsed.output_surface.payload &&
							typeof parsed.output_surface.payload === 'object' &&
							!Array.isArray(parsed.output_surface.payload)
								? (parsed.output_surface.payload as Record<string, unknown>)
								: undefined,
					}
				: null,
		turn_plan_hint: typeof tph === 'string' && tph.trim() ? tph.trim() : null,
		turn_plan_next_tool:
			typeof tpt === 'string' && tpt.trim() ? tpt.trim() : null,
		turn_plan_source: typeof tps === 'string' && tps.trim() ? tps.trim() : null,
		transformed_this_turn: Boolean(parsed.transformed_this_turn),
		transform_event_kind:
			typeof fk === 'string' && fk.trim() ? fk.trim() : null,
		desktop_config_patch_applied: Boolean(parsed.desktop_config_patch_applied),
		execution_reports: coerceExecutionReports(parsed.execution_reports),
		tool_trace: coerceToolTrace(toolTraceRaw),
		web_search_result: coerceCompanionWebSearchResult(webSearchRaw),
		orchestration_outcome:
			typeof parsed.orchestration_outcome === 'string'
				? parsed.orchestration_outcome
				: null,
		proactive_suggestion: coerceProactiveSuggestion(
			parsed.proactive_suggestion
		),
	};
}

export type CompanionChatStreamHandlers = {
	onDelta?: (chunk: string) => void;
	onTurnStage?: (payload: CompanionTurnStagePayload) => void;
	onActions?: (actions: CompanionChatAction[]) => void;
	onTransform?: (payload: CompanionChatTransformPayload) => void;
	onTaskAccepted?: (payload: CompanionTaskAcceptedPayload) => void;
	onTaskStep?: (payload: CompanionTaskStepPayload) => void;
	onTaskCompleted?: (payload: CompanionTaskTerminalPayload) => void;
	onTaskFailed?: (payload: CompanionTaskTerminalPayload) => void;
	onTaskAwaitingConfirmation?: (
		payload: CompanionTaskAwaitingConfirmationPayload
	) => void;
	/** Per-run SSE reconnect baseline (``GET …/task-runs/{id}/events``). */
	onRunSnapshot?: (run: EwaCompanionTaskRun) => void;
	onFinal?: (data: CompanionChatMessageResponse) => void;
	onError?: (code: string) => void;
	signal?: AbortSignal;
};

export function parseCompanionTurnStagePayload(
	raw: string
): CompanionTurnStagePayload | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const stage = typeof parsed.stage === 'string' ? parsed.stage.trim() : '';
		if (!stage) return null;
		const branchRaw = parsed.orchestration_branch;
		return {
			stage,
			heavy_steps_skipped:
				typeof parsed.heavy_steps_skipped === 'boolean'
					? parsed.heavy_steps_skipped
					: undefined,
			orchestration_branch:
				typeof branchRaw === 'string' && branchRaw.trim()
					? branchRaw.trim()
					: branchRaw === null
						? null
						: undefined,
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_sse_turn_stage',
			'SSE turn_stage payload parse failed',
			err
		);
		return null;
	}
}

export function parseTaskAcceptedPayload(
	raw: string
): CompanionTaskAcceptedPayload | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const runIdRaw =
			typeof parsed.run_id === 'string'
				? parsed.run_id.trim()
				: typeof parsed.linked_task_run_id === 'string'
					? parsed.linked_task_run_id.trim()
					: '';
		const runId = runIdRaw;
		if (!runId) return null;
		return {
			run_id: runId,
			status:
				typeof parsed.status === 'string' ? parsed.status.trim() : undefined,
			intent_kind:
				typeof parsed.intent_kind === 'string'
					? parsed.intent_kind.trim()
					: undefined,
			execution_mode:
				typeof parsed.execution_mode === 'string'
					? parsed.execution_mode.trim()
					: undefined,
			orchestration_branch:
				typeof parsed.orchestration_branch === 'string'
					? parsed.orchestration_branch.trim()
					: undefined,
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_sse_task_accepted',
			'SSE task_accepted payload parse failed',
			err
		);
		return null;
	}
}

export function parseTaskStepPayload(
	raw: string
): CompanionTaskStepPayload | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const runIdRaw =
			typeof parsed.run_id === 'string'
				? parsed.run_id.trim()
				: typeof parsed.linked_task_run_id === 'string'
					? parsed.linked_task_run_id.trim()
					: '';
		const runId = runIdRaw;
		if (!runId) return null;
		const progressRaw = parsed.progress;
		let progress: CompanionTaskStepPayload['progress'];
		if (
			progressRaw &&
			typeof progressRaw === 'object' &&
			!Array.isArray(progressRaw)
		) {
			const pr = progressRaw as Record<string, unknown>;
			progress = {
				current:
					typeof pr.current === 'number' && Number.isFinite(pr.current)
						? Math.trunc(pr.current)
						: undefined,
				total:
					typeof pr.total === 'number' && Number.isFinite(pr.total)
						? Math.trunc(pr.total)
						: undefined,
			};
		}
		return {
			run_id: runId,
			step_index:
				typeof parsed.step_index === 'number' &&
				Number.isFinite(parsed.step_index)
					? Math.trunc(parsed.step_index)
					: undefined,
			step_kind:
				typeof parsed.step_kind === 'string'
					? parsed.step_kind.trim()
					: undefined,
			status:
				typeof parsed.status === 'string' ? parsed.status.trim() : undefined,
			title: typeof parsed.title === 'string' ? parsed.title.trim() : undefined,
			progress,
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_sse_task_step',
			'SSE task_step payload parse failed',
			err
		);
		return null;
	}
}

export function parseTaskTerminalPayload(
	raw: string
): CompanionTaskTerminalPayload | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const runIdRaw =
			typeof parsed.run_id === 'string'
				? parsed.run_id.trim()
				: typeof parsed.linked_task_run_id === 'string'
					? parsed.linked_task_run_id.trim()
					: '';
		const runId = runIdRaw;
		if (!runId) return null;
		const asObj = (val: unknown): Record<string, unknown> | undefined =>
			val && typeof val === 'object' && !Array.isArray(val)
				? (val as Record<string, unknown>)
				: undefined;
		return {
			run_id: runId,
			status:
				typeof parsed.status === 'string' ? parsed.status.trim() : undefined,
			intent_kind:
				typeof parsed.intent_kind === 'string'
					? parsed.intent_kind.trim()
					: undefined,
			result_payload: asObj(parsed.result_payload),
			error_payload: asObj(parsed.error_payload),
			stage: typeof parsed.stage === 'string' ? parsed.stage.trim() : undefined,
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_sse_task_terminal',
			'SSE task terminal payload parse failed',
			err
		);
		return null;
	}
}

export function parseTaskAwaitingConfirmationPayload(
	raw: string
): CompanionTaskAwaitingConfirmationPayload | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const runIdRaw =
			typeof parsed.run_id === 'string'
				? parsed.run_id.trim()
				: typeof parsed.linked_task_run_id === 'string'
					? parsed.linked_task_run_id.trim()
					: '';
		const runId = runIdRaw;
		if (!runId) return null;
		return {
			run_id: runId,
			status:
				typeof parsed.status === 'string' ? parsed.status.trim() : undefined,
			intent_kind:
				typeof parsed.intent_kind === 'string'
					? parsed.intent_kind.trim()
					: undefined,
			plan_kind:
				typeof parsed.plan_kind === 'string'
					? parsed.plan_kind.trim()
					: undefined,
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_sse_task_awaiting_confirm',
			'SSE task awaiting_confirmation payload parse failed',
			err
		);
		return null;
	}
}

/** SSE event block: `event:` name + concatenated `data:` lines (RFC-style multi-line data is preserved). */
type ParsedSseBlock = { event: string; data: string };

export async function* iterateSseEventBlocks(
	res: Response
): AsyncGenerator<ParsedSseBlock> {
	const reader = res.body?.getReader();
	if (!reader) return;
	const decoder = new TextDecoder();
	let buf = '';
	let readResult = await reader.read();
	while (!readResult.done) {
		buf += decoder.decode(readResult.value, { stream: true });
		// SSE block delimiter is a blank line: spec uses \n\n; tolerate \r\n\r\n too.
		const blockDelim = /\r?\n\r?\n/;
		const blocks = buf.split(blockDelim);
		buf = blocks.pop() ?? '';
		for (const block of blocks) {
			let event = 'message';
			const dataLines: string[] = [];
			for (const rawLine of block.split(/\r?\n/)) {
				if (!rawLine || rawLine.startsWith(':')) continue;
				const colon = rawLine.indexOf(':');
				if (colon === -1) continue;
				const field = rawLine.slice(0, colon);
				const value = rawLine.slice(colon + 1).replace(/^ /, '');
				if (field === 'event') {
					event = value || 'message';
				} else if (field === 'data') {
					dataLines.push(value);
				}
			}
			if (dataLines.length === 0) continue;
			yield { event, data: dataLines.join('\n') };
		}
		readResult = await reader.read();
	}
}

const COMPANION_TASK_SSE_EVENTS = new Set([
	'task_accepted',
	'task_step',
	'task_completed',
	'task_failed',
	'task_awaiting_confirmation',
]);

export function dispatchCompanionTaskSseBlock(
	block: ParsedSseBlock,
	handlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
	>
): boolean {
	if (!COMPANION_TASK_SSE_EVENTS.has(block.event)) return false;
	if (block.event === 'task_accepted') {
		const payload = parseTaskAcceptedPayload(block.data);
		if (payload) handlers.onTaskAccepted?.(payload);
	} else if (block.event === 'task_step') {
		const payload = parseTaskStepPayload(block.data);
		if (payload) handlers.onTaskStep?.(payload);
	} else if (block.event === 'task_completed') {
		const payload = parseTaskTerminalPayload(block.data);
		if (payload) handlers.onTaskCompleted?.(payload);
	} else if (block.event === 'task_failed') {
		const payload = parseTaskTerminalPayload(block.data);
		if (payload) handlers.onTaskFailed?.(payload);
	} else if (block.event === 'task_awaiting_confirmation') {
		const payload = parseTaskAwaitingConfirmationPayload(block.data);
		if (payload) handlers.onTaskAwaitingConfirmation?.(payload);
	}
	return true;
}

/**
 * Stream companion chat response as SSE. Resolves once the server sends `done` (or `error`).
 * Throws on non-200 responses or torn connections so the caller can fall back to the synchronous endpoint.
 */
export async function streamEwaCompanionChatMessage(
	body: CompanionChatRequestBody,
	handlers: CompanionChatStreamHandlers
): Promise<void> {
	const root = API_OPTIONS.baseURL.replace(/\/$/, '');
	const url = `${root}${COMPANION_CHAT_STREAM_PATH}`;
	const res = await apiFetchWithAuth(url, {
		method: 'POST',
		headers: {
			Accept: 'text/event-stream',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
		signal: handlers.signal,
	});
	if (!res.ok) {
		throw new Error(`Companion chat stream HTTP ${res.status}`);
	}
	for await (const block of iterateSseEventBlocks(res)) {
		if (block.event === 'delta') {
			const parsed = parseCompanionChatStreamDeltaPayload(block.data);
			if (parsed?.chunk) handlers.onDelta?.(parsed.chunk);
		} else if (block.event === 'transform') {
			try {
				const parsed = JSON.parse(block.data) as CompanionChatTransformPayload;
				handlers.onTransform?.(parsed);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_chat_sse_transform',
					'malformed SSE transform payload',
					err
				);
			}
		} else if (block.event === 'actions') {
			const parsed = parseCompanionChatStreamActionsPayload(block.data);
			if (parsed) {
				const actions = coerceCompanionActions(parsed.actions);
				if (actions.length > 0) handlers.onActions?.(actions);
			}
		} else if (dispatchCompanionTaskSseBlock(block, handlers)) {
		} else if (block.event === 'turn_stage') {
			const payload = parseCompanionTurnStagePayload(block.data);
			if (payload) handlers.onTurnStage?.(payload);
		} else if (block.event === 'final') {
			let json: unknown;
			try {
				json = JSON.parse(block.data);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_chat_sse_final_raw',
					'SSE final event JSON parse failed',
					err
				);
				json = undefined;
			}
			if (json !== undefined) {
				const finalPayload = companionChatStreamFinalSchema.safeParse(json);
				if (finalPayload.success) {
					handlers.onFinal?.(
						buildCompanionChatMessageFromStreamFinal(finalPayload.data)
					);
				}
				const actionsRaw =
					json && typeof json === 'object' && !Array.isArray(json)
						? (json as Record<string, unknown>).actions
						: undefined;
				const actions = coerceCompanionActions(actionsRaw);
				if (actions.length > 0) handlers.onActions?.(actions);
			}
		} else if (block.event === 'error') {
			const parsed = parseCompanionChatStreamErrorPayload(block.data);
			handlers.onError?.(parsed?.code ?? 'companion_chat_stream_failure');
			return;
		} else if (block.event === 'done') {
			return;
		}
	}
}
