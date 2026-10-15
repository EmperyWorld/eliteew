import type { QueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { Layout } from 'react-grid-layout';

import { cabinetNotify } from '../cabinetNotify';
import { snapLayoutToIntegerGrid } from '../dashboard-widgets/gridLayoutSnap';
import {
	marketingCabinetApi,
	type MarketingDashboardWidget,
} from '../marketingCabinetApi';
import { marketingCabinetDashboardLayoutInvalidationQueryKey } from '../marketingCabinetQueryOptions';
import {
	LAYOUT_SAVE_DEBOUNCE_MS,
	RGL_COLS,
} from '../views/overviewInteractiveDashboardConstants';
import { layoutItemMatchesWidget } from '../views/overviewInteractiveDashboardHelpers';

export function useMarketingDashboardLayoutPersist({
	projectId,
	queryClient,
	allowMarketingWrite,
	widgetsRef,
	gridLayoutRef,
	extractApiErrorMessage,
	t,
	setLayoutAnnouncement,
	setLayoutAnnouncementTick,
}: {
	projectId: string;
	queryClient: QueryClient;
	allowMarketingWrite: boolean;
	widgetsRef: React.MutableRefObject<MarketingDashboardWidget[]>;
	gridLayoutRef: React.MutableRefObject<Layout>;
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
	t: (key: string, options?: Record<string, unknown>) => string;
	setLayoutAnnouncement: (msg: string) => void;
	setLayoutAnnouncementTick: React.Dispatch<React.SetStateAction<number>>;
}) {
	const layoutPersistTimerRef = React.useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const [layoutSaveStatus, setLayoutSaveStatus] = React.useState<
		'idle' | 'pending' | 'saving' | 'error'
	>('idle');

	const layoutSaveToolbarBadgeText = React.useMemo(() => {
		switch (layoutSaveStatus) {
			case 'pending':
				return t('toolbar.dashboardLayoutPendingBadge');
			case 'saving':
				return t('toolbar.dashboardLayoutSavingBadge');
			case 'error':
				return t('toolbar.dashboardLayoutErrorBadge');
			default:
				return '';
		}
	}, [layoutSaveStatus, t]);

	const runPersistLayout = React.useCallback(
		async (next: Layout) => {
			if (!allowMarketingWrite) return;
			const normalized = snapLayoutToIntegerGrid(next, RGL_COLS);
			const byId = new Map(widgetsRef.current.map((w) => [w.id, w]));
			const patches: Array<Promise<unknown>> = [];
			for (const item of normalized) {
				const w = byId.get(item.i);
				if (!w?.is_visible) continue;
				if (layoutItemMatchesWidget(item, w)) continue;
				patches.push(
					marketingCabinetApi.updateDashboardWidget(projectId, w.id, {
						grid_position: {
							...w.grid_position,
							x: item.x,
							y: item.y,
							w: item.w,
							h: item.h,
							i: item.i,
							minW: item.minW ?? w.grid_position.minW,
							minH: item.minH ?? w.grid_position.minH,
							maxW: item.maxW ?? w.grid_position.maxW,
							maxH: item.maxH ?? w.grid_position.maxH,
						},
					})
				);
			}
			if (patches.length === 0) {
				setLayoutSaveStatus('idle');
				return;
			}
			setLayoutSaveStatus('saving');
			try {
				await Promise.all(patches);
				setLayoutSaveStatus('idle');
				setLayoutAnnouncement(t('overview.dashboard.toolbar.layoutSavedLive'));
				setLayoutAnnouncementTick((n) => n + 1);
				await queryClient.invalidateQueries({
					queryKey:
						marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
				});
			} catch (err) {
				setLayoutSaveStatus('error');
				const msg = extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.layoutSaveFailed')
				);
				cabinetNotify.error(msg, undefined, {
					toastAction: {
						label: t('overview.dashboard.toolbar.retryLayoutSave'),
						onClick: () => {
							void runPersistLayoutRef.current(gridLayoutRef.current);
						},
					},
				});
				await queryClient.invalidateQueries({
					queryKey:
						marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
				});
			}
		},
		[
			allowMarketingWrite,
			extractApiErrorMessage,
			projectId,
			queryClient,
			t,
			setLayoutAnnouncement,
			setLayoutAnnouncementTick,
			widgetsRef,
			gridLayoutRef,
		]
	);

	const runPersistLayoutRef = React.useRef(runPersistLayout);
	React.useEffect(() => {
		runPersistLayoutRef.current = runPersistLayout;
	}, [runPersistLayout]);

	const schedulePersistLayout = React.useCallback(
		(next: Layout) => {
			if (allowMarketingWrite) {
				setLayoutSaveStatus((prev) => (prev === 'error' ? prev : 'pending'));
			}
			if (layoutPersistTimerRef.current) {
				clearTimeout(layoutPersistTimerRef.current);
			}
			layoutPersistTimerRef.current = setTimeout(() => {
				layoutPersistTimerRef.current = null;
				void runPersistLayout(next);
			}, LAYOUT_SAVE_DEBOUNCE_MS);
		},
		[allowMarketingWrite, runPersistLayout]
	);

	React.useEffect(() => {
		const onVis = () => {
			if (document.visibilityState !== 'hidden') return;
			if (layoutPersistTimerRef.current) {
				clearTimeout(layoutPersistTimerRef.current);
				layoutPersistTimerRef.current = null;
				void runPersistLayout(gridLayoutRef.current);
			}
		};
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	}, [gridLayoutRef, runPersistLayout]);

	React.useEffect(
		() => () => {
			if (layoutPersistTimerRef.current) {
				clearTimeout(layoutPersistTimerRef.current);
				layoutPersistTimerRef.current = null;
				void runPersistLayoutRef.current(gridLayoutRef.current);
			}
		},
		[gridLayoutRef]
	);

	return {
		layoutSaveStatus,
		setLayoutSaveStatus,
		layoutSaveToolbarBadgeText,
		runPersistLayout,
		runPersistLayoutRef,
		schedulePersistLayout,
		layoutPersistTimerRef,
	};
}
