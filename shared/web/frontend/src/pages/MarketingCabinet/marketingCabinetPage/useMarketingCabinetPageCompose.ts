/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composition root for MarketingCabinetPage — wires hooks, queries, handlers into shell/toolbar/router bags.
 *
 * Invariants:
 * - Behavior matches pre-atomization MarketingCabinetPage.tsx; parent consumes returned prop bags only.
 *
 * Related:
 * - MarketingCabinetPageViewRouter.tsx, useMarketingCabinetPageLocalState.ts
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { useFriendsList } from '@/features/friends/hooks/useFriends';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { cabinetNotify } from '@/pages/MarketingCabinet/cabinetNotify';
import { getMarketingSidebarModuleOrder } from '@/pages/MarketingCabinet/constants';
import { useMarketingCabinetChatController } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetChatController';
import { useMarketingCabinetDashboardBundle } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetDashboardBundle';
import { useMarketingCabinetDashboardChrome } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetDashboardChrome';
import { useMarketingCabinetFoundationQueries } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetFoundationQueries';
import { useMarketingCabinetNavigation } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetNavigation';
import { useMarketingCabinetOrganizationMutations } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetOrganizationMutations';
import { useMarketingCabinetOverviewNavigate } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetOverviewNavigate';
import { useMarketingCabinetProjectContentMutations } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetProjectContentMutations';
import { useMarketingCabinetProjectEntityQueries } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetProjectEntityQueries';
import { useMarketingCabinetTeamMutations } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetTeamMutations';
import { createMarketingCabinetSectionHandlers } from '@/pages/MarketingCabinet/marketingCabinetPageSectionHandlers';
import {
	prefetchMarketingCabinetAmkaChunk,
	prefetchMarketingCabinetSelfProfile,
} from '@/pages/MarketingCabinet/marketingCabinetModulePrefetch';
import type { MarketingCabinetPageProps } from '@/pages/MarketingCabinet/marketingCabinetPageTypes';
import { hasMarketingCanvasDraftForProject } from '@/pages/MarketingCabinet/dashboard-widgets/marketingCanvasDraftRegistry';
import { shouldConfirmMarketingCanvasDraftProjectSwitch } from '@/pages/MarketingCabinet/dashboard-widgets/marketingCanvasProjectSwitchGuard';
import {
	extractApiErrorMessage,
	openDesktopApp,
} from '@/pages/MarketingCabinet/utils';

import { useMarketingCabinetAiRunEffects } from './useMarketingCabinetAiRunEffects';
import { useMarketingCabinetFilteredEntities } from './useMarketingCabinetFilteredEntities';
import { useMarketingCabinetFormSelectOptions } from './useMarketingCabinetFormSelectOptions';
import { useMarketingCabinetInvalidation } from './useMarketingCabinetInvalidation';
import { useMarketingCabinetPageLocalState } from './useMarketingCabinetPageLocalState';
import { useMarketingCabinetPageSyncEffects } from './useMarketingCabinetPageSyncEffects';
import { useMarketingCabinetPageTeamDerived } from './useMarketingCabinetPageTeamDerived';
import { buildMarketingCabinetPageBags } from './buildMarketingCabinetPageBags';
import { buildMarketingCabinetViewRouterContext } from './buildMarketingCabinetViewRouterContext';
import { useMarketingCabinetPageUiCallbacks } from './useMarketingCabinetPageUiCallbacks';

