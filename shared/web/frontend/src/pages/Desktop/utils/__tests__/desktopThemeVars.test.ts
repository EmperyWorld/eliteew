/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for light/dark desktop chrome CSS variables used by window presets.
 *
 * Invariants:
 * - Light aurora chrome must not reuse dark purple frame RGB.
 *
 * Related:
 * - `../desktopUi.ts`, `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import { describe, expect, it } from 'vitest';
import { getDesktopThemeVars } from '../desktopUi';

describe('getDesktopThemeVars chrome packs', () => {
	it('exposes aurora/noir/neon/premium/chameleon chrome keys for dark and light', () => {
		for (const theme of ['dark', 'light'] as const) {
			const vars = getDesktopThemeVars(theme);
			expect(vars['--desktop-chrome-aurora-frame-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-aurora-titlebar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-aurora-titlebar-title']).toBeTruthy();
			expect(vars['--desktop-chrome-aurora-card-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-aurora-taskbar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-noir-titlebar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-noir-taskbar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-noir-icon-app-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-noir-glyph-fg']).toBeTruthy();
			expect(vars['--desktop-chrome-neon-titlebar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-neon-taskbar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-neon-icon-app-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-neon-glyph-fg']).toBeTruthy();
			expect(vars['--desktop-chrome-premium-titlebar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-premium-taskbar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-premium-icon-app-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-premium-glyph-fg']).toBeTruthy();
			expect(vars['--desktop-chrome-premium-button-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-chameleon-frame-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-chameleon-titlebar-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-chameleon-content-bg']).toBeTruthy();
			expect(vars['--desktop-chrome-chameleon-taskbar-bg']).toBeTruthy();
		}
	});

	it('keeps light aurora/noir/neon/premium chrome off dark RGB bases', () => {
		const light = getDesktopThemeVars('light');
		const frame = light['--desktop-chrome-aurora-frame-bg'] ?? '';
		const titlebar = light['--desktop-chrome-aurora-titlebar-bg'] ?? '';
		const title = light['--desktop-chrome-aurora-titlebar-title'] ?? '';
		const noirIcon = light['--desktop-chrome-noir-icon-app-bg'] ?? '';
		const neonIcon = light['--desktop-chrome-neon-icon-app-bg'] ?? '';
		const premiumBar = light['--desktop-chrome-premium-taskbar-bg'] ?? '';

		expect(frame).not.toMatch(/rgb\(14,\s*10,\s*28\)/);
		expect(frame).toMatch(/252,\s*250,\s*255|250,\s*248,\s*255/);
		expect(titlebar).not.toMatch(/rgba\(15,\s*23,\s*42,\s*0\.96\)/);
		expect(title).toBe('#1e1b4b');
		expect(noirIcon).not.toMatch(/rgb\(22,\s*22,\s*28\)/);
		expect(noirIcon).toMatch(/255,\s*255,\s*255/);
		expect(neonIcon).not.toMatch(/rgb\(7,\s*9,\s*16\)/);
		expect(premiumBar).not.toMatch(/rgb\(4,\s*3,\s*8\)/);
		expect(light['--desktop-chrome-noir-glyph-fg']).toMatch(/15,\s*23,\s*42/);
		expect(light['--desktop-chrome-premium-glyph-fg']).toBe('#3f2e1f');
		expect(light['--desktop-bg-primary-rgb']).toBe('248 247 245');
	});

	it('keeps dark aurora/noir chrome on classic dark bases', () => {
		const dark = getDesktopThemeVars('dark');
		expect(dark['--desktop-chrome-aurora-frame-bg']).toMatch(
			/rgb\(14,\s*10,\s*28\)/
		);
		expect(dark['--desktop-chrome-aurora-titlebar-title']).toBe('#e0e7ff');
		expect(dark['--desktop-chrome-noir-icon-app-bg']).toMatch(
			/rgb\(22,\s*22,\s*28\)/
		);
		expect(dark['--desktop-chrome-neon-icon-app-bg']).toMatch(
			/rgb\(7,\s*9,\s*16\)/
		);
	});

	it('keeps dark chameleon off day-pastel bases (contrast with light text)', () => {
		const dark = getDesktopThemeVars('dark');
		const light = getDesktopThemeVars('light');
		const darkFrame = dark['--desktop-chrome-chameleon-frame-bg'] ?? '';
		const lightFrame = light['--desktop-chrome-chameleon-frame-bg'] ?? '';
		expect(darkFrame).not.toMatch(/rgb\(255,\s*228,\s*235\)/);
		expect(darkFrame).toMatch(/rgb\(52,\s*28,\s*42\)/);
		expect(lightFrame).toMatch(/rgb\(255,\s*228,\s*235\)/);
		expect(darkFrame).not.toBe(lightFrame);
	});
});
