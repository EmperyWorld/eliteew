/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave D lock: shell ПКМ menus portal to body and position with viewport coords
 * so `[data-desktop-ui-scale]` transform does not drift the menu.
 *
 * Invariants:
 * - Enhanced / taskbar icon / floating-widget menus use ShellPortalMount.
 * - Openers record clientX/clientY (not offsetX under scaled ancestors).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENTS = join(__dirname, '..');

describe('ПКМ portal + viewport coordinates contract', () => {
	it('EnhancedContextMenu portals via ShellPortalMount', () => {
		const src = readFileSync(
			join(COMPONENTS, 'enhancedContextMenu/EnhancedContextMenu.tsx'),
			'utf8'
		);
		expect(src).toContain('ShellPortalMount');
		expect(src).toContain('getDesktopPortalShellProps');
	});

	it('TaskbarIconContextMenu portals via useShellPortal (body stack)', () => {
		const src = readFileSync(
			join(COMPONENTS, 'TaskbarIconContextMenu.tsx'),
			'utf8'
		);
		expect(src).toContain('useShellPortal');
		expect(src).toContain('getFloatingMenuPosition');
	});

	it('FloatingWidgetContextMenu portals via ShellPortalMount', () => {
		const src = readFileSync(
			join(
				COMPONENTS,
				'desktopWorkspaceFloatingWidget/FloatingWidgetContextMenu.tsx'
			),
			'utf8'
		);
		expect(src).toContain('ShellPortalMount');
	});

	it('taskbar secondary overflow and windows overflow open with client coords', () => {
		const secondary = readFileSync(
			join(COMPONENTS, 'TaskbarSecondaryOverflow.tsx'),
			'utf8'
		);
		expect(secondary).toMatch(/onContextMenu[\s\S]{0,200}openMenu/);

		const windowsOverflow = readFileSync(
			join(COMPONENTS, 'taskbarStrip/TaskbarWindowsOverflowStrip.tsx'),
			'utf8'
		);
		expect(windowsOverflow).toContain('data-taskbar-windows-overflow="true"');
		expect(windowsOverflow).toMatch(
			/data-taskbar-windows-overflow="true"[\s\S]{0,400}onContextMenu/
		);
		expect(windowsOverflow).toContain('x: e.clientX');
		expect(windowsOverflow).toContain('y: e.clientY');
	});
});
