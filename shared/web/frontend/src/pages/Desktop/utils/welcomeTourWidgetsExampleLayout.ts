/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact stacked widget layout used as a non-persisted welcome-tour example
 * when the live panel is off or too sparse to spotlight.
 *
 * Invariants:
 * - Plan, agenda, notes, and favorites; always enabled compact stacked.
 * - Callers must omit persist commits so the example does not write shell_state.
 *
 * Related:
 * - useDesktopWorkspaceWidgetsPanelProps.ts, desktopWelcomeTourSession.ts
 */

import type {
	DesktopWidgetLayoutSlot,
	DesktopWidgetsLayout,
} from '../types/desktopExpansion.types';

const TOUR_EXAMPLE_SLOT_TYPES = new Set<DesktopWidgetLayoutSlot['type']>([
	'assistant-plan',
	'agenda',
	'notes',
	'favorites',
]);

const TOUR_FALLBACK_SLOTS: DesktopWidgetLayoutSlot[] = [
	{
		id: 'assistant-plan',
		type: 'assistant-plan',
		enabled: true,
		mode: 'compact',
	},
	{ id: 'agenda', type: 'agenda', enabled: true, mode: 'compact' },
	{ id: 'notes', type: 'notes', enabled: true, mode: 'compact' },
	{ id: 'favorites', type: 'favorites', enabled: true, mode: 'compact' },
];

export function buildWelcomeTourWidgetsExampleLayout(
	base: DesktopWidgetsLayout
): DesktopWidgetsLayout {
	const picked = base.slots.filter((slot) =>
		TOUR_EXAMPLE_SLOT_TYPES.has(slot.type)
	);
	const slots: DesktopWidgetLayoutSlot[] =
		picked.length > 0
			? picked.map((slot) => ({
					...slot,
					enabled: true,
					mode: 'compact',
					position: undefined,
				}))
			: [...TOUR_FALLBACK_SLOTS];
	const hasFavorites = slots.some((slot) => slot.type === 'favorites');
	if (!hasFavorites) {
		slots.push({
			id: 'favorites',
			type: 'favorites',
			enabled: true,
			mode: 'compact',
		});
	}
	return {
		...base,
		slotPlacement: 'stacked',
		slots,
	};
}
