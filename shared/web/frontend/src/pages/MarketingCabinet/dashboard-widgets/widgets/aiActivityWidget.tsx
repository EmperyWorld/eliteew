import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { localizeMarketingAiTool, localizeStatus } from '../../locales';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import {
	DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN,
	DASHBOARD_WIDGET_TOOLBAR_META_CLASS,
	dashboardListItemMetaClass,
} from '../desktopListTokens';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';

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

function AiActivityWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const { dashboard, widgetConfig, onNavigate, refetchProjectDashboard } =
		props;
	const { t, i18n } = useTranslation('marketing');
	const intlCount = React.useMemo(
		() =>
			new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language ?? 'en', {
				maximumFractionDigits: 0,
			}),
		[i18n.resolvedLanguage, i18n.language]
	);
	const aiRuns = dashboard.ai_runs ?? [];
	const aiRunCount = dashboard.counts?.ai_runs ?? 0;
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rowText = compact ? 'text-xs' : 'text-sm';

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>{t('overview.cards.aiRunsLabel')}</span>
				<span className="tabular-nums text-(--desktop-text-primary)">
					{intlCount.format(aiRunCount)}
				</span>
			</div>
			{aiRuns.length === 0 ? (
				<div className={cn('space-y-2', DASHBOARD_WIDGET_TOOLBAR_META_CLASS)}>
					<p className="m-0" role="status">
						{t('overview.dashboard.widget.aiActivityListEmpty')}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className={MC_DASHBOARD_NO_DRAG_CLASS}
							onClick={() => onNavigate('ai_studio')}
						>
							{t('overview.dashboard.widget.aiActivityOpenStudio')}
							<ArrowRightIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</DesktopAppButton>
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
				</div>
			) : null}
			{aiRuns.slice(0, limit).map((run) => (
				<div
					key={run.id}
					className={cn(
						'rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-(--desktop-text-secondary)',
						rowText,
						DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN
					)}
				>
					<div className="font-medium text-(--desktop-text-primary)">
						{localizeMarketingAiTool(run.tool_key)}
					</div>
					<div className={dashboardListItemMetaClass(compact)}>
						{localizeStatus(run.status)}
					</div>
				</div>
			))}
		</div>
	);
}

export const AiActivityWidget = React.memo(AiActivityWidgetImpl);
