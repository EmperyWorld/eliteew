/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for layered Escape on taskbar context menus.
 *
 * Related:
 * - src/pages/Desktop/components/Taskbar.tsx
 * - src/pages/Desktop/hooks/useTaskbarPopoverController.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Taskbar keyboard contract', () => {
	it('uses dismissible floating menus for taskbar context menus', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../Taskbar.tsx'), 'utf8');
		expect(src).toContain('winContextMenuRef');
		expect(src).toContain('startContextMenuRef');
		expect(src).toContain('taskbarContextMenuRef');
		expect(src).toContain('escapeCapture: true');
		expect(src).toContain('focusFirstMenuItem: true');
	});

	it('defers shell popover Escape while a context menu is open', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pop = readFileSync(
			join(dir, '../../hooks/useTaskbarPopoverController.ts'),
			'utf8'
		);
		expect(pop).toContain('winContextMenu != null');
		expect(pop).toContain('startContextMenu != null');
		expect(pop).toContain('taskbarContextMenu != null');
		expect(pop).not.toContain(
			'setWinContextMenu(null);\n\t\t\t\tsetStartContextMenu(null);'
		);
	});

	it('defers shell popover Escape for notification hub and start menu', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pop = readFileSync(
			join(dir, '../../hooks/useTaskbarPopoverController.ts'),
			'utf8'
		);
		const taskbar = readFileSync(join(dir, '../Taskbar.tsx'), 'utf8');
		expect(pop).toContain('if (showNotifications) return');
		expect(pop).toContain('if (showStart) return');
		expect(pop).toContain('if (showTray) return');
		expect(pop).toContain('if (shellOverlayConsumesEscape) return');
		expect(pop).toContain('shouldDeferDesktopShellKeydownToFocusedSurface');
		expect(pop).toContain('clockRef.current?.isMenuOpen()');
		expect(taskbar).toContain('performLogout');
	});

	it('closes Start Menu on DESKTOP_CLOSE_START_MENU_EVENT', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pop = readFileSync(
			join(dir, '../../hooks/useTaskbarPopoverController.ts'),
			'utf8'
		);
		expect(pop).toContain('DESKTOP_CLOSE_START_MENU_EVENT');
		expect(pop).toContain('setShowStart(false)');
		expect(pop).toContain('setShowNotifications(false)');
	});
});
