/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companies / projects / members / transfer-lead API slice for the marketing cabinet.
 *
 * Invariants:
 * - `listProjectMembers` parses `{ items, total }` via Zod before cache consumers.
 *
 * Related:
 * - marketingCabinetApi/marketingCabinetApiZod.ts
 */
import { api } from '../../../services/api/client';

import { API_OPTIONS } from './config';
import { parseMarketingProjectMembersList } from './marketingCabinetApiZod';
import type { MarketingProjectMembersListResponse } from './marketingCabinetApiCoreEntityTypes';
import type {
	AddProjectMemberPayload,
	CreateCompanyPayload,
	CreateProjectPayload,
	MarketingCompany,
	MarketingProject,
	MarketingProjectMember,
	UpdateCompanyPayload,
	UpdateProjectMemberPayload,
	UpdateProjectPayload,
} from './index';

export const marketingCabinetOrganizationsApi = {
	listCompanies: (opts?: {
		as_representative?: boolean;
		limit?: number;
		skip?: number;
	}) =>
		api.get<MarketingCompany[]>('/companies', {
			...API_OPTIONS,
			params: {
				...(opts?.as_representative ? { as_representative: 'true' } : {}),
				...(opts?.limit != null ? { limit: opts.limit } : {}),
				...(opts?.skip != null ? { skip: opts.skip } : {}),
			},
		}),

	getCompany: (companyId: string) =>
		api.get<MarketingCompany>(`/companies/${companyId}`, API_OPTIONS),

	createCompany: (payload: CreateCompanyPayload) =>
		api.post<MarketingCompany>('/companies', payload, API_OPTIONS),

	updateCompany: (companyId: string, payload: UpdateCompanyPayload) =>
		api.put<MarketingCompany>(`/companies/${companyId}`, payload, API_OPTIONS),

	deleteCompany: (companyId: string) =>
		api.delete<{ message: string; company_id: string }>(
			`/companies/${companyId}`,
			API_OPTIONS
		),

	listProjects: (companyId?: string | null, limit?: number, skip?: number) =>
		api.get<MarketingProject[]>('/projects', {
			...API_OPTIONS,
			params: {
				...(companyId ? { company_id: companyId } : {}),
				...(limit != null ? { limit } : {}),
				...(skip != null ? { skip } : {}),
			},
		}),

	getProject: (projectId: string) =>
		api.get<MarketingProject>(`/projects/${projectId}`, API_OPTIONS),

	createProject: (payload: CreateProjectPayload) =>
		api.post<MarketingProject>('/projects', payload, API_OPTIONS),

	updateProject: (projectId: string, payload: UpdateProjectPayload) =>
		api.put<MarketingProject>(`/projects/${projectId}`, payload, API_OPTIONS),

	deleteProject: (projectId: string) =>
		api.delete<{ message: string; project_id: string }>(
			`/projects/${projectId}`,
			API_OPTIONS
		),

	transferProjectLead: (projectId: string, newLeadUserId: string) =>
		api.post<MarketingProject>(
			`/projects/${projectId}/transfer-lead`,
			{ new_lead_user_id: newLeadUserId },
			API_OPTIONS
		),

	listProjectMembers: async (projectId: string, limit = 200, offset = 0) => {
		const raw = await api.get<MarketingProjectMembersListResponse>(
			`/projects/${projectId}/members`,
			{
				...API_OPTIONS,
				params: { limit, offset },
			}
		);
		return parseMarketingProjectMembersList(raw);
	},

	addProjectMember: (projectId: string, payload: AddProjectMemberPayload) =>
		api.post<MarketingProjectMember>(
			`/projects/${projectId}/members`,
			{
				user_id: payload.user_id,
				role: payload.role,
				permissions: payload.permissions ?? [],
			},
			API_OPTIONS
		),

	updateProjectMember: (
		projectId: string,
		memberId: string,
		payload: UpdateProjectMemberPayload
	) =>
		api.put<MarketingProjectMember>(
			`/projects/${projectId}/members/${memberId}`,
			payload,
			API_OPTIONS
		),

	removeProjectMember: (projectId: string, memberId: string) =>
		api.delete<{ message: string; member_id: string }>(
			`/projects/${projectId}/members/${memberId}`,
			API_OPTIONS
		),
};
