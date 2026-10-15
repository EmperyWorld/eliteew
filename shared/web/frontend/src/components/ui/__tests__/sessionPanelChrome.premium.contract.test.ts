/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Session/Device floating panel chrome: sentence-case meta, no uppercase shout.
 *
 * Related:
 * - components/ui/sessionPanelChrome.ts
 * - components/ui/AuthStatusIndicator.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SESSION_PANEL_META_LABEL_CLASS } from '../sessionPanelChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Session device panel premium chrome', () => {
	it('keeps credits / metric meta sentence-case (no uppercase shout)', () => {
		expect(SESSION_PANEL_META_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(SESSION_PANEL_META_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('wires sessionPanelChrome tokens into AuthStatusIndicator', () => {
		const src = stripComments(readSrc('../AuthStatusIndicator.tsx'));
		expect(src).toContain('SESSION_PANEL_SHELL_CLASS');
		expect(src).toContain('SESSION_PANEL_META_LABEL_CLASS');
		expect(src).toContain('data-testid="desktop-session-device-panel"');
		expect(src).not.toMatch(/creditsAvailableLabel[\s\S]{0,120}\buppercase\b/);
	});
});
