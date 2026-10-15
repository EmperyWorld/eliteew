/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single source of truth for MusicForge DTOs from the music-forge OpenAPI pilot.
 * Re-export hot user and admin schemas; consumers alias public names in API clients.
 *
 * Invariants:
 * - Sourced only from `src/generated/music-forge-openapi.ts` — no hand twins here.
 *
 * Related:
 * - src/services/musicForge/musicForgeApi.ts
 * - src/pages/Admin/musicForge/musicForgeAdminApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */

import type { components } from '@/generated/music-forge-openapi';

type Schemas = components['schemas'];

// --- User / thin-client ---

export type MusicForgeCapabilitiesOut = Schemas['MusicForgeCapabilitiesOut'];
export type MusicForgeRunOut = Schemas['MusicForgeRunOut'];
export type MusicForgeRunCreateOut = Schemas['MusicForgeRunCreateOut'];
export type MusicForgeRunCreate = Schemas['MusicForgeRunCreate'];
export type MusicForgeStepOut = Schemas['MusicForgeStepOut'];
export type MusicForgeModeCapability = Schemas['MusicForgeModeCapability'];
export type MusicForgeLanguageOption = Schemas['MusicForgeLanguageOption'];
export type MusicForgeFeedbackIn = Schemas['MusicForgeFeedbackIn'];
export type MusicForgeFeedbackOut = Schemas['MusicForgeFeedbackOut'];

// --- Admin ---

export type MusicForgeAdminOverviewOut = Schemas['MusicForgeAdminOverviewOut'];
export type MusicForgeAdminFailStageCount =
	Schemas['MusicForgeAdminFailStageCount'];
export type MusicForgeAdminRunListItem = Schemas['MusicForgeAdminRunListItem'];
export type MusicForgeAdminRunListOut = Schemas['MusicForgeAdminRunListOut'];
export type MusicForgeAdminRunDetailOut =
	Schemas['MusicForgeAdminRunDetailOut'];
export type MusicForgeAdminFeedbackStatsOut =
	Schemas['MusicForgeAdminFeedbackStatsOut'];
export type MusicForgeAdminFeedbackReasonCount =
	Schemas['MusicForgeAdminFeedbackReasonCount'];
export type MusicForgeAdminComfyProbeOut =
	Schemas['MusicForgeAdminComfyProbeOut'];
export type MusicForgeAdminConfigRevisionListOut =
	Schemas['MusicForgeAdminConfigRevisionListOut'];
export type MusicForgeAdminConfigDraftCreate =
	Schemas['MusicForgeAdminConfigDraftCreate'];
export type MusicForgeAdminConfigRevisionOut =
	Schemas['MusicForgeAdminConfigRevisionOut'];
export type MusicForgeAdminConfigRevisionDetailOut =
	Schemas['MusicForgeAdminConfigRevisionDetailOut'];
export type MusicForgeAdminConfigDiffOut =
	Schemas['MusicForgeAdminConfigDiffOut'];
export type MusicForgeAdminConfigDiffChange =
	Schemas['MusicForgeAdminConfigDiffChange'];
export type MusicForgeAdminProductPatchIn =
	Schemas['MusicForgeAdminProductPatchIn'];
export type MusicForgeAdminProductOut = Schemas['MusicForgeAdminProductOut'];
export type MusicForgeAdminLanePatchIn = Schemas['MusicForgeAdminLanePatchIn'];
export type MusicForgeAdminLaneOut = Schemas['MusicForgeAdminLaneOut'];
export type MusicForgeAdminPromptPatchIn =
	Schemas['MusicForgeAdminPromptPatchIn'];
export type MusicForgeAdminPromptOut = Schemas['MusicForgeAdminPromptOut'];
export type MusicForgeAdminStylePatchIn =
	Schemas['MusicForgeAdminStylePatchIn'];
export type MusicForgeAdminStyleOut = Schemas['MusicForgeAdminStyleOut'];
export type MusicForgeAdminStageTypesOut =
	Schemas['MusicForgeAdminStageTypesOut'];
export type MusicForgeAdminModePatchIn = Schemas['MusicForgeAdminModePatchIn'];
export type MusicForgeAdminModeOut = Schemas['MusicForgeAdminModeOut'];
export type MusicForgeAdminStagePatchIn =
	Schemas['MusicForgeAdminStagePatchIn'];
export type MusicForgeAdminStageCreateIn =
	Schemas['MusicForgeAdminStageCreateIn'];
export type MusicForgeAdminStageOut = Schemas['MusicForgeAdminStageOut'];
export type MusicForgeAdminStageDeleteOut =
	Schemas['MusicForgeAdminStageDeleteOut'];
export type MusicForgeAdminPreviewAudioIn =
	Schemas['MusicForgeAdminPreviewAudioIn'];
export type MusicForgeAdminPreviewAudioOut =
	Schemas['MusicForgeAdminPreviewAudioOut'];
export type MusicForgeAdminConfigActivateOut =
	Schemas['MusicForgeAdminConfigActivateOut'];
