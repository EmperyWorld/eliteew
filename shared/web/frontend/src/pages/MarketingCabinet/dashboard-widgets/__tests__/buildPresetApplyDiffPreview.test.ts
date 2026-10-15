import { describe, expect, it } from 'vitest';
import type {
	MarketingDashboardPreset,
	MarketingDashboardWidget,
} from '../../marketingCabinetApi';
import { buildPresetApplyDiffPreview } from '../buildPresetApplyDiffPreview';

function mockT(key: string, options?: Record<string, unknown>): string {
	if (key.startsWith('overview.dashboard.catalog.')) {
		const short = key.slice('overview.dashboard.catalog.'.length);
		return typeof options?.defaultValue === 'string'
			? (options.defaultValue as string)
			: short;
	}
	return key;
}

function presetOf(
	partial: Partial<MarketingDashboardPreset> & {
		template_widgets?: unknown[];
	}
): MarketingDashboardPreset {
	const { template_widgets, ...rest } = partial;
	return {
		id: rest.id ?? 'p1',
		name: rest.name ?? 'minimal',
		display_name: rest.display_name ?? 'Minimal',
		description: rest.description ?? null,
		category: rest.category ?? 'c',
		template_config:
			template_widgets !== undefined
				? { widgets: template_widgets }
				: (rest.template_config ?? {}),
		usage_count: rest.usage_count ?? 0,
		version: rest.version ?? 1,
		created_at: rest.created_at ?? '',
		updated_at: rest.updated_at ?? '',
	};
}

function widget(
	w: Partial<MarketingDashboardWidget>
): MarketingDashboardWidget {
	return {
		id: w.id ?? 'w1',
		layout_id: w.layout_id ?? 'L1',
		widget_key: w.widget_key ?? 'tasks',
		widget_title: w.widget_title ?? 'Tasks',
		widget_config: w.widget_config ?? {},
		grid_position: w.grid_position ?? { x: 0, y: 0, w: 1, h: 1 },
		is_visible: w.is_visible ?? true,
		is_locked: w.is_locked ?? false,
		display_order: w.display_order ?? 1,
		created_at: w.created_at ?? '',
		updated_at: w.updated_at ?? '',
	};
}

describe('buildPresetApplyDiffPreview', () => {
	it('returns hasResolvableTemplate false when template widgets missing or empty', () => {
		const p = presetOf({ template_config: {} });
		expect(
			buildPresetApplyDiffPreview(p, [widget({})], mockT).hasResolvableTemplate
		).toBe(false);
		const p2 = presetOf({ template_widgets: [] });
		expect(
			buildPresetApplyDiffPreview(p2, [widget({})], mockT).hasResolvableTemplate
		).toBe(false);
	});

	it('lists preset rows and current-only keys under notInPreset', () => {
		const p = presetOf({
			template_widgets: [
				{ widget_key: 'tasks', widget_title: 'My tasks' },
				{ widget_key: 'alerts', widget_title: '' },
			],
		});
		const current = [
			widget({
				id: 'a',
				widget_key: 'tasks',
				widget_title: 'Mine',
			}),
			widget({
				id: 'b',
				widget_key: 'segments',
				widget_title: 'ICP',
			}),
		];
		const r = buildPresetApplyDiffPreview(p, current, mockT);
		expect(r.hasResolvableTemplate).toBe(true);
		expect(r.inPresetRows).toEqual(['My tasks (tasks)', 'alerts']);
		expect(r.notInPresetRows).toEqual(['ICP (segments)']);
	});

	it('dedupes template keys for notInPreset (one row per current tile)', () => {
		const p = presetOf({
			template_widgets: [
				{ widget_key: 'tasks', widget_title: 'A' },
				{ widget_key: 'tasks', widget_title: 'B' },
			],
		});
		const current = [
			widget({ id: '1', widget_key: 'tasks', widget_title: 'X' }),
			widget({ id: '2', widget_key: 'campaigns', widget_title: 'C1' }),
			widget({ id: '3', widget_key: 'campaigns', widget_title: 'C2' }),
		];
		const r = buildPresetApplyDiffPreview(p, current, mockT);
		expect(r.inPresetRows).toEqual(['A (tasks)', 'B (tasks)']);
		expect(r.notInPresetRows).toEqual(['C1 (campaigns)', 'C2 (campaigns)']);
	});

	it('uses unknown index when widget_key is not a string in template', () => {
		const p = presetOf({
			template_widgets: [{ widget_title: 'No key' }],
		});
		const r = buildPresetApplyDiffPreview(p, [], mockT);
		expect(r.inPresetRows).toEqual(['No key (unknown-0)']);
		expect(r.hasResolvableTemplate).toBe(true);
	});
});
