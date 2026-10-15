/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for AppStore modal layered capture Escape.
 *
 * Related:
 * - src/pages/Desktop/components/AppStore.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('AppStore keyboard contract', () => {
	it('uses layered useShellCaptureEscape in modal variant', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../AppStore.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain("variant === 'modal'");
		expect(src).toContain('consumeEscapeForSearchClear');
		expect(src).toContain('handleSearchFieldEscapeKeyDown');
	});
});
