/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for MusicForge hub: stats, runs, feedback, config editor, probe.
 *
 * Invariants:
 * - Uses `/api/v1/music-forge/admin/*`; secrets stay server-side.
 * - DTO SSOT via `musicForgeOpenApi.ts` — no hand twins for OpenAPI-mapped shapes.
 * - `GET /config/revisions` MUST be envelope `{ items, total }`; bare array → hard throw.
 * - Preview response must include lane_key / resolved_builder / input_data object.
 *
 * Related:
 * - `api/routers/music_forge_admin.py`
 * - `pages/Admin/musicForge/MusicForgeAdminSection.tsx`
 * - FE-only view types: `MusicForgeModeRow`, `MusicForgeStageRow` (dict bags in OpenAPI detail)
 */

import { api } from '../../../services/api/client';
import type {
	MusicForgeAdminComfyProbeOut,
	MusicForgeAdminConfigActivateOut,
	MusicForgeAdminConfigDiffChange,
	MusicForgeAdminConfigDiffOut,
	MusicForgeAdminConfigDraftCreate,
	MusicForgeAdminConfigRevisionDetailOut,
	MusicForgeAdminConfigRevisionListOut,
	MusicForgeAdminConfigRevisionOut,
	MusicForgeAdminFailStageCount,
	MusicForgeAdminFeedbackReasonCount,
	MusicForgeAdminFeedbackStatsOut,
	MusicForgeAdminLaneOut,
	MusicForgeAdminLanePatchIn,
	MusicForgeAdminModeOut,
	MusicForgeAdminModePatchIn,
	MusicForgeAdminOverviewOut,
	MusicForgeAdminPreviewAudioIn,
	MusicForgeAdminPreviewAudioOut,
	MusicForgeAdminProductOut,
	MusicForgeAdminProductPatchIn,
	MusicForgeAdminPromptOut,
	MusicForgeAdminPromptPatchIn,
	MusicForgeAdminRunDetailOut,
	MusicForgeAdminRunListItem,
	MusicForgeAdminRunListOut,
	MusicForgeAdminStageCreateIn,
	MusicForgeAdminStageDeleteOut,
	MusicForgeAdminStageOut,
	MusicForgeAdminStagePatchIn,
	MusicForgeAdminStageTypesOut,
	MusicForgeAdminStyleOut,
	MusicForgeAdminStylePatchIn,
	MusicForgeStepOut,
} from '@/services/musicForge/musicForgeOpenApi';

const BASE = '/api/v1/music-forge/admin';

export type MusicForgeAdminTab =
	| 'overview'
	| 'runs'
	| 'feedback'
	| 'config'
	| 'probe';

export type {
	MusicForgeAdminFailStageCount,
	MusicForgeAdminFeedbackReasonCount,
};

export type MusicForgeAdminOverviewStats = MusicForgeAdminOverviewOut;
export type MusicForgeAdminRunRow = MusicForgeAdminRunListItem;
export type MusicForgeAdminRunsResponse = MusicForgeAdminRunListOut;
export type MusicForgeAdminRunDetail = MusicForgeAdminRunDetailOut;
export type MusicForgeAdminRunStep = MusicForgeStepOut;
export type MusicForgeAdminFeedbackStats = MusicForgeAdminFeedbackStatsOut;

export type MusicForgeConfigRevisionRow = MusicForgeAdminConfigRevisionOut;
export type MusicForgeConfigRevisionsResponse =
	MusicForgeAdminConfigRevisionListOut;
export type MusicForgeConfigActivateResponse = MusicForgeAdminConfigActivateOut;
export type MusicForgeConfigRevisionDetailResponse =
	MusicForgeAdminConfigRevisionDetailOut;
