import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { MARKETING_DASHBOARD_LAYOUT_QUERY_VIEWS } from '../constants';
import type { MarketingView } from '../constants';
import { marketingCabinetShouldLoadProjectDashboard } from '../marketingCabinetDashboardGating';
import {
	marketingCabinetDashboardLayoutQueryOptions,
	marketingCabinetProjectDashboardQueryOptions,
} from '../marketingCabinetQueryOptions';

/**
 * Активный макет + агрегат дашборда проекта (K.107 prefetch использует те же query keys, что {@link projectDashboardQuery}).
 * На «Быстрой сводке» и прочих разделах — компактный бандл без тяжёлых списков и без `widget_list_slices`;
 * на экране интерактивного дашборда — полный бандл с `layout_id` и большими списками для плиток.
 */
export function useMarketingCabinetDashboardBundle({
	selectedProjectId,
	activeView,
}: {
	selectedProjectId: string | null;
	activeView: MarketingView;
}) {
	const queryClient = useQueryClient();
	const hasMarketingProject = Boolean(selectedProjectId);
	const shouldLoadDashboard = marketingCabinetShouldLoadProjectDashboard(
		selectedProjectId,
		activeView
	);

	const onInteractiveDashboard = activeView === 'overview_dashboard';
	const needsActiveLayoutQuery =
		hasMarketingProject &&
		(MARKETING_DASHBOARD_LAYOUT_QUERY_VIEWS as readonly string[]).includes(
			activeView
		);

	const activeLayoutForSeriesQuery = useQuery({
		...marketingCabinetDashboardLayoutQueryOptions(selectedProjectId),
		enabled: needsActiveLayoutQuery,
	});

	const dashboardIncludeSeries = useMemo(() => {
		const layout = activeLayoutForSeriesQuery.data;
		if (!layout?.widgets?.length) {
			return false;
		}
		return layout.widgets.some(
			(w) =>
				w.widget_key === 'chart_metric' || w.widget_key === 'chart_metrics_bar'
		);
	}, [activeLayoutForSeriesQuery.data]);

	const dashboardSeriesWindowDays = useMemo(() => {
		const layout = activeLayoutForSeriesQuery.data;
		if (!layout?.widgets?.length) {
			return 30;
		}
		let maxDays = 30;
		for (const w of layout.widgets) {
			if (
				w.widget_key !== 'chart_metric' &&
				w.widget_key !== 'chart_metrics_bar'
			) {
				continue;
			}
			const raw = (w.widget_config as { windowDays?: unknown } | null)
				?.windowDays;
			const n = typeof raw === 'number' ? Math.trunc(raw) : Number.NaN;
			if (Number.isFinite(n)) {
				maxDays = Math.max(maxDays, Math.min(90, Math.max(1, n)));
			}
		}
		return maxDays;
	}, [activeLayoutForSeriesQuery.data]);

	const dashboardLayoutIdForSlices =
		activeLayoutForSeriesQuery.data?.id != null
			? activeLayoutForSeriesQuery.data.id
			: null;

	const layoutIdForDashboardRequest = onInteractiveDashboard
		? dashboardLayoutIdForSlices
		: null;

	const compactLists = !onInteractiveDashboard;

	const projectDashboardQuery = useQuery({
		...marketingCabinetProjectDashboardQueryOptions({
			projectId: selectedProjectId,
			includeSeries: dashboardIncludeSeries,
			seriesWindowDays: dashboardSeriesWindowDays,
			layoutId: layoutIdForDashboardRequest,
			compactLists,
		}),
		enabled: shouldLoadDashboard,
	});

	const prefetchProjectDashboardBundle = useCallback(() => {
		if (!selectedProjectId) return;
		void queryClient.prefetchQuery(
			marketingCabinetProjectDashboardQueryOptions({
				projectId: selectedProjectId,
				includeSeries: dashboardIncludeSeries,
				seriesWindowDays: dashboardSeriesWindowDays,
				layoutId: dashboardLayoutIdForSlices,
				compactLists: false,
			})
		);
	}, [
		queryClient,
		selectedProjectId,
		dashboardIncludeSeries,
		dashboardSeriesWindowDays,
		dashboardLayoutIdForSlices,
	]);

	return {
		hasMarketingProject,
		shouldLoadDashboard,
		activeLayoutForSeriesQuery,
		dashboardIncludeSeries,
		dashboardSeriesWindowDays,
		dashboardLayoutIdForSlices,
		projectDashboardQuery,
		prefetchProjectDashboardBundle,
	};
}
