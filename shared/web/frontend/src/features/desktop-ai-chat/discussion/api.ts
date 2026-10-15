/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for Desktop AI Chat Discussion lifecycle endpoints.
 *
 * Invariants:
 * - Uses BASE `/api/v1/desktop/ai-chat`; never routes through normal /stream.
 *
 * Related:
 * - api/routers/desktop_ai_chat_discussion_routes.py
 */
import { apiClient } from '@/services/api/client';
import { BASE } from '../api/desktopChatClient/shared';
import type {
	DiscussionIntensity,
	DiscussionPreset,
	DiscussionSession,
	DiscussionTurn,
} from './types';

export async function listDiscussionPresets(): Promise<DiscussionPreset[]> {
	const { data } = await apiClient.get<{ items: DiscussionPreset[] }>(
		`${BASE}/discussion/presets`
	);
	return data.items ?? [];
}

export async function fetchDiscussionParticipantProfile(): Promise<{
	display_name: string;
	role_title: string;
	default_role_title: string;
}> {
	const { data } = await apiClient.get<{
		display_name: string;
		role_title: string;
		default_role_title: string;
	}>(`${BASE}/discussion/participant-profile`);
	return data;
}

export async function startDiscussion(
	chatId: string,
	body: {
		preset_id: string;
		topic: string;
		goal?: string;
		roster: string[];
		intensity?: DiscussionIntensity;
		role_title?: string;
		client_request_id?: string;
		source_message_id?: string;
	}
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/start`,
		body
	);
	return data;
}

export async function getDiscussion(
	chatId: string,
	sessionId: string
): Promise<DiscussionSession> {
	const { data } = await apiClient.get<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}`
	);
	return data;
}

export async function raiseDiscussionHand(
	chatId: string,
	sessionId: string,
	expected_version?: number
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}/raise-hand`,
		{ expected_version }
	);
	return data;
}

export async function postDiscussionInterjection(
	chatId: string,
	sessionId: string,
	body: {
		content: string;
		expected_version?: number;
		client_request_id?: string;
	}
): Promise<{ session: DiscussionSession; turn: DiscussionTurn }> {
	const { data } = await apiClient.post<{
		session: DiscussionSession;
		turn: DiscussionTurn;
	}>(`${BASE}/chats/${chatId}/discussion/${sessionId}/interjections`, body);
	return data;
}

export async function continueDiscussion(
	chatId: string,
	sessionId: string,
	expected_version?: number,
	client_request_id?: string
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}/continue`,
		{ expected_version, client_request_id }
	);
	return data;
}

export async function finishDiscussion(
	chatId: string,
	sessionId: string,
	expected_version?: number
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}/finish`,
		{ expected_version }
	);
	return data;
}

export async function cancelDiscussion(
	chatId: string,
	sessionId: string,
	expected_version?: number
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}/cancel`,
		{ expected_version }
	);
	return data;
}

export async function generateDiscussionDocument(
	chatId: string,
	sessionId: string,
	expected_version?: number,
	force = false
): Promise<DiscussionSession> {
	const { data } = await apiClient.post<DiscussionSession>(
		`${BASE}/chats/${chatId}/discussion/${sessionId}/generate-document`,
		{ expected_version, force }
	);
	return data;
}

export function discussionEventsUrl(
	chatId: string,
	sessionId: string,
	lastId = '0-0'
): string {
	const q = new URLSearchParams({ last_id: lastId });
	return `${BASE}/chats/${chatId}/discussion/${sessionId}/events?${q.toString()}`;
}