export function useMarketingCabinetPageCompose({
	desktopConsumedMarketingDeepLink,
}: MarketingCabinetPageProps) {
	const { t } = useTranslation('marketing');
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const navigation = useMarketingCabinetNavigation(
		desktopConsumedMarketingDeepLink ?? undefined
	);
	const {
		activeView,
		setActiveView,
		selectedCompanyId,
		setSelectedCompanyId,
		selectedProjectId,
		setSelectedProjectId,
		focusedEntityId,
		setFocusedEntityId,
		selectedContentId,
		setSelectedContentId,
		popStateGeneration,
	} = navigation;

	const local = useMarketingCabinetPageLocalState();
	const {
		selectedJobStoryIds,
		setSelectedJobStoryIds,
		openMarketingGuide,
		foundationContextEngaged,
		toolbarContentEngaged,
		engageToolbarContent,
		previousProjectIdRef,
		skipFocusModuleTitleOnMountRef,
		deleteModal,
		setDeleteModal,
		setEditingJobStory,
		jtbdContextMenu,
		setJtbdContextMenu,
		jtbdMenuRef,
		setEditingSwot,
		setEditingCompetitor,
		editingCompany,
		setEditingCompany,
		setCreatingCompany,
		editingProject,
		setEditingProject,
		setCreatingProject,
		setTeamInviteUserId,
		setTeamInviteRole,
		teamAccessMemberId,
		setTeamAccessMemberId,
		setTeamAccessDraft,
		teamAccessOpenMemberIdRef,
		setTeamRemoveConfirm,
		setTeamTransferConfirm,
		setTransferLeadToUserId,
		isSidebarHovered,
		setIsSidebarHovered,
		isSidebarFocusWithin,
		setIsSidebarFocusWithin,
		sidebarNavLayoutMode,
		setSidebarNavLayoutMode,
		isSidebarPinned,
		isSidebarCompactLocked,
		companyForm,
		setCompanyForm,
		projectForm,
		setProjectForm,
		jobStoryForm,
		setJobStoryForm,
		jobStoryExtractText,
		setJobStoryExtractText,
		jobStoryExtractCount,
		jobStoryExtractRunId,
		setJobStoryExtractRunId,
		jobStorySearch,
		setJobStorySearch,
		valuePropForm,
		setValuePropForm,
		swotGenerateContext,
		setSwotGenerateContext,
		swotGenerateRunId,
		setSwotGenerateRunId,
		researchRunPollId,
		setResearchRunPollId,
		researchRunTargetId,
		setResearchRunTargetId,
		swotManualForm,
		setSwotManualForm,
		competitorForm,
		setCompetitorForm,
		researchSearch,
		competitorSearch,
		valuePropSearch,
		companySearch,
		projectSearch,
		researchForm,
		setResearchForm,
		contentScrollRef,
		setShowScrollTop,
	} = local;

	useDesktopGuideTourOpener(openMarketingGuide);

	const prefetchAmkaModule = useCallback(() => {
		void prefetchMarketingCabinetAmkaChunk();
		if (user?.id) {
			prefetchMarketingCabinetSelfProfile(queryClient, user.id);
		}
	}, [queryClient, user?.id]);

	const formOptions = useMarketingCabinetFormSelectOptions(t);

	const needsFriendsList = activeView === 'team' || activeView === 'companies';
	const friendsListQuery = useFriendsList({ enabled: needsFriendsList });

	const foundation = useMarketingCabinetFoundationQueries({
		user,
		activeView,
		foundationContextEngaged,
		selectedCompanyId,
		setSelectedCompanyId,
		selectedProjectId,
		setSelectedProjectId,
	});
	const {
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
	} = foundation;

	const toolbarFoundationCompanies = useMemo(() => {
		if (companies.length > 0) return companies;
		const stub = companyStubQuery.data;
		return stub ? [stub] : [];
	}, [companies, companyStubQuery.data]);

	const toolbarFoundationProjects = useMemo(() => {
		if (projects.length > 0) return projects;
		const stub = projectStubQuery.data;
		return stub ? [stub] : [];
	}, [projects, projectStubQuery.data]);

	const companiesToolbarLoading = shouldFetchCompanies
		? companiesQuery.isLoading
		: companyStubQuery.isLoading;
	const projectsToolbarLoading = shouldFetchProjects
		? projectsQuery.isLoading
		: projectStubQuery.isLoading;

	const chat = useMarketingCabinetChatController({
		activeView,
		selectedProjectId,
		selectedCompanyId,
		projects,
	});

	const selectedCompany = useMemo(
		() => companies.find((company) => company.id === selectedCompanyId) ?? null,
		[companies, selectedCompanyId]
	);
	const selectedProject = useMemo(
		() => projects.find((project) => project.id === selectedProjectId) ?? null,
		[projects, selectedProjectId]
	);

	const projectMatchesCompanyForContent = useMemo(
		() =>
			Boolean(
				selectedProjectId &&
					selectedCompanyId &&
					selectedProject &&
					selectedProject.company_id === selectedCompanyId
			),
		[selectedProjectId, selectedCompanyId, selectedProject]
	);

	const readOnlyMarketing = Boolean(selectedProject?.read_only_marketing);
	const allowMarketingWrite = !readOnlyMarketing;

	const teamDerived = useMarketingCabinetPageTeamDerived({
		t,
		user,
		selectedProject,
		selectedCompany,
		friendsListQuery,
		projectMembersInfiniteQuery,
		selfProfileQuery,
	});

	const projectsPageCompanyOptions = useMemo(
		() => [
			{
				value: '',
				label: t('cabinetPage.projectsPage.selectCompanyPlaceholder'),
			},
			...companies.map((c) => ({ value: c.id, label: c.name })),
		],
		[companies, t]
	);

	const handleOpenContentManagerFromCabinet = useCallback(() => {
		if (!selectedProjectId || !selectedCompanyId || !selectedProject) {
			cabinetNotify.info(t('toolbar.pickProjectForDocuments'));
			openDesktopApp('ContentManagerPro');
			return;
		}
		openDesktopApp('ContentManagerPro', {
			contentManagerProjectId: selectedProjectId,
			contentManagerCompanyId: selectedCompanyId,
			contentManagerProjectName: selectedProject.name,
			contentManagerCabinetView: true,
		});
	}, [selectedProjectId, selectedCompanyId, selectedProject, t]);

	const sidebarModules = useMemo(
		() =>
			getMarketingSidebarModuleOrder(
				selectedProject?.cabinet_modules ?? selectedProject?.enabled_modules
			),
		[selectedProject?.cabinet_modules, selectedProject?.enabled_modules]
	);

	const allowedSidebarViewIds = useMemo(() => {
		const s = new Set(sidebarModules.map((m) => m.id));
		if (s.has('overview')) s.add('overview_dashboard');
		return s;
	}, [sidebarModules]);

	const dashboardBundle = useMarketingCabinetDashboardBundle({
		selectedProjectId,
		activeView,
	});
	const { projectDashboardQuery, prefetchProjectDashboardBundle } =
		dashboardBundle;

	const entityQueries = useMarketingCabinetProjectEntityQueries({
		activeView,
		selectedProjectId,
		selectedCompanyId,
		projectMatchesCompanyForContent,
		toolbarContentEngaged,
		jobStoryExtractRunId,
		swotGenerateRunId,
		researchRunPollId,
	});
	const {
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
	} = entityQueries;

	const allJobStories = jobStoriesQuery.data?.items ?? [];
	const swotItems = swotQuery.data?.items ?? [];
	const researchTypes = researchTypesQuery.data?.items ?? [];
	const contentItems = contentQuery.data?.items ?? [];

	const filtered = useMarketingCabinetFilteredEntities({
		t,
		companySearch,
		projectSearch,
		jobStorySearch,
		researchSearch,
		competitorSearch,
		valuePropSearch,
		companiesQueryData: companiesQuery.data,
		projectsQueryData: projectsQuery.data,
		allJobStories,
		researchesItems: researchesQuery.data?.items,
		competitorsItems: competitorsQuery.data?.items,
		valuePropsItems: valuePropsQuery.data?.items,
		selectedProjectId,
		selectedContentId,
		shouldLoadProjectContent,
		contentQuery,
		contentItems,
	});

	const {
		filteredValuePropositions,
		filteredResearches,
		filteredCompetitors,
		selectedContent,
		contentSelectOptions,
		selectedContentMeta,
	} = filtered;

	const invalidation = useMarketingCabinetInvalidation({
		t,
		selectedProjectId,
		engageToolbarContent,
		refetchProjectContent: contentQuery.refetch,
	});
	const {
		invalidateMarketingData,
		invalidateCurrentProjectMarketing,
		handleToolbarRefreshCabinet,
		handleToolbarRefreshContent,
	} = invalidation;

	useMarketingCabinetAiRunEffects({
		t,
		invalidateCurrentProjectMarketing,
		jobStoryExtractRunId,
		setJobStoryExtractRunId,
		setJobStorySearch,
		setJobStoryExtractText,
		jobStoryExtractRunQuery,
		swotGenerateRunId,
		setSwotGenerateRunId,
		setSwotGenerateContext,
		swotGenerateRunQuery,
		researchRunPollId,
		setResearchRunPollId,
		researchRunTargetId,
		setResearchRunTargetId,
		researchRunDetailQuery,
		focusedEntityId,
		researchesItems: researchesQuery.data?.items,
	});

	useMarketingCabinetPageSyncEffects({
		t,
		activeView,
		selectedProjectId,
		previousProjectIdRef,
		setFocusedEntityId,
		setSelectedContentId,
		setSelectedJobStoryIds,
		setTeamInviteUserId,
		setTeamInviteRole,
		setTeamAccessMemberId,
		setTeamAccessDraft,
		setTeamRemoveConfirm,
		setTeamTransferConfirm,
		setTransferLeadToUserId,
		teamAccessOpenMemberIdRef,
		teamAccessMemberId,
		sidebarNavLayoutMode,
		setIsSidebarHovered,
		setIsSidebarFocusWithin,
		sidebarModules,
		setActiveView,
		contentItems,
		contentQueryIsLoading: contentQuery.isLoading,
		selectedContentId,
		shouldLoadProjectContent,
		setCreatingCompany,
		setEditingCompany,
		setCreatingProject,
		setEditingProject,
		contentScrollRef,
		setShowScrollTop,
		skipFocusModuleTitleOnMountRef,
		editingCompany,
		setCompanyForm,
		editingProject,
		setProjectForm,
		setEditingProjectState: setEditingProject,
	});

	const requestSetSelectedProjectId = useCallback(
		(nextId: string | null) => {
			const hasDraft =
				selectedProjectId !== null &&
				hasMarketingCanvasDraftForProject(selectedProjectId);
			if (
				shouldConfirmMarketingCanvasDraftProjectSwitch({
					activeView,
					currentProjectId: selectedProjectId,
					nextProjectId: nextId,
					hasDraftForCurrentProject: hasDraft,
				})
			) {
				if (!window.confirm(t('cabinetPage.canvasDraftProjectSwitchWarning'))) {
					return;
				}
			}
			setSelectedProjectId(nextId);
		},
		[activeView, selectedProjectId, setSelectedProjectId, t]
	);

	const { handleOverviewNavigate } = useMarketingCabinetOverviewNavigate({
		allowedSidebarViewIds,
		setActiveView,
		setFocusedEntityId,
		contentScrollRef,
		activeView,
		focusedEntityId,
	});

	const raiseErrorNotice = useCallback((error: unknown, fallback: string) => {
		cabinetNotify.error(extractApiErrorMessage(error, fallback));
	}, []);

	const orgMutations = useMarketingCabinetOrganizationMutations({
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
	});

	const teamMutations = useMarketingCabinetTeamMutations({
		t,
		queryClient,
		invalidateMarketingData,
		raiseErrorNotice,
		teamAccessOpenMemberIdRef,
		setTeamAccessDraft,
		setTeamAccessMemberId,
		setTeamInviteUserId,
		setTransferLeadToUserId,
	});

	const contentMutations = useMarketingCabinetProjectContentMutations({
		t,
		queryClient,
		selectedProjectId,
		invalidateCurrentProjectMarketing,
		raiseErrorNotice,
		setJobStorySearch,
		setJobStoryForm,
		setSelectedJobStoryIds,
		setJobStoryExtractRunId,
		jobStoryExtractText,
		jobStoryExtractCount,
		setEditingJobStory,
		setValuePropForm,
		setSwotManualForm,
		setSwotGenerateRunId,
		swotGenerateContext,
		setEditingSwot,
		setCompetitorForm,
		setEditingCompetitor,
		setResearchForm,
		setResearchRunTargetId,
		setResearchRunPollId,
	});

	const sectionHandlers = createMarketingCabinetSectionHandlers({
		t,
		companyForm,
		editingCompany,
		projectForm,
		editingProject,
		selectedCompanyId,
		selectedProjectId,
		selectedProject,
		selectedCompany,
		jobStoryForm,
		jobStoryExtractText,
		valuePropForm,
		selectedJobStoryIds,
		swotManualForm,
		competitorForm,
		researchForm,
		allJobStories,
		filteredValuePropositions,
		swotItems,
		filteredResearches,
		filteredCompetitors,
		csvJtbdHeaderRow: formOptions.csvJtbdHeaderRow,
		csvSwotHeaderRow: formOptions.csvSwotHeaderRow,
		csvResearchHeaderRow: formOptions.csvResearchHeaderRow,
		csvValuePropHeaderRow: formOptions.csvValuePropHeaderRow,
		csvCompetitorHeaderRow: formOptions.csvCompetitorHeaderRow,
		canExportResearches: teamDerived.canExportResearches,
		deleteModal,
		setDeleteModal,
		...orgMutations,
		...contentMutations,
	});

	const {
		jtbdMenuPosition,
		isDeletePending,
		closeEditJobStory,
		closeEditSwot,
		closeEditCompetitor,
		closeDeleteModal,
		cycleSidebarNavLayout,
		handleSidebarBlurCapture,
	} = useMarketingCabinetPageUiCallbacks({
		jtbdContextMenu,
		setJtbdContextMenu,
		jtbdMenuRef,
		orgMutations,
		contentMutations,
		setEditingJobStory,
		setEditingSwot,
		setEditingCompetitor,
		setDeleteModal,
		setSidebarNavLayoutMode,
		setIsSidebarHovered,
		setIsSidebarFocusWithin,
	});

	const contentSourceValue = useMemo(
		() => ({
			selectedProjectId,
			selectedCompanyId,
			selectedContentId,
			setSelectedContentId,
			contentItems,
			selectedContent,
			contentQuery,
			engageToolbarContent,
		}),
		[
			contentItems,
			contentQuery,
			engageToolbarContent,
			selectedCompanyId,
			selectedContent,
			selectedContentId,
			selectedProjectId,
			setSelectedContentId,
		]
	);

	const dashboardChrome = useMarketingCabinetDashboardChrome({
		t,
		activeView,
		selectedCompanyId,
		selectedProjectId,
		focusedEntityId,
		selectedContentId,
		isSidebarPinned,
		isSidebarCompactLocked,
		isSidebarHovered,
		isSidebarFocusWithin,
		swotItems,
		projectDashboardQuery,
		projectLiveJobsSummaryQuery,
		contentScrollRef,
		setFocusedEntityId,
		setActiveView,
	});

	const {
		latestSwot,
		activeModuleTitle,
		isFullDashboardView,
		isSidebarExpanded,
		railSignals,
		getRailSignalText,
		mainColumnScrollStorageKey,
		exitOverviewDashboardToCardGrid,
		enterOverviewInteractiveDashboard,
	} = dashboardChrome;

	const viewRouter = buildMarketingCabinetViewRouterContext({
		t,
		formOptions,
		orgMutations,
		teamMutations,
		contentMutations,
		sectionHandlers,
		chat,
		selfProfileQuery,
		friendsListQuery,
		projectMembersInfiniteQuery,
		user,
		activeView,
		setActiveView,
		selectedProjectId,
		selectedProject,
		selectedCompanyId,
		selectedCompany,
		focusedEntityId,
		setFocusedEntityId,
		allowMarketingWrite,
		readOnlyMarketing,
		projectDashboardQuery,
		latestSwot,
		handleOverviewNavigate,
		exitOverviewDashboardToCardGrid,
		companiesQuery,
		companies,
		setSelectedCompanyId,
		projectsQuery,
		projects,
		projectsPageCompanyOptions,
		requestSetSelectedProjectId,
		handleOpenContentManagerFromCabinet,
		allJobStories,
		swotItems,
		researchTypes,
		contentItems,
		jobStoriesQuery,
		valuePropsQuery,
		swotQuery,
		competitorsQuery,
		researchesQuery,
		contentQuery,
		jobStoryExtractRunQuery,
		swotGenerateRunQuery,
		researchRunDetailQuery,
		...teamDerived,
		...filtered,
		...local,
	});

	const bags = buildMarketingCabinetPageBags({
		t,
		isFullDashboardView,
		isSidebarExpanded,
		activeView,
		activeModuleTitle,
		sidebarModules,
		railSignals,
		cycleSidebarNavLayout,
		setFocusedEntityId,
		setActiveView,
		prefetchProjectDashboardBundle,
		prefetchAmkaModule,
		handleSidebarBlurCapture,
		getRailSignalText,
		readOnlyMarketing,
		focusedEntityId,
		mainColumnScrollStorageKey,
		popStateGeneration,
		companiesQuery,
		selectedProjectId,
		selectedCompanyId,
		setSelectedCompanyId,
		companiesToolbarLoading,
		shouldFetchCompanies,
		toolbarFoundationCompanies,
		companyStubQuery,
		requestSetSelectedProjectId,
		projectsToolbarLoading,
		toolbarFoundationProjects,
		setSelectedContentId,
		selectedContentId,
		contentSelectOptions,
		contentQuery,
		selectedContentMeta,
		handleToolbarRefreshContent,
		handleOpenContentManagerFromCabinet,
		handleOverviewNavigate,
		handleToolbarRefreshCabinet,
		allowMarketingWrite,
		exitOverviewDashboardToCardGrid,
		enterOverviewInteractiveDashboard,
		jtbdMenuPosition,
		sectionHandlers,
		contentMutations,
		teamMutations,
		isDeletePending,
		closeEditJobStory,
		closeEditSwot,
		closeEditCompetitor,
		closeDeleteModal,
		...local,
	});

	return {
		t,
		contentSourceValue,
		shell: bags.shell,
		toolbar: bags.toolbar,
		viewRouter,
		overlays: bags.overlays,
	};
}
