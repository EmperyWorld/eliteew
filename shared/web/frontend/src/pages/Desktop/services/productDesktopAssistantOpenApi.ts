/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OpenAPI SSOT bridge for Desktop Assistant (Справочник) REST DTOs.
 *
 * Invariants:
 * - SSE stream event shapes stay hand in `assistant.ts` (pilot lacks SSE schemas).
 *
 * Related:
 * - pages/Desktop/services/productDesktopApi/assistant.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 3
 */

import type { components } from '@/generated/product-desktop-openapi';

type Schemas = components['schemas'];

export type AssistantFaqEntryOut = Schemas['AssistantFaqEntryOut'];
/** UI-compat alias. */
export type AssistantFaqEntry = AssistantFaqEntryOut;

export type AssistantChatMessageOut = Schemas['AssistantChatMessageOut'];
/** UI-compat alias. */
export type AssistantChatMessage = AssistantChatMessageOut;

export type AssistantSettingsOut = Schemas['AssistantSettingsOut'];
/** UI-compat alias. */
export type AssistantSettings = AssistantSettingsOut;
export type AssistantSettingsPatchBody = Schemas['AssistantSettingsPatchBody'];

export type AssistantKbDocumentOut = Schemas['AssistantKbDocumentOut'];
/** UI-compat alias. */
export type AssistantKbDocument = AssistantKbDocumentOut;

export type AssistantKbDocumentDetailOut =
	Schemas['AssistantKbDocumentDetailOut'];
/** UI-compat alias. */
export type AssistantKbDocumentDetail = AssistantKbDocumentDetailOut;

export type AssistantKbSummaryOut = Schemas['AssistantKbSummaryOut'];
/** UI-compat alias. */
export type AssistantKbSummary = AssistantKbSummaryOut;

export type AssistantKbBulkUploadOut = Schemas['AssistantKbBulkUploadOut'];
/** UI-compat alias. */
export type AssistantKbBulkUploadResult = AssistantKbBulkUploadOut;

export type AssistantKbUploadLimitsOut = Schemas['AssistantKbUploadLimitsOut'];
/** UI-compat alias. */
export type AssistantKbUploadLimits = AssistantKbUploadLimitsOut;

export type AssistantKbPurgeOut = Schemas['AssistantKbPurgeOut'];
/** UI-compat alias. */
export type AssistantKbPurgeResult = AssistantKbPurgeOut;

export type AssistantKbReindexAllOut = Schemas['AssistantKbReindexAllOut'];
/** UI-compat alias. */
export type AssistantKbReindexAllResult = AssistantKbReindexAllOut;

export type AssistantKbSyncHandbookOut = Schemas['AssistantKbSyncHandbookOut'];
/** UI-compat alias. */
export type AssistantKbSyncHandbookResult = AssistantKbSyncHandbookOut;

export type AssistantPreviewOut = Schemas['AssistantPreviewOut'];
/** UI-compat alias. */
export type AssistantPreviewResult = AssistantPreviewOut;
export type AssistantPreviewBody = Schemas['AssistantPreviewBody'];

export type AssistantFaqCreateBody = Schemas['AssistantFaqCreateBody'];
export type AssistantFaqUpdateBody = Schemas['AssistantFaqUpdateBody'];
export type AssistantChatBody = Schemas['AssistantChatBody'];
export type AssistantKbCreateBody = Schemas['AssistantKbCreateBody'];
export type AssistantKbPatchBody = Schemas['AssistantKbPatchBody'];
export type AssistantKbPurgeBody = Schemas['AssistantKbPurgeBody'];
