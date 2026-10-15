/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client and DTO mapping for Social Hub friends, requests, circles, and relationship controls.
 *
 * Invariants:
 * - REST base remains `/api/v1`; generated pilot OpenAPI must match changed route contracts.
 * - Snake_case API fields are mapped at the boundary where frontend domain types use camelCase.
 *
 * Related:
 * - api/routers/friends.py
 * - ../hooks/useFriends.ts
 */

import { api } from '@/services/api/client';
import { conditionalJsonGet } from '@/services/api/conditionalJsonGet';
import type { components } from '@/generated/friends-openapi';

import type {
	Friend,
	FriendCircle,
	FriendProfile,
	FriendsOverview,
	FriendRelationshipStatus,
	FriendSearchCandidate,
	IncomingFriendRequest,
	SentFriendRequest,
} from '../types';

/** Canonical REST prefix for friends router (`shared/api/routers/friends.py` + `domains/social.py`). */
export const FRIENDS_API_V1_BASE = '/api/v1' as const;

const FRIENDS_API_CONFIG = { baseURL: FRIENDS_API_V1_BASE } as const;

const FRIENDS_OVERVIEW_CACHE_KEY = 'friends:overview' as const;

type FriendsOverviewApiResponse =
	components['schemas']['FriendsOverviewResponse'];
/** API may send extra fields not yet in the pilot schema (badges, trusted). */
type FriendSearchCandidateApi =
	components['schemas']['FriendSearchCandidate'] & {
		is_trusted?: boolean;
		admin_badge_label?: string | null;
		admin_badge_hint?: string | null;
	};

/** Maps pilot OpenAPI row to domain {@link FriendSearchCandidate} (snake_case → camelCase). */
export function mapFriendSearchCandidateFromApi(
	item: FriendSearchCandidateApi
): FriendSearchCandidate {
	return {
		id: item.id,
		username: item.username,
		avatar_url: item.avatar_url,
		full_name: item.full_name,
		is_trusted: item.is_trusted ?? false,
		admin_badge_label: item.admin_badge_label ?? null,
		admin_badge_hint: item.admin_badge_hint ?? null,
		relationshipStatus: item.relationship_status as FriendRelationshipStatus,
		requestId: item.request_id ?? null,
		is_muted: item.is_muted ?? false,
		is_blocked: item.is_blocked ?? false,
		share_activity_with_friend: item.share_activity_with_friend ?? true,
		activity_visible_to_current_user:
			item.activity_visible_to_current_user ?? true,
		last_activity_at: item.last_activity_at ?? null,
		last_interaction_at: item.last_interaction_at ?? null,
	};
}

export async function listFriends(): Promise<Friend[]> {
	const data = await api.get<components['schemas']['FriendUser'][]>(
		'/friends',
		FRIENDS_API_CONFIG
	);
	return Array.isArray(data) ? (data as Friend[]) : [];
}

export async function listIncomingFriendRequests(): Promise<
	IncomingFriendRequest[]
> {
	const data = await api.get<IncomingFriendRequest[]>(
		'/friends/requests',
		FRIENDS_API_CONFIG
	);
	return Array.isArray(data) ? data : [];
}

export async function listSentFriendRequests(): Promise<SentFriendRequest[]> {
	const data = await api.get<SentFriendRequest[]>(
		'/friends/requests/sent',
		FRIENDS_API_CONFIG
	);
	return Array.isArray(data) ? data : [];
}

export async function searchFriendCandidates(
	query: string,
	limit = 8
): Promise<FriendSearchCandidate[]> {
	const data = await api.get<FriendSearchCandidateApi[]>(
		'/friends/users/search',
		{
			...FRIENDS_API_CONFIG,
			params: { q: query, limit },
		}
	);

	if (!Array.isArray(data)) {
		return [];
	}

	return data.map(mapFriendSearchCandidateFromApi);
}

