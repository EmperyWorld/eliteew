import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_PREFERENCES } from '@/types/profile';
import {
	resolveDesktopShellMinimizeMs,
	resolveDesktopShellMotionPrefs,
} from '../resolveDesktopShellMotion';

describe('resolveDesktopShellMotion', () => {
	it('disables parallax and morph when shell reduce motion is on', () => {
		const prefs = resolveDesktopShellMotionPrefs({
			ui: {
				...DEFAULT_UI_PREFERENCES,
				desktop_shell_reduce_motion: true,
			},
		});
		expect(prefs.reduceMotion).toBe(true);
		expect(prefs.parallaxEnabled).toBe(false);
		expect(prefs.morphEnabled).toBe(false);
	});

	it('respects global animations_enabled=false', () => {
		const prefs = resolveDesktopShellMotionPrefs({
			ui: {
				...DEFAULT_UI_PREFERENCES,
				animations_enabled: false,
			},
		});
		expect(prefs.reduceMotion).toBe(true);
	});

	it('scales minimize duration by motion speed', () => {
		expect(resolveDesktopShellMinimizeMs('slow', false)).toBeGreaterThan(
			resolveDesktopShellMinimizeMs('fast', false)
		);
	});

	it('applies parallax intensity multiplier', () => {
		const subtle = resolveDesktopShellMotionPrefs({
			ui: {
				...DEFAULT_UI_PREFERENCES,
				desktop_shell_parallax_intensity: 'subtle',
			},
		});
		const strong = resolveDesktopShellMotionPrefs({
			ui: {
				...DEFAULT_UI_PREFERENCES,
				desktop_shell_parallax_intensity: 'strong',
			},
		});
		expect(strong.parallaxIntensityScale).toBeGreaterThan(
			subtle.parallaxIntensityScale
		);
	});

	it('Wave 4 dual-flag: reduce-motion still honors independently of parallax prefs', () => {
		const prefs = resolveDesktopShellMotionPrefs({
			ui: {
				...DEFAULT_UI_PREFERENCES,
				desktop_shell_reduce_motion: true,
				desktop_shell_parallax_enabled: true,
				desktop_shell_window_morph_enabled: true,
			},
			systemReduceMotion: false,
		});
		expect(prefs.reduceMotion).toBe(true);
		expect(prefs.parallaxEnabled).toBe(false);
		expect(prefs.morphEnabled).toBe(false);
	});
});
