/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Social Hub overview feed copy and friend navigation actions.
 *
 * Invariants:
 * - Feed event types render as localized labels, not raw backend enum values.
 * - Recent contacts remain clickable entry points into the Friends tab/card flow.
 *
 * Related:
 * - ../SocialHubOverviewPanel.tsx
 * - ../../api/socialHubFeedApi.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';

import SocialHubOverviewPanel from '../SocialHubOverviewPanel';

const friendsOverviewMock = vi.hoisted(() => ({
	friends: [
		{
			id: 'friend-1',
			username: 'arina',
			avatar_url: null,
			full_name: 'Arina Friend',
			is_favorite: false,
			is_muted: false,
			is_blocked: false,
			share_activity_with_friend: true,
			activity_visible_to_current_user: true,
			last_activity_at: '2026-05-29T00:00:00Z',
			last_interaction_at: '2026-05-29T00:10:00Z',
			circles: [],
		},
	],
	incomingRequests: [{ id: 'request-1' }],
	sentRequests: [],
	circles: [],
}));

vi.mock('../../hooks/useFriends', () => ({
	useFriendsOverview: () => ({
		data: {
			stats: {
				friendsCount: friendsOverviewMock.friends.length,
				incomingRequestsCount: friendsOverviewMock.incomingRequests.length,
				sentRequestsCount: friendsOverviewMock.sentRequests.length,
			},
			friends: friendsOverviewMock.friends,
			incomingRequests: friendsOverviewMock.incomingRequests,
			sentRequests: friendsOverviewMock.sentRequests,
			circles: friendsOverviewMock.circles,
		},
		isLoading: false,
		isFetching: false,
	}),
}));

vi.mock('@/services/profileService', () => ({
	getProfilePrivacy: vi.fn(async () => ({
		discoverability: 'public',
		avatar_visibility: 'everyone',
		full_name_visibility: 'everyone',
		bio_visibility: 'everyone',
	})),
}));

vi.mock('@/services/mobileAppApi', () => ({
	fetchMobileAppOverview: vi.fn(async () => ({
		apk_available: true,
		mobile_session: null,
		version_name: '0.2.4',
		version_code: 24,
	})),
	formatMobileBuildLabel: () => '0.2.4 (24)',
}));

vi.mock('../../api/socialHubFeedApi', () => ({
	fetchSocialHubFeed: vi.fn(async () => ({
		items: [
			{
				id: 'feed-1',
				type: 'friendship_created',
				created_at: '2026-05-29T00:00:00Z',
				actor_user_id: 'friend-1',
				target_user_id: 'current-user',
				username: 'arina',
				full_name: 'Arina Friend',
				avatar_url: null,
				summary: 'Friendship established',
			},
		],
		next_cursor: null,
	})),
}));

function renderOverview(onOpenFriend = vi.fn(), onSelectTab = vi.fn()) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return {
		onOpenFriend,
		onSelectTab,
		...render(
			<QueryClientProvider client={client}>
				<SocialHubOverviewPanel
					onSelectTab={onSelectTab}
					onOpenFriend={onOpenFriend}
				/>
			</QueryClientProvider>
		),
	};
}

describe('SocialHubOverviewPanel', () => {
	beforeEach(() => {
		friendsOverviewMock.friends = [
			{
				id: 'friend-1',
				username: 'arina',
				avatar_url: null,
				full_name: 'Arina Friend',
				is_favorite: false,
				is_muted: false,
				is_blocked: false,
				share_activity_with_friend: true,
				activity_visible_to_current_user: true,
				last_activity_at: '2026-05-29T00:00:00Z',
				last_interaction_at: '2026-05-29T00:10:00Z',
				circles: [],
			},
		];
		friendsOverviewMock.incomingRequests = [{ id: 'request-1' }];
		friendsOverviewMock.sentRequests = [];
		friendsOverviewMock.circles = [];
	});

	it('renders localized feed event labels instead of raw enum values', async () => {
		renderOverview();

		await waitFor(() => {
			expect(
				screen.getByText(/Became friends|Добавлен в друзья/)
			).toBeInTheDocument();
		});
		expect(screen.queryByText(/friendship_created/)).not.toBeInTheDocument();
	});

	it('opens recent contacts through the parent friend focus callback', () => {
		const { onOpenFriend } = renderOverview();

		screen.getByRole('button', { name: /arina/i }).click();

		expect(onOpenFriend).toHaveBeenCalledWith('friend-1');
	});

	it('keeps recent contacts empty state actionable', () => {
		friendsOverviewMock.friends = [];
		const { onSelectTab } = renderOverview();

		expect(
			screen.getByText(/Недавних контактов пока нет|No recent contacts yet/)
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: /Найти людей|Find people/i })
		);

		expect(onSelectTab).toHaveBeenCalledWith('friends');
	});
});
