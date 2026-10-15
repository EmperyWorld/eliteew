/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for user-owned companion action workflows.
 *
 * Invariants:
 * - Scoped to authenticated user; paths under ``/api/v1/ewa/companion-user-workflows``.
 * - Must pass shared ``API_OPTIONS`` (``baseURL: '/api/v1'``) like other EWA clients.
 * - Public types alias OpenAPI schemas from `ewaOpenApi.ts` — no parallel hand DTO twins.
 *
 * Related:
 * - api/ewa_platform/gateways/routers/companion_user_workflows.py
 * - src/services/ewa/ewaOpenApi.ts
 */

import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { APIError, apiClient } from '@/services/api/client';

import type {
	CompanionUserWorkflowObservationTriggersOut,
	CompanionUserWorkflowObservationTriggersPatchIn,
	CompanionUserWorkflowOut,
	CompanionUserWorkflowToolCatalogEntry,
	CompanionUserWorkflowToolCatalogField,
	CompanionUserWorkflowToolCatalogFieldOption,
	CompanionUserWorkflowValidateIn,
	CompanionUserWorkflowValidateOut,
	CompanionWorkflowValidateV2Request,
	CompanionWorkflowValidateV2Response,
	UserWorkflowCreateInV1,
	UserWorkflowDagBodyV2,
	UserWorkflowPatchInV1,
	UserWorkflowStepInV1,
	UserWorkflowTriggerPhraseV1,
} from './ewaOpenApi';

export type { CompanionWorkflowBuilderMetaV2 } from './ewaOpenApi';

export type CompanionUserWorkflow = CompanionUserWorkflowOut;
export type CompanionUserWorkflowTrigger = UserWorkflowTriggerPhraseV1;
export type CompanionUserWorkflowStep = UserWorkflowStepInV1;
export type {
	CompanionUserWorkflowToolCatalogEntry,
	CompanionUserWorkflowToolCatalogField,
	CompanionUserWorkflowToolCatalogFieldOption,
};
export type CompanionUserWorkflowCreateBody = UserWorkflowCreateInV1;
export type CompanionUserWorkflowDagBodyV2 = UserWorkflowDagBodyV2;
export type CompanionUserWorkflowObservationTriggers =
	CompanionUserWorkflowObservationTriggersOut;

export const COMPANION_USER_WORKFLOWS_PATH =
	'/ewa/companion-user-workflows' as const;

const EWA_API_OPTIONS = { ...API_OPTIONS, skipAuthRedirect: false };

export function isCompanionUserWorkflowNotFound(error: unknown): boolean {
	return (
		error instanceof APIError &&
		error.statusCode === 404 &&
		String(error.message || '').includes('user_workflow_not_found')
	);
}

export async function listCompanionUserWorkflows(): Promise<
	CompanionUserWorkflow[]
> {
	const res = await apiClient.get<CompanionUserWorkflowOut[]>(
		COMPANION_USER_WORKFLOWS_PATH,
		EWA_API_OPTIONS
	);
	return Array.isArray(res.data) ? res.data : [];
}

export async function fetchCompanionUserWorkflowToolCatalog(): Promise<
	CompanionUserWorkflowToolCatalogEntry[]
> {
	const res = await apiClient.get<CompanionUserWorkflowToolCatalogEntry[]>(
		`${COMPANION_USER_WORKFLOWS_PATH}/tool-catalog`,
		EWA_API_OPTIONS
	);
	return Array.isArray(res.data) ? res.data : [];
}

export async function createCompanionUserWorkflow(
	body: UserWorkflowCreateInV1
): Promise<CompanionUserWorkflow> {
	const res = await apiClient.post<CompanionUserWorkflowOut>(
		COMPANION_USER_WORKFLOWS_PATH,
		body,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function getCompanionUserWorkflow(
	workflowId: string
): Promise<CompanionUserWorkflow> {
	const res = await apiClient.get<CompanionUserWorkflowOut>(
		`${COMPANION_USER_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}`,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function patchCompanionUserWorkflow(
	workflowId: string,
	body: UserWorkflowPatchInV1
): Promise<CompanionUserWorkflow> {
	const res = await apiClient.patch<CompanionUserWorkflowOut>(
		`${COMPANION_USER_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}`,
		body,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function deleteCompanionUserWorkflow(
	workflowId: string
): Promise<void> {
	await apiClient.delete(
		`${COMPANION_USER_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}`,
		EWA_API_OPTIONS
	);
}

export async function setCompanionUserWorkflowEnabled(
	workflowId: string,
	enabled: boolean
): Promise<CompanionUserWorkflow> {
	const action = enabled ? 'enable' : 'disable';
	const res = await apiClient.post<CompanionUserWorkflowOut>(
		`${COMPANION_USER_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}/${action}`,
		{},
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function validateCompanionUserWorkflow(
	body: CompanionUserWorkflowValidateIn
): Promise<CompanionUserWorkflowValidateOut> {
	const res = await apiClient.post<CompanionUserWorkflowValidateOut>(
		`${COMPANION_USER_WORKFLOWS_PATH}/validate`,
		body,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function validateCompanionUserWorkflowV2(
	body: CompanionWorkflowValidateV2Request
): Promise<CompanionWorkflowValidateV2Response> {
	const res = await apiClient.post<CompanionWorkflowValidateV2Response>(
		`${COMPANION_USER_WORKFLOWS_PATH}/validate-v2`,
		body,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function fetchCompanionUserWorkflowObservationTriggers(): Promise<CompanionUserWorkflowObservationTriggersOut> {
	const res = await apiClient.get<CompanionUserWorkflowObservationTriggersOut>(
		`${COMPANION_USER_WORKFLOWS_PATH}/observation-triggers`,
		EWA_API_OPTIONS
	);
	return res.data;
}

export async function patchCompanionUserWorkflowObservationTriggers(
	body: CompanionUserWorkflowObservationTriggersPatchIn
): Promise<CompanionUserWorkflowObservationTriggersOut> {
	const res =
		await apiClient.patch<CompanionUserWorkflowObservationTriggersOut>(
			`${COMPANION_USER_WORKFLOWS_PATH}/observation-triggers`,
			body,
			EWA_API_OPTIONS
		);
	return res.data;
}
