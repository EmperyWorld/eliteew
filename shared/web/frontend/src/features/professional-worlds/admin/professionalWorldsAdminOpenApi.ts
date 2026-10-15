/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin OpenAPI aliases for Professional Worlds admin DTOs from professional-worlds-openapi
 * (includes Wave B3 pack import/release/rollout/test/export outs).
 *
 * Invariants:
 * - Types are sourced from `openapi/pilot/professional-worlds.openapi.json` via codegen only.
 * - Does NOT alias `ProfessionalWorldsSnapshotOut` as an admin snapshot — runtime desktop snapshot and admin aggregate (`ProfessionalWorldsAdminSnapshot`) are different contracts.
 *
 * Related:
 * - src/features/professional-worlds/admin/types.ts
 * - src/generated/professional-worlds-openapi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 */

import type { components } from '@/generated/professional-worlds-openapi';

export type ProfessionalWorldsAdminOverview =
	components['schemas']['ProfessionalWorldsAdminOverview'];

export type ProfessionalWorldsRuntimeOverview =
	components['schemas']['ProfessionalWorldsRuntimeOverview'];

export type ProfessionalWorldsOpsProbeRow =
	components['schemas']['ProfessionalWorldsOpsProbeRow'];

export type ProfessionalWorldsOpsMetrics =
	components['schemas']['ProfessionalWorldsOpsMetricsOut'];

export type AdminProfessionVertical =
	components['schemas']['AdminProfessionVerticalOut'];

export type ProfessionalModule = components['schemas']['ProfessionalModuleOut'];

export type ProfessionalVerticalModule =
	components['schemas']['ProfessionalVerticalModuleOut'];

export type ProfessionalVerticalSchema =
	components['schemas']['ProfessionalVerticalSchemaOut'];

export type ProfessionalAiAction =
	components['schemas']['ProfessionalAiActionOut'];

export type ProfessionalPhotoPreset =
	components['schemas']['ProfessionalPhotoPresetOut'];

export type ProfessionalIntegrationBinding =
	components['schemas']['ProfessionalIntegrationBindingOut'];

export type ProfessionalAdminAuditLog =
	components['schemas']['ProfessionalAdminAuditLogOut'];

export type ProfessionalVerticalPackVersion =
	components['schemas']['ProfessionalVerticalPackVersionOut'];

export type ProfessionalPackDiffSectionStats =
	components['schemas']['ProfessionalPackDiffSectionStats'];

export type ProfessionalPackDiffResponse =
	components['schemas']['ProfessionalPackDiffOut'];

export type AdminProfessionalPlaybookStep =
	components['schemas']['AdminProfessionalPlaybookStepOut'];

export type AdminProfessionalPlaybook =
	components['schemas']['AdminProfessionalPlaybookOut'];

export type ProfessionalPlaybookDryRunOut =
	components['schemas']['ProfessionalPlaybookDryRunOut'];

export type ProfessionalAiEvalDataset =
	components['schemas']['ProfessionalAiEvalDatasetOut'];

export type ProfessionalAiEvalRunSample =
	components['schemas']['ProfessionalAiEvalRunSampleOut'];

export type ProfessionalAiEvalRun =
	components['schemas']['ProfessionalAiEvalRunOut'];

export type ProfessionalAiEvalDashboard =
	components['schemas']['ProfessionalAiEvalDashboardOut'];

/** Wave B3 — pack import / release / rollout / test / export */

export type ProfessionalPackImportJobOut =
	components['schemas']['ProfessionalPackImportJobOut'];

export type ProfessionalPackImportJobCreateOut =
	components['schemas']['ProfessionalPackImportJobCreateOut'];

export type ProfessionalPackImportConfirmOut =
	components['schemas']['ProfessionalPackImportConfirmOut'];

export type ProfessionalPackReleaseOut =
	components['schemas']['ProfessionalPackReleaseOut'];

export type ProfessionalVerticalRolloutOut =
	components['schemas']['ProfessionalVerticalRolloutOut'];

export type ProfessionalVerticalRolloutMutateOut =
	components['schemas']['ProfessionalVerticalRolloutMutateOut'];

export type ProfessionalAiActionTestOut =
	components['schemas']['ProfessionalAiActionTestOut'];

export type ProfessionalPhotoPresetTestOut =
	components['schemas']['ProfessionalPhotoPresetTestOut'];

export type ProfessionalAiActionPromptInspectOut =
	components['schemas']['ProfessionalAiActionPromptInspectOut'];

export type ProfessionalPhotoPresetPromptInspectOut =
	components['schemas']['ProfessionalPhotoPresetPromptInspectOut'];

export type ProfessionalVerticalPackExportOut =
	components['schemas']['ProfessionalVerticalPackExportOut'];

/** UI alias — full import job GET row. */
export type ProfessionalPackImportJobRow = ProfessionalPackImportJobOut;

/** UI alias — rollout list row. */
export type ProfessionalVerticalRollout = ProfessionalVerticalRolloutOut;
