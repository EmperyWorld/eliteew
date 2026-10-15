/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock — in-place window style pick from Visual Studio popover
 * calls onDesktopWindowStyleChange (no navigate-away).
 *
 * Related:
 * - ../desktopVisualStudioPreviewInteractive/*
 * - documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopVisualStudioPreviewInteractive } from '../desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive';
import type { DesktopSettingsVisualLabels } from '../desktopSettingsShared.types';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../DesktopVisualStudioPreview', () => ({
	DesktopVisualStudioPreview: () => (
		<div data-testid="visual-studio-preview-stub" />
	),
}));

vi.mock(
	'../desktopVisualStudioPreviewInteractive/VisualStudioHotspotPopover',
	() => ({
		VisualStudioHotspotPopover: ({
			open,
			children,
		}: {
			open: boolean;
			children?: React.ReactNode;
		}) =>
			open ? (
				<div data-testid="visual-studio-hotspot-popover-open">{children}</div>
			) : null,
	})
);

vi.mock('../desktopSettingsPreviewComponents', () => ({
	DesktopWindowStyleMiniPreview: () => <div data-testid="window-mini" />,
	DesktopTaskbarStyleMiniPreview: () => <div data-testid="taskbar-mini" />,
	DesktopWidgetsStyleMiniPreview: () => <div data-testid="widget-mini" />,
}));

const STYLE_KEYS = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
] as const;

const visualLabels = {
	windowStyle: Object.fromEntries(
		STYLE_KEYS.map((key) => [key, key === 'glass' ? 'Glass' : key])
	),
	windowStyleDesc: Object.fromEntries(
		STYLE_KEYS.map((key) => [key, `${key} frame`])
	),
	taskbarStyle: {},
	widgetsStyle: {},
	iconStyle: {},
} as unknown as DesktopSettingsVisualLabels;

describe('DesktopVisualStudioPreviewInteractive style picker', () => {
	it('window legend opens popover and style click fires onChange', () => {
		const onNavigateSettingsField = vi.fn();
		const onDesktopWindowStyleChange = vi.fn();
		render(
			<DesktopVisualStudioPreviewInteractive
				wallpaper="gradient-aurora"
				theme="dark"
				desktopWindowStyle="aurora"
				onDesktopWindowStyleChange={onDesktopWindowStyleChange}
				desktopTaskbarStyle="aurora"
				onDesktopTaskbarStyleChange={vi.fn()}
				desktopWidgetsStyle="aurora"
				onDesktopWidgetsStyleChange={vi.fn()}
				desktopIconStyle="aurora"
				desktopPanelOpacity={1}
				onDesktopPanelOpacityChange={vi.fn()}
				desktopSceneDepth="balanced"
				onDesktopSceneDepthChange={vi.fn()}
				desktopFontBody="manrope"
				onDesktopFontBodyChange={vi.fn()}
				desktopFontDisplay="system"
				onDesktopFontDisplayChange={vi.fn()}
				accentLabel="Violet"
				desktopShellReduceMotion={false}
				onDesktopShellReduceMotionChange={vi.fn()}
				desktopShellParallaxEnabled={false}
				onDesktopShellParallaxEnabledChange={vi.fn()}
				desktopShellParallaxIntensity="normal"
				onDesktopShellParallaxIntensityChange={vi.fn()}
				desktopShellWindowMorphEnabled={false}
				onDesktopShellWindowMorphEnabledChange={vi.fn()}
				desktopShellMotionSpeed="normal"
				onDesktopShellMotionSpeedChange={vi.fn()}
				desktopWallpaperCrossfadeEnabled={false}
				onDesktopWallpaperCrossfadeChange={vi.fn()}
				desktopStyledTooltips={false}
				onDesktopStyledTooltipsChange={vi.fn()}
				onOpenWallpaperPicker={vi.fn()}
				visualLabels={visualLabels}
				shellCheckboxClass="checkbox"
				onNavigateSettingsField={onNavigateSettingsField}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'settingsPanel.visualStudio.hotspotLegendWindow',
			})
		);

		expect(onNavigateSettingsField).not.toHaveBeenCalled();
		expect(
			screen.getByTestId('visual-studio-hotspot-popover-open')
		).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Glass' }));
		expect(onDesktopWindowStyleChange).toHaveBeenCalledWith('glass');
	});
});
