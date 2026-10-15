import { describe, expect, it } from 'vitest';
import {
	buildDesktopSettingsFieldElementId,
	resolveWiredFieldElementId,
} from '../desktopSettingsFieldElementIds';

describe('desktopSettingsFieldElementIds', () => {
	it('builds stable field element ids', () => {
		expect(
			buildDesktopSettingsFieldElementId('desktop_config', 'wallpaper')
		).toBe('desktop-settings-field-desktop_config-wallpaper');
	});

	it('returns null for unwired storage-map fields', () => {
		expect(resolveWiredFieldElementId('desktop_items', 'metadata')).toBeNull();
		expect(resolveWiredFieldElementId('shell_state', 'ewa_hints')).toBeNull();
	});

	it('returns ids for wired controls', () => {
		expect(
			resolveWiredFieldElementId('profile_ui', 'desktop_taskbar_style')
		).toBe('desktop-settings-field-profile_ui-desktop_taskbar_style');
		expect(resolveWiredFieldElementId('shell_state', 'quiet_mode')).toBe(
			'desktop-settings-field-shell_state-quiet_mode'
		);
	});
});
