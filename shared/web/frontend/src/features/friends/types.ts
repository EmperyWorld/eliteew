/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TypeScript domain contracts for Social Hub friends, circles, requests, and relationship state.
 *
 * Invariants:
 * - Field names mirror the current `/api/v1/friends` JSON boundary unless explicitly mapped in `friendsApi.ts`.
 * - Optional circle visual metadata must not be required by older API payloads.
 *
 * Related:
 * - api/friendsApi.ts
 * - components/FriendsDirectory.tsx
 */

export interface FriendCircle {
	id: string;
	name: string;
	members_count: number;
	sort_order?: number;
	color?: string | null;
	icon?: string | null;
}

export interface Friend {
	id: string;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
	is_trusted?: boolean;
	admin_badge_label?: string | null;
	admin_badge_hint?: string | null;
	/** Shown on friend profile when visibility allows. */
	bio?: string | null;
	is_favorite?: boolean;
	is_muted?: boolean;
	is_blocked?: boolean;
	share_activity_with_friend?: boolean;
	activity_visible_to_current_user?: boolean;
	last_activity_at?: string | null;
	last_interaction_at?: string | null;
	circles?: FriendCircle[];
}

export type FriendRelationshipStatus =
	| 'can_send'
	| 'friend'
	| 'incoming_request'
	| 'outgoing_request';

export interface IncomingFriendRequest {
	id: string;
	from_user_id: string;
	created_at?: string | null;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
}

export interface SentFriendRequest {
	id: string;
	to_user_id: string;
	created_at?: string | null;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
}

export interface FriendSearchCandidate {
	id: string;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
	/** Admin-granted trusted badge. */
	is_trusted?: boolean;
	admin_badge_label?: string | null;
	admin_badge_hint?: string | null;
	relationshipStatus: FriendRelationshipStatus;
	requestId?: string | null;
	is_muted?: boolean;
	is_blocked?: boolean;
	share_activity_with_friend?: boolean;
	activity_visible_to_current_user?: boolean;
	last_activity_at?: string | null;
	last_interaction_at?: string | null;
}

export interface FriendProfile extends Friend {
	private_note?: string | null;
	note_updated_at?: string | null;
	friendship_created_at?: string | null;
}

export interface FriendsStats {
	friendsCount: number;
	incomingRequestsCount: number;
	sentRequestsCount: number;
}

export interface FriendsOverview {
	friends: Friend[];
	incomingRequests: IncomingFriendRequest[];
	sentRequests: SentFriendRequest[];
	circles: FriendCircle[];
	stats: FriendsStats;
}
