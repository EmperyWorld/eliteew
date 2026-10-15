/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for EWA companion admin catalog (WF-5 read, WF-6 write): tools + action/chat workflows.
 *
 * Invariants:
 * - Uses ``api.get/post/put`` (unwraps JSON body); not raw ``apiClient`` axios responses.
 * - Requires admin JWT; backend returns 503 when feature flags are OFF.
 * - Catalog/workflows/settings/users/prompt types from `ewaOpenApi.ts` (ewa-openapi pilot).
 * - Task-run list/detail payloads validated at runtime (Zod strip) via `ewa-companion-admin-openapi` overlay.
 *
 * Related:
 * - api/ewa_platform/gateways/routers/companion_admin.py
 * - src/features/ewa/admin/EwaCompanionAdminPanel.tsx
 * - src/services/ewa/ewaOpenApi.ts
 */
import { APIError, api } from '@/services/api/client';
import type { components } from '@/generated/ewa-companion-admin-openapi';
import type {
	CompanionAdminStatusOut,
	CompanionAdminUserAuditNoteRequestV1,
	CompanionAdminUserClearNamespaceRequestV1,
	CompanionAdminUserDetailOut,
	CompanionAdminUserListOut,
	CompanionAdminUserPatchRequestV1,
	CompanionAdminUserSummaryOut,
	CompanionAdminUserTimelineOut,
	CompanionAdminUserTranscriptOut,
	CompanionAdminUserWipeOut,
	CompanionAdminUserWipeRequestV1,
	CompanionChatWorkflowListOut,
	CompanionChatWorkflowSummaryOut,
	CompanionPlatformSettingAuditEntryOut,
	CompanionPlatformSettingAuditListOut,
	CompanionPlatformSettingOut,
	CompanionPlatformSettingsListOut,
	CompanionPlatformSettingUpdateRequestV1,
	CompanionPromptBlockListOut,
	CompanionPromptBlockOut,
	CompanionPromptBlockUpdateRequestV1,
	CompanionToolCatalogEntryOut,
	CompanionToolCatalogOut,
	CompanionToolRouterRuntimeOut,
	CompanionWorkflowAuditEntryOut,
	CompanionWorkflowAuditListOut,
	CompanionWorkflowDetailOut,
	CompanionWorkflowListOut,
	CompanionWorkflowSummaryOut,
	CompanionWorkflowValidateResponseV1,
} from '@/services/ewa/ewaOpenApi';
import { z } from 'zod';

const BASE = '/api/v1/ewa/admin/companion';

export type EwaCompanionAdminStatus = CompanionAdminStatusOut;
export type EwaCompanionToolCatalogEntry = CompanionToolCatalogEntryOut;
export type EwaCompanionToolRouterRuntime = CompanionToolRouterRuntimeOut;
export type EwaCompanionToolCatalogResponse = CompanionToolCatalogOut;
export type EwaCompanionWorkflowSummary = CompanionWorkflowSummaryOut;
export type EwaCompanionWorkflowListResponse = CompanionWorkflowListOut;
export type EwaCompanionWorkflowDetailResponse = CompanionWorkflowDetailOut;
export type EwaCompanionWorkflowValidateResponse =
	CompanionWorkflowValidateResponseV1;
export type EwaCompanionWorkflowAuditEntry = CompanionWorkflowAuditEntryOut;
export type EwaCompanionWorkflowAuditListResponse =
	CompanionWorkflowAuditListOut;
export type EwaCompanionChatWorkflowSummary = CompanionChatWorkflowSummaryOut;
export type EwaCompanionChatWorkflowListResponse = CompanionChatWorkflowListOut;

export type EwaCompanionAdminErrorCode =
	| 'admin_disabled'
	| 'write_disabled'
	| 'forbidden'
	| 'load_failed';

export function classifyEwaCompanionAdminError(
	error: unknown
): EwaCompanionAdminErrorCode {
	if (error instanceof APIError) {
		const detail = String(error.message || '').toLowerCase();
		if (
			error.statusCode === 503 &&
			(detail.includes('ewa_companion_admin_disabled') ||
				detail.includes('admin_disabled'))
		) {
			return 'admin_disabled';
		}
		if (
			error.statusCode === 503 &&
			(detail.includes('ewa_companion_admin_write_disabled') ||
				detail.includes('ewa_companion_wf_pg_catalog_disabled'))
		) {
			return 'write_disabled';
		}
		if (error.statusCode === 403) {
			return 'forbidden';
		}
	}
	return 'load_failed';
}

export async function fetchEwaCompanionAdminStatus(): Promise<EwaCompanionAdminStatus> {
	return api.get<EwaCompanionAdminStatus>(`${BASE}/status`);
}

