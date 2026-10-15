import { describe, expect, it } from 'vitest';
import type { MarketingDashboardPreset } from '../../marketingCabinetApi';
import { filterMarketingDashboardPresets } from '../filterMarketingDashboardPresets';

function preset(
	p: Partial<MarketingDashboardPreset>
): MarketingDashboardPreset {
	return {
		id: p.id ?? '1',
		name: p.name ?? 'n',
		display_name: p.display_name ?? 'N',
		description: p.description ?? null,
		category: p.category ?? 'cat-a',
		template_config: p.template_config ?? {},
		usage_count: p.usage_count ?? 0,
		version: p.version ?? 1,
		created_at: p.created_at ?? '',
		updated_at: p.updated_at ?? '',
	};
}

describe('filterMarketingDashboardPresets', () => {
	it('filters by category', () => {
		const items = [
			preset({ name: 'a', category: 'Alpha' }),
			preset({ name: 'b', category: 'Beta', id: '2' }),
		];
		expect(
			filterMarketingDashboardPresets(items, {
				categoryFilter: 'Beta',
				searchQuery: '',
			})
		).toHaveLength(1);
		expect(
			filterMarketingDashboardPresets(items, {
				categoryFilter: 'Beta',
				searchQuery: '',
			})[0]?.name
		).toBe('b');
	});

	it('filters by search in name and description', () => {
		const items = [
			preset({ name: 'minimal', display_name: 'Минимум' }),
			preset({
				name: 'other',
				display_name: 'Другое',
				id: '2',
				description: 'has Retail keyword',
			}),
		];
		const out = filterMarketingDashboardPresets(items, {
			categoryFilter: '',
			searchQuery: 'retail',
		});
		expect(out).toHaveLength(1);
		expect(out[0]?.name).toBe('other');
	});

	it('combines category and search', () => {
		const items = [
			preset({ name: 'x1', category: 'A' }),
			preset({ name: 'x2', category: 'B', id: '2' }),
		];
		expect(
			filterMarketingDashboardPresets(items, {
				categoryFilter: 'B',
				searchQuery: 'x2',
			})
		).toHaveLength(1);
	});
});
