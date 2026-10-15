/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced search, URL filter ticks, and filtered entity lists for MarketingCabinetPage.
 *
 * Invariants:
 * - Ops deep-link filters read window.location.search; ticks re-run memos on popstate.
 *
 * Related:
 * - operationsDeepLink.ts, useMarketingCabinetPageCompose.ts
 */

import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import {
	MC_OPS_RESEARCH_PRIORITY,
	MC_OPS_RESEARCH_STATUS,
	MC_OPS_RESEARCH_TYPE,
	parseMarketingCabinetOpsListFilters,
} from '@/pages/MarketingCabinet/operationsDeepLink';
import type {
	MarketingCompany,
	MarketingCompetitor,
	MarketingContentItem,
	MarketingJobStory,
	MarketingProject,
	MarketingResearch,
	MarketingValueProposition,
} from '@/pages/MarketingCabinet/marketingCabinetApi';

type FilteredEntitiesInput = {
	t: TFunction<'marketing'>;
	companySearch: string;
	projectSearch: string;
	jobStorySearch: string;
	researchSearch: string;
	competitorSearch: string;
	valuePropSearch: string;
	companiesQueryData: MarketingCompany[] | undefined;
	projectsQueryData: MarketingProject[] | undefined;
	allJobStories: MarketingJobStory[];
	researchesItems: MarketingResearch[] | undefined;
	competitorsItems: MarketingCompetitor[] | undefined;
	valuePropsItems: MarketingValueProposition[] | undefined;
	selectedProjectId: string | null;
	selectedContentId: string | null;
	shouldLoadProjectContent: boolean;
	contentQuery: Pick<UseQueryResult<unknown>, 'isLoading'>;
	contentItems: MarketingContentItem[];
};

