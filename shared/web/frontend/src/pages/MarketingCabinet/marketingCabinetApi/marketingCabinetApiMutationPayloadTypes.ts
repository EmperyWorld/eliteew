/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet mutation request payloads — OpenAPI Create/Update aliases.
 *
 * Invariants:
 * - UI-compat names (`CreateJobStoryPayload`, …) alias OpenAPI `*Request` schemas.
 * - Job story create/update use BE field `expected_outcome` (Out uses `outcome`).
 *
 * Related:
 * - marketingCabinetOpenApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4
 */

export type {
	CompanyCreate as CreateCompanyPayload,
	CompanyUpdate as UpdateCompanyPayload,
	ProjectCreate as CreateProjectPayload,
	ProjectUpdate as UpdateProjectPayload,
	JobStoryCreateRequest as CreateJobStoryPayload,
	JobStoryUpdateRequest as UpdateJobStoryPayload,
	JobStoryExtractionRequest as ExtractJobStoriesPayload,
	ValuePropositionCreateRequest as CreateValuePropositionPayload,
	ValuePropositionUpdateRequest as UpdateValuePropositionPayload,
	SWOTFactorInput as SwotFactorInput,
	SWOTCreateRequest as CreateSwotPayload,
	SWOTGenerateRequest as GenerateSwotPayload,
	SWOTUpdateRequest as UpdateSwotPayload,
	CompetitorCreateRequest as CreateCompetitorPayload,
	CompetitorUpdateRequest as UpdateCompetitorPayload,
	ResearchCreateRequest as CreateResearchPayload,
	ResearchUpdateRequest as UpdateResearchPayload,
	ResearchRunRequest as RunResearchPayload,
	SegmentCreateRequest as CreateSegmentPayload,
	SegmentUpdateRequest as UpdateSegmentPayload,
	CampaignCreateRequest as CreateCampaignPayload,
	CampaignUpdateRequest as UpdateCampaignPayload,
	FunnelStageInput as FunnelStageInputPayload,
	FunnelCreateRequest as CreateFunnelPayload,
	FunnelUpdateRequest as UpdateFunnelPayload,
	TaskCreateRequest as CreateTaskPayload,
	TaskUpdateRequest as UpdateTaskPayload,
	AlertCreateRequest as CreateAlertPayload,
	AlertUpdateRequest as UpdateAlertPayload,
} from './marketingCabinetOpenApi';
