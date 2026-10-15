/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for NewFolderDialog capture Escape.
 *
 * Related:
 * - src/pages/Desktop/components/NewFolderDialog.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NewFolderDialog keyboard contract', () => {
	it('relies on ModalAdvanced desktop capture Escape defaults', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../NewFolderDialog.tsx'), 'utf8');
		expect(src).not.toContain('useShellCaptureEscape');
		expect(src).toContain('variant="desktop"');
	});
});
