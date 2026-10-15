/**
 * IMC (Исследователь маркетингового кабинета) — HTTP client.
 * Base: `/api/v1/marketing-cabinet/imc` (see documentation/product/imc/05_IMC_PUBLIC_API_SPEC.md).
 */

import type {
	ImcRagHintsPayload,
	ImcResearchDeleteResponse,
	ImcResearchListResponse,
	ImcResearchRunDetail,
	ImcResearchStatusPayload,
	ImcResearchTypesResponse,
	ImcRunResearchBody,
	ImcRunResearchResponse,
} from '../../types/imc';
import { api } from './client';
import { API_CONFIG } from './config';

const MARKETING_TIMEOUT_MULTIPLIER = 3;
const API_OPTIONS = {
	baseURL: '/api/v1',
	timeout: API_CONFIG.timeout * MARKETING_TIMEOUT_MULTIPLIER,
} as const;

const IMC_BASE = '/marketing-cabinet/imc';

export const imcClient = {
	listTypes(): Promise<ImcResearchTypesResponse> {
		return api.get<ImcResearchTypesResponse>(`${IMC_BASE}/types`, API_OPTIONS);
	},

	runResearch(body: ImcRunResearchBody): Promise<ImcRunResearchResponse> {
		return api.post<ImcRunResearchResponse>(
			`${IMC_BASE}/research/run`,
			body,
			API_OPTIONS
		);
	},

	ragHints(projectId: string): Promise<ImcRagHintsPayload> {
		return api.get<ImcRagHintsPayload>(
			`${IMC_BASE}/project/${projectId}/rag-hints`,
			API_OPTIONS
		);
	},

	rerunResearch(researchId: string): Promise<ImcRunResearchResponse> {
		return api.post<ImcRunResearchResponse>(
			`${IMC_BASE}/research/${researchId}/rerun`,
			{},
			API_OPTIONS
		);
	},

	getResearch(researchId: string): Promise<ImcResearchRunDetail> {
		return api.get<ImcResearchRunDetail>(
			`${IMC_BASE}/research/${researchId}`,
			API_OPTIONS
		);
	},

	getResearchStatus(researchId: string): Promise<ImcResearchStatusPayload> {
		return api.get<ImcResearchStatusPayload>(
			`${IMC_BASE}/research/${researchId}/status`,
			API_OPTIONS
		);
	},

	listForCompany(
		companyId: string,
		params?: {
			type_key?: string;
			status?: string;
			active_only?: boolean;
			limit?: number;
			offset?: number;
		}
	): Promise<ImcResearchListResponse> {
		const q = new URLSearchParams();
		if (params?.type_key) q.set('type_key', params.type_key);
		if (params?.status) q.set('status', params.status);
		if (params?.active_only) q.set('active_only', 'true');
		if (params?.limit != null) q.set('limit', String(params.limit));
		if (params?.offset != null) q.set('offset', String(params.offset));
		const qs = q.toString();
		const path = `${IMC_BASE}/company/${companyId}/researches${qs ? `?${qs}` : ''}`;
		return api.get<ImcResearchListResponse>(path, API_OPTIONS);
	},

	listForProject(
		projectId: string,
		params?: {
			type_key?: string;
			status?: string;
			active_only?: boolean;
			limit?: number;
			offset?: number;
		}
	): Promise<ImcResearchListResponse> {
		const q = new URLSearchParams();
		if (params?.type_key) q.set('type_key', params.type_key);
		if (params?.status) q.set('status', params.status);
		if (params?.active_only) q.set('active_only', 'true');
		if (params?.limit != null) q.set('limit', String(params.limit));
		if (params?.offset != null) q.set('offset', String(params.offset));
		const qs = q.toString();
		const path = `${IMC_BASE}/project/${projectId}/researches${qs ? `?${qs}` : ''}`;
		return api.get<ImcResearchListResponse>(path, API_OPTIONS);
	},

	cancelResearch(researchId: string): Promise<{ status: 'cancelled' }> {
		return api.post<{ status: 'cancelled' }>(
			`${IMC_BASE}/research/${researchId}/cancel`,
			{},
			API_OPTIONS
		);
	},

	deleteResearch(researchId: string): Promise<ImcResearchDeleteResponse> {
		return api.delete<ImcResearchDeleteResponse>(
			`${IMC_BASE}/research/${researchId}`,
			API_OPTIONS
		);
	},
};