export type MusicForgeConfigDiffChange = MusicForgeAdminConfigDiffChange;
export type MusicForgeConfigDiffResponse = MusicForgeAdminConfigDiffOut;
export type MusicForgeConfigProductPatch = MusicForgeAdminProductPatchIn;
export type MusicForgeConfigProductRow = MusicForgeAdminProductOut;
export type MusicForgeConfigModePatch = MusicForgeAdminModePatchIn;
/** Until OpenAPI pilot refresh includes W7 mode create/delete schemas. */
export type MusicForgeConfigModeCreate = {
	mode_key: string;
	label_ru: string;
	label_en: string;
	lane_key: string;
	description?: string | null;
	enabled?: boolean;
	is_default?: boolean | null;
	sort_order?: number | null;
	style_hint_default?: string | null;
};
export type MusicForgeConfigModeDeleteOut = {
	deleted: boolean;
	mode_key: string;
};
export type MusicForgeConfigStagePatch = MusicForgeAdminStagePatchIn;
export type MusicForgeConfigStageCreate = MusicForgeAdminStageCreateIn;
export type MusicForgeStageTypesResponse = MusicForgeAdminStageTypesOut;
export type MusicForgePreviewAudioRequest = MusicForgeAdminPreviewAudioIn;
export type MusicForgePreviewAudioResponse = MusicForgeAdminPreviewAudioOut;
export type MusicForgeComfyProbeResponse = MusicForgeAdminComfyProbeOut;
export type MusicForgeConfigLanePatch = MusicForgeAdminLanePatchIn;
export type MusicForgeConfigPromptPatch = MusicForgeAdminPromptPatchIn;
export type MusicForgeConfigStylePatch = MusicForgeAdminStylePatchIn;

/** Envelope parsers narrow optional OpenAPI list fields after validation. */
export type MusicForgeAdminRunsEnvelope = MusicForgeAdminRunsResponse & {
	items: MusicForgeAdminRunRow[];
};
export type MusicForgeConfigRevisionsEnvelope =
	MusicForgeConfigRevisionsResponse & {
		items: MusicForgeConfigRevisionRow[];
	};
export type MusicForgePreviewAudioResponseValidated =
	MusicForgePreviewAudioResponse & {
		input_data: Record<string, unknown>;
	};

/** FE view over `detail.modes` dict bag — not a standalone OpenAPI schema. */
export interface MusicForgeModeRow {
	mode_key: string;
	label_ru: string;
	label_en: string;
	description?: string | null;
	enabled: boolean;
	is_default: boolean;
	sort_order: number;
	style_hint_default?: string | null;
	lane_key: string;
}

/** FE view over mode pipeline stages — OpenAPI detail still uses dict bags. */
export interface MusicForgeStageRow {
	stage_key: string;
	stage_type: string;
	title_ru: string;
	sort_order: number;
	enabled: boolean;
	settings: Record<string, unknown>;
}

/** Allowlist mirrored from API `ALLOWED_UGS_WORKFLOWS`. */
export const MUSIC_FORGE_UGS_WORKFLOWS = [
	'v4',
	'v4_luna',
	'v2',
	'v2_base',
	'v5',
] as const;

export type MusicForgeUgsWorkflow = (typeof MUSIC_FORGE_UGS_WORKFLOWS)[number];

/** Mirrors API `UGS_WORKFLOW_META` — human labels for lane editor. */
export const MUSIC_FORGE_UGS_WORKFLOW_META: Record<
	MusicForgeUgsWorkflow,
	{ labelRu: string; labelEn: string; workflowFile: string }
> = {
	v4: {
		labelRu: 'SFT XL — основной (AceStepSFT)',
		labelEn: 'SFT XL — default (AceStepSFT)',
		workflowFile: 'ace_sft_new.json',
	},
	v4_luna: {
		labelRu: 'SFT XL + Luna LoRA',
		labelEn: 'SFT XL + Luna LoRA',
		workflowFile: 'v4_luna_ace_sft_xl.json',
	},
	v2: {
		labelRu: 'TURBO XL — быстрее',
		labelEn: 'TURBO XL — faster',
		workflowFile: 'Musicv2.json',
	},
	v2_base: {
		labelRu: 'BASE XL',
		labelEn: 'BASE XL',
		workflowFile: 'Musicv2_base.json',
	},
	v5: {
		labelRu: 'BIG XL SFT (v5, chained)',
		labelEn: 'BIG XL SFT (v5, chained)',
		workflowFile: 'BIG_XL_SFT.json',
	},
};

/**
 * Strict envelope parser for GET /config/revisions.
 * Bare array / missing fields → throw (no dual-accept, no silent []).
 */
export function requireMusicForgeConfigRevisionsEnvelope(
	payload: unknown
): MusicForgeConfigRevisionsEnvelope {
	if (Array.isArray(payload)) {
		throw new Error('music_forge_admin_config_revisions_envelope_invalid');
	}
	if (!payload || typeof payload !== 'object') {
		throw new Error('music_forge_admin_config_revisions_envelope_invalid');
	}
	const body = payload as { items?: unknown; total?: unknown };
	if (!Array.isArray(body.items) || typeof body.total !== 'number') {
		throw new Error('music_forge_admin_config_revisions_envelope_invalid');
	}
	return {
		items: body.items as MusicForgeConfigRevisionRow[],
		total: body.total,
	};
}

