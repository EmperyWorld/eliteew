/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop window for internal GAF video calls (Jitsi Meet). The browser
 * mounts Meet in an iframe. EmpiierOS and Tauri open a sibling WebView
 * clipped to this window's stage. EmpiierOS must not nest the iframe:
 * that SIGSEGV takes the product WebProcess. Do not FILL the product
 * and do not request kiosk fullscreen. Parent chrome does not announce
 * local video.
 *
 * Invariants:
 * - ``callId`` must match ``initialPayload.videoCallId`` on the desktop window for close routing.
 * - Idempotent ``/end`` (``already_ended``) must not show repeated success toasts.
 * - Tauri and EmpiierOS stages close on hangup, lost, and unmount.
 *   EmpiierOS open always includes CSS-pixel bounds.
 * - ``join_url`` host stays ``meet.eliteew.ru``. Do not rewrite it.
 * - Opening this window must not close ``GAFChatApp``.
 * - OS Meet death (``empiieros-meet-stage-lost``) and product ``pagehide``
 *   must ``POST /end``. Closing the call window does too. A Strict Mode
 *   remount must not end a live call.
 *
 * Related:
 * - api/video_calls/router.py, utils/videoCallNativeMeetStage.ts
 * - utils/desktopDeepLink.ts ``requestCloseDesktopVideoCall``
 * - DesktopChromeTooltip.tsx
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { requestCloseDesktopVideoCall } from '@/pages/Desktop/utils/desktopDeepLink';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppToolbar,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	endVideoCall,
	endVideoCallKeepalive,
	inviteToVideoCall,
	joinVideoCall,
} from './api/videoCallApi';
import { isOutgoingJoinStillAwaiting } from '../GAFChat/videoCallOutgoingJoinPoll';
import { VideoCallParticipantPickerModal } from './VideoCallParticipantPickerModal';
import { acquireVideoCallLeadership } from '@/pages/Desktop/utils/videoCallLeader';
import { isEmpiierosFoflineHost } from '@/services/desktopClient/eliteewProductHost';
import {
	closeEmpiierosMeetStage,
	closeNativeMeetStage,
	EMPIIEROS_MEET_STAGE_LOST_EVENT,
	isEliteewNativeDesktopProductShell,
	meetStageBoundsFromElement,
	meetStageLostCode,
	openEmpiierosMeetStage,
	openNativeMeetStage,
	setEmpiierosMeetStageBounds,
	setNativeMeetStageBounds,
} from '@/pages/Desktop/utils/videoCallNativeMeetStage';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	VIDEO_CALL_GUIDE_AUDIO_LS_KEY,
	VIDEO_CALL_GUIDE_ROOT_ID,
	VIDEO_CALL_GUIDE_STEP_DEFS,
	VIDEO_CALL_GUIDE_TOUR_FOLDER,
} from './videoCallGuideConstants';
import authSession, { getUserInfo } from '@/services/authSession';
import { Services } from '@/services';
import {
	ArrowPathIcon,
	PhoneXMarkIcon,
	UserPlusIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

export const VIDEO_CALL_ENDED_BROWSER_EVENT = 'eliteew-video-call-ended';

const JITSI_IFRAME_ALLOW = [
	'camera *',
	'microphone *',
	'fullscreen *',
	'display-capture *',
	'autoplay *',
	'screen-wake-lock *',
	'xr-spatial-tracking *',
	'gamepad *',
].join('; ');

export interface VideoCallAppProps {
	callId?: string;
	initialJoinUrl?: string;
	title?: string;
}

function closeVideoCallWindow(callId: string): void {
	requestCloseDesktopVideoCall(callId);
}

/**
 * Window-X unmount ends the call. Strict Mode runs cleanup then remounts
 * in the same turn; the remount cancels the timer so a live call survives.
 */
const pendingWindowCloseEnd = new Map<string, number>();

function cancelScheduledVideoCallEnd(callId: string): void {
	const timer = pendingWindowCloseEnd.get(callId);
	if (timer === undefined) return;
	window.clearTimeout(timer);
	pendingWindowCloseEnd.delete(callId);
}

function scheduleVideoCallEndOnRealUnmount(callId: string): void {
	cancelScheduledVideoCallEnd(callId);
	const timer = window.setTimeout(() => {
		pendingWindowCloseEnd.delete(callId);
		void endVideoCall(callId);
	}, 0);
	pendingWindowCloseEnd.set(callId, timer);
}

export default function VideoCallApp({
	callId,
	initialJoinUrl,
	title,
}: VideoCallAppProps) {
	const { t } = useTranslation('gafChat');
	const queryClient = useQueryClient();
	const guideLabels = React.useMemo(
		() => guideTourLabelsFromI18n(t, 'videoCallGuide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'videoCallGuide.steps',
		VIDEO_CALL_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = React.useState(false);
	const openGuideTour = React.useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const normalizedCallId = callId?.trim() || '';
	const [ended, setEnded] = React.useState(false);
	const [isCallLeader, setIsCallLeader] = React.useState(false);
	const [invitePickerOpen, setInvitePickerOpen] = React.useState(false);
	const [nativeMeetActive, setNativeMeetActive] = React.useState(false);
	const [nativeMeetFailed, setNativeMeetFailed] = React.useState(false);
	const endedRef = React.useRef(false);
	const stageHostRef = React.useRef<HTMLDivElement | null>(null);
	const nativeMeetUrlRef = React.useRef<string | null>(null);
	const osMeetOpenedRef = React.useRef(false);
	const leadershipRef = React.useRef<ReturnType<
		typeof acquireVideoCallLeadership
	> | null>(null);
	const nativeDesktopShell = isEliteewNativeDesktopProductShell();
	const empiierosMeetHost = isEmpiierosFoflineHost();

	const joinStaleMs = React.useMemo(() => {
		// JWT refresh only when close to expiry — avoid remounting Jitsi iframe on every mount.
		return 25 * 60 * 1000;
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		void (async () => {
			let userId = authSession.subject?.trim() || '';
			if (!userId) {
				try {
					const profile = await getUserInfo();
					userId = profile?.id?.trim() || '';
				} catch {
					userId = '';
				}
			}
			if (cancelled || !userId || !normalizedCallId || endedRef.current) {
				if (!cancelled) setIsCallLeader(false);
				return;
			}
			leadershipRef.current?.dispose();
			leadershipRef.current = acquireVideoCallLeadership(
				userId,
				normalizedCallId,
				{
					onAcquire: () => {
						if (!cancelled) setIsCallLeader(true);
					},
					onRelease: () => {
						if (!cancelled) setIsCallLeader(false);
					},
				}
			);
		})();
		return () => {
			cancelled = true;
			leadershipRef.current?.dispose();
			leadershipRef.current = null;
		};
	}, [normalizedCallId]);

	const markEndedAndClose = React.useCallback(
		(options?: { toast?: boolean }) => {
			if (endedRef.current) {
				if (normalizedCallId) closeVideoCallWindow(normalizedCallId);
				return;
			}
			endedRef.current = true;
			setEnded(true);
			if (options?.toast !== false) {
				toast.message(t('videoCallEndedToast'), {
					id: `video-call-ended:${normalizedCallId}`,
				});
			}
			if (normalizedCallId) closeVideoCallWindow(normalizedCallId);
		},
		[normalizedCallId, t]
	);

	// Fetch JWT once per session; refresh only when stale (iframe key stays callId, not join URL).
	const query = useQuery({
		queryKey: ['video-call', normalizedCallId, 'join'],
		queryFn: () => joinVideoCall(normalizedCallId),
		enabled: Boolean(normalizedCallId) && !ended && isCallLeader,
		staleTime: joinStaleMs,
		gcTime: 60_000,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		retry: (failureCount, error) => {
			if (isOutgoingJoinStillAwaiting(error)) return false;
			return failureCount < 2;
		},
	});
	const joinUrl = query.data?.join_url?.trim() || '';
	const awaitingAccept =
		query.data?.awaiting_accept === true ||
		(query.isError &&
			String((query.error as { detail?: string } | undefined)?.detail || '')
				.toLowerCase()
				.includes('awaiting_callee_accept'));
	const iframeJoinUrl =
		joinUrl ||
		(awaitingAccept ? undefined : initialJoinUrl?.trim() || undefined);
	const isGroupCall = query.data?.call_kind === 'group';
	const useNativeMeetStage =
		nativeDesktopShell && Boolean(iframeJoinUrl) && !awaitingAccept && !ended;
	const useOsMeetStage =
		empiierosMeetHost &&
		!nativeDesktopShell &&
		query.isSuccess &&
		Boolean(joinUrl) &&
		!awaitingAccept &&
		!ended;

	React.useEffect(() => {
		if (!normalizedCallId) return;
		const onAccepted = (dataUnknown: unknown) => {
			const data = dataUnknown as { call_id?: string } | undefined;
			if (data?.call_id?.trim() !== normalizedCallId) return;
			void queryClient.invalidateQueries({
				queryKey: ['video-call', normalizedCallId, 'join'],
			});
		};
		const socket = Services.socket;
		if (!socket) return;
		return socket.addEventListener('video_call.accepted', onAccepted);
	}, [normalizedCallId, queryClient]);

	React.useEffect(() => {
		if (!useNativeMeetStage || !iframeJoinUrl || !isCallLeader) {
			if (nativeDesktopShell && nativeMeetUrlRef.current) {
				nativeMeetUrlRef.current = null;
				setNativeMeetActive(false);
				void closeNativeMeetStage();
			}
			return;
		}
		let cancelled = false;
		const host = stageHostRef.current;
		const bounds = meetStageBoundsFromElement(host);
		if (!bounds) return;

		void (async () => {
			const result = await openNativeMeetStage(iframeJoinUrl, bounds);
			if (cancelled) return;
			if (result.ok) {
				nativeMeetUrlRef.current = iframeJoinUrl;
				setNativeMeetActive(true);
				setNativeMeetFailed(false);
			} else {
				nativeMeetUrlRef.current = null;
				setNativeMeetActive(false);
				setNativeMeetFailed(true);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [iframeJoinUrl, isCallLeader, nativeDesktopShell, useNativeMeetStage]);

	React.useEffect(() => {
		if (!nativeMeetActive || !useNativeMeetStage) return;
		const sync = () => {
			const bounds = meetStageBoundsFromElement(stageHostRef.current);
			if (!bounds) return;
			void setNativeMeetStageBounds(bounds);
		};
		sync();
		const host = stageHostRef.current;
		const ro =
			typeof ResizeObserver !== 'undefined' && host
				? new ResizeObserver(() => sync())
				: null;
		ro?.observe(host as Element);
		window.addEventListener('resize', sync);
		const timer = window.setInterval(sync, 500);
		return () => {
			ro?.disconnect();
			window.removeEventListener('resize', sync);
			window.clearInterval(timer);
		};
	}, [nativeMeetActive, useNativeMeetStage]);

	React.useEffect(() => {
		if (!useOsMeetStage || !joinUrl || !isCallLeader) {
			if (osMeetOpenedRef.current) {
				osMeetOpenedRef.current = false;
				void closeEmpiierosMeetStage();
			}
			return;
		}
		let cancelled = false;
		const bounds = meetStageBoundsFromElement(stageHostRef.current);
		if (!bounds) return;

		void (async () => {
			const result = await openEmpiierosMeetStage(joinUrl, bounds);
			if (cancelled) return;
			osMeetOpenedRef.current = result.ok === true;
		})();

		return () => {
			cancelled = true;
		};
	}, [isCallLeader, joinUrl, useOsMeetStage]);

	React.useEffect(() => {
		if (!useOsMeetStage) return;
		const sync = () => {
			const bounds = meetStageBoundsFromElement(stageHostRef.current);
			if (!bounds) return;
			void setEmpiierosMeetStageBounds(bounds);
		};
		sync();
		const host = stageHostRef.current;
		const ro =
			typeof ResizeObserver !== 'undefined' && host
				? new ResizeObserver(() => sync())
				: null;
		ro?.observe(host as Element);
		window.addEventListener('resize', sync);
		const timer = window.setInterval(sync, 500);
		return () => {
			ro?.disconnect();
			window.removeEventListener('resize', sync);
			window.clearInterval(timer);
		};
	}, [useOsMeetStage]);

	React.useEffect(() => {
		if (!normalizedCallId) return;
		cancelScheduledVideoCallEnd(normalizedCallId);
		return () => {
			if (endedRef.current) return;
			scheduleVideoCallEndOnRealUnmount(normalizedCallId);
		};
	}, [normalizedCallId]);

	React.useEffect(() => {
		return () => {
			if (nativeDesktopShell) {
				nativeMeetUrlRef.current = null;
				void closeNativeMeetStage();
			}
			if (osMeetOpenedRef.current) {
				osMeetOpenedRef.current = false;
				void closeEmpiierosMeetStage();
			}
		};
	}, [nativeDesktopShell]);

	React.useEffect(() => {
		if (!ended) return;
		if (nativeDesktopShell) {
			nativeMeetUrlRef.current = null;
			setNativeMeetActive(false);
			void closeNativeMeetStage();
		}
		if (osMeetOpenedRef.current) {
			osMeetOpenedRef.current = false;
			void closeEmpiierosMeetStage();
		}
	}, [ended, nativeDesktopShell]);

	const endMutation = useMutation({
		mutationFn: async () => {
			if (nativeDesktopShell) {
				nativeMeetUrlRef.current = null;
				setNativeMeetActive(false);
				void closeNativeMeetStage();
			}
			if (osMeetOpenedRef.current) {
				osMeetOpenedRef.current = false;
				void closeEmpiierosMeetStage();
			}
			if (!normalizedCallId) return { already_ended: true as const };
			return endVideoCall(normalizedCallId);
		},
		onSuccess: (data) => {
			const alreadyEnded = Boolean(data?.already_ended);
			markEndedAndClose({ toast: !alreadyEnded });
		},
		onError: () => toast.error(t('videoCallEndFailed')),
	});

	const inviteMutation = useMutation({
		mutationFn: (participantIds: string[]) => {
			if (!normalizedCallId) {
				return Promise.reject(new Error('missing call id'));
			}
			return inviteToVideoCall(normalizedCallId, {
				participant_user_ids: participantIds,
			});
		},
		onSuccess: (data) => {
			setInvitePickerOpen(false);
			const count = data.invited_user_ids?.length ?? 0;
			if (count > 0) {
				toast.success(t('videoCallInviteSentToast', { count }));
			} else {
				toast.message(t('videoCallInviteNoNewToast'));
			}
		},
		onError: () => toast.error(t('videoCallInviteFailed')),
	});

	React.useEffect(() => {
		if (!normalizedCallId) return;
		const onEnded = (event: Event) => {
			const detail = (event as CustomEvent<{ callId?: string }>).detail;
			if (detail?.callId !== normalizedCallId) return;
			markEndedAndClose({ toast: true });
		};
		window.addEventListener(VIDEO_CALL_ENDED_BROWSER_EVENT, onEnded);
		return () =>
			window.removeEventListener(VIDEO_CALL_ENDED_BROWSER_EVENT, onEnded);
	}, [markEndedAndClose, normalizedCallId]);

	React.useEffect(() => {
		if (!normalizedCallId || endedRef.current) return;
		const socket = Services.socket;
		if (!socket) return;
		const onSocketEnded = (dataUnknown: unknown) => {
			const data = dataUnknown as { call_id?: string } | undefined;
			if (data?.call_id?.trim() !== normalizedCallId) return;
			markEndedAndClose({ toast: true });
		};
		const unsubscribe = socket.addEventListener(
			'video_call.ended',
			onSocketEnded
		);
		return () => unsubscribe();
	}, [markEndedAndClose, normalizedCallId]);

	const endCallBecauseHostLost = React.useCallback(() => {
		if (endedRef.current || !normalizedCallId) return;
		if (nativeDesktopShell) {
			nativeMeetUrlRef.current = null;
			setNativeMeetActive(false);
			void closeNativeMeetStage();
		}
		if (osMeetOpenedRef.current) {
			osMeetOpenedRef.current = false;
			void closeEmpiierosMeetStage();
		}
		void endVideoCall(normalizedCallId)
			.then((data) => {
				markEndedAndClose({ toast: !data?.already_ended });
			})
			.catch(() => {
				markEndedAndClose({ toast: false });
			});
	}, [markEndedAndClose, nativeDesktopShell, normalizedCallId]);

	React.useEffect(() => {
		if (!normalizedCallId) return;
		const onLost = (event: Event) => {
			if (!meetStageLostCode(event)) return;
			endCallBecauseHostLost();
		};
		const onPageHide = () => {
			if (endedRef.current) return;
			endVideoCallKeepalive(normalizedCallId);
		};
		window.addEventListener(EMPIIEROS_MEET_STAGE_LOST_EVENT, onLost);
		window.addEventListener('pagehide', onPageHide);
		return () => {
			window.removeEventListener(EMPIIEROS_MEET_STAGE_LOST_EVENT, onLost);
			window.removeEventListener('pagehide', onPageHide);
		};
	}, [endCallBecauseHostLost, normalizedCallId]);

	const handleEnd = React.useCallback(() => {
		if (endedRef.current) {
			if (normalizedCallId) closeVideoCallWindow(normalizedCallId);
			return;
		}
		void endMutation.mutateAsync();
	}, [endMutation, normalizedCallId]);

	if (!normalizedCallId && !initialJoinUrl) {
		return (
			<DesktopAppEmptyState
				icon={<VideoCameraIcon className="h-8 w-8" aria-hidden />}
				title={t('videoCallMissingTitle')}
				description={t('videoCallMissingDescription')}
				className="h-full bg-(--desktop-surface-app)"
			/>
		);
	}

	return (
		<div
			id={VIDEO_CALL_GUIDE_ROOT_ID}
			className="relative flex h-full min-h-0 flex-col overflow-hidden bg-(--desktop-surface-app) text-(--desktop-text-primary)"
		>
			<DesktopAppToolbar
				data-vc-guide="toolbar"
				className="relative flex min-w-0 items-center justify-between gap-3 border-b border-(--desktop-border-subtle) px-3 py-2"
			>
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)]">
						<VideoCameraIcon
							className="h-[18px] w-[18px] text-[rgb(var(--desktop-accent-rgb))]"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</span>
					<div className="min-w-0">
						<div
							className={cn(
								'truncate font-semibold text-(--desktop-text-primary)',
								DESKTOP_TYPOGRAPHY.shellCopy15
							)}
						>
							{title?.trim() || t('videoCallAppTitle')}
						</div>
						<div
							className={cn(
								'truncate text-(--desktop-text-secondary)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('videoCallAppSubtitle')}
						</div>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{isGroupCall ? (
						<DesktopChromeTooltip
							content={t('videoCallInviteParticipants')}
							placement="bottom"
							offsetExtra={6}
						>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => setInvitePickerOpen(true)}
								disabled={!normalizedCallId || endMutation.isPending || ended}
								className="shrink-0"
							>
								<UserPlusIcon className="h-4 w-4" aria-hidden />
								<span>{t('videoCallInviteParticipants')}</span>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					) : null}
					<DesktopChromeTooltip
						content={t('videoCallEnd')}
						placement="bottom"
						offsetExtra={6}
					>
						<DesktopAppButton
							type="button"
							variant="danger"
							size="sm"
							onClick={handleEnd}
							disabled={!normalizedCallId || endMutation.isPending || ended}
							className="shrink-0"
						>
							<PhoneXMarkIcon className="h-4 w-4" aria-hidden />
							<span>{t('videoCallEnd')}</span>
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			</DesktopAppToolbar>

			<div
				ref={stageHostRef}
				data-vc-guide="call-stage"
				data-desktop-iframe-host=""
				className="relative min-h-0 flex-1 bg-black"
			>
				{!isCallLeader ? (
					<DesktopAppEmptyState
						icon={<VideoCameraIcon className="h-8 w-8" aria-hidden />}
						title={t('videoCallActiveElsewhereTitle')}
						description={t('videoCallActiveElsewhereDescription')}
						className="h-full bg-(--desktop-surface-app)"
					/>
				) : query.isLoading ? (
					<div className="flex h-full items-center justify-center text-(--desktop-text-secondary)">
						<ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" aria-hidden />
						<span>{t('videoCallConnecting')}</span>
					</div>
				) : ended ? (
					<DesktopAppEmptyState
						icon={<PhoneXMarkIcon className="h-8 w-8" aria-hidden />}
						title={t('videoCallEndedTitle')}
						description={t('videoCallEndedDescription')}
						className="h-full bg-(--desktop-surface-app)"
					/>
				) : awaitingAccept ? (
					<DesktopAppEmptyState
						icon={<VideoCameraIcon className="h-8 w-8" aria-hidden />}
						title={t('videoCallAwaitingAcceptTitle')}
						description={t('videoCallAwaitingAcceptDescription')}
						className="h-full bg-(--desktop-surface-app)"
					/>
				) : query.isError || query.isPending || !iframeJoinUrl ? (
					<DesktopAppEmptyState
						icon={<VideoCameraIcon className="h-8 w-8" aria-hidden />}
						title={t('videoCallJoinFailedTitle')}
						description={t('videoCallJoinFailedDescription')}
						className="h-full bg-(--desktop-surface-app)"
					/>
				) : nativeDesktopShell ? (
					<>
						<DesktopAppEmptyState
							icon={<VideoCameraIcon className="h-8 w-8" aria-hidden />}
							title={
								nativeMeetFailed
									? t('videoCallNativeMeetFailedTitle')
									: t('videoCallNativeMeetActiveTitle')
							}
							description={
								nativeMeetFailed
									? t('videoCallNativeMeetFailedDescription')
									: t('videoCallNativeMeetActiveDescription')
							}
							className="h-full bg-(--desktop-surface-app)"
						/>
						<DesktopChromeTooltip
							content={t('videoCallEnd')}
							placement="top"
							offsetExtra={8}
						>
							<DesktopAppButton
								type="button"
								variant="danger"
								size="sm"
								onClick={handleEnd}
								disabled={!normalizedCallId || endMutation.isPending || ended}
								className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 min-h-11 rounded-full px-4 shadow-2xl shadow-red-950/40"
								aria-label={t('videoCallEndMobileAria')}
							>
								<PhoneXMarkIcon className="h-5 w-5" aria-hidden />
								<span>{t('videoCallEnd')}</span>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</>
				) : empiierosMeetHost ? (
					<DesktopChromeTooltip
						content={t('videoCallEnd')}
						placement="top"
						offsetExtra={8}
					>
						<DesktopAppButton
							type="button"
							variant="danger"
							size="sm"
							onClick={handleEnd}
							disabled={!normalizedCallId || endMutation.isPending || ended}
							className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 min-h-11 rounded-full px-4 shadow-2xl shadow-red-950/40"
							aria-label={t('videoCallEndMobileAria')}
						>
							<PhoneXMarkIcon className="h-5 w-5" aria-hidden />
							<span>{t('videoCallEnd')}</span>
						</DesktopAppButton>
					</DesktopChromeTooltip>
				) : (
					<>
						<iframe
							key={normalizedCallId}
							src={iframeJoinUrl}
							title={t('videoCallIframeTitle')}
							allow={JITSI_IFRAME_ALLOW}
							allowFullScreen
							className="h-full w-full border-0"
						/>
						<DesktopChromeTooltip
							content={t('videoCallEnd')}
							placement="top"
							offsetExtra={8}
						>
							<DesktopAppButton
								type="button"
								variant="danger"
								size="sm"
								onClick={handleEnd}
								disabled={!normalizedCallId || endMutation.isPending || ended}
								className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 min-h-11 rounded-full px-4 shadow-2xl shadow-red-950/40"
								aria-label={t('videoCallEndMobileAria')}
							>
								<PhoneXMarkIcon className="h-5 w-5" aria-hidden />
								<span>{t('videoCallEnd')}</span>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</>
				)}
			</div>
			<div
				className={`${DESKTOP_APP_STYLE_CONTRACT.counterBadge} m-2 self-start bg-[rgb(var(--desktop-accent-rgb)/0.16)] text-(--desktop-text-secondary)`}
			>
				{t('videoCallInternalOnly')}
			</div>
			<VideoCallParticipantPickerModal
				open={invitePickerOpen}
				onClose={() => setInvitePickerOpen(false)}
				onConfirm={(participantIds) => inviteMutation.mutate(participantIds)}
				title={t('videoCallInvitePickerTitle')}
				description={t('videoCallInvitePickerDescription')}
				confirmLabel={t('videoCallInvitePickerConfirm')}
				submitting={inviteMutation.isPending}
				minSelectable={1}
			/>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={VIDEO_CALL_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={VIDEO_CALL_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={VIDEO_CALL_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				dialogTitleId="video-call-guide-title"
			/>
		</div>
	);
}
