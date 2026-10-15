/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for playbook runtime panel resume CTA and resumable status helper.
 *
 * Invariants:
 * - Mock `../api`; no real HTTP or SSE.
 *
 * Related:
 * - ProfessionalPlaybooksRuntimePanel.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	getProfessionalPlaybookRun,
	listProfessionalPlaybookRuns,
	loadRealtorQuotaSummary,
	resumeProfessionalPlaybookStream,
	streamProfessionalPlaybook,
} from '../api';
import {
	isResumablePlaybookRun,
	ProfessionalPlaybooksRuntimePanel,
} from '../ProfessionalPlaybooksRuntimePanel';

vi.mock('../api', () => ({
	listProfessionalPlaybookRuns: vi.fn(),
	getProfessionalPlaybookRun: vi.fn(),
	streamProfessionalPlaybook: vi.fn(),
	resumeProfessionalPlaybookStream: vi.fn(),
	loadRealtorQuotaSummary: vi.fn(),
}));

vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		toast: {
			success: vi.fn(),
			error: vi.fn(),
			warning: vi.fn(),
		},
	}),
}));

const playbooks = [
	{
		playbook_key: 'realtor_property_content_pack',
		display_name: 'Listing content pack',
		description: null,
		sort_order: 0,
	},
];

const failedRun = {
	id: '11111111-1111-4111-8111-111111111111',
	vertical_slug: 'realtor',
	playbook_key: 'realtor_property_content_pack',
	status: 'failed',
	created_at: '2026-05-27T10:00:00.000Z',
	updated_at: '2026-05-27T10:00:00.000Z',
};

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
		resources: {
			en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
		},
	});
});

function renderPanel() {
	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalPlaybooksRuntimePanel
				verticalSlug="realtor"
				playbooks={playbooks}
			/>
		</I18nextProvider>
	);
}

describe('isResumablePlaybookRun', () => {
	it('returns true for failed and cancelled runs only', () => {
		expect(isResumablePlaybookRun('failed')).toBe(true);
		expect(isResumablePlaybookRun('cancelled')).toBe(true);
		expect(isResumablePlaybookRun('completed')).toBe(false);
		expect(isResumablePlaybookRun('running')).toBe(false);
	});
});

describe('ProfessionalPlaybooksRuntimePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(listProfessionalPlaybookRuns).mockResolvedValue([]);
		vi.mocked(getProfessionalPlaybookRun).mockResolvedValue(failedRun);
		vi.mocked(streamProfessionalPlaybook).mockResolvedValue(undefined);
		vi.mocked(resumeProfessionalPlaybookStream).mockResolvedValue(undefined);
		vi.mocked(loadRealtorQuotaSummary).mockResolvedValue({
			vertical_slug: 'realtor',
			credits_used_24h: 0,
			credits_balance: 100,
			playbook_estimates: [
				{
					playbook_key: 'realtor_property_content_pack',
					total_estimated_units: 1,
					total_ugs_credits: 5,
				},
			],
		});
	});

	it('shows Resume for failed runs and calls resumeProfessionalPlaybookStream', async () => {
		vi.mocked(listProfessionalPlaybookRuns).mockResolvedValue([
			failedRun,
			{
				...failedRun,
				id: '22222222-2222-4222-8222-222222222222',
				status: 'completed',
			},
		]);
		vi.mocked(resumeProfessionalPlaybookStream).mockResolvedValue(undefined);

		renderPanel();

		await waitFor(() =>
			expect(screen.getByText('Listing content pack')).toBeInTheDocument()
		);
		const resumeButtons = screen.getAllByRole('button', { name: 'Resume' });
		expect(resumeButtons).toHaveLength(1);

		const resumeButton = resumeButtons[0];
		expect(resumeButton).toBeDefined();
		fireEvent.click(resumeButton as HTMLButtonElement);

		await waitFor(() =>
			expect(resumeProfessionalPlaybookStream).toHaveBeenCalledWith(
				failedRun.id,
				expect.objectContaining({
					variables: {},
					idempotency_key: expect.stringMatching(/^pb-resume-/),
				}),
				expect.any(Function),
				expect.any(Function),
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				})
			)
		);
		expect(streamProfessionalPlaybook).not.toHaveBeenCalled();
		expect(getProfessionalPlaybookRun).not.toHaveBeenCalled();
	});

	it('lets the user stop waiting on a live launch without showing false success', async () => {
		vi.mocked(streamProfessionalPlaybook).mockImplementation(
			(_vertical, _playbook, _body, _onEvent, _onError, options) =>
				new Promise<void>((_resolve, reject) => {
					options?.signal?.addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'));
					});
				})
		);

		renderPanel();

		fireEvent.click(screen.getByRole('button', { name: 'Run' }));

		await waitFor(() =>
			expect(streamProfessionalPlaybook).toHaveBeenCalledWith(
				'realtor',
				'realtor_property_content_pack',
				expect.objectContaining({
					variables: {},
					idempotency_key: expect.stringMatching(/^pb-realtor-/),
				}),
				expect.any(Function),
				expect.any(Function),
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				})
			)
		);

		const options = vi.mocked(streamProfessionalPlaybook).mock.calls[0]?.[5];
		expect(options?.signal?.aborted).toBe(false);

		fireEvent.click(screen.getByRole('button', { name: 'Stop waiting' }));

		await waitFor(() => expect(options?.signal?.aborted).toBe(true));
		expect(screen.getAllByText(/Live waiting stopped/i).length).toBeGreaterThan(
			0
		);
		expect(screen.queryByText('Done')).not.toBeInTheDocument();
	});

	it('shows a recoverable history error instead of an empty run list', async () => {
		vi.mocked(listProfessionalPlaybookRuns).mockRejectedValueOnce(
			new Error('network offline')
		);

		renderPanel();

		expect(
			await screen.findByText(/Recent runs are unavailable right now/i)
		).toBeInTheDocument();
		expect(screen.queryByText('No runs yet.')).not.toBeInTheDocument();
	});
});
