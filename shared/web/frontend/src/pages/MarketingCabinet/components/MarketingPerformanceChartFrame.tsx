/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet performance charts shell — preset height for RechartsSizedFrame.
 *
 * Invariants:
 * - Charts render only after the box has positive width and height.
 *
 * Related:
 * - MarketingPerformanceDashboardPanel.tsx, RechartsSizedFrame.tsx
 */
import type { ReactElement } from 'react';

import { RechartsSizedFrame } from '@/components/charts/RechartsSizedFrame';

const CHART_MIN_HEIGHT_PX = 224;

export function MarketingPerformanceChartFrame({
	ariaLabel,
	children,
}: {
	ariaLabel: string;
	children: ReactElement;
}) {
	return (
		<RechartsSizedFrame
			ariaLabel={ariaLabel}
			className="mt-3 h-56 min-h-56"
			minHeight={CHART_MIN_HEIGHT_PX}
		>
			{children}
		</RechartsSizedFrame>
	);
}
