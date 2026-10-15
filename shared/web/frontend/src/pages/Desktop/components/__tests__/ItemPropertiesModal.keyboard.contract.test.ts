/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for ItemPropertiesModal desktop shell keyboard via ModalAdvanced.
 *
 * Related:
 * - src/pages/Desktop/components/ItemPropertiesModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ItemPropertiesModal keyboard contract', () => {
	it('uses ModalAdvanced desktop variant for capture Escape defaults', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ItemPropertiesModal.tsx'), 'utf8');
		expect(src).toContain('ModalAdvanced');
		expect(src).toContain('variant="desktop"');
		expect(src).not.toContain('useShellCaptureEscape');
	});
});
