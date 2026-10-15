/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Leader-tab HTTP recovery poll for missed `video_call.incoming` Socket.IO events.
 *
 * Invariants:
 * - Isolated from the main GAF socket listener effect — unstable callback deps must not
 *   restart this poll (that caused ~1 req/s spam when parent re-rendered every second).
 * - Follower tabs rely on BroadcastChannel relay; they do not poll.
 * - Empty `[]` responses back off to 30s after three consecutive ticks.
 *
 * Related:
 * - context/useGafChatSocketEventHandlers.ts
 * - documentation/product/INTERNAL-VIDEO-CALLS.md
 */

import { useEffect, useRef } from 'react';
import { listPendingIncomingVideoCalls } from '../components/VideoCall/api/videoCallApi';
import {
	PENDING_INCOMING_EMPTY_BACKOFF_AFTER,
	PENDING_INCOMING_EMPTY_BACKOFF_MS,
	PENDING_INCOMING_VIDEO_POLL_MS,
	type VideoCallIncomingPayload,
} from './gafChatProviderTypes';

export type PendingIncomingVideoCallHandler = (
	payload: VideoCallIncomingPayload
) => void;

export function resolvePendingIncomingPollDelayMs(emptyStreak: number): number {
	return emptyStreak >= PENDING_INCOMING_EMPTY_BACKOFF_AFTER
		? PENDING_INCOMING_EMPTY_BACKOFF_MS
		: PENDING_INCOMING_VIDEO_POLL_MS;
}

export function usePendingIncomingVideoCallPoll(options: {
	userId: string | undefined;
	isDesktopRealtimeLeader: boolean;
	onVideoIncoming: PendingIncomingVideoCallHandler;
}): void {
	const { userId, isDesktopRealtimeLeader, onVideoIncoming } = options;
	const onVideoIncomingRef = useRef(onVideoIncoming);
	onVideoIncomingRef.current = onVideoIncoming;

	useEffect(() => {
		if (!userId || !isDesktopRealtimeLeader) {
			return;
		}

		let cancelled = false;
		let pollBusy = false;
		let emptyStreak = 0;
		let timerId: number | null = null;

		const scheduleNext = (delayMs: number) => {
			if (cancelled) {
				return;
			}
			if (timerId !== null) {
				window.clearTimeout(timerId);
			}
			timerId = window.setTimeout(() => {
				void tick();
			}, delayMs);
		};

		const tick = async () => {
			if (cancelled || pollBusy) {
				return;
			}
			if (
				typeof document !== 'undefined' &&
				document.visibilityState === 'hidden'
			) {
				scheduleNext(PENDING_INCOMING_VIDEO_POLL_MS);
				return;
			}

			pollBusy = true;
			try {
				const items = await listPendingIncomingVideoCalls();
				if (cancelled) {
					return;
				}
				if (items.length === 0) {
					emptyStreak += 1;
				} else {
					emptyStreak = 0;
					for (const item of items) {
						const callId = String(item.call_id || '').trim();
						if (!callId) continue;
						onVideoIncomingRef.current({
							call_id: callId,
							chat_id: item.chat_id ?? undefined,
							caller_user_id: item.caller_user_id,
							call_target: item.call_target || 'both',
						});
					}
				}
			} catch {
				/* best-effort recovery; socket path remains primary */
			} finally {
				pollBusy = false;
				if (!cancelled) {
					scheduleNext(resolvePendingIncomingPollDelayMs(emptyStreak));
				}
			}
		};

		void tick();

		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				void tick();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			cancelled = true;
			if (timerId !== null) {
				window.clearTimeout(timerId);
			}
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [userId, isDesktopRealtimeLeader]);
}
