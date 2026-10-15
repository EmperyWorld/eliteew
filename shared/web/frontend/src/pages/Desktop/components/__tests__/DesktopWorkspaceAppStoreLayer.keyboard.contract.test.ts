/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for App Store detail overlay capture Escape.
 *
 * Related:
 * - src/pages/Desktop/components/DesktopWorkspaceAppStoreLayer.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopWorkspaceAppStoreLayer keyboard contract', () => {
	it('captures Escape on detail overlay without closing catalog modal path', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopWorkspaceAppStoreLayer.tsx'),
			'utf8'
		);
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain('showAppStore && appStoreDetailId');
		expect(src).toContain('handleBackFromDetailWithFocus');
		expect(src).toContain('data-desktop-shell-keyboard-surface');
		expect(src).toContain('isOpen={showAppStore && !appStoreDetailId}');
	});
});
