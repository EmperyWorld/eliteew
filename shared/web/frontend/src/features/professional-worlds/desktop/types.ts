/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TypeScript contracts for the Professional Worlds desktop app and API client (runtime config, snapshot DTOs, pack rollout fields, object-intake SSE fields).
 *
 * Invariants:
 * - Types mirror `/api/v1/professional-worlds` responses and keep realtor as the first vertical, not a one-off app.
 * - Money/decimal values may arrive as strings from JSON serialization.
 * - `ObjectIntakePreview` / `ObjectIntakeDiagnostics` re-export Zod `z.infer` (SSE-only, no pilot Out).
 *
 * Related:
 * - shared/api/schemas/professional_worlds.py
 * - professionalWorldsOpenApi.ts (OpenAPI pilot read/write DTO aliases)
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

export const PROFESSIONAL_WORLDS_APP_ID = 'app-professional-worlds';
export const PROFESSIONAL_WORLDS_APP_COMPONENT = 'ProfessionalWorlds';
export const PROFESSIONAL_WORLDS_VERTICAL_REALTOR = 'realtor';

export type Decimalish = string | number | null;

export type { ProfessionVerticalOut as ProfessionVertical } from './professionalWorldsOpenApi';

export type { SpecialistProfileOut as SpecialistProfile } from './professionalWorldsOpenApi';

export type { SpecialistProfileUpsertBody as SpecialistProfileUpsert } from './professionalWorldsOpenApi';

export type { ProfessionalUserVerticalActivationOut as ProfessionalUserVerticalActivation } from './professionalWorldsOpenApi';

export type { RealtorJtbdContextOut as RealtorJtbdContext } from './professionalWorldsOpenApi';

export type { RealtorPropertyOut as RealtorProperty } from './professionalWorldsOpenApi';

export type { RealtorPropertyCreateBody as RealtorPropertyCreate } from './professionalWorldsOpenApi';

export type { RealtorPropertyUpdateBody as RealtorPropertyUpdate } from './professionalWorldsOpenApi';

export type { RealtorPropertyMediaOut as RealtorPropertyMedia } from './professionalWorldsOpenApi';

export type { RealtorPropertyMediaCreateBody as RealtorPropertyMediaCreate } from './professionalWorldsOpenApi';

export type { RealtorBuyerRequirementOut as RealtorBuyerRequirement } from './professionalWorldsOpenApi';

export type { RealtorBuyerRequirementCreateBody as RealtorBuyerRequirementCreate } from './professionalWorldsOpenApi';

export type { RealtorBuyerRequirementUpdateBody as RealtorBuyerRequirementUpdate } from './professionalWorldsOpenApi';

export type { RealtorSellerProfileOut as RealtorSellerProfile } from './professionalWorldsOpenApi';

export type { RealtorSellerProfileCreateBody as RealtorSellerProfileCreate } from './professionalWorldsOpenApi';

export type { RealtorSellerProfileUpdateBody as RealtorSellerProfileUpdate } from './professionalWorldsOpenApi';

export type { RealtorDealEventOut as RealtorDealEvent } from './professionalWorldsOpenApi';

export type { DealEventAppendBody as RealtorDealEventAppend } from './professionalWorldsOpenApi';

export type { ProfessionalClientCreateBody as ProfessionalClientCreate } from './professionalWorldsOpenApi';

export type { ProfessionalDealOut as ProfessionalDeal } from './professionalWorldsOpenApi';

export type { ProfessionalDealCreateBody as ProfessionalDealCreate } from './professionalWorldsOpenApi';

export type { ProfessionalDealUpdateBody as ProfessionalDealUpdate } from './professionalWorldsOpenApi';

export type { RealtorLeadOut as RealtorLead } from './professionalWorldsOpenApi';

export type { RealtorLeadCreateBody as RealtorLeadCreate } from './professionalWorldsOpenApi';

export type { RealtorTaskOut as RealtorTask } from './professionalWorldsOpenApi';

export type { RealtorTaskCreateBody as RealtorTaskCreate } from './professionalWorldsOpenApi';

export type { RealtorTaskUpdateBody as RealtorTaskUpdate } from './professionalWorldsOpenApi';

export type { RealtorPropertyShowingOut as RealtorShowing } from './professionalWorldsOpenApi';

export type { RealtorPropertyShowingCreateBody as RealtorShowingCreate } from './professionalWorldsOpenApi';

export type { RealtorPropertyShowingUpdateBody as RealtorShowingUpdate } from './professionalWorldsOpenApi';

