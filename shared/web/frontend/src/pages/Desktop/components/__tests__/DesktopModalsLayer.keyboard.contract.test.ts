/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: modals layer does not own global Escape (children do).
 *
 * Related:
 * - src/pages/Desktop/components/DesktopModalsLayer.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopModalsLayer keyboard contract', () => {
	it('does not register a layer-wide Escape listener', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../DesktopModalsLayer.tsx'), 'utf8');
		expect(src).not.toContain("addEventListener('keydown'");
	});
});
