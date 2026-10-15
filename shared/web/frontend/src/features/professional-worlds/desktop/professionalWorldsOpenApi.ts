/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin OpenAPI pilot type aliases for Professional Worlds desktop clients (snapshot, CRM-lite, listings, learning, artifacts, runtime config, playbooks, media, brand kit, insights/marketing, generation bodies, communication log DTOs, quota summary).
 *
 * Invariants:
 * - Types are sourced from `openapi/pilot/professional-worlds.openapi.json` via codegen only.
 *
 * Related:
 * - src/generated/professional-worlds-openapi.ts
 * - openapi/pilot-professional-worlds-crux-paths.json
 */

import type { components } from '@/generated/professional-worlds-openapi';

export type ProfessionalWorldsSnapshotOut =
	components['schemas']['ProfessionalWorldsSnapshotOut'];

export type CommunicationLogCreateBody =
	components['schemas']['CommunicationLogCreate'];

export type RealtorCommunicationLogOut =
	components['schemas']['RealtorCommunicationLogOut'];

export type ProfessionalClientOut =
	components['schemas']['ProfessionalClientOut'];

export type ProfessionalDealOut = components['schemas']['ProfessionalDealOut'];

export type ProfessionalClientCreateBody =
	components['schemas']['ProfessionalClientCreate'];

export type ProfessionalDealCreateBody =
	components['schemas']['ProfessionalDealCreate'];

export type ProfessionalDealUpdateBody =
	components['schemas']['ProfessionalDealUpdate'];

export type RealtorLeadOut = components['schemas']['RealtorLeadOut'];

export type RealtorLeadCreateBody = components['schemas']['RealtorLeadCreate'];

export type RealtorLeadConvertOut =
	components['schemas']['RealtorLeadConvertOut'];

export type RealtorTaskOut = components['schemas']['RealtorTaskOut'];

export type RealtorTaskCreateBody = components['schemas']['RealtorTaskCreate'];

export type RealtorTaskUpdateBody = components['schemas']['RealtorTaskUpdate'];

export type RealtorJtbdContextOut = components['schemas']['RealtorJtbdContext'];

export type RealtorPropertyOut = components['schemas']['RealtorPropertyOut'];

export type RealtorPropertyCreateBody =
	components['schemas']['RealtorPropertyCreate'];

export type RealtorPropertyUpdateBody =
	components['schemas']['RealtorPropertyUpdate'];

export type RealtorPropertyShowingOut =
	components['schemas']['RealtorPropertyShowingOut'];

export type RealtorPropertyShowingCreateBody =
	components['schemas']['RealtorPropertyShowingCreate'];

export type RealtorPropertyShowingUpdateBody =
	components['schemas']['RealtorPropertyShowingUpdate'];

export type ProfessionalLearningLessonOut =
	components['schemas']['ProfessionalLearningLessonOut'];

export type ProfessionalLearningCourseOut =
	components['schemas']['ProfessionalLearningCourseOut'];

export type ProfessionalArtifactOut =
	components['schemas']['ProfessionalArtifactOut'];

export type ProfessionVerticalOut =
	components['schemas']['ProfessionVerticalOut'];

export type SpecialistProfileOut =
	components['schemas']['SpecialistProfileOut'];

export type SpecialistProfileUpsertBody =
	components['schemas']['SpecialistProfileUpsert'];

export type ProfessionalUserVerticalActivationOut =
	components['schemas']['ProfessionalUserVerticalActivationOut'];

export type ProfessionalUserVerticalActivationUpsertBody =
	components['schemas']['ProfessionalUserVerticalActivationUpsert'];

export type RealtorProDocumentOut =
	components['schemas']['RealtorProDocumentOut'];

export type RealtorProDocumentCreateBody =
	components['schemas']['RealtorProDocumentCreate'];

export type RealtorProDocumentUpdateBody =
	components['schemas']['RealtorProDocumentUpdate'];

export type ProfessionalVerticalModuleOut =
	components['schemas']['ProfessionalVerticalModuleOut'];

export type ProfessionalVerticalSchemaOut =
	components['schemas']['ProfessionalVerticalSchemaOut'];

export type ProfessionalAiActionRuntimeOut =
	components['schemas']['ProfessionalAiActionRuntimeOut'];

export type ProfessionalPhotoPresetRuntimeOut =
	components['schemas']['ProfessionalPhotoPresetRuntimeOut'];

export type ProfessionalIntegrationBindingOut =
	components['schemas']['ProfessionalIntegrationBindingOut'];

export type ProfessionalPlaybookRuntimeOut =
	components['schemas']['ProfessionalPlaybookRuntimeOut'];

export type ProfessionalWorldsRuntimeConfig =
	components['schemas']['ProfessionalWorldsRuntimeConfig'];

export type ProfessionalWorldsMultiRuntimeConfig =
	components['schemas']['ProfessionalWorldsMultiRuntimeConfig'];

