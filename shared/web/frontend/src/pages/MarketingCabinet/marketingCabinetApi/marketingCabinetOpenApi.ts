/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSOT hub for Marketing Cabinet HTTP DTOs. Full entity CRUD + dashboard layout /
 * performance / AMKA / **client-interaction (Wave B1)** from `marketing-cabinet-full-openapi`;
 * AI runs / project dashboard Zod-guarded envelopes from lite `marketing-cabinet-openapi`;
 * companies/projects org CRUD from `companies-projects-openapi`.
 *
 * Invariants:
 * - Lite owns AI-run + project-dashboard Zod parse surfaces (`marketingCabinetApiZod.ts`).
 * - Full owns entity Out / Create|Update Request / dashboard layout / performance / AMKA /
 *   client-interaction HTTP.
 * - Companies/projects: `companies-projects-openapi` (not marketing-cabinet prefix).
 * - SSE stream overlays stay hand in `marketingCabinetApiStream.types.ts`.
 * - View-only widget configs stay hand in `dashboard-widgets/` (not HTTP DTO).
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4 / Wave B1
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - .cursor/rules/openapi-ssot-bridge.mdc
 */

import type { components as FullComponents } from '@/generated/marketing-cabinet-full-openapi';
import type { components as LiteComponents } from '@/generated/marketing-cabinet-openapi';
import type { components as CompaniesProjectsComponents } from '@/generated/companies-projects-openapi';

type Full = FullComponents['schemas'];
type Lite = LiteComponents['schemas'];
type Org = CompaniesProjectsComponents['schemas'];

// --- Ownership: companies / projects (org pilot) ---

export type CompanyResponse = Org['CompanyResponse'];
export type CompanyCreate = Org['CompanyCreate'];
export type CompanyUpdate = Org['CompanyUpdate'];
export type ProjectResponse = Org['ProjectResponse'];
export type ProjectCreate = Org['ProjectCreate'];
export type ProjectUpdate = Org['ProjectUpdate'];
export type TransferLeadRequest = Org['TransferLeadRequest'];

/** UI-compat alias — company card HTTP shape. */
export type MarketingCompany = CompanyResponse;
/** UI-compat alias — project HTTP shape. */
export type MarketingProject = ProjectResponse;

// --- Ownership: lite pilot (Zod AI / dashboard envelopes) ---

export type MarketingAiRunDetailResponseLite =
	Lite['MarketingAiRunDetailResponse'];
export type MarketingAiRunListResponseLite = Lite['MarketingAiRunListResponse'];
export type MarketingProjectDashboardResponseLite =
	Lite['MarketingProjectDashboardResponse'];
export type MarketingAiRunOutLite = Lite['MarketingAiRunOut'];

// --- Job stories ---

export type MarketingJobStoryOut = Full['MarketingJobStoryOut'];
export type MarketingJobStoryListResponse =
	Full['MarketingJobStoryListResponse'];
export type JobStoryCreateRequest = Full['JobStoryCreateRequest'];
export type JobStoryUpdateRequest = Full['JobStoryUpdateRequest'];
export type JobStoryExtractionRequest = Full['JobStoryExtractionRequest'];
export type DeleteJobStoryResponse = Full['DeleteJobStoryResponse'];

/** UI-compat alias. */
export type MarketingJobStory = MarketingJobStoryOut;

// --- Value propositions ---

export type MarketingValuePropositionOut = Full['MarketingValuePropositionOut'];
export type MarketingValuePropositionListResponse =
	Full['MarketingValuePropositionListResponse'];
export type ValuePropositionCreateRequest =
	Full['ValuePropositionCreateRequest'];
export type ValuePropositionUpdateRequest =
	Full['ValuePropositionUpdateRequest'];
export type DeleteValuePropositionResponse =
	Full['DeleteValuePropositionResponse'];

export type MarketingValueProposition = MarketingValuePropositionOut;

// --- SWOT ---

