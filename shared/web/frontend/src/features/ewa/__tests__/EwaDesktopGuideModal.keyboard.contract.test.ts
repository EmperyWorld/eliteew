/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for EWA desktop guide modal dialog shell (E6 flow, plan 19/20).
 *
 * Related:
 * - src/features/ewa/EwaDesktopGuideModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EwaDesktopGuideModal keyboard contract', () => {
	it('renders a portaled dialog with Escape close path', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../EwaDesktopGuideModal.tsx'), 'utf8');
		expect(src).toContain('ShellPortalMount');
		expect(src).not.toMatch(/createPortal\s*\(/);
		expect(src).toContain("e.key === 'Escape'");
		expect(src).toContain('EWA_DESKTOP_GUIDE_ROOT_ID');
		expect(src).toMatch(/role="dialog"|aria-modal="true"/);
	});

	it('falls back from presence-compact to presence-header spotlight', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../EwaDesktopGuideModal.tsx'), 'utf8');
		expect(src).toContain('[data-ewa-guide="presence-compact"]');
		expect(src).toContain('[data-ewa-guide="presence-header"]');
		expect(src).toContain('findVisibleGuideHighlight');
	});

	it('traps focus inside the guide card while open', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../EwaDesktopGuideModal.tsx'), 'utf8');
		expect(src).toContain('useMarketingDialogFocusTrap');
	});
});
