/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Menu pin status: no red «Не отображён» wall; badge only when on desktop.
 *
 * Related:
 * - ../StartMenuAppGrid.tsx
 * - ../startMenuAppGridLayout.ts (P16 name clamp)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('StartMenuAppGrid pin badge disclosure contract', () => {
	it('hides off-desktop status badge text and keeps pin toggle', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../StartMenuAppGrid.tsx'), 'utf8');
		const layout = readFileSync(
			join(dir, '../startMenuAppGridLayout.ts'),
			'utf8'
		);
		expect(src).toContain('if (!onDesktop)');
		expect(src).toContain('data-start-app-desktop-toggle');
		expect(src).toContain('labelOnDesktop');
		expect(src).toMatch(/labelNotOnDesktop:\s*_labelNotOnDesktop/);
		expect(src).toContain('Progressive disclosure');
		expect(src).toContain('PlusIcon');
		expect(src).toContain('startMenuAppMetaLine');
		expect(src).toContain('START_MENU_APP_NAME_CLASS');
		expect(layout).toContain('line-clamp-2');
		expect(src).not.toContain('min-h-28');
	});
});
