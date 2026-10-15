/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke tests for `AmkaStepRunningBanner` (running strip + focus hint).
 *
 * Invariants:
 * - Uses a stub `t` / i18n function (no full i18n tree).
 *
 * Related:
 * - src/features/amka/AmkaStepRunningBanner.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AmkaStepRunningBanner } from './AmkaStepRunningBanner';

function stubT(key: string): string {
	return key;
}

describe('AmkaStepRunningBanner', () => {
	it('renders nothing without a running step', () => {
		const { container } = render(
			<AmkaStepRunningBanner
				runningStep={null}
				stepPageSafeIndex={0}
				runningStepIndex={null}
				t={stubT as never}
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it('shows focus hint when pager is not on the running step', () => {
		render(
			<AmkaStepRunningBanner
				runningStep={{ ordinal: 2, title: 'Test step' }}
				stepPageSafeIndex={0}
				runningStepIndex={1}
				t={stubT as never}
			/>
		);
		expect(screen.getByText('amkaView.stepsPagerFocusHint')).toBeTruthy();
	});

	it('hides focus hint when pager matches running step index', () => {
		render(
			<AmkaStepRunningBanner
				runningStep={{ ordinal: 2, title: 'Test step' }}
				stepPageSafeIndex={1}
				runningStepIndex={1}
				t={stubT as never}
			/>
		);
		expect(screen.queryByText('amkaView.stepsPagerFocusHint')).toBeNull();
	});

	it('shows ensemble running hint for desktop_ensemble mode', () => {
		render(
			<AmkaStepRunningBanner
				runningStep={{
					ordinal: 19,
					title: 'Evidence synthesis',
					executionMode: 'desktop_ensemble',
				}}
				stepPageSafeIndex={18}
				runningStepIndex={18}
				t={stubT as never}
			/>
		);
		expect(screen.getByText('amkaView.ensembleRunningHint')).toBeTruthy();
	});
});
