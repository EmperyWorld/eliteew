/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Personalize Visual Studio props facade hook.
 *
 * Invariants:
 * - Callback refs and scalar fields pass through unchanged to Visual Studio section props.
 *
 * Related:
 * - `hooks/useDesktopSettingsPersonalizeVisualStudioProps.ts`
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopWindowStyle } from '@/types/profile';
import { useDesktopSettingsPersonalizeVisualStudioProps } from '../../hooks/useDesktopSettingsPersonalizeVisualStudioProps';
import type { DesktopSettingsPersonalizeVisualStudioInput } from '../../components/settings/personalize/desktopSettingsPersonalize.types';

const auroraWindowStyle = 'aurora' satisfies DesktopWindowStyle;

function buildInput(): DesktopSettingsPersonalizeVisualStudioInput {
	const onNavigateSettingsField = vi.fn();
	return {
		theme: 'dark',
		wallpaper: 'gradient-aurora',
		selectedAccentName: 'Violet',
		desktopWindowStyle: auroraWindowStyle,
		onDesktopWindowStyleChange: vi.fn(),
		desktopTaskbarStyle: 'glass',
		onDesktopTaskbarStyleChange: vi.fn(),
		desktopWidgetsStyle: auroraWindowStyle,
		onDesktopWidgetsStyleChange: vi.fn(),
		desktopIconStyle: 'glass',
		desktopPanelOpacity: 0.85,
		onDesktopPanelOpacityChange: vi.fn(),
		onOpenWallpaperPicker: vi.fn(),
		visualLabels: {
			windowStyle: { aurora: 'Aurora' },
			windowStyleDesc: { aurora: 'Aurora frame' },
			taskbarStyle: { glass: 'Glass' },
			iconStyle: { glass: 'Glass' },
			widgetsStyle: { aurora: 'Aurora' },
		} as unknown as DesktopSettingsPersonalizeVisualStudioInput['visualLabels'],
		desktopSceneDepth: 'balanced',
		onDesktopSceneDepthChange: vi.fn(),
		desktopFontBody: 'manrope',
		onDesktopFontBodyChange: vi.fn(),
		desktopFontDisplay: 'system',
		onDesktopFontDisplayChange: vi.fn(),
		desktopWallpaperCrossfadeEnabled: true,
		onDesktopWallpaperCrossfadeChange: vi.fn(),
		desktopStyledTooltips: true,
		onDesktopStyledTooltipsChange: vi.fn(),
		desktopShellReduceMotion: false,
		onDesktopShellReduceMotionChange: vi.fn(),
		desktopShellParallaxEnabled: true,
		onDesktopShellParallaxEnabledChange: vi.fn(),
		desktopShellParallaxIntensity: 'normal',
		onDesktopShellParallaxIntensityChange: vi.fn(),
		desktopShellWindowMorphEnabled: true,
		onDesktopShellWindowMorphEnabledChange: vi.fn(),
		desktopShellMotionSpeed: 'normal',
		onDesktopShellMotionSpeedChange: vi.fn(),
		onNavigateSettingsField,
		shell: {
			windowStyle: auroraWindowStyle,
			segmentClusterClass: 'segment',
			segmentTabClass: () => 'tab',
			checkboxClass: 'checkbox',
			statTileClass: 'stat',
		},
	};
}

describe('useDesktopSettingsPersonalizeVisualStudioProps', () => {
	it('mirrors input into Visual Studio section props', () => {
		const input = buildInput();
		const { result } = renderHook(() =>
			useDesktopSettingsPersonalizeVisualStudioProps(input)
		);

		expect(result.current.theme).toBe('dark');
		expect(result.current.selectedAccentName).toBe('Violet');
		expect(result.current.desktopWindowStyle).toBe('aurora');
		expect(result.current.onDesktopFontBodyChange).toBe(
			input.onDesktopFontBodyChange
		);
		expect(result.current.onNavigateSettingsField).toBe(
			input.onNavigateSettingsField
		);
		expect(result.current.shell.windowStyle).toBe('aurora');
	});

	it('returns stable reference when input object is stable', () => {
		const input = buildInput();
		const { result, rerender } = renderHook(() =>
			useDesktopSettingsPersonalizeVisualStudioProps(input)
		);
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});
});
