/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memo bundle for Visual Studio section props shared between preview-only and details-only layouts in Personalize tab.
 *
 * Invariants:
 * - Output shape matches `DesktopSettingsVisualStudioSectionProps` minus `layout`.
 *
 * Related:
 * - `components/settings/personalize/*`
 * - `DesktopSettingsVisualStudioSection.tsx`
 */

import { useMemo } from 'react';
import type { DesktopSettingsVisualStudioSectionProps } from '../components/settings/DesktopSettingsVisualStudioSection';
import type { DesktopSettingsPersonalizeVisualStudioInput } from '../components/settings/personalize/desktopSettingsPersonalize.types';

export type DesktopSettingsPersonalizeVisualStudioProps = Omit<
	DesktopSettingsVisualStudioSectionProps,
	'layout'
>;

export function useDesktopSettingsPersonalizeVisualStudioProps(
	input: DesktopSettingsPersonalizeVisualStudioInput
): DesktopSettingsPersonalizeVisualStudioProps {
	const {
		theme,
		wallpaper,
		selectedAccentName,
		desktopWindowStyle,
		onDesktopWindowStyleChange,
		desktopTaskbarStyle,
		onDesktopTaskbarStyleChange,
		desktopWidgetsStyle,
		onDesktopWidgetsStyleChange,
		desktopIconStyle,
		desktopPanelOpacity,
		onDesktopPanelOpacityChange,
		onOpenWallpaperPicker,
		visualLabels,
		desktopSceneDepth,
		onDesktopSceneDepthChange,
		desktopFontBody,
		onDesktopFontBodyChange,
		desktopFontDisplay,
		onDesktopFontDisplayChange,
		desktopWallpaperCrossfadeEnabled,
		onDesktopWallpaperCrossfadeChange,
		desktopStyledTooltips,
		onDesktopStyledTooltipsChange,
		desktopShellReduceMotion,
		onDesktopShellReduceMotionChange,
		desktopShellParallaxEnabled,
		onDesktopShellParallaxEnabledChange,
		desktopShellParallaxIntensity,
		onDesktopShellParallaxIntensityChange,
		desktopShellWindowMorphEnabled,
		onDesktopShellWindowMorphEnabledChange,
		desktopShellMotionSpeed,
		onDesktopShellMotionSpeedChange,
		onNavigateSettingsField,
		shell,
	} = input;

	return useMemo(
		() => ({
			theme,
			wallpaper,
			selectedAccentName,
			desktopWindowStyle,
			onDesktopWindowStyleChange,
			desktopTaskbarStyle,
			onDesktopTaskbarStyleChange,
			desktopWidgetsStyle,
			onDesktopWidgetsStyleChange,
			desktopIconStyle,
			desktopPanelOpacity,
			onDesktopPanelOpacityChange,
			onOpenWallpaperPicker,
			visualLabels,
			desktopSceneDepth,
			onDesktopSceneDepthChange,
			desktopFontBody,
			onDesktopFontBodyChange,
			desktopFontDisplay,
			onDesktopFontDisplayChange,
			desktopWallpaperCrossfadeEnabled,
			onDesktopWallpaperCrossfadeChange,
			desktopStyledTooltips,
			onDesktopStyledTooltipsChange,
			desktopShellReduceMotion,
			onDesktopShellReduceMotionChange,
			desktopShellParallaxEnabled,
			onDesktopShellParallaxEnabledChange,
			desktopShellParallaxIntensity,
			onDesktopShellParallaxIntensityChange,
			desktopShellWindowMorphEnabled,
			onDesktopShellWindowMorphEnabledChange,
			desktopShellMotionSpeed,
			onDesktopShellMotionSpeedChange,
			onNavigateSettingsField,
			shell,
		}),
		[
			theme,
			wallpaper,
			selectedAccentName,
			desktopWindowStyle,
			onDesktopWindowStyleChange,
			desktopTaskbarStyle,
			onDesktopTaskbarStyleChange,
			desktopWidgetsStyle,
			onDesktopWidgetsStyleChange,
			desktopIconStyle,
			desktopPanelOpacity,
			onDesktopPanelOpacityChange,
			onOpenWallpaperPicker,
			visualLabels,
			desktopSceneDepth,
			onDesktopSceneDepthChange,
			desktopFontBody,
			onDesktopFontBodyChange,
			desktopFontDisplay,
			onDesktopFontDisplayChange,
			desktopWallpaperCrossfadeEnabled,
			onDesktopWallpaperCrossfadeChange,
			desktopStyledTooltips,
			onDesktopStyledTooltipsChange,
			desktopShellReduceMotion,
			onDesktopShellReduceMotionChange,
			desktopShellParallaxEnabled,
			onDesktopShellParallaxEnabledChange,
			desktopShellParallaxIntensity,
			onDesktopShellParallaxIntensityChange,
			desktopShellWindowMorphEnabled,
			onDesktopShellWindowMorphEnabledChange,
			desktopShellMotionSpeed,
			onDesktopShellMotionSpeedChange,
			onNavigateSettingsField,
			shell,
		]
	);
}