export type { ProfessionalLearningLessonOut as ProfessionalLearningLesson } from './professionalWorldsOpenApi';

export type { ProfessionalLearningCourseOut as ProfessionalLearningCourse } from './professionalWorldsOpenApi';

export type { ProfessionalArtifactOut as ProfessionalArtifact } from './professionalWorldsOpenApi';

export type { ProfessionalClientOut as ProfessionalClient } from './professionalWorldsOpenApi';

import type {
	ProfessionVerticalOut,
	ProfessionalArtifactOut,
	ProfessionalClientOut,
	ProfessionalDealOut,
	ProfessionalLearningCourseOut,
	ProfessionalUserVerticalActivationOut,
	ProfessionalWorldsRuntimeConfig as ProfessionalWorldsRuntimeConfigType,
	RealtorPropertyOut,
	RealtorPropertyShowingOut,
	RealtorTaskCreateBody,
	RealtorTaskOut,
	RealtorTaskUpdateBody,
	SpecialistProfileOut,
} from './professionalWorldsOpenApi';

/** Legacy alias — vertical CRM tasks use `RealtorTaskOut` pilot schemas. */
export type ProfessionalTask = RealtorTaskOut;

export type ProfessionalTaskCreate = RealtorTaskCreateBody;

export type ProfessionalTaskUpdate = RealtorTaskUpdateBody;

export type { RealtorProDocumentOut as RealtorDocument } from './professionalWorldsOpenApi';

export type { RealtorProDocumentCreateBody as RealtorDocumentCreate } from './professionalWorldsOpenApi';

export type { RealtorProDocumentUpdateBody as RealtorDocumentUpdate } from './professionalWorldsOpenApi';

export type { RealtorPriceAnalysisSnapshotOut as RealtorPriceAnalysisSnapshot } from './professionalWorldsOpenApi';

export type { PriceAnalysisSnapshotCreateBody as RealtorPriceAnalysisSnapshotCreate } from './professionalWorldsOpenApi';

export type { RealtorMarketingCampaignOut as RealtorMarketingCampaign } from './professionalWorldsOpenApi';

export type { MarketingCampaignCreateBody as RealtorMarketingCampaignCreate } from './professionalWorldsOpenApi';

export type { MarketingCampaignUpdateBody as RealtorMarketingCampaignUpdate } from './professionalWorldsOpenApi';

export type { RealtorObjectionReplyOut as RealtorObjectionReply } from './professionalWorldsOpenApi';

export type { ObjectionReplyUpsertBody as RealtorObjectionReplyUpsert } from './professionalWorldsOpenApi';

export type { RealtorPublicationChannelOut as RealtorPublicationChannel } from './professionalWorldsOpenApi';

export type { PublicationChannelUpsertBody as RealtorPublicationChannelUpsert } from './professionalWorldsOpenApi';

export type { PublicationChannelPatchBody as RealtorPublicationChannelPatch } from './professionalWorldsOpenApi';

export type { ProfessionalDealPropertyLinkBackfillOut } from './professionalWorldsOpenApi';

export type { MediaEnhancementRequestBody as MediaEnhancementRequest } from './professionalWorldsOpenApi';

export type { RealtorCommunicationLogOut as RealtorCommunicationLog } from './professionalWorldsOpenApi';

export type { CommunicationLogCreateBody as RealtorCommunicationLogCreate } from './professionalWorldsOpenApi';

export type { RealtorListingQualityScoreOut as RealtorListingQualityScore } from './professionalWorldsOpenApi';

export type { ProfessionalVerticalModuleOut as ProfessionalRuntimeModule } from './professionalWorldsOpenApi';

export type { ProfessionalVerticalSchemaOut as ProfessionalRuntimeSchema } from './professionalWorldsOpenApi';

import type { ProfessionalAiActionRuntimeOut } from './professionalWorldsOpenApi';

/** OpenAPI row plus optional runtime safety hints used by AiActionLauncher. */
export type ProfessionalRuntimeAiAction = ProfessionalAiActionRuntimeOut & {
	safety_warnings?: string[];
	risk_level?: 'low' | 'medium' | 'high' | string;
};

export type { ProfessionalPhotoPresetRuntimeOut as ProfessionalRuntimePhotoPreset } from './professionalWorldsOpenApi';

export type { ProfessionalIntegrationBindingOut as ProfessionalRuntimeIntegration } from './professionalWorldsOpenApi';

