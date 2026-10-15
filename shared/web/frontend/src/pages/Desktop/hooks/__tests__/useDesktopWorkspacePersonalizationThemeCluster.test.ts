/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for T37 personalization / wallpaper / theme cluster wiring.
 *
 * Invariants:
 * - deferVisualPersistRef tracks staging active; staging actions restore baseline on cancel.
 *
 * Related:
 * - hooks/useDesktopWorkspacePersonalizationThemeCluster.ts
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMinimalDesktopStateActions } from '../../__fixtures__/desktopTestHelpers';
import type { DesktopConfig } from '../../types/desktop.types';
import type { PersonalizationStagingBaseline } from '../../types/desktopWorkspacePersonalizationThemeCluster.types';

const surfaceWelcomeBridge = vi.hoisted(() =>
	vi.fn(() => ({
		wallpaper: 'wallpaper-a',
		setWallpaper: vi.fn(),
		showWP: false,
		setShowWP: vi.fn(),
		showNF: false,
		setShowNF: vi.fn(),
		showWelcome: false,
		setShowWelcome: vi.fn(),
	}))
);
const themeAccentHook = vi.hoisted(() =>
	vi.fn(() => ({
		theme: 'dark' as const,
		setTheme: vi.fn(),
		effectiveTheme: 'dark' as const,
		desktopEmbeddedAppTheme: 'dark-preset',
		desktopThemeVars: { '--x': '1' },
		accent: 'purple' as const,
		accentCustomHex: '#a855f7',
		setAccentChoice: vi.fn(),
		onAccentCustomHexChange: vi.fn(),
		toggleExplicitTheme: vi.fn(),
		applyCuratedDesktopConfigPreset: vi.fn(),
	}))
);
const welcomeOnboarding = vi.hoisted(() => vi.fn());

vi.mock('../useDesktopWorkspaceSurfaceWelcomeBridge', () => ({
	useDesktopWorkspaceSurfaceWelcomeBridge: surfaceWelcomeBridge,
}));
vi.mock('../useDesktopWorkspaceThemeAccent', () => ({
	useDesktopWorkspaceThemeAccent: themeAccentHook,
}));
vi.mock('../useDesktopWelcomeOnboarding', () => ({
	useDesktopWelcomeOnboarding: welcomeOnboarding,
	persistDesktopOnboardingDismissed: vi.fn(),
}));

import {
	useDesktopWorkspacePersonalizationStagingActions,
	useDesktopWorkspacePersonalizationThemeCluster,
} from '../useDesktopWorkspacePersonalizationThemeCluster';

const baseConfig = {
	theme: 'dark',
	wallpaper: 'bg-1',
	accent: 'purple',
	icon_size: 'medium',
	snap_to_grid: true,
	grid_step: 'medium',
} as DesktopConfig;

describe('useDesktopWorkspacePersonalizationThemeCluster', () => {
	it('wires welcome bridge and theme accent with defer ref', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspacePersonalizationThemeCluster({
				config: baseConfig,
				updateConfig: vi.fn(),
				storageLoading: false,
				state: {
					theme: 'dark',
					accent: 'purple',
					accentCustomHex: '#a855f7',
					wallpaper: 'bg-1',
					showWP: false,
					showNF: false,
					showWelcome: false,
				},
				actions: createMinimalDesktopStateActions(),
			})
		);

		expect(surfaceWelcomeBridge).toHaveBeenCalled();
		expect(themeAccentHook).toHaveBeenCalledWith(
			expect.objectContaining({
				deferConfigPersistRef: result.current.deferVisualPersistRef,
			})
		);
		expect(result.current.wallpaper).toBe('wallpaper-a');
		expect(result.current.personalizationStagingActive).toBe(false);
		expect(result.current.deferVisualPersistRef.current).toBe(false);
	});

	it('onWelcomeComplete dismisses welcome and can persist onboarding flag', async () => {
		const setShowWelcome = vi.fn();
		surfaceWelcomeBridge.mockReturnValueOnce({
			wallpaper: 'wallpaper-a',
			setWallpaper: vi.fn(),
			showWP: false,
			setShowWP: vi.fn(),
			showNF: false,
			setShowNF: vi.fn(),
			showWelcome: true,
			setShowWelcome,
		});
		const { persistDesktopOnboardingDismissed } = await import(
			'../useDesktopWelcomeOnboarding'
		);

		const { result } = renderHook(() =>
			useDesktopWorkspacePersonalizationThemeCluster({
				config: baseConfig,
				updateConfig: vi.fn(),
				storageLoading: false,
				state: {
					theme: 'dark',
					accent: 'purple',
					accentCustomHex: '#a855f7',
					wallpaper: 'bg-1',
					showWP: false,
					showNF: false,
					showWelcome: true,
				},
				actions: createMinimalDesktopStateActions(),
			})
		);

		act(() => {
			result.current.onWelcomeComplete({ dismissPermanently: true });
		});

		expect(setShowWelcome).toHaveBeenCalledWith(false);
		expect(persistDesktopOnboardingDismissed).toHaveBeenCalled();
	});
});

