/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing dashboard widget that renders recent alerts with filters, actions, and optional virtualization.
 *
 * Invariants:
 * - Virtual mode measures row heights dynamically (`measureElement`) for stable scroll positioning.
 * - Row keys are bound to alert ids so list refresh does not reuse wrong virtual slots.
 *
 * Related:
 * - src/pages/MarketingCabinet/dashboard-widgets/widgets/tasksWidget.tsx
 */
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	MC_OPS_ALERT_SEVERITY,
	MC_OPS_ALERT_STATUS,
} from '../../operationsDeepLink';
import { localizeAlertSeverity, localizeStatus } from '../../locales';
import {
	marketingCabinetApi,
	type MarketingAlert,
} from '../../marketingCabinetApi';
import { downloadDashboardListCsv } from '../dashboardListCsv';
import {
	DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN,
	DASHBOARD_WIDGET_TOOLBAR_META_CLASS,
	dashboardListItemMetaClass,
} from '../desktopListTokens';
import {
	parseSortSelectValue,
	sortSelectValue,
} from '../dashboardWidgetListSort';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import type { MarketingWidgetConfig } from '../types';

import { DASHBOARD_LIST_VIRTUAL_THRESHOLD } from './dashboardListVirtualThreshold';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../../marketingCabinetQueryOptions';

function listLimit(
	widgetConfig: MarketingDashboardWidgetBodyProps['widgetConfig']
): number {
	const raw = widgetConfig.maxItems;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const n = Math.trunc(raw);
		if (n >= 1) {
			return Math.min(n, 500);
		}
	}
	return 4;
}

function AlertsWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const {
		dashboard,
		widget,
		widgetConfig,
		onNavigate,
		allowMarketingWrite,
		projectId,
		t,
		onPersistWidgetConfig,
	} = props;
	const { i18n } = useTranslation();
	const intlFmt = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
		return {
			formatInt: (n: number) => new Intl.NumberFormat(lang).format(n),
			formatDateTime: (iso: string | null | undefined) => {
				if (!iso) return null;
				const ms = Date.parse(iso);
				if (!Number.isFinite(ms)) return null;
				return new Intl.DateTimeFormat(lang, {
					dateStyle: 'short',
					timeStyle: 'short',
				}).format(ms);
			},
		};
	}, [i18n.resolvedLanguage, i18n.language]);
	const queryClient = useQueryClient();
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceAlerts = sliceMeta?.alerts;
	const filteredListTotal = sliceMeta?.filtered_total;
	const recentAlerts = sliceAlerts ?? dashboard.alerts ?? [];
	const alertsTotalCount = (dashboard.alerts ?? []).length;
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';

	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');
	const filterSeverity = String(rawFilters.severity ?? '');

	/** E.55: prefer server `alerts_open_count`; if absent, mirror bundle slice filters so open count matches filtered set. */
	const openAlerts = React.useMemo(() => {
		if (typeof sliceMeta?.alerts_open_count === 'number') {
			return sliceMeta.alerts_open_count;
		}
		const pool = dashboard.alerts ?? [];
		const matching = pool.filter((a) => {
			const st = String(a.status || '').toLowerCase();
			const sev = String(a.severity || '').toLowerCase();
			if (filterStatus && st !== filterStatus.toLowerCase()) return false;
			if (filterSeverity && sev !== filterSeverity.toLowerCase()) return false;
			return true;
		});
		return matching.filter(
			(a) => String(a.status || '').toLowerCase() === 'open'
		).length;
	}, [
		sliceMeta?.alerts_open_count,
		dashboard.alerts,
		filterStatus,
		filterSeverity,
	]);

	const mergePersist = React.useCallback(
		(patch: MarketingWidgetConfig) => {
			if (!onPersistWidgetConfig) return;
			void onPersistWidgetConfig({
				...(widget.widget_config as MarketingWidgetConfig),
				...patch,
			});
		},
		[onPersistWidgetConfig, widget.widget_config]
	);

	const setFilterStatus = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.status = next;
			else delete f.status;
			mergePersist({ filters: f });
		},
		[mergePersist, rawFilters]
	);

	const setFilterSeverity = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.severity = next;
			else delete f.severity;
			mergePersist({ filters: f });
		},
		[mergePersist, rawFilters]
	);

	const setSortValue = React.useCallback(
		(v: string) => {
			const spec = parseSortSelectValue(v);
			if (spec === undefined) {
				const base = { ...(widget.widget_config as Record<string, unknown>) };
				delete base.sort;
				mergePersist(base as MarketingWidgetConfig);
				return;
			}
			mergePersist({ sort: spec });
		},
		[mergePersist, widget.widget_config]
	);

	const alertStatusOptions = React.useMemo(
		() => [
			{ value: 'open', label: t('operationsView.alerts.status.open') },
			{
				value: 'acknowledged',
				label: t('operationsView.alerts.status.acknowledged'),
			},
			{ value: 'resolved', label: t('operationsView.alerts.status.resolved') },
		],
		[t]
	);

	const alertStatusFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...alertStatusOptions,
		],
		[t, alertStatusOptions]
	);

	const alertSeverityOptions = React.useMemo(
		() => [
			{ value: 'low', label: t('operationsView.alerts.severity.low') },
			{ value: 'medium', label: t('operationsView.alerts.severity.medium') },
			{ value: 'high', label: t('operationsView.alerts.severity.high') },
			{
				value: 'critical',
				label: t('operationsView.alerts.severity.critical'),
			},
		],
		[t]
	);

	const alertSeverityFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...alertSeverityOptions,
		],
		[t, alertSeverityOptions]
	);

	const sortOptions = React.useMemo(
		() => [
			{ value: 'auto', label: t('overview.dashboard.listSort.alertDefault') },
			{
				value: 'severity:asc',
				label: t('overview.dashboard.listSort.severityCriticalFirst'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{
				value: 'created_at:desc',
				label: t('overview.dashboard.listSort.createdDesc'),
			},
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewAlertDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig.sort, sortOptions, t]);

	const invalidateAlertsQueries = React.useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: marketingCabinetProjectDashboardInvalidationQueryKey(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
				'alerts',
				projectId
			),
		});
	}, [projectId, queryClient]);

	const patchAlertMutation = useMutation({
		mutationFn: ({ alertId, status }: { alertId: string; status: string }) =>
			marketingCabinetApi.updateAlert(alertId, { status }),
		onSuccess: invalidateAlertsQueries,
	});

	const deleteAlertMutation = useMutation({
		mutationFn: (alertId: string) => marketingCabinetApi.deleteAlert(alertId),
		onSuccess: invalidateAlertsQueries,
	});

	const [alertToDelete, setAlertToDelete] =
		React.useState<MarketingAlert | null>(null);

	const confirmDeleteAlert = React.useCallback(async () => {
		if (!alertToDelete) return;
		try {
			await deleteAlertMutation.mutateAsync(alertToDelete.id);
		} finally {
			setAlertToDelete(null);
		}
	}, [alertToDelete, deleteAlertMutation]);

	const rows = recentAlerts.slice(0, limit);
	const listParentRef = React.useRef<HTMLDivElement>(null);
	const rowHeight = compact ? 80 : 110;
	const useVirtualList = rows.length >= DASHBOARD_LIST_VIRTUAL_THRESHOLD;

	const rowVirtualizer = useVirtualizer({
		count: useVirtualList ? rows.length : 0,
		getScrollElement: () => listParentRef.current,
		estimateSize: () => rowHeight,
		getItemKey: (index) => rows[index]?.id ?? index,
		overscan: 6,
	});

	const bulkAckMutation = useMutation({
		mutationFn: async () => {
			for (const a of rows) {
				const st = String(a.status || '').toLowerCase();
				if (st === 'acknowledged' || st === 'resolved') continue;
				await marketingCabinetApi.updateAlert(a.id, { status: 'acknowledged' });
			}
		},
		onSuccess: invalidateAlertsQueries,
	});

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.title'),
			t('overview.dashboard.csv.severity'),
			t('overview.dashboard.csv.status'),
		];
		const data = rows.map((a) => [
			a.title,
			localizeAlertSeverity(a.severity),
			localizeStatus(a.status),
		]);
		downloadDashboardListCsv(
			`marketing-alerts-${projectId.slice(0, 8)}.csv`,
			header,
			data
		);
	}, [projectId, rows, t]);

	const renderAlertRow = (a: (typeof rows)[number]) => {
		const statusVal = a.status || 'open';
		const deletingThis =
			deleteAlertMutation.isPending && deleteAlertMutation.variables === a.id;
		const patchingThis =
			patchAlertMutation.isPending &&
			patchAlertMutation.variables?.alertId === a.id;
		return (
			<div
				className={cn(
					'rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/40 px-2.5 py-2 text-(--desktop-text-primary)',
					rowText,
					DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<div className="font-medium leading-snug">{a.title}</div>
						<div className={cn('mt-0.5', dashboardListItemMetaClass(compact))}>
							{localizeAlertSeverity(a.severity)} · {localizeStatus(a.status)}
						</div>
						{!compact && intlFmt.formatDateTime(a.updated_at) ? (
							<div
								className={cn('mt-0.5', dashboardListItemMetaClass(compact))}
							>
								<time dateTime={a.updated_at ?? undefined}>
									{t('overview.dashboard.widget.listRowUpdated', {
										date: intlFmt.formatDateTime(a.updated_at),
									})}
								</time>
							</div>
						) : null}
					</div>
					{allowMarketingWrite ? (
						<div
							className={cn(
								'flex shrink-0 items-center gap-1',
								MC_DASHBOARD_NO_DRAG_CLASS
							)}
						>
							<MarketingCabinetSelect
								size="compact"
								className={cn('max-w-38 shrink-0', MC_DASHBOARD_NO_DRAG_CLASS)}
								value={statusVal}
								disabled={patchingThis || deletingThis}
								options={alertStatusOptions}
								aria-label={t(
									'overview.dashboard.widget.alertsChangeStatusAria',
									{
										title: a.title,
									}
								)}
								onChange={(next) => {
									if (next === statusVal) return;
									patchAlertMutation.mutate({ alertId: a.id, status: next });
								}}
							/>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className={cn(
									'h-11 w-11 min-h-11 min-w-11',
									MC_DASHBOARD_NO_DRAG_CLASS
								)}
								disabled={deletingThis || patchingThis}
								aria-label={t('overview.dashboard.widget.alertsDeleteAria', {
									title: a.title,
								})}
								onClick={() => setAlertToDelete(a)}
							>
								{deletingThis ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<TrashIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
							</DesktopAppButton>
						</div>
					) : null}
				</div>
			</div>
		);
	};

	const showListTools = allowMarketingWrite && onPersistWidgetConfig;
	const hasAlertFilters = Boolean(filterStatus || filterSeverity);
	const alertMatchNarrow =
		hasAlertFilters &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== alertsTotalCount;

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>
					{alertMatchNarrow
						? t('overview.dashboard.widget.alertsOpenAndMatching', {
								open: intlFmt.formatInt(openAlerts),
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal),
								total: intlFmt.formatInt(alertsTotalCount),
							})
						: t('overview.dashboard.widget.openAlerts', {
								count: intlFmt.formatInt(openAlerts),
							})}
				</span>
				<div
					className={cn(
						'flex flex-wrap items-center gap-1',
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					{rows.length > 0 ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1"
							onClick={exportCsv}
						>
							<ArrowDownTrayIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('overview.dashboard.listExportCsv')}
						</DesktopAppButton>
					) : null}
					{allowMarketingWrite && rows.length > 0 ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							disabled={bulkAckMutation.isPending}
							onClick={() => {
								if (
									!window.confirm(
										t('overview.dashboard.widget.alertsBulkAckConfirm', {
											count: intlFmt.formatInt(rows.length),
										})
									)
								) {
									return;
								}
								bulkAckMutation.mutate();
							}}
						>
							{bulkAckMutation.isPending ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 motion-safe:animate-spin"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{t('overview.dashboard.widget.alertsBulkAck')}
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className={MC_DASHBOARD_NO_DRAG_CLASS}
						onClick={() =>
							onNavigate('alerts', null, {
								urlQuery: {
									[MC_OPS_ALERT_STATUS]: filterStatus || null,
									[MC_OPS_ALERT_SEVERITY]: filterSeverity || null,
								},
							})
						}
					>
						{t('overview.openAction')}
						<ArrowRightIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
				</div>
			</div>
			{showListTools ? (
				<div
					className={cn(
						'flex flex-col gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/30 p-2',
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					<div className="flex flex-wrap gap-2">
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterStatus}
								aria-label={t('overview.dashboard.listFilter.alertStatusAria')}
								options={alertStatusFilterOptions}
								onChange={setFilterStatus}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterSeverity}
								aria-label={t(
									'overview.dashboard.listFilter.alertSeverityAria'
								)}
								options={alertSeverityFilterOptions}
								onChange={setFilterSeverity}
							/>
						</div>
						<div className="min-w-44 flex-[1.2]">
							<MarketingCabinetSelect
								size="compact"
								value={sortSelectValue(widgetConfig.sort)}
								aria-label={t('overview.dashboard.listSort.aria')}
								options={sortOptions}
								onChange={setSortValue}
							/>
						</div>
					</div>
					<p className={cn('m-0', DESKTOP_TYPOGRAPHY.caption)}>{sortPreview}</p>
				</div>
			) : null}
			{rows.length === 0 ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						MC_DASHBOARD_NO_DRAG_CLASS,
						'm-0 px-0.5'
					)}
				>
					{t('overview.dashboard.widget.alertsListEmpty')}
				</p>
			) : useVirtualList ? (
				<div
					ref={listParentRef}
					className="max-h-[min(55vh,640px)] min-h-0 overflow-y-auto pr-0.5"
					data-mc-dashboard-alerts-list
				>
					<div
						className="relative w-full"
						style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
					>
						{rowVirtualizer.getVirtualItems().map((vi) => {
							const a = rows[vi.index];
							return (
								<div
									key={vi.key}
									data-index={vi.index}
									ref={rowVirtualizer.measureElement}
									className="absolute top-0 left-0 w-full pb-2"
									style={{ transform: `translateY(${vi.start}px)` }}
								>
									{renderAlertRow(a)}
								</div>
							);
						})}
					</div>
				</div>
			) : (
				<div className="min-w-0 space-y-2">
					{rows.map((a) => renderAlertRow(a))}
				</div>
			)}

			<ConfirmDeleteModal
				isOpen={alertToDelete !== null}
				onClose={() => setAlertToDelete(null)}
				onConfirm={confirmDeleteAlert}
				title={t('overview.dashboard.widget.alertsDeleteModalTitle')}
				warningMessage={
					alertToDelete
						? t('overview.dashboard.widget.alertsDeleteModalBody', {
								title: alertToDelete.title,
							})
						: ''
				}
				confirmButtonLabel={t(
					'overview.dashboard.widget.alertsDeleteModalConfirm'
				)}
				confirmButtonLoadingLabel={t(
					'overview.dashboard.widget.alertsDeleteModalDeleting'
				)}
				cancelButtonLabel={t('common.cancel')}
			/>
		</div>
	);
}

export const AlertsWidget = React.memo(AlertsWidgetImpl);