export async function fetchEwaCompanionToolCatalog(): Promise<EwaCompanionToolCatalogResponse> {
	return api.get<EwaCompanionToolCatalogResponse>(`${BASE}/tools`);
}

export async function fetchEwaCompanionWorkflows(): Promise<EwaCompanionWorkflowListResponse> {
	return api.get<EwaCompanionWorkflowListResponse>(`${BASE}/workflows`);
}

export async function fetchEwaCompanionWorkflowDetail(
	workflowId: string,
	version?: number
): Promise<EwaCompanionWorkflowDetailResponse> {
	const qs =
		version != null ? `?version=${encodeURIComponent(String(version))}` : '';
	return api.get<EwaCompanionWorkflowDetailResponse>(
		`${BASE}/workflows/${encodeURIComponent(workflowId)}${qs}`
	);
}

export async function validateEwaCompanionWorkflowDefinition(
	definition: Record<string, unknown>
): Promise<EwaCompanionWorkflowValidateResponse> {
	return api.post<EwaCompanionWorkflowValidateResponse>(
		`${BASE}/workflows/validate`,
		{ definition }
	);
}

export async function saveEwaCompanionWorkflowDefinition(
	definition: Record<string, unknown>
): Promise<EwaCompanionWorkflowDetailResponse> {
	return api.post<EwaCompanionWorkflowDetailResponse>(`${BASE}/workflows`, {
		definition,
	});
}

export async function enableEwaCompanionWorkflowVersion(
	workflowId: string,
	version: number
): Promise<EwaCompanionWorkflowDetailResponse> {
	return api.put<EwaCompanionWorkflowDetailResponse>(
		`${BASE}/workflows/${encodeURIComponent(workflowId)}/enable`,
		{ version }
	);
}

export async function disableEwaCompanionWorkflow(
	workflowId: string
): Promise<EwaCompanionWorkflowDetailResponse> {
	return api.put<EwaCompanionWorkflowDetailResponse>(
		`${BASE}/workflows/${encodeURIComponent(workflowId)}/disable`
	);
}

export async function fetchEwaCompanionWorkflowAudit(
	workflowId: string,
	limit = 50
): Promise<EwaCompanionWorkflowAuditListResponse> {
	return api.get<EwaCompanionWorkflowAuditListResponse>(
		`${BASE}/workflows/${encodeURIComponent(workflowId)}/audit?limit=${limit}`
	);
}

export async function fetchEwaCompanionChatWorkflows(): Promise<EwaCompanionChatWorkflowListResponse> {
	return api.get<EwaCompanionChatWorkflowListResponse>(
		`${BASE}/chat-workflows`
	);
}

export type EwaCompanionAdminTaskRunsQuery = {
	limit?: number;
	principal_id?: string;
	status?: string;
	intent_kind?: string;
	include_steps?: boolean;
};

export type EwaCompanionAdminTaskStep =
	components['schemas']['EwaCompanionTaskStep'];
export type EwaCompanionAdminTaskRun =
	components['schemas']['EwaCompanionAdminTaskRun'];
export type EwaCompanionAdminTaskRunsResponse =
	components['schemas']['EwaCompanionAdminTaskRunsResponse'];

const maybeStringSchema = z.union([z.string(), z.null(), z.undefined()]);
const maybeRecordSchema = z.union([
	z.record(z.string(), z.unknown()),
	z.null(),
	z.undefined(),
]);

const taskStepRawSchema = z
	.object({
		id: z.string(),
		run_id: z.string(),
		step_index: z.number().int(),
		step_kind: z.string(),
		status: z.string(),
		title: maybeStringSchema,
		input_payload: maybeRecordSchema,
		output_payload: maybeRecordSchema,
		error_payload: maybeRecordSchema,
		created_at: maybeStringSchema.optional(),
		updated_at: maybeStringSchema.optional(),
		completed_at: maybeStringSchema.optional(),
	})
	.strip();

const taskRunRawSchema = z
	.object({
		id: z.string(),
		principal_id: z.string(),
		status: z.string(),
		intent_kind: z.string(),
		user_message: maybeStringSchema,
		plan_payload: maybeRecordSchema,
		confirmation_state: maybeRecordSchema,
		result_payload: maybeRecordSchema,
		error_payload: maybeRecordSchema,
		execution_mode: maybeStringSchema.optional(),
		created_at: maybeStringSchema.optional(),
		updated_at: maybeStringSchema.optional(),
		completed_at: maybeStringSchema.optional(),
		steps: z.array(taskStepRawSchema).optional(),
	})
	.strip();

const taskRunsRawResponseSchema = z
	.object({
		runs: z.array(taskRunRawSchema),
	})
	.strip();

function normalizeText(value: string | null | undefined): string {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeIso(value: string | null | undefined): string | null {
	const normalized = normalizeText(value);
	return normalized || null;
}

function normalizeRecord(
	value: Record<string, unknown> | null | undefined
): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value
		: {};
}

