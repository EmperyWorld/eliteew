/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock welcome-tour step resolve: keep highlightSelector when the DOM target
 * is not painted yet (widgets example mounts on prepare).
 *
 * Related:
 * - useDesktopWelcomeGuideSteps.ts, desktopWelcomeTourSession.ts
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { setDesktopWelcomeTourStep } from '../desktopWelcomeTourSession';
import { useDesktopWelcomeGuideSteps } from '../useDesktopWelcomeGuideSteps';

afterEach(() => {
	setDesktopWelcomeTourStep(null);
});

describe('useDesktopWelcomeGuideSteps', () => {
	it('keeps widgets and favorites selectors when the panel is not mounted yet', () => {
		const t = ((key: string) => key) as TFunction;
		const { result } = renderHook(() => useDesktopWelcomeGuideSteps(t, 0));
		const widgets = result.current.find((step) => step.id === 'widgets-panel');
		const favorites = result.current.find(
			(step) => step.id === 'favorites-widget'
		);
		expect(widgets?.highlightSelector).toBe(
			'[data-desktop-welcome-guide="widgets-panel"]'
		);
		expect(favorites?.highlightSelector).toBe(
			'[data-desktop-welcome-guide="favorites-widget"]'
		);
		expect(widgets?.demoAction).toBe('click');
		expect(favorites?.demoAction).toBe('click');
	});
});
