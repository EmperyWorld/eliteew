/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock compact stacked widget example used while the welcome tour shows
 * widgets/favorites without persisting show_widgets_panel.
 *
 * Related:
 * - welcomeTourWidgetsExampleLayout.ts
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGET_SLOTS } from '../../utils/desktopWidgetLayoutUtils';
import { buildWelcomeTourWidgetsExampleLayout } from '../../utils/welcomeTourWidgetsExampleLayout';

describe('buildWelcomeTourWidgetsExampleLayout', () => {
	it('forces stacked compact plan/agenda/notes/favorites and enables favorites', () => {
		const layout = buildWelcomeTourWidgetsExampleLayout({
			slots: DEFAULT_WIDGET_SLOTS.map((slot) =>
				slot.type === 'favorites' ? { ...slot, enabled: false } : slot
			),
			slotPlacement: 'free',
			perWorkspace: false,
		});
		expect(layout.slotPlacement).toBe('stacked');
		expect(layout.slots.map((slot) => slot.type)).toEqual([
			'assistant-plan',
			'agenda',
			'notes',
			'favorites',
		]);
		expect(
			layout.slots.every((slot) => slot.enabled && slot.mode === 'compact')
		).toBe(true);
		expect(
			layout.slots.find((slot) => slot.type === 'favorites')?.enabled
		).toBe(true);
	});
});
