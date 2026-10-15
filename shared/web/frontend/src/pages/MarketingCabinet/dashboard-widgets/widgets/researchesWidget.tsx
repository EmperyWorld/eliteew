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

import {
	localizePriority,
	localizeResearchTypeSafe,
	localizeStatus,
} from '../../locales';
import {
	MC_OPS_RESEARCH_PRIORITY,
	MC_OPS_RESEARCH_STATUS,
	MC_OPS_RESEARCH_TYPE,
} from '../../operationsDeepLink';
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

function ResearchesWidgetImpl(
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
	const researchesCount = counts.researches ?? 0;
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceResearches = sliceMeta?.researches;
	const filteredListTotal = sliceMeta?.filtered_total;
	const researches = sliceResearches ?? dashboard.recent_researches ?? [];
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';

	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');
	const filterResearchType = String(rawFilters.research_type ?? '');
	const filterPriority = String(rawFilters.priority ?? '');

	const researchTypeOptions = React.useMemo(() => {
		const keys = new Set<string>();
		for (const r of dashboard.researches ?? []) {
			const k = (r.research_type || '').trim();
			if (k) keys.add(k);
		}
		for (const r of researches) {
			const k = (r.research_type || '').trim();
			if (k) keys.add(k);
		}
		const sorted = [...keys].sort((a, b) => a.localeCompare(b));
		return sorted.map((value) => ({
			value,
			label: localizeResearchTypeSafe(value),
		}));
	}, [dashboard.researches, researches]);

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

	const setFilterResearchType = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.research_type = next;
			else delete f.research_type;
			mergePersist({ filters: f });
		},
		[mergePersist, rawFilters]
	);

	const setFilterPriority = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.priority = next;
			else delete f.priority;
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
			{ value: 'draft', label: t('enums.status.draft') },
			{ value: 'queued', label: t('enums.status.queued') },
			{ value: 'processing', label: t('enums.status.processing') },
			{ value: 'completed', label: t('enums.status.completed') },
			{ value: 'failed', label: t('enums.status.failed') },
			{ value: 'cancelled', label: t('enums.status.cancelled') },
		],
		[t]
	);

	const priorityFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			{ value: 'low', label: t('enums.priority.low') },
			{ value: 'normal', label: t('enums.priority.normal') },
			{ value: 'medium', label: t('enums.priority.medium') },
			{ value: 'high', label: t('enums.priority.high') },
			{ value: 'urgent', label: t('enums.priority.urgent') },
		],
		[t]
	);

	const typeFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...researchTypeOptions,
		],
		[t, researchTypeOptions]
	);

	const sortOptions = React.useMemo(
		() => [
			{
				value: 'auto',
				label: t('overview.dashboard.listSort.researchDefault'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{ value: 'title:asc', label: t('overview.dashboard.listSort.titleAsc') },
			{
				value: 'research_type:asc',
				label: t('overview.dashboard.listSort.researchTypeAsc'),
			},
			{ value: 'status:asc', label: t('overview.dashboard.listSort.status') },
			{
				value: 'priority:asc',
				label: t('overview.dashboard.listSort.priorityUrgentFirst'),
			},
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewResearchDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig.sort, sortOptions, t]);

	const rows = researches.slice(0, limit);
	const showListTools = Boolean(allowMarketingWrite && onPersistWidgetConfig);
	const hasResearchFilters = Boolean(
		filterStatus || filterResearchType || filterPriority
	);
	const researchMatchNarrow =
		hasResearchFilters &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== researchesCount;

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.title'),
			t('overview.dashboard.csv.researchType'),
			t('overview.dashboard.csv.status'),
			t('overview.dashboard.csv.priority'),
			t('overview.dashboard.csv.updated'),
		];
		const data = rows.map((r) => [
			r.title ?? '',
			localizeResearchTypeSafe(r.research_type) ?? '',
			localizeStatus(r.status) ?? '',
			localizePriority(r.priority) ?? '',
			r.updated_at ?? '',
		]);
		downloadDashboardListCsv(
			`marketing-researches-${projectId.slice(0, 8)}.csv`,
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
					{researchMatchNarrow
						? t('overview.dashboard.widget.listMatchFiltered', {
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal),
								total: intlFmt.formatInt(researchesCount),
							})
						: t('overview.dashboard.widget.researchesCount', {
								count: researchesCount,
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
							onNavigate('evidence', null, {
								urlQuery: {
									[MC_OPS_RESEARCH_STATUS]: filterStatus || null,
									[MC_OPS_RESEARCH_TYPE]: filterResearchType || null,
									[MC_OPS_RESEARCH_PRIORITY]: filterPriority || null,
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
									'overview.dashboard.listFilter.researchStatusAria'
								)}
								options={statusFilterOptions}
								onChange={setFilterStatus}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterResearchType}
								aria-label={t('overview.dashboard.listFilter.researchTypeAria')}
								options={typeFilterOptions}
								onChange={setFilterResearchType}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterPriority}
								aria-label={t(
									'overview.dashboard.listFilter.researchPriorityAria'
								)}
								options={priorityFilterOptions}
								onChange={setFilterPriority}
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
					{t('overview.dashboard.widget.researchesListEmpty')}
				</p>
			) : (
				rows.map((r) => (
					<button
						key={r.id}
						type="button"
						onClick={() => onNavigate('evidence', r.id)}
						className={cn(
							MC_DASHBOARD_NO_DRAG_CLASS,
							DESKTOP_INTERACTIVE.rowInteractive,
							'flex w-full min-w-0 flex-col gap-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-(--desktop-text-primary) hover:border-(--desktop-border-strong) focus:outline-none',
							rowText,
							DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE
						)}
					>
						<div className="font-medium leading-snug">{r.title}</div>
						<div className={cn('mt-0.5', dashboardListItemMetaClass(compact))}>
							{localizeResearchTypeSafe(r.research_type)} ·{' '}
							{localizePriority(r.priority)} · {localizeStatus(r.status)}
						</div>
					</button>
				))
			)}
		</div>
	);
}

export const ResearchesWidget = React.memo(ResearchesWidgetImpl);