export type MarketingSwotOut = Full['MarketingSwotOut'];
export type MarketingSwotFactorOut = Full['MarketingSwotFactorOut'];
export type MarketingSwotFactorsOut = Full['MarketingSwotFactorsOut'];
export type MarketingSwotListResponse = Full['MarketingSwotListResponse'];
export type SWOTCreateRequest = Full['SWOTCreateRequest'];
export type SWOTUpdateRequest = Full['SWOTUpdateRequest'];
export type SWOTGenerateRequest = Full['SWOTGenerateRequest'];
export type SWOTFactorInput = Full['SWOTFactorInput'];
export type DeleteSwotAnalysisResponse = Full['DeleteSwotAnalysisResponse'];

export type MarketingSwot = MarketingSwotOut;
export type MarketingSwotFactor = MarketingSwotFactorOut;

// --- Competitors ---

export type MarketingCompetitorOut = Full['MarketingCompetitorOut'];
export type MarketingCompetitorListResponse =
	Full['MarketingCompetitorListResponse'];
export type CompetitorCreateRequest = Full['CompetitorCreateRequest'];
export type CompetitorUpdateRequest = Full['CompetitorUpdateRequest'];
export type DeleteCompetitorResponse = Full['DeleteCompetitorResponse'];

export type MarketingCompetitor = MarketingCompetitorOut;

// --- Research ---

export type MarketingResearchOut = Full['MarketingResearchOut'];
export type MarketingResearchListResponse =
	Full['MarketingResearchListResponse'];
export type ResearchCreateRequest = Full['ResearchCreateRequest'];
export type ResearchUpdateRequest = Full['ResearchUpdateRequest'];
export type ResearchRunRequest = Full['ResearchRunRequest'];
export type ResearchTypesResponse = Full['ResearchTypesResponse'];
export type DeleteResearchResponse = Full['DeleteResearchResponse'];

export type MarketingResearch = MarketingResearchOut;

// --- Segments / campaigns / funnels / tasks / alerts ---

export type MarketingSegmentOut = Full['MarketingSegmentOut'];
export type MarketingSegmentListResponse = Full['MarketingSegmentListResponse'];
export type SegmentCreateRequest = Full['SegmentCreateRequest'];
export type SegmentUpdateRequest = Full['SegmentUpdateRequest'];

export type MarketingCampaignOut = Full['MarketingCampaignOut'];
export type MarketingCampaignListResponse =
	Full['MarketingCampaignListResponse'];
export type CampaignCreateRequest = Full['CampaignCreateRequest'];
export type CampaignUpdateRequest = Full['CampaignUpdateRequest'];

export type MarketingFunnelOut = Full['MarketingFunnelOut'];
export type MarketingFunnelStageOut = Full['MarketingFunnelStageOut'];
export type MarketingFunnelListResponse = Full['MarketingFunnelListResponse'];
export type FunnelCreateRequest = Full['FunnelCreateRequest'];
export type FunnelUpdateRequest = Full['FunnelUpdateRequest'];
export type FunnelStageInput = Full['FunnelStageInput'];

export type MarketingTaskOut = Full['MarketingTaskOut'];
export type MarketingTaskListResponse = Full['MarketingTaskListResponse'];
export type TaskCreateRequest = Full['TaskCreateRequest'];
export type TaskUpdateRequest = Full['TaskUpdateRequest'];

export type MarketingAlertOut = Full['MarketingAlertOut'];
export type MarketingAlertListResponse = Full['MarketingAlertListResponse'];
export type AlertCreateRequest = Full['AlertCreateRequest'];
export type AlertUpdateRequest = Full['AlertUpdateRequest'];

export type MarketingSegment = MarketingSegmentOut;
export type MarketingCampaign = MarketingCampaignOut;
export type MarketingFunnel = MarketingFunnelOut;
export type MarketingFunnelStage = MarketingFunnelStageOut;
export type MarketingTask = MarketingTaskOut;
export type MarketingAlert = MarketingAlertOut;

// --- Content / project summary / health / overview / graph ---

export type MarketingContentItemOut = Full['MarketingContentItemOut'];
export type MarketingProjectSummaryOut = Full['MarketingProjectSummaryOut'];
export type MarketingProjectHealthResponse =
	Full['MarketingProjectHealthResponse'];
export type MarketingProjectOverviewResponse =
	Full['MarketingProjectOverviewResponse'];
export type MarketingProjectGraphResponse =
	Full['MarketingProjectGraphResponse'];
