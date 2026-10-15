import { DESKTOP_APP_STYLE_CONTRACT } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type {
	MarketingDashboardWidget,
	MarketingProjectDashboard,
} from '../../marketingCabinetApi';
import { parseWidgetConfig } from '../parseWidgetConfig';

export interface OverviewKpiWidgetProps {
	dashboard: MarketingProjectDashboard;
	/** When set, `widget_config` drives density (and future layout tweaks). */
	widget?: Pick<MarketingDashboardWidget, 'widget_key' | 'widget_config'>;
}

/**
 * KPI summary tile body for `overview_kpi`.
 * Keeps all markup here so `DashboardWidgetBody` only dispatches to this component.
 */
function OverviewKpiWidgetImpl({
	dashboard,
	widget,
}: OverviewKpiWidgetProps): React.ReactElement {
	const { t, i18n } = useTranslation('marketing');
	const key = widget?.widget_key ?? 'overview_kpi';
	const parsed = parseWidgetConfig(key, widget?.widget_config ?? {});
	const density = parsed.config.density ?? 'comfortable';

	const intlPct = React.useMemo(
		() =>
			new Intl.NumberFormat(i18n.language, {
				style: 'percent',
				maximumFractionDigits: 0,
			}),
		[i18n.language]
	);
	const intlCount = React.useMemo(
		() =>
			new Intl.NumberFormat(i18n.language, {
				maximumFractionDigits: 0,
			}),
		[i18n.language]
	);

	const readiness = dashboard.readiness_score ?? 0;
	const jtbdCov = dashboard.coverage?.find(
		(c) => c.key === 'jtbd_to_value_props'
	);

	const compact = density === 'compact';

	return (
		<div
			className={cn('grid min-w-0 sm:grid-cols-2', compact ? 'gap-2' : 'gap-3')}
		>
			<div
				className={cn(
					'min-w-0 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
					compact ? 'p-2' : 'p-3'
				)}
			>
				<div
					className={
						compact
							? DESKTOP_APP_STYLE_CONTRACT.sectionLabelCompact
							: DESKTOP_APP_STYLE_CONTRACT.sectionLabel
					}
				>
					{t('overview.cards.readinessLabel')}
				</div>
				<div
					className={cn(
						'mt-1 font-semibold tabular-nums text-(--desktop-text-primary)',
						compact ? 'text-xl' : 'text-2xl'
					)}
				>
					{intlPct.format(readiness / 100)}
				</div>
			</div>
			<div
				className={cn(
					'min-w-0 rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
					compact ? 'p-2' : 'p-3'
				)}
			>
				<div
					className={
						compact
							? DESKTOP_APP_STYLE_CONTRACT.sectionLabelCompact
							: DESKTOP_APP_STYLE_CONTRACT.sectionLabel
					}
				>
					{t('overview.cards.jtbdCoverageLabel')}
				</div>
				<div
					className={cn(
						'mt-1 font-semibold tabular-nums text-(--desktop-text-primary)',
						compact ? 'text-xl' : 'text-2xl'
					)}
				>
					{intlPct.format((jtbdCov?.percentage ?? 0) / 100)}
				</div>
				<div
					className={cn(
						'mt-1',
						compact ? DESKTOP_TYPOGRAPHY.caption : DESKTOP_TYPOGRAPHY.meta
					)}
				>
					{t('overview.cards.jtbdCoverageHint', {
						covered: intlCount.format(jtbdCov?.covered ?? 0),
						total: intlCount.format(jtbdCov?.total ?? 0),
					})}
				</div>
			</div>
		</div>
	);
}

export const OverviewKpiWidget = React.memo(OverviewKpiWidgetImpl);
