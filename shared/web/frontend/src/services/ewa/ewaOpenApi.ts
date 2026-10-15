/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSOT hub: thin OpenAPI aliases for regenerable EWA full-prefix pilot schemas.
 * HTTP clients import from here — not from `src/generated/ewa-openapi.ts` directly.
 *
 * Invariants:
 * - Sourced only from `src/generated/ewa-openapi.ts`.
 * - Hand SSE overlays (`ewa-companion-chat`, admin task-runs overlay, desktop-orchestration pilot)
 *   stay in their domain clients; HTTP non-stream uses aliases from this bridge.
 * - Optional vs required nested blobs may still need client normalize (see `ewaCompanionProfileApi.ts`).
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 2
 * - .cursor/rules/openapi-ssot-bridge.mdc
 * - src/services/ewa/ewaCompanionProfileApi.ts
 * - src/services/ewa/ewaDesktopOrchestrationOpenApi.ts (SSE-enriched turn request pilot)
 */

import type { components } from '@/generated/ewa-openapi';

type Schemas = components['schemas'];

// --- Profile ---

export type CompanionProfileOut = Schemas['CompanionProfileOut'];
export type CompanionPatchIn = Schemas['CompanionPatchIn'];
export type CompanionQuickPresetOut = Schemas['CompanionQuickPresetOut'];
export type CompanionInitializeIn = Schemas['CompanionInitializeIn'];
export type CompanionArlikaV2ModeToggleOut =
	Schemas['CompanionArlikaV2ModeToggleOut'];
export type CompanionQuickPresetCreateIn =
	Schemas['CompanionQuickPresetCreateIn'];
export type CompanionQuickPresetPatchIn =
	Schemas['CompanionQuickPresetPatchIn'];
export type CompanionContextAnchorGetOut =
	Schemas['CompanionContextAnchorGetOut'];
export type CompanionContextAnchorPatchIn =
	Schemas['CompanionContextAnchorPatchIn'];
export type CompanionContextAnchorRefreshIn =
	Schemas['CompanionContextAnchorRefreshIn'];
export type CompanionContextAnchorRefreshOut =
	Schemas['CompanionContextAnchorRefreshOut'];
export type CompanionContextAnchorRefreshTelemetryOut =
	Schemas['CompanionContextAnchorRefreshTelemetryOut'];
export type CompanionContextDiagnoseOut =
	Schemas['CompanionContextDiagnoseOut'];
export type CompanionOkOut = Schemas['CompanionOkOut'];
export type CompanionDeletedOut = Schemas['CompanionDeletedOut'];
export type EwaDriverCatalogEntryOut = Schemas['EwaDriverCatalogEntryOut'];

// --- Plans ---

export type CompanionPlanBundleOut = Schemas['CompanionPlanBundleOut'];
export type CompanionPlanOut = Schemas['CompanionPlanOut'];
export type CompanionPlanGoalOut = Schemas['CompanionPlanGoalOut'];
export type CompanionPlanTaskOut = Schemas['CompanionPlanTaskOut'];
export type CompanionPlanSummaryOut = Schemas['CompanionPlanSummaryOut'];

// --- Runtime gateway ---

export type EwaRuntimeContextOut = Schemas['EwaRuntimeContextOut'];
export type EwaRuntimePrincipalOut = Schemas['EwaRuntimePrincipalOut'];
export type EwaRuntimeCompanionStatusOut =
	Schemas['EwaRuntimeCompanionStatusOut'];
export type EwaRuntimeContentPageOut = Schemas['EwaRuntimeContentPageOut'];
export type EwaRuntimeContentItemOut = Schemas['EwaRuntimeContentItemOut'];
export type EwaRuntimeDesktopHintsOut = Schemas['EwaRuntimeDesktopHintsOut'];
export type EwaRuntimeLimitsOut = Schemas['EwaRuntimeLimitsOut'];
export type EwaRuntimeCatalogFilters = Schemas['EwaRuntimeCatalogFilters'];
export type EwaRuntimeCatalogPreferencesOut =
	Schemas['EwaRuntimeCatalogPreferencesOut'];

// --- User workflows ---

export type CompanionUserWorkflowOut = Schemas['CompanionUserWorkflowOut'];
export type UserWorkflowCreateInV1 = Schemas['UserWorkflowCreateInV1'];
export type UserWorkflowPatchInV1 = Schemas['UserWorkflowPatchInV1'];
export type UserWorkflowTriggerPhraseV1 =
	Schemas['UserWorkflowTriggerPhraseV1'];
export type UserWorkflowStepInV1 = Schemas['UserWorkflowStepInV1'];
export type UserWorkflowDagBodyV2 = Schemas['UserWorkflowDagBodyV2'];
export type CompanionUserWorkflowToolCatalogEntry =
	Schemas['CompanionUserWorkflowToolCatalogEntry'];
export type CompanionUserWorkflowToolCatalogField =
	Schemas['CompanionUserWorkflowToolCatalogField'];
export type CompanionUserWorkflowToolCatalogFieldOption =
	Schemas['CompanionUserWorkflowToolCatalogFieldOption'];
