/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Right-rail popovers (Start / Notifications / Tray) must mutually dismiss.
 *
 * Related:
 * - ../hooks/useTaskbarPopoverController.ts
 * - ../Taskbar.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Taskbar tray exclusivity contract', () => {
	it('closes sibling right-rail layers when opening tray or notifications', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../../hooks/useTaskbarPopoverController.ts'),
			'utf8'
		);
		expect(src).toContain('const handleToggleTray = useCallback');
		expect(src).toContain('setShowNotifications(false)');
		expect(src).toContain('setShowTray(false)');
		expect(src).toContain('const handleNotificationBellClick = useCallback');
		expect(src).toContain('const handleStartButtonClick = useCallback');
		const toggleTrayIdx = src.indexOf('const handleToggleTray = useCallback');
		const toggleTrayBlock = src.slice(
			toggleTrayIdx,
			src.indexOf('const handleCloseTray', toggleTrayIdx)
		);
		expect(toggleTrayBlock).toContain('setShowNotifications(false)');
		expect(toggleTrayBlock).toContain('setShowStart(false)');
		const bellIdx = src.indexOf(
			'const handleNotificationBellClick = useCallback'
		);
		const bellBlock = src.slice(
			bellIdx,
			src.indexOf('const handleCloseNotificationPanel', bellIdx)
		);
		expect(bellBlock).toContain('setShowTray(false)');
		const startIdx = src.indexOf('const handleStartButtonClick = useCallback');
		const startBlock = src.slice(startIdx, startIdx + 280);
		expect(startBlock).toContain('setShowTray(false)');
	});
});
