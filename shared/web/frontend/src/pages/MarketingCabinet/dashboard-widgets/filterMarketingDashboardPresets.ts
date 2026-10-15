import type { MarketingDashboardPreset } from '../marketingCabinetApi';

export type FilterMarketingDashboardPresetsOptions = {
	categoryFilter: string;
	searchQuery: string;
};

/** B.15: local filter for dashboard layout presets (no extra API). */
export function filterMarketingDashboardPresets(
	presets: ReadonlyArray<MarketingDashboardPreset>,
	options: FilterMarketingDashboardPresetsOptions
): MarketingDashboardPreset[] {
	let list = [...presets];
	if (options.categoryFilter) {
		list = list.filter((p) => p.category === options.categoryFilter);
	}
	const q = options.searchQuery.trim().toLowerCase();
	if (!q) {
		return list;
	}
	return list.filter((p) => {
		const cat = (p.category ?? '').toLowerCase();
		return (
			p.display_name.toLowerCase().includes(q) ||
			p.name.toLowerCase().includes(q) ||
			(p.description ?? '').toLowerCase().includes(q) ||
			cat.includes(q)
		);
	});
}
