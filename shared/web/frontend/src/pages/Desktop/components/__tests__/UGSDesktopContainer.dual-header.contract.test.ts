/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: UGS desktop chrome does not duplicate WindowTitleBar branding.
 *
 * Invariants:
 * - Toolbar shows view label; no workspaceOverline / «UGS Workspace» brand line.
 *
 * Related:
 * - UGSDesktopContainer.tsx
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readSrc(): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, '../UGSDesktopContainer.tsx'), 'utf8');
}

describe('UGSDesktopContainer dual-header contract', () => {
	it('toolbar has view label without UGS Workspace overline', () => {
		const src = readSrc();
		expect(src).toContain('viewLabel(view)');
		expect(src).not.toContain("t('workspaceOverline')");
		expect(src).not.toContain('DESKTOP_TYPOGRAPHY.labelOverline');
	});

	it('splits primary Hub/Analytics from operator Dashboard/Admin tablists', () => {
		const src = readSrc();
		expect(src).toContain('UGS_PRIMARY_VIEWS');
		expect(src).toContain('UGS_OPERATOR_VIEWS');
		expect(src).toContain('ugs-desktop-primary-tabs');
		expect(src).toContain('ugs-desktop-operator-tabs');
		expect(src).toContain("t('operatorToolsTablistAria')");
	});
});
