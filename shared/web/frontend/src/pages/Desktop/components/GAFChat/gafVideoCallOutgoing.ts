/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bridge for starting outgoing 1:1 GAF video call ringing UI from GAFChatApp without circular imports.
 *
 * Related:
 * - GAFChatProvider.tsx, GAFChatApp.tsx
 */
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';

export type OutgoingVideoCallOpts = {
	callId: string;
	chatId: string;
	partnerLabel: string;
};

type OutgoingHandler = (opts: OutgoingVideoCallOpts) => void;

let outgoingHandler: OutgoingHandler | null = null;

export function registerOutgoingVideoCallHandler(
	handler: OutgoingHandler | null
): void {
	outgoingHandler = handler;
}

export function startOutgoingVideoCall(opts: OutgoingVideoCallOpts): void {
	outgoingHandler?.(opts);
}

const MISSED_REASON_KEYS: Record<string, string> = {
	no_answer: 'videoCallEvent.missedReason.no_answer',
	callee_unreachable: 'videoCallEvent.missedReason.callee_unreachable',
	callee_mobile_unreachable:
		'videoCallEvent.missedReason.callee_mobile_unreachable',
	declined: 'videoCallEvent.missedReason.declined',
	caller_cancelled: 'videoCallEvent.missedReason.caller_cancelled',
};

export function videoCallMissedToastMessage(
	missedReason: string | undefined,
	status: string | undefined,
	t?: TFunction<'gafChat'>
): string {
	const translate =
		t ??
		(((key, opts) =>
			i18n.t(key, {
				ns: 'gafChat',
				...(opts as object),
			}) as string) as TFunction<'gafChat'>);

	if (status === 'missed' && missedReason) {
		const key = MISSED_REASON_KEYS[missedReason];
		if (key) return translate(key);
		return translate('videoCallEvent.missed');
	}
	return translate('videoCallEndedToast');
}
