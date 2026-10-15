/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source locks: widget layouts do not use PANEL z-index; plan/agenda do not
 * read widget-todos.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function readRel(rel: string): string {
	return readFileSync(join(here, rel), 'utf8');
}

describe('desktop widget surface source locks', () => {
	it('stacked and free layouts assign canvas z via policy helper, not PANEL', () => {
		const stacked = readRel('../StackedWidgetsPanelLayout.tsx');
		const free = readRel('../FreeWidgetsPanelLayout.tsx');
		const windowLayer = readRel('../../DesktopWindowLayer.tsx');
		expect(stacked).toContain('resolveDesktopWidgetPanelZIndex()');
		expect(free).toContain('resolveDesktopWidgetPanelZIndex()');
		expect(stacked).not.toContain('DESKTOP_Z_INDEX.PANEL');
		expect(free).not.toContain('DESKTOP_Z_INDEX.PANEL');
		expect(windowLayer).toContain('resolveDesktopWindowLayerZIndex()');
	});

	it('plan and agenda slot bodies do not use widget-todos', () => {
		const plan = readRel('../AssistantPlanSlotBody.tsx');
		const agenda = readRel('../AgendaSlotBody.tsx');
		const hook = readRel('../../../hooks/useDesktopAssistantPlanProjection.ts');
		expect(plan).not.toContain('useWidgetTodos');
		expect(agenda).not.toContain('useWidgetTodos');
		expect(hook).toContain('getEwaCompanionActivePlan');
		expect(hook).toContain('completeEwaCompanionPlanTask');
		expect(hook).not.toContain('useWidgetTodos');
	});

	it('slot body never mounts expanded placeholder', () => {
		const body = readRel('../WidgetSlotBody.tsx');
		expect(body).not.toContain('ExpandedSlotPlaceholder');
		expect(body).toContain('AssistantPlanSlotBody');
		expect(body).toContain('AgendaSlotBody');
	});
});
