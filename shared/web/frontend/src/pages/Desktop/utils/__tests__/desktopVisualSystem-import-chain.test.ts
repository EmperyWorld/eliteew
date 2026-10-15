/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — public barrel still re-exports hot desktopVisualSystem symbols after atomization.
 *
 * Invariants:
 * - Consumers import from `../desktopVisualSystem` (barrel), not deep module paths.
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx`
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	DESKTOP_WORKSPACE_MOTION,
	DesktopAppSymbol,
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
	getDesktopWindowShellTier,
} from '../desktopVisualSystem';

describe('desktopVisualSystem barrel import chain', () => {
	it('re-exports top shell helpers and presets used by consumers', () => {
		expect(typeof getDesktopShellContentPanelClassName).toBe('function');
		expect(typeof getDesktopShellToolbarClusterInsetControlClassName).toBe(
			'function'
		);
		expect(typeof getDesktopWindowShellTier).toBe('function');
		expect(DESKTOP_WINDOW_FRAME_STYLES.glass.frame.length).toBeGreaterThan(0);
		expect(DESKTOP_WORKSPACE_MOTION.backgroundCrossfadeSec).toBeGreaterThan(0);
		expect(typeof DesktopAppSymbol).toBe('function');
	});

	it('keeps content-panel helper returning a non-empty class string', () => {
		const cls = getDesktopShellContentPanelClassName('framed');
		expect(cls.length).toBeGreaterThan(8);
		expect(cls).not.toContain('backdrop-blur');
	});
});
