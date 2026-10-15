/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for hotspot-driven Visual Studio live preview controls.
 *
 * Invariants:
 * - Extends `DesktopVisualStudioPreviewProps`; reuses profile onChange callbacks.
 *
 * Related:
 * - `DesktopVisualStudioPreview.tsx`, `DesktopSettingsVisualStudioSection.tsx`
 */

import type {
	DesktopFontBodyId,
	DesktopFontDisplayId,
	DesktopSceneDepth,
	DesktopShellMotionSpeed,
	DesktopShellParallaxIntensity,
	DesktopTaskbarStyle,
	DesktopWidgetsStyle,
	DesktopWindowStyle,
} from '@/types/profile';
import type { DesktopVisualStudioPreviewProps } from '../DesktopVisualStudioPreview';
import type {
	VisualStudioPreviewHotspotId,
	VisualStudioSettingsNavigateTarget,
} from '../desktopVisualStudioPreviewHotspots';
import type { DesktopSettingsVisualLabels } from '../desktopSettingsShared.types';

export type DesktopVisualStudioPreviewInteractiveProps =
	DesktopVisualStudioPreviewProps & {
		visualLabels: DesktopSettingsVisualLabels;
		onOpenWallpaperPicker: () => void;
		onDesktopWindowStyleChange: (value: DesktopWindowStyle) => void;
		onDesktopTaskbarStyleChange: (value: DesktopTaskbarStyle) => void;
		onDesktopWidgetsStyleChange: (value: DesktopWidgetsStyle) => void;
		onDesktopPanelOpacityChange: (value: number) => void;
		onDesktopSceneDepthChange: (value: DesktopSceneDepth) => void;
		onDesktopFontBodyChange: (value: DesktopFontBodyId) => void;
		onDesktopFontDisplayChange: (value: DesktopFontDisplayId) => void;
		onDesktopShellParallaxEnabledChange: (value: boolean) => void;
		onDesktopShellParallaxIntensityChange: (
			value: DesktopShellParallaxIntensity
		) => void;
		onDesktopShellWindowMorphEnabledChange: (value: boolean) => void;
		onDesktopShellMotionSpeedChange: (value: DesktopShellMotionSpeed) => void;
		onDesktopShellReduceMotionChange: (value: boolean) => void;
		onDesktopWallpaperCrossfadeChange: (value: boolean) => void;
		onDesktopStyledTooltipsChange: (value: boolean) => void;
		desktopWallpaperCrossfadeEnabled: boolean;
		desktopStyledTooltips: boolean;
		shellCheckboxClass: string;
		onNavigateSettingsField?: (
			target: VisualStudioSettingsNavigateTarget
		) => void;
	};

export type { VisualStudioPreviewHotspotId };
