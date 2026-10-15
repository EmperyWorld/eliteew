/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for the core-alignment panel that loads AmkaCoreEngine snapshots per marketing run.
 *
 * Invariants:
 * - useAmkaCoreAlignment is mocked; no HTTP.
 * - Visible copy resolves through marketing i18n keys in tests.
 *
 * Related:
 * - src/features/amka/AmkaCoreAlignmentSection.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AmkaCoreAlignmentSection } from './AmkaCoreAlignmentSection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_k: string, opts?: { count?: number }) =>
			opts?.count != null ? `${opts.count}` : _k,
	}),
}));

const mockUseAmkaCoreAlignment = vi.fn();

vi.mock('@/hooks/api/useAmka', () => ({
	useAmkaCoreAlignment: (runId: string | undefined) =>
		mockUseAmkaCoreAlignment(runId),
}));

describe('AmkaCoreAlignmentSection', () => {
	it('returns null when no run is selected', () => {
		mockUseAmkaCoreAlignment.mockReturnValue({ isLoading: false });
		const { container } = render(<AmkaCoreAlignmentSection runId={null} />);
		expect(container.firstChild).toBeNull();
	});

	it('renders loading state', () => {
		mockUseAmkaCoreAlignment.mockReturnValue({ isLoading: true });
		render(<AmkaCoreAlignmentSection runId="run-1" />);
		expect(
			screen.getByText('amkaView.coreAlignmentLoading')
		).toBeInTheDocument();
	});

	it('renders status and task count when data is ready', () => {
		mockUseAmkaCoreAlignment.mockReturnValue({
			isLoading: false,
			isError: false,
			data: {
				status: 'awaiting_approval',
				task_count: 3,
				pulse: { summary: 'ready' },
				policy: {},
				projection: {
					driver_key: 'marketing_cabinet',
					domain_profile: 'marketing',
					stage_counts: {},
					step_status_counts: {},
					task_status_counts: {},
					trace_events: [],
					contract: {},
				},
				observations: {},
				task_preview: [],
			},
			refetch: vi.fn(),
		});
		render(<AmkaCoreAlignmentSection runId="run-1" />);
		expect(
			screen.getByLabelText('amkaView.coreAlignmentAria')
		).toBeInTheDocument();
		expect(screen.getByText(/awaiting_approval/)).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
	});
});
