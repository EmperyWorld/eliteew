/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single overview read-model slice for Social Hub shell and home section KPIs.
 *
 * Invariants:
 * - Stats come from `useFriendsOverview` only; no duplicate fetches in child panels.
 *
 * Related:
 * - SocialHubShell.tsx
 * - sections/SocialHubHomeSection.tsx
 */

import { useMemo } from 'react';

import { useFriendsOverview } from '../../hooks/useFriends';

export function useSocialHubOverviewStats(enabled = true) {
	const query = useFriendsOverview({ enabled });
	const friends = query.data?.friends ?? [];
	const circles = query.data?.circles ?? [];
	const stats = query.data?.stats;

	const friendsCount = stats?.friendsCount ?? friends.length;
	const incomingPending = stats?.incomingRequestsCount ?? 0;
	const sentPending = stats?.sentRequestsCount ?? 0;
	const favoriteFriends = useMemo(
		() => friends.filter((friend) => friend.is_favorite).length,
		[friends]
	);
	const limitedFriends = useMemo(
		() =>
			friends.filter((friend) => friend.is_muted || friend.is_blocked).length,
		[friends]
	);

	return {
		query,
		friends,
		circles,
		friendsCount,
		incomingPending,
		sentPending,
		favoriteFriends,
		limitedFriends,
		totalRequestCount: incomingPending + sentPending,
	};
}
