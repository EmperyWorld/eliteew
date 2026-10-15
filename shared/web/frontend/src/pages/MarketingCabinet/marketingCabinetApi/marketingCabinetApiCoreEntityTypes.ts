/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Core Marketing Cabinet entity HTTP types — OpenAPI SSOT aliases (Wave 4).
 *
 * Invariants:
 * - Public entity types are aliases of generated Out / org schemas via
 *   `marketingCabinetOpenApi` (+ `projects-members` for members).
 * - No parallel hand DTO twins for bridged contracts.
 *
 * Related:
 * - marketingCabinetOpenApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4
 */

export type {
	MarketingCompany,
	MarketingProject,
	MarketingProjectSummary,
	MarketingJobStory,
	MarketingValueProposition,
	MarketingSwot,
	MarketingSwotFactor,
	MarketingCompetitor,
	MarketingResearch,
	MarketingContentItem,
	MarketingSegment,
	MarketingCampaign,
	MarketingFunnel,
	MarketingFunnelStage,
	MarketingTask,
	MarketingAlert,
} from './marketingCabinetOpenApi';

import type { components as ProjectsMembersComponents } from '@/generated/projects-members-openapi';

/** OpenAPI `ProjectMemberResponse` (`projects-members` pilot). */
export type MarketingProjectMember =
	ProjectsMembersComponents['schemas']['ProjectMemberResponse'];

/** OpenAPI `ProjectMembersListResponse`. */
export type MarketingProjectMembersListResponse =
	ProjectsMembersComponents['schemas']['ProjectMembersListResponse'];

/** OpenAPI `ProjectMemberCreate`. */
export type AddProjectMemberPayload =
	ProjectsMembersComponents['schemas']['ProjectMemberCreate'];

/** OpenAPI `ProjectMemberUpdate`. */
export type UpdateProjectMemberPayload =
	ProjectsMembersComponents['schemas']['ProjectMemberUpdate'];
