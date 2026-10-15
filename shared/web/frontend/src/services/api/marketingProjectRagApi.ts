/**
 * Marketing cabinet: project RAG sources (unified_content + IMC → synthetic UC).
 */
import type { components } from '@/generated/marketing-cabinet-rag-openapi';
import { api } from './client';
import { API_CONFIG } from './config';

const MARKETING_TIMEOUT_MULTIPLIER = 3;
const API_OPTIONS = {
	baseURL: '/api/v1',
	timeout: API_CONFIG.timeout * MARKETING_TIMEOUT_MULTIPLIER,
} as const;
/** Эмбеддинг + Qdrant могут занять дольше обычного marketing-запроса. */
const SEMANTIC_API_OPTIONS = {
	baseURL: '/api/v1',
	timeout: API_CONFIG.longTimeout * MARKETING_TIMEOUT_MULTIPLIER,
} as const;

const projectsBase = '/marketing-cabinet/projects';

export type MarketingRagSourceItem =
	components['schemas']['MarketingRagSourceItem'];
export type MarketingRagSourceListResponse =
	components['schemas']['MarketingRagSourceListResponse'];
export type PatchMarketingRagSourceBody =
	components['schemas']['PatchMarketingRagSourceBody'];
export type PatchMarketingRagSourceResponse =
	components['schemas']['PatchMarketingRagSourceResponse'];
export type PostImcRunToProjectRagResponse =
	components['schemas']['PostImcRunToProjectRagResponse'];
export type MarketingRagSemanticHit =
	components['schemas']['MarketingRagSemanticHit'];
export type MarketingRagSemanticSearchResponse =
	components['schemas']['MarketingRagSemanticSearchResponse'];

export const marketingProjectRagApi = {
	listProjectSources(
		projectId: string
	): Promise<MarketingRagSourceListResponse> {
		return api.get<MarketingRagSourceListResponse>(
			`${projectsBase}/${projectId}/rag-sources`,
			API_OPTIONS
		);
	},

	patchContentInclusion(
		projectId: string,
		contentId: string,
		body: PatchMarketingRagSourceBody
	): Promise<PatchMarketingRagSourceResponse> {
		return api.patch<PatchMarketingRagSourceResponse>(
			`${projectsBase}/${projectId}/rag-sources/content/${contentId}`,
			body,
			API_OPTIONS
		);
	},

	postFromImcRun(
		projectId: string,
		imcResearchRunId: string
	): Promise<PostImcRunToProjectRagResponse> {
		return api.post<PostImcRunToProjectRagResponse>(
			`${projectsBase}/${projectId}/rag-sources/from-imc-run/${imcResearchRunId}`,
			{},
			API_OPTIONS
		);
	},

	semanticSearch(
		projectId: string,
		params: { q: string; limit?: number; min_score?: number }
	): Promise<MarketingRagSemanticSearchResponse> {
		const sp = new URLSearchParams();
		sp.set('q', params.q);
		if (params.limit != null) sp.set('limit', String(params.limit));
		if (params.min_score != null) sp.set('min_score', String(params.min_score));
		return api.get<MarketingRagSemanticSearchResponse>(
			`${projectsBase}/${projectId}/rag-sources/semantic-search?${sp.toString()}`,
			SEMANTIC_API_OPTIONS
		);
	},
};