function normalizeTaskStep(
	step: z.infer<typeof taskStepRawSchema>
): EwaCompanionAdminTaskStep {
	return {
		...step,
		id: normalizeText(step.id),
		run_id: normalizeText(step.run_id),
		step_kind: normalizeText(step.step_kind),
		status: normalizeText(step.status),
		title: normalizeText(step.title),
		input_payload: normalizeRecord(step.input_payload),
		output_payload: normalizeRecord(step.output_payload),
		error_payload: normalizeRecord(step.error_payload),
		created_at: normalizeIso(step.created_at),
		updated_at: normalizeIso(step.updated_at),
		completed_at: normalizeIso(step.completed_at),
	} as EwaCompanionAdminTaskStep;
}

function normalizeTaskRun(
	run: z.infer<typeof taskRunRawSchema>
): EwaCompanionAdminTaskRun {
	return {
		...run,
		id: normalizeText(run.id),
		principal_id: normalizeText(run.principal_id),
		status: normalizeText(run.status) || 'pending',
		intent_kind: normalizeText(run.intent_kind) || 'unknown',
		user_message: normalizeText(run.user_message),
		plan_payload: normalizeRecord(run.plan_payload),
		confirmation_state: normalizeRecord(run.confirmation_state),
		result_payload: normalizeRecord(run.result_payload),
		error_payload: normalizeRecord(run.error_payload),
		execution_mode: normalizeText(run.execution_mode) || undefined,
		created_at: normalizeIso(run.created_at),
		updated_at: normalizeIso(run.updated_at),
		completed_at: normalizeIso(run.completed_at),
		steps: run.steps?.map(normalizeTaskStep),
	} as EwaCompanionAdminTaskRun;
}

export async function fetchEwaCompanionAdminTaskRuns(
	query: EwaCompanionAdminTaskRunsQuery = {}
): Promise<EwaCompanionAdminTaskRunsResponse> {
	const params = new URLSearchParams();
	if (query.limit != null) {
		params.set('limit', String(query.limit));
	}
	if (query.principal_id?.trim()) {
		params.set('principal_id', query.principal_id.trim());
	}
	if (query.status?.trim()) {
		params.set('status', query.status.trim());
	}
	if (query.intent_kind?.trim()) {
		params.set('intent_kind', query.intent_kind.trim());
	}
	if (query.include_steps) {
		params.set('include_steps', 'true');
	}
	const qs = params.toString();
	const raw = await api.get<EwaCompanionAdminTaskRunsResponse>(
		`${BASE}/task-runs${qs ? `?${qs}` : ''}`
	);
	const parsed = taskRunsRawResponseSchema.parse(raw);
	return {
		runs: parsed.runs.map(normalizeTaskRun),
	} satisfies EwaCompanionAdminTaskRunsResponse;
}

export async function fetchEwaCompanionAdminTaskRunDetail(
	runId: string,
	includeSteps = true
): Promise<EwaCompanionAdminTaskRun> {
	const qs = includeSteps ? '?include_steps=true' : '';
	const raw = await api.get<EwaCompanionAdminTaskRun>(
		`${BASE}/task-runs/${encodeURIComponent(runId)}${qs}`
	);
	const parsed = taskRunRawSchema.parse(raw);
	return normalizeTaskRun(parsed);
}

export type EwaCompanionPlatformSetting = CompanionPlatformSettingOut;
export type EwaCompanionPlatformSettingsResponse =
	CompanionPlatformSettingsListOut;
export type EwaCompanionPlatformSettingAuditEntry =
	CompanionPlatformSettingAuditEntryOut;
export type EwaCompanionPlatformSettingsAuditResponse =
	CompanionPlatformSettingAuditListOut;

export async function fetchEwaCompanionPlatformSettings(
	category?: string
): Promise<EwaCompanionPlatformSettingsResponse> {
	const qs = category?.trim()
		? `?category=${encodeURIComponent(category.trim())}`
		: '';
	return api.get<EwaCompanionPlatformSettingsResponse>(`${BASE}/settings${qs}`);
}

export async function fetchEwaCompanionPlatformSettingsAudit(query?: {
	setting_key?: string;
	limit?: number;
}): Promise<EwaCompanionPlatformSettingsAuditResponse> {
	const params = new URLSearchParams();
	if (query?.setting_key?.trim()) {
		params.set('setting_key', query.setting_key.trim());
	}
	if (query?.limit != null) {
		params.set('limit', String(query.limit));
	}
	const qs = params.toString();
	return api.get<EwaCompanionPlatformSettingsAuditResponse>(
		`${BASE}/settings/audit${qs ? `?${qs}` : ''}`
	);
}

