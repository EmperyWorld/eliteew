/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render smoke for Personalize presets facade cluster.
 *
 * Invariants:
 * - Empty visual preset list shows empty-state copy.
 *
 * Related:
 * - `settings/personalize/DesktopSettingsPersonalizePresetsFacade.tsx`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

import type {
	DesktopSettingsShellHelpers,
	DesktopSettingsVisualLabels,
} from '../desktopSettingsShared.types';
import { DesktopSettingsPersonalizePresetsFacade } from '../personalize/DesktopSettingsPersonalizePresetsFacade';

const shell = {
	windowStyle: 'glass',
	segmentClusterClass: 'segment',
	segmentTabClass: () => 'tab',
	checkboxClass: 'checkbox',
	statTileClass: 'stat',
} satisfies DesktopSettingsShellHelpers;

const visualLabels = {
	iconSize: { small: 'S', medium: 'M', large: 'L' },
	gridStep: { small: 'S', medium: 'M', large: 'L' },
	windowStyle: { glass: 'Glass' },
	windowStyleDesc: { glass: 'Glass frame' },
	iconStyle: { glass: 'Glass' },
	iconStyleDesc: { glass: 'Glass icons' },
} as unknown as DesktopSettingsVisualLabels;

describe('DesktopSettingsPersonalizePresetsFacade', () => {
	it('shows empty visual presets copy', () => {
		render(
			<DesktopSettingsPersonalizePresetsFacade
				theme="dark"
				accent="purple"
				accentCustomHex="#7c3aed"
				wallpaper="gradient-aurora"
				desktopWindowStyle="glass"
				desktopAccentFollowsWindowStyle={false}
				desktopTaskbarStyle="glass"
				desktopIconStyle="glass"
				desktopWidgetsStyle="glass"
				desktopPanelOpacity={0.85}
				desktopUiScale={1}
				desktopSceneDepth="balanced"
				desktopFontBody="manrope"
				desktopFontDisplay="system"
				desktopWallpaperCrossfadeEnabled
				desktopStyledTooltips
				expansionSettings={
					{
						visualStylePresets: [],
						isSaving: false,
						addVisualStylePreset: vi.fn(),
						removeVisualStylePreset: vi.fn(),
					} as never
				}
				personalizationStagingActive={false}
				shell={shell}
				visualLabels={visualLabels}
			/>
		);

		expect(screen.getByText('settingsPanel.visualPresetsEmpty')).toBeTruthy();
		expect(
			screen.getByText('settingsPanel.personalizeTryOnStart')
		).toBeTruthy();
		expect(
			screen.getByTestId('desktop-settings-personalize-advanced-pack')
		).not.toHaveAttribute('open');
	});

	it('staging active: points to banner instead of duplicate Save/Discard', () => {
		render(
			<DesktopSettingsPersonalizePresetsFacade
				theme="dark"
				accent="purple"
				accentCustomHex="#7c3aed"
				wallpaper="gradient-aurora"
				desktopWindowStyle="glass"
				desktopAccentFollowsWindowStyle={false}
				desktopTaskbarStyle="glass"
				desktopIconStyle="glass"
				desktopWidgetsStyle="glass"
				desktopPanelOpacity={0.85}
				desktopUiScale={1}
				desktopSceneDepth="balanced"
				desktopFontBody="manrope"
				desktopFontDisplay="system"
				desktopWallpaperCrossfadeEnabled
				desktopStyledTooltips
				expansionSettings={
					{
						visualStylePresets: [],
						isSaving: false,
						addVisualStylePreset: vi.fn(),
						removeVisualStylePreset: vi.fn(),
					} as never
				}
				personalizationStagingActive
				onPersonalizationStagingCommit={vi.fn()}
				onPersonalizationStagingCancel={vi.fn()}
				shell={shell}
				visualLabels={visualLabels}
			/>
		);

		expect(
			screen.getByTestId('desktop-settings-try-on-banner-pointer')
		).toBeTruthy();
		expect(screen.queryByText('settingsPanel.personalizeTryOnSave')).toBeNull();
		expect(
			screen.queryByText('settingsPanel.personalizeTryOnDiscard')
		).toBeNull();
	});
});
