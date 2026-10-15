import { describe, expect, it } from 'vitest';
import { DESKTOP_TASKBAR_STYLE_KEYS } from '@/types/profile';
import { DESKTOP_APP_STYLE_CONTRACT } from '../../components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '../../constants';
import {
	DESKTOP_ICON_SURFACE_STYLES,
	DESKTOP_TASKBAR_STYLE_PRESETS,
	DESKTOP_WINDOW_FRAME_STYLES,
	DESKTOP_WINDOW_TITLEBAR_STYLES,
	getDesktopWindowShellTier,
} from '../desktopVisualSystem';

const OPAQUE_SHELL_FORBIDDEN = [
	'backdrop-blur',
	'desktop-window-chameleon',
	'desktop-taskbar-chameleon',
] as const;

function assertOpaqueShellClassBundle(label: string, bundle: string): void {
	for (const token of OPAQUE_SHELL_FORBIDDEN) {
		expect(bundle, `${label} must not include ${token}`).not.toContain(token);
	}
}

describe('desktopVisualSystem opaque multi-theme presets', () => {
	it('maps neon/aurora/chameleon/premium to glass tier; noir to framed; paper to minimal', () => {
		expect(getDesktopWindowShellTier('neon')).toBe('glass');
		expect(getDesktopWindowShellTier('aurora')).toBe('glass');
		expect(getDesktopWindowShellTier('chameleon')).toBe('glass');
		expect(getDesktopWindowShellTier('premium')).toBe('glass');
		expect(getDesktopWindowShellTier('noir')).toBe('framed');
		expect(getDesktopWindowShellTier('paper')).toBe('minimal');
	});

	it('keeps distinct frame strings for glass, neon, and noir', () => {
		const glass = DESKTOP_WINDOW_FRAME_STYLES.glass.frame;
		const neon = DESKTOP_WINDOW_FRAME_STYLES.neon.frame;
		const noir = DESKTOP_WINDOW_FRAME_STYLES.noir.frame;
		expect(glass).not.toBe(neon);
		expect(glass).not.toBe(noir);
		expect(neon).not.toBe(noir);
		expect(neon).toContain('border-2 border-[rgb(var(--desktop-accent-rgb)');
		expect(noir).toContain(
			'[background-image:var(--desktop-chrome-noir-frame-bg)]'
		);
	});

	it('maps every style key to opaque frame/titlebar/taskbar surfaces', () => {
		for (const style of DESKTOP_TASKBAR_STYLE_KEYS) {
			const frame = DESKTOP_WINDOW_FRAME_STYLES[style];
			const titlebar = DESKTOP_WINDOW_TITLEBAR_STYLES[style];
			const taskbar = DESKTOP_TASKBAR_STYLE_PRESETS[style];
			const icon = DESKTOP_ICON_SURFACE_STYLES[style];

			assertOpaqueShellClassBundle(`${style}.frame`, frame.frame);
			assertOpaqueShellClassBundle(`${style}.content`, frame.content);
			assertOpaqueShellClassBundle(`${style}.titlebar.root`, titlebar.root);
			assertOpaqueShellClassBundle(
				`${style}.titlebar.controlGroup`,
				titlebar.controlGroup
			);
			assertOpaqueShellClassBundle(
				`${style}.taskbar.surfaceClassName`,
				taskbar.surfaceClassName
			);
			assertOpaqueShellClassBundle(`${style}.icon.appBox`, icon.appBox);
			assertOpaqueShellClassBundle(`${style}.icon.fileBox`, icon.fileBox);

			expect(taskbar.surfaceStyle?.backdropFilter).toBeUndefined();
			expect(taskbar.surfaceStyle?.WebkitBackdropFilter).toBeUndefined();
		}
	});

	it('keeps shared app chrome and overlays free of backdrop-blur', () => {
		const chromeBundle = Object.values(DESKTOP_APP_STYLE_CONTRACT).join(' ');
		const overlayBundle = Object.values(DESKTOP_OVERLAY).join(' ');
		assertOpaqueShellClassBundle('DESKTOP_APP_STYLE_CONTRACT', chromeBundle);
		assertOpaqueShellClassBundle('DESKTOP_OVERLAY', overlayBundle);
	});
});
