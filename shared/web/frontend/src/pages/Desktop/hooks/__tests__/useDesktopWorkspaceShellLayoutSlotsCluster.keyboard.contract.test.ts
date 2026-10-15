/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: taskbar receives shellOverlayConsumesEscape from layout cluster.
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellLayoutSlotsCluster.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('useDesktopWorkspaceShellLayoutSlotsCluster keyboard contract', () => {
	it('sets shellOverlayConsumesEscape when search overlays or command palette are open', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../useDesktopWorkspaceShellLayoutSlotsCluster.ts'),
			'utf8'
		);
		expect(src).toContain('shellOverlayConsumesEscape');
		expect(src).toContain('p.showCommandPalette');
		expect(src).toContain('p.showQuickSearch');
		expect(src).toContain('p.showTaskSwitcher');
		expect(src).toContain('p.showShortcutsHelp');
		expect(src).toContain('p.showWP');
		expect(src).toContain('p.showNF');
		expect(src).toContain('p.showClipboard');
		expect(src).toContain('p.showAppStore');
	});
});
