import { describe, expect, it } from 'vitest';
import type { DesktopWorkspaceVisualPreferenceState } from '../../hooks/useDesktopWorkspaceVisualProfileBridge';
import type { DesktopConfig } from '../../types/desktop.types';
import {
	buildDesktopVisualProfilePackJson,
	DESKTOP_VISUAL_PROFILE_PACK_KIND,
	DESKTOP_VISUAL_PROFILE_PACK_VERSION,
	parseDesktopVisualProfilePack,
} from '../desktopVisualProfilePack';

const sampleConfig = {
	user_id: 'test-user',
	wallpaper: '/desktop-wallpapers/2.webp',
	show_widget: false,
	widget_position: { x: 0, y: 0 },
	theme: 'dark',
	accent: 'blue',
	icon_size: 'medium' as const,
	snap_to_grid: false,
	grid_step: 'medium' as const,
} satisfies DesktopConfig;

const minimalVisual: DesktopWorkspaceVisualPreferenceState = {
	desktop_open_apps_maximized: false,
	desktop_floating_widget_visible: true,
	desktop_icon_style: 'glass',
	desktop_scene_depth: 'balanced',
	desktop_taskbar_style: 'glass',
	desktop_window_style: 'glass',
	desktop_accent_follows_window_style: false,
	desktop_widgets_style: 'glass',
	desktop_panel_opacity: 0.92,
	desktop_ui_scale: 1,
	desktop_reduce_backdrop_blur: true,
	desktop_font_body: 'manrope',
	desktop_font_display: 'system',
	desktop_wallpaper_crossfade_enabled: true,
	desktop_styled_tooltips: true,
	desktop_shell_reduce_motion: false,
	desktop_shell_parallax_enabled: true,
	desktop_shell_parallax_intensity: 'normal',
	desktop_shell_window_morph_enabled: true,
	desktop_shell_motion_speed: 'normal',
};

describe('desktopVisualProfilePack', () => {
	it('serializes round-trip stable fields', () => {
		const json = buildDesktopVisualProfilePackJson({
			config: sampleConfig,
			visual: minimalVisual,
		});
		const parsed = parseDesktopVisualProfilePack(json);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.data.config.theme).toBe('dark');
		expect(parsed.data.config.wallpaper).toBe('/desktop-wallpapers/2.webp');
		expect(parsed.data.visual.desktop_reduce_backdrop_blur).toBe(true);
		expect(parsed.data.visual.desktop_panel_opacity).toBeGreaterThanOrEqual(
			0.35
		);
		expect(JSON.parse(json).version).toBe(DESKTOP_VISUAL_PROFILE_PACK_VERSION);
	});

	it('parses legacy v1 envelope', () => {
		const blob = `${JSON.stringify({
			kind: DESKTOP_VISUAL_PROFILE_PACK_KIND,
			version: 1,
			exportedAt: '2099-01-01',
			config: {
				theme: 'dark',
				wallpaper: '/desktop-wallpapers/1.webp',
				accent: 'blue',
				icon_size: 'medium',
				snap_to_grid: false,
				grid_step: 'medium',
			},
			visual: {
				desktop_reduce_backdrop_blur: false,
			},
			shell: { workspace_profiles: { profiles: [{ id: 'x' }] } },
		})}`;
		const r = parseDesktopVisualProfilePack(blob);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data.shell).toBeUndefined();
	});

	it('round-trips shell slices in current export format', () => {
		const json = buildDesktopVisualProfilePackJson({
			config: sampleConfig,
			visual: minimalVisual,
			shell: {
				workspace_profiles: {
					profiles: [{ id: 'wp1', name: 'Test profile' }] as Record<
						string,
						unknown
					>[],
				},
				window_layout_presets: [{ id: 'ly1', name: 'Wide' }] as Record<
					string,
					unknown
				>[],
			},
		});
		const r = parseDesktopVisualProfilePack(json);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data.shell?.workspace_profiles?.profiles?.[0]).toMatchObject({
			id: 'wp1',
		});
		expect(r.data.shell?.window_layout_presets?.[0]).toMatchObject({
			id: 'ly1',
		});
	});

	it('rejects wrong kind and bad json', () => {
		expect(parseDesktopVisualProfilePack('not json')).toEqual({
			ok: false,
			error: 'invalid_json',
		});
		expect(
			parseDesktopVisualProfilePack(
				JSON.stringify({ kind: 'other', version: 1 })
			)
		).toEqual({
			ok: false,
			error: 'wrong_kind',
		});
		expect(
			parseDesktopVisualProfilePack(
				JSON.stringify({
					kind: DESKTOP_VISUAL_PROFILE_PACK_KIND,
					version: 999,
				})
			)
		).toEqual({
			ok: false,
			error: 'unsupported_version',
		});
	});

	it('replaces oversized data wallpapers with builtin ref on export', () => {
		const huge = `${'data:image/png;base64,'}${'x'.repeat(49_500)}`;
		const json = buildDesktopVisualProfilePackJson({
			config: { ...sampleConfig, wallpaper: huge },
			visual: minimalVisual,
		});
		expect(JSON.parse(json) as { droppedHeavyWallpaper?: boolean }).toEqual(
			expect.objectContaining({ droppedHeavyWallpaper: true })
		);
		const parsed = parseDesktopVisualProfilePack(json);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.data.config.wallpaper.startsWith('data:')).toBe(false);
	});
});
