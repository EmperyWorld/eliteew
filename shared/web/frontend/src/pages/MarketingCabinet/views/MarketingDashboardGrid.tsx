import type { MarketingDashboardWidget } from '../marketingCabinetApi';
import {
	MarketingDashboardTile,
	type MarketingDashboardTileProps,
} from './MarketingDashboardTile';

export type MarketingDashboardGridProps = Omit<
	MarketingDashboardTileProps,
	'widget' | 'tileIndex'
> & {
	visibleWidgets: MarketingDashboardWidget[];
};

export function MarketingDashboardGrid(p: MarketingDashboardGridProps) {
	const { visibleWidgets, ...tileRest } = p;
	return (
		<>
			{visibleWidgets.map((w, tileIndex) => (
				<MarketingDashboardTile
					key={w.id}
					widget={w}
					tileIndex={tileIndex}
					{...tileRest}
				/>
			))}
		</>
	);
}