export function useMarketingCabinetFilteredEntities(
	input: FilteredEntitiesInput
) {
	const {
		t,
		companySearch,
		projectSearch,
		jobStorySearch,
		researchSearch,
		competitorSearch,
		valuePropSearch,
		companiesQueryData,
		projectsQueryData,
		allJobStories,
		researchesItems,
		competitorsItems,
		valuePropsItems,
		selectedProjectId,
		selectedContentId,
		shouldLoadProjectContent,
		contentQuery,
		contentItems,
	} = input;

	const debouncedJobStorySearch = useDebounce(jobStorySearch, 300);
	const debouncedResearchSearch = useDebounce(researchSearch, 250);
	const [researchUrlTick, setResearchUrlTick] = useState(0);
	const [jtbdVpOpsUrlTick, setJtbdVpOpsUrlTick] = useState(0);

	useLayoutEffect(() => {
		setResearchUrlTick((n) => n + 1);
		setJtbdVpOpsUrlTick((n) => n + 1);
	}, []);
	useEffect(() => {
		const onPop = () => {
			setResearchUrlTick((n) => n + 1);
			setJtbdVpOpsUrlTick((n) => n + 1);
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const debouncedCompetitorSearch = useDebounce(competitorSearch, 250);
	const debouncedValuePropSearch = useDebounce(valuePropSearch, 250);
	const debouncedCompanySearch = useDebounce(companySearch, 250);
	const debouncedProjectSearch = useDebounce(projectSearch, 250);

	const filteredCompanies = useMemo(() => {
		const list = companiesQueryData ?? [];
		const q = debouncedCompanySearch.trim().toLowerCase();
		if (!q) return list;
		return list.filter(
			(c) =>
				c.name?.toLowerCase().includes(q) ||
				c.industry?.toLowerCase().includes(q) ||
				c.website?.toLowerCase().includes(q) ||
				c.description?.toLowerCase().includes(q) ||
				c.slug?.toLowerCase().includes(q)
		);
	}, [companiesQueryData, debouncedCompanySearch]);

	const filteredProjects = useMemo(() => {
		const list = projectsQueryData ?? [];
		const q = debouncedProjectSearch.trim().toLowerCase();
		if (!q) return list;
		return list.filter(
			(p) =>
				p.name?.toLowerCase().includes(q) ||
				p.description?.toLowerCase().includes(q) ||
				p.slug?.toLowerCase().includes(q) ||
				p.tags?.some((tag) => tag.toLowerCase().includes(q))
		);
	}, [projectsQueryData, debouncedProjectSearch]);

	const filteredJobStories = useMemo(() => {
		const q = debouncedJobStorySearch.trim().toLowerCase();
		let list = allJobStories;
		if (q) {
			list = allJobStories.filter((j) => {
				const hay = [
					j.title,
					j.situation,
					j.motivation,
					j.outcome,
					j.statement,
					...(j.tags ?? []),
				]
					.filter(Boolean)
					.join(' ')
					.toLowerCase();
				return hay.includes(q);
			});
		}
		void jtbdVpOpsUrlTick;
		if (typeof window === 'undefined') return list;
		const { jtbd } = parseMarketingCabinetOpsListFilters(
			window.location.search
		);
		let r = list;
		if (jtbd.category) {
			r = r.filter(
				(x) =>
					String(x.category || '').toLowerCase() === jtbd.category.toLowerCase()
			);
		}
		if (jtbd.priority) {
			r = r.filter(
				(x) =>
					String(x.priority || '').toLowerCase() === jtbd.priority.toLowerCase()
			);
		}
		if (jtbd.validated === 'true') {
			r = r.filter((x) => x.is_validated === true);
		} else if (jtbd.validated === 'false') {
			r = r.filter((x) => x.is_validated === false);
		}
		return r;
	}, [allJobStories, debouncedJobStorySearch, jtbdVpOpsUrlTick]);

	const filteredResearches = useMemo(() => {
		let list = researchesItems ?? [];
		const q = debouncedResearchSearch.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(r) =>
					r.title?.toLowerCase().includes(q) ||
					r.research_query?.toLowerCase().includes(q) ||
					r.description?.toLowerCase().includes(q) ||
					r.result_summary?.toLowerCase().includes(q) ||
					r.goals?.some((g) => g.toLowerCase().includes(q))
			);
		}
		void researchUrlTick;
		if (typeof window === 'undefined') return list;
		const p = new URLSearchParams(window.location.search);
		const st = p.get(MC_OPS_RESEARCH_STATUS)?.trim() ?? '';
		const rt = p.get(MC_OPS_RESEARCH_TYPE)?.trim() ?? '';
		const pr = p.get(MC_OPS_RESEARCH_PRIORITY)?.trim() ?? '';
		let r = list;
		if (st) {
			r = r.filter(
				(x) => String(x.status || '').toLowerCase() === st.toLowerCase()
			);
		}
		if (rt) {
			r = r.filter(
				(x) => String(x.research_type || '').toLowerCase() === rt.toLowerCase()
			);
		}
		if (pr) {
			r = r.filter(
				(x) => String(x.priority || '').toLowerCase() === pr.toLowerCase()
			);
		}
		return r;
	}, [researchesItems, debouncedResearchSearch, researchUrlTick]);

	const filteredCompetitors = useMemo(() => {
		const list = competitorsItems ?? [];
		const q = debouncedCompetitorSearch.trim().toLowerCase();
		let next = list;
		if (q) {
			next = list.filter(
				(c) =>
					c.name?.toLowerCase().includes(q) ||
					c.description?.toLowerCase().includes(q) ||
					c.market_position?.toLowerCase().includes(q) ||
					c.pricing_strategy?.toLowerCase().includes(q) ||
					c.strengths?.some((s) => s.toLowerCase().includes(q)) ||
					c.weaknesses?.some((w) => w.toLowerCase().includes(q))
			);
		}
		void jtbdVpOpsUrlTick;
		if (typeof window === 'undefined') return next;
		const ct = parseMarketingCabinetOpsListFilters(window.location.search)
			.competitor.competitor_type;
		if (!ct) return next;
		return next.filter(
			(x) => String(x.competitor_type || '').toLowerCase() === ct.toLowerCase()
		);
	}, [competitorsItems, debouncedCompetitorSearch, jtbdVpOpsUrlTick]);

	const filteredValuePropositions = useMemo(() => {
		const list = valuePropsItems ?? [];
		const q = debouncedValuePropSearch.trim().toLowerCase();
		let next = list;
		if (q) {
			next = list.filter(
				(vp) =>
					vp.headline?.toLowerCase().includes(q) ||
					vp.subheadline?.toLowerCase().includes(q) ||
					vp.value_statement?.toLowerCase().includes(q) ||
					vp.proof_points?.some((p) => String(p).toLowerCase().includes(q)) ||
					vp.target_channels?.some((c) => c.toLowerCase().includes(q))
			);
		}
		void jtbdVpOpsUrlTick;
		if (typeof window === 'undefined') return next;
		const st = parseMarketingCabinetOpsListFilters(window.location.search)
			.valueProp.status;
		if (!st) return next;
		return next.filter(
			(x) => String(x.status || '').toLowerCase() === st.toLowerCase()
		);
	}, [valuePropsItems, debouncedValuePropSearch, jtbdVpOpsUrlTick]);

	const valuePropositions = valuePropsItems ?? [];
	const competitors = competitorsItems ?? [];

	const selectedContent =
		contentItems.find((item) => item.id === selectedContentId) ?? null;

	const contentSelectOptions = useMemo(() => {
		if (!selectedProjectId) {
			return [{ value: '', label: t('toolbar.pickProjectForDocuments') }];
		}
		if (!shouldLoadProjectContent) {
			const deferred: Array<{ value: string; label: string }> = [
				{ value: '', label: t('toolbar.hoverToLoadDocuments') },
			];
			if (selectedContentId) {
				deferred.push({
					value: selectedContentId,
					label: t('toolbar.documentContextActive'),
				});
			}
			return deferred;
		}
		return [
			{
				value: '',
				label: contentQuery.isLoading
					? t('toolbar.loadingDocuments')
					: contentItems.length > 0
						? t('toolbar.noDocument')
						: t('toolbar.noDocuments'),
			},
			...contentItems.map((item) => ({
				value: item.id,
				label: item.name,
			})),
		];
	}, [
		contentItems,
		contentQuery.isLoading,
		selectedContentId,
		selectedProjectId,
		shouldLoadProjectContent,
		t,
	]);

	const selectedContentMeta = selectedContent
		? [
				selectedContent.content_type || 'document',
				selectedContent.processing_status || 'unknown',
			].join(' · ')
		: selectedContentId && !shouldLoadProjectContent
			? t('toolbar.documentContextActive')
			: t('toolbar.contentNotSelected');

	return {
		debouncedJobStorySearch,
		debouncedResearchSearch,
		debouncedCompetitorSearch,
		debouncedValuePropSearch,
		debouncedCompanySearch,
		debouncedProjectSearch,
		researchUrlTick,
		setResearchUrlTick,
		jtbdVpOpsUrlTick,
		setJtbdVpOpsUrlTick,
		filteredCompanies,
		filteredProjects,
		filteredJobStories,
		filteredResearches,
		filteredCompetitors,
		filteredValuePropositions,
		valuePropositions,
		competitors,
		selectedContent,
		contentSelectOptions,
		selectedContentMeta,
	};
}
