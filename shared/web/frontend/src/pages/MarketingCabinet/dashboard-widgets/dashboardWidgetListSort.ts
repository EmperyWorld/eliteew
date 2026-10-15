import type { MarketingWidgetSortSpec } from './types';

/** Value for "default / server auto" sort in dashboard list widgets. */
export function sortSelectValue(
	sort: MarketingWidgetSortSpec | undefined
): string {
	if (sort == null) return 'auto';
	if (typeof sort === 'string') {
		const t = sort.trim();
		if (!t || t === 'default' || t === 'auto') return 'auto';
		return t;
	}
	const f = sort.field?.trim() || '';
	const d = sort.direction === 'desc' ? 'desc' : 'asc';
	if (!f) return 'auto';
	return `${f}:${d}`;
}

export function parseSortSelectValue(
	v: string
): MarketingWidgetSortSpec | undefined {
	if (v === 'auto') return undefined;
	if (v.includes(':')) {
		const [f, d] = v.split(':');
		return { field: f, direction: d === 'desc' ? 'desc' : 'asc' };
	}
	return { field: v, direction: 'asc' };
}
