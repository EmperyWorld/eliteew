/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub shell: composes controller hook with header, filters, tab panels, and modals.
 *
 * Invariants:
 * - Result previews use authenticated blob fetch (no short client timeout).
 * - New generations start via SSE `/generate/stream` (not plain POST `/generate`).
 *
 * Related:
 * - components/UGS/hub/*, hooks/ugsHub/*
 */

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUgsHubController } from '../hooks/ugsHub/useUgsHubController';
import { useResponsive } from '../hooks/useResponsive';
import { useDesktopShellTheme } from '../hooks/useDesktopShellTheme';
import { useMinimumPreloaderVisible } from '../hooks/useMinimumPreloaderVisible';
import { useEmbeddedPortaledModalZIndex } from '../pages/Desktop/context/DesktopWindowPortalStackContext';
import type { NavigationHandler } from '../types/navigation';
import { UgsHubFiltersSection } from './UGS/hub/shell/UgsHubFiltersSection';
import { UgsHubLoadingState } from './UGS/hub/shell/UgsHubLoadingState';
import { UgsHubModals } from './UGS/hub/shell/UgsHubModals';
import { UgsHubQuickLaunchSection } from './UGS/hub/shell/UgsHubQuickLaunchSection';
import { UgsHubShellHeader } from './UGS/hub/shell/UgsHubShellHeader';
import { UgsHubStatsSection } from './UGS/hub/shell/UgsHubStatsSection';
import { UgsHubTabBar } from './UGS/hub/shell/UgsHubTabBar';
import { UgsHubTabPanels } from './UGS/hub/shell/UgsHubTabPanels';
import { UgsHubWorkflowsHeaderBar } from './UGS/hub/shell/UgsHubWorkflowsHeaderBar';
import { UgsHubShellThemeProvider } from './UGS/hub/ugsHubShellThemeContext';
import {
	ugsHubRootClasses,
	ugsHubRootGlowClasses,
} from './UGS/hub/ugsHubSharedUi';
import {
	UGS_HUB_GUIDE_AUDIO_LS_KEY,
	UGS_HUB_GUIDE_ROOT_ID,
	UGS_HUB_GUIDE_STEP_DEFS,
	UGS_HUB_GUIDE_TAB_BY_STEP,
	UGS_HUB_GUIDE_TOUR_FOLDER,
} from './UGS/hub/ugsHubGuideConstants';

interface UGSHubProps {
	onNavigate?: NavigationHandler;
}

