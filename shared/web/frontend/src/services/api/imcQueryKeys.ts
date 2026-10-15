import type { QueryKey } from '@tanstack/react-query';

export const imcQueryKeys = {
	all: ['imc'] as const,
	/** MarketingCabinetPage rail + MarketingAiJobCenter (`['marketing','imc',…]`). */
	marketingCabinetPrefix: ['marketing', 'imc'] as const,

	types: (companyId?: string | null): QueryKey =>
		[...imcQueryKeys.all, 'types', companyId ?? ''] as const,

	research: (researchId: string): QueryKey =>
		[...imcQueryKeys.all, 'research', researchId] as const,

	researchStatus: (researchId: string): QueryKey =>
		[...imcQueryKeys.all, 'research', researchId, 'status'] as const,

	listCompany: (
		companyId: string,
		filters: Record<string, unknown>
	): QueryKey =>
		[...imcQueryKeys.all, 'list', 'company', companyId, filters] as const,

	listProject: (
		projectId: string,
		filters: Record<string, unknown>
	): QueryKey =>
		[...imcQueryKeys.all, 'list', 'project', projectId, filters] as const,

	ragHints: (projectId: string): QueryKey =>
		[...imcQueryKeys.all, 'rag-hints', projectId] as const,
};
