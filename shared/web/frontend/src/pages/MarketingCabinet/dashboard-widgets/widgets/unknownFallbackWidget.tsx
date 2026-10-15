import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import * as React from 'react';

import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import { telemetryUnknownDashboardWidgetOnce } from '../marketingDashboardTelemetry';

export function UnknownFallbackWidget(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const { t, widget, refetchProjectDashboard } = props;
	const label = t('overview.dashboard.widget.unknownWidgetBody');

	React.useEffect(() => {
		telemetryUnknownDashboardWidgetOnce(widget.id, widget.widget_key);
	}, [widget.id, widget.widget_key]);

	return (
		<DesktopAppSurface variant="soft" className="p-3">
			<p
				className={cn(
					'font-medium text-(--desktop-text-primary)',
					DESKTOP_TYPOGRAPHY.body
				)}
			>
				{t('overview.dashboard.widget.unknownWidgetTitle')}
			</p>
			<p className={cn('mt-1 leading-relaxed', DESKTOP_TYPOGRAPHY.meta)}>
				{label}{' '}
				<span className="rounded bg-(--desktop-surface-panel)/80 px-1.5 py-0.5 font-mono text-xs">
					{widget.widget_key}
				</span>
			</p>
			<p className={cn('mt-2', DESKTOP_APP_STYLE_CONTRACT.helperText)}>
				{t('overview.dashboard.widget.unknownWidgetDocHint')}
			</p>
			{refetchProjectDashboard ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className="mt-3"
					onClick={() => void refetchProjectDashboard()}
				>
					{t('overview.dashboard.widget.unknownWidgetRetry')}
				</DesktopAppButton>
			) : null}
		</DesktopAppSurface>
	);
}
