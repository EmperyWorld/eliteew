/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit test for the AMKA entrypoint notice feature component.
 * It protects the user-facing access guidance while AMKA is still opened through Marketing Cabinet.
 *
 * Invariants:
 * - The test asserts i18n keys and class passthrough only; no Marketing Cabinet page rendering is needed.
 * - The component must remain usable from feature-boundary consumers.
 *
 * Related:
 * - src/features/amka/AmkaEntrypointNotice.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AmkaEntrypointNotice } from './AmkaEntrypointNotice';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('AmkaEntrypointNotice', () => {
	it('renders current entrypoint guidance from the AMKA feature boundary', () => {
		render(<AmkaEntrypointNotice className="custom-boundary" />);

		expect(
			screen.getByText('amkaView.entrypointCurrentLabel')
		).toBeInTheDocument();
		expect(
			screen.getByText((content) =>
				content.includes('amkaView.entrypointCurrentNote')
			)
		).toHaveClass('custom-boundary');
	});
});