describe('useDesktopWorkspacePersonalizationStagingActions', () => {
	it('start captures baseline; cancel restores config and visual prefs', () => {
		const applyDesktopConfigSnapshotLocal = vi.fn();
		const setDesktopVisualPreferences = vi.fn();
		const setPersonalizationStagingActive = vi.fn();
		const personalizationBaselineRef = {
			current: null as PersonalizationStagingBaseline | null,
		};

		const visual = { desktop_icon_style: 'glass' } as never;

		const { result } = renderHook(() =>
			useDesktopWorkspacePersonalizationStagingActions({
				config: baseConfig,
				applyDesktopConfigSnapshotLocal,
				updateConfig: vi.fn(),
				desktopVisualPreferences: visual,
				desktopVisualPreferencesRef: { current: visual },
				setDesktopVisualPreferences,
				updateDesktopVisualPreferences: vi.fn(),
				setPersonalizationStagingActive,
				personalizationBaselineRef,
			})
		);

		act(() => {
			result.current.startPersonalizationStaging();
		});

		expect(setPersonalizationStagingActive).toHaveBeenCalledWith(true);
		expect(personalizationBaselineRef.current?.config.theme).toBe('dark');

		act(() => {
			result.current.cancelPersonalizationStaging();
		});

		expect(setPersonalizationStagingActive).toHaveBeenCalledWith(false);
		expect(applyDesktopConfigSnapshotLocal).toHaveBeenCalledWith(
			expect.objectContaining({ theme: 'dark' })
		);
		expect(setDesktopVisualPreferences).toHaveBeenCalledWith(visual);
		expect(personalizationBaselineRef.current).toBeNull();
	});

	it('commit persists config and visual preferences', async () => {
		const updateConfig = vi.fn(async () => undefined);
		const updateDesktopVisualPreferences = vi.fn(async () => undefined);
		const setPersonalizationStagingActive = vi.fn();
		const personalizationBaselineRef = {
			current: null as PersonalizationStagingBaseline | null,
		};
		const visual = { desktop_taskbar_style: 'solid' } as never;

		const { result } = renderHook(() =>
			useDesktopWorkspacePersonalizationStagingActions({
				config: baseConfig,
				applyDesktopConfigSnapshotLocal: vi.fn(),
				updateConfig,
				desktopVisualPreferences: visual,
				desktopVisualPreferencesRef: { current: visual },
				setDesktopVisualPreferences: vi.fn(),
				updateDesktopVisualPreferences,
				setPersonalizationStagingActive,
				personalizationBaselineRef,
			})
		);

		await act(async () => {
			await result.current.commitPersonalizationStaging();
		});

		expect(setPersonalizationStagingActive).toHaveBeenCalledWith(false);
		expect(updateConfig).toHaveBeenCalledWith(
			{
				theme: 'dark',
				wallpaper: 'bg-1',
				accent: 'purple',
				icon_size: 'medium',
				snap_to_grid: true,
				grid_step: 'medium',
			},
			{ persistRemote: true }
		);
		expect(updateDesktopVisualPreferences).toHaveBeenCalledWith(visual, {
			persist: true,
		});
	});
});
