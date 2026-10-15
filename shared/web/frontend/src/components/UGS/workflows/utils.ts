/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for UGS workflow UI: payload normalization, labels, dates, and error formatting.
 *
 * Invariants:
 * - Workflow payload normalizers reject malformed rows before card rendering/history polling.
 * - User-facing labels/errors take `TFunction<'ugsHub'>` (or locale) — no hardcoded RU copy.
 * - Runtime error formatting must keep the original technical reason visible to operators.
 *
 * Related:
 * - components/UGS/UGSWorkflowsTab.tsx
 * - components/UGS/workflows/useUgsWorkflowsTabController.ts
 * - i18n/locales/en|ru/ugsHub.json
 */

import type { TFunction } from 'i18next';

import type {
	ErrorResponse,
	ExecutionsPayload,
	WorkflowExecutionRecord,
	WorkflowRecord,
	WorkflowsPayload,
} from './types';
import { ugsWorkflowExecutionStatusBadgeClass } from '@/features/ugs/shared/ugsDesktopUi';

export const cn = (...classes: Array<string | false | null | undefined>) =>
	classes.filter(Boolean).join(' ');

export const DEFAULT_QUICK_EXECUTE_FORM = {
	prompt: '',
	negative_prompt: '',
	width: '1024',
	height: '1024',
	seed: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresent<T>(value: T | null | undefined): value is T {
	return value != null;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
	if (value === null) return null;
	return asString(value);
}

function asBoolean(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value)
		? value
		: undefined;
}

function normalizeExecutionStatus(
	value: unknown
): WorkflowExecutionRecord['status'] {
	switch (value) {
		case 'pending':
		case 'running':
		case 'completed':
		case 'failed':
		case 'cancelled':
			return value;
		case 'started':
		case 'processing':
			return 'running';
		default:
			return 'pending';
	}
}

export function normalizeWorkflowRecord(value: unknown): WorkflowRecord | null {
	if (!isRecord(value)) {
		return null;
	}
	const id = asString(value.id);
	const workflowName = asString(value.workflow_name);
	if (!id || !workflowName) {
		return null;
	}
	const workflowData = isRecord(value.workflow_data)
		? {
				nodes: Array.isArray(value.workflow_data.nodes)
					? (value.workflow_data.nodes as Array<Record<string, unknown>>)
					: undefined,
				edges: Array.isArray(value.workflow_data.edges)
					? (value.workflow_data.edges as Array<Record<string, unknown>>)
					: undefined,
			}
		: undefined;
	return {
		...(value as Partial<WorkflowRecord>),
		id,
		workflow_name: workflowName,
		description: asNullableString(value.description) ?? undefined,
		created_at: asString(value.created_at) ?? new Date(0).toISOString(),
		updated_at: asNullableString(value.updated_at) ?? undefined,
		is_public: asBoolean(value.is_public),
		project_id: asNullableString(value.project_id) ?? undefined,
		company_id: asNullableString(value.company_id) ?? undefined,
		workflow_data: workflowData,
		execution_count: asNumber(value.execution_count),
		last_execution_at: asNullableString(value.last_execution_at) ?? undefined,
		last_executed_at: asNullableString(value.last_executed_at) ?? undefined,
		average_execution_time: asNumber(value.average_execution_time),
		success_rate: asNumber(value.success_rate),
		workflow_slug: asNullableString(value.workflow_slug) ?? undefined,
		category: asNullableString(value.category) ?? undefined,
		estimated_time: asNumber(value.estimated_time) ?? null,
		version: asNumber(value.version),
	};
}

export function normalizeWorkflowExecutionRecord(
	value: unknown
): WorkflowExecutionRecord | null {
	if (!isRecord(value)) {
		return null;
	}
	const id = asString(value.id) ?? asString(value.execution_id);
	const workflowId = asString(value.workflow_id);
	if (!id || !workflowId) {
		return null;
	}
	return {
		...(value as Partial<WorkflowExecutionRecord>),
		id,
		execution_id: asString(value.execution_id) ?? id,
		workflow_id: workflowId,
		execution_name: asNullableString(value.execution_name) ?? undefined,
		status: normalizeExecutionStatus(value.status),
		started_at: asNullableString(value.started_at) ?? undefined,
		completed_at: asNullableString(value.completed_at) ?? undefined,
		total_duration_ms: asNumber(value.total_duration_ms),
		success_count: asNumber(value.success_count),
		error_count: asNumber(value.error_count),
		credits_used: asNumber(value.credits_used),
		error_message: asNullableString(value.error_message) ?? undefined,
		created_at: asString(value.created_at) ?? new Date(0).toISOString(),
	};
}

