/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit test for the standalone AMKA projection summary component.
 * It protects the feature-owned rendering of projection stage and status counters.
 *
 * Invariants:
 * - Tests use feature-local types and do not import Marketing Cabinet page contracts.
 * - Missing projection behavior is covered by model helpers; this test focuses on visible summary output.
 *
 * Related:
 * - src/features/amka/AmkaProjectionSummary.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AmkaProjectionSummary } from './AmkaProjectionSummary';
import type { AmkaStandaloneProjection } from './amkaTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values ? `${key}:${JSON.stringify(values)}` : key,
	}),
}));

function projection(): AmkaStandaloneProjection {
	return {
		driver_key: 'static_read_only',
		domain_profile: 'read_only_audit',
		subject: { subject_id: 'doc-1' },
		status: 'completed',
		current_stage: 'final',
		stage_counts: { snapshot: 2, final: 1 },
		step_status_counts: { completed: 1 },
		trace_events: [{ stage: 'final', event: 'pulse.ready' }],
		contract: { read: true, pulse: true },
	};
}

describe('AmkaProjectionSummary', () => {
	it('renders projection summary, stage counters, and status counters', () => {
		render(<AmkaProjectionSummary projection={projection()} />);

		expect(screen.getByText('amkaView.projectionTitle')).toBeInTheDocument();
		expect(screen.getByText(/"driver":"static_read_only"/)).toBeInTheDocument();
		expect(screen.getByText('snapshot: 2')).toBeInTheDocument();
		expect(screen.getByText('final: 1')).toBeInTheDocument();
		expect(
			screen.getByText('amkaView.projectionStatusCountsTitle')
		).toBeInTheDocument();
		expect(screen.getByText('completed: 1')).toBeInTheDocument();
	});
});
