/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Social Hub friend card safety and shared-content states.
 *
 * Invariants:
 * - Reports must collect an explicit reason before calling the friends API boundary.
 * - Report form remains exposed as a named safety region.
 * - Private notes stay separate from moderation report details.
 * - Shared-content load failures remain recoverable through an alert retry action.
 * - Empty relationship history remains actionable from inside the timeline tab.
 * - Empty notes offer a local starter without persisting until save.
 * - Empty circle assignment is framed as guidance inside privacy.
 * - Circle assignment controls expose assigned/available summary counts.
 * - Reminder placeholder remains visible as framed guidance.
 * - Note draft state is visible before saving.
 *
 * Related:
 * - ../FriendPersonCard.tsx
 * - ../../hooks/useFriends.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import type { ComponentProps } from 'react';

import type { FriendProfile } from '../../types';
import { FriendPersonCard } from '../FriendPersonCard';
import { fetchSocialHubSharedContent } from '../../api/socialHubFeedApi';

vi.mock('../../api/socialHubFeedApi', () => ({
	fetchSocialHubSharedContent: vi.fn(),
}));

const friend: FriendProfile = {
	id: 'friend-1',
	username: 'arina',
	avatar_url: null,
	full_name: 'Arina Friend',
	is_favorite: false,
	is_muted: false,
	is_blocked: false,
	share_activity_with_friend: true,
	activity_visible_to_current_user: true,
	last_activity_at: null,
	last_interaction_at: null,
	private_note: 'Private operator note',
	note_updated_at: null,
	friendship_created_at: '2026-05-01T00:00:00Z',
	circles: [],
};

function renderCard(
	props: Partial<ComponentProps<typeof FriendPersonCard>> = {}
): ReturnType<typeof render> {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<FriendPersonCard friend={friend} {...props} />
		</QueryClientProvider>
	);
}

