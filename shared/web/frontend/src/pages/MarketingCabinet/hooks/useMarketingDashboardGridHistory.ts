import * as React from 'react';
import type { Layout } from 'react-grid-layout';

import type { MarketingDashboardWidget } from '../marketingCabinetApi';
import { buildLayoutFromWidgets } from '../dashboard-widgets/buildGridLayout';
import {
	nudgeLayoutItemSize,
	snapLayoutToIntegerGrid,
} from '../dashboard-widgets/gridLayoutSnap';
import {
	GRID_UNDO_MAX,
	layoutsEqualForUndo,
	popRedoForGridLayout,
	popUndoForGridLayout,
	recordLayoutChangeOnUndoStack,
} from '../dashboard-widgets/gridLayoutUndoStack';
import { RGL_COLS } from '../views/overviewInteractiveDashboardConstants';

/**
 * Локальный `gridLayout`, undo/redo стек и синхронизация с серверным списком виджетов.
 * Семантика persist/RGL без изменений относительно прежнего inline-кода в OverviewInteractiveDashboard.
 */
export function useMarketingDashboardGridHistory({
	projectId: _projectId,
	allowMarketingWrite,
	gridLayoutRef,
	serverWidgets,
	layoutPersistTimerRef,
	schedulePersistLayout,
	runPersistLayout,
	toolbarBusyRef,
}: {
	projectId: string;
	allowMarketingWrite: boolean;
	gridLayoutRef: React.MutableRefObject<Layout>;
	serverWidgets: MarketingDashboardWidget[] | undefined;
	layoutPersistTimerRef: React.MutableRefObject<ReturnType<
		typeof setTimeout
	> | null>;
	schedulePersistLayout: (layout: Layout) => void;
	runPersistLayout: (layout: Layout) => undefined | Promise<unknown>;
	toolbarBusyRef: React.MutableRefObject<boolean>;
}) {
	const [_gridHistoryRev, setGridHistoryRev] = React.useState(0);

	React.useEffect(() => {
		undoStackRef.current = [];
		redoStackRef.current = [];
		setGridHistoryRev((n) => n + 1);
	}, []);

	const [gridLayout, setGridLayout] = React.useState<Layout>([]);

	const undoStackRef = React.useRef<Layout[]>([]);
	const redoStackRef = React.useRef<Layout[]>([]);
	const applyingGridHistoryRef = React.useRef(false);
	const syncingGridFromServerRef = React.useRef(false);

	React.useEffect(() => {
		gridLayoutRef.current = gridLayout;
	}, [gridLayout, gridLayoutRef]);

	React.useLayoutEffect(() => {
		let hadPendingLayoutSave = false;
		if (layoutPersistTimerRef.current) {
			hadPendingLayoutSave = true;
			clearTimeout(layoutPersistTimerRef.current);
			layoutPersistTimerRef.current = null;
			void runPersistLayout(gridLayoutRef.current);
		}

		syncingGridFromServerRef.current = true;

		/**
		 * Живой кэш маркетинга (`MARKETING_LIVE_QUERY_OPTIONS`) часто перезапрашивает layout до
		 * срабатывания debounce persist. Раньше мы только сбрасывали таймер и тут же подставляли
		 * снимок сервера — размеры/позиции сбрасывались до PATCH. После flush не перезаписываем
		 * локальный `gridLayout` в этом же проходе: следующий `serverWidgets` после invalidate уже
		 * содержит сохранённые координаты.
		 */
		if (hadPendingLayoutSave) {
			queueMicrotask(() => {
				syncingGridFromServerRef.current = false;
			});
			return;
		}

		const vis = (serverWidgets ?? []).filter((x) => x.is_visible);
		if (!vis.length) {
			setGridLayout((prev) => (prev.length === 0 ? prev : []));
		} else {
			const next = buildLayoutFromWidgets(vis, {
				readOnlyLayout: !allowMarketingWrite,
			});
			setGridLayout((prev) => (layoutsEqualForUndo(prev, next) ? prev : next));
		}
		queueMicrotask(() => {
			syncingGridFromServerRef.current = false;
		});
	}, [
		serverWidgets,
		allowMarketingWrite,
		layoutPersistTimerRef,
		runPersistLayout,
		gridLayoutRef,
	]);

	const handleLayoutChange = React.useCallback(
		(next: Layout) => {
			if (!allowMarketingWrite) return;
			const snapped = snapLayoutToIntegerGrid(next, RGL_COLS);
			if (
				!applyingGridHistoryRef.current &&
				!syncingGridFromServerRef.current
			) {
				const prev = gridLayoutRef.current;
				const { undoStack, redoStack, stacksMutated } =
					recordLayoutChangeOnUndoStack(
						undoStackRef.current,
						redoStackRef.current,
						prev,
						snapped,
						GRID_UNDO_MAX
					);
				undoStackRef.current = undoStack;
				redoStackRef.current = redoStack;
				if (stacksMutated) {
					setGridHistoryRev((x) => x + 1);
				}
			}
			// Live drag/resize must update layout synchronously — startTransition deferred
			// height growth and made the canvas feel vertically bounded mid-gesture (K.108).
			setGridLayout(snapped);
			schedulePersistLayout(snapped);
		},
		[allowMarketingWrite, gridLayoutRef, schedulePersistLayout]
	);

	const applyGridHistoryLayout = React.useCallback(
		(target: Layout) => {
			const snapped = snapLayoutToIntegerGrid(target, RGL_COLS);
			applyingGridHistoryRef.current = true;
			setGridLayout(snapped);
			gridLayoutRef.current = snapped;
			void runPersistLayout(snapped);
			requestAnimationFrame(() => {
				applyingGridHistoryRef.current = false;
			});
		},
		[gridLayoutRef, runPersistLayout]
	);

	const undoGridLayout = React.useCallback(() => {
		if (
			undoStackRef.current.length === 0 ||
			toolbarBusyRef.current ||
			!allowMarketingWrite
		) {
			return;
		}
		const popped = popUndoForGridLayout(
			undoStackRef.current,
			redoStackRef.current,
			gridLayoutRef.current
		);
		if (!popped) return;
		undoStackRef.current = popped.undoStack;
		redoStackRef.current = popped.redoStack;
		setGridHistoryRev((x) => x + 1);
		applyGridHistoryLayout(popped.targetLayout);
	}, [
		allowMarketingWrite,
		applyGridHistoryLayout,
		gridLayoutRef,
		toolbarBusyRef,
	]);

	const redoGridLayout = React.useCallback(() => {
		if (
			redoStackRef.current.length === 0 ||
			toolbarBusyRef.current ||
			!allowMarketingWrite
		) {
			return;
		}
		const popped = popRedoForGridLayout(
			undoStackRef.current,
			redoStackRef.current,
			gridLayoutRef.current
		);
		if (!popped) return;
		undoStackRef.current = popped.undoStack;
		redoStackRef.current = popped.redoStack;
		setGridHistoryRev((x) => x + 1);
		applyGridHistoryLayout(popped.targetLayout);
	}, [
		allowMarketingWrite,
		applyGridHistoryLayout,
		gridLayoutRef,
		toolbarBusyRef,
	]);

	const handleNudgeTileGrid = React.useCallback(
		(widgetId: string, dw: number, dh: number) => {
			if (!allowMarketingWrite || toolbarBusyRef.current) return;
			const cur = gridLayoutRef.current;
			const next = nudgeLayoutItemSize(cur, widgetId, dw, dh, RGL_COLS);
			if (!next || layoutsEqualForUndo(cur, next)) return;
			handleLayoutChange(next);
		},
		[allowMarketingWrite, gridLayoutRef, handleLayoutChange, toolbarBusyRef]
	);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') {
				return;
			}
			const tgt = e.target;
			if (
				tgt instanceof HTMLElement &&
				tgt.closest('input, textarea, select, [contenteditable="true"]')
			) {
				return;
			}
			if (!allowMarketingWrite || toolbarBusyRef.current) {
				return;
			}
			e.preventDefault();
			if (e.shiftKey) {
				redoGridLayout();
			} else {
				undoGridLayout();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [allowMarketingWrite, redoGridLayout, undoGridLayout, toolbarBusyRef]);

	const gridHistoryLengths = React.useMemo(
		() => ({
			undo: undoStackRef.current.length,
			redo: redoStackRef.current.length,
		}),
		[]
	);

	return {
		gridLayout,
		handleLayoutChange,
		undoGridLayout,
		redoGridLayout,
		handleNudgeTileGrid,
		canUndoGridLayout: gridHistoryLengths.undo > 0,
		canRedoGridLayout: gridHistoryLengths.redo > 0,
	};
}
