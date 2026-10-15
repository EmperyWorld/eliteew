import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import type { ImcResearchRunSummary } from '@/types/imc';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	parseSortSelectValue,
	sortSelectValue,
} from '../dashboardWidgetListSort';
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

const IMC_STATUS_VALUES = [
	'pending',
	'running',
	'completed',
	'failed',
	'cancelled',
	'partial',
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

function localizeImcStatus(
	t: MarketingDashboardWidgetBodyProps['t'],
	status: string | undefined
): string {
	const s = String(status || '').toLowerCase();
	if (!s) return '';
	const k = `imcView.runStatus.${s}` as const;
	const out = t(k);
	return out === k ? status || '' : out;
}

/** E.56: human-readable research type; unknown keys stay as the server key. */
function localizeImcTypeKey(
	t: MarketingDashboardWidgetBodyProps['t'],
	typeKey: string | undefined
): string {
	const k = String(typeKey || '').trim();
	if (!k) return '';
	const i18nKey = `imcView.researchType.${k}` as const;
	return t(i18nKey, { defaultValue: k });
}

function ImcRecentWidgetImpl(
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
		refetchProjectDashboard,
	} = props;
	const { i18n } = useTranslation();
	const intlFmt = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
		return {
			formatInt: (n: number) => new Intl.NumberFormat(lang).format(n),
		};
	}, [i18n.resolvedLanguage, i18n.language]);
	const bundleRuns = dashboard.imc_research_runs ?? [];
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceRuns = sliceMeta?.imc_research_runs;
	const filteredListTotal = sliceMeta?.filtered_total;
	const recentRuns = sliceRuns ?? bundleRuns;
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';

	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');
	const filterTypeKey = String(rawFilters.type_key ?? '');

	const typeKeyOptions = React.useMemo(() => {
		const keys = new Set<string>();
		for (const r of bundleRuns) {
			const k = (r.type_key || '').trim();
			if (k) keys.add(k);
		}
		for (const r of recentRuns) {
			const k = (r.type_key || '').trim();
			if (k) keys.add(k);
		}
		const sorted = [...keys].sort((a, b) => a.localeCompare(b));
		return sorted.map((value) => ({
			value,
			label: localizeImcTypeKey(t, value),
		}));
	}, [bundleRuns, recentRuns, t]);

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

	const setFilterTypeKey = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.type_key = next;
			else delete f.type_key;
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
			...IMC_STATUS_VALUES.map((value) => ({
				value,
				label: localizeImcStatus(t, value),
			})),
		],
		[t]
	);

	const typeFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...typeKeyOptions,
		],
		[t, typeKeyOptions]
	);

	const sortOptions = React.useMemo(
		() => [
			{ value: 'auto', label: t('overview.dashboard.listSort.imcDefault') },
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{
				value: 'created_at:desc',
				label: t('overview.dashboard.listSort.createdDesc'),
			},
			{
				value: 'display_name:asc',
				label: t('overview.dashboard.listSort.displayNameAsc'),
			},
			{
				value: 'type_key:asc',
				label: t('overview.dashboard.listSort.imcTypeKeyAsc'),
			},
			{ value: 'status:asc', label: t('overview.dashboard.listSort.status') },
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewImcDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig.sort, sortOptions, t]);

	const rows = recentRuns.slice(0, limit);
	const showListTools = Boolean(allowMarketingWrite && onPersistWidgetConfig);
	const hasImcFilters = Boolean(filterStatus || filterTypeKey);
	const runsTotal = bundleRuns.length;
	const imcMatchNarrow =
		hasImcFilters &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== runsTotal;

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>
					{imcMatchNarrow
						? t('overview.dashboard.widget.listMatchFiltered', {
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal ?? 0),
								total: intlFmt.formatInt(runsTotal),
							})
						: t('overview.dashboard.widget.imcRecentCount', {
								count: runsTotal,
							})}
				</span>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={MC_DASHBOARD_NO_DRAG_CLASS}
					onClick={() => onNavigate('imc')}
				>
					{t('overview.openAction')}
					<ArrowRightIcon
						className="h-3.5 w-3.5"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</DesktopAppButton>
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
								aria-label={t('overview.dashboard.listFilter.imcStatusAria')}
								options={statusFilterOptions}
								onChange={setFilterStatus}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterTypeKey}
								aria-label={t('overview.dashboard.listFilter.imcTypeKeyAria')}
								options={typeFilterOptions}
								onChange={setFilterTypeKey}
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
				<div
					className={cn(
						'space-y-2 px-0.5',
						DESKTOP_TYPOGRAPHY.meta,
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					<p className="m-0" role="status">
						{t('overview.dashboard.widget.imcRecentListEmpty')}
					</p>
					{refetchProjectDashboard ? (
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className={MC_DASHBOARD_NO_DRAG_CLASS}
							onClick={() => void refetchProjectDashboard()}
						>
							{t('overview.dashboard.chart.retryLoad')}
						</DesktopAppButton>
					) : null}
				</div>
			) : (
				rows.map((r: ImcResearchRunSummary) => (
					<button
						key={r.id}
						type="button"
						onClick={() => onNavigate('imc', r.id)}
						className={cn(
							MC_DASHBOARD_NO_DRAG_CLASS,
							DESKTOP_INTERACTIVE.rowInteractive,
							'flex w-full min-w-0 flex-col gap-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-(--desktop-text-primary) hover:border-(--desktop-border-strong) focus:outline-none',
							rowText,
							DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE
						)}
					>
						<div className="font-medium leading-snug">{r.display_name}</div>
						<div className={cn('mt-0.5', dashboardListItemMetaClass(compact))}>
							{localizeImcTypeKey(t, r.type_key)} ·{' '}
							{localizeImcStatus(t, r.status)}
							{r.started_by_label ? (
								<>
									{' '}
									· {t('imcView.startedBy')}: {r.started_by_label}
								</>
							) : null}
						</div>
					</button>
				))
			)}
		</div>
	);
}

export const ImcRecentWidget = React.memo(ImcRecentWidgetImpl);