export type MarketingGraphNodeOut = Full['MarketingGraphNodeOut'];
export type MarketingGraphEdgeOut = Full['MarketingGraphEdgeOut'];
export type MarketingCountsOut = Full['MarketingCountsOut'];
export type MarketingCoverageMetricOut = Full['MarketingCoverageMetricOut'];
export type MarketingFreshnessFlagOut = Full['MarketingFreshnessFlagOut'];
export type MarketingInsightOut = Full['MarketingInsightOut'];
export type MarketingIssueRemediationOut = Full['MarketingIssueRemediationOut'];
export type MarketingRecommendedActionOut =
	Full['MarketingRecommendedActionOut'];
export type MarketingActivityItemOut = Full['MarketingActivityItemOut'];
export type MarketingCompanyRollupExcerptOut =
	Full['MarketingCompanyRollupExcerptOut'];
export type ReadinessBreakdownOut = Full['ReadinessBreakdownOut'];
export type ReadinessMetaOut = Full['ReadinessMetaOut'];
export type MarketingToolAgentResponse = Full['MarketingToolAgentResponse'];

export type MarketingContentItem = MarketingContentItemOut;
export type MarketingProjectSummary = MarketingProjectSummaryOut;
export type MarketingProjectHealth = MarketingProjectHealthResponse;
export type MarketingProjectOverview = MarketingProjectOverviewResponse;
export type MarketingProjectGraph = MarketingProjectGraphResponse;
export type MarketingGraphNode = MarketingGraphNodeOut;
export type MarketingGraphEdge = MarketingGraphEdgeOut;
export type MarketingCoverageMetric = MarketingCoverageMetricOut;
export type MarketingFreshnessFlag = MarketingFreshnessFlagOut;
export type MarketingInsight = MarketingInsightOut;
export type MarketingIssueRemediation = MarketingIssueRemediationOut;
export type MarketingRecommendedAction = MarketingRecommendedActionOut;
export type MarketingActivityItem = MarketingActivityItemOut;
export type MarketingCompanyRollupExcerpt = MarketingCompanyRollupExcerptOut;

// --- AI runs (full + shared Out) ---

export type MarketingAiRunOut = Full['MarketingAiRunOut'];
export type MarketingAiQueueSnapshot = Full['MarketingAiQueueSnapshot'];
export type MarketingAiAsyncStartResponse =
	Full['MarketingAiAsyncStartResponse'];
export type MarketingAiRunDetailResponse = Full['MarketingAiRunDetailResponse'];
export type MarketingAiRunListResponse = Full['MarketingAiRunListResponse'];

export type MarketingAiRun = MarketingAiRunOut;

// --- Dashboard layout ---

export type DashboardLayoutResponse = Full['DashboardLayoutResponse'];
export type DashboardLayoutListResponse = Full['DashboardLayoutListResponse'];
export type DashboardLayoutCreate = Full['DashboardLayoutCreate'];
export type DashboardLayoutUpdate = Full['DashboardLayoutUpdate'];
export type WidgetResponse = Full['WidgetResponse'];
export type WidgetCreate = Full['WidgetCreate'];
export type WidgetUpdate = Full['WidgetUpdate'];
export type GridPosition = Full['GridPosition'];
export type DashboardActivateResponse = Full['DashboardActivateResponse'];
export type DashboardCloneResponse = Full['DashboardCloneResponse'];
export type DashboardCleanupDuplicatesResponse =
	Full['DashboardCleanupDuplicatesResponse'];
export type DashboardUsageStats = Full['DashboardUsageStats'];
export type MarketingDashboardPresetOut = Full['MarketingDashboardPresetOut'];
export type MarketingDashboardPresetListResponse =
	Full['MarketingDashboardPresetListResponse'];
export type CreateLayoutFromPresetBody = Full['CreateLayoutFromPresetBody'];
export type CloneDashboardLayoutBody = Full['CloneDashboardLayoutBody'];