export function requireMusicForgeAdminRunsEnvelope(
	payload: unknown
): MusicForgeAdminRunsEnvelope {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('music_forge_admin_runs_envelope_invalid');
	}
	const body = payload as Partial<MusicForgeAdminRunsResponse>;
	if (!Array.isArray(body.items) || typeof body.total !== 'number') {
		throw new Error('music_forge_admin_runs_envelope_invalid');
	}
	return {
		items: body.items,
		total: body.total,
		limit: typeof body.limit === 'number' ? body.limit : 0,
		offset: typeof body.offset === 'number' ? body.offset : 0,
	};
}

export async function getMusicForgeAdminOverviewStats(): Promise<MusicForgeAdminOverviewStats> {
	return api.get<MusicForgeAdminOverviewOut>(`${BASE}/stats/overview`);
}

export async function getMusicForgeAdminRuns(args?: {
	limit?: number;
	offset?: number;
	status?: string;
	q?: string;
	mode_key?: string;
	model_lane?: string;
}): Promise<MusicForgeAdminRunsEnvelope> {
	const params = new URLSearchParams();
	if (args?.limit != null) params.set('limit', String(args.limit));
	if (args?.offset != null) params.set('offset', String(args.offset));
	if (args?.status?.trim()) params.set('status', args.status.trim());
	if (args?.q?.trim()) params.set('q', args.q.trim());
	if (args?.mode_key?.trim()) params.set('mode_key', args.mode_key.trim());
	if (args?.model_lane?.trim())
		params.set('model_lane', args.model_lane.trim());
	const qs = params.toString();
	const raw = await api.get<MusicForgeAdminRunListOut>(
		`${BASE}/runs${qs ? `?${qs}` : ''}`
	);
	return requireMusicForgeAdminRunsEnvelope(raw);
}

export async function getMusicForgeAdminRun(
	runId: string
): Promise<MusicForgeAdminRunDetail> {
	return api.get<MusicForgeAdminRunDetailOut>(
		`${BASE}/runs/${encodeURIComponent(runId)}`
	);
}

export async function getMusicForgeAdminFeedbackStats(): Promise<MusicForgeAdminFeedbackStats> {
	return api.get<MusicForgeAdminFeedbackStatsOut>(`${BASE}/feedback/stats`);
}

export async function getMusicForgeAdminConfigRevisions(): Promise<MusicForgeConfigRevisionsEnvelope> {
	const raw = await api.get<MusicForgeAdminConfigRevisionListOut>(
		`${BASE}/config/revisions`
	);
	return requireMusicForgeConfigRevisionsEnvelope(raw);
}

export async function activateMusicForgeAdminConfigRevision(
	revisionId: string
): Promise<MusicForgeConfigActivateResponse> {
	return api.post<MusicForgeAdminConfigActivateOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/activate`
	);
}

export async function createMusicForgeAdminConfigDraft(
	args?: MusicForgeAdminConfigDraftCreate
): Promise<MusicForgeConfigRevisionRow> {
	return api.post<MusicForgeAdminConfigRevisionOut>(
		`${BASE}/config/revisions/draft`,
		args ?? {}
	);
}

export async function getMusicForgeAdminConfigRevision(
	revisionId: string
): Promise<MusicForgeConfigRevisionDetailResponse> {
	return api.get<MusicForgeAdminConfigRevisionDetailOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}`
	);
}

export async function getMusicForgeAdminConfigDiff(
	revisionId: string
): Promise<MusicForgeConfigDiffResponse> {
	return api.get<MusicForgeAdminConfigDiffOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/diff`
	);
}

export async function patchMusicForgeAdminConfigProduct(
	revisionId: string,
	patch: MusicForgeConfigProductPatch
): Promise<MusicForgeConfigProductRow> {
	return api.patch<MusicForgeAdminProductOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/product`,
		patch
	);
}

export async function patchMusicForgeAdminConfigLane(
	revisionId: string,
	laneKey: string,
	patch: MusicForgeConfigLanePatch
): Promise<MusicForgeAdminLaneOut> {
	return api.patch<MusicForgeAdminLaneOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/lanes/${encodeURIComponent(laneKey)}`,
		patch
	);
}

export async function patchMusicForgeAdminConfigPrompt(
	revisionId: string,
	kind: string,
	patch: MusicForgeConfigPromptPatch
): Promise<MusicForgeAdminPromptOut> {
	return api.patch<MusicForgeAdminPromptOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/prompts/${encodeURIComponent(kind)}`,
		patch
	);
}

