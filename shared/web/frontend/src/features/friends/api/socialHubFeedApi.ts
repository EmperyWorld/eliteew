/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client contract for privacy-safe Social Hub activity, inbox, privacy-preview, and shared-content read models.
 *
 * Invariants:
 * - Read-model rows are summaries only; private notes, messages, and hidden profile fields are not expected here.
 * - Requests stay under `/api/v1/social-hub/*`.
 *
 * Related:
 * - api/routers/social_hub.py
 * - ../components/SocialHubOverviewPanel.tsx
 */

import { api } from '@/services/api/client';

import { FRIENDS_API_V1_BASE } from './friendsApi';

const SOCIAL_HUB_API_CONFIG = { baseURL: FRIENDS_API_V1_BASE } as const;

export interface SocialHubFeedItem {
	id: string;
	type: string;
	created_at: string;
	actor_user_id: string | null;
	target_user_id: string | null;
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	summary: string | null;
}

export interface SocialHubFeedResponse {
	items: SocialHubFeedItem[];
	next_cursor: string | null;
}

export interface SocialHubActionInboxItem {
	id: string;
	type: string;
	severity: 'high' | 'medium' | 'low' | string;
	title: string;
	summary: string;
	count: number;
	target_tab:
		| 'overview'
		| 'inbox'
		| 'friends'
		| 'circles'
		| 'privacy'
		| string
		| null;
	target_id: string | null;
	created_at: string | null;
}

export interface SocialHubActionInboxResponse {
	items: SocialHubActionInboxItem[];
}

export interface SocialHubPrivacyFieldPreview {
	visibility: string;
	circle_id: string | null;
}

export interface SocialHubPrivacyAudiencePreview {
	id: string;
	label: string;
	visible_fields: string[];
	people_count: number | null;
}

export interface SocialHubPrivacyPreviewResponse {
	discoverability: string;
	fields: Record<string, SocialHubPrivacyFieldPreview>;
	audiences: SocialHubPrivacyAudiencePreview[];
	warnings: string[];
}

export interface SocialHubSharedContentItem {
	id: string;
	name: string | null;
	title: string | null;
	content_type: string | null;
	mime_type: string | null;
	file_size: number | null;
	visibility: string | null;
	direction: 'from_friend' | 'to_friend' | string;
	shared_reason: string;
	created_at: string;
	updated_at: string;
	thumbnail_url: string | null;
}

export interface SocialHubSharedContentResponse {
	items: SocialHubSharedContentItem[];
}

export async function fetchSocialHubFeed(params?: {
	limit?: number;
	cursor?: string | null;
	circle_id?: string | null;
	types?: string[];
}): Promise<SocialHubFeedResponse> {
	return api.get('/social-hub/feed', {
		...SOCIAL_HUB_API_CONFIG,
		params,
	});
}

export async function fetchSocialHubActionInbox(params?: {
	limit?: number;
}): Promise<SocialHubActionInboxResponse> {
	return api.get('/social-hub/inbox', {
		...SOCIAL_HUB_API_CONFIG,
		params,
	});
}

export async function fetchSocialHubPrivacyPreview(): Promise<SocialHubPrivacyPreviewResponse> {
	return api.get('/social-hub/profile/privacy-preview', SOCIAL_HUB_API_CONFIG);
}

export async function fetchSocialHubSharedContent(
	friendUserId: string,
	params?: { limit?: number }
): Promise<SocialHubSharedContentResponse> {
	return api.get(
		`/social-hub/friends/${encodeURIComponent(friendUserId)}/shared-content`,
		{
			...SOCIAL_HUB_API_CONFIG,
			params,
		}
	);
}
