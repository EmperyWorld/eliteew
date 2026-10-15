import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api/client';
import { log } from '../../../utils/logger';

export interface TenancyCompany {
	id: string;
	name: string;
}

export interface TenancyProject {
	id: string;
	name: string;
	company_id: string;
}

function formatFetchError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Компании и проекты для фильтров Content Manager (те же эндпоинты, что в маркетинговом кабинете).
 */
export function useTenancyOptions() {
	const [companies, setCompanies] = useState<TenancyCompany[]>([]);
	const [projects, setProjects] = useState<TenancyProject[]>([]);
	const [loadingCompanies, setLoadingCompanies] = useState(false);
	const [loadingProjects, setLoadingProjects] = useState(false);
	const [companiesError, setCompaniesError] = useState<string | null>(null);
	const [projectsError, setProjectsError] = useState<string | null>(null);
	const [companiesSettled, setCompaniesSettled] = useState(false);
	const [projectsSettled, setProjectsSettled] = useState(false);
	const [projectsCompanyId, setProjectsCompanyId] = useState<string | null>(
		null
	);

	const companiesRequestId = useRef(0);
	const projectsRequestId = useRef(0);

	const refreshCompanies = useCallback(async () => {
		const reqId = ++companiesRequestId.current;
		setLoadingCompanies(true);
		setCompaniesError(null);
		try {
			const response = await api.get<Array<{ id: string; name: string }>>(
				'/companies',
				{
					baseURL: '/api/v1',
				}
			);
			if (reqId !== companiesRequestId.current) return;
			setCompanies(
				Array.isArray(response)
					? response.map((c) => ({ id: c.id, name: c.name }))
					: []
			);
			setCompaniesError(null);
		} catch (e) {
			if (reqId !== companiesRequestId.current) return;
			const msg = formatFetchError(e);
			log.warn('useTenancyOptions', `companies: ${msg}`);
			setCompanies([]);
			setCompaniesError(msg);
		} finally {
			if (reqId === companiesRequestId.current) {
				setLoadingCompanies(false);
				setCompaniesSettled(true);
			}
		}
	}, []);

	const refreshProjects = useCallback(async (companyId: string | null) => {
		if (!companyId) {
			projectsRequestId.current += 1;
			setProjects([]);
			setProjectsError(null);
			setProjectsSettled(false);
			setProjectsCompanyId(null);
			setLoadingProjects(false);
			return;
		}
		const reqId = ++projectsRequestId.current;
		setLoadingProjects(true);
		setProjectsError(null);
		try {
			const response = await api.get<
				Array<{ id: string; name: string; company_id: string }>
			>('/projects', {
				baseURL: '/api/v1',
				params: { company_id: companyId },
			});
			if (reqId !== projectsRequestId.current) return;
			setProjects(
				Array.isArray(response)
					? response.map((p) => ({
							id: p.id,
							name: p.name,
							company_id: p.company_id,
						}))
					: []
			);
			setProjectsError(null);
			setProjectsCompanyId(companyId);
			setProjectsSettled(true);
		} catch (e) {
			if (reqId !== projectsRequestId.current) return;
			const msg = formatFetchError(e);
			log.warn('useTenancyOptions', `projects: ${msg}`);
			setProjects([]);
			setProjectsError(msg);
			setProjectsCompanyId(companyId);
			setProjectsSettled(true);
		} finally {
			if (reqId === projectsRequestId.current) {
				setLoadingProjects(false);
			}
		}
	}, []);

	useEffect(() => {
		void refreshCompanies();
	}, [refreshCompanies]);

	const isTenancyLoading = loadingCompanies || loadingProjects;

	const hasCompanies = companies.length > 0;
	const hasProjects = projects.length > 0;

	/** Успешно загружено и список пуст — для empty-state в UI. */
	const companiesListEmpty = useMemo(
		() =>
			companiesSettled &&
			!loadingCompanies &&
			companiesError === null &&
			companies.length === 0,
		[companiesSettled, loadingCompanies, companiesError, companies.length]
	);

	/** Компания выбрана, проекты загружены без ошибки и список пуст. */
	const projectsListEmpty = useMemo(
		() =>
			projectsSettled &&
			!loadingProjects &&
			projectsError === null &&
			projectsCompanyId !== null &&
			projects.length === 0,
		[
			projectsSettled,
			loadingProjects,
			projectsError,
			projectsCompanyId,
			projects.length,
		]
	);

	return useMemo(
		() => ({
			companies,
			projects,
			loadingCompanies,
			loadingProjects,
			isTenancyLoading,
			companiesError,
			projectsError,
			companiesSettled,
			projectsSettled,
			projectsCompanyId,
			hasCompanies,
			hasProjects,
			companiesListEmpty,
			projectsListEmpty,
			refreshCompanies,
			refreshProjects,
		}),
		[
			companies,
			projects,
			loadingCompanies,
			loadingProjects,
			isTenancyLoading,
			companiesError,
			projectsError,
			companiesSettled,
			projectsSettled,
			projectsCompanyId,
			hasCompanies,
			hasProjects,
			companiesListEmpty,
			projectsListEmpty,
			refreshCompanies,
			refreshProjects,
		]
	);
}
