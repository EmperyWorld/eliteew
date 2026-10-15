/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Guards the Desktop main surface side effect that applies wallpaper/theme CSS to `#desktop-main`.
 *
 * Invariants:
 * - Wallpaper must apply even when the forwarded ref is not populated on the first layout-effect pass.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceMainSurfaceEffects.ts
 */
import type * as React from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDesktopWorkspaceMainSurfaceEffects } from '../useDesktopWorkspaceMainSurfaceEffects';

describe('useDesktopWorkspaceMainSurfaceEffects', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		document.documentElement.style.removeProperty('--desktop-accent-rgb');
	});

	it('applies image wallpaper through DOM fallback when desktop ref is initially empty', () => {
		const desktop = document.createElement('main');
		desktop.id = 'desktop-main';
		document.body.appendChild(desktop);
		const desktopAreaRef = {
			current: null,
		} as React.RefObject<HTMLElement | null>;

		renderHook(() =>
			useDesktopWorkspaceMainSurfaceEffects({
				accentRgb: '132 255 0',
				desktopAreaRef,
				desktopThemeVars: { '--desktop-bg-primary-rgb': '15 23 42' },
				effectiveTheme: 'dark',
				wallpaper: '/desktop-wallpapers/1.webp',
				storageLoading: false,
				reduceBackdropBlur: false,
				desktopFontBody: 'manrope',
				desktopFontDisplay: 'cinzel',
				desktopSceneDepth: 'immersive',
				wallpaperCrossfadeEnabled: true,
				styledTooltips: false,
			})
		);

		expect(desktop.style.backgroundImage).toContain(
			'/desktop-wallpapers/1.webp'
		);
		expect(desktop.style.backgroundSize).toBe('cover');
		expect(desktop.style.getPropertyValue('--desktop-accent-rgb')).toBe(
			'132 255 0'
		);
		expect(desktop.style.getPropertyValue('--desktop-font-family')).toContain(
			'Manrope'
		);
		expect(desktop.style.getPropertyValue('--desktop-font-display')).toContain(
			'Cinzel'
		);
		expect(desktop.getAttribute('data-desktop-scene-depth')).toBe('immersive');
		expect(desktop.getAttribute('data-desktop-styled-tooltips')).toBe('false');
	});
});
