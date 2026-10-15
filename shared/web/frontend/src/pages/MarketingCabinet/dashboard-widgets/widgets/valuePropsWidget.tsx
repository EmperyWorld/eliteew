import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { ArrowDownTrayIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { localizeStatus } from '../../locales';
import { MC_OPS_VALUE_PROP_STATUS } from '../../operationsDeepLink';
import {
	parseSortSelectValue,
	sortSelectValue,
} from '../dashboardWidgetListSort';
import { downloadDashboardListCsv } from '../dashboardListCsv';
import {
	DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE,
	DASHBOARD_WIDGET_TOOLBAR_META_CLASS,
	dashboardListItemMetaClass,
} from '../desktopListTokens';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import type { MarketingWidgetConfig } from '../types';

const DEFAULT_MAX_ITEMS = 4;
const MAX_ITEMS_CAP = 500;

const VP_STATUSES = [
	'draft',
	'testing',
	'active',
	'paused',
	'archived',
] as const;

function listLimit(
	widgetConfig: MarketingDashboardWidgetBodyProps['widgetConfig']
): number {
	const raw = widgetConfig.maxItems;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const n = Math.trunc(raw);
		if (n >= 1) {
			return Math.min(n, MAX_ITEMS_CAP);
		}
	}
	return DEFAULT_MAX_ITEMS;
}

function ValuePropsWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const {
		dashboard,
		widget,
		widgetConfig,
		onNavigate,
		t,
		allowMarketingWrite,
		onPersistWidgetConfig,
		projectId,
	} = props;
	const { i18n } = useTranslation();
	const intlFmt = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
		return {
			formatInt: (n: number) => new Intl.NumberFormat(lang).format(n),
		};
	}, [i18n.resolvedLanguage, i18n.language]);

	const counts = dashboard.counts ?? {};
	const vpTotal = counts.value_propositions ?? 0;
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceVp = sliceMeta?.value_propositions;
	const filteredListTotal = sliceMeta?.filtered_total;
	const valueProps = sliceVp ?? dashboard.value_propositions ?? [];
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';
	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');

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

	const statusFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...VP_STATUSES.map((value) => ({
				value,
				label: t(`enums.status.${value}`),
			})),
		],
		[t]
	);

	const sortOptions = React.useMemo(
		() => [
			{
				value: 'auto',
				label: t('overview.dashboard.listSort.valuePropsDefault'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{
				value: 'headline:asc',
				label: t('overview.dashboard.listSort.valuePropsHeadlineAsc'),
			},
			{ value: 'status:asc', label: t('overview.dashboard.listSort.status') },
			{
				value: 'quality_score:desc',
				label: t('overview.dashboard.listSort.valuePropsQualityDesc'),
			},
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewValuePropsDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig.sort, sortOptions, t]);

	const rows = valueProps.slice(0, limit);
	const showListTools = Boolean(allowMarketingWrite && onPersistWidgetConfig);
	const hasStatusFilter = Boolean(filterStatus);
	const matchNarrow =
		hasStatusFilter &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== vpTotal;

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.headline'),
			t('overview.dashboard.csv.status'),
			t('overview.dashboard.csv.updated'),
		];
		const data = rows.map((r) => [
			r.headline || r.value_statement || '—',
			localizeStatus(r.status),
			r.updated_at ?? '',
		]);
		downloadDashboardListCsv(
			`marketing-value-props-dashboard-${projectId.slice(0, 8)}.csv`,
			header,
			data
		);
	}, [projectId, rows, t]);

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>
					{matchNarrow
						? t('overview.dashboard.widget.listMatchFiltered', {
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal),
								total: intlFmt.formatInt(vpTotal),
							})
						: t('overview.dashboard.widget.valuePropsCount', {
								count: vpTotal,
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
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() =>
							onNavigate('value', null, {
								urlQuery: {
									[MC_OPS_VALUE_PROP_STATUS]: filterStatus || null,
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
								aria-label={t(
									'overview.dashboard.listFilter.valuePropStatusAria'
								)}
								options={statusFilterOptions}
								onChange={setFilterStatus}
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
					{t('overview.dashboard.widget.valuePropsListEmpty')}
				</p>
			) : (
				rows.map((r) => (
					<button
						key={r.id}
						type="button"
						onClick={() => onNavigate('value', r.id)}
						className={cn(
							MC_DASHBOARD_NO_DRAG_CLASS,
							DESKTOP_INTERACTIVE.rowInteractive,
							'flex w-full min-w-0 flex-col gap-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-(--desktop-text-primary) hover:border-(--desktop-border-strong) focus:outline-none',
							rowText,
							DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE
						)}
					>
						<div className="line-clamp-2 font-medium leading-snug">
							{r.headline || r.value_statement || '—'}
						</div>
						<div className={cn('mt-0.5', dashboardListItemMetaClass(compact))}>
							{localizeStatus(r.status)}
						</div>
					</button>
				))
			)}
		</div>
	);
}

export const ValuePropsWidget = React.memo(ValuePropsWidgetImpl);
