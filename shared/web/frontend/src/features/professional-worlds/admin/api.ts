/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * API client for Professional Worlds admin configuration.
 *
 * Invariants:
 * - Admin calls use the canonical authenticated API helper.
 * - Runtime users must not import this module.
 *
 * Related:
 * - src/features/professional-worlds/admin/types.ts
 * - shared/api/routers/professional_worlds_admin.py
 */

import { api } from '@/services/api/client';
import type {
	AdminProfessionalPlaybook,
	AdminProfessionVertical,
	ProfessionalAdminAuditLog,
	ProfessionalAiAction,
	ProfessionalAiActionTestOut,
	ProfessionalAiEvalDashboard,
	ProfessionalAiEvalDataset,
	ProfessionalAiEvalRun,
	ProfessionalAiEvalRunSample,
	ProfessionalIntegrationBinding,
	ProfessionalModule,
	ProfessionalPackDiffResponse,
	ProfessionalPackImportConfirmOut,
	ProfessionalPackImportJobCreateOut,
	ProfessionalPackImportJobRow,
	ProfessionalPackReleaseOut,
	ProfessionalPhotoPreset,
	ProfessionalPhotoPresetTestOut,
	ProfessionalPlaybookDryRunOut,
	ProfessionalVerticalModule,
	ProfessionalVerticalPackExportOut,
	ProfessionalVerticalPackVersion,
	ProfessionalVerticalRollout,
	ProfessionalVerticalRolloutMutateOut,
	ProfessionalVerticalSchema,
	ProfessionalWorldsAdminOverview,
	ProfessionalWorldsAdminSnapshot,
	ProfessionalWorldsOpsMetrics,
} from './types';

export const PROFESSIONAL_WORLDS_ADMIN_API_BASE =
	'/api/v1/professional-worlds/admin';

export async function loadProfessionalWorldsOpsMetrics(): Promise<ProfessionalWorldsOpsMetrics> {
	return api.get<ProfessionalWorldsOpsMetrics>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/ops/metrics`,
		{ params: { _ts: Date.now() } }
	);
}

export async function loadProfessionalWorldsAdminSnapshot(
	verticalSlug = 'realtor'
): Promise<ProfessionalWorldsAdminSnapshot> {
	const [
		overview,
		verticals,
		modules,
		assignments,
		schemas,
		aiActions,
		photoPresets,
		integrations,
		audit,
	] = await Promise.all([
		api.get<ProfessionalWorldsAdminOverview>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/overview`,
			{ params: { _ts: Date.now() } }
		),
		api.get<AdminProfessionVertical[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals`,
			{ params: { _ts: Date.now() } }
		),
		api.get<ProfessionalModule[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/modules`,
			{
				params: { _ts: Date.now() },
			}
		),
		api.get<ProfessionalVerticalModule[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/modules`,
			{ params: { _ts: Date.now() } }
		),
		api.get<ProfessionalVerticalSchema[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/schemas`
		),
		api.get<ProfessionalAiAction[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/ai-actions?vertical_slug=${verticalSlug}`
		),
		api.get<ProfessionalPhotoPreset[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/photo-presets?vertical_slug=${verticalSlug}`
		),
		api.get<ProfessionalIntegrationBinding[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/integrations?vertical_slug=${verticalSlug}`
		),
		api.get<ProfessionalAdminAuditLog[]>(
			`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/audit?limit=50`
		),
	]);
	return {
		overview,
		verticals,
		modules,
		assignments,
		schemas,
		aiActions,
		photoPresets,
		integrations,
		audit,
	};
}

export async function createProfessionalWorldsVertical(payload: {
	slug: string;
	name: string;
	description?: string | null;
	icon_key?: string;
	is_active?: boolean;
	profile_schema?: Record<string, unknown>;
	workspace_template?: Record<string, unknown>;
}): Promise<AdminProfessionVertical> {
	return api.post<AdminProfessionVertical>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals`,
		payload
	);
}

