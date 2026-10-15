import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { MarketingView } from '../constants';
import type {
	MarketingDashboardWidget,
	MarketingProjectDashboard,
	MarketingWidgetConfig,
} from '../marketingCabinetApi';
import { parseWidgetConfig } from './parseWidgetConfig';
import { renderDashboardWidgetBody } from './registry';
import type { MarketingCabinetNavigateExtras } from './widgetBodyProps';

export type DashboardInteractiveWidgetBodyNavigate = (
	view: MarketingView,
	entityId?: string | null,
	extras?: MarketingCabinetNavigateExtras
) => void;

export function catalogDefaultTitle(
	t: (key: string, options?: Record<string, unknown>) => string,
	widgetKey: string
): string {
	return String(
		t(`overview.dashboard.catalog.${widgetKey}`, { defaultValue: '' })
	);
}

export function isCustomDashboardTileTitle(
	t: (key: string, options?: Record<string, unknown>) => string,
	widgetTitle: string,
	widgetKey: string
): boolean {
	const def = catalogDefaultTitle(t, widgetKey).trim();
	if (!def) return true;
	return def !== widgetTitle.trim();
}

/** D.35: единственный UX-путь смены заголовка плитки — модалка «Переименовать» здесь; тела виджетов не PATCHят `widget_title`. */
export function mergeTitleOverrideIntoWidgetConfig(
	widget: MarketingDashboardWidget,
	trimmedTitle: string,
	t: (key: string, options?: Record<string, unknown>) => string
): MarketingWidgetConfig {
	const raw =
		widget.widget_config && typeof widget.widget_config === 'object'
			? { ...(widget.widget_config as Record<string, unknown>) }
			: {};
	const base = raw as MarketingWidgetConfig;
	const def = catalogDefaultTitle(t, widget.widget_key).trim();
	if (def && trimmedTitle === def) {
		delete (base as Record<string, unknown>).titleOverride;
	} else {
		base.titleOverride = trimmedTitle;
	}
	return base;
}

export function buildTileTitleHint(
	t: (key: string, options?: Record<string, unknown>) => string,
	w: MarketingDashboardWidget,
	parsed: ReturnType<typeof parseWidgetConfig>
): string {
	const defaultTitle = catalogDefaultTitle(t, w.widget_key);
	const rawOverride =
		typeof parsed.config.titleOverride === 'string'
			? parsed.config.titleOverride.trim()
			: '';
	if (rawOverride.length > 0 && rawOverride !== w.widget_title.trim()) {
		return t('overview.dashboard.toolbar.tileTitleHintOverrideDrift', {
			widgetTitle: w.widget_title,
			titleOverride: rawOverride,
			defaultTitle,
		});
	}
	if (isCustomDashboardTileTitle(t, w.widget_title, w.widget_key)) {
		return t('overview.dashboard.toolbar.tileTitleHintCustom', {
			defaultTitle,
		});
	}
	return t('overview.dashboard.toolbar.tileTitleHintDefault');
}

function DashboardWidgetBody({
	widget,
	dashboard,
	onNavigate,
	projectId,
	allowMarketingWrite,
	onPersistWidgetConfig,
	extractApiErrorMessage,
	refetchProjectDashboard,
	isProjectDashboardFetching,
}: {
	widget: MarketingDashboardWidget;
	dashboard: MarketingProjectDashboard;
	onNavigate: DashboardInteractiveWidgetBodyNavigate;
	projectId: string;
	allowMarketingWrite: boolean;
	onPersistWidgetConfig?: (config: MarketingWidgetConfig) => Promise<void>;
	extractApiErrorMessage?: (error: unknown, fallback: string) => string;
	refetchProjectDashboard?: () => undefined | Promise<unknown>;
	isProjectDashboardFetching?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const parsed = parseWidgetConfig(widget.widget_key, widget.widget_config);
	return (
		<React.Suspense
			fallback={
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'px-1 text-(--desktop-text-muted)'
					)}
				>
					{t('overview.dashboard.widgetLoading')}
				</p>
			}
		>
			{renderDashboardWidgetBody({
				projectId,
				dashboard,
				widget,
				widgetConfig: parsed.config,
				onNavigate,
				allowMarketingWrite,
				onPersistWidgetConfig,
				extractApiErrorMessage,
				refetchProjectDashboard,
				isProjectDashboardFetching,
				t,
			})}
		</React.Suspense>
	);
}

export const MemoDashboardWidgetBody = React.memo(DashboardWidgetBody);
