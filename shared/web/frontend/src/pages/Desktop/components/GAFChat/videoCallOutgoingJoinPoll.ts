/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP join-poll for desktop outgoing 1:1 calls when Socket.IO misses
 * `video_call.accepted` (e.g. client_build_gate / app_build_mismatch hard reject).
 *
 * Invariants:
 * - Poll must not open Meet while join still returns awaiting_accept / blank join_url.
 * - 409 awaiting_callee_accept is expected while ringing — keep polling.
 *
 * Related:
 * - GAFChatProvider.tsx, videoCallApi.ts, INTERNAL-VIDEO-CALLS.md
 */
import { APIError } from '@/services/api/client';
import type { VideoCallJoinResponse } from '../VideoCall/api/videoCallApi';

export const OUTGOING_JOIN_POLL_MS = 2000;

/** True when caller join is rejected because callee has not accepted yet. */
export function isOutgoingJoinStillAwaiting(error: unknown): boolean {
	if (!(error instanceof APIError)) return false;
	if (error.statusCode !== 409) return false;
	const code = String(error.errorCode ?? '').toLowerCase();
	if (code.includes('awaiting')) return true;
	const details = error.details;
	if (details && typeof details === 'object') {
		const detailCode = String(
			(details as { code?: unknown; error?: unknown }).code ??
				(details as { error?: unknown }).error ??
				''
		).toLowerCase();
		if (detailCode.includes('awaiting')) return true;
	}
	const msg = String(error.message ?? '').toLowerCase();
	return msg.includes('awaiting');
}

export function shouldTreatJoinAsAccepted(
	join: Pick<VideoCallJoinResponse, 'awaiting_accept' | 'join_url' | 'status'>
): boolean {
	if (join.awaiting_accept === true) return false;
	const url = join.join_url?.trim() ?? '';
	if (!url) return false;
	const status = String(join.status ?? '').toLowerCase();
	if (status === 'ringing') return false;
	return true;
}

export type OutgoingJoinPollOptions = {
	callId: string;
	intervalMs?: number;
	join: (callId: string) => Promise<VideoCallJoinResponse>;
	/** Return false to stop (cancelled / already accepted via socket). */
	isStillOutgoing: (callId: string) => boolean;
	onAccepted: (callId: string) => void;
	onTransientError?: (callId: string, error: unknown) => void;
};

/**
 * Starts a join poll. Returns a disposer that clears the interval.
 * First tick is delayed by ``intervalMs`` (same as mobile).
 */
export function startOutgoingJoinPoll(
	options: OutgoingJoinPollOptions
): () => void {
	const {
		callId,
		intervalMs = OUTGOING_JOIN_POLL_MS,
		join,
		isStillOutgoing,
		onAccepted,
		onTransientError,
	} = options;
	let disposed = false;
	let inFlight = false;

	const tick = async () => {
		if (disposed || inFlight) return;
		if (!isStillOutgoing(callId)) {
			dispose();
			return;
		}
		inFlight = true;
		try {
			const response = await join(callId);
			if (disposed) return;
			if (!isStillOutgoing(callId)) {
				dispose();
				return;
			}
			if (!shouldTreatJoinAsAccepted(response)) return;
			dispose();
			onAccepted(callId);
		} catch (error) {
			if (disposed) return;
			if (isOutgoingJoinStillAwaiting(error)) return;
			onTransientError?.(callId, error);
		} finally {
			inFlight = false;
		}
	};

	const timerId = window.setInterval(() => {
		void tick();
	}, intervalMs);

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		window.clearInterval(timerId);
	};

	return dispose;
}
