/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks mobile-embedded layout markers after Wave 4 controller extraction.
 *
 * Invariants:
 * - Controller computes embeddedMobileLayout and passes it through MainSurface assembly.
 * - MainSurface owns cn + MOBILE_EMBEDDED_APP_ROOT_CLASS + data-embedded-mobile.
 *
 * Related:
 * - ../ContentManagerPro.tsx
 * - ../hooks/useContentManagerProController.ts
 * - ../components/ContentManagerProMainSurface.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerPro mobile embedded contract', () => {
	it('imports cn and exposes embedded-mobile layout markers', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const controller = readFileSync(
			join(dir, '../hooks/useContentManagerProController.ts'),
			'utf8'
		);
		const assembly = readFileSync(
			join(dir, '../hooks/assembleContentManagerProMainSurfaceProps.ts'),
			'utf8'
		);
		const surface = readFileSync(
			join(dir, '../components/ContentManagerProMainSurface.tsx'),
			'utf8'
		);

		expect(surface).toMatch(
			/import\s*\{\s*cn\s*\}\s*from\s*['"]@\/utils\/cn['"]/
		);
		expect(surface).toContain('MOBILE_EMBEDDED_APP_ROOT_CLASS');
		expect(surface).toContain('data-embedded-mobile');
		expect(controller).toContain('embeddedMobileLayout');
		expect(assembly).toContain('embeddedMobileLayout');
		expect(assembly).toContain('isMobile || embeddedMobileLayout');
	});
});
