/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop GAF video-call ring, outgoing toast, join-poll, and Meet open on accepted.
 *
 * Invariants:
 * - localOutgoingVideoCallIdsRef gates Meet open (device affinity).
 * - Outgoing handler registered via registerOutgoingVideoCallHandler module bridge.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - context/useGafChatSocketEventHandlers.ts
 * - documentation/product/INTERNAL-VIDEO-CALLS.md
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { toast as sonnerToast } from 'sonner';
import { requestOpenVideoCallWindow } from '../utils/desktopDeepLink';
import { playGafVideoCallRingNow } from '../utils/gafChatUiSounds';
import {
	endVideoCall,
	joinVideoCall,
} from '../components/VideoCall/api/videoCallApi';
import { startOutgoingJoinPoll } from '../components/GAFChat/videoCallOutgoingJoinPoll';
import { shouldOpenDesktopMeetOnVideoCallAccepted } from '../components/GAFChat/videoCallDeviceAffinity';
import {
	registerOutgoingVideoCallHandler,
	type OutgoingVideoCallOpts,
} from '../components/GAFChat/gafVideoCallOutgoing';
import type { UgsNotificationBlockSettings } from '@/types/profile';
import { VIDEO_CALL_RING_INTERVAL_MS } from './gafChatProviderTypes';

export function useGafDesktopVideoCallProcess(options: {
	gafIncomingBlockRef: RefObject<UgsNotificationBlockSettings>;
}) {
	const { gafIncomingBlockRef } = options;
	const { t } = useTranslation('gafChat');

	const videoCallRingTimersRef = useRef<Map<string, number>>(new Map());
	const videoCallOutgoingJoinPollRef = useRef<Map<string, () => void>>(
		new Map()
	);
	const localOutgoingVideoCallIdsRef = useRef<Set<string>>(new Set());

	const stopVideoCallRing = useCallback((callId?: string | null) => {
		if (!callId) return;
		const timerId = videoCallRingTimersRef.current.get(callId);
		if (timerId == null) return;
		window.clearInterval(timerId);
		videoCallRingTimersRef.current.delete(callId);
	}, []);

	const stopOutgoingJoinPoll = useCallback((callId?: string | null) => {
		if (!callId) return;
		const dispose = videoCallOutgoingJoinPollRef.current.get(callId);
		if (!dispose) return;
		dispose();
		videoCallOutgoingJoinPollRef.current.delete(callId);
	}, []);

	const openMeetAfterOutgoingAccepted = useCallback(
		(callId: string) => {
			const id = callId.trim();
			if (!id) return;
			stopVideoCallRing(id);
			stopOutgoingJoinPoll(id);
			sonnerToast.dismiss(`video-call:${id}`);
			sonnerToast.dismiss(`video-call-outgoing:${id}`);
			const openMeet = shouldOpenDesktopMeetOnVideoCallAccepted(
				localOutgoingVideoCallIdsRef.current,
				id
			);
			localOutgoingVideoCallIdsRef.current.delete(id);
			if (!openMeet) return;
			requestOpenVideoCallWindow({
				videoCallId: id,
				videoCallTitle: t('videoCallAppTitle'),
			});
		},
		[stopOutgoingJoinPoll, stopVideoCallRing, t]
	);

	const startVideoCallRing = useCallback(
		(callId: string) => {
			const incoming = gafIncomingBlockRef.current;
			if (!incoming?.enabled || !incoming.in_app) return;
			stopVideoCallRing(callId);
			const play = () => {
				void playGafVideoCallRingNow({ force: true });
			};
			play();
			const timerId = window.setInterval(play, VIDEO_CALL_RING_INTERVAL_MS);
			videoCallRingTimersRef.current.set(callId, timerId);
		},
		[gafIncomingBlockRef, stopVideoCallRing]
	);

	const showOutgoingVideoCall = useCallback(
		(opts: OutgoingVideoCallOpts) => {
			const callId = opts.callId.trim();
			if (!callId) return;
			localOutgoingVideoCallIdsRef.current.add(callId);
			const partnerLabel =
				opts.partnerLabel.trim() || t('desktopProcess.partnerLabelFallback');
			const cancelCall = () => {
				stopVideoCallRing(callId);
				stopOutgoingJoinPoll(callId);
				localOutgoingVideoCallIdsRef.current.delete(callId);
				sonnerToast.dismiss(`video-call-outgoing:${callId}`);
				void endVideoCall(callId).catch(() => {
					sonnerToast.error(t('desktopProcess.cancelCallFailed'));
				});
			};
			startVideoCallRing(callId);
			stopOutgoingJoinPoll(callId);
			const disposePoll = startOutgoingJoinPoll({
				callId,
				join: joinVideoCall,
				isStillOutgoing: (id) => localOutgoingVideoCallIdsRef.current.has(id),
				onAccepted: openMeetAfterOutgoingAccepted,
			});
			videoCallOutgoingJoinPollRef.current.set(callId, disposePoll);
			sonnerToast.info(
				t('desktopProcess.outgoingCallTitle', { partner: partnerLabel }),
				{
					description: t('desktopProcess.outgoingCallWaiting'),
					duration: 120_000,
					id: `video-call-outgoing:${callId}`,
					action: {
						label: t('desktopProcess.actionCancel'),
						onClick: cancelCall,
					},
					cancel: {
						label: t('desktopProcess.actionDismiss'),
						onClick: () => sonnerToast.dismiss(`video-call-outgoing:${callId}`),
					},
				}
			);
		},
		[
			openMeetAfterOutgoingAccepted,
			startVideoCallRing,
			stopOutgoingJoinPoll,
			stopVideoCallRing,
			t,
		]
	);

	useEffect(() => {
		registerOutgoingVideoCallHandler(showOutgoingVideoCall);
		return () => registerOutgoingVideoCallHandler(null);
	}, [showOutgoingVideoCall]);

	useEffect(() => {
		return () => {
			for (const timerId of videoCallRingTimersRef.current.values()) {
				window.clearInterval(timerId);
			}
			videoCallRingTimersRef.current.clear();
			for (const dispose of videoCallOutgoingJoinPollRef.current.values()) {
				dispose();
			}
			videoCallOutgoingJoinPollRef.current.clear();
		};
	}, []);

	const clearVideoCallStateOnLogout = useCallback(() => {
		for (const timerId of videoCallRingTimersRef.current.values()) {
			window.clearInterval(timerId);
		}
		videoCallRingTimersRef.current.clear();
		for (const dispose of videoCallOutgoingJoinPollRef.current.values()) {
			dispose();
		}
		videoCallOutgoingJoinPollRef.current.clear();
		localOutgoingVideoCallIdsRef.current.clear();
	}, []);

	return {
		stopVideoCallRing,
		stopOutgoingJoinPoll,
		startVideoCallRing,
		openMeetAfterOutgoingAccepted,
		showOutgoingVideoCall,
		localOutgoingVideoCallIdsRef,
		clearVideoCallStateOnLogout,
	};
}
