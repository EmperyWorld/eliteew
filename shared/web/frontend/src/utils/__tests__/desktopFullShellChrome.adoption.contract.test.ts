/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 5 Cause lock — dual-header desktop chrome mounts that must use the
 * full-shell-only SSOT (attr +/or render gate), not ad-hoc `!embeddedMobile`.
 *
 * Related:
 * - utils/desktopFullShellChrome.ts
 * - documentation/product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const frontendSrc = join(dir, '../..');

const DUAL_HEADER_MOUNTS: ReadonlyArray<{
	label: string;
	headerRel: string;
	appRel: string;
}> = [
	{
		label: 'FeedbackHub',
		headerRel: 'pages/Desktop/components/feedbackHub/FeedbackHubAppHeader.tsx',
		appRel: 'pages/Desktop/components/FeedbackHubApp.tsx',
	},
	{
		label: 'EWDesk',
		headerRel: 'pages/Desktop/components/ewDesk/EwDeskAppHeader.tsx',
		appRel: 'pages/Desktop/components/EWDeskApp.tsx',
	},
];

describe('desktopFullShellChrome adoption (Wave 5)', () => {
	it.each(DUAL_HEADER_MOUNTS)(
		'$label header marks full-shell-only attr',
		({ headerRel }) => {
			const src = readFileSync(join(frontendSrc, headerRel), 'utf8');
			expect(src).toContain('desktopFullShellOnlyChromeProps');
		}
	);

	it.each(DUAL_HEADER_MOUNTS)(
		'$label app uses shouldRenderFullShellOnlyChrome gate',
		({ appRel }) => {
			const src = readFileSync(join(frontendSrc, appRel), 'utf8');
			expect(src).toContain('shouldRenderFullShellOnlyChrome');
		}
	);
});
