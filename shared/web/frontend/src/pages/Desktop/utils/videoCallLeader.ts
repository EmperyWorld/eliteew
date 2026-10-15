/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Leader election for Jitsi VideoCall iframe: one tab/window per user+callId loads Meet;
 * duplicates show a passive state instead of joining again (avoids 16× «я» in room).
 *
 * Invariants:
 * - Lock name scoped per user id + call id.
 * - Visible tab may request leadership from a hidden leader (same pattern as desktop realtime).
 * - Hidden leader yields Web Lock / heartbeat on `request-leadership` so the visible tab can join.
 *
 * Related:
 * - VideoCallApp.tsx, desktopRealtimeLeader.ts, subscribeDocumentVisibleSync.ts
 */

import { getOrCreateBrowserTabSessionId } from '@/utils/browserTabSessionId';
import { subscribeDocumentVisibleSync } from './subscribeDocumentVisibleSync';

const LOCK_PREFIX = 'eliteew-video-call:';

/** BroadcastChannel name for per-call leadership steal requests. */
export const VIDEO_CALL_LEADER_BC = 'eliteew-video-call-leader-v1';

/** Heartbeat stale window for localStorage fallback (ms). */
export const VIDEO_CALL_LEADER_STALE_MS = 6000;

export type VideoCallLeadershipCallbacks = {
	onAcquire: () => void;
	onRelease: () => void;
};

export type VideoCallLeadershipController = {
	dispose: () => void;
	/** Test/ops: force-release lock so another tab can acquire. */
	yieldLeadership: () => void;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function lockNameFor(userId: string, callId: string): string {
	return `${LOCK_PREFIX}${userId.trim()}:${callId.trim()}`;
}

function heartbeatStorageKey(userId: string, callId: string): string {
	return `${lockNameFor(userId, callId)}:heartbeat`;
}

function readHeartbeat(storageKey: string): {
	tabId: string | null;
	ts: number;
} {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) {
			return { tabId: null, ts: 0 };
		}
		const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
		return {
			tabId: parsed.tabId ?? null,
			ts: typeof parsed.ts === 'number' ? parsed.ts : 0,
		};
	} catch {
		return { tabId: null, ts: 0 };
	}
}

function writeHeartbeat(storageKey: string, tabId: string): void {
	try {
		localStorage.setItem(storageKey, JSON.stringify({ tabId, ts: Date.now() }));
	} catch {
		/* private mode / quota */
	}
}

/**
 * Pure helper (tests): should a visible tab ask a hidden holder to yield?
 * Hidden leader yields; visible non-holder requests steal.
 */
export function shouldYieldVideoCallLeadershipForVisibility(input: {
	documentHidden: boolean;
	holdingLeadership: boolean;
	messageType: string;
	fromTabId: string;
	selfTabId: string;
}): boolean {
	if (input.messageType !== 'request-leadership') {
		return false;
	}
	if (!input.fromTabId || input.fromTabId === input.selfTabId) {
		return false;
	}
	return input.holdingLeadership && input.documentHidden;
}

export function acquireVideoCallLeadership(
	userId: string,
	callId: string,
	callbacks: VideoCallLeadershipCallbacks
): VideoCallLeadershipController {
	let disposed = false;
	let releaseWaiter: (() => void) | null = null;
	let holding = false;
	const tabId = getOrCreateBrowserTabSessionId();
	const lockName = lockNameFor(userId, callId);
	const storageKey = heartbeatStorageKey(userId, callId);
	const trimmedUser = userId.trim();
	const trimmedCall = callId.trim();

	const yieldLeadership = () => {
		releaseWaiter?.();
		releaseWaiter = null;
		try {
			const { tabId: leaderTabId } = readHeartbeat(storageKey);
			if (leaderTabId === tabId) {
				localStorage.removeItem(storageKey);
			}
		} catch {
			/* ignore */
		}
	};

	let bc: BroadcastChannel | null = null;
	const postBc = (payload: Record<string, unknown>) => {
		try {
			bc?.postMessage(payload);
		} catch {
			/* ignore */
		}
	};

	const onLeadershipRequest = (fromTabId: string) => {
		if (
			!shouldYieldVideoCallLeadershipForVisibility({
				documentHidden:
					typeof document !== 'undefined' &&
					document.visibilityState === 'hidden',
				holdingLeadership: holding || releaseWaiter != null,
				messageType: 'request-leadership',
				fromTabId,
				selfTabId: tabId,
			})
		) {
			return;
		}
		yieldLeadership();
	};

	try {
		if (typeof BroadcastChannel !== 'undefined') {
			bc = new BroadcastChannel(VIDEO_CALL_LEADER_BC);
			bc.onmessage = (event: MessageEvent) => {
				const data = event.data as Record<string, unknown> | undefined;
				if (data?.type !== 'request-leadership') {
					return;
				}
				if (
					String(data.userId ?? '') !== trimmedUser ||
					String(data.callId ?? '') !== trimmedCall
				) {
					return;
				}
				onLeadershipRequest(String(data.fromTabId ?? ''));
			};
		}
	} catch {
		bc = null;
	}

	const requestLeadershipFromHiddenLeader = () => {
		postBc({
			type: 'request-leadership',
			userId: trimmedUser,
			callId: trimmedCall,
			fromTabId: tabId,
			ts: Date.now(),
		});
	};

	let unsubVisibleSync: (() => void) | undefined;
	if (typeof document !== 'undefined') {
		unsubVisibleSync = subscribeDocumentVisibleSync(
			requestLeadershipFromHiddenLeader
		);
	}

	const markAcquired = () => {
		if (holding || disposed) {
			return;
		}
		holding = true;
		callbacks.onAcquire();
	};

	const markReleased = () => {
		if (!holding) {
			return;
		}
		holding = false;
		if (!disposed) {
			callbacks.onRelease();
		}
	};

	const runWithWebLock = async () => {
		while (!disposed) {
			try {
				await navigator.locks.request(lockName, async () => {
					if (disposed) {
						return;
					}
					markAcquired();
					await new Promise<void>((resolve) => {
						releaseWaiter = resolve;
					});
					releaseWaiter = null;
					markReleased();
				});
			} catch {
				await sleep(2000);
			}
			if (!disposed) {
				await sleep(400);
			}
		}
	};

	const runFallbackHeartbeat = async () => {
		while (!disposed) {
			const now = Date.now();
			const { tabId: leaderTabId, ts: leaderTs } = readHeartbeat(storageKey);
			const stale = now - leaderTs > VIDEO_CALL_LEADER_STALE_MS;
			const weAreLeader = leaderTabId === tabId || stale || leaderTabId == null;

			if (weAreLeader && !holding) {
				writeHeartbeat(storageKey, tabId);
				markAcquired();
			} else if (!weAreLeader && holding) {
				markReleased();
			}

			if (holding) {
				writeHeartbeat(storageKey, tabId);
			}

			await sleep(2000);
		}

		if (holding) {
			markReleased();
		}
	};

	const runLoop = async () => {
		if (
			typeof navigator !== 'undefined' &&
			typeof navigator.locks?.request === 'function'
		) {
			await runWithWebLock();
			return;
		}
		await runFallbackHeartbeat();
	};

	void runLoop();

	return {
		dispose: () => {
			disposed = true;
			unsubVisibleSync?.();
			yieldLeadership();
			markReleased();
			try {
				bc?.close();
			} catch {
				/* ignore */
			}
			bc = null;
		},
		yieldLeadership,
	};
}
