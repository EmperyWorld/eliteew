/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: capture Escape paths delegate to useShellCaptureEscape.
 *
 * Related:
 * - hooks/useDismissibleFloatingMenu.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('useDismissibleFloatingMenu keyboard contract', () => {
	it('delegates capture Escape to useShellCaptureEscape', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../useDismissibleFloatingMenu.ts'),
			'utf8'
		);
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain('escapeCapture');
	});
});
