/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OpenAPI SSOT bridge for Survey Hub product-desktop DTOs.
 *
 * Invariants:
 * - Sourced only from `@/generated/product-desktop-openapi` — no hand twins.
 *
 * Related:
 * - pages/Desktop/services/productDesktopSurveysApi.ts
 * - documentation/product/SURVEY-HUB.md
 */

import type { components } from '@/generated/product-desktop-openapi';

type Schemas = components['schemas'];

export type SurveyRewardSpec = Schemas['SurveyRewardSpec'];
export type SurveyQuestionOut = Schemas['SurveyQuestionOut'];
export type SurveyQuestionIn = Schemas['SurveyQuestionIn'];

/** Admin list/detail row. */
export type SurveyAdminOut = Schemas['SurveyAdminOut'];
/** UI-compat alias used by admin panels. */
export type SurveyAdmin = SurveyAdminOut;

export type SurveyAiDraftOut = Schemas['SurveyAiDraftOut'];
export type SurveyAiDraftIn = Schemas['SurveyAiDraftIn'];
/** UI-compat alias for AI draft editor state. */
export type SurveyAiDraft = SurveyAiDraftOut;

export type SurveyResultsSummaryOut = Schemas['SurveyResultsSummaryOut'];
/** UI-compat alias for results analytics panel. */
export type SurveyResultsSummary = SurveyResultsSummaryOut;

export type SurveyUserListItem = Schemas['SurveyUserListItem'];
export type SurveyUserDetailOut = Schemas['SurveyUserDetailOut'];
/** UI-compat alias for runner/detail client. */
export type SurveyUserDetail = SurveyUserDetailOut;

export type SurveySummaryOut = Schemas['SurveySummaryOut'];
/** UI-compat alias for hub KPI strip. */
export type SurveySummary = SurveySummaryOut;

export type SurveySubmitOut = Schemas['SurveySubmitOut'];
export type SurveySubmitBody = Schemas['SurveySubmitBody'];
/** UI-compat alias for submit response. */
export type SurveySubmitResult = SurveySubmitOut;

export type SurveyResponseUserOut = Schemas['SurveyResponseUserOut'];
/** UI-compat alias for "my response" panel. */
export type SurveyResponseMe = SurveyResponseUserOut;

export type SurveyListAdminOut = Schemas['SurveyListAdminOut'];
export type SurveyUserListOut = Schemas['SurveyUserListOut'];
export type SurveyCreateBody = Schemas['SurveyCreateBody'];
export type SurveyPatchBody = Schemas['SurveyPatchBody'];
export type SurveyAudienceBody = Schemas['SurveyAudienceBody'];
export type AudiencePreviewOut = Schemas['AudiencePreviewOut'];
export type SurveyGafNotifyQueuedOut = Schemas['SurveyGafNotifyQueuedOut'];
export type SurveyResponseAdminListOut = Schemas['SurveyResponseAdminListOut'];
export type SurveyResponseAdminOut = Schemas['SurveyResponseAdminOut'];
export type SurveyAiDraftRequest = Schemas['SurveyAiDraftRequest'];

/** Question row in admin editor (create/update uses `SurveyQuestionIn`). */
export type SurveyQuestion = SurveyQuestionOut;
