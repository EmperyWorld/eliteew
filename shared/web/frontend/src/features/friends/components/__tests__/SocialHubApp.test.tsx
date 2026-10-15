/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused SocialHubApp tests for sidebar navigation, deep-link payload handling, and query pausing.
 *
 * Invariants:
 * - Tests mock heavy child apps so SocialHubShell navigation behavior stays isolated.
 * - Legacy profile launch hints continue to land on the Privacy section.
 *
 * Related:
 * - ../SocialHubApp.tsx
 * - ../../social-hub/SocialHubShell.tsx
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { SOCIAL_HUB_INITIAL_TAB_KEY } from '@/pages/Desktop/utils/socialHubConstants';
import SocialHubApp from '../SocialHubApp';

const friendsOverviewMock = vi.hoisted(() => ({
	friends: [] as Array<{
		id: string;
		is_favorite?: boolean;
		is_muted?: boolean;
		is_blocked?: boolean;
	}>,
	circles: [] as Array<{
		id: string;
		name: string;
		members_count: number;
	}>,
	friendsCount: 0,
	incomingRequestsCount: 0,
	sentRequestsCount: 0,
}));

const surfaceLayoutMock = vi.hoisted(() => ({
	useDesktopSurfaceLayout: vi.fn(() => ({
		surfaceRef: { current: null },
		width: 1280,
		height: 720,
		isCompact: false,
		isDense: false,
	})),
}));

vi.mock('@/pages/Desktop/hooks/useDesktopSurfaceLayout', () => ({
	useDesktopSurfaceLayout: surfaceLayoutMock.useDesktopSurfaceLayout,
}));

vi.mock('../../hooks/useFriends', () => ({
	useFriendsOverview: () => ({
		data: {
			stats: {
				incomingRequestsCount: friendsOverviewMock.incomingRequestsCount,
				friendsCount: friendsOverviewMock.friendsCount,
				sentRequestsCount: friendsOverviewMock.sentRequestsCount,
			},
			friends: friendsOverviewMock.friends,
			incomingRequests: [],
			sentRequests: [],
			circles: friendsOverviewMock.circles,
		},
		isPending: false,
		isError: false,
	}),
}));

vi.mock('@/components/UserProfile', () => ({
	default: () => <div data-testid="mock-user-profile">profile-embedded</div>,
}));

const friendsAppMock = vi.hoisted(() => ({
	default: ({
		hubMode,
		friendsDataActive,
		initialFriendUserId,
		initialDirectorySection,
	}: {
		hubMode?: boolean;
		friendsDataActive?: boolean;
		initialFriendUserId?: string | null;
		initialDirectorySection?: string;
	}) => (
		<div
			data-testid="mock-friends-app"
			data-friends-active={friendsDataActive === false ? '0' : '1'}
			data-initial-friend-id={initialFriendUserId ?? ''}
			data-initial-section={initialDirectorySection ?? ''}
		>
			{hubMode ? 'friends-hub' : 'friends-full'}
		</div>
	),
}));

vi.mock('../FriendsApp', () => friendsAppMock);
vi.mock('@/features/friends/components/FriendsApp', () => friendsAppMock);

vi.mock('../SocialHubActionInboxPanel', () => ({
	default: ({
		onSelectTarget,
	}: {
		onSelectTarget: (tab: string, targetId?: string | null) => void;
	}) => (
		<div data-testid="mock-social-hub-inbox">
			inbox
			<button type="button" onClick={() => onSelectTarget('circles', 'empty')}>
				open circles action
			</button>
		</div>
	),
}));

const socialHubHomeSectionMock = vi.hoisted(() => ({
	default: ({
		onOpenFriend,
	}: {
		onOpenFriend?: (friendId: string) => void;
	}) => (
		<div data-testid="mock-social-hub-home">
			home
			<button
				type="button"
				onClick={() => onOpenFriend?.('friend-from-overview')}
			>
				open recent friend
			</button>
		</div>
	),
}));

vi.mock(
	'../../social-hub/sections/SocialHubHomeSection',
	() => socialHubHomeSectionMock
);
vi.mock('../SocialHubOverviewPanel', () => socialHubHomeSectionMock);

vi.mock('../SocialHubPrivacyPreviewPanel', () => ({
	default: () => (
		<div data-testid="mock-social-hub-privacy-preview">preview</div>
	),
}));

