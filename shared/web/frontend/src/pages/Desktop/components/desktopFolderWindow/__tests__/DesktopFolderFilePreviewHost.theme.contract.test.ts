/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock folder preview nav bar to ShellPortalMount for --desktop-* tokens.
 *
 * Related:
 * - ../DesktopFolderFilePreviewHost.tsx
 * - pages/Desktop/shell/shellPortal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOST = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'DesktopFolderFilePreviewHost.tsx'
);

describe('DesktopFolderFilePreviewHost theme contract', () => {
	it('prev/next nav mounts through ShellPortalMount', () => {
		const src = readFileSync(HOST, 'utf8');
		expect(src).toContain('ShellPortalMount');
		expect(src).toContain('@/pages/Desktop/shell/shellPortal');
		expect(src).not.toMatch(/createPortal\s*\(/);
		expect(src).not.toContain('DesktopShellFloatingPortal');
	});
});