export async function getFriendsOverview(): Promise<FriendsOverview> {
	const data = await conditionalJsonGet<FriendsOverviewApiResponse>(
		FRIENDS_OVERVIEW_CACHE_KEY,
		'/friends/overview',
		FRIENDS_API_CONFIG
	);

	const friends = Array.isArray(data?.friends)
		? (data.friends as Friend[])
		: [];
	const incomingRequests = Array.isArray(data?.incoming_requests)
		? (data.incoming_requests as IncomingFriendRequest[])
		: [];
	const sentRequests = Array.isArray(data?.sent_requests)
		? (data.sent_requests as SentFriendRequest[])
		: [];
	const circles = Array.isArray(data?.circles)
		? (data.circles as FriendCircle[])
		: [];

	return {
		friends,
		incomingRequests,
		sentRequests,
		circles,
		stats: {
			friendsCount: data?.stats?.friends_count ?? friends.length,
			incomingRequestsCount:
				data?.stats?.incoming_requests_count ?? incomingRequests.length,
			sentRequestsCount:
				data?.stats?.sent_requests_count ?? sentRequests.length,
		},
	};
}

export async function getFriendProfile(
	friendUserId: string
): Promise<FriendProfile> {
	return api.get(`/friends/${friendUserId}/profile`, FRIENDS_API_CONFIG);
}

export async function updateFriendRelationship(
	friendUserId: string,
	payload: {
		is_favorite?: boolean;
		is_muted?: boolean;
		is_blocked?: boolean;
		share_activity_with_friend?: boolean;
		circle_ids?: string[];
		private_note?: string | null;
	}
): Promise<FriendProfile> {
	return api.patch(
		`/friends/${friendUserId}/relationship`,
		payload,
		FRIENDS_API_CONFIG
	);
}

export async function reportFriendUser(
	friendUserId: string,
	payload: { reason: string; details?: string | null }
): Promise<{ id: string; status: string }> {
	return api.post(
		`/friends/${friendUserId}/report`,
		payload,
		FRIENDS_API_CONFIG
	);
}

export async function listFriendCircles(): Promise<FriendCircle[]> {
	const data = await api.get<FriendCircle[]>(
		'/friends/circles',
		FRIENDS_API_CONFIG
	);
	return Array.isArray(data) ? data : [];
}

export async function createFriendCircle(name: string): Promise<FriendCircle> {
	return api.post('/friends/circles', { name }, FRIENDS_API_CONFIG);
}

export async function updateFriendCircle(
	circleId: string,
	payload: {
		name?: string;
		sort_order?: number;
		color?: string | null;
		icon?: string | null;
	}
): Promise<FriendCircle> {
	return api.patch(`/friends/circles/${circleId}`, payload, FRIENDS_API_CONFIG);
}

export async function deleteFriendCircle(
	circleId: string
): Promise<{ status: string }> {
	return api.delete(`/friends/circles/${circleId}`, FRIENDS_API_CONFIG);
}

export async function sendFriendRequest(
	username: string
): Promise<{ request_id: string; status: string }> {
	return api.post('/friends/request', { username }, FRIENDS_API_CONFIG);
}

export async function sendFriendRequestToUser(
	userId: string
): Promise<{ request_id: string; status: string }> {
	return api.post(`/friends/request/by-user/${userId}`, {}, FRIENDS_API_CONFIG);
}

export async function acceptFriendRequest(
	requestId: string
): Promise<{ status: string }> {
	return api.post(
		`/friends/requests/${requestId}/accept`,
		{},
		FRIENDS_API_CONFIG
	);
}

export async function rejectFriendRequest(
	requestId: string
): Promise<{ status: string }> {
	return api.post(
		`/friends/requests/${requestId}/reject`,
		{},
		FRIENDS_API_CONFIG
	);
}

export async function cancelFriendRequest(
	requestId: string
): Promise<{ status: string }> {
	return api.post(
		`/friends/requests/${requestId}/cancel`,
		{},
		FRIENDS_API_CONFIG
	);
}

export async function removeFriend(
	friendUserId: string
): Promise<{ status: string }> {
	return api.delete(`/friends/${friendUserId}`, FRIENDS_API_CONFIG);
}

export const friendsApi = {
	listFriends,
	listIncomingFriendRequests,
	listSentFriendRequests,
	searchFriendCandidates,
	reportFriendUser,
	getFriendsOverview,
	getFriendProfile,
	updateFriendRelationship,
	listFriendCircles,
	createFriendCircle,
	updateFriendCircle,
	deleteFriendCircle,
	sendFriendRequest,
	sendFriendRequestToUser,
	acceptFriendRequest,
	rejectFriendRequest,
	cancelFriendRequest,
	removeFriend,
};
