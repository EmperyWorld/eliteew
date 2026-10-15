/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for desktop app windows that own their internal scrolling.
 *
 * Invariants:
 * - Apps with tab/internal scroll containers must disable the outer window body scroll.
 * - ContentManagerPro keeps the outer `data-desktop-scroll` container for preview positioning.
 * - Folder windows never use the app self-scroll path even if appComponent looks registered.
 *
 * Related:
 * - ../EnhancedWindow.tsx
 * - ../../utils/desktopWindowBodyScrollRegistry.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isDesktopAppWindowBodySelfScroll } from '../EnhancedWindow';
import { DESKTOP_APP_WINDOW_BODY_SELF_SCROLL } from '../../utils/desktopWindowBodyScrollRegistry';

describe('isDesktopAppWindowBodySelfScroll', () => {
	it('imports DESKTOP_SURFACE for frame chrome (no bare identifier)', () => {
		// Lock: EnhancedWindow uses DESKTOP_SURFACE.radiusFrame/shadow — missing import
		// crashed DesktopWindowLayer chunk (ReferenceError 2026-07-29).
		const src = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../EnhancedWindow.tsx'),
			'utf8'
		);
		expect(src).toMatch(
			/import\s*\{[^}]*\bDESKTOP_SURFACE\b[^}]*\}\s*from\s*'\.\.\/constants'/s
		);
		expect(src).toContain('DESKTOP_SURFACE.radiusFrame');
	});

	it('disables the outer window body scroll for every registry member', () => {
		for (const app of DESKTOP_APP_WINDOW_BODY_SELF_SCROLL) {
			expect(isDesktopAppWindowBodySelfScroll('app', app)).toBe(true);
		}
	});

	it('keeps the outer desktop scroll for apps that rely on it', () => {
		expect(isDesktopAppWindowBodySelfScroll('app', 'ContentManagerPro')).toBe(
			false
		);
		expect(isDesktopAppWindowBodySelfScroll('app', 'VideoCallApp')).toBe(false);
		expect(isDesktopAppWindowBodySelfScroll('folder', 'UserSiteStudio')).toBe(
			false
		);
	});
});
