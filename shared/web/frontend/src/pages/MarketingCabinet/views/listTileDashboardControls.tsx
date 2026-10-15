import { cn } from '@/utils/cn';

import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../dashboard-widgets/TileChrome';
import { parseWidgetConfig } from '../dashboard-widgets/parseWidgetConfig';
import { isMarketingDashboardWidgetListKey } from '../dashboard-widgets/types';
import type {
	MarketingDashboardWidget,
	MarketingWidgetConfig,
} from '../marketingCabinetApi';

export function ListTileDashboardControls({
	widget,
	disabled,
	onPatchFullConfig,
	t,
}: {
	widget: MarketingDashboardWidget;
	disabled: boolean;
	onPatchFullConfig: (widgetId: string, cfg: MarketingWidgetConfig) => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}) {
	const parsed = parseWidgetConfig(widget.widget_key, widget.widget_config);
	if (
		!parsed.knownKey ||
		!isMarketingDashboardWidgetListKey(parsed.widget_key)
	) {
		return null;
	}
	const cfg = parsed.config;
	const maxItems = cfg.maxItems ?? 4;
	const density = cfg.density ?? 'comfortable';

	return (
		<div
			className={cn(
				'flex flex-wrap items-end gap-2 border-b border-(--desktop-border-subtle)/40 pb-2',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			<label className={cn('flex flex-col gap-0.5', DESKTOP_TYPOGRAPHY.meta)}>
				<span>{t('overview.dashboard.toolbar.tileMaxItems')}</span>
				<input
					type="number"
					min={1}
					max={500}
					defaultValue={maxItems}
					key={`${widget.id}-${maxItems}`}
					disabled={disabled}
					className="w-24 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-sm text-(--desktop-text-primary)"
					onBlur={(e) => {
						const v = Number.parseInt(e.target.value, 10);
						if (!Number.isFinite(v)) return;
						const n = Math.min(500, Math.max(1, v));
						if (n === maxItems) return;
						onPatchFullConfig(widget.id, {
							...(widget.widget_config as MarketingWidgetConfig),
							maxItems: n,
						});
					}}
				/>
			</label>
			<div className="min-w-36 flex-1">
				<MarketingCabinetSelect
					size="compact"
					aria-label={t('overview.dashboard.toolbar.tileDensityAria')}
					value={density}
					options={[
						{
							value: 'comfortable',
							label: t('overview.dashboard.toolbar.densityComfortable'),
						},
						{
							value: 'compact',
							label: t('overview.dashboard.toolbar.densityCompact'),
						},
					]}
					disabled={disabled}
					onChange={(nextDensity) => {
						if (nextDensity !== 'comfortable' && nextDensity !== 'compact')
							return;
						if (nextDensity === density) return;
						onPatchFullConfig(widget.id, {
							...(widget.widget_config as MarketingWidgetConfig),
							density: nextDensity,
						});
					}}
				/>
			</div>
		</div>
	);
}