export async function updateProfessionalWorldsVertical(
	slug: string,
	payload: Partial<
		Pick<
			AdminProfessionVertical,
			| 'name'
			| 'description'
			| 'icon_key'
			| 'is_active'
			| 'profile_schema'
			| 'workspace_template'
		>
	>
): Promise<AdminProfessionVertical> {
	return api.patch<AdminProfessionVertical>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${slug}`,
		payload
	);
}

export async function disableProfessionalWorldsVertical(
	slug: string
): Promise<void> {
	await api.delete(`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${slug}`);
}

export async function createProfessionalWorldsModule(payload: {
	module_key: string;
	name: string;
	description?: string | null;
	category?: string;
	icon_key?: string;
	default_config?: Record<string, unknown>;
	is_active?: boolean;
}): Promise<ProfessionalModule> {
	return api.post<ProfessionalModule>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/modules`,
		payload
	);
}

export async function updateProfessionalWorldsModule(
	moduleKey: string,
	payload: Partial<
		Pick<
			ProfessionalModule,
			| 'name'
			| 'description'
			| 'category'
			| 'icon_key'
			| 'default_config'
			| 'is_active'
		>
	>
): Promise<ProfessionalModule> {
	return api.patch<ProfessionalModule>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/modules/${moduleKey}`,
		payload
	);
}

export async function assignProfessionalWorldsModule(
	verticalSlug: string,
	moduleKey: string,
	payload: {
		config?: Record<string, unknown>;
		sort_order?: number;
		is_enabled?: boolean;
	}
): Promise<ProfessionalVerticalModule> {
	return api.post<ProfessionalVerticalModule>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/modules/${encodeURIComponent(moduleKey)}`,
		payload
	);
}

export async function disableProfessionalWorldsModuleAssignment(
	verticalSlug: string,
	moduleKey: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/modules/${encodeURIComponent(moduleKey)}`
	);
}

export async function createProfessionalWorldsSchema(
	verticalSlug: string,
	payload: {
		schema_key: string;
		version?: number;
		title: string;
		schema_json: Record<string, unknown>;
		ui_schema?: Record<string, unknown>;
		is_active?: boolean;
	}
): Promise<ProfessionalVerticalSchema> {
	return api.post<ProfessionalVerticalSchema>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/schemas`,
		payload
	);
}

export async function updateProfessionalWorldsSchema(
	schemaId: string,
	payload: Partial<
		Pick<
			ProfessionalVerticalSchema,
			'title' | 'schema_json' | 'ui_schema' | 'is_active'
		>
	>
): Promise<ProfessionalVerticalSchema> {
	return api.patch<ProfessionalVerticalSchema>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/schemas/${schemaId}`,
		payload
	);
}

export async function activateProfessionalWorldsSchema(
	schemaId: string
): Promise<ProfessionalVerticalSchema> {
	return api.post<ProfessionalVerticalSchema>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/schemas/${schemaId}/activate`,
		{}
	);
}

export async function createProfessionalWorldsAiAction(
	payload: Partial<ProfessionalAiAction> & {
		vertical_slug: string;
		module_key: string;
		action_key: string;
		display_name: string;
		prompt_template: string;
	}
): Promise<ProfessionalAiAction> {
	return api.post<ProfessionalAiAction>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/ai-actions`,
		payload
	);
}

export async function updateProfessionalWorldsAiAction(
	verticalSlug: string,
	actionKey: string,
	payload: Partial<
		Pick<
			ProfessionalAiAction,
			| 'module_key'
			| 'display_name'
			| 'description'
			| 'ugs_type_key'
			| 'workflow_slug'
			| 'prompt_template'
			| 'input_schema'
			| 'output_schema'
			| 'safety_rules'
			| 'artifact_kind'
			| 'billing_hint'
			| 'is_active'
			| 'sort_order'
		>
	>
): Promise<ProfessionalAiAction> {
	return api.patch<ProfessionalAiAction>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/ai-actions/${actionKey}?vertical_slug=${verticalSlug}`,
		payload
	);
}

