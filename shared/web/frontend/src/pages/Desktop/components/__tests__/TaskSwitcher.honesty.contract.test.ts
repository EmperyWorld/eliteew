/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Task Switcher honesty — scannable window tiles, no fake live-preview chrome.
 *
 * Related:
 * - ../TaskSwitcher.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('TaskSwitcher honesty contract', () => {
	it('uses honest window tiles without fake OS preview chrome', () => {
		const src = readFileSync(join(dir, '../TaskSwitcher.tsx'), 'utf8');
		expect(src).toContain('data-task-switcher-honesty="window-tile"');
		expect(src).toContain('data-testid="task-switcher-window-list"');
		expect(src).toContain('data-testid="task-switcher-window-tile"');
		expect(src).not.toContain('bg-red-500/50');
		expect(src).not.toContain('bg-yellow-500/50');
		expect(src).not.toContain('bg-green-500/50');
		expect(src).not.toContain('Window Preview');
		expect(src).not.toMatch(/Title Bar/);
		expect(src).toMatch(
			/never fake OS[\s\S]*window chrome|fake OS[\s\S]*live-preview/
		);
	});
});
