/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock shell Suspense: no `fallback={null}` on primary desktop layout chunks.
 *
 * Related:
 * - ../DesktopWorkspaceShellLayout.tsx
 * - ../DesktopShellInlineSuspenseFallback.tsx
 * - ../DesktopModalSuspenseFallback.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Desktop shell Suspense fallbacks contract', () => {
	it('shell layout uses modal/inline fallbacks instead of null', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const layoutSrc = readFileSync(
			join(dir, '../DesktopWorkspaceShellLayout.tsx'),
			'utf8'
		);
		const contentSrc = readFileSync(
			join(dir, '../../DesktopWorkspaceContent.tsx'),
			'utf8'
		);
		const modalsSrc = readFileSync(
			join(dir, '../DesktopModalsLayer.tsx'),
			'utf8'
		);

		expect(layoutSrc).toContain('DesktopModalSuspenseFallback');
		expect(layoutSrc).toContain('DesktopShellInlineSuspenseFallback');
		expect(layoutSrc).not.toContain('fallback={null}');

		expect(contentSrc).toContain('DesktopModalSuspenseFallback');
		expect(contentSrc).not.toContain('fallback={null}');

		expect(modalsSrc).toContain('DesktopShellInlineSuspenseFallback');
		expect(modalsSrc).not.toMatch(/fallback=\{[^}]*null/);
	});
});