export async function testProfessionalWorldsAiAction(
	actionKey: string,
	verticalSlug = 'realtor'
): Promise<ProfessionalAiActionTestOut> {
	return api.post<ProfessionalAiActionTestOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/ai-actions/${actionKey}/test?vertical_slug=${verticalSlug}`,
		{}
	);
}

export async function createProfessionalWorldsPhotoPreset(
	payload: Partial<ProfessionalPhotoPreset> & {
		vertical_slug: string;
		preset_key: string;
		display_name: string;
		prompt_template: string;
	}
): Promise<ProfessionalPhotoPreset> {
	return api.post<ProfessionalPhotoPreset>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/photo-presets`,
		payload
	);
}

export async function updateProfessionalWorldsPhotoPreset(
	verticalSlug: string,
	presetKey: string,
	payload: Partial<
		Pick<
			ProfessionalPhotoPreset,
			| 'display_name'
			| 'description'
			| 'category'
			| 'action_type'
			| 'ugs_type_key'
			| 'prompt_template'
			| 'parameters'
			| 'is_active'
			| 'sort_order'
		>
	>
): Promise<ProfessionalPhotoPreset> {
	return api.patch<ProfessionalPhotoPreset>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/photo-presets/${presetKey}?vertical_slug=${verticalSlug}`,
		payload
	);
}

export async function testProfessionalWorldsPhotoPreset(
	presetKey: string,
	verticalSlug = 'realtor',
	sampleContentId?: string
): Promise<ProfessionalPhotoPresetTestOut> {
	const params = new URLSearchParams({ vertical_slug: verticalSlug });
	if (sampleContentId) {
		params.set('sample_content_id', sampleContentId);
	}
	return api.post<ProfessionalPhotoPresetTestOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/photo-presets/${presetKey}/test?${params.toString()}`,
		{}
	);
}

export async function updateProfessionalWorldsIntegration(
	verticalSlug: string,
	integrationKey: string,
	payload: {
		display_name?: string | null;
		config?: Record<string, unknown>;
		is_enabled?: boolean;
	}
): Promise<ProfessionalIntegrationBinding> {
	return api.patch<ProfessionalIntegrationBinding>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/integrations/${integrationKey}?vertical_slug=${verticalSlug}`,
		payload
	);
}

export async function listProfessionalWorldsAudit(params: {
	entity_type?: string;
	risk_level?: string;
	admin_user_id?: string;
	limit?: number;
}): Promise<ProfessionalAdminAuditLog[]> {
	const search = new URLSearchParams();
	if (params.entity_type) {
		search.set('entity_type', params.entity_type);
	}
	if (params.risk_level) {
		search.set('risk_level', params.risk_level);
	}
	if (params.admin_user_id) {
		search.set('admin_user_id', params.admin_user_id);
	}
	search.set('limit', String(params.limit ?? 100));
	return api.get<ProfessionalAdminAuditLog[]>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/audit?${search.toString()}`
	);
}

export async function listProfessionalWorldsPackVersions(
	verticalSlug: string
): Promise<ProfessionalVerticalPackVersion[]> {
	return api.get<ProfessionalVerticalPackVersion[]>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/${verticalSlug}/versions`
	);
}

export async function exportProfessionalWorldsPack(
	verticalSlug: string
): Promise<ProfessionalVerticalPackExportOut> {
	return api.get<ProfessionalVerticalPackExportOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/verticals/${verticalSlug}/export`
	);
}

export async function createProfessionalWorldsPackVersion(
	verticalSlug: string,
	payload: {
		version_label: string;
		manifest?: Record<string, unknown>;
		changelog_md?: string | null;
	}
): Promise<ProfessionalVerticalPackVersion> {
	return api.post<ProfessionalVerticalPackVersion>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/${verticalSlug}/versions`,
		payload
	);
}

export async function diffProfessionalWorldsPackVsLive(
	verticalSlug: string,
	manifest: Record<string, unknown>
): Promise<ProfessionalPackDiffResponse> {
	return api.post<ProfessionalPackDiffResponse>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/${verticalSlug}/diff`,
		manifest
	);
}