function getVisibleFriendsApp(): HTMLElement {
	const visible = screen.getAllByTestId('mock-friends-app').find((element) => {
		let node: HTMLElement | null = element.parentElement;
		while (node) {
			if (node.getAttribute('aria-hidden') === 'true') return false;
			node = node.parentElement;
		}
		return true;
	});
	if (!visible) {
		throw new Error('No visible mocked FriendsApp');
	}
	return visible;
}

function getSidebarNav(): HTMLElement {
	return screen.getByRole('navigation', {
		name: /разделы «связи»|connections sections/i,
	});
}

function getSidebarItem(name: RegExp): HTMLElement {
	return within(getSidebarNav()).getByRole('button', { name });
}

describe('SocialHubApp', () => {
	beforeEach(() => {
		sessionStorage.clear();
		friendsOverviewMock.friends = [];
		friendsOverviewMock.circles = [];
		friendsOverviewMock.friendsCount = 0;
		friendsOverviewMock.incomingRequestsCount = 0;
		friendsOverviewMock.sentRequestsCount = 0;
	});

	it('opens on the home section by default', () => {
		render(<SocialHubApp />);

		expect(screen.getByTestId('mock-social-hub-home')).toBeVisible();
		expect(getSidebarItem(/главная|home/i)).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('opens on the privacy section when the desktop shell primes legacy profile return', async () => {
		sessionStorage.setItem(SOCIAL_HUB_INITIAL_TAB_KEY, 'profile');

		render(<SocialHubApp />);

		await waitFor(() => {
			expect(screen.getByTestId('mock-user-profile')).toBeInTheDocument();
		});
		expect(
			screen.getByTestId('mock-social-hub-privacy-preview')
		).toBeInTheDocument();
		expect(sessionStorage.getItem(SOCIAL_HUB_INITIAL_TAB_KEY)).toBeNull();
		expect(getSidebarItem(/приватность|privacy/i)).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('shows incoming request badge on the People sidebar item', () => {
		friendsOverviewMock.incomingRequestsCount = 4;

		render(<SocialHubApp />);

		const peopleNav = getSidebarItem(/люди|people/i);
		expect(within(peopleNav).getByText('4')).toBeInTheDocument();
	});

	it('shows header requests CTA from overview incoming count', () => {
		friendsOverviewMock.incomingRequestsCount = 2;

		render(<SocialHubApp />);

		expect(
			screen.getByRole('button', { name: /заявки 2|requests 2/i })
		).toBeInTheDocument();
	});

	it('opens the people contacts view and forwards friend focus from initial payload', async () => {
		render(
			<SocialHubApp
				initialPayload={{
					socialHubFriendUserId: 'friend-42',
				}}
			/>
		);

		await waitFor(() => {
			expect(getVisibleFriendsApp()).toBeVisible();
		});
		expect(getVisibleFriendsApp()).toHaveAttribute(
			'data-initial-friend-id',
			'friend-42'
		);
		expect(getSidebarItem(/люди|people/i)).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('opens a recent home contact in the people contacts view', async () => {
		render(<SocialHubApp />);

		screen.getByRole('button', { name: /open recent friend/i }).click();

		await waitFor(() => {
			expect(getVisibleFriendsApp()).toBeVisible();
		});
		expect(getVisibleFriendsApp()).toHaveAttribute(
			'data-initial-friend-id',
			'friend-from-overview'
		);
		expect(getSidebarItem(/люди|people/i)).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('opens people lists when an inbox action targets circles', async () => {
		render(<SocialHubApp initialPayload={{ socialHubTab: 'inbox' }} />);

		await waitFor(() => {
			expect(screen.getByTestId('mock-social-hub-inbox')).toBeVisible();
		});
		screen.getByRole('button', { name: /open circles action/i }).click();

		await waitFor(() => {
			expect(getVisibleFriendsApp()).toBeVisible();
		});
		expect(getVisibleFriendsApp()).toHaveAttribute(
			'data-initial-section',
			'circles'
		);
		expect(getSidebarItem(/люди|people/i)).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('keeps stable root padding independent from measured dense state', () => {
		surfaceLayoutMock.useDesktopSurfaceLayout.mockReturnValueOnce({
			surfaceRef: { current: null },
			width: 1000,
			height: 760,
			isCompact: false,
			isDense: true,
		});

		const { container } = render(<SocialHubApp />);
		const root = container.querySelector('[data-desktop-app-surface] > div');

		expect(root).toHaveClass('p-3');
		expect(root).not.toHaveClass('p-4');
	});

	it('does not show the legacy live showcase badge in the header', () => {
		render(<SocialHubApp />);

		expect(screen.queryByText(/живая витрина|live read model/i)).toBeNull();
	});
});
