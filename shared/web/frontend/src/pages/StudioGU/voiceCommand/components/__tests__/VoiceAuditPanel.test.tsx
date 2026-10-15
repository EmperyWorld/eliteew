import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceAuditPanel } from '../VoiceAuditPanel';

const mockGet = vi.fn();

vi.mock('@/services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => mockGet(...args),
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: (_ns?: string, _opts?: { keyPrefix?: string }) => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				'audit.title': 'Command audit',
				'audit.subtitle': 'Server log for support',
				'audit.loading': 'Loading…',
				'audit.loadingAria': 'Loading command audit',
				'audit.emptyTitle': 'No entries yet',
				'audit.emptyDescription': 'Commands will appear here for support.',
				'actions.close': 'Close',
				'history.status.success': 'Done',
				'history.status.cancelled': 'Cancelled',
				'history.status.error': 'Error',
			};
			return map[key] ?? key;
		},
		i18n: { language: 'en' },
	}),
}));

describe('VoiceAuditPanel', () => {
	it('exposes loading state for assistive tech while audit is in flight', () => {
		mockGet.mockImplementation(
			() =>
				new Promise(() => {
					/* intentionally unresolved */
				})
		);
		render(<VoiceAuditPanel open onClose={vi.fn()} />);

		const live = screen.getByRole('status', { name: 'Loading command audit' });
		expect(live).toHaveAttribute('aria-busy', 'true');
	});

	it('fetches audit via api client and shows localized empty state', async () => {
		mockGet.mockResolvedValue([]);
		const onClose = vi.fn();

		render(<VoiceAuditPanel open onClose={onClose} />);

		await waitFor(() => {
			expect(mockGet).toHaveBeenCalledWith(
				'/api/v1/voice-commands/audit?limit=50'
			);
		});

		expect(await screen.findByText('No entries yet')).toBeInTheDocument();
		expect(screen.getByText('Server log for support')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('maps success status to localized chip label', async () => {
		mockGet.mockResolvedValue([
			{
				id: '1',
				user_id: 'u',
				command_id: 'help',
				transcript: 'help',
				status: 'success',
				created_at: '2026-06-30T12:00:00Z',
			},
		]);

		render(<VoiceAuditPanel open onClose={vi.fn()} />);

		expect(await screen.findByText('Done')).toBeInTheDocument();
	});
});