const UGSHub: React.FC<UGSHubProps> = ({ onNavigate }) => {
	const { t } = useTranslation('ugsHub');
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		UGS_HUB_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const { isMobile } = useResponsive();
	const shellTheme = useDesktopShellTheme();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const hub = useUgsHubController();

	const {
		showUgsAdminLink,
		activeTab,
		setActiveTab,
		searchQuery,
		setSearchQuery,
		statusFilter,
		setStatusFilter,
		categoryFilter,
		setCategoryFilter,
		providerFilter,
		setProviderFilter,
		filtersApplied,
		resetFilters,
		selectedTasks,
		bulkActionMode,
		setBulkActionMode,
		clearSelection,
		currentPage,
		setCurrentPage,
		tariffModalOpen,
		setTariffModalOpen,
		selectedResult,
		resultModalOpen,
		setResultModalOpen,
		loadingResult,
		stats,
		providerHealth,
		tasks,
		hasNextPage,
		isFetchingNextPage,
		coalescedFetchNextPage,
		tasksLoadSentinelRef,
		isLoading,
		isOnline,
		updateIndicator,
		pollIntervalSeconds,
		lastUpdated,
		isBusy,
		handleManualRefresh,
		filterState,
		adminFilterState,
		adminHistoryQuery,
		renderTaskList,
		quickLaunchTypes,
		tariffGroups,
		tabItems,
		completedTasks,
		failedTasks,
		selectedDisplayName,
		generation,
		taskActions,
		toast,
		ugsClient,
	} = hub;
	const showInitialPreloader = useMinimumPreloaderVisible(isLoading);

	const prepareGuideStep = useCallback(
		(stepId: string) => {
			const tab = UGS_HUB_GUIDE_TAB_BY_STEP[stepId];
			if (tab) setActiveTab(tab);
		},
		[setActiveTab]
	);

	if (showInitialPreloader) {
		return (
			<UgsHubShellThemeProvider value={shellTheme}>
				<UgsHubLoadingState />
			</UgsHubShellThemeProvider>
		);
	}

	const onManualRefresh = () => void handleManualRefresh();

	const guideSpotlightLayoutKey = `${activeTab}-${guideOpen}`;

	return (
		<UgsHubShellThemeProvider value={shellTheme}>
			<div
				id={UGS_HUB_GUIDE_ROOT_ID}
				className={ugsHubRootClasses(shellTheme)}
				data-testid="ugs-hub-root"
			>
				<div className={ugsHubRootGlowClasses(shellTheme)} />

				<div className="relative z-10 w-full px-4 py-6 sm:px-6 lg:px-8">
					<div className="relative w-full min-w-0">
						<UgsHubShellHeader
							onNavigate={onNavigate}
							isOnline={isOnline}
							updateIndicator={updateIndicator}
							pollIntervalSeconds={pollIntervalSeconds}
							lastUpdated={lastUpdated}
							isBusy={isBusy}
							onManualRefresh={onManualRefresh}
							providerHealth={providerHealth}
						/>

						{stats ? <UgsHubStatsSection stats={stats} /> : null}

						{activeTab === 'overview' ? (
							<UgsHubQuickLaunchSection
								types={quickLaunchTypes}
								onOpenType={generation.openGenerationModal}
							/>
						) : null}

						<UgsHubTabBar
							activeTab={activeTab}
							onTabChange={setActiveTab}
							tabs={tabItems}
							totalTasks={tasks.length}
							completedCount={completedTasks.length}
							failedCount={failedTasks.length}
						/>

						{activeTab === 'workflows' ? (
							<UgsHubWorkflowsHeaderBar
								showUgsAdminLink={showUgsAdminLink}
								hasNextPage={hasNextPage}
								isFetchingNextPage={isFetchingNextPage}
								isMobile={isMobile}
								onOpenAdmin={() => onNavigate?.('ugs-admin')}
								onLoadMore={() => void coalescedFetchNextPage()}
							/>
						) : null}

						{activeTab !== 'workflows' ? (
							<UgsHubFiltersSection
								searchQuery={searchQuery}
								onSearchChange={setSearchQuery}
								statusFilter={statusFilter}
								onStatusFilterChange={setStatusFilter}
								categoryFilter={categoryFilter}
								onCategoryFilterChange={setCategoryFilter}
								providerFilter={providerFilter}
								onProviderFilterChange={setProviderFilter}
								filtersApplied={filtersApplied}
								onResetFilters={resetFilters}
								filterState={filterState}
								tasksCount={tasks.length}
								selectedCount={selectedTasks.size}
								bulkActionMode={bulkActionMode}
								onToggleBulkMode={() => setBulkActionMode((v) => !v)}
								onClearSelection={clearSelection}
								taskActions={taskActions}
							/>
						) : null}

						<UgsHubTabPanels
							activeTab={activeTab}
							showUgsAdminLink={showUgsAdminLink}
							onNavigate={onNavigate}
							onOpenTariffs={() => setTariffModalOpen(true)}
							onManualRefresh={onManualRefresh}
							currentPage={currentPage}
							onPageChange={setCurrentPage}
							renderTaskList={renderTaskList}
							filterState={filterState}
							adminFilterState={adminFilterState}
							adminHistoryQuery={adminHistoryQuery}
							toast={toast}
							ugsClient={ugsClient}
						/>

						{hasNextPage && activeTab !== 'workflows' ? (
							<div
								ref={tasksLoadSentinelRef}
								data-testid="ugs-hub-tasks-load-sentinel"
								className="mt-6 h-px w-full"
								aria-hidden
							/>
						) : null}
					</div>
				</div>

				<SpotlightGuideModal
					open={guideOpen}
					onClose={() => setGuideOpen(false)}
					rootId={UGS_HUB_GUIDE_ROOT_ID}
					steps={guideSteps}
					audioLocalStorageKey={UGS_HUB_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={UGS_HUB_GUIDE_TOUR_FOLDER}
					labels={guideLabels}
					onPrepareStep={prepareGuideStep}
					spotlightLayoutKey={guideSpotlightLayoutKey}
					dialogTitleId="ugs-hub-guide-title"
				/>

				<UgsHubModals
					generation={generation}
					filterState={filterState}
					selectedResult={selectedResult}
					resultModalOpen={resultModalOpen}
					onCloseResult={() => setResultModalOpen(false)}
					loadingResult={loadingResult}
					selectedDisplayName={selectedDisplayName}
					showUgsAdminLink={showUgsAdminLink}
					embeddedModalZ={embeddedModalZ}
					tariffModalOpen={tariffModalOpen}
					tariffGroups={tariffGroups}
					onCloseTariff={() => setTariffModalOpen(false)}
					taskActions={taskActions}
				/>
			</div>
		</UgsHubShellThemeProvider>
	);
};

export default UGSHub;
