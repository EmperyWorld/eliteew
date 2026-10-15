/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Empty-desktop context menu must not expose sort submenu or pack-to-grid.
 *
 * Related:
 * - enhancedContextMenu/createContextMenuItems.tsx (P30)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		'../enhancedContextMenu/createContextMenuItems.tsx'
	),
	'utf8'
);

describe('EnhancedContextMenu desktop declutter', () => {
	it('does not register sort or reflow empty-desktop actions', () => {
		expect(src).not.toContain("id: 'desktop-sort'");
		expect(src).not.toContain("id: 'reflow-icons-to-grid'");
		expect(src).not.toContain("fireAction('sort-name')");
		expect(src).not.toContain("fireAction('sort-by-type')");
		expect(src).not.toContain("fireAction('sort-by-pinned')");
		expect(src).not.toContain("fireAction('reflow-icons-to-grid')");
	});

	it('registers settings-widgets under desktop settings submenu with full dispatch parity', () => {
		expect(src).toContain("id: 'settings-widgets'");
		expect(src).toContain("fireAction('settings-widgets')");

		const actionHandlerSrc = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../../hooks/useDesktopWorkspaceHandleAction.ts'
			),
			'utf8'
		);
		expect(actionHandlerSrc).toContain("case 'settings-widgets':");
		expect(actionHandlerSrc).toContain("openShellSettings('widgets')");
	});
});
