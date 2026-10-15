/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for merged Settings Performance tab bridge values.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `useDesktopWorkspaceSettingsPerformanceForPanel.ts`
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDesktopWorkspaceSettingsPerformanceForPanel } from '../useDesktopWorkspaceSettingsPerformanceForPanel';

describe('useDesktopWorkspaceSettingsPerformanceForPanel', () => {
	it('merges animations and backdrop blur toggles onto session performance', () => {
		const deferVisualPersistRef = { current: false };
		const updateDesktopVisualPreferences = vi.fn();
		const withProfileUiSaveIndicator = vi.fn(
			async (fn: () => Promise<void>) => {
				await fn();
			}
		);

		const { result } = renderHook(() =>
			useDesktopWorkspaceSettingsPerformanceForPanel({
				settingsPerformanceForPanel: {
					metrics: {
						fps: 60,
						renderTime: 1,
						memoryUsage: 0,
						windowCount: 2,
					},
					isHighPerformanceMode: false,
				},
				preferencesApp: {
					preferences: { ui: { animations_enabled: true } },
				} as never,
				desktopReduceBackdropBlur: false,
				deferVisualPersistRef,
				updateDesktopVisualPreferences,
				withProfileUiSaveIndicator,
			})
		);

		expect(result.current.animationsEnabled).toBe(true);
		expect(result.current.reduceBackdropBlurEnabled).toBe(false);
		expect(result.current.metrics.windowCount).toBe(2);
	});
});
