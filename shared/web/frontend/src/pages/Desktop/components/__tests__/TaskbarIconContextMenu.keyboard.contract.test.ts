/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for TaskbarIconContextMenu capture Escape.
 *
 * Related:
 * - src/pages/Desktop/components/TaskbarIconContextMenu.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarIconContextMenu keyboard contract', () => {
	it('delegates Escape to useShellCaptureEscape', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../TaskbarIconContextMenu.tsx'),
			'utf8'
		);
		expect(src).toContain('useShellCaptureEscape(point != null');
	});
});
