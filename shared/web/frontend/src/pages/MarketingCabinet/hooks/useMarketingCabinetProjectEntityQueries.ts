/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TanStack Query hooks for marketing-cabinet project entities (JTBD, SWOT, content, AI rail).
 *
 * Invariants:
 * - Heavy queries are gated by activeView; toolbar content list via `marketingCabinetToolbarContentGating`.
 * - Active AI/IMC rail uses one `live-jobs-summary` query per project (not dual listAiRuns/imc).
 * - Active run polling is disabled on MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS.
 *
 * Related:
 * - MarketingCabinetPage.tsx, marketingCabinetQueryOptions.ts
 */
import { useQuery } from '@tanstack/react-query';

import type { MarketingView } from '../constants';
import { marketingCabinetShouldPollActiveAiRuns } from '../marketingCabinetDashboardGating';
import {
	marketingCabinetAiRunDetailQueryOptions,
	marketingCabinetAiRunDetailPollIntervalMs,
	marketingCabinetCompetitorsQueryOptions,
	marketingCabinetContentQueryOptions,
	marketingCabinetJobStoriesQueryOptions,
	marketingCabinetProjectLiveJobsSummaryQueryOptions,
	marketingCabinetResearchesQueryOptions,
	marketingCabinetResearchTypesQueryOptions,
	marketingCabinetSwotQueryOptions,
	marketingCabinetValuePropsQueryOptions,
} from '../marketingCabinetQueryOptions';
import { marketingCabinetShouldLoadToolbarProjectContent } from '../marketingCabinetToolbarContentGating';
import { marketingCabinetProjectLiveJobsPollIntervalMs } from '../utils/marketingCabinetLiveJobsCounts';

export function useMarketingCabinetProjectEntityQueries({
	activeView,
	selectedProjectId,
	selectedCompanyId,
	projectMatchesCompanyForContent,
	toolbarContentEngaged,
	jobStoryExtractRunId,
	swotGenerateRunId,
	researchRunPollId,
}: {
	activeView: MarketingView;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	projectMatchesCompanyForContent: boolean;
	toolbarContentEngaged: boolean;
	jobStoryExtractRunId: string | null;
	swotGenerateRunId: string | null;
	researchRunPollId: string | null;
}) {
	const hasMarketingProject = Boolean(selectedProjectId);

	const shouldLoadJobStories =
		hasMarketingProject && (activeView === 'jtbd' || activeView === 'value');
	const shouldLoadValueProps = hasMarketingProject && activeView === 'value';
	const shouldLoadSwot = hasMarketingProject && activeView === 'analysis';
	const shouldLoadCompetitors =
		hasMarketingProject && activeView === 'analysis';
	const shouldLoadEvidence = hasMarketingProject && activeView === 'evidence';
	const shouldLoadProjectContent =
		marketingCabinetShouldLoadToolbarProjectContent(
			activeView,
			hasMarketingProject,
			toolbarContentEngaged
		);

	const shouldPollActiveAiRuns = marketingCabinetShouldPollActiveAiRuns(
		selectedProjectId,
		activeView
	);

	const jobStoriesQuery = useQuery({
		...marketingCabinetJobStoriesQueryOptions(selectedProjectId),
		enabled: shouldLoadJobStories,
	});

	const valuePropsQuery = useQuery({
		...marketingCabinetValuePropsQueryOptions(selectedProjectId),
		enabled: shouldLoadValueProps,
	});

	const swotQuery = useQuery({
		...marketingCabinetSwotQueryOptions(selectedProjectId),
		enabled: shouldLoadSwot,
	});

	const competitorsQuery = useQuery({
		...marketingCabinetCompetitorsQueryOptions(selectedProjectId),
		enabled: shouldLoadCompetitors,
	});

	const researchTypesQuery = useQuery({
		...marketingCabinetResearchTypesQueryOptions(),
		enabled: shouldLoadEvidence,
	});

	const researchesQuery = useQuery({
		...marketingCabinetResearchesQueryOptions(selectedProjectId),
		enabled: shouldLoadEvidence,
	});

	const contentQuery = useQuery({
		...marketingCabinetContentQueryOptions(
			selectedProjectId,
			selectedCompanyId
		),
		enabled: shouldLoadProjectContent && projectMatchesCompanyForContent,
	});

	const jobStoryExtractRunQuery = useQuery({
		...marketingCabinetAiRunDetailQueryOptions(jobStoryExtractRunId),
		enabled: Boolean(jobStoryExtractRunId),
		refetchInterval: (query) =>
			marketingCabinetAiRunDetailPollIntervalMs(query.state.data),
	});

	const swotGenerateRunQuery = useQuery({
		...marketingCabinetAiRunDetailQueryOptions(swotGenerateRunId),
		enabled: Boolean(swotGenerateRunId),
		refetchInterval: (query) =>
			marketingCabinetAiRunDetailPollIntervalMs(query.state.data),
	});

	const researchRunDetailQuery = useQuery({
		...marketingCabinetAiRunDetailQueryOptions(researchRunPollId),
		enabled: Boolean(researchRunPollId),
		refetchInterval: (query) =>
			marketingCabinetAiRunDetailPollIntervalMs(query.state.data),
	});

	const projectLiveJobsSummaryQuery = useQuery({
		...marketingCabinetProjectLiveJobsSummaryQueryOptions(selectedProjectId),
		enabled: shouldPollActiveAiRuns,
		refetchInterval: (query) => {
			if (!shouldPollActiveAiRuns) return false;
			return marketingCabinetProjectLiveJobsPollIntervalMs(query.state.data);
		},
	});

	return {
		shouldLoadProjectContent,
		jobStoriesQuery,
		valuePropsQuery,
		swotQuery,
		competitorsQuery,
		researchTypesQuery,
		researchesQuery,
		contentQuery,
		jobStoryExtractRunQuery,
		swotGenerateRunQuery,
		researchRunDetailQuery,
		projectLiveJobsSummaryQuery,
	};
}
