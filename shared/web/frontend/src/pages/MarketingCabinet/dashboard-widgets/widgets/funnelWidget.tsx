import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';

import {
	DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE,
	DASHBOARD_WIDGET_TOOLBAR_META_CLASS,
} from '../desktopListTokens';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';

const DEFAULT_MAX_ITEMS = 3;
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

function FunnelWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const { dashboard, widgetConfig, onNavigate, t, refetchProjectDashboard } =
		props;
	const funnelsCount = dashboard.counts?.funnels ?? 0;
	const recentFunnels = dashboard.funnels ?? [];
	const limit = listLimit(widgetConfig);

	return (
		<div className="min-w-0 space-y-2">
			<div className={DASHBOARD_WIDGET_TOOLBAR_META_CLASS}>
				{t('overview.dashboard.widget.funnelsCount', { count: funnelsCount })}
			</div>
			{recentFunnels.length === 0 ? (
				<div
					className={cn(
						'space-y-2',
						DESKTOP_TYPOGRAPHY.meta,
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					<p className="m-0" role="status">
						{t('overview.dashboard.widget.funnelListEmpty')}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className={MC_DASHBOARD_NO_DRAG_CLASS}
							onClick={() => onNavigate('funnel')}
						>
							{t('overview.openAction')}
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
			{recentFunnels.slice(0, limit).map((f) => (
				<button
					key={f.id}
					type="button"
					onClick={() => onNavigate('funnel', f.id)}
					className={cn(
						MC_DASHBOARD_NO_DRAG_CLASS,
						DESKTOP_INTERACTIVE.rowInteractive,
						DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE,
						'flex w-full min-w-0 items-center justify-between gap-2 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2 text-left text-sm text-(--desktop-text-primary) focus:outline-none'
					)}
				>
					<span className="min-w-0 truncate">{f.name}</span>
					<ArrowRightIcon
						className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</button>
			))}
		</div>
	);
}

export const FunnelWidget = React.memo(FunnelWidgetImpl);
