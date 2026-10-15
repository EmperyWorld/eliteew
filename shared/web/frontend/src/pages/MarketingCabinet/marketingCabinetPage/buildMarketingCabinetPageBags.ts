/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Builds shell, toolbar, and overlay prop bags for MarketingCabinetPage compose return.
 *
 * Invariants:
 * - Prop shapes match pre-atomization MarketingCabinetPage shell/toolbar/modals.
 * - Deps are a named interface (not Record<string, unknown>) — frontend-ts-hygiene Cause A.
 *
 * Related:
 * - useMarketingCabinetPageCompose.ts
 * - .cursor/rules/frontend-ts-hygiene.mdc
 */

import type { TFunction } from 'i18next';
import type { MutableRefObject, RefObject } from 'react';
import { cabinetNotify } from '@/pages/MarketingCabinet/cabinetNotify';
import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import type {
	MarketingCompany,
	MarketingCompetitor,
	MarketingJobStory,
	MarketingProject,
	MarketingSwot,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { MarketingRailSignal } from '@/pages/MarketingCabinet/marketingCabinetPageTypes';
import {
	copyToClipboard,
	extractApiErrorMessage,
} from '@/pages/MarketingCabinet/utils';
import type { MarketingCabinetDeleteModalState } from '@/pages/MarketingCabinet/modals/MarketingCabinetGlobalModals';
import type {
	MarketingCabinetSidebarModule,
	MarketingCabinetSidebarNavLayoutMode,
} from '@/pages/MarketingCabinet/shell/MarketingCabinetSidebar';

import type { MutationLike, QueryLike } from './marketingCabinetComposeHosts';

type MutateLike = MutationLike;

/** Composition-boundary callbacks — bivariant like React.EventHandler */
type LooseFn = {
	// biome-ignore lint/suspicious/noExplicitAny: bag/compose seam — bivariant callback host
	bivarianceHack(...args: any[]): any;
}['bivarianceHack'];

function callMutate(
	host: MutateLike,
	variables?: unknown,
	options?: unknown
): void {
	const fn = host.mutate;
	if (typeof fn === 'function') {
		(fn as (vars?: unknown, opts?: unknown) => unknown)(variables, options);
	}
}

export type MarketingCabinetPageBagDeps = {
	t: TFunction<'marketing'>;
	isFullDashboardView: boolean;
	isSidebarExpanded: boolean;
	sidebarNavLayoutMode: MarketingCabinetSidebarNavLayoutMode;
	activeView: MarketingView;
	activeModuleTitle: string;
	sidebarModules: MarketingCabinetSidebarModule[];
	railSignals: Partial<Record<MarketingView, MarketingRailSignal>>;
	cycleSidebarNavLayout: () => void;
	setFocusedEntityId: (id: string | null) => void;
	setActiveView: LooseFn;
	prefetchProjectDashboardBundle: () => void;
	prefetchAmkaModule: () => void;
	setIsSidebarHovered: (v: boolean) => void;
	setIsSidebarFocusWithin: (v: boolean) => void;
	handleSidebarBlurCapture: LooseFn;
	getRailSignalText: LooseFn;
	contentScrollRef: RefObject<HTMLElement | null>;
	readOnlyMarketing: boolean;
	focusedEntityId: string | null;
	mainColumnScrollStorageKey: string | null;
	popStateGeneration: number;
	companiesQuery: QueryLike;
	showScrollTop: boolean;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	setSelectedCompanyId: (id: string | null) => void;
	companiesToolbarLoading: boolean;
	shouldFetchCompanies: boolean;
	toolbarFoundationCompanies: MarketingCompany[];
	companyStubQuery: QueryLike;
	requestSetSelectedProjectId: (id: string | null) => void;
	projectsToolbarLoading: boolean;
	toolbarFoundationProjects: MarketingProject[];
	setSelectedContentId: (id: string | null) => void;
	selectedContentId: string | null;
	contentSelectOptions: Array<{
		value: string;
		label: string | null | undefined;
	}>;
	contentQuery: QueryLike;
	selectedContentMeta: string;
	handleToolbarRefreshContent: () => void | Promise<void>;
	handleOpenContentManagerFromCabinet: () => void;
	handleOverviewNavigate: LooseFn;
	handleToolbarRefreshCabinet: () => void | Promise<void>;
	allowMarketingWrite: boolean;
	exitOverviewDashboardToCardGrid: () => void;
	enterOverviewInteractiveDashboard: () => void;
	engageFoundationContext: () => void;
	engageToolbarContent: () => void;
	marketingGuideOpen: boolean;
	setMarketingGuideOpen: (open: boolean) => void;
	jtbdMenuRef:
		| MutableRefObject<HTMLDivElement | null>
		| RefObject<HTMLDivElement | null>;
	jtbdContextMenu: { job: MarketingJobStory } | null;
	jtbdMenuPosition: { x: number; y: number } | null;
	editingJobStory: MarketingJobStory | null;
	setEditingJobStory: (job: MarketingJobStory | null) => void;
	sectionHandlers: {
		handleCopySingleJob: (job: MarketingJobStory) => void;
		handleConfirmDelete: () => void;
	};
	setDeleteModal: LooseFn;
	setJtbdContextMenu: (v: null) => void;
	contentMutations: {
		updateJobStoryMutation: MutateLike;
		updateSwotMutation: MutateLike;
		updateCompetitorMutation: MutateLike;
	};
	closeEditJobStory: () => void;
	editingSwot: MarketingSwot | null;
	closeEditSwot: () => void;
	editingCompetitor: MarketingCompetitor | null;
	closeEditCompetitor: () => void;
	deleteModal: MarketingCabinetDeleteModalState;
	closeDeleteModal: () => void;
	isDeletePending: boolean;
	teamRemoveConfirm: { memberId: string; displayName: string } | null;
	teamMutations: {
		removeProjectMemberMutation: MutateLike;
		transferProjectLeadMutation: MutateLike;
	};
	setTeamRemoveConfirm: (v: null) => void;
	teamTransferConfirm: { newLeadUserId: string; displayName: string } | null;
	setTeamTransferConfirm: (v: null) => void;
};

export function buildMarketingCabinetPageBags(
	deps: MarketingCabinetPageBagDeps
) {
	const {
		t,
		isFullDashboardView,
		isSidebarExpanded,
		sidebarNavLayoutMode,
		activeView,
		activeModuleTitle,
		sidebarModules,
		railSignals,
		cycleSidebarNavLayout,
		setFocusedEntityId,
		setActiveView,
		prefetchProjectDashboardBundle,
		prefetchAmkaModule,
		setIsSidebarHovered,
		setIsSidebarFocusWithin,
		handleSidebarBlurCapture,
		getRailSignalText,
		contentScrollRef,
		readOnlyMarketing,
		focusedEntityId,
		mainColumnScrollStorageKey,
		popStateGeneration,
		companiesQuery,
		showScrollTop,
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
		engageFoundationContext,
		engageToolbarContent,
		marketingGuideOpen,
		setMarketingGuideOpen,
		jtbdMenuRef,
		jtbdContextMenu,
		jtbdMenuPosition,
		editingJobStory,
		setEditingJobStory,
		sectionHandlers,
		setDeleteModal,
		setJtbdContextMenu,
		contentMutations,
		closeEditJobStory,
		editingSwot,
		closeEditSwot,
		editingCompetitor,
		closeEditCompetitor,
		deleteModal,
		closeDeleteModal,
		isDeletePending,
		teamRemoveConfirm,
		teamMutations,
		setTeamRemoveConfirm,
		teamTransferConfirm,
		setTeamTransferConfirm,
	} = deps;

	return {
		shell: {
			isFullDashboardView,
			sidebar: {
				isSidebarExpanded,
				sidebarNavLayoutMode,
				activeView,
				activeModuleTitle,
				sidebarModules,
				railSignals,
				onCycleSidebarNavLayout: cycleSidebarNavLayout,
				onSelectModule: (id: string) => {
					setFocusedEntityId(null);
					setActiveView(id);
				},
				onPrefetchInteractiveDashboard: prefetchProjectDashboardBundle,
				onPrefetchAmkaModule: prefetchAmkaModule,
				onNavMouseEnter: () => setIsSidebarHovered(true),
				onNavMouseLeave: () => setIsSidebarHovered(false),
				onNavFocusCapture: () => setIsSidebarFocusWithin(true),
				onNavBlurCapture: handleSidebarBlurCapture,
				getRailSignalText: (...args: unknown[]) =>
					getRailSignalText(...args) ?? '',
			},
			contentFrame: {
				contentScrollRef,
				activeModuleTitle,
				readOnlyMarketing,
				focusedEntityId,
				dashboardToolbarHeaderSlotEnabled: isFullDashboardView,
				omitLeadingInset: isFullDashboardView,
				mainColumnScrollStorageKey: mainColumnScrollStorageKey ?? '',
				mainColumnScrollPopStateGeneration: popStateGeneration,
				companiesLoadError: companiesQuery.isError
					? {
							message: extractApiErrorMessage(
								companiesQuery.error,
								t('cabinetPage.companiesLoadErrorDefault')
							),
							onRetry: () => void companiesQuery.refetch(),
						}
					: null,
				showScrollTop,
			},
		},
		toolbar: {
			activeView,
			activeModuleTitle,
			selectedProjectId,
			selectedCompanyId,
			onCompanyChange: setSelectedCompanyId,
			companySelectOptions: [
				{
					value: '',
					label: companiesToolbarLoading
						? t('toolbar.loadingCompanies')
						: shouldFetchCompanies && companiesQuery.isError
							? t('toolbar.companiesUnavailable')
							: t('toolbar.pickCompany'),
				},
				...toolbarFoundationCompanies.map((company: MarketingCompany) => ({
					value: company.id,
					label: company.name,
				})),
			],
			companiesLoading: companiesToolbarLoading,
			companiesLoadFailed: shouldFetchCompanies
				? companiesQuery.isError
				: companyStubQuery.isError,
			onProjectChange: requestSetSelectedProjectId,
			projectSelectOptions: [
				{
					value: '',
					label: projectsToolbarLoading
						? t('toolbar.loadingProjects')
						: t('toolbar.pickProject'),
				},
				...toolbarFoundationProjects.map((project: MarketingProject) => ({
					value: project.id,
					label: project.name,
				})),
			],
			projectsLoading: projectsToolbarLoading,
			projectsEmpty:
				Boolean(selectedCompanyId) &&
				!projectsToolbarLoading &&
				toolbarFoundationProjects.length === 0,
			onContentChange: setSelectedContentId,
			selectedContentId,
			contentSelectOptions: contentSelectOptions.map((opt) => ({
				value: opt.value,
				label: opt.label ?? '',
			})),
			contentLoading: contentQuery.isLoading,
			contentEnabled: Boolean(selectedProjectId),
			selectedContentMeta,
			onRefreshContent: () => void handleToolbarRefreshContent(),
			onOpenContentManager: handleOpenContentManagerFromCabinet,
			onJobCenterNavigate: (...args: unknown[]) =>
				void handleOverviewNavigate(...args),
			canCopyContextId: Boolean(selectedProjectId || selectedCompanyId),
			onCopyContextId: async () => {
				const id = selectedProjectId || selectedCompanyId || '';
				const ok = await copyToClipboard(id);
				if (ok) cabinetNotify.success(t('toolbar.idCopied'));
				else cabinetNotify.error(t('toolbar.idCopyFailed'));
			},
			onCopyPageLink: async () => {
				const url = window.location.href;
				const ok = await copyToClipboard(url);
				if (ok) cabinetNotify.success(t('toolbar.linkCopied'));
				else cabinetNotify.error(t('toolbar.idCopyFailed'));
			},
			onRefreshCabinet: () => void handleToolbarRefreshCabinet(),
			allowMarketingWrite,
			dashboardPrimaryAction: isFullDashboardView
				? {
						label: t('toolbar.dashboardBack'),
						ariaLabel: t('toolbar.backToOverviewAria'),
						onClick: exitOverviewDashboardToCardGrid,
					}
				: null,
			openInteractiveDashboardAction:
				activeView === 'overview' &&
				selectedProjectId &&
				sidebarModules.some((m) => m.id === 'overview_dashboard')
					? {
							label: t('overview.openDashboard'),
							ariaLabel: t('overview.openDashboardAria'),
							onClick: enterOverviewInteractiveDashboard,
							onPrefetch: prefetchProjectDashboardBundle,
						}
					: null,
			onFoundationContextEngage: engageFoundationContext,
			onToolbarContentEngage: engageToolbarContent,
		},
		overlays: {
			guide: {
				open: marketingGuideOpen,
				onClose: () => setMarketingGuideOpen(false),
				activeView,
				isSidebarVisible: !isFullDashboardView,
			},
			jtbdMenu: {
				menuRef: jtbdMenuRef as MutableRefObject<HTMLDivElement | null>,
				contextMenu: jtbdContextMenu ? { job: jtbdContextMenu.job } : null,
				menuPosition: jtbdMenuPosition,
				allowMarketingWrite,
				onEditJob: (job: MarketingJobStory) => setEditingJobStory(job),
				onCopyJob: sectionHandlers.handleCopySingleJob,
				onRequestDeleteJob: (job: { id: string; title: string }) => {
					setDeleteModal({ type: 'job', id: job.id, name: job.title });
				},
				onCloseMenu: () => setJtbdContextMenu(null),
			},
			globalModals: {
				editingJobStory,
				onSaveJobStory: (payload: unknown) => {
					if (editingJobStory) {
						callMutate(contentMutations.updateJobStoryMutation, {
							storyId: editingJobStory.id,
							payload,
						});
					}
				},
				onCancelJobStory: closeEditJobStory,
				isJobStorySavePending:
					contentMutations.updateJobStoryMutation.isPending,
				editingSwot,
				onSaveSwot: (payload: unknown) => {
					if (editingSwot) {
						callMutate(contentMutations.updateSwotMutation, {
							analysisId: editingSwot.id,
							payload,
						});
					}
				},
				onCancelSwot: closeEditSwot,
				isSwotSavePending: contentMutations.updateSwotMutation.isPending,
				editingCompetitor,
				onSaveCompetitor: (payload: unknown) => {
					if (editingCompetitor) {
						callMutate(contentMutations.updateCompetitorMutation, {
							competitorId: editingCompetitor.id,
							payload,
						});
					}
				},
				onCancelCompetitor: closeEditCompetitor,
				isCompetitorSavePending:
					contentMutations.updateCompetitorMutation.isPending,
				deleteModal,
				onConfirmDelete: sectionHandlers.handleConfirmDelete,
				onCancelDelete: closeDeleteModal,
				isDeletePending,
				teamRemoveConfirm,
				onConfirmTeamRemove: () => {
					if (!teamRemoveConfirm || !selectedProjectId) return;
					callMutate(
						teamMutations.removeProjectMemberMutation,
						{
							projectId: selectedProjectId,
							memberId: teamRemoveConfirm.memberId,
						},
						{ onSettled: () => setTeamRemoveConfirm(null) }
					);
				},
				onCancelTeamRemove: () => setTeamRemoveConfirm(null),
				isTeamRemovePending:
					teamMutations.removeProjectMemberMutation.isPending,
				teamTransferConfirm,
				onConfirmTeamTransfer: () => {
					if (!teamTransferConfirm || !selectedProjectId) return;
					callMutate(
						teamMutations.transferProjectLeadMutation,
						{
							projectId: selectedProjectId,
							newLeadUserId: teamTransferConfirm.newLeadUserId,
						},
						{ onSettled: () => setTeamTransferConfirm(null) }
					);
				},
				onCancelTeamTransfer: () => setTeamTransferConfirm(null),
				isTeamTransferPending:
					teamMutations.transferProjectLeadMutation.isPending,
			},
		},
	};
}
