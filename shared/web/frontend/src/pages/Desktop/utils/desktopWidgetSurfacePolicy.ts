/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure contracts for desktop widget chrome: stacking vs windows, slot kinds,
 * density, task-source precedence, and calendar tier (tests-from-requirements).
 *
 * Invariants:
 * - Widget panel must not use DESKTOP_Z_INDEX.PANEL.
 * - Task SoT for the plan widget is companion-plan, not widget-todos.
 * - v1 calendar surface is agenda, not a third-party grid.
 * - Tour preview must not persist show_widgets_panel.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 * - constants/desktopZIndex.ts
 */

import { DESKTOP_Z_INDEX } from '../constants/desktopZIndex';

/** Canvas band: above icons, below the window-layer stacking context. */
export const DESKTOP_WIDGET_PANEL_Z_INDEX = 40;

/**
 * Window layer floor: every window (even zIndex 1) paints above widgets.
 * Window chrome continues to use relative `desktopWindow.zIndex` inside this context.
 */
export const DESKTOP_WINDOW_LAYER_Z_INDEX = 100;

export type DesktopWidgetPanelStacking = 'canvas-below-windows';

export type DesktopWidgetTaskSource =
	| 'companion-plan'
	| 'widget-todos'
	| 'notes';

export type DesktopWidgetDensityMode = 'compact' | 'roomy' | 'placeholder';

export type DesktopWidgetCalendarTier =
	| 'agenda'
	| 'calendar-app'
	| 'third-party-grid';

export type DesktopWidgetTargetSlotKind =
	| 'assistant-plan'
	| 'agenda'
	| 'notes'
	| 'ewdesk'
	| 'now-playing'
	| 'favorites'
	| 'notifications'
	| 'project-shortcuts'
	| 'recent-content'
	| 'todos';

export const DESKTOP_WIDGET_DEFAULT_ENABLED_SLOT_KINDS: readonly DesktopWidgetTargetSlotKind[] =
	['assistant-plan', 'agenda', 'notes', 'ewdesk', 'now-playing'];

export function resolveDesktopWidgetPanelZIndex(): number {
	return DESKTOP_WIDGET_PANEL_Z_INDEX;
}

export function assertDesktopWidgetPanelNotShellPanelBand(
	zIndex: number
): boolean {
	return (
		zIndex < DESKTOP_Z_INDEX.PANEL && zIndex < DESKTOP_WINDOW_LAYER_Z_INDEX
	);
}

export function resolveDesktopWindowLayerZIndex(): number {
	return DESKTOP_WINDOW_LAYER_Z_INDEX;
}

export function resolveDesktopWidgetTaskSource(): DesktopWidgetTaskSource {
	return 'companion-plan';
}

export function isLegacyWidgetTodosPrimaryTaskUi(
	source: DesktopWidgetTaskSource
): boolean {
	return source === 'widget-todos';
}

export function resolveDesktopWidgetDensity(
	requested: 'compact' | 'expanded'
): Exclude<DesktopWidgetDensityMode, 'placeholder'> {
	return requested === 'expanded' ? 'roomy' : 'compact';
}

export function isForbiddenExpandedPlaceholder(
	mode: DesktopWidgetDensityMode
): boolean {
	return mode === 'placeholder';
}

export function resolveDesktopWidgetCalendarTierV1(): DesktopWidgetCalendarTier {
	return 'agenda';
}

export function shouldPersistWidgetsPanelFromTourPreview(
	livePanelOn: boolean,
	tourNeedsWidgets: boolean
): boolean {
	if (tourNeedsWidgets && !livePanelOn) {
		return false;
	}
	return livePanelOn;
}

export function resolveCompanionPlansWidgetVisibility(
	probe: 'enabled' | 'disabled' | 'empty'
): 'show' | 'hide-disabled' | 'empty-cta' {
	if (probe === 'disabled') return 'hide-disabled';
	if (probe === 'empty') return 'empty-cta';
	return 'show';
}

export type DesktopWidgetAgendaBucketId =
	| 'overdue'
	| 'today'
	| 'upcoming'
	| 'undated';

export type DesktopWidgetAgendaTask = {
	id: string;
	title: string;
	dueDate: Date | null;
	overdue: boolean;
};

export type DesktopWidgetAgendaBucket = {
	id: DesktopWidgetAgendaBucketId;
	tasks: DesktopWidgetAgendaTask[];
};

function startOfLocalDay(value: Date): Date {
	return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function bucketDesktopWidgetAgendaTasks(
	tasks: readonly DesktopWidgetAgendaTask[],
	now: Date = new Date()
): DesktopWidgetAgendaBucket[] {
	const todayStart = startOfLocalDay(now);
	const tomorrowStart = new Date(todayStart);
	tomorrowStart.setDate(tomorrowStart.getDate() + 1);

	const overdue: DesktopWidgetAgendaTask[] = [];
	const today: DesktopWidgetAgendaTask[] = [];
	const upcoming: DesktopWidgetAgendaTask[] = [];
	const undated: DesktopWidgetAgendaTask[] = [];

	for (const task of tasks) {
		if (!task.dueDate) {
			undated.push(task);
			continue;
		}
		const dueStart = startOfLocalDay(task.dueDate);
		if (dueStart.getTime() < todayStart.getTime()) {
			overdue.push(task);
			continue;
		}
		if (dueStart.getTime() < tomorrowStart.getTime()) {
			today.push(task);
			continue;
		}
		upcoming.push(task);
	}

	return [
		{ id: 'overdue', tasks: overdue },
		{ id: 'today', tasks: today },
		{ id: 'upcoming', tasks: upcoming },
		{ id: 'undated', tasks: undated },
	];
}
