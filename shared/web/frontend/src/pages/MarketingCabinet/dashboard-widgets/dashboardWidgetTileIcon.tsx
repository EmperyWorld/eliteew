import type { ComponentType, SVGProps } from 'react';

import {
	BeakerIcon,
	BarsArrowDownIcon,
	BellIcon,
	BoltSlashIcon,
	BookOpenIcon,
	ChartBarIcon,
	ClipboardDocumentCheckIcon,
	FlagIcon,
	MegaphoneIcon,
	PencilSquareIcon,
	PresentationChartLineIcon,
	ReceiptPercentIcon,
	ScaleIcon,
	SparklesIcon,
	Squares2X2Icon,
	UserGroupIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';

import type { MarketingDashboardCatalogKey } from './registry';

type DashboardTileIcon = ComponentType<SVGProps<SVGSVGElement>>;

const TILE_ICONS: Partial<
	Record<MarketingDashboardCatalogKey, DashboardTileIcon>
> = {
	overview_kpi: Squares2X2Icon,
	tasks: ClipboardDocumentCheckIcon,
	funnel: BarsArrowDownIcon,
	campaigns: MegaphoneIcon,
	alerts: BellIcon,
	segments: UserGroupIcon,
	ai_activity: SparklesIcon,
	swot: ScaleIcon,
	researches: BookOpenIcon,
	imc_recent: BeakerIcon,
	jtbd_stories: FlagIcon,
	value_props: ReceiptPercentIcon,
	competitors: BoltSlashIcon,
	chart_metric: PresentationChartLineIcon,
	chart_metrics_bar: ChartBarIcon,
	marketing_canvas: PencilSquareIcon,
};

const FALLBACK_ICON: DashboardTileIcon = Squares2X2Icon;

export function DashboardWidgetTypeIcon({
	widgetKey,
	className,
}: {
	widgetKey: string;
	className?: string;
}): React.ReactElement {
	const Icon =
		TILE_ICONS[widgetKey as MarketingDashboardCatalogKey] ?? FALLBACK_ICON;
	return <Icon className={className} aria-hidden />;
}
