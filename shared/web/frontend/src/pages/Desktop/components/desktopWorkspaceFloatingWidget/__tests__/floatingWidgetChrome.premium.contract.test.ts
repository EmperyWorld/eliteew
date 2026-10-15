/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock floating widget chrome: sentence-case timezone / now-playing labels,
 * quiet strip and credits (no uppercase shout, no accent wash).
 *
 * Related:
 * - widgetChromeStyles.ts
 * - FloatingWidgetClockSection.tsx
 * - DesktopFloatingWidgetNowPlayingStrip.tsx
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS,
	FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS,
	FLOATING_WIDGET_TIMEZONE_LABEL_CLASS,
	widgetChipClassName,
	widgetCreditsClassName,
} from '../widgetChromeStyles';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Floating widget premium chrome', () => {
	it('keeps timezone and now-playing eyebrows sentence-case', () => {
		expect(FLOATING_WIDGET_TIMEZONE_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(FLOATING_WIDGET_TIMEZONE_LABEL_CLASS).toMatch(/tracking-normal/);
		expect(FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS).not.toMatch(
			/\buppercase\b/
		);
		expect(FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS).toMatch(
			/tracking-normal/
		);
		expect(widgetChipClassName).not.toMatch(/rounded-full/);
		expect(widgetCreditsClassName).not.toMatch(/desktop-accent-rgb/);
		expect(FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS).toMatch(
			/desktop-surface-panel/
		);
		expect(FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS).not.toMatch(
			/radial-gradient/
		);
	});

	it('wires chrome tokens without uppercase shout in clock / strip', () => {
		const clock = stripComments(readSrc('../FloatingWidgetClockSection.tsx'));
		const strip = stripComments(
			readSrc('../DesktopFloatingWidgetNowPlayingStrip.tsx')
		);
		const root = stripComments(
			readSrc('../DesktopWorkspaceFloatingWidget.tsx')
		);
		expect(clock).toContain('FLOATING_WIDGET_TIMEZONE_LABEL_CLASS');
		expect(clock).not.toMatch(/\buppercase\b/);
		expect(strip).toContain('FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS');
		expect(strip).toContain('FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS');
		expect(strip).not.toMatch(/\buppercase\b/);
		expect(strip).not.toMatch(/radial-gradient/);
		expect(root).not.toMatch(/radial-gradient\(circle_at_50%/);
		expect(root).not.toMatch(
			/drop-shadow-\[0_6px_16px_rgb\(var\(--desktop-accent/
		);
	});
});
