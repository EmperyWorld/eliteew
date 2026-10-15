/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive marketing project dashboard: grid layout, presets, templates, and widget chrome.
 *
 * Invariants:
 * - Active layout and project-dashboard bundle use canonical TanStack keys (see hooks/constants).
 * - Presets and layout templates fetch only when the dashboard toolbar is expanded.
 *
 * Related:
 * - hooks/useMarketingCabinetDashboardBundle.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Layout } from 'react-grid-layout';
import { useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { cabinetNotify } from '../cabinetNotify';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useMarketingDashboardGridHistory } from '../hooks/useMarketingDashboardGridHistory';
import { useMarketingDashboardOverviewMutations } from '../hooks/useMarketingDashboardOverviewMutations';
import { useMarketingDashboardLayoutPersist } from '../hooks/useMarketingDashboardLayoutPersist';
import { useMarketingDashboardOverviewDialogs } from '../hooks/useMarketingDashboardOverviewDialogs';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import type { MarketingView } from '../constants';
import {
	buildWidgetsClipboardPayload,
	parseWidgetsClipboardPayload,
} from '../dashboard-widgets/dashboardWidgetClipboard';
import { countVisibleMarketingDashboardWidgets } from '../dashboard-widgets/marketingDashboardTti';
import { buildPresetApplyDiffPreview } from '../dashboard-widgets/buildPresetApplyDiffPreview';
import { filterMarketingDashboardPresets } from '../dashboard-widgets/filterMarketingDashboardPresets';
import { listRecentDashboardPresetNames } from '../dashboard-widgets/dashboardPresetHistory';
import { DASHBOARD_WIDGET_CATALOG } from '../dashboard-widgets/registry';
import {
	buildTileTitleHint,
	MemoDashboardWidgetBody,
	mergeTitleOverrideIntoWidgetConfig,
} from '../dashboard-widgets/dashboardWidgetBody';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../dashboard-widgets/TileChrome';
import type { MarketingCabinetNavigateExtras } from '../dashboard-widgets/widgetBodyProps';
import {
	type MarketingDashboardWidget,
	type MarketingProjectDashboard,
	type MarketingWidgetConfig,
} from '../marketingCabinetApi';
import { useMarketingCabinetDashboardToolbarPortal } from '../shell/MarketingCabinetDashboardToolbarPortalContext';
import { apiClient } from '@/services/api/client';
import { createServiceLogger, LogLevel } from '@/services/core/ServiceLogger';
import { MarketingDashboardInteractiveGrid } from './MarketingDashboardInteractiveGrid';
import { MarketingDashboardPreGridChrome } from './MarketingDashboardPreGridChrome';
import { MarketingDashboardLiveRegions } from './MarketingDashboardLiveRegions';
import { MarketingDashboardToolbarPortal } from './MarketingDashboardToolbarPortal';
import {
	marketingCabinetDashboardLayoutQueryOptions,
	marketingCabinetDashboardLayoutTemplatesQueryOptions,
	marketingCabinetDashboardPresetsQueryOptions,
	marketingCabinetDashboardUsageStatsQueryOptions,
} from '../marketingCabinetQueryOptions';
import { MarketingDashboardTile } from './MarketingDashboardTile';
import { MarketingDashboardGridContextMenuPortal } from './MarketingDashboardGridContextMenu';
import {
	MarketingDashboardPresetApplyDialogPortal,
	MarketingDashboardRenameTileDialogPortal,
	MarketingDashboardSaveTemplateDialogPortal,
	MarketingDashboardShortcutsDialogPortal,
} from './MarketingDashboardOverviewDialogPortals';
import {
	DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION,
	MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE,
	readDashboardToolbarExpandedPreference,
} from './overviewInteractiveDashboardConstants';
import {
	nextDisplayOrder,
	nextNewWidgetY,
} from './overviewInteractiveDashboardHelpers';
import {
	exportMarketingDashboardLayoutJson,
	importMarketingDashboardLayoutFromFileList,
} from './overviewDashboardLayoutImportExport';

const marketingDashboardTtiLogger = createServiceLogger(
	'MarketingCabinet:DashboardTTI'
);

export { DASHBOARD_WIDGET_CATALOG };

interface OverviewInteractiveDashboardProps {
	projectId: string;
	dashboard: MarketingProjectDashboard;
	allowMarketingWrite: boolean;
	onNavigate: (
		view: MarketingView,
		entityId?: string | null,
		extras?: MarketingCabinetNavigateExtras
	) => void;
	/** A.10: второй явный путь к карточкам обзора (тот же колбэк, что «Назад» в шапке). */
	onExitToOverviewCards?: () => void;
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
	/** Background refetch for merged project dashboard (tiles + analytics). */
	onRefetchProjectDashboard?: () => undefined | Promise<unknown>;
	isProjectDashboardFetching?: boolean;
}

