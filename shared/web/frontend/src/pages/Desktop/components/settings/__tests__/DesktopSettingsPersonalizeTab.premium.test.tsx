/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium IA locks for Personalize tab: primary CTA + Fine-tune disclosure collapsed.
 *
 * Invariants:
 * - Idle wallpaper CTA is accent; try-on Save becomes primary when staging.
 *
 * Related:
 * - `DesktopSettingsPersonalizeTab.tsx`
 */
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../DesktopSettingsVisualStudioSection', () => ({
	DesktopSettingsVisualStudioSection: ({ layout }: { layout?: string }) => (
		<div data-testid={`vs-${layout ?? 'full'}`} />
	),
}));

vi.mock('../personalize/DesktopSettingsPersonalizeLanguageCard', () => ({
	DesktopSettingsPersonalizeLanguageCard: () => (
		<div data-testid="language-card" />
	),
}));

vi.mock('../personalize/DesktopSettingsPersonalizeThemeAccentCard', () => ({
	DesktopSettingsPersonalizeThemeAccentCard: () => (
		<div data-testid="theme-accent-card" />
	),
}));

vi.mock('../../hooks/useDesktopSettingsPersonalizeVisualStudioProps', () => ({
	useDesktopSettingsPersonalizeVisualStudioProps: () => ({}),
}));

import type { DesktopSettingsVisualLabels } from '../desktopSettingsShared.types';
import { DesktopSettingsPersonalizeTab } from '../DesktopSettingsPersonalizeTab';

type PersonalizeSectionProps = ComponentProps<
	typeof DesktopSettingsPersonalizeTab
>;

const shell = {
	windowStyle: 'aurora' as const,
	segmentClusterClass: 'segment',
	segmentTabClass: () => 'tab',
	checkboxClass: 'checkbox',
	statTileClass: 'stat',
};

const visualLabels = {
	windowStyle: { aurora: 'Aurora' },
	windowStyleDesc: { aurora: 'Aurora frame' },
	taskbarStyle: { aurora: 'Aurora' },
	iconStyle: { aurora: 'Aurora' },
	widgetsStyle: { aurora: 'Aurora' },
} as unknown as DesktopSettingsVisualLabels;

const baseProps: PersonalizeSectionProps = {
	theme: 'light' as const,
	onThemeChange: vi.fn(),
	accent: 'purple' as const,
	accentCustomHex: '#7c3aed',
	onAccentChange: vi.fn(),
	onAccentCustomHexChange: vi.fn(),
	wallpaper: 'gradient-aurora',
	onOpenWallpaperPicker: vi.fn(),
	selectedAccentName: 'Violet',
	desktopWindowStyle: 'aurora' as const,
	onDesktopWindowStyleChange: vi.fn(),
	desktopAccentFollowsWindowStyle: false,
	onDesktopAccentFollowsWindowStyleChange: vi.fn(),
	desktopTaskbarStyle: 'aurora' as const,
	onDesktopTaskbarStyleChange: vi.fn(),
	desktopIconStyle: 'aurora' as const,
	desktopWidgetsStyle: 'aurora' as const,
	onDesktopWidgetsStyleChange: vi.fn(),
	desktopPanelOpacity: 1,
	onDesktopPanelOpacityChange: vi.fn(),
	desktopUiScale: 1,
	onJumpToTab: vi.fn(),
	onApplyCuratedStyleSet: vi.fn(),
	shell,
	visualLabels,
	expansionSettings: {
		visualStylePresets: [],
		isSaving: false,
		addVisualStylePreset: vi.fn(),
		removeVisualStylePreset: vi.fn(),
	} as never,
	personalizationStagingActive: false,
	desktopSceneDepth: 'balanced' as const,
	onDesktopSceneDepthChange: vi.fn(),
	desktopFontBody: 'manrope' as const,
	onDesktopFontBodyChange: vi.fn(),
	desktopFontDisplay: 'system' as const,
	onDesktopFontDisplayChange: vi.fn(),
	desktopWallpaperCrossfadeEnabled: true,
	onDesktopWallpaperCrossfadeChange: vi.fn(),
	desktopStyledTooltips: true,
	onDesktopStyledTooltipsChange: vi.fn(),
	desktopShellReduceMotion: false,
	onDesktopShellReduceMotionChange: vi.fn(),
	desktopShellParallaxEnabled: true,
	onDesktopShellParallaxEnabledChange: vi.fn(),
	desktopShellParallaxIntensity: 'normal' as const,
	onDesktopShellParallaxIntensityChange: vi.fn(),
	desktopShellWindowMorphEnabled: true,
	onDesktopShellWindowMorphEnabledChange: vi.fn(),
	desktopShellMotionSpeed: 'normal' as const,
	onDesktopShellMotionSpeedChange: vi.fn(),
	isOnline: true,
	isConfigSaving: false,
	configSaveError: null,
};

