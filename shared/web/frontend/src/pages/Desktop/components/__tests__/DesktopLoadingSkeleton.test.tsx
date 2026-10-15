/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: desktop loading skeleton must not run infinite pulse animations (GPU budget).
 *
 * Related:
 * - DesktopLoadingSkeleton.tsx
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DesktopLoadingSkeleton } from '../DesktopLoadingSkeleton';

describe('DesktopLoadingSkeleton', () => {
	it('uses static icon/taskbar placeholders (no ew-skeleton-pulse / animate-pulse)', () => {
		const { container } = render(
			<DesktopLoadingSkeleton loadingLabel="Opening" />
		);
		expect(container.querySelector('.ew-skeleton-pulse')).toBeNull();
		expect(container.querySelector('.animate-pulse')).toBeNull();
		expect(
			container.querySelectorAll('[class*="w-14"]').length
		).toBeGreaterThan(0);
	});

	it('wraps recovery preloader in ambient-static', () => {
		const { container } = render(
			<DesktopLoadingSkeleton
				loadingLabel="Recovering"
				preloaderVariant="recovery"
			/>
		);
		expect(
			container.querySelector('.elite-recovery-ambient-static')
		).toBeTruthy();
	});
});
