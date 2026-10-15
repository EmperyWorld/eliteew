/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ConfirmDeleteModal to opaque desktop chrome (not ultra-transparent glass).
 *
 * Related:
 * - ../ConfirmDeleteModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ConfirmDeleteModal surface contract', () => {
	it('defaults to ModalAdvanced desktop variant, not glass', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../ConfirmDeleteModal.tsx'), 'utf8');
		expect(src).toContain("variant = 'desktop'");
		expect(src).toContain('title={title}');
		expect(src).not.toContain('variant="glass"');
	});
});