export type MarketingDashboardLayout = DashboardLayoutResponse;
export type MarketingDashboardLayoutListResponse = DashboardLayoutListResponse;
export type MarketingDashboardWidget = WidgetResponse;
export type MarketingDashboardGridPosition = GridPosition;
export type MarketingDashboardLayoutCreatePayload = DashboardLayoutCreate;
export type MarketingDashboardLayoutUpdatePayload = DashboardLayoutUpdate;
export type MarketingDashboardWidgetCreatePayload = WidgetCreate;
export type MarketingDashboardWidgetUpdatePayload = WidgetUpdate;
export type MarketingDashboardActivateResponse = DashboardActivateResponse;
export type MarketingDashboardCloneResponse = DashboardCloneResponse;
export type MarketingDashboardCleanupDuplicatesResponse =
	DashboardCleanupDuplicatesResponse;
export type MarketingDashboardUsageStats = DashboardUsageStats;
export type MarketingDashboardPreset = MarketingDashboardPresetOut;

// --- Performance dashboard ---

export type MarketingPerformanceDashboardResponse =
	Full['MarketingPerformanceDashboardResponse'];
export type MarketingPerformanceFiltersOut =
	Full['MarketingPerformanceFiltersOut'];
export type MarketingPerformanceTotalsOut =
	Full['MarketingPerformanceTotalsOut'];
export type MarketingPerformanceCampaignOut =
	Full['MarketingPerformanceCampaignOut'];
export type MarketingPerformanceSeriesPointOut =
	Full['MarketingPerformanceSeriesPointOut'];
export type MarketingPerformanceCohortOut =
	Full['MarketingPerformanceCohortOut'];
export type MarketingPerformanceDiagnosticOut =
	Full['MarketingPerformanceDiagnosticOut'];

export type MarketingPerformanceDashboard =
	MarketingPerformanceDashboardResponse;
export type MarketingPerformanceDashboardFilters =
	MarketingPerformanceFiltersOut;
export type MarketingPerformanceTotals = MarketingPerformanceTotalsOut;
export type MarketingPerformanceCampaign = MarketingPerformanceCampaignOut;
export type MarketingPerformanceSeriesPoint =
	MarketingPerformanceSeriesPointOut;
export type MarketingPerformanceCohort = MarketingPerformanceCohortOut;
export type MarketingPerformanceDiagnostic = MarketingPerformanceDiagnosticOut;

// --- AMKA HTTP (full pilot) — FE-only pulse/projection types stay in @/features/amka ---

export type AmkaRunOut = Full['AmkaRunOut'];
export type AmkaRunStepOut = Full['AmkaRunStepOut'];
export type AmkaPlanTaskOut = Full['AmkaPlanTaskOut'];
export type AmkaOperationOut = Full['AmkaOperationOut'];
export type AmkaSourceRefOut = Full['AmkaSourceRefOut'];
export type AmkaRunListResponse = Full['AmkaRunListResponse'];
export type AmkaRunDetailResponseOpenApi = Full['AmkaRunDetailResponse'];
export type AmkaAsyncStartResponse = Full['AmkaAsyncStartResponse'];
export type AmkaPresetOut = Full['AmkaPresetOut'];
export type AmkaPresetListResponse = Full['AmkaPresetListResponse'];
export type AmkaPresetOneResponse = Full['AmkaPresetOneResponse'];
export type AmkaPresetTemplateListResponse =
	Full['AmkaPresetTemplateListResponse'];
export type AmkaPresetConfigV1 = Full['AmkaPresetConfigV1'];
export type AmkaPresetExtraPlanTaskIn = Full['AmkaPresetExtraPlanTaskIn'];
export type AmkaOperatorConfigV1 = Full['AmkaOperatorConfigV1'];
export type AmkaOperatorConfigBundleOut = Full['AmkaOperatorConfigBundleOut'];

export type AmkaRun = AmkaRunOut;
export type AmkaRunStep = AmkaRunStepOut;
export type AmkaPlanTask = AmkaPlanTaskOut;
export type AmkaOperation = AmkaOperationOut;
export type AmkaSourceRef = AmkaSourceRefOut;
export type AmkaPreset = AmkaPresetOut;
export type AmkaPresetTemplate = Full['AmkaPresetTemplateOut'];
export type AmkaOperatorConfigBundle = AmkaOperatorConfigBundleOut;
export type AmkaResumeResponse = Full['AmkaResumeResponse'];
export type AmkaContinueStepResponse = Full['AmkaContinueStepResponse'];
export type AmkaCancelResponse = Full['AmkaCancelResponse'];
/** Shared control envelope for approve / resume / continue / cancel. */
export type AmkaControlResponse =
	| AmkaResumeResponse
	| AmkaContinueStepResponse
	| AmkaCancelResponse;