export async function patchMusicForgeAdminConfigStyle(
	revisionId: string,
	styleKey: string,
	patch: MusicForgeConfigStylePatch
): Promise<MusicForgeAdminStyleOut> {
	return api.patch<MusicForgeAdminStyleOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/styles/${encodeURIComponent(styleKey)}`,
		patch
	);
}

export async function getMusicForgeAdminStageTypes(): Promise<MusicForgeStageTypesResponse> {
	return api.get<MusicForgeAdminStageTypesOut>(`${BASE}/config/stage-types`);
}

export async function createMusicForgeAdminConfigMode(
	revisionId: string,
	body: MusicForgeConfigModeCreate
): Promise<MusicForgeAdminModeOut> {
	return api.post<MusicForgeAdminModeOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes`,
		body
	);
}

export async function patchMusicForgeAdminConfigMode(
	revisionId: string,
	modeKey: string,
	patch: MusicForgeConfigModePatch
): Promise<MusicForgeAdminModeOut> {
	return api.patch<MusicForgeAdminModeOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes/${encodeURIComponent(modeKey)}`,
		patch
	);
}

export async function deleteMusicForgeAdminConfigMode(
	revisionId: string,
	modeKey: string
): Promise<MusicForgeConfigModeDeleteOut> {
	return api.delete<MusicForgeConfigModeDeleteOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes/${encodeURIComponent(modeKey)}`
	);
}

export async function patchMusicForgeAdminConfigStage(
	revisionId: string,
	modeKey: string,
	stageKey: string,
	patch: MusicForgeConfigStagePatch
): Promise<MusicForgeAdminStageOut> {
	return api.patch<MusicForgeAdminStageOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes/${encodeURIComponent(modeKey)}/stages/${encodeURIComponent(stageKey)}`,
		patch
	);
}

export async function createMusicForgeAdminConfigStage(
	revisionId: string,
	modeKey: string,
	body: MusicForgeConfigStageCreate
): Promise<MusicForgeAdminStageOut> {
	return api.post<MusicForgeAdminStageOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes/${encodeURIComponent(modeKey)}/stages`,
		body
	);
}

export async function deleteMusicForgeAdminConfigStage(
	revisionId: string,
	modeKey: string,
	stageKey: string
): Promise<MusicForgeAdminStageDeleteOut> {
	return api.delete<MusicForgeAdminStageDeleteOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/modes/${encodeURIComponent(modeKey)}/stages/${encodeURIComponent(stageKey)}`
	);
}

export async function previewMusicForgeAdminAudioPayload(
	revisionId: string,
	body?: MusicForgePreviewAudioRequest
): Promise<MusicForgePreviewAudioResponse> {
	return api.post<MusicForgeAdminPreviewAudioOut>(
		`${BASE}/config/revisions/${encodeURIComponent(revisionId)}/preview-audio-payload`,
		body ?? {}
	);
}

/**
 * Narrow shape check for preview dry-run response (Layer C lock for Admin FE).
 */
export function requireMusicForgePreviewAudioResponse(
	payload: unknown
): MusicForgePreviewAudioResponseValidated {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('music_forge_admin_preview_audio_invalid');
	}
	const body = payload as Partial<MusicForgeAdminPreviewAudioOut>;
	if (
		typeof body.lane_key !== 'string' ||
		typeof body.ugs_workflow !== 'string' ||
		typeof body.resolved_builder !== 'string' ||
		!body.input_data ||
		typeof body.input_data !== 'object' ||
		Array.isArray(body.input_data)
	) {
		throw new Error('music_forge_admin_preview_audio_invalid');
	}
	return {
		revision_id: typeof body.revision_id === 'string' ? body.revision_id : '',
		revision_version:
			typeof body.revision_version === 'string' ? body.revision_version : '',
		revision_status:
			typeof body.revision_status === 'string' ? body.revision_status : '',
		lane_key: body.lane_key,
		ugs_workflow: body.ugs_workflow,
		resolved_builder: body.resolved_builder,
		input_data: body.input_data,
	};
}

export async function getMusicForgeAdminComfyProbe(): Promise<MusicForgeComfyProbeResponse> {
	return api.get<MusicForgeAdminComfyProbeOut>(`${BASE}/probe/comfy`);
}