export function OverviewInteractiveDashboard({
	projectId,
	dashboard,
	allowMarketingWrite,
	onNavigate,
	onExitToOverviewCards,
	extractApiErrorMessage,
	onRefetchProjectDashboard,
	isProjectDashboardFetching = false,
}: OverviewInteractiveDashboardProps) {
	const { t } = useTranslation('marketing');
	const { contentPanel: mcShellPanel } = useMarketingShellClasses();
	const queryClient = useQueryClient();
	const { width, containerRef, mounted, measureWidth } = useContainerWidth({
		measureBeforeMount: true,
		initialWidth: 0,
	});

	const [dashboardToolbarExpanded, setDashboardToolbarExpanded] =
		React.useState(() => {
			if (typeof globalThis.window === 'undefined') return false;
			return readDashboardToolbarExpandedPreference((key) =>
				globalThis.window.localStorage.getItem(key)
			);
		});

	React.useEffect(() => {
		if (typeof globalThis.window === 'undefined') return;
		try {
			globalThis.window.localStorage.setItem(
				MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE,
				dashboardToolbarExpanded ? '1' : '0'
			);
		} catch {
			/* private mode / quota */
		}
	}, [dashboardToolbarExpanded]);

	React.useEffect(() => {
		const onResize = () => {
			measureWidth();
		};
		globalThis.addEventListener?.('resize', onResize);
		return () => globalThis.removeEventListener?.('resize', onResize);
	}, [measureWidth]);

	const activeLayoutQuery = useQuery({
		...marketingCabinetDashboardLayoutQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	const ttiOriginRef = React.useRef<{ projectId: string; t0: number } | null>(
		null
	);
	const interactiveTtiLoggedRef = React.useRef(false);

	React.useEffect(() => {
		if (!projectId) {
			return;
		}
		ttiOriginRef.current = {
			projectId,
			t0:
				typeof performance !== 'undefined' &&
				typeof performance.now === 'function'
					? performance.now()
					: 0,
		};
		interactiveTtiLoggedRef.current = false;
	}, [projectId]);

	React.useEffect(() => {
		if (interactiveTtiLoggedRef.current || !projectId) {
			return;
		}
		const origin = ttiOriginRef.current;
		if (!origin || origin.projectId !== projectId) {
			return;
		}
		if (
			!activeLayoutQuery.isSuccess ||
			activeLayoutQuery.data == null ||
			!activeLayoutQuery.data.id
		) {
			return;
		}
		if (!mounted || width <= 0) {
			return;
		}
		if (
			typeof performance === 'undefined' ||
			typeof performance.now !== 'function'
		) {
			return;
		}
		const widgets = activeLayoutQuery.data.widgets ?? [];
		const ms = Math.max(0, Math.round(performance.now() - origin.t0));
		const visibleWidgetCount = countVisibleMarketingDashboardWidgets(widgets);
		if (typeof performance.mark === 'function') {
			try {
				performance.mark('mc-dashboard-interactive');
			} catch {
				/* duplicate mark ok */
			}
		}
		marketingDashboardTtiLogger.info('overview_dashboard_interactive', {
			msToInteractive: ms,
			visibleWidgetCount,
		});
		if (import.meta.env.PROD) {
			void apiClient
				.post('/api/v1/monitoring/logs', {
					timestamp: new Date().toISOString(),
					level: LogLevel.INFO,
					serviceName: 'MarketingCabinet:DashboardTTI',
					message: 'overview_dashboard_interactive',
					metadata: {
						msToInteractive: ms,
						visibleWidgetCount,
					},
				})
				.catch(() => {
					/* ingest must not break UI */
				});
		}
		interactiveTtiLoggedRef.current = true;
	}, [
		projectId,
		activeLayoutQuery.isSuccess,
		activeLayoutQuery.data,
		mounted,
		width,
	]);

	const presetsQuery = useQuery({
		...marketingCabinetDashboardPresetsQueryOptions(projectId),
		enabled: Boolean(projectId) && dashboardToolbarExpanded,
	});

	const presetsFromApi = presetsQuery.data?.items ?? [];
	const recentPresetQuickList = React.useMemo(() => {
		const names = listRecentDashboardPresetNames(projectId, 3);
		return names
			.map((n) => presetsFromApi.find((p) => p.name === n))
			.filter((p): p is (typeof presetsFromApi)[number] => Boolean(p));
	}, [projectId, presetsFromApi]);
	const presetCategories = React.useMemo(() => {
		const s = new Set(presetsFromApi.map((p) => p.category).filter(Boolean));
		return Array.from(s).sort((a, b) => a.localeCompare(b));
	}, [presetsFromApi]);

	const usageStatsQuery = useQuery({
		...marketingCabinetDashboardUsageStatsQueryOptions(projectId),
		enabled: Boolean(projectId) && Boolean(activeLayoutQuery.data?.id),
	});

	const layoutTemplatesQuery = useQuery({
		...marketingCabinetDashboardLayoutTemplatesQueryOptions(),
		enabled:
			Boolean(projectId) && allowMarketingWrite && dashboardToolbarExpanded,
	});

	const [presetAnnouncement, setPresetAnnouncement] = React.useState('');
	const [presetAnnouncementTick, setPresetAnnouncementTick] = React.useState(0);
	const [layoutAnnouncement, setLayoutAnnouncement] = React.useState('');
	const [layoutAnnouncementTick, setLayoutAnnouncementTick] = React.useState(0);
	const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false);
	const [saveTemplateName, setSaveTemplateName] = React.useState('');
	const [saveTemplateDescription, setSaveTemplateDescription] =
		React.useState('');
	const [selectedLayoutTemplateId, setSelectedLayoutTemplateId] =
		React.useState('');

	const {
		pendingScrollWidgetIdRef,
		bootstrapMutation,
		applyPresetMutation,
		rebuildPresetFromTemplateMutation,
		importLayoutMutation,
		saveLayoutTemplateMutation,
		applyLayoutTemplateMutation,
		deleteLayoutTemplateMutation,
		addWidgetMutation,
		patchWidgetMutation,
		deleteWidgetMutation,
		cleanupDuplicatesMutation,
		createBlankLayoutMutation,
	} = useMarketingDashboardOverviewMutations({
		projectId,
		queryClient,
		presetsFromApi,
		t,
		extractApiErrorMessage,
		setPresetAnnouncement,
		setPresetAnnouncementTick,
		setLayoutAnnouncement,
		setLayoutAnnouncementTick,
		setSaveTemplateOpen,
		setSaveTemplateName,
		setSaveTemplateDescription,
		setSelectedLayoutTemplateId,
	});

	const bootstrapStartedRef = React.useRef(false);

	React.useEffect(() => {
		bootstrapStartedRef.current = false;
	}, []);

	const toolbarBusyRef = React.useRef(false);

	const widgetsRef = React.useRef<MarketingDashboardWidget[]>([]);
	widgetsRef.current = activeLayoutQuery.data?.widgets ?? [];

	const gridLayoutRef = React.useRef<Layout>([]);

	const [presetSelectValue, setPresetSelectValue] = React.useState('');
	const [addWidgetSelectValue, setAddWidgetSelectValue] = React.useState('');
	const [presetCategoryFilter, setPresetCategoryFilter] = React.useState('');
	const [presetSearchQuery, setPresetSearchQuery] = React.useState('');

	React.useEffect(() => {
		setPresetSelectValue('');
		setAddWidgetSelectValue('');
	}, []);

	React.useEffect(() => {
		setPresetCategoryFilter('');
		setPresetSearchQuery('');
	}, []);

	const toolbarRegionRef = React.useRef<HTMLDivElement>(null);
	const importLayoutInputRef = React.useRef<HTMLInputElement>(null);

	const {
		layoutSaveStatus,
		layoutSaveToolbarBadgeText,
		runPersistLayout,
		runPersistLayoutRef: _runPersistLayoutRef,
		schedulePersistLayout,
		layoutPersistTimerRef,
	} = useMarketingDashboardLayoutPersist({
		projectId,
		queryClient,
		allowMarketingWrite,
		widgetsRef,
		gridLayoutRef,
		extractApiErrorMessage,
		t,
		setLayoutAnnouncement,
		setLayoutAnnouncementTick,
	});

	const {
		gridLayout,
		handleLayoutChange,
		undoGridLayout,
		redoGridLayout,
		handleNudgeTileGrid,
		canUndoGridLayout,
		canRedoGridLayout,
	} = useMarketingDashboardGridHistory({
		projectId,
		allowMarketingWrite,
		gridLayoutRef,
		serverWidgets: activeLayoutQuery.data?.widgets,
		layoutPersistTimerRef,
		schedulePersistLayout,
		runPersistLayout,
		toolbarBusyRef,
	});

	/** After add/duplicate, refetch brings the new tile — scroll it into view once. */
	React.useEffect(() => {
		const id = pendingScrollWidgetIdRef.current;
		if (!id) return;
		const widgets = activeLayoutQuery.data?.widgets ?? [];
		if (!widgets.some((w) => w.id === id)) return;
		if (activeLayoutQuery.isFetching) return;
		pendingScrollWidgetIdRef.current = null;
		const run = () => {
			const el = document.querySelector(
				`[data-mc-dashboard-tile="${CSS.escape(id)}"]`
			);
			const reduce =
				typeof globalThis.window !== 'undefined' &&
				globalThis.window.matchMedia('(prefers-reduced-motion: reduce)')
					.matches;
			el?.scrollIntoView({
				behavior: reduce ? 'auto' : 'smooth',
				block: 'nearest',
			});
		};
		requestAnimationFrame(() => requestAnimationFrame(run));
	}, [
		activeLayoutQuery.data?.widgets,
		activeLayoutQuery.isFetching,
		pendingScrollWidgetIdRef,
	]);

	const bootstrapMutate = bootstrapMutation.mutate;

	React.useEffect(() => {
		if (
			!allowMarketingWrite ||
			activeLayoutQuery.isLoading ||
			activeLayoutQuery.isFetching ||
			bootstrapMutation.isPending
		) {
			return;
		}
		if (
			activeLayoutQuery.isSuccess &&
			activeLayoutQuery.data === null &&
			!bootstrapStartedRef.current
		) {
			bootstrapStartedRef.current = true;
			bootstrapMutate();
		}
	}, [
		allowMarketingWrite,
		activeLayoutQuery.isLoading,
		activeLayoutQuery.isFetching,
		activeLayoutQuery.isSuccess,
		activeLayoutQuery.data,
		bootstrapMutate,
		bootstrapMutation.isPending,
	]);

	function handleAddWidget(widgetKey: string) {
		if (!widgetKey || !allowMarketingWrite) return;
		const layout = activeLayoutQuery.data;
		if (!layout?.id) return;
		const cat = DASHBOARD_WIDGET_CATALOG.find((c) => c.key === widgetKey);
		if (!cat) return;
		const all = layout.widgets ?? [];
		const cap = usageStatsQuery.data?.max_widgets_per_layout ?? 60;
		if (all.length >= cap) {
			cabinetNotify.error(
				t('overview.dashboard.toolbar.widgetLimitReached', { cap })
			);
			setAddWidgetSelectValue('');
			return;
		}
		addWidgetMutation.mutate({
			layout_id: layout.id,
			widget_key: cat.key,
			widget_title: t(`overview.dashboard.catalog.${cat.key}`),
			grid_position: {
				x: 0,
				y: nextNewWidgetY(all),
				w: cat.defaultW,
				h: cat.defaultH,
				minW: cat.minW,
				minH: cat.minH,
			},
			is_visible: true,
			is_locked: false,
			display_order: nextDisplayOrder(all),
		});
		setAddWidgetSelectValue('');
	}

	function handleDuplicateWidget(source: MarketingDashboardWidget) {
		if (!allowMarketingWrite) return;
		const layout = activeLayoutQuery.data;
		if (!layout?.id) return;
		const all = layout.widgets ?? [];
		const cap = usageStatsQuery.data?.max_widgets_per_layout ?? 60;
		if (all.length >= cap) {
			cabinetNotify.error(
				t('overview.dashboard.toolbar.widgetLimitReached', { cap })
			);
			return;
		}
		const g = source.grid_position;
		addWidgetMutation.mutate({
			layout_id: layout.id,
			widget_key: source.widget_key,
			widget_title: t('overview.dashboard.toolbar.duplicateTileTitle', {
				title: source.widget_title,
			}),
			widget_config: structuredClone(source.widget_config),
			grid_position: {
				x: 0,
				y: nextNewWidgetY(all),
				w: g.w ?? 4,
				h: g.h ?? 4,
				minW: g.minW ?? undefined,
				minH: g.minH ?? undefined,
				maxW: g.maxW ?? undefined,
				maxH: g.maxH ?? undefined,
			},
			is_visible: true,
			is_locked: false,
			display_order: nextDisplayOrder(all),
		});
	}

	const layoutDataEarly = activeLayoutQuery.data;
	const dashboardWidgetsEarly = layoutDataEarly?.widgets;
	const visibleWidgetsMemo = React.useMemo(
		() => (dashboardWidgetsEarly ?? []).filter((w) => w.is_visible),
		[dashboardWidgetsEarly]
	);
	const hiddenWidgetsMemo = React.useMemo(
		() => (dashboardWidgetsEarly ?? []).filter((w) => !w.is_visible),
		[dashboardWidgetsEarly]
	);

	const filteredPresets = React.useMemo(
		() =>
			filterMarketingDashboardPresets(presetsFromApi, {
				categoryFilter: presetCategoryFilter,
				searchQuery: presetSearchQuery,
			}),
		[presetsFromApi, presetCategoryFilter, presetSearchQuery]
	);

	const presetSelectOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.toolbar.presetPlaceholder') },
			...filteredPresets.map((p) => ({
				value: p.name,
				label: `${p.display_name} · v${p.version}`,
				description: p.description?.trim() ? p.description.trim() : undefined,
			})),
		],
		[filteredPresets, t]
	);

	const disabledWidgetKeys = React.useMemo(
		() => new Set(usageStatsQuery.data?.disabled_widget_keys ?? []),
		[usageStatsQuery.data?.disabled_widget_keys]
	);

	const addWidgetSelectOptions = React.useMemo(
		() => [
			{
				value: '',
				label: t('overview.dashboard.toolbar.addWidgetPlaceholder'),
			},
			...DASHBOARD_WIDGET_CATALOG.filter(
				(c) => !disabledWidgetKeys.has(c.key)
			).map((c) => ({
				value: c.key,
				label: t(`overview.dashboard.catalog.${c.key}`),
				description: t(`overview.dashboard.catalogDesc.${c.key}`),
			})),
		],
		[t, disabledWidgetKeys]
	);

	const presetSelectId = React.useId();
	const presetCategorySelectId = React.useId();
	const presetSearchInputId = React.useId();
	const presetHintId = React.useId();
	const addWidgetSelectId = React.useId();
	const dashboardToolbarLayoutGroupLabelId = React.useId();
	const dashboardToolbarWidgetsGroupLabelId = React.useId();
	const dashboardToolbarServiceGroupLabelId = React.useId();

	const {
		shortcutsOpen,
		setShortcutsOpen,
		shortcutsPanelRef,
		shortcutsTitleId,
		shortcutsDescId,
		presetApplyDialog,
		setPresetApplyDialog,
		presetApplyPanelRef,
		presetApplyTitleId,
		presetApplyIntroId,
		presetApplyListId,
		presetApplyRemovedIntroId,
		presetApplyRemovedListId,
		renameTarget,
		setRenameTarget,
		renameDraft,
		setRenameDraft,
		renamePanelRef,
		renameTitleId,
		renameHintId,
		renameFieldId,
		renameInputRef,
		renameOpenerRef,
		closeRenameModal,
		gridContextMenu,
		setGridContextMenu,
		contextMenuRef,
		saveTemplatePanelRef,
		saveTemplateNameInputRef,
		saveTemplateTitleId,
		saveTemplateNameFieldId,
		saveTemplateDescFieldId,
		saveTemplateDialogDescId,
		layoutTemplateSelectId,
		layoutTemplatesCaveatId,
	} = useMarketingDashboardOverviewDialogs({
		saveTemplateOpen,
		setSaveTemplateOpen,
		setPresetSelectValue,
	});

	const layoutTemplateRows = layoutTemplatesQuery.data?.data ?? [];
	const layoutTemplateSelectOptions = React.useMemo(
		() => [
			{
				value: '',
				label: t('overview.dashboard.toolbar.layoutTemplatesPlaceholder'),
			},
			...layoutTemplateRows.map((row) => ({
				value: row.id,
				label: row.name,
			})),
		],
		[layoutTemplateRows, t]
	);

	const presetApplyDiffPreview = React.useMemo(() => {
		if (!presetApplyDialog) {
			return null;
		}
		const preset = presetsFromApi.find(
			(p) => p.name === presetApplyDialog.name
		);
		if (!preset) {
			return null;
		}
		return buildPresetApplyDiffPreview(preset, layoutDataEarly?.widgets, t);
	}, [presetApplyDialog, presetsFromApi, layoutDataEarly?.widgets, t]);

	const toolbarBusy =
		applyPresetMutation.isPending ||
		rebuildPresetFromTemplateMutation.isPending ||
		importLayoutMutation.isPending ||
		saveLayoutTemplateMutation.isPending ||
		applyLayoutTemplateMutation.isPending ||
		deleteLayoutTemplateMutation.isPending ||
		addWidgetMutation.isPending ||
		patchWidgetMutation.isPending ||
		deleteWidgetMutation.isPending ||
		cleanupDuplicatesMutation.isPending ||
		createBlankLayoutMutation.isPending ||
		layoutSaveStatus === 'saving';

	const handleGridCanvasContextMenu = React.useCallback(
		(ev: React.MouseEvent<HTMLDivElement>) => {
			if (!allowMarketingWrite || toolbarBusy) return;
			const target = ev.target;
			if (
				target instanceof Element &&
				target.closest('[data-mc-dashboard-tile]')
			) {
				return;
			}
			ev.preventDefault();
			setGridContextMenu({
				kind: 'canvas',
				x: ev.clientX,
				y: ev.clientY,
			});
		},
		[allowMarketingWrite, toolbarBusy, setGridContextMenu]
	);

	const layoutSaveStatusPillRow =
		allowMarketingWrite && layoutSaveStatus !== 'idle' ? (
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<span
					id="marketing-cabinet-layout-save-status"
					role="status"
					aria-live="polite"
					aria-atomic="true"
					title={layoutSaveToolbarBadgeText}
					className={cn(
						'inline-flex min-h-8 min-w-0 max-w-full items-center truncate rounded-full border px-3 py-1.5 leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:max-w-md',
						DESKTOP_TYPOGRAPHY.meta,
						layoutSaveStatus === 'error'
							? 'border-[color-mix(in_srgb,rgb(239_68_68)_45%,transparent)] bg-[color-mix(in_srgb,rgb(239_68_68)_12%,transparent)] text-[color-mix(in_srgb,rgb(239_68_68)_85%,var(--desktop-text-primary))]'
							: 'border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)] text-(--desktop-text-primary)'
					)}
				>
					{layoutSaveToolbarBadgeText}
				</span>
				{layoutSaveStatus === 'error' ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className={MC_DASHBOARD_NO_DRAG_CLASS}
						disabled={toolbarBusy}
						onClick={() => void runPersistLayout(gridLayoutRef.current)}
					>
						{t('overview.dashboard.toolbar.retryLayoutSave')}
					</DesktopAppButton>
				) : null}
			</div>
		) : null;

	toolbarBusyRef.current = toolbarBusy;

	const portalToolbar = useMarketingCabinetDashboardToolbarPortal();
	const dashboardToolbarMountNode = portalToolbar?.mountNode ?? null;
	const dashboardToolbarInHeader = Boolean(dashboardToolbarMountNode);

	React.useLayoutEffect(() => {
		if (dashboardToolbarInHeader) {
			return;
		}
		const el = toolbarRegionRef.current;
		if (!el) {
			return;
		}
		const reduce =
			typeof globalThis.window !== 'undefined' &&
			globalThis.window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
	}, [dashboardToolbarInHeader]);

	const submitSaveLayoutTemplate = React.useCallback(() => {
		const name = saveTemplateName.trim();
		if (!name) return;
		const desc = saveTemplateDescription.trim();
		saveLayoutTemplateMutation.mutate({
			name,
			description: desc ? desc : null,
		});
	}, [saveTemplateName, saveTemplateDescription, saveLayoutTemplateMutation]);

	function handleCreateBlankLayout() {
		if (layoutDataEarly?.id) {
			if (
				!window.confirm(
					t('overview.dashboard.toolbar.blankLayoutConfirmReplace')
				)
			) {
				return;
			}
		}
		createBlankLayoutMutation.mutate();
	}

	if (activeLayoutQuery.isLoading || bootstrapMutation.isPending) {
		return (
			<DesktopAppSurface variant="soft" className="min-h-60 p-6">
				<div className={cn('flex items-center gap-2', DESKTOP_TYPOGRAPHY.body)}>
					<Squares2X2Icon
						className={cn(DESKTOP_LUCIDE.md, 'motion-safe:animate-pulse')}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('overview.dashboard.loading')}
				</div>
			</DesktopAppSurface>
		);
	}

	if (activeLayoutQuery.isError) {
		return (
			<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
				<DesktopAppErrorState
					message={extractApiErrorMessage(
						activeLayoutQuery.error,
						t('overview.dashboard.loadError')
					)}
					onAction={() => void activeLayoutQuery.refetch()}
				/>
			</DesktopAppSurface>
		);
	}

	if (bootstrapMutation.isError) {
		return (
			<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
				<DesktopAppErrorState
					message={extractApiErrorMessage(
						bootstrapMutation.error,
						t('overview.dashboard.bootstrapError')
					)}
					onAction={() => {
						bootstrapStartedRef.current = false;
						bootstrapMutation.reset();
						void activeLayoutQuery.refetch();
					}}
				/>
			</DesktopAppSurface>
		);
	}

	const layoutData = layoutDataEarly;
	const allWidgets = dashboardWidgetsEarly ?? [];
	const visibleWidgets = visibleWidgetsMemo;
	const hiddenWidgets = hiddenWidgetsMemo;
	const presets = presetsFromApi;
	const widgetLayoutCap = usageStatsQuery.data?.max_widgets_per_layout ?? 60;
	const atWidgetCap = allWidgets.length >= widgetLayoutCap;

	if (!layoutData) {
		return (
			<DesktopAppEmptyState
				title={t('overview.dashboard.emptyTitle')}
				description={t('overview.dashboard.emptyDescription')}
			/>
		);
	}

	function handleExportLayoutJson() {
		if (!layoutData) {
			return;
		}
		exportMarketingDashboardLayoutJson({
			layoutData,
			projectId,
			schemaVersion: DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION,
			t,
		});
	}

	function handleImportLayoutFileList(files: FileList | null) {
		void importMarketingDashboardLayoutFromFileList(files, {
			allowMarketingWrite,
			schemaVersion: DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION,
			maxWidgetsPerLayout: usageStatsQuery.data?.max_widgets_per_layout ?? 60,
			importLayoutMutateAsync: importLayoutMutation.mutateAsync,
			clearImportInput: () => {
				if (importLayoutInputRef.current) {
					importLayoutInputRef.current.value = '';
				}
			},
			t,
		});
	}

	function confirmApplyPresetFromDialog() {
		const d = presetApplyDialog;
		if (!d || !allowMarketingWrite) {
			return;
		}
		applyPresetMutation.mutate(d.name, {
			onSettled: () => {
				setPresetApplyDialog(null);
				setPresetSelectValue('');
			},
		});
	}

	function openRenameTileModal(w: MarketingDashboardWidget) {
		renameOpenerRef.current = document.activeElement as HTMLElement | null;
		setRenameTarget(w);
	}

	function submitRenameTile() {
		const w = renameTarget;
		if (!w) return;
		const trimmed = renameDraft.trim();
		if (trimmed === '' || trimmed === w.widget_title) {
			closeRenameModal();
			return;
		}
		patchWidgetMutation.mutate({
			widgetId: w.id,
			body: {
				widget_title: trimmed,
				widget_config: mergeTitleOverrideIntoWidgetConfig(w, trimmed, t),
			},
		});
		closeRenameModal();
	}

	async function handleCopyWidgetClipboard(w: MarketingDashboardWidget) {
		try {
			const text = JSON.stringify(buildWidgetsClipboardPayload(w), null, 2);
			await navigator.clipboard.writeText(text);
			cabinetNotify.success(t('overview.dashboard.toolbar.copyWidgetDone'));
			setGridContextMenu(null);
		} catch {
			cabinetNotify.error(t('overview.dashboard.toolbar.copyWidgetFailed'));
		}
	}

	async function handlePasteWidgetFromClipboard() {
		if (!allowMarketingWrite) return;
		const layout = layoutData;
		if (!layout?.id) return;
		try {
			const text = await navigator.clipboard.readText();
			const data = JSON.parse(text) as unknown;
			const payload = parseWidgetsClipboardPayload(data);
			if (!payload) {
				cabinetNotify.error(t('overview.dashboard.toolbar.pasteWidgetInvalid'));
				return;
			}
			const cat = DASHBOARD_WIDGET_CATALOG.find(
				(c) => c.key === payload.widget_key
			);
			if (!cat) {
				cabinetNotify.error(t('overview.dashboard.toolbar.pasteWidgetInvalid'));
				return;
			}
			const all = layout.widgets ?? [];
			const cap = usageStatsQuery.data?.max_widgets_per_layout ?? 60;
			if (all.length >= cap) {
				cabinetNotify.error(
					t('overview.dashboard.toolbar.widgetLimitReached', { cap })
				);
				return;
			}
			const gp = payload.grid_position ?? {};
			addWidgetMutation.mutate({
				layout_id: layout.id,
				widget_key: cat.key,
				widget_title: payload.widget_title,
				widget_config: payload.widget_config as MarketingWidgetConfig,
				grid_position: {
					x: 0,
					y: nextNewWidgetY(all),
					w: gp.w ?? cat.defaultW,
					h: gp.h ?? cat.defaultH,
					minW: gp.minW ?? cat.minW,
					minH: gp.minH ?? cat.minH,
					maxW: gp.maxW,
					maxH: gp.maxH,
				},
				is_visible: true,
				is_locked: false,
				display_order: nextDisplayOrder(all),
			});
			cabinetNotify.success(t('overview.dashboard.toolbar.pasteWidgetDone'));
		} catch {
			cabinetNotify.error(t('overview.dashboard.toolbar.pasteWidgetInvalid'));
		}
	}

	function patchTileFullConfig(widgetId: string, cfg: MarketingWidgetConfig) {
		patchWidgetMutation.mutate({ widgetId, body: { widget_config: cfg } });
	}

	const toolbarAwaitingPresets =
		presetsQuery.isLoading || presetsQuery.isFetching;

	return (
		<>
			<MarketingDashboardLiveRegions
				presetAnnouncement={presetAnnouncement}
				presetAnnouncementTick={presetAnnouncementTick}
				layoutAnnouncement={layoutAnnouncement}
				layoutAnnouncementTick={layoutAnnouncementTick}
			/>
			<div className="relative min-w-0 w-full space-y-4">
				{/*
				 * Stay inside the content frame padding (MarketingCabinetContentFrame section px).
				 * Negative horizontal margins + `overflow-x-hidden` on the page wrapper clip the
				 * react-grid-layout and misalign tiles vs. the toolbar.
				 */}
				<div className="flex min-w-0 flex-col gap-4">
					<MarketingDashboardToolbarPortal
						toolbarRegionRef={toolbarRegionRef}
						importLayoutInputRef={importLayoutInputRef}
						dashboardToolbarMountNode={dashboardToolbarMountNode}
						dashboardToolbarExpanded={dashboardToolbarExpanded}
						setDashboardToolbarExpanded={setDashboardToolbarExpanded}
						dashboardToolbarInHeader={dashboardToolbarInHeader}
						layoutSaveStatusPillRow={layoutSaveStatusPillRow}
						onExitToOverviewCards={onExitToOverviewCards}
						toolbarBusy={toolbarBusy}
						toolbarAwaitingPresets={toolbarAwaitingPresets}
						allowMarketingWrite={allowMarketingWrite}
						dashboardToolbarLayoutGroupLabelId={
							dashboardToolbarLayoutGroupLabelId
						}
						dashboardToolbarWidgetsGroupLabelId={
							dashboardToolbarWidgetsGroupLabelId
						}
						dashboardToolbarServiceGroupLabelId={
							dashboardToolbarServiceGroupLabelId
						}
						presetCategorySelectId={presetCategorySelectId}
						presetSearchInputId={presetSearchInputId}
						presetSelectId={presetSelectId}
						presetHintId={presetHintId}
						layoutTemplateSelectId={layoutTemplateSelectId}
						layoutTemplatesCaveatId={layoutTemplatesCaveatId}
						presetCategoryFilter={presetCategoryFilter}
						setPresetCategoryFilter={setPresetCategoryFilter}
						presetCategories={presetCategories}
						presetSearchQuery={presetSearchQuery}
						setPresetSearchQuery={setPresetSearchQuery}
						presetSelectValue={presetSelectValue}
						setPresetSelectValue={setPresetSelectValue}
						presetsFromApi={presetsFromApi}
						presetSelectOptions={presetSelectOptions}
						presets={presets}
						filteredPresets={filteredPresets}
						recentPresetQuickList={recentPresetQuickList}
						projectId={projectId}
						setPresetApplyDialog={setPresetApplyDialog}
						rebuildPresetFromTemplateMutation={
							rebuildPresetFromTemplateMutation
						}
						applyPresetMutation={applyPresetMutation}
						layoutTemplatesQuery={layoutTemplatesQuery}
						selectedLayoutTemplateId={selectedLayoutTemplateId}
						setSelectedLayoutTemplateId={setSelectedLayoutTemplateId}
						layoutTemplateSelectOptions={layoutTemplateSelectOptions}
						layoutTemplateRows={layoutTemplateRows}
						applyLayoutTemplateMutation={applyLayoutTemplateMutation}
						deleteLayoutTemplateMutation={deleteLayoutTemplateMutation}
						activeLayoutQuery={activeLayoutQuery}
						setSaveTemplateOpen={setSaveTemplateOpen}
						setSaveTemplateName={setSaveTemplateName}
						setSaveTemplateDescription={setSaveTemplateDescription}
						handleCreateBlankLayout={handleCreateBlankLayout}
						presetsQuery={presetsQuery}
						addWidgetSelectId={addWidgetSelectId}
						addWidgetSelectValue={addWidgetSelectValue}
						setAddWidgetSelectValue={setAddWidgetSelectValue}
						addWidgetSelectOptions={addWidgetSelectOptions}
						handleAddWidget={handleAddWidget}
						atWidgetCap={atWidgetCap}
						widgetLayoutCap={widgetLayoutCap}
						usageStatsQuery={usageStatsQuery}
						canUndoGridLayout={canUndoGridLayout}
						canRedoGridLayout={canRedoGridLayout}
						undoGridLayout={undoGridLayout}
						redoGridLayout={redoGridLayout}
						setShortcutsOpen={setShortcutsOpen}
						handleExportLayoutJson={handleExportLayoutJson}
						handleImportLayoutFileList={handleImportLayoutFileList}
						handlePasteWidgetFromClipboard={handlePasteWidgetFromClipboard}
						cleanupDuplicatesMutation={cleanupDuplicatesMutation}
						t={t}
						mcShellPanel={mcShellPanel}
					/>

					<MarketingDashboardPreGridChrome
						mcShellPanel={mcShellPanel}
						visibleWidgetsCount={visibleWidgets.length}
						allWidgets={allWidgets}
						hiddenWidgets={hiddenWidgets}
						allowMarketingWrite={allowMarketingWrite}
						patchWidgetPending={patchWidgetMutation.isPending}
						onShowHiddenWidget={(widgetId) =>
							patchWidgetMutation.mutate({
								widgetId,
								body: { is_visible: true },
							})
						}
						t={t}
					/>

					{/*
					 * A.7: сетка живёт внутри `MarketingCabinetContentFrame` (`px-4 sm:px-7`).
					 * Не добавлять здесь `-mx-*`: это сдвигает RGL относительно тулбара (см. комментарий выше у корня).
					 * Скролл: одна вертикальная ось — секция `contentScrollRef` в `MarketingCabinetContentFrame`
					 * (без отдельного max-h/overflow-y на обёртке сетки; см. MARKETING-CABINET.md).
					 */}
					<MarketingDashboardInteractiveGrid
						containerRef={containerRef}
						allowMarketingWrite={allowMarketingWrite}
						toolbarBusy={toolbarBusy}
						onGridCanvasContextMenu={
							allowMarketingWrite ? handleGridCanvasContextMenu : undefined
						}
						mounted={mounted}
						width={width}
						gridLayout={gridLayout}
						onLayoutChange={handleLayoutChange}
						visibleTileCount={visibleWidgets.length}
						allWidgetsCount={allWidgets.length}
						emptyWhenNoSizeSlot={
							<div className="min-h-50 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40" />
						}
						emptyWhenAllHiddenSlot={
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{t('overview.dashboard.toolbar.allHiddenHint')}
							</p>
						}
						emptyWhenNoWidgetsSlot={
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{t('overview.dashboard.toolbar.noWidgetsHint')}
							</p>
						}
					>
						{visibleWidgets.map((w, tileIndex) => (
							<MarketingDashboardTile
								key={w.id}
								widget={w}
								tileIndex={tileIndex}
								mcShellPanel={mcShellPanel}
								allowMarketingWrite={allowMarketingWrite}
								isProjectDashboardFetching={isProjectDashboardFetching}
								toolbarBusy={toolbarBusy}
								t={t}
								setGridContextMenu={setGridContextMenu}
								handleNudgeTileGrid={handleNudgeTileGrid}
								openRenameTileModal={openRenameTileModal}
								patchWidgetMutation={patchWidgetMutation}
								deleteWidgetMutation={deleteWidgetMutation}
								handleDuplicateWidget={handleDuplicateWidget}
								patchTileFullConfig={patchTileFullConfig}
								buildTileTitleHint={buildTileTitleHint}
								renderWidgetBody={(tile) => (
									<MemoDashboardWidgetBody
										widget={tile}
										dashboard={dashboard}
										onNavigate={onNavigate}
										projectId={projectId}
										allowMarketingWrite={allowMarketingWrite}
										extractApiErrorMessage={extractApiErrorMessage}
										refetchProjectDashboard={onRefetchProjectDashboard}
										isProjectDashboardFetching={isProjectDashboardFetching}
										onPersistWidgetConfig={
											allowMarketingWrite
												? async (config) => {
														await patchWidgetMutation.mutateAsync({
															widgetId: tile.id,
															body: { widget_config: config },
														});
													}
												: undefined
										}
									/>
								)}
							/>
						))}
					</MarketingDashboardInteractiveGrid>
				</div>
			</div>
			<MarketingDashboardPresetApplyDialogPortal
				presetApplyDialog={presetApplyDialog}
				presetApplyDiffPreview={presetApplyDiffPreview}
				presetApplyPanelRef={presetApplyPanelRef}
				presetApplyTitleId={presetApplyTitleId}
				presetApplyIntroId={presetApplyIntroId}
				presetApplyListId={presetApplyListId}
				presetApplyRemovedIntroId={presetApplyRemovedIntroId}
				presetApplyRemovedListId={presetApplyRemovedListId}
				onDismiss={() => {
					setPresetApplyDialog(null);
					setPresetSelectValue('');
				}}
				toolbarBusy={toolbarBusy}
				onConfirmApply={confirmApplyPresetFromDialog}
				t={t}
			/>
			<MarketingDashboardShortcutsDialogPortal
				shortcutsOpen={shortcutsOpen}
				shortcutsPanelRef={shortcutsPanelRef}
				shortcutsTitleId={shortcutsTitleId}
				shortcutsDescId={shortcutsDescId}
				onDismiss={() => setShortcutsOpen(false)}
				t={t}
			/>
			<MarketingDashboardRenameTileDialogPortal
				renameTarget={renameTarget}
				renameDraft={renameDraft}
				setRenameDraft={setRenameDraft}
				renamePanelRef={renamePanelRef}
				renameInputRef={renameInputRef}
				renameTitleId={renameTitleId}
				renameHintId={renameHintId}
				renameFieldId={renameFieldId}
				onDismiss={closeRenameModal}
				onSubmit={submitRenameTile}
				toolbarBusy={toolbarBusy}
				t={t}
			/>
			<MarketingDashboardSaveTemplateDialogPortal
				saveTemplateOpen={saveTemplateOpen}
				saveTemplatePanelRef={saveTemplatePanelRef}
				saveTemplateNameInputRef={saveTemplateNameInputRef}
				saveTemplateTitleId={saveTemplateTitleId}
				saveTemplateDialogDescId={saveTemplateDialogDescId}
				saveTemplateNameFieldId={saveTemplateNameFieldId}
				saveTemplateDescFieldId={saveTemplateDescFieldId}
				saveTemplateName={saveTemplateName}
				setSaveTemplateName={setSaveTemplateName}
				saveTemplateDescription={saveTemplateDescription}
				setSaveTemplateDescription={setSaveTemplateDescription}
				onDismiss={() => setSaveTemplateOpen(false)}
				onSubmit={submitSaveLayoutTemplate}
				toolbarBusy={toolbarBusy}
				t={t}
			/>
			<MarketingDashboardGridContextMenuPortal
				gridContextMenu={gridContextMenu}
				contextMenuRef={contextMenuRef}
				setGridContextMenu={setGridContextMenu}
				t={t}
				allowMarketingWrite={allowMarketingWrite}
				toolbarBusy={toolbarBusy}
				openRenameTileModal={openRenameTileModal}
				handleCopyWidgetClipboard={handleCopyWidgetClipboard}
				handleDuplicateWidget={handleDuplicateWidget}
				patchWidgetMutation={patchWidgetMutation}
				deleteWidgetMutation={deleteWidgetMutation}
				addWidgetSelectOptions={addWidgetSelectOptions}
				atWidgetCap={atWidgetCap}
				handleAddWidget={handleAddWidget}
				handlePasteWidgetFromClipboard={handlePasteWidgetFromClipboard}
			/>
		</>
	);
}
