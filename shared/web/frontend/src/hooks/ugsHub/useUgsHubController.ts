/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central data/state orchestration for UGS Hub: feeds, filters, task actions, side effects.
 *
 * Invariants:
 * - Task list cache is bound via `useUgsHubTaskCache`; admin history loads lazily on tab open.
 * - Task polling pauses on workflows tab and when document is hidden.
 * - User-visible toasts use `ugsHub.toast.*` via `useTranslation('ugsHub')`.
 *
 * Related:
 * - components/UGSHub.tsx, hooks/ugsHub, i18n/locales en+ru ugsHub.json
 */

import { useNotifications } from '@/notifications';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../contexts/AuthContext';
import { useUgsDashboard, type UGSTask } from '../api/useUgsDashboard';
import { buildUgsHubStuckTaskToastApi } from '../../components/UGS/hub/shell/buildUgsHubStuckTaskToastApi';
import { getUgsHubTaskIcon } from '../../components/UGS/hub/shell/getUgsHubTaskIcon';
import { getContentIdFromResult } from '../../components/UGS/hub/results/ugsHubResultParsing';
import { ugsHubStatusBadgeClasses } from '../../components/UGS/hub/ugsHubTaskListMeta';
import type { UgsHubActiveTab } from '../../components/UGS/hub/types';
import { useUgsHubRenderTaskList } from '../../components/UGS/hub/useUgsHubRenderTaskList';
import { useDesktopShellTheme } from '../useDesktopShellTheme';
import { useUgsHubFilterMetadata } from '../../components/UGS/hub/useUgsHubFilterMetadata';
import { useUgsHubTaskFilters } from '../../components/UGS/hub/useUgsHubTaskFilters';
import { useUgsStuckTaskAlerts } from '../useUgsStuckTaskAlerts';
import { requestOpenDocEditorWithUnifiedContent } from '../../pages/Desktop/utils/desktopDeepLink';
import { playNotificationSoundForSourceThrottled } from '../../pages/Desktop/utils/notificationSound';
import { fetchUgsAdminTasks } from '../../services/api/ugs/dashboard';
import { groupGenerationTypesByProductArea } from '../../utils/ugsGenerationProductArea';
import { getQuickLaunchGenerationTypes } from '../../utils/ugsQuickLaunch';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../utils/ugsHumanizeTypeKey';
import { hasUgsAdminIdentity } from '../../utils/ugsAdminAccess';
import { requestBrowserNotificationPermission } from '../../utils/browserSystemNotification';
import { ugsHubClient } from './ugsHubClient';
import { useUgsHubGeneration } from './useUgsHubGeneration';
import { useUgsHubTabItems } from './useUgsHubTabItems';
import { useUgsHubTaskCache } from './useUgsHubTaskCache';
import { useUgsHubTaskActions } from './useUgsHubTaskActions';
import { useUgsHubTasksFeed } from './useUgsHubTasksFeed';

