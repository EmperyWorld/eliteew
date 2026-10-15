/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for desktop icon-only style packs (normalize + key registry).
 *
 * Invariants:
 * - Static packs `slate` / `clay` / `ember` round-trip through normalize.
 *
 * Related:
 * - `documentation/product/desktop_icon_system.md`
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_ICON_ONLY_STYLE_KEYS,
	DESKTOP_ICON_STYLE_KEYS,
	normalizeDesktopIconStyle,
} from '@/types/profile';
import { DESKTOP_ICON_SURFACE_STYLES } from '@/pages/Desktop/utils/desktopVisualSystem';
import { ICON_VISUAL_STYLES } from '@/pages/Desktop/components/DesktopIcon';

describe('desktop icon style packs', () => {
	it('registers static icon-only packs in DESKTOP_ICON_ONLY_STYLE_KEYS', () => {
		expect(DESKTOP_ICON_ONLY_STYLE_KEYS).toEqual(
			expect.arrayContaining(['slate', 'clay', 'ember'])
		);
		for (const key of DESKTOP_ICON_ONLY_STYLE_KEYS) {
			expect(DESKTOP_ICON_STYLE_KEYS).toContain(key);
		}
	});

	it('normalizes new static packs and rejects unknown keys', () => {
		expect(normalizeDesktopIconStyle('slate')).toBe('slate');
		expect(normalizeDesktopIconStyle('clay')).toBe('clay');
		expect(normalizeDesktopIconStyle('ember')).toBe('ember');
		expect(normalizeDesktopIconStyle('not-a-style')).toBe('framed');
	});

	it('keeps surface and visual style maps complete for every icon style key', () => {
		for (const key of DESKTOP_ICON_STYLE_KEYS) {
			expect(DESKTOP_ICON_SURFACE_STYLES[key]?.appBox).toBeTruthy();
			expect(ICON_VISUAL_STYLES[key]?.appBox).toBeTruthy();
		}
	});

	it('static packs do not use CSS animate-* classes on surfaces', () => {
		for (const key of ['slate', 'clay', 'ember'] as const) {
			const surface = DESKTOP_ICON_SURFACE_STYLES[key];
			expect(surface.appBox).not.toMatch(/animate-/);
			expect(surface.fileBox).not.toMatch(/animate-/);
			expect(ICON_VISUAL_STYLES[key].appBox).not.toMatch(/animate-/);
		}
	});
});
