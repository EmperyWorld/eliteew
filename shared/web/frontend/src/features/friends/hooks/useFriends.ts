/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks and mutations for Social Hub friends, circles, and relationship state.
 *
 * Invariants:
 * - Mutations invalidate the shared friends query root so badges, overview, and directory stay aligned.
 * - Query keys must remain compatible with friends API contract tests and desktop realtime invalidation.
 *
 * Related:
 * - ../api/friendsApi.ts
 * - ../api/queryKeys.ts
 */

import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from '@tanstack/react-query';

import {
	acceptFriendRequest,
	cancelFriendRequest,
	createFriendCircle,
	deleteFriendCircle,
	getFriendProfile,
	listFriends,
	listFriendCircles,
	listIncomingFriendRequests,
	listSentFriendRequests,
	rejectFriendRequest,
	removeFriend,
	reportFriendUser,
	searchFriendCandidates,
	sendFriendRequest,
	sendFriendRequestToUser,
	updateFriendCircle,
	updateFriendRelationship,
} from '../api/friendsApi';
import { friendsQueryKeys, invalidateFriendsQueries } from '../api/queryKeys';
import type {
	Friend,
	FriendCircle,
	FriendProfile,
	FriendSearchCandidate,
	IncomingFriendRequest,
	SentFriendRequest,
} from '../types';

export { useFriendsOverview } from './useFriendsOverview';

type QueryOptions = {
	enabled?: boolean;
};

/** Balance freshness vs. load: mutations still invalidate the friends query root. */
const LIVE_FRIENDS_QUERY_OPTIONS = {
	staleTime: 15_000,
	gcTime: 5 * 60_000,
	refetchOnMount: true,
	refetchOnWindowFocus: true,
	refetchOnReconnect: true,
	retry: 2,
};

export function useFriendsList(
	options: QueryOptions = {}
): UseQueryResult<Friend[], Error> {
	return useQuery({
		queryKey: friendsQueryKeys.list(),
		queryFn: listFriends,
		enabled: options.enabled ?? true,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

export function useIncomingFriendRequests(
	options: QueryOptions = {}
): UseQueryResult<IncomingFriendRequest[], Error> {
	return useQuery({
		queryKey: friendsQueryKeys.incoming(),
		queryFn: listIncomingFriendRequests,
		enabled: options.enabled ?? true,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

export function useSentFriendRequests(
	options: QueryOptions = {}
): UseQueryResult<SentFriendRequest[], Error> {
	return useQuery({
		queryKey: friendsQueryKeys.sent(),
		queryFn: listSentFriendRequests,
		enabled: options.enabled ?? true,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

export function useFriendSearch(
	query: string,
	options: QueryOptions = {}
): UseQueryResult<FriendSearchCandidate[], Error> {
	return useQuery({
		queryKey: friendsQueryKeys.search(query),
		queryFn: () => searchFriendCandidates(query),
		enabled: (options.enabled ?? true) && query.trim().length > 0,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

export function useFriendProfile(
	friendUserId: string | null,
	options: QueryOptions = {}
): UseQueryResult<FriendProfile, Error> {
	return useQuery({
		queryKey: friendsQueryKeys.profile(friendUserId ?? 'none'),
		queryFn: () => getFriendProfile(friendUserId as string),
		enabled: (options.enabled ?? true) && Boolean(friendUserId),
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

export function useFriendCircles(
	options: QueryOptions = {}
): UseQueryResult<FriendCircle[], Error> {
	return useQuery({
		queryKey: friendsQueryKeys.circles(),
		queryFn: listFriendCircles,
		enabled: options.enabled ?? true,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}

type FriendsMutation<TData, TVariables> = UseMutationResult<
	TData,
	Error,
	TVariables,
	unknown
>;

export function useFriendActions(): {
	sendRequest: FriendsMutation<{ request_id: string; status: string }, string>;
	sendRequestToUser: FriendsMutation<
		{ request_id: string; status: string },
		string
	>;
	acceptRequest: FriendsMutation<{ status: string }, string>;
	rejectRequest: FriendsMutation<{ status: string }, string>;
	cancelRequest: FriendsMutation<{ status: string }, string>;
	removeFriend: FriendsMutation<{ status: string }, string>;
	reportUser: FriendsMutation<
		{ id: string; status: string },
		{ friendUserId: string; reason: string; details?: string | null }
	>;
	createCircle: FriendsMutation<FriendCircle, string>;
	updateCircle: FriendsMutation<
		FriendCircle,
		{
			circleId: string;
			name?: string;
			sort_order?: number;
			color?: string | null;
			icon?: string | null;
		}
	>;
	deleteCircle: FriendsMutation<{ status: string }, string>;
	updateRelationship: FriendsMutation<
		FriendProfile,
		{
			friendUserId: string;
			is_favorite?: boolean;
			is_muted?: boolean;
			is_blocked?: boolean;
			share_activity_with_friend?: boolean;
			circle_ids?: string[];
			private_note?: string | null;
		}
	>;
} {
	const queryClient = useQueryClient();
	const invalidate = async (): Promise<void> =>
		invalidateFriendsQueries(queryClient);

	return {
		sendRequest: useMutation({
			mutationFn: sendFriendRequest,
			onSuccess: invalidate,
		}),
		sendRequestToUser: useMutation({
			mutationFn: sendFriendRequestToUser,
			onSuccess: invalidate,
		}),
		acceptRequest: useMutation({
			mutationFn: acceptFriendRequest,
			onSuccess: invalidate,
		}),
		rejectRequest: useMutation({
			mutationFn: rejectFriendRequest,
			onSuccess: invalidate,
		}),
		cancelRequest: useMutation({
			mutationFn: cancelFriendRequest,
			onSuccess: invalidate,
		}),
		removeFriend: useMutation({
			mutationFn: removeFriend,
			onSuccess: invalidate,
		}),
		reportUser: useMutation({
			mutationFn: ({ friendUserId, reason, details }) =>
				reportFriendUser(friendUserId, { reason, details }),
			onSuccess: invalidate,
		}),
		createCircle: useMutation({
			mutationFn: createFriendCircle,
			onSuccess: invalidate,
		}),
		updateCircle: useMutation({
			mutationFn: ({ circleId, ...payload }) =>
				updateFriendCircle(circleId, payload),
			onSuccess: invalidate,
		}),
		deleteCircle: useMutation({
			mutationFn: deleteFriendCircle,
			onSuccess: invalidate,
		}),
		updateRelationship: useMutation({
			mutationFn: ({ friendUserId, ...payload }) =>
				updateFriendRelationship(friendUserId, payload),
			onSuccess: invalidate,
		}),
	};
}