export function useUgsHubController() {
	const { t } = useTranslation('ugsHub');
	const { user } = useAuth();
	const { toast } = useNotifications();
	const stuckTaskToastApi = useMemo(() => buildUgsHubStuckTaskToastApi(), []);

	const showUgsAdminLink = hasUgsAdminIdentity(user);

	const [activeTab, setActiveTab] = useState<UgsHubActiveTab>('overview');
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [providerFilter, setProviderFilter] = useState('all');

	const [selectedResult, setSelectedResult] = useState<UGSTask | null>(null);
	const [resultModalOpen, setResultModalOpen] = useState(false);
	const [loadingResult, setLoadingResult] = useState(false);

	const [updateIndicator, setUpdateIndicator] = useState(false);
	const previousTasksRef = useRef<UGSTask[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
	const [bulkActionMode, setBulkActionMode] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [tariffModalOpen, setTariffModalOpen] = useState(false);

	const {
		tasks,
		tasksQueryKey,
		pollInterval,
		hasNextPage,
		isFetchingNextPage,
		refetchTasks,
		coalescedFetchNextPage,
		tasksLoadSentinelRef,
		tasksBacklogPrefetchActive,
	} = useUgsHubTasksFeed({
		showUgsAdminLink,
		tasksAutoLoadEnabled: activeTab !== 'workflows',
		backlogPrefetchEnabled: showUgsAdminLink && activeTab !== 'workflows',
		tasksPollingEnabled: activeTab !== 'workflows',
		queueOpsSnapshotEnabled: showUgsAdminLink && activeTab !== 'workflows',
	});

	const taskCache = useUgsHubTaskCache(tasksQueryKey);

	const {
		stats,
		generationTypes,
		providerHealth,
		isLoading: dashboardLoading,
		isFetching: dashboardFetching,
		isError: dashboardError,
		error: dashboardErrorObject,
		refresh: refreshDashboard,
		lastUpdated,
	} = useUgsDashboard({ includeTasks: false });

	const adminHistoryEnabled = showUgsAdminLink && activeTab === 'admin_history';

	const adminHistoryQuery = useQuery({
		queryKey: ['ugs', 'admin', 'tasks', { limit: 200 }] as const,
		queryFn: () => fetchUgsAdminTasks({ limit: 200 }),
		enabled: adminHistoryEnabled,
		staleTime: 15_000,
		refetchInterval: adminHistoryEnabled ? 30_000 : false,
		refetchOnWindowFocus: false,
	});

	const generation = useUgsHubGeneration({ toast, userId: user?.id });

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page on filter/tab change
	useEffect(() => {
		setCurrentPage(1);
	}, [
		debouncedSearchQuery,
		statusFilter,
		categoryFilter,
		providerFilter,
		activeTab,
	]);

	useEffect(() => {
		const previous = previousTasksRef.current;
		if (previous.length > 0) {
			const previousCompleted = new Set(
				previous
					.filter((task) => task.status === 'completed')
					.map((task) => task.id)
			);
			for (const task of tasks) {
				if (task.status === 'completed' && !previousCompleted.has(task.id)) {
					toast.success(
						t('toast.generationCompleted', {
							type: humanizeTypeKey(task.type_key),
						})
					);
				}
			}
		}
		previousTasksRef.current = tasks;
	}, [tasks, toast, t]);

	useEffect(() => {
		if (!lastUpdated) return;
		setUpdateIndicator(true);
		const timeout = setTimeout(() => setUpdateIndicator(false), 900);
		return () => clearTimeout(timeout);
	}, [lastUpdated]);

	useEffect(() => {
		if (!dashboardError || !dashboardErrorObject) return;
		if (isAxiosError(dashboardErrorObject)) {
			const detail =
				(dashboardErrorObject.response?.data as { detail?: string } | undefined)
					?.detail ||
				dashboardErrorObject.message ||
				t('toast.dashboardLoadFailed');
			toast.error(detail);
		} else if (dashboardErrorObject instanceof Error) {
			toast.error(dashboardErrorObject.message);
		} else {
			toast.error(t('toast.dashboardLoadFailed'));
		}
	}, [dashboardError, dashboardErrorObject, toast, t]);

	useEffect(() => {
		void requestBrowserNotificationPermission();
	}, []);

	useEffect(() => {
		if (
			!showUgsAdminLink &&
			(activeTab === 'workflows' || activeTab === 'admin_history')
		) {
			setActiveTab('overview');
		}
	}, [showUgsAdminLink, activeTab]);

	const handleManualRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([
				refetchTasks(),
				refreshDashboard(),
				showUgsAdminLink &&
				(activeTab === 'admin_history' || adminHistoryQuery.isFetched)
					? adminHistoryQuery.refetch()
					: Promise.resolve(),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [
		activeTab,
		adminHistoryQuery,
		refetchTasks,
		refreshDashboard,
		showUgsAdminLink,
	]);

	const filterMetadata = useUgsHubFilterMetadata(
		generationTypes,
		providerHealth
	);

	const filterArgs = {
		generationTypes,
		providerHealth,
		searchQuery: debouncedSearchQuery,
		statusFilter,
		categoryFilter,
		providerFilter,
		humanizeTypeKey,
		metadata: filterMetadata,
	};

	const filterState = useUgsHubTaskFilters({ tasks, ...filterArgs });

	const adminFilterState = useUgsHubTaskFilters({
		tasks: adminHistoryQuery.data ?? [],
		...filterArgs,
	});

	const clearSelection = useCallback(() => {
		setSelectedTasks(new Set());
		setBulkActionMode(false);
	}, []);

	const taskActions = useUgsHubTaskActions({
		toast,
		taskCache,
		ugsClient: ugsHubClient,
		tasks,
		filteredTasks: filterState.filteredTasks,
		selectedTasks,
		setSelectedResult,
		setResultModalOpen,
		setLoadingResult,
		setSelectedTasks,
		clearSelection,
		handleManualRefresh,
		providerByType: filterState.providerByType,
		providerDisplayByType: filterState.providerDisplayByType,
	});

	const estimatedTimeByType = useMemo(() => {
		const map = new Map<string, number>();
		for (const type of generationTypes) {
			if (type.estimated_time != null && type.estimated_time > 0) {
				map.set(type.type_key, type.estimated_time);
			}
		}
		return map;
	}, [generationTypes]);

	useUgsStuckTaskAlerts(
		tasks,
		estimatedTimeByType,
		taskActions.cancelTask,
		stuckTaskToastApi,
		useCallback(() => playNotificationSoundForSourceThrottled('ugs'), []),
		humanizeTypeKey
	);

	const shellTheme = useDesktopShellTheme();

	const getStatusColor = useCallback(
		(status: UGSTask['status']) => ugsHubStatusBadgeClasses(shellTheme, status),
		[shellTheme]
	);

	const renderTaskList = useUgsHubRenderTaskList({
		categoryByType: filterState.categoryByType,
		providerByType: filterState.providerByType,
		providerDisplayByType: filterState.providerDisplayByType,
		displayNameByType: filterState.displayNameByType,
		bulkActionMode,
		selectedTasks,
		showUgsAdminLink,
		onToggleTaskSelection: taskActions.toggleTaskSelection,
		onViewResult: taskActions.viewResult,
		onDownloadResult: taskActions.downloadResult,
		onCancelTask: taskActions.cancelTask,
		onOpenDocEditor: requestOpenDocEditorWithUnifiedContent,
		getContentIdFromResult,
		getTaskIcon: getUgsHubTaskIcon,
		getStatusColor,
	});

	const quickLaunchTypes = useMemo(
		() => getQuickLaunchGenerationTypes(generationTypes, providerHealth, 10),
		[generationTypes, providerHealth]
	);

	const tariffGroups = useMemo(
		() => groupGenerationTypesByProductArea(generationTypes),
		[generationTypes]
	);

	const workflowTypeCount = useMemo(
		() =>
			generationTypes.filter(
				(type) => type.category?.toLowerCase() === 'workflows'
			).length,
		[generationTypes]
	);

	const completedTasks = useMemo(
		() => tasks.filter((task) => task.status === 'completed'),
		[tasks]
	);
	const failedTasks = useMemo(
		() => tasks.filter((task) => task.status === 'failed'),
		[tasks]
	);

	const filtersApplied =
		searchQuery.trim() !== '' ||
		statusFilter !== 'all' ||
		categoryFilter !== 'all' ||
		providerFilter !== 'all';

	const resetFilters = useCallback(() => {
		setSearchQuery('');
		setStatusFilter('all');
		setCategoryFilter('all');
		setProviderFilter('all');
	}, []);

	const isOnline = useMemo(() => {
		if (
			dashboardError &&
			tasks.length === 0 &&
			!stats &&
			providerHealth.length === 0
		) {
			return false;
		}
		return true;
	}, [dashboardError, tasks, stats, providerHealth]);

	const isLoading =
		dashboardLoading &&
		tasks.length === 0 &&
		!stats &&
		providerHealth.length === 0;
	const pollIntervalSeconds = pollInterval ? pollInterval / 1000 : null;
	const isBusy = isRefreshing || dashboardFetching || isFetchingNextPage;

	const tabItems = useUgsHubTabItems({
		showUgsAdminLink,
		filteredTasksCount: filterState.filteredTasks.length,
		filteredActiveCount: filterState.filteredActiveTasks.length,
		filteredHistoryCount: filterState.filteredHistoryTasks.length,
		filteredCompletedCount: filterState.filteredCompletedTasks.length,
		adminHistoryCount: adminFilterState.filteredTasks.length,
		workflowTypeCount,
	});

	const selectedDisplayName = selectedResult
		? filterState.displayNameByType.get(selectedResult.type_key) ||
			humanizeTypeKey(selectedResult.type_key)
		: '';

	return {
		toast,
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
		tasksBacklogPrefetchActive,
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
		ugsClient: ugsHubClient,
	};
}

export type UgsHubController = ReturnType<typeof useUgsHubController>;
