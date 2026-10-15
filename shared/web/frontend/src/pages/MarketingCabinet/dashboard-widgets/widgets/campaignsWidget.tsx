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

import type { MarketingView } from '../../constants';
import {
	localizeCampaignChannel,
	localizePriority,
	localizeStatus,
} from '../../locales';
import type { MarketingProjectDashboard } from '../../marketingCabinetApi';
import {
	MC_OPS_CAMPAIGN_CHANNEL,
	MC_OPS_CAMPAIGN_PRIORITY,
	MC_OPS_CAMPAIGN_STATUS,
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

const DEFAULT_MAX_ITEMS = 3;
const MAX_ITEMS_CAP = 500;

export interface CampaignsWidgetLegacyProps {
	dashboard: MarketingProjectDashboard;
	onNavigate: (
		view: MarketingView,
		entityId?: string | null,
		extras?: import('../widgetBodyProps').MarketingCabinetNavigateExtras
	) => void;
}

export type CampaignsWidgetProps =
	| MarketingDashboardWidgetBodyProps
	| CampaignsWidgetLegacyProps;

function isFullBodyProps(
	p: CampaignsWidgetProps
): p is MarketingDashboardWidgetBodyProps {
	return 'widgetConfig' in p;
}

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

function CampaignsWidgetImpl(props: CampaignsWidgetProps): React.ReactElement {
	const { t: hookT, i18n } = useTranslation('marketing');
	const intlFmt = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
		return {
			formatInt: (n: number) => new Intl.NumberFormat(lang).format(n),
		};
	}, [i18n.resolvedLanguage, i18n.language]);
	const dashboard = props.dashboard;
	const onNavigate = props.onNavigate;
	const t = isFullBodyProps(props) ? props.t : hookT;
	const limit = isFullBodyProps(props)
		? listLimit(props.widgetConfig)
		: DEFAULT_MAX_ITEMS;
	const compact =
		isFullBodyProps(props) && props.widgetConfig.density === 'compact';
	const counts = dashboard.counts ?? { campaigns: 0 };
	const campaignsTotal = counts.campaigns ?? 0;
	const sliceMeta =
		isFullBodyProps(props) && props.widget?.id
			? dashboard.widget_list_slices?.[props.widget.id]
			: undefined;
	const sliceCampaigns = sliceMeta?.campaigns;
	const filteredListTotal = sliceMeta?.filtered_total;
	const recentCampaigns = sliceCampaigns ?? dashboard.campaigns ?? [];
	const rows = recentCampaigns.slice(0, limit);
	const projectIdForCsv = isFullBodyProps(props)
		? props.projectId
		: dashboard.project.id;

	const widgetConfig = isFullBodyProps(props) ? props.widgetConfig : null;
	const onPersistWidgetConfig = isFullBodyProps(props)
		? props.onPersistWidgetConfig
		: undefined;
	const allowMarketingWrite = isFullBodyProps(props)
		? props.allowMarketingWrite
		: true;
	const widget = isFullBodyProps(props) ? props.widget : null;

	const rawFilters = (widgetConfig?.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');
	const filterChannel = String(rawFilters.channel ?? '');
	const filterPriority = String(rawFilters.priority ?? '');

	const mergePersist = React.useCallback(
		(patch: MarketingWidgetConfig) => {
			if (!onPersistWidgetConfig || !widget) return;
			void onPersistWidgetConfig({
				...(widget.widget_config as MarketingWidgetConfig),
				...patch,
			});
		},
		[onPersistWidgetConfig, widget]
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

	const setFilterChannel = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.channel = next;
			else delete f.channel;
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
				const base = { ...(widget?.widget_config as Record<string, unknown>) };
				delete base.sort;
				mergePersist(base as MarketingWidgetConfig);
				return;
			}
			mergePersist({ sort: spec });
		},
		[mergePersist, widget?.widget_config]
	);

	const campaignStatusOptions = React.useMemo(
		() => [
			{ value: 'draft', label: t('campaignsView.status.draft') },
			{ value: 'active', label: t('campaignsView.status.active') },
			{ value: 'paused', label: t('campaignsView.status.paused') },
			{ value: 'completed', label: t('campaignsView.status.completed') },
		],
		[t]
	);

	const campaignChannelOptions = React.useMemo(
		() => [
			{ value: 'organic', label: t('campaignsView.channel.organic') },
			{ value: 'seo', label: t('campaignsView.channel.seo') },
			{ value: 'paid_search', label: t('campaignsView.channel.paid_search') },
			{ value: 'email', label: t('campaignsView.channel.email') },
			{ value: 'partner', label: t('campaignsView.channel.partner') },
			{ value: 'social', label: t('campaignsView.channel.social') },
		],
		[t]
	);

	const campaignPriorityOptions = React.useMemo(
		() => [
			{ value: 'low', label: t('campaignsView.priority.low') },
			{ value: 'medium', label: t('campaignsView.priority.medium') },
			{ value: 'high', label: t('campaignsView.priority.high') },
			{ value: 'urgent', label: t('campaignsView.priority.urgent') },
		],
		[t]
	);

	const statusFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...campaignStatusOptions,
		],
		[t, campaignStatusOptions]
	);

	const channelFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...campaignChannelOptions,
		],
		[t, campaignChannelOptions]
	);

	const priorityFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...campaignPriorityOptions,
		],
		[t, campaignPriorityOptions]
	);

	const sortOptions = React.useMemo(
		() => [
			{
				value: 'auto',
				label: t('overview.dashboard.listSort.campaignDefault'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{ value: 'name:asc', label: t('overview.dashboard.listSort.nameAsc') },
			{ value: 'status:asc', label: t('overview.dashboard.listSort.status') },
			{
				value: 'channel:asc',
				label: t('overview.dashboard.listSort.channelAsc'),
			},
			{
				value: 'priority:asc',
				label: t('overview.dashboard.listSort.priorityUrgentFirst'),
			},
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		if (!widgetConfig) return '';
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig, sortOptions, t]);

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.name'),
			t('overview.dashboard.csv.channel'),
			t('overview.dashboard.csv.status'),
			t('overview.dashboard.csv.priority'),
			t('overview.dashboard.csv.owner'),
			t('overview.dashboard.csv.updated'),
		];
		const data = rows.map((c) => [
			c.name,
			localizeCampaignChannel(c.channel),
			localizeStatus(c.status),
			localizePriority(c.priority),
			c.owner_name ?? '',
			c.updated_at ?? '',
		]);
		downloadDashboardListCsv(
			`marketing-campaigns-${projectIdForCsv.slice(0, 8)}.csv`,
			header,
			data
		);
	}, [projectIdForCsv, rows, t]);

	const showListTools = Boolean(
		allowMarketingWrite && onPersistWidgetConfig && widgetConfig
	);
	const hasCampaignFilters = Boolean(
		filterStatus || filterChannel || filterPriority
	);
	const campaignMatchNarrow =
		hasCampaignFilters &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== campaignsTotal;

	if (!isFullBodyProps(props)) {
		return (
			<div className="min-w-0 space-y-2">
				<div
					className={cn(
						'flex items-center justify-between gap-2',
						DASHBOARD_WIDGET_TOOLBAR_META_CLASS
					)}
				>
					<span>
						{t('overview.dashboard.widget.campaignsCount', {
							count: campaignsTotal,
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
							onClick={() => onNavigate('campaigns')}
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
				{rows.map((c) => (
					<div
						key={c.id}
						className="space-y-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2"
					>
						<div className="text-sm font-medium text-(--desktop-text-primary)">
							{c.name}
						</div>
						<div className={dashboardListItemMetaClass(compact)}>
							{localizeCampaignChannel(c.channel)} · {localizeStatus(c.status)}
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>
					{campaignMatchNarrow
						? t('overview.dashboard.widget.listMatchFiltered', {
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal),
								total: intlFmt.formatInt(campaignsTotal),
							})
						: t('overview.dashboard.widget.campaignsCount', {
								count: campaignsTotal,
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
							onNavigate('campaigns', null, {
								urlQuery: {
									[MC_OPS_CAMPAIGN_STATUS]: filterStatus || null,
									[MC_OPS_CAMPAIGN_CHANNEL]: filterChannel || null,
									[MC_OPS_CAMPAIGN_PRIORITY]: filterPriority || null,
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
									'overview.dashboard.listFilter.campaignStatusAria'
								)}
								options={statusFilterOptions}
								onChange={setFilterStatus}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterChannel}
								aria-label={t(
									'overview.dashboard.listFilter.campaignChannelAria'
								)}
								options={channelFilterOptions}
								onChange={setFilterChannel}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterPriority}
								aria-label={t(
									'overview.dashboard.listFilter.campaignPriorityAria'
								)}
								options={priorityFilterOptions}
								onChange={setFilterPriority}
							/>
						</div>
						<div className="min-w-44 flex-[1.2]">
							<MarketingCabinetSelect
								size="compact"
								value={sortSelectValue(widgetConfig?.sort)}
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
					{t('overview.dashboard.widget.campaignsListEmpty')}
				</p>
			) : (
				rows.map((c) => (
					<button
						key={c.id}
						type="button"
						onClick={() => onNavigate('campaigns', c.id)}
						className={cn(
							MC_DASHBOARD_NO_DRAG_CLASS,
							DESKTOP_INTERACTIVE.rowInteractive,
							'flex w-full min-w-0 flex-col gap-1 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-(--desktop-text-primary)',
							compact ? 'text-xs' : 'text-sm',
							DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE
						)}
					>
						<div className="font-medium leading-snug">{c.name}</div>
						<div className={dashboardListItemMetaClass(compact)}>
							{localizeCampaignChannel(c.channel)} · {localizeStatus(c.status)}{' '}
							· {localizePriority(c.priority)}
						</div>
					</button>
				))
			)}
		</div>
	);
}

export const CampaignsWidget = React.memo(CampaignsWidgetImpl);
