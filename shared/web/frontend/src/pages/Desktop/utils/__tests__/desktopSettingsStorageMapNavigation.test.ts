import { describe, expect, it } from 'vitest';
import { DESKTOP_SETTINGS_WIDGETS_ANCHORS } from '../../constants/desktopSettingsWidgetsAnchors';
import { resolveStorageMapFieldNavigateTarget } from '../desktopSettingsStorageMapNavigation';

describe('resolveStorageMapFieldNavigateTarget (widgets tab)', () => {
	it('maps timezone to widgets floating card with field id', () => {
		expect(
			resolveStorageMapFieldNavigateTarget('shell_state', 'timezone')
		).toEqual({
			tab: 'widgets',
			elementId: 'desktop-settings-field-shell_state-timezone',
		});
	});

	it('maps quiet_mode to widgets floating card field id', () => {
		const target = resolveStorageMapFieldNavigateTarget(
			'shell_state',
			'quiet_mode'
		);
		expect(target?.tab).toBe('widgets');
		expect(target?.elementId).toBe(
			'desktop-settings-field-shell_state-quiet_mode'
		);
		expect(DESKTOP_SETTINGS_WIDGETS_ANCHORS.floating).toBe(
			'desktop-settings-widgets-floating'
		);
	});

	it('maps widgets_layout to widgets panel anchor', () => {
		const target = resolveStorageMapFieldNavigateTarget(
			'shell_state',
			'widgets_layout'
		);
		expect(target?.tab).toBe('widgets');
		expect(target?.elementId).toBe(
			'desktop-settings-field-shell_state-widgets_layout'
		);
	});

	it('maps desktop_floating_widget_visible to widgets tab', () => {
		expect(
			resolveStorageMapFieldNavigateTarget(
				'profile_ui',
				'desktop_floating_widget_visible'
			)?.tab
		).toBe('widgets');
	});
});
