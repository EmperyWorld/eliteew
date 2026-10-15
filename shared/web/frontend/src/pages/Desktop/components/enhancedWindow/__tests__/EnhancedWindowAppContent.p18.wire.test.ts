/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wire lock: EnhancedWindow Suspense uses DesktopAppLoadSuspenseFallback (P18).
 *
 * Related:
 * - ../EnhancedWindowAppContent.tsx
 * - ../DesktopAppLoadSuspenseFallback.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EnhancedWindowAppContent P18 wire', () => {
	it('Suspense fallback mounts stall-capable DesktopAppLoadSuspenseFallback', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const host = readFileSync(
			join(dir, '../EnhancedWindowAppContent.tsx'),
			'utf8'
		);
		expect(host).toContain('DesktopAppLoadSuspenseFallback');
		expect(host).not.toMatch(/Suspense fallback=\{<\w*LoadingFallback/);
	});
});
