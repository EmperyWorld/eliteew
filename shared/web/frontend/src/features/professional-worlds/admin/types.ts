/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TypeScript contracts for Professional Worlds admin configuration API.
 *
 * Invariants:
 * - Admin types may include private prompt/config fields; runtime desktop types must not expose them.
 * - Keys mirror `/api/v1/professional-worlds/admin` responses.
 *
 * Related:
 * - src/features/professional-worlds/admin/professionalWorldsAdminOpenApi.ts
 * - shared/api/routers/professional_worlds_admin.py
 * - documentation/product/PROFESSIONAL-WORLDS-PACK-V2-CONTRACT.md
 * - src/features/professional-worlds/admin/api.ts
 */

import type {
	AdminProfessionVertical,
	AdminProfessionalPlaybook,
	AdminProfessionalPlaybookStep,
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
	ProfessionalPackDiffSectionStats,
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
	ProfessionalWorldsOpsMetrics,
	ProfessionalWorldsOpsProbeRow,
	ProfessionalWorldsRuntimeOverview,
} from './professionalWorldsAdminOpenApi';

export type {
	AdminProfessionVertical,
	AdminProfessionalPlaybook,
	AdminProfessionalPlaybookStep,
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
	ProfessionalPackDiffSectionStats,
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
	ProfessionalWorldsOpsMetrics,
	ProfessionalWorldsOpsProbeRow,
	ProfessionalWorldsRuntimeOverview,
};

/** Resolved playbook step plan row — OpenAPI dry-run steps are untyped dicts. */
export interface ProfessionalPlaybookDryRunStepRow {
	step_order: number;
	action_key: string;
	stop_on_error?: boolean;
	input_mapping?: Record<string, unknown>;
	ugs_type_key?: string | null;
	display_name?: string | null;
}

/**
 * FE aggregate for admin section bootstrap — not the same contract as runtime
 * `ProfessionalWorldsSnapshotOut` (see professionalWorldsAdminOpenApi.ts).
 */
export interface ProfessionalWorldsAdminSnapshot {
	overview: ProfessionalWorldsAdminOverview;
	verticals: AdminProfessionVertical[];
	modules: ProfessionalModule[];
	assignments: ProfessionalVerticalModule[];
	schemas: ProfessionalVerticalSchema[];
	aiActions: ProfessionalAiAction[];
	photoPresets: ProfessionalPhotoPreset[];
	integrations: ProfessionalIntegrationBinding[];
	audit: ProfessionalAdminAuditLog[];
}
