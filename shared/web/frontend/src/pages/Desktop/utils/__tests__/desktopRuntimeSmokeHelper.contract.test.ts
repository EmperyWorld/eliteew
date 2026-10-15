/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-level contract for the Playwright desktop runtime smoke helper.
 *
 * Invariants:
 * - The helper samples compositor/runtime signals without mutating desktop data.
 *
 * Related:
 * - e2e/desktopRuntimeSmoke.ts
 * - documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('desktopRuntimeSmoke helper contract', () => {
	it('collects the idle runtime signals used by desktop perf smoke', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../../../../../e2e/desktopRuntimeSmoke.ts'),
			'utf8'
		);

		expect(src).toContain('collectDesktopRuntimeSmokeProfile');
		expect(src).toContain("fetch('/app-build-version.txt'");
		expect(src).toContain('countRunningAnimationsInSubtree(document)');
		expect(src).toContain(
			"PerformanceObserver.supportedEntryTypes?.includes('longtask')"
		);
		expect(src).toContain('hasStaleChip');
		expect(src).toContain('hasStalledLoader');
	});
});