export async function createProfessionalWorldsPackImportJob(
	verticalSlug: string,
	body: Record<string, unknown>
): Promise<ProfessionalPackImportJobCreateOut> {
	return api.post<ProfessionalPackImportJobCreateOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/import/jobs?vertical_slug=${encodeURIComponent(verticalSlug)}`,
		body
	);
}

export async function getProfessionalWorldsPackImportJob(
	jobId: string
): Promise<ProfessionalPackImportJobRow> {
	return api.get<ProfessionalPackImportJobRow>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/import/jobs/${jobId}`
	);
}

export async function confirmProfessionalWorldsPackImportJob(
	jobId: string
): Promise<ProfessionalPackImportConfirmOut> {
	return api.post<ProfessionalPackImportConfirmOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/import/jobs/${jobId}/confirm`,
		{}
	);
}

export async function createProfessionalWorldsPackRelease(
	verticalSlug: string,
	payload: { pack_version_id?: string | null; notes?: string | null }
): Promise<ProfessionalPackReleaseOut> {
	return api.post<ProfessionalPackReleaseOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/${verticalSlug}/releases`,
		payload
	);
}

export async function approveProfessionalWorldsPackRelease(
	releaseId: string,
	body: { comment?: string | null } = {}
): Promise<ProfessionalPackReleaseOut> {
	return api.post<ProfessionalPackReleaseOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/releases/${releaseId}/approve`,
		body
	);
}

export async function publishProfessionalWorldsPackRelease(
	releaseId: string
): Promise<ProfessionalPackReleaseOut> {
	return api.post<ProfessionalPackReleaseOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/releases/${releaseId}/publish`,
		{}
	);
}

export async function rollbackProfessionalWorldsPackRelease(
	releaseId: string
): Promise<ProfessionalPackReleaseOut> {
	return api.post<ProfessionalPackReleaseOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/packs/releases/${releaseId}/rollback`,
		{}
	);
}

export async function listProfessionalWorldsRollouts(
	verticalSlug?: string
): Promise<ProfessionalVerticalRollout[]> {
	const q =
		verticalSlug !== undefined
			? `?vertical_slug=${encodeURIComponent(verticalSlug)}`
			: '';
	return api.get<ProfessionalVerticalRollout[]>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/rollouts${q}`
	);
}

export async function createProfessionalWorldsRollout(
	verticalSlug: string,
	payload: { release_id: string; mode?: string; percentage?: number }
): Promise<ProfessionalVerticalRolloutMutateOut> {
	return api.post<ProfessionalVerticalRolloutMutateOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/rollouts?vertical_slug=${encodeURIComponent(verticalSlug)}`,
		payload
	);
}

export async function patchProfessionalWorldsRollout(
	rolloutId: string,
	payload: { mode?: string | null; percentage?: number | null }
): Promise<ProfessionalVerticalRolloutMutateOut> {
	return api.patch<ProfessionalVerticalRolloutMutateOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/rollouts/${rolloutId}`,
		payload
	);
}

export async function pauseProfessionalWorldsRollout(
	rolloutId: string
): Promise<ProfessionalVerticalRolloutMutateOut> {
	return api.post<ProfessionalVerticalRolloutMutateOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/rollouts/${rolloutId}/pause`,
		{}
	);
}

export async function resumeProfessionalWorldsRollout(
	rolloutId: string
): Promise<ProfessionalVerticalRolloutMutateOut> {
	return api.post<ProfessionalVerticalRolloutMutateOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/rollouts/${rolloutId}/resume`,
		{}
	);
}

export async function listAdminProfessionalPlaybooks(
	verticalSlug: string
): Promise<AdminProfessionalPlaybook[]> {
	return api.get<AdminProfessionalPlaybook[]>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/playbooks/${encodeURIComponent(verticalSlug)}`
	);
}

export async function createAdminProfessionalPlaybook(
	verticalSlug: string,
	payload: {
		playbook_key: string;
		display_name: string;
		description?: string | null;
		sort_order?: number;
		is_active?: boolean;
		steps: Array<{
			step_order: number;
			action_key: string;
			input_mapping?: Record<string, unknown>;
			stop_on_error?: boolean;
		}>;
	}
): Promise<AdminProfessionalPlaybook> {
	return api.post<AdminProfessionalPlaybook>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/playbooks/${encodeURIComponent(verticalSlug)}`,
		payload
	);
}