export async function updateEwaCompanionPlatformSetting(
	settingKey: string,
	valueText: string
): Promise<EwaCompanionPlatformSetting> {
	const body: CompanionPlatformSettingUpdateRequestV1 = {
		value_text: valueText,
	};
	return api.put<EwaCompanionPlatformSetting>(
		`${BASE}/settings/${encodeURIComponent(settingKey)}`,
		body
	);
}

export type EwaCompanionPromptBlock = CompanionPromptBlockOut;
export type EwaCompanionPromptBlockListResponse = CompanionPromptBlockListOut;

export async function fetchEwaCompanionPromptBlocks(): Promise<EwaCompanionPromptBlockListResponse> {
	return api.get<EwaCompanionPromptBlockListResponse>(`${BASE}/prompt-blocks`);
}

export async function updateEwaCompanionPromptBlock(
	blockKey: string,
	bodyText: string
): Promise<EwaCompanionPromptBlock> {
	const body: CompanionPromptBlockUpdateRequestV1 = { body_text: bodyText };
	return api.put<EwaCompanionPromptBlock>(
		`${BASE}/prompt-blocks/${encodeURIComponent(blockKey)}`,
		body
	);
}

export type EwaCompanionAdminUserSummary = CompanionAdminUserSummaryOut;
export type EwaCompanionAdminUserListResponse = CompanionAdminUserListOut;
export type EwaCompanionAdminUserDetail = CompanionAdminUserDetailOut;

export async function fetchEwaCompanionAdminUsers(query?: {
	q?: string;
	limit?: number;
}): Promise<EwaCompanionAdminUserListResponse> {
	const params = new URLSearchParams();
	if (query?.q?.trim()) params.set('q', query.q.trim());
	if (query?.limit != null) params.set('limit', String(query.limit));
	const qs = params.toString();
	return api.get<EwaCompanionAdminUserListResponse>(
		`${BASE}/users${qs ? `?${qs}` : ''}`
	);
}

export async function fetchEwaCompanionAdminUser(
	principalId: string
): Promise<EwaCompanionAdminUserDetail> {
	return api.get<EwaCompanionAdminUserDetail>(
		`${BASE}/users/${encodeURIComponent(principalId)}`
	);
}

export async function fetchEwaCompanionAdminUserTimeline(
	principalId: string,
	limit = 40
): Promise<CompanionAdminUserTimelineOut> {
	return api.get<CompanionAdminUserTimelineOut>(
		`${BASE}/users/${encodeURIComponent(principalId)}/timeline?limit=${limit}`
	);
}

export async function fetchEwaCompanionAdminUserTranscript(
	principalId: string,
	limit = 40
): Promise<CompanionAdminUserTranscriptOut> {
	return api.get<CompanionAdminUserTranscriptOut>(
		`${BASE}/users/${encodeURIComponent(principalId)}/transcript?limit=${limit}`
	);
}

export async function patchEwaCompanionAdminUser(
	principalId: string,
	body: CompanionAdminUserPatchRequestV1
): Promise<EwaCompanionAdminUserDetail> {
	return api.patch<EwaCompanionAdminUserDetail>(
		`${BASE}/users/${encodeURIComponent(principalId)}`,
		body
	);
}

export type EwaCompanionAdminUserWipeResult = CompanionAdminUserWipeOut;

export async function wipeEwaCompanionAdminUser(
	principalId: string,
	confirmPrincipalId: string
): Promise<EwaCompanionAdminUserWipeResult> {
	const body: CompanionAdminUserWipeRequestV1 = {
		confirm_principal_id: confirmPrincipalId,
	};
	return api.post<EwaCompanionAdminUserWipeResult>(
		`${BASE}/users/${encodeURIComponent(principalId)}/wipe`,
		body
	);
}

export async function clearEwaCompanionAdminUserNamespace(
	principalId: string,
	body: {
		namespace: string;
		confirmNamespace: string;
		expectedRevision?: number | null;
	}
): Promise<EwaCompanionAdminUserDetail> {
	const requestBody: CompanionAdminUserClearNamespaceRequestV1 = {
		namespace: body.namespace,
		confirm_namespace: body.confirmNamespace,
		expected_revision: body.expectedRevision ?? null,
	};
	return api.post<EwaCompanionAdminUserDetail>(
		`${BASE}/users/${encodeURIComponent(principalId)}/clear-namespace`,
		requestBody
	);
}

export async function postEwaCompanionAdminUserAuditNote(
	principalId: string,
	note: string
): Promise<EwaCompanionAdminUserDetail> {
	const body: CompanionAdminUserAuditNoteRequestV1 = { note };
	return api.post<EwaCompanionAdminUserDetail>(
		`${BASE}/users/${encodeURIComponent(principalId)}/audit-note`,
		body
	);
}
