/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for in-transcript EWA operation progress banner accessibility semantics.
 *
 * Invariants:
 * - Failed terminal progress announces assertively; non-terminal progress remains polite.
 *
 * Related:
 * - src/features/ewa/companionOperations/InTranscriptProgressBanner.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InTranscriptProgressBanner } from '@/features/ewa/companionOperations/InTranscriptProgressBanner';
import type { CompanionTranscriptProgressItem } from '@/features/ewa/companionOperations/companionOperationsUi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			if (key === 'ewaCompanion.musicProgressTitle') return 'Recording song';
			if (key === 'ewaCompanion.musicProgressStep')
				return `${params?.title ?? ''} · ${params?.current ?? ''}/${params?.total ?? ''}`;
			if (key === 'ewaCompanion.musicProgressFailed') return 'Could not finish';
			return key;
		},
	}),
}));

const baseProgress: CompanionTranscriptProgressItem = {
	runId: 'run-progress',
	intentKind: 'music_generation_background',
	title: 'Lyrics',
	current: 1,
	total: 3,
	status: 'active',
};

describe('InTranscriptProgressBanner', () => {
	it('keeps active progress as a polite status with progressbar', () => {
		render(<InTranscriptProgressBanner progress={baseProgress} />);

		const status = screen.getByRole('status');
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(status).toHaveTextContent('Recording song');
		expect(screen.getByRole('progressbar')).toHaveAttribute(
			'aria-valuenow',
			'33'
		);
	});

	it('promotes failed progress into an assertive alert without progressbar', () => {
		render(
			<InTranscriptProgressBanner
				progress={{ ...baseProgress, status: 'failed' }}
			/>
		);

		const alert = screen.getByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent('Could not finish');
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});
});
