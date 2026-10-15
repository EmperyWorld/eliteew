/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workflow completion summaries, step artifact extraction, and live task-event run merges.
 *
 * Invariants:
 * - Workflow summary freshness window is owned by WORKFLOW_SUMMARY_FRESH_MS.
 * - Live task_step merges never invent a run_id; missing id is a no-op.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/operationLabels.ts
 */

import {
	filterRunsForOperationsDisplay,
	isUserActionWorkflowRun,
	mergeOperationRuns,
	sortOperationRuns,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import {
	workflowStepToolKind,
	workflowStepVisualState,
} from '@/features/ewa/companionOperations/progressUi/operationLabels';
import {
	WORKFLOW_SUMMARY_FRESH_MS,
	type WorkflowCompletionSummaryItem,
	type WorkflowStepArtifact,
	type WorkflowStepResultRow,
} from '@/features/ewa/companionOperations/progressUi/progressUiTypes';
import { resolveOperationImagePreviewUrl } from '@/features/ewa/companionOperations/progressUi/readyArtifacts';
import { normalizeUnifiedContentId } from '@/services/audio/playerAudioContracts';
import type {
	CompanionTaskStepPayload,
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

function workflowRunDisplayTitle(run: EwaCompanionTaskRun): string {
	const plan = run.plan_payload || {};
	const titleRu =
		typeof plan.workflow_title_ru === 'string'
			? plan.workflow_title_ru.trim()
			: '';
	const titleEn =
		typeof plan.workflow_title_en === 'string'
			? plan.workflow_title_en.trim()
			: '';
	const userLine = run.user_message?.trim() || '';
	return titleRu || titleEn || userLine || 'Workflow';
}

function contentIdFromPayload(payload: Record<string, unknown>): string {
	return normalizeUnifiedContentId(payload) ?? '';
}

function parseCatalogAppendixFileNames(appendix: string, max = 6): string[] {
	const names: string[] = [];
	for (const line of appendix.split('\n')) {
		const match = line.match(/^-\s+(.+?)\s+`uc=/);
		if (match?.[1]) names.push(match[1].trim());
	}
	return names.slice(0, max);
}

/** Unwrap Celery tool-dispatch envelope ``{ data, reply, tool_name }`` for UI helpers. */
export function resolveWorkflowStepOutputPayload(
	step: EwaCompanionTaskStep
): Record<string, unknown> {
	const raw =
		step.output_payload && typeof step.output_payload === 'object'
			? (step.output_payload as Record<string, unknown>)
			: {};
	const data =
		raw.data && typeof raw.data === 'object'
			? (raw.data as Record<string, unknown>)
			: {};
	const nested = Object.keys(data).length > 0 ? { ...data } : { ...raw };
	const reply =
		typeof raw.reply === 'string' && raw.reply.trim()
			? raw.reply.trim()
			: typeof nested.reply === 'string' && nested.reply.trim()
				? nested.reply.trim()
				: '';
	if (reply) nested.reply = reply;
	const toolName =
		typeof raw.tool_name === 'string' && raw.tool_name.trim()
			? raw.tool_name.trim()
			: typeof nested.tool_name === 'string' && nested.tool_name.trim()
				? nested.tool_name.trim()
				: '';
	if (toolName) nested.tool_name = toolName;
	return nested;
}

function workflowStepReplyText(
	output: Record<string, unknown>,
	toolKind: string
): string {
	const reply = typeof output.reply === 'string' ? output.reply.trim() : '';
	if (reply) return reply;
	if (toolKind === 'catalog_discuss') {
		const memory =
			typeof output.memory_section_append === 'string'
				? output.memory_section_append.trim()
				: '';
		if (memory) return memory;
	}
	return '';
}

function workflowStepErrorMessage(step: EwaCompanionTaskStep): string | null {
	const err =
		step.error_payload && typeof step.error_payload === 'object'
			? (step.error_payload as Record<string, unknown>)
			: {};
	const message =
		typeof err.message === 'string'
			? err.message.trim()
			: typeof err.error === 'string'
				? err.error.trim()
				: '';
	return message || null;
}

/** Collect interactive artifacts from completed workflow steps (images, tracks, files, catalog, text). */
export function extractWorkflowStepArtifacts(
	run: EwaCompanionTaskRun
): WorkflowStepArtifact[] {
	if (!isUserActionWorkflowRun(run)) return [];
	const steps = [...(run.steps ?? [])].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);
	const artifacts: WorkflowStepArtifact[] = [];
	for (const step of steps) {
		if (workflowStepVisualState(step) !== 'completed') continue;
		const toolKind = workflowStepToolKind(step);
		const output = resolveWorkflowStepOutputPayload(step);
		const label = (step.title || toolKind || 'step').trim();

		if (toolKind === 'image_generation') {
			const previewUrl = resolveOperationImagePreviewUrl(output);
			const unifiedContentId = contentIdFromPayload(output);
			if (!previewUrl || !unifiedContentId) continue;
			const promptPreview =
				typeof output.prompt_preview === 'string' &&
				output.prompt_preview.trim()
					? output.prompt_preview.trim()
					: unifiedContentId;
			artifacts.push({
				kind: 'image',
				stepIndex: step.step_index || 0,
				label,
				unifiedContentId,
				promptPreview,
				previewUrl,
			});
			continue;
		}

		if (
			toolKind === 'music_generation_xl_base' ||
			toolKind === 'music_generation'
		) {
			const unifiedContentId = contentIdFromPayload(output);
			if (!unifiedContentId) continue;
			const trackName =
				typeof output.track_name === 'string' && output.track_name.trim()
					? output.track_name.trim()
					: typeof output.name === 'string' && output.name.trim()
						? output.name.trim()
						: '';
			const thumbnailUrl =
				typeof output.thumbnail_url === 'string' && output.thumbnail_url.trim()
					? output.thumbnail_url.trim()
					: null;
			artifacts.push({
				kind: 'music',
				stepIndex: step.step_index || 0,
				label,
				unifiedContentId,
				trackName,
				thumbnailUrl,
			});
			continue;
		}

		if (toolKind === 'file_create' || toolKind === 'file_rewrite') {
			const inp = step.input_payload;
			const args =
				inp && typeof inp === 'object' ? (inp as Record<string, unknown>) : {};
			const fromOutput =
				typeof output.name === 'string' ? output.name.trim() : '';
			const fromArgs = typeof args.name === 'string' ? args.name.trim() : '';
			const fileName = fromOutput || fromArgs;
			if (!fileName) continue;
			artifacts.push({
				kind: 'file',
				stepIndex: step.step_index || 0,
				label,
				fileName,
				unifiedContentId: contentIdFromPayload(output) || null,
			});
			continue;
		}

		if (toolKind === 'catalog_list') {
			const rowCount =
				typeof output.row_count === 'number' &&
				Number.isFinite(output.row_count)
					? Math.max(0, Math.trunc(output.row_count))
					: 0;
			const appendix =
				typeof output.catalog_appendix === 'string'
					? output.catalog_appendix
					: '';
			const fileNames = parseCatalogAppendixFileNames(appendix);
			if (rowCount <= 0 && fileNames.length === 0) continue;
			artifacts.push({
				kind: 'catalog',
				stepIndex: step.step_index || 0,
				label,
				rowCount: rowCount || fileNames.length,
				fileNames,
			});
			continue;
		}

		if (toolKind === 'presentation_generation') {
			const jobId =
				typeof output.ewrp_job_id === 'string' && output.ewrp_job_id.trim()
					? output.ewrp_job_id.trim()
					: typeof output.job_id === 'string' && output.job_id.trim()
						? output.job_id.trim()
						: '';
			if (!jobId) continue;
			const title =
				typeof output.title === 'string' && output.title.trim()
					? output.title.trim()
					: label;
			const topic =
				typeof output.topic === 'string' && output.topic.trim()
					? output.topic.trim()
					: '';
			artifacts.push({
				kind: 'presentation',
				stepIndex: step.step_index || 0,
				label,
				jobId,
				title,
				topic,
			});
			continue;
		}

		if (toolKind === 'plan_v1') {
			const planId =
				typeof output.plan_id === 'string' && output.plan_id.trim()
					? output.plan_id.trim()
					: '';
			const body = workflowStepReplyText(output, toolKind);
			if (!planId && !body) continue;
			artifacts.push({
				kind: 'plan',
				stepIndex: step.step_index || 0,
				label,
				planId: planId || 'plan',
				body: body || planId,
			});
			continue;
		}

		const body = workflowStepReplyText(output, toolKind);
		if (body.length >= 8) {
			artifacts.push({
				kind: 'text',
				stepIndex: step.step_index || 0,
				label,
				toolKind,
				body,
			});
		}
	}
	return artifacts;
}

/** Per-step review rows for workflow result panel (completed + failed steps). */
export function extractWorkflowStepResultRows(
	run: EwaCompanionTaskRun
): WorkflowStepResultRow[] {
	if (!isUserActionWorkflowRun(run)) return [];
	const steps = [...(run.steps ?? [])].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);
	const artifacts = extractWorkflowStepArtifacts(run);
	const artifactByStep = new Map<number, WorkflowStepArtifact>();
	for (const artifact of artifacts) {
		if (!artifactByStep.has(artifact.stepIndex)) {
			artifactByStep.set(artifact.stepIndex, artifact);
		}
	}
	return steps.map((step) => {
		const stepIndex = step.step_index || 0;
		const toolKind = workflowStepToolKind(step);
		const label = (step.title || toolKind || 'step').trim();
		const status = workflowStepVisualState(step);
		const output = resolveWorkflowStepOutputPayload(step);
		const text =
			status === 'completed' ? workflowStepReplyText(output, toolKind) : null;
		return {
			stepIndex,
			label,
			toolKind,
			status,
			text: text && text.length >= 8 ? text : null,
			errorMessage: status === 'failed' ? workflowStepErrorMessage(step) : null,
			artifact: artifactByStep.get(stepIndex) ?? null,
		};
	});
}

/** Recently finished user workflows → rich in-chat summary cards. */
export function deriveTranscriptWorkflowSummaries(
	runs: EwaCompanionTaskRun[]
): WorkflowCompletionSummaryItem[] {
	const now = Date.now();
	const out: WorkflowCompletionSummaryItem[] = [];
	for (const run of sortOperationRuns(filterRunsForOperationsDisplay(runs))) {
		if (!isUserActionWorkflowRun(run)) continue;
		const st = (run.status || '').trim().toLowerCase();
		if (st !== 'completed' && st !== 'failed') continue;
		const completedAtMs =
			Date.parse(run.completed_at || '') ||
			Date.parse(run.updated_at || '') ||
			Date.parse(run.created_at || '') ||
			0;
		if (!Number.isFinite(completedAtMs)) continue;
		if (now - completedAtMs > WORKFLOW_SUMMARY_FRESH_MS) continue;
		const artifacts = extractWorkflowStepArtifacts(run);
		const stepResults = extractWorkflowStepResultRows(run);
		out.push({
			runId: run.id,
			title: workflowRunDisplayTitle(run),
			completedAtMs,
			failed: st === 'failed',
			artifacts,
			stepResults,
		});
	}
	return out.sort((a, b) => b.completedAtMs - a.completedAtMs);
}

/** Merge live SSE ``task_step`` into polled operation runs for immediate UI refresh. */
export function mergeTaskStepIntoOperationRuns(
	runs: EwaCompanionTaskRun[],
	payload: CompanionTaskStepPayload
): EwaCompanionTaskRun[] {
	const runId = payload.run_id?.trim();
	if (!runId) return runs;
	const stepIndex =
		typeof payload.step_index === 'number' &&
		Number.isFinite(payload.step_index)
			? Math.trunc(payload.step_index)
			: 0;
	const nextStep: EwaCompanionTaskStep = {
		id: `${runId}:${stepIndex}:${payload.step_kind || 'step'}`,
		run_id: runId,
		step_index: stepIndex,
		step_kind: payload.step_kind?.trim() || '',
		status: payload.status?.trim() || 'in_progress',
		title: payload.title?.trim() || '',
		input_payload: {},
		output_payload: {},
		error_payload: {},
		created_at: null,
		updated_at: null,
		completed_at: null,
	};
	const progress = payload.progress;
	const music_pipeline_progress =
		progress?.current &&
		progress?.total &&
		Number.isFinite(progress.current) &&
		Number.isFinite(progress.total)
			? {
					current: Math.max(
						1,
						Math.min(Math.trunc(progress.current), Math.trunc(progress.total))
					),
					total: Math.max(1, Math.trunc(progress.total)),
					title: payload.title?.trim() || '',
				}
			: undefined;
	return mergeOperationRuns(
		runs.map((run) => {
			if (run.id !== runId) return run;
			const steps = [...(run.steps ?? [])];
			const existingIdx = steps.findIndex((s) => s.step_index === stepIndex);
			if (existingIdx >= 0) {
				steps[existingIdx] = { ...steps[existingIdx], ...nextStep };
			} else {
				steps.push(nextStep);
			}
			return {
				...run,
				steps,
				music_pipeline_progress:
					music_pipeline_progress ?? run.music_pipeline_progress,
			};
		}),
		[]
	);
}

export function applyTaskTerminalToOperationRuns(
	runs: EwaCompanionTaskRun[],
	payload: {
		run_id: string;
		status?: string;
		result_payload?: Record<string, unknown>;
		error_payload?: Record<string, unknown>;
	},
	terminalStatus: 'completed' | 'failed'
): EwaCompanionTaskRun[] {
	const runId = payload.run_id?.trim();
	if (!runId) return runs;
	return runs.map((run) => {
		if (run.id !== runId) return run;
		return {
			...run,
			status: terminalStatus,
			result_payload:
				terminalStatus === 'completed'
					? { ...run.result_payload, ...(payload.result_payload ?? {}) }
					: run.result_payload,
			error_payload:
				terminalStatus === 'failed'
					? { ...run.error_payload, ...(payload.error_payload ?? {}) }
					: run.error_payload,
			music_pipeline_progress: undefined,
			completed_at: new Date().toISOString(),
		};
	});
}