export type CompanionUserWorkflowValidateIn =
	Schemas['CompanionUserWorkflowValidateIn'];
export type CompanionUserWorkflowValidateOut =
	Schemas['CompanionUserWorkflowValidateOut'];
export type CompanionUserWorkflowStepPreviewOut =
	Schemas['CompanionUserWorkflowStepPreviewOut'];
export type CompanionWorkflowValidateV2Request =
	Schemas['CompanionWorkflowValidateV2Request'];
export type CompanionWorkflowValidateV2Response =
	Schemas['CompanionWorkflowValidateV2Response'];
export type CompanionWorkflowDefinitionV2 =
	Schemas['CompanionWorkflowDefinitionV2'];
export type CompanionUserWorkflowObservationTriggersOut =
	Schemas['CompanionUserWorkflowObservationTriggersOut'];
export type CompanionUserWorkflowObservationTriggersPatchIn =
	Schemas['CompanionUserWorkflowObservationTriggersPatchIn'];
export type CompanionWorkflowBuilderMetaV2 =
	Schemas['CompanionWorkflowBuilderMetaV2'];

// --- Desktop orchestration (HTTP turn response on full ewa pilot) ---

export type EwaDesktopOrchestrationTurnResponse =
	Schemas['EwaDesktopOrchestrationTurnResponse'];

// --- Admin catalog (ewa-openapi, not companion-admin task-runs overlay) ---

export type CompanionAdminStatusOut = Schemas['CompanionAdminStatusOut'];
export type CompanionToolCatalogOut = Schemas['CompanionToolCatalogOut'];
export type CompanionToolCatalogEntryOut =
	Schemas['CompanionToolCatalogEntryOut'];
export type CompanionToolRouterRuntimeOut =
	Schemas['CompanionToolRouterRuntimeOut'];
export type CompanionWorkflowListOut = Schemas['CompanionWorkflowListOut'];
export type CompanionWorkflowSummaryOut =
	Schemas['CompanionWorkflowSummaryOut'];
export type CompanionWorkflowDetailOut = Schemas['CompanionWorkflowDetailOut'];
export type CompanionWorkflowDefinitionV1 =
	Schemas['CompanionWorkflowDefinitionV1'];
export type CompanionWorkflowValidateRequestV1 =
	Schemas['CompanionWorkflowValidateRequestV1'];
export type CompanionWorkflowValidateResponseV1 =
	Schemas['CompanionWorkflowValidateResponseV1'];
export type CompanionWorkflowEnableRequestV1 =
	Schemas['CompanionWorkflowEnableRequestV1'];
export type CompanionWorkflowAuditListOut =
	Schemas['CompanionWorkflowAuditListOut'];
export type CompanionWorkflowAuditEntryOut =
	Schemas['CompanionWorkflowAuditEntryOut'];
export type CompanionChatWorkflowListOut =
	Schemas['CompanionChatWorkflowListOut'];
export type CompanionChatWorkflowSummaryOut =
	Schemas['CompanionChatWorkflowSummaryOut'];
export type CompanionPlatformSettingsListOut =
	Schemas['CompanionPlatformSettingsListOut'];
export type CompanionPlatformSettingOut =
	Schemas['CompanionPlatformSettingOut'];
export type CompanionPlatformSettingAuditListOut =
	Schemas['CompanionPlatformSettingAuditListOut'];
export type CompanionPlatformSettingAuditEntryOut =
	Schemas['CompanionPlatformSettingAuditEntryOut'];
export type CompanionPlatformSettingUpdateRequestV1 =
	Schemas['CompanionPlatformSettingUpdateRequestV1'];
export type CompanionPromptBlockListOut =
	Schemas['CompanionPromptBlockListOut'];
export type CompanionPromptBlockOut = Schemas['CompanionPromptBlockOut'];
export type CompanionPromptBlockUpdateRequestV1 =
	Schemas['CompanionPromptBlockUpdateRequestV1'];
export type CompanionAdminUserListOut = Schemas['CompanionAdminUserListOut'];
export type CompanionAdminUserSummaryOut =
	Schemas['CompanionAdminUserSummaryOut'];
export type CompanionAdminUserDetailOut =
	Schemas['CompanionAdminUserDetailOut'];
export type CompanionAdminUserPatchRequestV1 =
	Schemas['CompanionAdminUserPatchRequestV1'];
export type CompanionAdminUserTimelineOut =
	Schemas['CompanionAdminUserTimelineOut'];
export type CompanionAdminUserTranscriptOut =
	Schemas['CompanionAdminUserTranscriptOut'];
export type CompanionAdminUserAuditNoteRequestV1 =
	Schemas['CompanionAdminUserAuditNoteRequestV1'];
export type CompanionAdminUserClearNamespaceRequestV1 =
	Schemas['CompanionAdminUserClearNamespaceRequestV1'];
export type CompanionAdminUserWipeRequestV1 =
	Schemas['CompanionAdminUserWipeRequestV1'];
export type CompanionAdminUserWipeOut = Schemas['CompanionAdminUserWipeOut'];
