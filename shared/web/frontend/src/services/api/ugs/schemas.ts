/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable service-layer aliases over the generated UGS OpenAPI pilot types.
 *
 * Invariants:
 * - Components must import UGS DTOs from service modules, not directly from `src/generated`.
 * - Provider-specific bags (`input_data`, `metadata`, `result`) stay flexible at the adapter boundary.
 * - Public catalog type is `GenerationTypeResponse`; admin twin is `AdminGenerationTypeResponse`.
 *
 * Related:
 * - src/generated/ugs-openapi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts / Wave 6
 */

import type { components } from '../../../generated/ugs-openapi';

export type UgsSchemas = components['schemas'];

export type UgsGenerationRequestCreateSchema =
	UgsSchemas['GenerationRequestCreate'];
export type UgsGenerationResponseSchema = UgsSchemas['GenerationResponse'];
export type UgsGenerationStatusResponseSchema =
	UgsSchemas['GenerationStatusResponse'];
export type UgsGenerationResultResponseSchema =
	UgsSchemas['GenerationResultResponse'];

export type UgsTaskSchema = UgsSchemas['UGSTaskResponse'];
export type UgsTrayTaskSchema = UgsSchemas['UGSTrayTaskResponse'];
export type UgsTraySummarySchema = UgsSchemas['UGSTraySummaryResponse'];
export type UgsStatsSchema = UgsSchemas['UGSStatsResponse'];
export type UgsMetricsSchema = UgsSchemas['UGSMetricsResponse'];
export type UgsAnalyticsSummarySchema =
	UgsSchemas['UGSAnalyticsSummaryResponse'];
export type UgsProviderHealthSchema = UgsSchemas['UGSProviderHealthRow'];
export type UgsProvidersStatusSchema = UgsSchemas['UGSProvidersStatusResponse'];
export type UgsProvidersStatusSummarySchema =
	UgsSchemas['UGSProvidersStatusSummary'];
export type UgsGenerationTypeSchema = UgsSchemas['GenerationTypeResponse'];
export type UgsGenerationTypeListSchema =
	UgsSchemas['GenerationTypeListResponse'];
export type UgsQueueOpsSnapshotSchema =
	UgsSchemas['UGSQueueOpsSnapshotResponse'];
export type UgsQueueOpsOperatorSloSchema = UgsSchemas['UGSQueueOpsOperatorSlo'];
export type UgsQueueOpsHintSchema = UgsSchemas['UGSQueueOpsHint'];
export type UgsQueueOpsPostgresSectionSchema =
	UgsSchemas['UGSQueueOpsPostgresSection'];
export type UgsQueueOpsRabbitSectionSchema =
	UgsSchemas['UGSQueueOpsRabbitSection'];
export type UgsQueueOpsRedisSectionSchema =
	UgsSchemas['UGSQueueOpsRedisSection'];
export type UgsQueueOpsWorkerTuningSchema =
	UgsSchemas['UGSQueueOpsWorkerTuning'];
export type UgsBillingStatsSchema = UgsSchemas['BillingStatsResponse'];

export type UgsWorkflowRecordSchema = UgsSchemas['UGSWorkflowRecord'];
export type UgsWorkflowListSchema = UgsSchemas['UGSWorkflowListResponse'];
export type UgsWorkflowDetailSchema = UgsSchemas['UGSWorkflowDetailResponse'];
export type UgsWorkflowExecuteSchema = UgsSchemas['UGSWorkflowExecuteResponse'];
export type UgsWorkflowExecutionSchema =
	UgsSchemas['UGSWorkflowExecutionRecord'];
export type UgsWorkflowExecutionsSchema =
	UgsSchemas['UGSWorkflowExecutionsResponse'];

export type UgsAdminV2SnapshotSchema = UgsSchemas['UgsAdminV2SnapshotResponse'];
export type UgsAdminV2BulkApplyRequestSchema =
	UgsSchemas['UgsAdminV2BulkApplyRequest'];
export type UgsAdminV2BulkApplyResultSchema =
	UgsSchemas['UgsAdminV2BulkApplyResult'];
export type UgsAdminV2ValidationIssueSchema =
	UgsSchemas['UgsAdminV2ValidationIssue'];

export type UgsAdminProviderSchema = UgsSchemas['GenerationProviderResponse'];
export type UgsAdminTypeSchema = UgsSchemas['AdminGenerationTypeResponse'];
export type UgsAdminComfyWorkflowSchema = UgsSchemas['ComfyUIWorkflowResponse'];
export type UgsAdminSettingsListSchema = UgsSchemas['UGSSettingListResponse'];
export type UgsAdminUserSchema = UgsSchemas['AdminUserResponse'];
export type UgsAdminUserLimitsUpdateSchema =
	UgsSchemas['UserLimitsUpdateRequest'];