describe('FriendPersonCard', () => {
	beforeEach(() => {
		vi.mocked(fetchSocialHubSharedContent).mockResolvedValue({ items: [] });
	});

	it('collects report reason and details before submit', () => {
		const onReport = vi.fn();

		const { container } = renderCard({ onReport });

		fireEvent.click(screen.getByRole('tab', { name: /privacy|приватность/i }));
		fireEvent.click(
			screen.getByRole('button', { name: /report|пожаловаться/i })
		);
		expect(
			container.querySelector(
				'section[aria-label="Отправить жалобу на контакт"], section[aria-label="Report this contact"]'
			)
		).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText(/reason|причина/i), {
			target: { value: 'spam_or_scam' },
		});
		fireEvent.change(screen.getByLabelText(/details|детали/i), {
			target: { value: 'Asked for money outside the platform.' },
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: /send report|отправить жалобу/i,
			})
		);

		expect(onReport).toHaveBeenCalledWith(friend, {
			reason: 'spam_or_scam',
			details: 'Asked for money outside the platform.',
		});
	});

	it('renders block confirmation as an assertive alert before mutating', () => {
		const onToggleBlock = vi.fn();

		renderCard({ onToggleBlock });

		fireEvent.click(screen.getByRole('tab', { name: /privacy|приватность/i }));
		fireEvent.click(
			screen.getByRole('button', { name: /^block$|^заблокировать$/i })
		);

		const alert = screen.getByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent(
			/Заблокировать контакт|Block this contact/i
		);
		expect(onToggleBlock).not.toHaveBeenCalled();

		fireEvent.click(
			within(alert).getByRole('button', {
				name: /Block contact|Заблокировать/i,
			})
		);
		expect(onToggleBlock).toHaveBeenCalledWith(
			expect.objectContaining({ id: friend.id })
		);
	});

	it('loads real shared content for the shared tab', async () => {
		vi.mocked(fetchSocialHubSharedContent).mockResolvedValue({
			items: [
				{
					id: 'content-1',
					name: 'mutual-plan.md',
					title: null,
					content_type: 'document',
					mime_type: 'text/markdown',
					file_size: 1536,
					visibility: 'friends',
					direction: 'from_friend',
					shared_reason: 'friends_visibility',
					created_at: '2026-05-29T00:00:00Z',
					updated_at: '2026-05-29T01:00:00Z',
					thumbnail_url: null,
				},
			],
		});

		renderCard();

		fireEvent.click(screen.getByRole('tab', { name: /shared|общее/i }));

		expect(await screen.findByText('mutual-plan.md')).toBeInTheDocument();
		expect(fetchSocialHubSharedContent).toHaveBeenCalledWith(friend.id, {
			limit: 12,
		});
	});

	it('renders shared-content load failures as an assertive retry banner', async () => {
		const fetchMock = vi.mocked(fetchSocialHubSharedContent);
		fetchMock
			.mockRejectedValueOnce(new Error('network down'))
			.mockRejectedValueOnce(new Error('network down'))
			.mockResolvedValueOnce({
				items: [
					{
						id: 'content-2',
						name: 'recovered-plan.md',
						title: null,
						content_type: 'document',
						mime_type: 'text/markdown',
						file_size: 2048,
						visibility: 'friends',
						direction: 'to_friend',
						shared_reason: 'direct_share',
						created_at: '2026-05-29T00:00:00Z',
						updated_at: '2026-05-29T01:00:00Z',
						thumbnail_url: null,
					},
				],
			});

		renderCard();

		fireEvent.click(screen.getByRole('tab', { name: /shared|общее/i }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
		const alert = await screen.findByRole('alert', undefined, {
			timeout: 3000,
		});
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent(
			/Общий контент временно недоступен|Shared content is temporarily unavailable/
		);

		fireEvent.click(
			within(alert).getByRole('button', { name: /Обновить|Refresh/i })
		);

		expect(await screen.findByText('recovered-plan.md')).toBeInTheDocument();
		expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
	});

	it('keeps empty relationship history actionable', () => {
		const onOpenChat = vi.fn();

		renderCard({
			onOpenChat,
			friend: {
				...friend,
				friendship_created_at: null,
				last_activity_at: null,
				last_interaction_at: null,
				note_updated_at: null,
			},
		});

		fireEvent.click(screen.getByRole('tab', { name: /timeline|таймлайн/i }));

		const emptyTimeline = screen.getByRole('region', {
			name: /История пока пустая|No relationship history yet/i,
		});
		expect(emptyTimeline).toHaveTextContent(
			/Начните диалог|Start a chat or leave a note/i
		);

		fireEvent.click(
			within(emptyTimeline).getByRole('button', {
				name: /Открыть чат|Open chat/i,
			})
		);
		expect(onOpenChat).toHaveBeenCalledWith(
			expect.objectContaining({ id: friend.id })
		);

		fireEvent.click(
			within(emptyTimeline).getByRole('button', {
				name: /Открыть заметки|Open notes/i,
			})
		);
		expect(
			screen.getByText(/Личная заметка|Personal note/i)
		).toBeInTheDocument();
	});

	it('offers a local starter for empty private notes', () => {
		renderCard({
			friend: {
				...friend,
				private_note: '',
				note_updated_at: null,
			},
		});

		fireEvent.click(screen.getByRole('tab', { name: /notes|заметки/i }));

		expect(
			screen.getByText(/Заметки пока нет|No note yet/i)
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: /Вставить шаблон|Insert starter/i,
			})
		);

		const noteInput = screen.getByRole('textbox', {
			name: /Личная заметка|Personal note/i,
		}) as HTMLTextAreaElement;
		expect(noteInput.value).toMatch(/Контекст:|Context:/);
		expect(
			screen.getByText(/Черновик изменён|Draft changed/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: /Сохранить заметку|Save note/i,
			})
		).toBeEnabled();
	});

	it('frames missing friend lists as privacy guidance', () => {
		renderCard({ availableCircles: [] });

		fireEvent.click(screen.getByRole('tab', { name: /privacy|приватность/i }));

		expect(
			screen.getByText(
				/Списков для карточки пока нет|No lists available for this card yet/i
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Создайте списки|Create lists in the friends workspace/i)
		).toBeInTheDocument();
	});

	it('shows circle assignment summary before circle controls', () => {
		renderCard({
			availableCircles: [
				{ id: 'circle-team', name: 'Team', members_count: 5 },
				{ id: 'circle-clients', name: 'Clients', members_count: 2 },
			],
			friend: {
				...friend,
				circles: [{ id: 'circle-team', name: 'Team', members_count: 5 }],
			},
		});

		fireEvent.click(screen.getByRole('tab', { name: /privacy|приватность/i }));

		const summary = screen.getByLabelText(
			/Сводка списков в карточке друга|Friend card list summary/i
		);
		expect(summary).toHaveTextContent(/Назначено: 1|Assigned: 1/i);
		expect(summary).toHaveTextContent(/Доступно: 2|Available: 2/i);
		expect(screen.getByRole('button', { name: 'Team' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clients' })).toBeInTheDocument();
	});

	it('frames the reminder placeholder in overview', () => {
		renderCard();

		const reminderTitle = screen.getByText(/Напоминание|Reminder/i);
		const reminderCard = reminderTitle.closest('div.rounded-xl');
		expect(reminderCard).toBeInTheDocument();
		expect(reminderCard).toHaveTextContent(
			/follow-up|Скоро здесь можно будет поставить/i
		);
	});

	it('keeps relationship next actions visible from the main card', () => {
		const onOpenChat = vi.fn();

		renderCard({
			onOpenChat,
			friend: {
				...friend,
				share_activity_with_friend: false,
				activity_visible_to_current_user: false,
			},
		});

		expect(
			screen.getByText(/relationship action center|центр действий/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('region', {
				name: /relationship action center|центр действий/i,
			})
		).toBeInTheDocument();
		expect(
			screen.getByText(/activity visibility|ограничения видимости/i)
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /^chat|^чат/i }));
		expect(onOpenChat).toHaveBeenCalledWith(
			expect.objectContaining({ id: friend.id })
		);

		fireEvent.click(screen.getByRole('button', { name: /^shared|^общее/i }));
		expect(
			screen.getByText(/files and documents|файлы и документы/i)
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: /^privacy|^приватность/i })
		);
		expect(
			screen.getByText(/communication settings|настройки общения/i)
		).toBeInTheDocument();
	});
});
