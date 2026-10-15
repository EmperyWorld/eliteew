import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';

import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';

function SwotWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const { dashboard, widgetConfig, onNavigate, t } = props;
	const swot = dashboard.latest_swot ?? dashboard.swot;
	const density = widgetConfig.density ?? 'comfortable';
	const compact = density === 'compact';

	return (
		<div className="min-w-0 space-y-2">
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					DESKTOP_INTERACTIVE.btn,
					MC_DASHBOARD_NO_DRAG_CLASS,
					'w-full justify-between rounded-(--desktop-radius)'
				)}
				onClick={() => onNavigate('analysis')}
			>
				{t('overview.openAnalysis')}
				<ArrowRightIcon
					className="h-3.5 w-3.5"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			{swot ? (
				<div
					className={cn(
						'rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
						compact ? 'p-2' : 'p-3'
					)}
				>
					<div
						className={cn(
							'font-semibold text-(--desktop-text-primary)',
							compact && 'text-sm'
						)}
					>
						{swot.title}
					</div>
					{swot.executive_summary ? (
						<p
							className={cn(
								'mt-2 leading-relaxed text-(--desktop-text-secondary)',
								compact ? 'line-clamp-3' : 'line-clamp-4',
								compact ? DESKTOP_TYPOGRAPHY.caption : DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{swot.executive_summary}
						</p>
					) : null}
				</div>
			) : (
				<p
					className={
						compact ? DESKTOP_TYPOGRAPHY.caption : DESKTOP_TYPOGRAPHY.meta
					}
				>
					{t('overview.noSwotTitle')}
				</p>
			)}
		</div>
	);
}

export const SwotWidget = React.memo(SwotWidgetImpl);
