/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for AMKA run header quality hints (heuristic fallback + pulse panel wiring).
 *
 * Invariants:
 * - Mocks i18n only; no Marketing Cabinet page mount.
 *
 * Related:
 * - src/features/amka/AmkaRunQualityHints.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AmkaRunQualityHints } from './AmkaRunQualityHints';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('AmkaRunQualityHints', () => {
	it('renders heuristic fallback hint when plan_llm_status is heuristic_fallback', () => {
		render(
			<AmkaRunQualityHints planLlmStatus="heuristic_fallback" pulse={null} />
		);
		expect(
			screen.getByText('amkaView.heuristicFallbackUserHint')
		).toBeInTheDocument();
	});

	it('shows honest framing when run failed even without other hints', () => {
		render(
			<AmkaRunQualityHints runStatus="failed" pulse={null} projection={null} />
		);
		expect(
			screen.getByText('amkaView.pulseRunFailedTitle')
		).toBeInTheDocument();
		expect(screen.getByText('amkaView.pulseRunFailedLead')).toBeInTheDocument();
	});

	it('shows honest framing when run cancelled', () => {
		render(
			<AmkaRunQualityHints
				runStatus="cancelled"
				pulse={null}
				projection={null}
			/>
		);
		expect(
			screen.getByText('amkaView.pulseRunCancelledTitle')
		).toBeInTheDocument();
	});

	it('renders nothing when no hint and no pulse payload', () => {
		const { container } = render(<AmkaRunQualityHints />);
		expect(container.firstChild).toBeNull();
	});
});