// --- Document autofill ---

export type AutofillTarget = Full['AutofillTarget'];
export type AutofillMode = Full['AutofillMode'];
export type MarketingDocumentAutofillRequest =
	Full['MarketingDocumentAutofillRequest'];
export type MarketingDocumentAutofillResponse =
	Full['MarketingDocumentAutofillResponse'];
export type MarketingDocumentAutofillPreviewItemOut =
	Full['MarketingDocumentAutofillPreviewItemOut'];
export type MarketingDocumentAutofillAppliedItemOut =
	Full['MarketingDocumentAutofillAppliedItemOut'];

export type MarketingDocumentAutofillTarget = AutofillTarget;
export type MarketingDocumentAutofillMode = AutofillMode;
export type MarketingDocumentAutofillPreviewItem =
	MarketingDocumentAutofillPreviewItemOut;
export type MarketingDocumentAutofillAppliedItem =
	MarketingDocumentAutofillAppliedItemOut;

// --- Remediation / options / chat ---

export type MarketingRemediationActionResponse =
	Full['MarketingRemediationActionResponse'];
export type MarketingRemediationActionItemOut =
	Full['MarketingRemediationActionItemOut'];
export type RemediationActionsRequest = Full['RemediationActionsRequest'];
export type MarketingOptionOut = Full['MarketingOptionOut'];
export type MarketingChatHistoryResponse = Full['MarketingChatHistoryResponse'];
export type ChatMessageOut = Full['ChatMessageOut'];

export type MarketingOption = MarketingOptionOut;
export type MarketingRemediationActionItem = MarketingRemediationActionItemOut;

// --- Client interaction (Wave B1) ---

export type ClientInteractionContextOut = Full['ClientInteractionContextOut'];
export type MarketingClientPartnerOut = Full['MarketingClientPartnerOut'];
export type ClientChatBridgeOut = Full['ClientChatBridgeOut'];
export type CustomerFacingSummaryGetOut = Full['CustomerFacingSummaryGetOut'];
export type CustomerFacingSummaryRecordOut =
	Full['CustomerFacingSummaryRecordOut'];
export type CustomerFacingSummaryPayloadOut =
	Full['CustomerFacingSummaryPayloadOut'];
export type CustomerFacingSummaryBody = Full['CustomerFacingSummaryBody'];
export type CustomerFacingMetricOut = Full['CustomerFacingMetricOut'];
export type MarketingClientDocApprovalOut =
	Full['MarketingClientDocApprovalOut'];
export type MarketingClientDocPendingRemovalOut =
	Full['MarketingClientDocPendingRemovalOut'];
export type ClientEwrpJobListItemOut = Full['ClientEwrpJobListItemOut'];
export type ClientPresShareOut = Full['ClientPresShareOut'];
export type MarketingOkOut = Full['MarketingOkOut'];
export type MarketingClientDocCountOut = Full['MarketingClientDocCountOut'];
export type MarketingClientRemovalIdOut = Full['MarketingClientRemovalIdOut'];
export type MarketingClientShareIdOut = Full['MarketingClientShareIdOut'];
export type MarketingClientApprovalActionOut =
	Full['MarketingClientApprovalActionOut'];

/** UI-compat aliases — client-interaction HTTP shapes. */
export type ClientInteractionContext = ClientInteractionContextOut;
export type ClientChatBridge = ClientChatBridgeOut;
export type ClientDocApproval = MarketingClientDocApprovalOut;
export type ClientEwrpJobListItem = ClientEwrpJobListItemOut;
export type ClientPresShare = ClientPresShareOut;
export type CustomerFacingSummaryGetResponse = CustomerFacingSummaryGetOut;
export type CustomerFacingSummaryRecord = CustomerFacingSummaryRecordOut;
export type CustomerFacingSummaryPayload = CustomerFacingSummaryPayloadOut;
