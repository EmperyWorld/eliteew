/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for TaskbarClock layered Escape on seconds flyout.
 *
 * Related:
 * - src/pages/Desktop/components/TaskbarClock.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarClock keyboard contract', () => {
	it('exposes isMenuOpen and delegates flyout Escape to useShellCaptureEscape', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskbarClock.tsx'), 'utf8');
		expect(src).toContain('isMenuOpen: () => showClockMenu');
		expect(src).toContain('useShellCaptureEscape');
	});
});