export const normalizeWorkflowList = (
	payload: WorkflowsPayload | undefined
): WorkflowRecord[] => {
	if (Array.isArray(payload)) {
		return payload.map(normalizeWorkflowRecord).filter(isPresent);
	}
	return Array.isArray(payload?.workflows)
		? payload.workflows.map(normalizeWorkflowRecord).filter(isPresent)
		: [];
};

export const normalizeExecutionList = (
	payload: ExecutionsPayload | undefined
): WorkflowExecutionRecord[] => {
	if (Array.isArray(payload)) {
		return payload.map(normalizeWorkflowExecutionRecord).filter(isPresent);
	}
	return Array.isArray(payload?.executions)
		? payload.executions.map(normalizeWorkflowExecutionRecord).filter(isPresent)
		: [];
};

export const normalizeExecutionTotal = (
	payload: ExecutionsPayload | undefined
): number | undefined => {
	if (Array.isArray(payload)) {
		return payload.length;
	}
	return typeof payload?.total === 'number' ? payload.total : undefined;
};

export function formatDateTime(
	value?: string | null,
	locale: string = 'en-US'
): string {
	if (!value) return '—';
	try {
		return new Date(value).toLocaleString(locale, {
			hour12: false,
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return value;
	}
}

export function formatEstimatedTime(
	t: TFunction<'ugsHub'>,
	seconds?: number | null
): string {
	if (!seconds || seconds <= 0) return t('workflows.estEmpty');
	if (seconds < 60) return t('workflows.estSeconds', { count: seconds });
	if (seconds < 3600)
		return t('workflows.estMinutes', { count: Math.round(seconds / 60) });
	return t('workflows.estHours', { count: Math.round(seconds / 3600) });
}

export function getCategoryLabel(
	t: TFunction<'ugsHub'>,
	category?: string | null
): string | null {
	switch ((category || '').toLowerCase()) {
		case 'image':
			return t('category.image');
		case 'audio':
			return t('category.audio');
		case 'video':
			return t('category.video');
		case 'text':
			return t('category.text');
		case 'document':
			return t('category.document');
		default:
			return category || null;
	}
}

export function getDisabledExecuteLabel(
	t: TFunction<'ugsHub'>,
	workflow: WorkflowRecord
): string {
	switch (workflow.execution_mode) {
		case 'requires_image_input':
			return t('workflows.cardDisabledNeedsFile');
		case 'requires_audio_input':
			return t('workflows.cardDisabledNeedsAudio');
		case 'requires_specialized_form':
			return t('workflows.cardDisabledNeedsForm');
		default:
			return t('workflows.cardDisabledCatalogOnly');
	}
}

export function formatRuntimeError(
	t: TFunction<'ugsHub'>,
	error?: string | null
): string | null {
	if (!error) return null;
	const normalized = error.trim();
	if (!normalized) return null;
	const lowerValue = normalized.toLowerCase();

	if (lowerValue.includes('cannot connect to host')) {
		return t('workflows.runtimeNoConnection', { detail: normalized });
	}
	if (lowerValue.includes('timeout')) {
		return t('workflows.runtimeTimeout', { detail: normalized });
	}
	if (lowerValue.includes('comfyui service unavailable')) {
		return t('workflows.runtimeUnavailable');
	}

	return normalized;
}

export function getErrorDetail(
	error: ErrorResponse | undefined
): string | null {
	const data = error?.response?.data;
	if (typeof data === 'string' && data.trim()) {
		return data.trim();
	}
	if (
		typeof data === 'object' &&
		data &&
		typeof data.detail === 'string' &&
		data.detail.trim()
	) {
		return data.detail.trim();
	}
	if (typeof error?.message === 'string' && error.message.trim()) {
		return error.message.trim();
	}
	return null;
}

export function getWorkflowExecutionStatusColor(status: string): string {
	return ugsWorkflowExecutionStatusBadgeClass(status);
}

export function getWorkflowExecutionStatusLabel(
	t: TFunction<'ugsHub'>,
	status: string
): string {
	switch (status) {
		case 'completed':
			return t('workflows.execStatusCompleted');
		case 'failed':
			return t('workflows.execStatusFailed');
		case 'running':
			return t('workflows.execStatusRunning');
		case 'pending':
			return t('workflows.execStatusPending');
		default:
			return status;
	}
}