describe('DesktopSettingsPersonalizeTab premium IA', () => {
	it('idle: wallpaper is primary CTA and Fine-tune starts collapsed', () => {
		render(<DesktopSettingsPersonalizeTab {...baseProps} />);

		const wallpaperCta = screen.getByTestId(
			'desktop-settings-wallpaper-primary-cta'
		);
		expect(wallpaperCta.className).toMatch(/bg-\(--desktop-surface-accent\)/);
		expect(
			screen.queryByTestId('desktop-settings-try-on-save-primary-cta')
		).toBeNull();
		expect(screen.getByTestId('desktop-settings-look-group')).toBeTruthy();
		expect(screen.getByTestId('desktop-settings-wallpaper-thumb')).toBeTruthy();

		const fineTune = screen.getByTestId(
			'desktop-settings-personalize-fine-tune'
		);
		expect(fineTune).not.toHaveAttribute('open');
		expect(
			screen.queryByTestId('desktop-settings-personalize-trust-strip')
		).toBeNull();
	});

	it('Empery curated presets sit after sticky preview, before Looks disclosure', () => {
		const { container } = render(
			<DesktopSettingsPersonalizeTab {...baseProps} />
		);
		const tab = container.querySelector(
			'[data-testid="desktop-settings-personalize-tab"]'
		);
		expect(tab).toBeTruthy();
		const curated = screen.getByTestId('desktop-settings-curated-presets');
		const preview = screen.getByTestId('vs-preview-only');
		const lookGroup = screen.getByTestId('desktop-settings-look-group');
		const looks = screen.getByTestId('desktop-settings-personalize-looks');
		expect(
			Boolean(
				preview.compareDocumentPosition(curated) &
					Node.DOCUMENT_POSITION_FOLLOWING
			)
		).toBe(true);
		expect(
			Boolean(
				curated.compareDocumentPosition(lookGroup) &
					Node.DOCUMENT_POSITION_FOLLOWING
			)
		).toBe(true);
		expect(
			Boolean(
				lookGroup.compareDocumentPosition(looks) &
					Node.DOCUMENT_POSITION_FOLLOWING
			)
		).toBe(true);
	});

	it('try-on: Save becomes primary inside sticky stack and wallpaper demotes', () => {
		const { container } = render(
			<DesktopSettingsPersonalizeTab
				{...baseProps}
				personalizationStagingActive
				onPersonalizationStagingCommit={vi.fn()}
				onPersonalizationStagingCancel={vi.fn()}
			/>
		);

		const sticky = container.querySelector('.sticky.top-0');
		const saveCta = screen.getByTestId(
			'desktop-settings-try-on-save-primary-cta'
		);
		expect(sticky?.contains(saveCta)).toBe(true);
		expect(saveCta.className).toMatch(/bg-\(--desktop-surface-accent\)/);
		const wallpaperCta = screen.getByTestId(
			'desktop-settings-wallpaper-primary-cta'
		);
		expect(wallpaperCta.className).not.toMatch(
			/bg-\(--desktop-surface-accent\)/
		);
	});
});