export type { ProfessionalPlaybookRuntimeOut as ProfessionalPlaybookRuntime } from './professionalWorldsOpenApi';

export type { ProfessionalWorldsRuntimeConfig } from './professionalWorldsOpenApi';

export type { ProfessionalWorldsMultiRuntimeConfig } from './professionalWorldsOpenApi';

export type RealtorGenerationTone =
	| 'jtbd'
	| 'investor'
	| 'family'
	| 'rental'
	| 'premium'
	| 'concise';

export type { RealtorGenerationBody as RealtorGenerationRequest } from './professionalWorldsOpenApi';

export type { CoachSimulationBody as CoachSimulationRequest } from './professionalWorldsOpenApi';

export type { ProfessionalPlaybookRunArtifactOut as ProfessionalPlaybookRunArtifact } from './professionalWorldsOpenApi';

export type { ProfessionalPlaybookRunOut as ProfessionalPlaybookRun } from './professionalWorldsOpenApi';

export type { ProfessionalPlaybookLaunchBody as ProfessionalPlaybookLaunch } from './professionalWorldsOpenApi';

export type RealtorQuotaPlaybookEstimate = {
	playbook_key: string;
	display_name?: string | null;
	total_estimated_units: number;
	total_ugs_credits?: number | null;
};

export type RealtorQuotaSummary = {
	vertical_slug: string;
	credits_used_24h: number;
	credits_balance?: number | null;
	playbook_estimates: RealtorQuotaPlaybookEstimate[];
};

export interface ProfessionalWorldsSnapshot {
	verticals: ProfessionVerticalOut[];
	runtimeConfig: ProfessionalWorldsRuntimeConfigType | null;
	runtimeConfigs: ProfessionalWorldsRuntimeConfigType[];
	verticalActivations: ProfessionalUserVerticalActivationOut[];
	profile: SpecialistProfileOut | null;
	properties: RealtorPropertyOut[];
	clients: ProfessionalClientOut[];
	deals: ProfessionalDealOut[];
	courses: ProfessionalLearningCourseOut[];
	artifacts: ProfessionalArtifactOut[];
	providerHealth?: ProfessionalWorldsProviderHealth | null;
	/** Optional local cache; not part of bootstrap OpenAPI snapshot. */
	showings?: RealtorPropertyShowingOut[];
}

export interface ProfessionalWorldsProviderHealth {
	ugsOk: boolean;
	degraded: boolean;
	message: string;
}

export interface StreamCallbacks {
	onStarted?: (requestId: string) => void;
	onProgress?: (message: string) => void;
	onResult?: (text: string, artifact?: ProfessionalArtifactOut) => void;
	onRawResult?: (data: Record<string, unknown>) => void;
	onError?: (message: string) => void;
}

export type {
	ObjectIntakeDiagnostics,
	ObjectIntakePreview,
} from './professionalWorldsApiZod';

export type { MediaEnhancementJobOut as MediaEnhancementJob } from './professionalWorldsOpenApi';

export type { RealtorMediaBatchItemOut as RealtorMediaBatchItem } from './professionalWorldsOpenApi';

export type { RealtorMediaBatchJobOut as RealtorMediaBatchJob } from './professionalWorldsOpenApi';

export type { RealtorMediaBatchCreateBody as RealtorMediaBatchCreate } from './professionalWorldsOpenApi';

export type { RealtorMediaBatchDetailOut as RealtorMediaBatchDetail } from './professionalWorldsOpenApi';

export type { ProfessionalMediaAlbumOut as ProfessionalMediaAlbum } from './professionalWorldsOpenApi';

export type { ProfessionalMediaAlbumCreateBody as ProfessionalMediaAlbumCreate } from './professionalWorldsOpenApi';

export type { ProfessionalMediaAlbumPatchBody as ProfessionalMediaAlbumPatch } from './professionalWorldsOpenApi';

export type { RealtorMediaBatchItemReviewBody as RealtorMediaBatchItemReview } from './professionalWorldsOpenApi';

export type { BrandVisualKitOut } from './professionalWorldsOpenApi';

export type { BrandVisualKitUpsertBody as BrandVisualKitUpsert } from './professionalWorldsOpenApi';

export type { ProfessionalUserVerticalActivationUpsertBody as ProfessionalUserVerticalActivationUpsert } from './professionalWorldsOpenApi';

export type { ProfessionalCrossAppDraftLinkOut as ProfessionalCrossAppDraftLink } from './professionalWorldsOpenApi';
