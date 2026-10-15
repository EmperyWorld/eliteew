/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Foundation queries for Marketing Cabinet — companies, projects, team members (infinite).
 *
 * Invariants:
 * - Project members fetch only on `team` view; pages of MARKETING_PROJECT_MEMBERS_FETCH_LIMIT.
 * - Friends list only on `companies` / `team`; `self-profile` only on `amka`.
 * - Projects list skipped on `companies` tab (`marketingCabinetShouldFetchProjectsList`).
 * - Companies list deferred until setup tabs, toolbar engage, or bootstrap without `mc_company`.
 * - When list fetch is off, toolbar label uses `GET /companies/{id}` and `GET /projects/{id}` stubs.
 *
 * Related:
 * - MarketingCabinetPage.tsx, TeamSection.tsx
 * - marketingCabinetFoundationGating.ts, marketingCabinetQueryOptions.ts
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { MarketingView } from '../constants';
import {
	marketingCabinetShouldFetchCompaniesList,
	marketingCabinetShouldFetchFoundationCompanyStub,
	marketingCabinetShouldFetchFoundationProjectStub,
	marketingCabinetShouldFetchProjectsList,
} from '../marketingCabinetFoundationGating';
import {
	marketingCabinetCompaniesQueryOptions,
	marketingCabinetCompanyStubQueryOptions,
	marketingCabinetFoundationProjectsQueryOptions,
	marketingCabinetProjectMembersInfiniteQueryOptions,
	marketingCabinetProjectStubQueryOptions,
	marketingCabinetSelfProfileQueryOptions,
} from '../marketingCabinetQueryOptions';

export function useMarketingCabinetFoundationQueries({
	user,
	activeView,
	selectedCompanyId,
	setSelectedCompanyId,
	selectedProjectId,
	setSelectedProjectId,
	foundationContextEngaged,
}: {
	user: { id?: string | null } | null | undefined;
	activeView: MarketingView;
	foundationContextEngaged: boolean;
	selectedCompanyId: string | null;
	setSelectedCompanyId: (
		v: string | null | ((c: string | null) => string | null)
	) => void;
	selectedProjectId: string | null;
	setSelectedProjectId: (
		v: string | null | ((c: string | null) => string | null)
	) => void;
}) {
	const previousCompanyIdForProjectResetRef = useRef<string | null | undefined>(
		undefined
	);

	const shouldFetchCompanies = marketingCabinetShouldFetchCompaniesList(
		activeView,
		selectedCompanyId,
		foundationContextEngaged
	);

	const companiesQuery = useQuery({
		...marketingCabinetCompaniesQueryOptions(),
		enabled: shouldFetchCompanies,
	});

	const companies = companiesQuery.data ?? [];

	const shouldFetchCompanyStub =
		marketingCabinetShouldFetchFoundationCompanyStub(
			selectedCompanyId,
			shouldFetchCompanies
		);

	const companyStubQuery = useQuery({
		...marketingCabinetCompanyStubQueryOptions(selectedCompanyId),
		enabled: shouldFetchCompanyStub,
	});

	useEffect(() => {
		if (!shouldFetchCompanies) return;
		setSelectedCompanyId((current) => {
			if (!companies.length) return null;
			if (current && companies.some((company) => company.id === current))
				return current;
			return companies[0]?.id ?? null;
		});
	}, [companies, setSelectedCompanyId, shouldFetchCompanies]);

	const shouldFetchProjects = marketingCabinetShouldFetchProjectsList(
		selectedCompanyId,
		activeView
	);

	const projectsQuery = useQuery({
		...marketingCabinetFoundationProjectsQueryOptions(selectedCompanyId),
		enabled: shouldFetchProjects,
	});

	const projects = projectsQuery.data ?? [];

	const shouldFetchProjectStub =
		marketingCabinetShouldFetchFoundationProjectStub(
			selectedProjectId,
			shouldFetchProjects
		);

	const projectStubQuery = useQuery({
		...marketingCabinetProjectStubQueryOptions(selectedProjectId),
		enabled: shouldFetchProjectStub,
	});

	const projectMembersInfiniteQuery = useInfiniteQuery({
		...marketingCabinetProjectMembersInfiniteQueryOptions(selectedProjectId),
		enabled: activeView === 'team' && Boolean(selectedProjectId),
	});

	const selfProfileQuery = useQuery({
		...marketingCabinetSelfProfileQueryOptions(user?.id),
		enabled: Boolean(user?.id) && activeView === 'amka',
	});

	useEffect(() => {
		if (!shouldFetchProjects) return;
		setSelectedProjectId((current) => {
			if (!selectedCompanyId || !projects.length) return null;
			if (current && projects.some((project) => project.id === current))
				return current;
			return projects[0]?.id ?? null;
		});
	}, [projects, selectedCompanyId, setSelectedProjectId, shouldFetchProjects]);

	useEffect(() => {
		if (previousCompanyIdForProjectResetRef.current === undefined) {
			previousCompanyIdForProjectResetRef.current = selectedCompanyId;
			return;
		}
		if (previousCompanyIdForProjectResetRef.current !== selectedCompanyId) {
			setSelectedProjectId(null);
		}
		previousCompanyIdForProjectResetRef.current = selectedCompanyId;
	}, [selectedCompanyId, setSelectedProjectId]);

	return {
		companiesQuery,
		companies,
		companyStubQuery,
		shouldFetchCompanies,
		projectsQuery,
		projects,
		projectStubQuery,
		shouldFetchProjects,
		projectMembersInfiniteQuery,
		selfProfileQuery,
	};
}
