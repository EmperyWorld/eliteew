/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: EWDesk desktop chrome does not duplicate WindowTitleBar app name.
 *
 * Invariants:
 * - Desktop header strip shows tagline + refresh only (no t('title') in that strip).
 *
 * Related:
 * - ewDesk/EwDeskAppHeader.tsx
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, '../ewDesk/EwDeskAppHeader.tsx'), 'utf8');
}

describe('EWDeskApp dual-header contract', () => {
	it('desktop header is toolbar-only (tagline, no app title)', () => {
		const src = readComponentSource();
		const headerStart = src.indexOf('data-ed-guide="header"');
		expect(headerStart).toBeGreaterThan(-1);
		const headerSlice = src.slice(headerStart, headerStart + 1200);
		expect(headerSlice).toContain("t('tagline')");
		expect(headerSlice).not.toContain("t('title')");
		expect(headerSlice).toContain('DESKTOP_TYPOGRAPHY.meta');
		expect(src).toContain('desktopFullShellOnlyChromeProps');
	});
});
