/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime lock — window legend click toggles in-place hotspot (does not navigate).
 *
 * Related:
 * - ../DesktopVisualStudioPreviewInteractive.tsx
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

vi.mock(
	'../desktopVisualStudioPreviewInteractive/hotspotPopoverContent',
	() => ({
		popoverTitle: () => 'window-title',
		renderHotspotPopoverContent: () => (
			<div data-testid="visual-studio-hotspot-popover-body" />
		),
	})
);

const visualLabels = {
	windowStyle: { aurora: 'Aurora' },
	windowStyleDesc: { aurora: 'Aurora frame' },
	taskbarStyle: { aurora: 'Aurora' },
	widgetsStyle: { aurora: 'Aurora' },
	iconStyle: { aurora: 'Aurora' },
} as unknown as DesktopSettingsVisualLabels;

describe('DesktopVisualStudioPreviewInteractive inline hotspots', () => {
	it('opens window hotspot in-place instead of navigating away', () => {
		const onNavigateSettingsField = vi.fn();
		render(
			<DesktopVisualStudioPreviewInteractive
				wallpaper="gradient-aurora"
				theme="dark"
				desktopWindowStyle="aurora"
				onDesktopWindowStyleChange={vi.fn()}
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
	});
});
