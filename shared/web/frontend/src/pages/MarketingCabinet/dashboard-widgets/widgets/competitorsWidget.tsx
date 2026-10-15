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

import { localizeCompetitorType } from '../../locales';
import { MC_OPS_COMPETITOR_TYPE } from '../../operationsDeepLink';
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

const COMPETITOR_TYPES = [
	'direct',
	'indirect',
	'adjacent',
	'replacement',
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

function CompetitorsWidgetImpl(
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
	const compTotal = counts.competitors ?? 0;
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceComp = sliceMeta?.competitors;
	const filteredListTotal = sliceMeta?.filtered_total;
	const competitors = sliceComp ?? dashboard.competitors ?? [];
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';
	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterType = String(rawFilters.competitor_type ?? '');

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

	const setFilterType = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.competitor_type = next;
			else delete f.competitor_type;
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

	const typeFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...COMPETITOR_TYPES.map((value) => ({
				value,
				label: t(`enums.competitorType.${value}`),
			})),
		],
		[t]
	);

	const sortOptions = React.useMemo(
		() => [
			{
				value: 'auto',
				label: t('overview.dashboard.listSort.competitorsDefault'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{
				value: 'name:asc',
				label: t('overview.dashboard.listSort.competitorsNameAsc'),
			},
			{
				value: 'competitor_type:asc',
				label: t('overview.dashboard.listSort.competitorsTypeAsc'),
			},
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const spec = widgetConfig.sort;
		const raw = sortSelectValue(spec);
		const opt = sortOptions.find((o) => o.value === raw);
		const label =
			opt?.label ?? t('overview.dashboard.listSort.competitorsDefault');
		return t('overview.dashboard.listSort.preview', { label });
	}, [sortOptions, t, widgetConfig.sort]);

	const rows = React.useMemo(
		() => competitors.slice(0, limit),
		[competitors, limit]
	);
	const matchNarrow =
		typeof filteredListTotal === 'number' && filteredListTotal < compTotal;
	const showListTools = allowMarketingWrite !== false;

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.name'),
			t('overview.dashboard.csv.competitorType'),
			t('overview.dashboard.csv.marketPosition'),
			t('overview.dashboard.csv.updated'),
		];
		const data = rows.map((r) => [
			r.name || '—',
			localizeCompetitorType(r.competitor_type),
			r.market_position || '',
			r.updated_at ?? '',
		]);
		downloadDashboardListCsv(
			`marketing-competitors-dashboard-${projectId.slice(0, 8)}.csv`,
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
								total: intlFmt.formatInt(compTotal),
							})
						: t('overview.dashboard.widget.competitorsCount', {
								count: compTotal,
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
							onNavigate('analysis', null, {
								urlQuery: {
									[MC_OPS_COMPETITOR_TYPE]: filterType || null,
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
								value={filterType}
								aria-label={t(
									'overview.dashboard.listFilter.competitorTypeAria'
								)}
								options={typeFilterOptions}
								onChange={setFilterType}
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
					{t('overview.dashboard.widget.competitorsListEmpty')}
				</p>
			) : (
				rows.map((r) => (
					<button
						key={r.id}
						type="button"
						onClick={() => onNavigate('analysis', r.id)}
						className={cn(
							MC_DASHBOARD_NO_DRAG_CLASS,
							DESKTOP_INTERACTIVE.rowInteractive,
							'flex w-full min-w-0 flex-col gap-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-(--desktop-text-primary) hover:border-(--desktop-border-strong) focus:outline-none',
							rowText,
							DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE
						)}
					>
						<div className="line-clamp-2 font-medium leading-snug">
							{r.name}
						</div>
						<div className={cn('mt-0.5', dashboardListItemMetaClass(compact))}>
							{localizeCompetitorType(r.competitor_type)}
							{r.market_position ? ` · ${r.market_position}` : ''}
						</div>
					</button>
				))
			)}
		</div>
	);
}

export const CompetitorsWidget = React.memo(CompetitorsWidgetImpl);
