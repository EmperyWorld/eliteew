import { createPortal } from 'react-dom';
import { MarketingDashboardToolbarPanel } from './MarketingDashboardToolbarPanel';
import type { MarketingDashboardToolbarPanelProps } from './marketingDashboardToolbarPanel.types';

/**
 * Рендер тулбара дашборда: при наличии mount-node из шапки кабинета — `createPortal`, иначе inline в потоке обзора.
 */
export function MarketingDashboardToolbarPortal(
	props: MarketingDashboardToolbarPanelProps
) {
	const wrap = <MarketingDashboardToolbarPanel {...props} />;
	return props.dashboardToolbarMountNode
		? createPortal(wrap, props.dashboardToolbarMountNode)
		: wrap;
}
