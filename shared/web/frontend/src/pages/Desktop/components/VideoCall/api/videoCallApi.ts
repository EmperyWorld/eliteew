/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for internal GAF video calls (create, join, end).
 *
 * Invariants:
 * - ``already_ended`` on /end must be honored by UI (no duplicate toasts).
 * - pagehide uses keepalive fetch with the access token only.
 *
 * Related:
 * - VideoCallApp.tsx, api/video_calls/router.py
 */
import { api } from '@/services/api/client';
import { getToken } from '@/services/authSession';

export const VIDEO_CALLS_API_V1_BASE = '/api/v1/video-calls';

export type VideoCallJoinResponse = {
	call_id: string;
	chat_id?: string | null;
	room_name: string;
	status: string;
	call_kind?: 'direct' | 'group';
	provider: string;
	meet_base_url?: string | null;
	jwt?: string | null;
	join_url?: string | null;
	expires_at?: string | null;
	awaiting_accept?: boolean;
};

export type VideoCallCreateResponse = VideoCallJoinResponse & {
	callee_user_id?: string | null;
	invited_user_ids?: string[];
	call_kind?: 'direct' | 'group';
	reused_existing?: boolean;
};

export type GroupGafVideoCallCreateRequest = {
	additional_participant_ids: string[];
};

export async function createGafVideoCall(
	chatId: string
): Promise<VideoCallCreateResponse> {
	return api.post<VideoCallCreateResponse>(
		`${VIDEO_CALLS_API_V1_BASE}/gaf-chats/${chatId}`,
		{}
	);
}

export async function createGafGroupVideoCall(
	chatId: string,
	body: GroupGafVideoCallCreateRequest
): Promise<VideoCallCreateResponse> {
	return api.post<VideoCallCreateResponse>(
		`${VIDEO_CALLS_API_V1_BASE}/gaf-chats/${chatId}/group`,
		body
	);
}

export type VideoCallInviteRequest = {
	participant_user_ids: string[];
};

export type VideoCallInviteResponse = {
	call_id: string;
	invited_user_ids: string[];
};

export async function inviteToVideoCall(
	callId: string,
	body: VideoCallInviteRequest
): Promise<VideoCallInviteResponse> {
	return api.post<VideoCallInviteResponse>(
		`${VIDEO_CALLS_API_V1_BASE}/${callId}/invite`,
		body
	);
}

export async function joinVideoCall(
	callId: string
): Promise<VideoCallJoinResponse> {
	return api.post<VideoCallJoinResponse>(
		`${VIDEO_CALLS_API_V1_BASE}/${callId}/join`,
		{}
	);
}

export type VideoCallEndResponse = {
	call_id: string;
	status?: string;
	call_status?: string | null;
	missed_reason?: string | null;
	already_ended?: boolean;
};

export async function endVideoCall(
	callId: string
): Promise<VideoCallEndResponse> {
	return api.post<VideoCallEndResponse>(
		`${VIDEO_CALLS_API_V1_BASE}/${callId}/end`,
		{}
	);
}

/**
 * Best-effort `/end` when the product page is dying (pagehide).
 * Does not use axios or the auth abort registry — those cancel on teardown.
 * Does not send the refresh token.
 */
export function endVideoCallKeepalive(callId: string): void {
	const id = callId.trim();
	if (!id || typeof fetch === 'undefined') return;
	const headers: Record<string, string> = {
		'content-type': 'application/json',
	};
	const token = getToken()?.trim();
	if (token) {
		headers.authorization = `Bearer ${token}`;
	}
	try {
		void fetch(`${VIDEO_CALLS_API_V1_BASE}/${id}/end`, {
			method: 'POST',
			headers,
			body: '{}',
			keepalive: true,
		});
	} catch {
		/* page is dying */
	}
}

export type VideoCallPendingIncomingItem = {
	call_id: string;
	chat_id?: string | null;
	caller_user_id: string;
	created_at: string;
	call_target?: string;
};

/** Recovery when Socket.IO missed video_call.incoming (desktop-client). */
export async function listPendingIncomingVideoCalls(): Promise<
	VideoCallPendingIncomingItem[]
> {
	return api.get<VideoCallPendingIncomingItem[]>(
		`${VIDEO_CALLS_API_V1_BASE}/pending-incoming`
	);
}
