/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_SCENE_PARALLAX_PCT,
	DESKTOP_WINDOW_MINIMIZE_MS,
	desktopShellMenuPanelVariants,
	desktopShellSearchPanelVariants,
	desktopShellTaskbarEnterVariants,
	desktopShellTransitionDurationSec,
	desktopWindowMorphLayoutId,
} from '../desktopShellMotion';

describe('desktopShellMotion', () => {
	it('uses stable morph layout ids per window', () => {
		expect(desktopWindowMorphLayoutId('win-1')).toBe(
			'desktop-shell-win-morph-win-1'
		);
	});

	it('aligns minimize timer with shell preset', () => {
		expect(DESKTOP_WINDOW_MINIMIZE_MS).toBeGreaterThanOrEqual(280);
	});

	it('ramps parallax by scene depth', () => {
		expect(DESKTOP_SCENE_PARALLAX_PCT.soft).toBeLessThan(
			DESKTOP_SCENE_PARALLAX_PCT.balanced
		);
		expect(DESKTOP_SCENE_PARALLAX_PCT.balanced).toBeLessThan(
			DESKTOP_SCENE_PARALLAX_PCT.immersive
		);
	});

	it('returns static variants when reduced motion', () => {
		expect(desktopShellTaskbarEnterVariants(true).visible).toEqual({
			y: 0,
			opacity: 1,
		});
		expect(desktopShellSearchPanelVariants(true).visible).toEqual({
			opacity: 1,
			transition: { duration: 0 },
		});
	});

	it('keeps Start Menu panel variants instant (no open/close spring)', () => {
		const reduced = desktopShellMenuPanelVariants(true);
		const full = desktopShellMenuPanelVariants(false);
		expect(reduced.visible).toEqual({
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: 0 },
		});
		expect(full.exit).toEqual({
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: 0 },
		});
	});

	it('scales generic transition duration by speed preset', () => {
		expect(desktopShellTransitionDurationSec(false, 'slow')).toBeGreaterThan(
			desktopShellTransitionDurationSec(false, 'fast')
		);
		expect(desktopShellTransitionDurationSec(true, 'normal')).toBe(0);
	});
});
