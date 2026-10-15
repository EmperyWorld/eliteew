/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Storage map entries for Settings expansion panel (where data lives).
 *
 * Invariants:
 * - Labels/descriptions come from desktopUi i18n via caller `t`.
 *
 * Related:
 * - useDesktopExpansionSettings.ts
 */

import type { TFunction } from 'i18next';
import type { DesktopExpansionSettings } from '../../types/desktopExpansion.types';

export function buildExpansionStorageMap(
	t: TFunction<'desktopUi'>
): DesktopExpansionSettings['storageMap'] {
	return [
		{
			id: 'desktop-config',
			label: t('settingsPanel.storageMapDesktopConfigTitle'),
			description: t('settingsPanel.storageMapDesktopConfigDesc'),
			bucket: 'desktop_config' as const,
			fields: [
				'wallpaper',
				'wallpapers_history',
				'theme',
				'accent_color',
				'icon_size',
				'snap_to_grid',
				'grid_step',
				'live_wallpaper',
				'show_widget',
				'widget_position',
				'show_widgets_panel',
				'widgets_panel_position',
				'compact_widgets',
			],
		},
		{
			id: 'desktop-items',
			label: t('settingsPanel.storageMapDesktopItemsTitle'),
			description: t('settingsPanel.storageMapDesktopItemsDesc'),
			bucket: 'desktop_items' as const,
			fields: [
				'name',
				'type',
				'position',
				'is_pinned',
				'parent_id',
				'app_component',
				'system_key',
				'content_id',
				'folder_id',
				'metadata',
			],
		},
		{
			id: 'profile-ui',
			label: t('settingsPanel.storageMapProfileUiTitle'),
			description: t('settingsPanel.storageMapProfileUiDesc'),
			bucket: 'profile_ui' as const,
			fields: [
				'desktop_window_style',
				'desktop_taskbar_style',
				'desktop_icon_style',
				'desktop_widgets_style',
				'desktop_panel_opacity',
				'desktop_ui_scale',
				'desktop_scene_depth',
				'desktop_font_body',
				'desktop_font_display',
				'desktop_wallpaper_crossfade_enabled',
				'desktop_styled_tooltips',
				'desktop_shell_reduce_motion',
				'desktop_shell_parallax_enabled',
				'desktop_shell_parallax_intensity',
				'desktop_shell_window_morph_enabled',
				'desktop_shell_motion_speed',
				'desktop_menu_mode',
				'desktop_accent_follows_window_style',
				'desktop_open_apps_maximized',
				'desktop_floating_widget_visible',
				'desktop_reduce_backdrop_blur',
				'animations_enabled',
				'compact_mode',
				'default_view',
				'sidebar_collapsed',
			],
		},
		{
			id: 'shell-state',
			label: t('settingsPanel.storageMapShellStateTitle'),
			description: t('settingsPanel.storageMapShellStateDesc'),
			bucket: 'shell_state' as const,
			fields: [
				'virtual_desktops',
				'windows_snapshot',
				'workspace_profiles',
				'window_layout_presets',
				'widgets_layout',
				'app_collections',
				'content_shortcuts',
				'assistant_context_actions',
				'visual_style_presets',
				'recent_app_ids',
				'recent_app_ids_by_desktop',
				'recent_file_ids',
				'clipboard_history',
				'clock_show_seconds',
				'timezone',
				'quiet_mode',
				'tray_show_feedback',
				'tray_show_assistant',
				'now_playing',
				'gaf_chat_sound_enabled',
				'music_playlists',
				'ewa_hints',
			],
		},
		{
			id: 'local-session',
			label: t('settingsPanel.storageMapLocalSessionTitle'),
			description: t('settingsPanel.storageMapLocalSessionDesc'),
			bucket: 'local_session' as const,
			fields: [
				'performance_telemetry',
				'window_drag',
				'modal_focus',
				'personalization_staging',
				'persist_patch_queue',
			],
		},
	];
}