export type ProfessionalPlaybookRunOut =
	components['schemas']['ProfessionalPlaybookRunOut'];

export type ProfessionalPlaybookLaunchBody =
	components['schemas']['ProfessionalPlaybookLaunchBody'];

export type ProfessionalPlaybookRunArtifactOut =
	components['schemas']['ProfessionalPlaybookRunArtifactOut'];

export type RealtorBuyerRequirementOut =
	components['schemas']['RealtorBuyerRequirementOut'];

export type RealtorBuyerRequirementCreateBody =
	components['schemas']['RealtorBuyerRequirementCreate'];

export type RealtorBuyerRequirementUpdateBody =
	components['schemas']['RealtorBuyerRequirementUpdate'];

export type RealtorSellerProfileOut =
	components['schemas']['RealtorSellerProfileOut'];

export type RealtorSellerProfileCreateBody =
	components['schemas']['RealtorSellerProfileCreate'];

export type RealtorSellerProfileUpdateBody =
	components['schemas']['RealtorSellerProfileUpdate'];

export type RealtorDealEventOut = components['schemas']['RealtorDealEventOut'];

export type DealEventAppendBody = components['schemas']['DealEventAppend'];

export type RealtorListingQualityScoreOut =
	components['schemas']['RealtorListingQualityScoreOut'];

export type RealtorPropertyMediaOut =
	components['schemas']['RealtorPropertyMediaOut'];

export type RealtorPropertyMediaCreateBody =
	components['schemas']['RealtorPropertyMediaCreate'];

export type MediaEnhancementJobOut =
	components['schemas']['MediaEnhancementJobOut'];

export type RealtorMediaBatchCreateBody =
	components['schemas']['RealtorMediaBatchCreate'];

export type RealtorMediaBatchJobOut =
	components['schemas']['RealtorMediaBatchJobOut'];

export type RealtorMediaBatchItemOut =
	components['schemas']['RealtorMediaBatchItemOut'];

export type RealtorMediaBatchDetailOut =
	components['schemas']['RealtorMediaBatchDetailOut'];

export type RealtorMediaBatchItemReviewBody =
	components['schemas']['RealtorMediaBatchItemReviewBody'];

export type ProfessionalMediaAlbumOut =
	components['schemas']['ProfessionalMediaAlbumOut'];

export type ProfessionalMediaAlbumCreateBody =
	components['schemas']['ProfessionalMediaAlbumCreate'];

export type ProfessionalMediaAlbumPatchBody =
	components['schemas']['ProfessionalMediaAlbumPatch'];

export type ProfessionalUserVerticalOnboardingPatchBody =
	components['schemas']['ProfessionalUserVerticalOnboardingPatch'];

export type BrandVisualKitOut = components['schemas']['BrandVisualKitOut'];

export type BrandVisualKitUpsertBody =
	components['schemas']['BrandVisualKitUpsert'];

export type ProfessionalCrossAppDraftLinkOut =
	components['schemas']['ProfessionalCrossAppDraftLinkOut'];

export type RealtorPriceAnalysisSnapshotOut =
	components['schemas']['RealtorPriceAnalysisSnapshotOut'];

export type PriceAnalysisSnapshotCreateBody =
	components['schemas']['PriceAnalysisSnapshotCreate'];

export type RealtorMarketingCampaignOut =
	components['schemas']['RealtorMarketingCampaignOut'];

export type MarketingCampaignCreateBody =
	components['schemas']['MarketingCampaignCreate'];

export type MarketingCampaignUpdateBody =
	components['schemas']['MarketingCampaignUpdate'];

export type RealtorObjectionReplyOut =
	components['schemas']['RealtorObjectionReplyOut'];

export type ObjectionReplyUpsertBody =
	components['schemas']['ObjectionReplyUpsert'];

export type RealtorPublicationChannelOut =
	components['schemas']['RealtorPublicationChannelOut'];

export type PublicationChannelUpsertBody =
	components['schemas']['PublicationChannelUpsert'];

export type PublicationChannelPatchBody =
	components['schemas']['PublicationChannelPatch'];

export type RealtorGenerationBody =
	components['schemas']['RealtorGenerationBody'];

export type CoachSimulationBody = components['schemas']['CoachSimulationBody'];

export type ObjectIntakeParseRequestBody =
	components['schemas']['ObjectIntakeParseRequest'];

export type ObjectIntakeCommitRequestBody =
	components['schemas']['ObjectIntakeCommitRequest'];

export type ProfessionalDealPropertyLinkBackfillOut =
	components['schemas']['ProfessionalDealPropertyLinkBackfillOut'];

export type MediaEnhancementRequestBody =
	components['schemas']['MediaEnhancementRequest'];

export type RealtorQuotaSummaryOut =
	components['schemas']['RealtorQuotaSummaryOut'];
