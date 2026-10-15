import { useMutation } from '@tanstack/react-query';
import type * as React from 'react';
import { ensureProjectDesktopFolder } from '@/pages/ContentManager/projectDesktopFolder';
import { log } from '@/utils/logger';
import { cabinetNotify } from '../cabinetNotify';
import type { MarketingView } from '../constants';
import {
	marketingCabinetApi,
	type CreateCompanyPayload,
	type CreateProjectPayload,
	type UpdateCompanyPayload,
} from '../marketingCabinetApi';
import type {
	CompanyFormState,
	ProjectFormState,
} from '../marketingCabinetPageTypes';

export type MarketingCabinetOrganizationMutationsDeps = {
	t: (key: string, options?: Record<string, unknown>) => string;
	invalidateMarketingData: () => Promise<void>;
	raiseErrorNotice: (error: unknown, fallback: string) => void;
	setCreatingCompany: React.Dispatch<React.SetStateAction<boolean>>;
	setEditingCompany: React.Dispatch<
		React.SetStateAction<
			import('../marketingCabinetApi').MarketingCompany | null
		>
	>;
	setCompanyForm: React.Dispatch<React.SetStateAction<CompanyFormState>>;
	setSelectedCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	setActiveView: (view: MarketingView) => void;
	setCreatingProject: React.Dispatch<React.SetStateAction<boolean>>;
	setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	setEditingProject: React.Dispatch<
		React.SetStateAction<
			import('../marketingCabinetApi').MarketingProject | null
		>
	>;
	setProjectForm: React.Dispatch<React.SetStateAction<ProjectFormState>>;
};

export function useMarketingCabinetOrganizationMutations(
	deps: MarketingCabinetOrganizationMutationsDeps
) {
	const {
		t,
		invalidateMarketingData,
		raiseErrorNotice,
		setCreatingCompany,
		setEditingCompany,
		setCompanyForm,
		setSelectedCompanyId,
		setActiveView,
		setCreatingProject,
		setSelectedProjectId,
		setEditingProject,
		setProjectForm,
	} = deps;

	const updateCompanyMutation = useMutation({
		mutationFn: ({
			companyId,
			payload,
		}: {
			companyId: string;
			payload: UpdateCompanyPayload;
		}) => marketingCabinetApi.updateCompany(companyId, payload),
		onSuccess: async () => {
			await invalidateMarketingData();
			setCreatingCompany(false);
			setEditingCompany(null);
			setCompanyForm({
				name: '',
				industry: '',
				website: '',
				description: '',
				size: 'small',
				representativeUserId: null,
				representativeDeferred: true,
			});
			cabinetNotify.success(t('cabinetPage.notices.companyUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.companyUpdateFailed')),
	});

	const createCompanyMutation = useMutation({
		mutationFn: (payload: CreateCompanyPayload) =>
			marketingCabinetApi.createCompany(payload),
		onSuccess: async (company) => {
			await invalidateMarketingData();
			setCreatingCompany(false);
			setSelectedCompanyId(company.id);
			setCompanyForm({
				name: '',
				industry: '',
				website: '',
				description: '',
				size: 'small',
				representativeUserId: null,
				representativeDeferred: true,
			});
			cabinetNotify.success(
				t('cabinetPage.notices.companyCreated', { name: company.name })
			);
			setActiveView('companies');
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.companyCreateFailed')),
	});

	const deleteCompanyMutation = useMutation({
		mutationFn: (companyId: string) =>
			marketingCabinetApi.deleteCompany(companyId),
		onSuccess: async () => {
			await invalidateMarketingData();
			cabinetNotify.success(t('cabinetPage.notices.companyArchived'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.companyDeleteFailed')),
	});

	const createProjectMutation = useMutation({
		mutationFn: (payload: CreateProjectPayload) =>
			marketingCabinetApi.createProject(payload),
		onSuccess: async (project) => {
			await invalidateMarketingData();
			setCreatingProject(false);
			setSelectedProjectId(project.id);
			setEditingProject(null);
			setProjectForm({
				name: '',
				description: '',
				goals: '',
				key_tasks: '',
				category: 'marketing_campaign',
				priority: 'medium',
			});
			try {
				await ensureProjectDesktopFolder({
					projectId: project.id,
					projectName: project.name,
				});
			} catch (error) {
				log.warn(
					'MarketingCabinet',
					`project desktop folder ensure failed: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			cabinetNotify.success(
				t('cabinetPage.notices.projectCreated', { name: project.name })
			);
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.projectCreateFailed')),
	});

	const updateProjectMutation = useMutation({
		mutationFn: ({
			projectId,
			payload,
		}: {
			projectId: string;
			payload: Parameters<typeof marketingCabinetApi.updateProject>[1];
		}) => marketingCabinetApi.updateProject(projectId, payload),
		onSuccess: async (project) => {
			await invalidateMarketingData();
			setCreatingProject(false);
			setEditingProject(null);
			setProjectForm({
				name: '',
				description: '',
				goals: '',
				key_tasks: '',
				category: 'marketing_campaign',
				priority: 'medium',
			});
			cabinetNotify.success(
				t('cabinetPage.notices.projectUpdated', { name: project.name })
			);
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.projectUpdateFailed')),
	});

	const deleteProjectMutation = useMutation({
		mutationFn: (projectId: string) =>
			marketingCabinetApi.deleteProject(projectId),
		onSuccess: async () => {
			await invalidateMarketingData();
			cabinetNotify.success(t('cabinetPage.notices.projectArchived'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.projectDeleteFailed')),
	});

	return {
		updateCompanyMutation,
		createCompanyMutation,
		deleteCompanyMutation,
		createProjectMutation,
		updateProjectMutation,
		deleteProjectMutation,
	};
}
