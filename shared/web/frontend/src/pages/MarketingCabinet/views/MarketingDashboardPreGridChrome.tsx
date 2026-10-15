import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { EyeIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

import { focusFirstInteractiveInDashboardFirstTile } from '../dashboardFirstTileFocus';
import type { MarketingDashboardWidget } from '../marketingCabinetApi';

export function MarketingDashboardPreGridChrome({
	mcShellPanel,
	visibleWidgetsCount,
	allWidgets,
	hiddenWidgets,
	allowMarketingWrite,
	patchWidgetPending,
	onShowHiddenWidget,
	t,
}: {
	mcShellPanel: string;
	visibleWidgetsCount: number;
	allWidgets: MarketingDashboardWidget[];
	hiddenWidgets: MarketingDashboardWidget[];
	allowMarketingWrite: boolean;
	patchWidgetPending: boolean;
	onShowHiddenWidget: (widgetId: string) => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}) {
	return (
		<>
			{visibleWidgetsCount > 0 ? (
				<button
					type="button"
					className="absolute left-[-9999px] z-60 rounded bg-(--desktop-surface-accent) px-4 py-2 text-sm text-(--desktop-text-primary) outline-none ring-2 ring-(--mc-accent) focus:fixed focus:left-4 focus:top-32 focus:inline-block sm:focus:top-36"
					onClick={() => {
						const el = document.getElementById('mc-dashboard-first-tile');
						el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
						window.requestAnimationFrame(() => {
							focusFirstInteractiveInDashboardFirstTile();
						});
					}}
				>
					{t('overview.dashboard.toolbar.skipToFirstTile')}
				</button>
			) : null}

			{allWidgets.length === 0 ? (
				<DesktopAppEmptyState
					title={t('overview.dashboard.emptyTitle')}
					description={t('overview.dashboard.toolbar.noWidgetsHint')}
				/>
			) : null}

			{allWidgets.length > 0 && visibleWidgetsCount === 0 ? (
				<div className={cn('p-4', DESKTOP_TYPOGRAPHY.body, mcShellPanel)}>
					{t('overview.dashboard.toolbar.allHiddenHint')}
				</div>
			) : null}

			{hiddenWidgets.length > 0 ? (
				<div className={cn('p-3', mcShellPanel)}>
					<div
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
							'mb-2 font-medium'
						)}
					>
						{t('overview.dashboard.toolbar.hiddenHeading')}
					</div>
					<ul className="flex flex-col gap-2">
						{hiddenWidgets.map((w) => (
							<li
								key={w.id}
								className={cn(
									'flex flex-wrap items-center justify-between gap-2 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-3 py-2',
									DESKTOP_INTERACTIVE.rowHover
								)}
							>
								<span className="min-w-0 truncate text-sm text-(--desktop-text-primary) antialiased">
									{w.widget_title}
								</span>
								{allowMarketingWrite ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										disabled={patchWidgetPending}
										onClick={() => onShowHiddenWidget(w.id)}
									>
										<EyeIcon
											className="mr-1 w-3.5 h-3.5 shrink-0"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.showWidget')}
									</DesktopAppButton>
								) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</>
	);
}
