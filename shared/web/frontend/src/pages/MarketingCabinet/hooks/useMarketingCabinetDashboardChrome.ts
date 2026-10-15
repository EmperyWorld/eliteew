import * as React from 'react';
import { useCallback, useMemo } from 'react';

import type { MarketingView } from '../constants';
import {
	buildMarketingCabinetMainColumnScrollKey,
	pushMarketingCabinetSearchFromState,
} from './useMarketingCabinetNavigation';
import type { MarketingRailSignal } from '../marketingCabinetPageTypes';
import type {
	MarketingProjectDashboard,
	MarketingSwot,
} from '../marketingCabinetApi';
import type { MarketingProjectLiveJobsSummaryParsed } from '../marketingCabinetApi/marketingCabinetApiZod';

export function useMarketingCabinetDashboardChrome({
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
}: {
	t: (key: string, options?: Record<string, unknown>) => string;
	activeView: MarketingView;
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
	focusedEntityId: string | null;
	selectedContentId: string | null;
	isSidebarPinned: boolean;
	isSidebarCompactLocked: boolean;
	isSidebarHovered: boolean;
	isSidebarFocusWithin: boolean;
	swotItems: MarketingSwot[];
	projectDashboardQuery: { data: MarketingProjectDashboard | undefined };
	projectLiveJobsSummaryQuery: {
		data?: MarketingProjectLiveJobsSummaryParsed;
	};
	contentScrollRef: React.RefObject<HTMLElement | null>;
	setFocusedEntityId: (id: string | null) => void;
	setActiveView: (view: MarketingView) => void;
}) {
	const latestSwot = useMemo<MarketingSwot | null>(() => {
		const dash = projectDashboardQuery.data;
		if (dash?.latest_swot) {
			// OpenAPI SWOT allows optional title; cabinet UI DTO requires string — normalize at boundary.
			return {
				...dash.latest_swot,
				title: dash.latest_swot.title ?? '',
			} as MarketingSwot;
		}
		return swotItems[0] ?? null;
	}, [projectDashboardQuery.data, swotItems]);

	const activeModuleTitle = t(`modules.${activeView}.title`, {
		defaultValue: t('defaultCabinetName'),
	});
	const isFullDashboardView = activeView === 'overview_dashboard';
	const isSidebarExpanded =
		isSidebarPinned ||
		(!isSidebarCompactLocked && (isSidebarHovered || isSidebarFocusWithin));

	const railSignals = useMemo(() => {
		const dash = projectDashboardQuery.data;
		if (!dash || !selectedProjectId)
			return {} as Partial<Record<MarketingView, MarketingRailSignal>>;

		const issueEntries = [
			...(dash.gaps ?? []),
			...(dash.strategy_integrity_issues ?? []),
		];
		const issueCounts: Partial<Record<MarketingView, number>> = {};
		const issueToneWeights: Partial<Record<MarketingView, number>> = {};
		const severityWeight = (severity: string | null | undefined): number => {
			const normalized = String(severity || '').toLowerCase();
			if (normalized === 'critical' || normalized === 'high') return 2;
			return 1;
		};

		for (const issue of issueEntries) {
			const targetView = issue.target_view;
			if (!targetView) continue;
			const view = targetView as MarketingView;
			issueCounts[view] = (issueCounts[view] ?? 0) + 1;
			issueToneWeights[view] = Math.max(
				issueToneWeights[view] ?? 0,
				severityWeight(issue.severity)
			);
		}

		const nowTs = Date.now();
		const overdueTasksCount = (dash.tasks ?? []).filter((task) => {
			if (!task.due_at) return false;
			const status = String(task.status || '').toLowerCase();
			if (status === 'completed' || status === 'cancelled') return false;
			const dueAtTs = Date.parse(task.due_at);
			return Number.isFinite(dueAtTs) && dueAtTs < nowTs;
		}).length;
		const openAlertsCount = Math.max(
			0,
			Number(dash.counts?.alerts ?? dash.alerts?.length ?? 0)
		);
		const totalOverviewSignals =
			issueEntries.length + overdueTasksCount + openAlertsCount;

		const result: Partial<Record<MarketingView, MarketingRailSignal>> = {};
		if (totalOverviewSignals > 0) {
			result.overview = {
				count: totalOverviewSignals,
				tone:
					overdueTasksCount > 0 || openAlertsCount > 0 ? 'danger' : 'warning',
			};
		}
		if (overdueTasksCount > 0) {
			result.tasks = { count: overdueTasksCount, tone: 'danger' };
		}
		if (openAlertsCount > 0) {
			result.alerts = { count: openAlertsCount, tone: 'danger' };
		}

		(Object.entries(issueCounts) as Array<[MarketingView, number]>).forEach(
			([view, count]) => {
				if (
					count <= 0 ||
					view === 'overview' ||
					view === 'tasks' ||
					view === 'alerts'
				)
					return;
				result[view] = {
					count,
					tone: (issueToneWeights[view] ?? 0) >= 2 ? 'danger' : 'warning',
				};
			}
		);

		const live = projectLiveJobsSummaryQuery.data;
		const activeAiRuns = live?.ai_active_total ?? 0;
		if (activeAiRuns > 0) {
			const prev = result.ai_studio;
			result.ai_studio = {
				count: activeAiRuns + (prev?.count ?? 0),
				tone: prev?.tone === 'danger' ? 'danger' : 'warning',
			};
		}

		const activeImcRuns = live?.imc_active_total ?? 0;
		if (activeImcRuns > 0) {
			const prev = result.imc;
			result.imc = {
				count: activeImcRuns + (prev?.count ?? 0),
				tone: prev?.tone === 'danger' ? 'danger' : 'warning',
			};
		}

		return result;
	}, [
		projectDashboardQuery.data,
		selectedProjectId,
		projectLiveJobsSummaryQuery.data,
	]);

	const getRailSignalText = useCallback(
		(view: MarketingView, signal?: MarketingRailSignal) => {
			if (!signal) return null;
			if (view === 'overview') {
				return t('sidebar.signalOverview', { count: signal.count });
			}
			if (view === 'tasks') {
				return t('sidebar.signalTasks', { count: signal.count });
			}
			if (view === 'alerts') {
				return t('sidebar.signalAlerts', { count: signal.count });
			}
			return t('sidebar.signalModule', { count: signal.count });
		},
		[t]
	);

	const mainColumnScrollStorageKey = useMemo(() => {
		if (typeof window === 'undefined') return null;
		return buildMarketingCabinetMainColumnScrollKey({
			activeView,
			selectedCompanyId,
			selectedProjectId,
			focusedEntityId,
			selectedContentId,
		});
	}, [
		activeView,
		selectedCompanyId,
		selectedProjectId,
		focusedEntityId,
		selectedContentId,
	]);

	const exitOverviewDashboardToCardGrid = useCallback(() => {
		pushMarketingCabinetSearchFromState({
			activeView: 'overview',
			selectedCompanyId,
			selectedProjectId,
			focusedEntityId: null,
			selectedContentId,
		});
		setFocusedEntityId(null);
		setActiveView('overview');
		contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	}, [
		selectedCompanyId,
		selectedProjectId,
		selectedContentId,
		setActiveView,
		setFocusedEntityId,
		contentScrollRef,
	]);

	const enterOverviewInteractiveDashboard = useCallback(() => {
		if (!selectedProjectId) return;
		setFocusedEntityId(null);
		pushMarketingCabinetSearchFromState({
			activeView: 'overview_dashboard',
			selectedCompanyId,
			selectedProjectId,
			focusedEntityId: null,
			selectedContentId,
		});
		setActiveView('overview_dashboard');
		contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	}, [
		selectedCompanyId,
		selectedProjectId,
		selectedContentId,
		setActiveView,
		setFocusedEntityId,
		contentScrollRef,
	]);

	return {
		latestSwot,
		activeModuleTitle,
		isFullDashboardView,
		isSidebarExpanded,
		railSignals,
		getRailSignalText,
		mainColumnScrollStorageKey,
		exitOverviewDashboardToCardGrid,
		enterOverviewInteractiveDashboard,
	};
}
