/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for desktop widget surface policy (SoT DESKTOP-WIDGETS-AND-AGENDA).
 *
 * Related:
 * - ../desktopWidgetSurfacePolicy.ts
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 */

import { describe, expect, it } from 'vitest';
import { DESKTOP_Z_INDEX } from '../../constants/desktopZIndex';
import {
	assertDesktopWidgetPanelNotShellPanelBand,
	DESKTOP_WIDGET_DEFAULT_ENABLED_SLOT_KINDS,
	DESKTOP_WIDGET_PANEL_Z_INDEX,
	DESKTOP_WINDOW_LAYER_Z_INDEX,
	isForbiddenExpandedPlaceholder,
	isLegacyWidgetTodosPrimaryTaskUi,
	resolveCompanionPlansWidgetVisibility,
	resolveDesktopWidgetCalendarTierV1,
	resolveDesktopWidgetDensity,
	resolveDesktopWidgetPanelZIndex,
	resolveDesktopWidgetTaskSource,
	resolveDesktopWindowLayerZIndex,
	shouldPersistWidgetsPanelFromTourPreview,
	bucketDesktopWidgetAgendaTasks,
} from '../desktopWidgetSurfacePolicy';

describe('desktopWidgetSurfacePolicy', () => {
	it('keeps widget panel below window layer and out of shell PANEL band', () => {
		const z = resolveDesktopWidgetPanelZIndex();
		expect(z).toBe(DESKTOP_WIDGET_PANEL_Z_INDEX);
		expect(assertDesktopWidgetPanelNotShellPanelBand(z)).toBe(true);
		expect(z).toBeLessThan(DESKTOP_Z_INDEX.PANEL);
		expect(resolveDesktopWindowLayerZIndex()).toBe(
			DESKTOP_WINDOW_LAYER_Z_INDEX
		);
		expect(DESKTOP_WINDOW_LAYER_Z_INDEX).toBeGreaterThan(z);
	});

	it('uses companion plan as task source of truth, not widget-todos', () => {
		expect(resolveDesktopWidgetTaskSource()).toBe('companion-plan');
		expect(isLegacyWidgetTodosPrimaryTaskUi('companion-plan')).toBe(false);
		expect(isLegacyWidgetTodosPrimaryTaskUi('widget-todos')).toBe(true);
	});

	it('maps expanded density to roomy inline, never placeholder', () => {
		expect(resolveDesktopWidgetDensity('expanded')).toBe('roomy');
		expect(resolveDesktopWidgetDensity('compact')).toBe('compact');
		expect(isForbiddenExpandedPlaceholder('placeholder')).toBe(true);
		expect(isForbiddenExpandedPlaceholder('roomy')).toBe(false);
	});

	it('locks v1 calendar to agenda, not a third-party grid', () => {
		expect(resolveDesktopWidgetCalendarTierV1()).toBe('agenda');
	});

	it('does not persist show_widgets_panel from tour preview', () => {
		expect(shouldPersistWidgetsPanelFromTourPreview(false, true)).toBe(false);
		expect(shouldPersistWidgetsPanelFromTourPreview(true, true)).toBe(true);
		expect(shouldPersistWidgetsPanelFromTourPreview(false, false)).toBe(false);
	});

	it('distinguishes plans disabled from empty plan', () => {
		expect(resolveCompanionPlansWidgetVisibility('disabled')).toBe(
			'hide-disabled'
		);
		expect(resolveCompanionPlansWidgetVisibility('empty')).toBe('empty-cta');
		expect(resolveCompanionPlansWidgetVisibility('enabled')).toBe('show');
	});

	it('defaults target enabled slots to plan, agenda, notes, ewdesk, now-playing', () => {
		expect([...DESKTOP_WIDGET_DEFAULT_ENABLED_SLOT_KINDS]).toEqual([
			'assistant-plan',
			'agenda',
			'notes',
			'ewdesk',
			'now-playing',
		]);
	});

	it('buckets agenda tasks by local due date, keeping today out of overdue', () => {
		const now = new Date(2026, 7, 19, 15, 0, 0);
		const buckets = bucketDesktopWidgetAgendaTasks(
			[
				{
					id: 'past',
					title: 'Past',
					dueDate: new Date(2026, 7, 18, 9, 0, 0),
					overdue: true,
				},
				{
					id: 'today',
					title: 'Today',
					dueDate: new Date(2026, 7, 19, 18, 0, 0),
					overdue: true,
				},
				{
					id: 'later',
					title: 'Later',
					dueDate: new Date(2026, 7, 21, 9, 0, 0),
					overdue: false,
				},
				{ id: 'none', title: 'None', dueDate: null, overdue: false },
			],
			now
		);
		expect(
			buckets.find((b) => b.id === 'overdue')?.tasks.map((t) => t.id)
		).toEqual(['past']);
		expect(
			buckets.find((b) => b.id === 'today')?.tasks.map((t) => t.id)
		).toEqual(['today']);
		expect(
			buckets.find((b) => b.id === 'upcoming')?.tasks.map((t) => t.id)
		).toEqual(['later']);
		expect(
			buckets.find((b) => b.id === 'undated')?.tasks.map((t) => t.id)
		).toEqual(['none']);
	});
});