export async function updateAdminProfessionalPlaybook(
	verticalSlug: string,
	playbookKey: string,
	payload: {
		display_name?: string | null;
		description?: string | null;
		sort_order?: number | null;
		is_active?: boolean | null;
		steps?: Array<{
			step_order: number;
			action_key: string;
			input_mapping?: Record<string, unknown>;
			stop_on_error?: boolean;
		}> | null;
	}
): Promise<AdminProfessionalPlaybook> {
	return api.patch<AdminProfessionalPlaybook>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/playbooks/${encodeURIComponent(verticalSlug)}/${encodeURIComponent(playbookKey)}`,
		payload
	);
}

export async function postAdminProfessionalPlaybookDryRun(
	verticalSlug: string,
	playbookKey: string,
	body?: { steps?: AdminProfessionalPlaybook['steps'] } | null
): Promise<ProfessionalPlaybookDryRunOut> {
	return api.post<ProfessionalPlaybookDryRunOut>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/playbooks/${encodeURIComponent(verticalSlug)}/${encodeURIComponent(playbookKey)}/dry-run`,
		body ?? {}
	);
}

export async function loadProfessionalWorldsEvaluationDashboard(
	verticalSlug?: string,
	runLimit = 25
): Promise<ProfessionalAiEvalDashboard> {
	const params = new URLSearchParams();
	if (verticalSlug) {
		params.set('vertical_slug', verticalSlug);
	}
	params.set('run_limit', String(runLimit));
	return api.get<ProfessionalAiEvalDashboard>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/dashboard?${params.toString()}`
	);
}

export async function createProfessionalWorldsEvaluationDataset(payload: {
	vertical_slug: string;
	name: string;
	description?: string | null;
	cases?: Record<string, unknown>[];
	is_active?: boolean;
}): Promise<ProfessionalAiEvalDataset> {
	return api.post<ProfessionalAiEvalDataset>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/datasets`,
		payload
	);
}

export async function patchProfessionalWorldsEvaluationDataset(
	datasetId: string,
	payload: {
		name?: string | null;
		description?: string | null;
		cases?: Record<string, unknown>[] | null;
		is_active?: boolean | null;
	}
): Promise<ProfessionalAiEvalDataset> {
	return api.patch<ProfessionalAiEvalDataset>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/datasets/${encodeURIComponent(datasetId)}`,
		payload
	);
}

export async function deleteProfessionalWorldsEvaluationDataset(
	datasetId: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/datasets/${encodeURIComponent(datasetId)}`
	);
}

export async function executeProfessionalWorldsEvaluationRun(payload: {
	dataset_id: string;
	target_type: 'ai_action' | 'playbook';
	target_key: string;
	simulate?: boolean;
	notes?: string | null;
	idempotency_prefix?: string | null;
}): Promise<ProfessionalAiEvalRun> {
	return api.post<ProfessionalAiEvalRun>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/runs`,
		payload
	);
}

export async function patchProfessionalWorldsEvaluationRunHumanNotes(
	runId: string,
	human_review_notes: string | null
): Promise<ProfessionalAiEvalRun> {
	return api.patch<ProfessionalAiEvalRun>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/runs/${encodeURIComponent(runId)}/human-notes`,
		{ human_review_notes }
	);
}

export async function patchProfessionalWorldsEvaluationSampleHumanNotes(
	sampleId: string,
	human_review_notes: string | null
): Promise<ProfessionalAiEvalRunSample> {
	return api.patch<ProfessionalAiEvalRunSample>(
		`${PROFESSIONAL_WORLDS_ADMIN_API_BASE}/evaluation/runs/samples/${encodeURIComponent(sampleId)}/human-notes`,
		{ human_review_notes }
	);
}
