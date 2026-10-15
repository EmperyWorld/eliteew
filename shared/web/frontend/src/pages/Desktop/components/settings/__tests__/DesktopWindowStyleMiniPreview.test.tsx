/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: window-style mini previews follow chrome/titlebar presets
 * (no hardcoded dark titlebar wash that fights light theme).
 *
 * Invariants:
 * - Mini preview must not use bg-black / ring-black washes on the chrome strip.
 *
 * Related:
 * - desktopSettingsPreviewComponents.tsx
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopWindowStyleMiniPreview } from '../desktopSettingsPreviewComponents';

describe('DesktopWindowStyleMiniPreview', () => {
	it('uses frame/titlebar presets without hardcoded dark titlebar wash', () => {
		const { container } = render(
			<DesktopWindowStyleMiniPreview style="premium" />
		);
		const root = container.querySelector(
			'[data-desktop-window-style-mini="premium"]'
		);
		expect(root).toBeTruthy();
		expect(root?.className).toContain('desktop-chrome-premium-frame-bg');
		expect(container.innerHTML).not.toMatch(/bg-black\/22|ring-black\/28/);
		expect(container.innerHTML).toContain('desktop-chrome-premium-titlebar-bg');
	});

	it('keeps chameleon distinct from premium', () => {
		const premium = render(<DesktopWindowStyleMiniPreview style="premium" />)
			.container.innerHTML;
		const chameleon = render(
			<DesktopWindowStyleMiniPreview style="chameleon" />
		).container.innerHTML;
		expect(premium).not.toBe(chameleon);
		expect(chameleon).toContain('desktop-chrome-chameleon-');
	});
});
