/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: floating-widget canvas path always receives QUIET performance (no ~1s FPS churn).
 *
 * Related:
 * - useDesktopWorkspaceShellPerformanceBridge.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QUIET_FLOATING_WIDGET_PERFORMANCE } from '../../utils/desktopWorkspacePerformanceConstants';
import { useDesktopWorkspaceShellPerformanceBridge } from '../useDesktopWorkspaceShellPerformanceBridge';

describe('useDesktopWorkspaceShellPerformanceBridge', () => {
	it('always returns QUIET stub for floatingWidgetPerformanceForCanvas', () => {
		const performance = {
			metrics: {
				fps: 42,
				renderTime: 16,
				memoryUsage: 100,
				windowCount: 3,
				activeAdapters: 1,
				suspendedAdapters: 0,
				pausedEffects: 0,
				backgroundInvalidationsPerMin: 0,
				longTaskSupported: false,
				longTaskCount: 0,
				lastLongTaskMs: null,
				lastAction: null,
				actionSampleCount: 0,
			},
			isHighPerformanceMode: false,
			preferAggressiveBackgroundSuspend: false,
			recommendations: [],
			setPreferAggressiveBackgroundSuspend: () => undefined,
		};

		const { result, rerender } = renderHook(
			(props: { fps: number }) =>
				useDesktopWorkspaceShellPerformanceBridge({
					performance: {
						...performance,
						metrics: { ...performance.metrics, fps: props.fps },
					} as never,
					currentDesktopWindows: [],
					isShellSettingsWindowOpen: false,
					desktopSettingsActiveTab: 'personalize',
				}),
			{ initialProps: { fps: 42 } }
		);

		expect(result.current.floatingWidgetPerformanceForCanvas).toBe(
			QUIET_FLOATING_WIDGET_PERFORMANCE
		);

		rerender({ fps: 60 });
		expect(result.current.floatingWidgetPerformanceForCanvas).toBe(
			QUIET_FLOATING_WIDGET_PERFORMANCE
		);
	});
});
