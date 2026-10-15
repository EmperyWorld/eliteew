import type { TFunction } from 'i18next';

import type { MarketingView } from '../constants';
import type {
	MarketingDashboardWidget,
	MarketingProjectDashboard,
} from '../marketingCabinetApi';
import type {
	MarketingDashboardWidgetBodyConfig,
	MarketingWidgetConfig,
} from './types';

/** Optional extras when leaving a dashboard tile for a cabinet section (URL query, etc.). */
export type MarketingCabinetNavigateExtras = {
	urlQuery?: Record<string, string | null | undefined>;
};

/** Shared props for interactive dashboard widget body components (registry → tile body). */
export interface MarketingDashboardWidgetBodyProps {
	projectId: string;
	dashboard: MarketingProjectDashboard;
	widget: MarketingDashboardWidget;
	/** Sanitized `widget_config` from `parseWidgetConfig` (the inner `config` object). */
	widgetConfig: MarketingDashboardWidgetBodyConfig;
	onNavigate: (
		view: MarketingView,
		entityId?: string | null,
		extras?: MarketingCabinetNavigateExtras
	) => void;
	allowMarketingWrite: boolean;
	/** Full merged `widget_config` for PATCH (tile replaces JSONB on the server). */
	onPersistWidgetConfig?: (config: MarketingWidgetConfig) => Promise<void>;
	/** For canvas save errors; optional to keep other tiles free of cabinet error helpers. */
	extractApiErrorMessage?: (error: unknown, fallback: string) => string;
	/** Refetch merged project dashboard (widgets + analytics); chart tiles use this when analytics is missing. */
	refetchProjectDashboard?: () => undefined | Promise<unknown>;
	/** True while the project dashboard query is fetching (e.g. background refetch). */
	isProjectDashboardFetching?: boolean;
	t: TFunction<'marketing'>;
}
