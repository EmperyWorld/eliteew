/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock portaled confirm shells to useShellPortal so stack + body theme apply (U2).
 *
 * Related:
 * - ../desktopAppChrome/modal.tsx
 * - ../../shell/shellPortal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopPortaledConfirmShell theme contract', () => {
	it('mounts through useShellPortal for stack + #desktop-main tokens', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../desktopAppChrome/modal.tsx'),
			'utf8'
		);
		const idx = src.indexOf('export const DesktopPortaledConfirmShell');
		expect(idx).toBeGreaterThan(-1);
		const slice = src.slice(idx, idx + 2200);
		expect(slice).toContain('useShellPortal');
		expect(slice).toContain("layer: 'embedded_modal'");
		expect(slice).toContain('portalProps?.zIndex');
		expect(src).toContain("from '@/pages/Desktop/shell/shellPortal'");
	});
});
