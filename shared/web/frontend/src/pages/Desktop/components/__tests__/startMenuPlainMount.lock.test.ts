/**
 * @vitest-environment node
 */
/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Start Menu shell panels must not reintroduce Framer open/close motion.
 *
 * Invariants:
 * - Workspace / CommandConsole / Legacy panel roots do not import framer-motion.
 *
 * Related:
 * - StartMenuWorkspace.tsx, StartMenuCommandConsole.tsx, StartMenuLegacy.tsx
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = [
	'../startMenu/StartMenuWorkspace.tsx',
	'../startMenu/StartMenuCommandConsole.tsx',
	'../StartMenuLegacy.tsx',
	'../startMenu/StartMenuAppGrid.tsx',
	'../startMenu/StartMenuFooterChrome.tsx',
	'../SnapPreview.tsx',
	'../GridOverlay.tsx',
	'../DesktopSnapTeachOverlay.tsx',
] as const;

describe('desktop shell plain-mount lock', () => {
	it('keeps Start Menu + snap/grid overlays free of framer-motion imports', () => {
		for (const rel of roots) {
			const src = readFileSync(resolve(import.meta.dirname, rel), 'utf8');
			expect(src, rel).not.toMatch(/from ['"]framer-motion['"]/);
			expect(src, rel).not.toContain('desktopShellMenuPanelVariants');
		}
	});
});
