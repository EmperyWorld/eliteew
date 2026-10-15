/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Social Hub Action Inbox status/error states.
 *
 * Invariants:
 * - Load failures use shared Desktop product status grammar with alert semantics.
 * - Retry delegates to the same React Query refetch contract as the panel UI.
 *
 * Related:
 * - ../SocialHubActionInboxPanel.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';

import SocialHubActionInboxPanel from '../SocialHubActionInboxPanel';
import { fetchSocialHubActionInbox } from '../../api/socialHubFeedApi';

vi.mock('../../api/socialHubFeedApi', () => ({
	fetchSocialHubActionInbox: vi.fn(),
}));

function renderInbox(onSelectTarget = vi.fn()) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return {
		onSelectTarget,
		...render(
			<QueryClientProvider client={client}>
				<SocialHubActionInboxPanel onSelectTarget={onSelectTarget} />
			</QueryClientProvider>
		),
	};
}

describe('SocialHubActionInboxPanel', () => {
	beforeEach(() => {
		vi.mocked(fetchSocialHubActionInbox).mockReset();
	});

	it('keeps the empty inbox actionable', async () => {
		const fetchMock = vi.mocked(fetchSocialHubActionInbox);
		fetchMock.mockResolvedValue({ items: [] });
		const { onSelectTarget } = renderInbox();

		expect(
			await screen.findByText(/Действий не требуется|No action needed/)
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {
				name: /Вернуться к обзору|Back to overview/i,
			})
		);
		expect(onSelectTarget).toHaveBeenCalledWith('overview');

		fireEvent.click(
			screen.getByRole('button', { name: /Найти людей|Find people/i })
		);
		expect(onSelectTarget).toHaveBeenCalledWith('friends');
	});

	it('renders load failures as an assertive product status banner with retry', async () => {
		const fetchMock = vi.mocked(fetchSocialHubActionInbox);
		fetchMock.mockRejectedValue(new Error('offline'));

		renderInbox();

		const alert = await screen.findByRole('alert', undefined, {
			timeout: 5000,
		});
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent(
			/Входящие действия временно недоступны|Action inbox is temporarily unavailable/
		);

		fireEvent.click(
			screen.getByRole('button', { name: /Повторить|Try again|Retry/i })
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});
	});

	it('localizes known backend card types instead of rendering raw English copy', async () => {
		const fetchMock = vi.mocked(fetchSocialHubActionInbox);
		fetchMock.mockResolvedValue({
			items: [
				{
					id: 'stale_sent_requests',
					type: 'stale_sent_requests',
					severity: 'medium',
					title: 'Stale sent requests',
					summary:
						'Follow up or cancel requests that have waited more than a week.',
					count: 2,
					target_tab: 'inbox',
					target_id: 'sent',
					created_at: '2026-05-20T00:00:00.000Z',
				},
				{
					id: 'empty_circles',
					type: 'empty_circles',
					severity: 'low',
					title: 'Empty friend lists',
					summary:
						'Add contacts or remove empty lists before using them in privacy previews.',
					count: 1,
					target_tab: 'circles',
					target_id: 'empty',
					created_at: '2026-04-14T00:00:00.000Z',
				},
			],
		});

		renderInbox();

		expect(await screen.findByText(/Зависшие исходящие заявки/)).toBeVisible();
		expect(screen.getByText(/Пустые списки друзей/)).toBeVisible();
		expect(screen.queryByText('Stale sent requests')).not.toBeInTheDocument();
		expect(screen.queryByText('Empty friend lists')).not.toBeInTheDocument();
	});
});
