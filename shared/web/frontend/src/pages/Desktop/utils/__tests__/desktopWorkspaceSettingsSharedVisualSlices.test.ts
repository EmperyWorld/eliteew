/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for shared Settings visual slice builder.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `desktopWorkspaceSettingsSharedVisualSlices.ts`
 */

import { describe, expect, it } from 'vitest';
import { buildDesktopWorkspaceSettingsSharedVisualSlices } from '../desktopWorkspaceSettingsSharedVisualSlices';

describe('buildDesktopWorkspaceSettingsSharedVisualSlices', () => {
	it('mirrors accent-follows flag into accentRgb and shellStyles', () => {
		const slices = buildDesktopWorkspaceSettingsSharedVisualSlices({
			desktopVisualPreferences: {
				desktop_accent_follows_window_style: true,
				desktop_widgets_style: 'glass',
				desktop_panel_opacity: 0.8,
				desktop_reduce_backdrop_blur: true,
				desktop_font_body: 'manrope',
				desktop_scene_depth: 'balanced',
				desktop_wallpaper_crossfade_enabled: true,
				desktop_styled_tooltips: true,
			} as never,
			desktopWindowStyle: 'glass',
			accent: 'purple',
			accentCustomHex: '#aabbcc',
		});

		expect(slices.accentRgb.desktopAccentFollowsWindowStyle).toBe(true);
		expect(slices.shellStyles.desktopAccentFollowsWindowStyle).toBe(true);
		expect(slices.shellStyles.reduceBackdropBlur).toBe(true);
		expect(slices.accentRgb.accent).toBe('purple');
		expect(slices.mainSurfaceStudio.desktopFontBody).toBe('manrope');
		expect(slices.mainSurfaceStudio.desktopSceneDepth).toBe('balanced');
		expect(slices.mainSurfaceStudio.wallpaperCrossfadeEnabled).toBe(true);
	});
});
