/**
 * Desktop-level GAF Chat process: Empery World socket, React Query invalidation, and incoming-message UX.
 *
 * **Imports:** `gafChatQueryKeys` from `../components/GAFChat/api/gafChatApi`;
 * `gafChatMeQueryOptions` from `gafChatQueryOptions` (staleTime aligned with shell-bootstrap seed).
 * `gafChatApi` does not import this provider or Desktop context — no circular dependency.
 *
 * **Socket:** On authenticated Desktop, **one leader tab** holds `Services.socket` (see
 * `utils/desktopRealtimeLeader.ts`); follower tabs receive GAF events via BroadcastChannel relay.
 * Connection state is exposed via `socketConnectionStore` (leader only) and `isDesktopRealtimeLeader` in context.
 *
 * **Query cache:** Debounced invalidation of `gafChatQueryKeys.chats` plus per-chat
 * `gafChatQueryKeys.messages(id)` invalidation for pending chats. Debounce uses exponential
 * backoff while events keep arriving before a flush (storm damping).
 * First socket `connection-restored` (`initial: true`) does **not** invalidate chats —
 * shell-bootstrap already seeded the list (see `gafChatConnectionRestorePolicy`).
 * On logout, `removeQueries({ queryKey: gafChatQueryKeys.all })`.
 *
 * **Multi-tab:** Leader relays socket events on `eliteew-desktop-realtime-v1` BC; notification
 * dedupe keys still shared on `eliteew-gaf-chat-notify-v1`.
 *
 * **Incoming messages (non-self, unmuted):** Short beep when `notifications.gaf.incoming_message.in_app`
 * (respects tab visibility deferral, GAF sound toggle + desktop notification sound/DND via `gafChatUiSounds`), optional notification
 * center + Sonner, optional OS notification when `browser` is on and the tab is not visible — см. профиль.
 * Event-level dedupe uses `NOTIFY_DEDUPE_MS` and a bounded key map (`message_id` or content hash).
 * **Foreground toasts:** When `document.visibilityState === 'visible'`, Sonner uses a stable `id` per `chatId`
 * so rapid messages in the same chat update one toast instead of stacking. When hidden, `id` is tied to the
 * dedupe key so replays still collapse.
 *
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin composer for desktop GAF Chat background process (Cause B Wave 4 atomization).
 *
 * Invariants:
 * - Named exports GAFChatProvider and useGAFChatProcess remain on this path.
 * - Effect order: leader store → perf bind → sound hydrate → mute → notify BC → relay BC → logout → video → disconnect → connect → listeners.
 *
 * Related:
 * - context/gafChatProviderTypes.ts, gafChatIncomingMute.ts, gafChatIncomingNotifications.ts
 * - context/useGafDesktopVideoCallProcess.ts, useDesktopSocketLeader.ts, useGafChatSocketEventHandlers.ts
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserTabLeader } from '@/contexts/BrowserTabLeaderProvider';
import {
	setSocketConnectionConnected,
	setSocketConnectionLeader,
	resetSocketConnectionStore,
} from '@/services/communication/socketConnectionStore';
import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import {
	bindDesktopRealtimePerfQueryClient,
	ensureDesktopRealtimePerfConsoleInstalled,
} from '@/services/communication/desktopRealtimePerfTelemetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { gafChatQueryKeys } from '../components/GAFChat/api/gafChatApi';
import { gafChatMeQueryOptions } from '../components/GAFChat/gafChatQueryOptions';
import { fetchDesktopShellStateDeduplicated } from '../services/desktopApi';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
} from '../utils/desktopShellStateMutationPipeline';
import {
	GAF_CHAT_SOUND_ANON_STORAGE_KEY,
	setGafChatSoundEnabledCached,
} from '../utils/gafChatShellSound';
import { closeGafChatUiSoundsAudioContext } from '../utils/gafChatUiSounds';
import { useDesktopBackgroundRuntimeController } from '../runtime/DesktopBackgroundRuntimeContext';
import { useGafIncomingMuteCheck } from './gafChatIncomingMute';
import {
	DEFAULT_GAF_NOTIFICATION_PREFERENCES,
	resolveGafIncomingBlock,
	useGafIncomingMessageNotifications,
} from './gafChatIncomingNotifications';
import {
	defaultGafChatContextValue,
	GAFChatContext,
	type GAFChatContextValue,
} from './gafChatProviderTypes';
import {
	useDesktopSocketLeaderConnect,
	useDesktopSocketLeaderDisconnectEffects,
} from './useDesktopSocketLeader';
import { useGafDesktopVideoCallProcess } from './useGafDesktopVideoCallProcess';
import {
	useGafChatRealtimeRelayChannel,
	useGafChatSocketEventHandlers,
} from './useGafChatSocketEventHandlers';

export function useGAFChatProcess(): GAFChatContextValue {
	const ctx = useContext(GAFChatContext);
	return ctx ?? defaultGafChatContextValue;
}

interface GAFChatProviderProps {
	children: ReactNode;
}

export function GAFChatProvider({ children }: GAFChatProviderProps) {
	const { t } = useTranslation('gafChat');
	const tRef = useRef(t);
	tRef.current = t;

	const { user } = useAuth();
	const { isLeader, isSocketOwner } = useBrowserTabLeader();
	const runtimeController = useDesktopBackgroundRuntimeController();
	const prefsApp = useUserPreferencesApp();
	const gafIncomingBlock = resolveGafIncomingBlock({
		...DEFAULT_GAF_NOTIFICATION_PREFERENCES.incoming_message,
		...prefsApp?.preferences?.notifications?.gaf?.incoming_message,
	});

	const userId = user?.id;
	const socketDisplayName = useMemo(
		() => user?.profile?.display_name || user?.email || user?.username || '',
		[user?.profile?.display_name, user?.email, user?.username]
	);
	const isDesktopRealtimeLeader = isLeader;

	useEffect(() => {
		setSocketConnectionLeader(isSocketOwner);
		if (!isSocketOwner) {
			setSocketConnectionConnected(false);
		}
		return () => {
			resetSocketConnectionStore();
		};
	}, [isSocketOwner]);

	const queryClient = useQueryClient();
	const queryClientRef = useRef(queryClient);
	queryClientRef.current = queryClient;

	useEffect(() => {
		ensureDesktopRealtimePerfConsoleInstalled();
		return bindDesktopRealtimePerfQueryClient(queryClient);
	}, [queryClient]);

	const { data: me } = useQuery({
		...gafChatMeQueryOptions(),
		enabled: !!user,
	});
	const gafUserId = me?.user_id ?? null;
	const gafUserIdRef = useRef<string | null>(null);
	gafUserIdRef.current = gafUserId;

	const prevUserRef = useRef(user);

	useEffect(() => {
		if (!gafUserId) return;
		try {
			const raw = window.localStorage.getItem(
				`gaf_chat_sound_enabled::${gafUserId}`
			);
			if (raw === '0') setGafChatSoundEnabledCached(false);
			else if (raw === '1') setGafChatSoundEnabledCached(true);
		} catch {
			/* ignore */
		}
		let cancelled = false;
		void (async () => {
			try {
				const s = await fetchDesktopShellStateDeduplicated();
				if (cancelled) return;
				if (typeof s.gaf_chat_sound_enabled === 'boolean') {
					setGafChatSoundEnabledCached(s.gaf_chat_sound_enabled);
				} else {
					try {
						const r = window.localStorage.getItem(
							`gaf_chat_sound_enabled::${gafUserId}`
						);
						let leg: boolean | null = null;
						if (r === '0') leg = false;
						else if (r === '1') leg = true;
						if (leg !== null) {
							setGafChatSoundEnabledCached(leg);
							scheduleShellStateMutation({
								source: 'chrome',
								merge: () => ({ gaf_chat_sound_enabled: leg }),
							});
							await flushShellStatePipelineNow('chrome').catch(() => {});
						}
					} catch {
						/* ignore */
					}
				}
				try {
					window.localStorage.removeItem(
						`gaf_chat_sound_enabled::${gafUserId}`
					);
					window.localStorage.removeItem(GAF_CHAT_SOUND_ANON_STORAGE_KEY);
				} catch {
					/* ignore */
				}
			} catch {
				try {
					const r = window.localStorage.getItem(
						`gaf_chat_sound_enabled::${gafUserId}`
					);
					if (r === '0') setGafChatSoundEnabledCached(false);
					else if (r === '1') setGafChatSoundEnabledCached(true);
				} catch {
					/* ignore */
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [gafUserId]);

	const { isMutedIncomingChatRef } = useGafIncomingMuteCheck(queryClient);

	const {
		gafIncomingBlockRef,
		recentNotifyKeysRef,
		notifyBcRef,
		scheduleIncomingSoundRef,
		pushIncomingMessageNotification,
		clearIncomingNotificationState,
	} = useGafIncomingMessageNotifications({
		userId,
		gafUserId,
		gafIncomingBlock,
	});

	const relayBcRef = useGafChatRealtimeRelayChannel(userId);

	const {
		stopVideoCallRing,
		stopOutgoingJoinPoll,
		startVideoCallRing,
		openMeetAfterOutgoingAccepted,
		localOutgoingVideoCallIdsRef,
		clearVideoCallStateOnLogout,
	} = useGafDesktopVideoCallProcess({ gafIncomingBlockRef });

	useEffect(() => {
		const prev = prevUserRef.current;
		prevUserRef.current = user;
		if (!prev || user) return;
		clearIncomingNotificationState();
		clearVideoCallStateOnLogout();
		closeGafChatUiSoundsAudioContext();
		queryClient.removeQueries({ queryKey: gafChatQueryKeys.all });
	}, [
		user,
		queryClient,
		clearIncomingNotificationState,
		clearVideoCallStateOnLogout,
	]);

	useDesktopSocketLeaderDisconnectEffects({ userId, isSocketOwner });
	useDesktopSocketLeaderConnect({ userId, isSocketOwner, socketDisplayName });

	useGafChatSocketEventHandlers({
		userId,
		isDesktopRealtimeLeader,
		relayBcRef,
		queryClientRef,
		gafUserIdRef,
		isMutedIncomingChatRef,
		scheduleIncomingSoundRef,
		gafIncomingBlockRef,
		recentNotifyKeysRef,
		notifyBcRef,
		pushIncomingMessageNotification,
		stopVideoCallRing,
		stopOutgoingJoinPoll,
		startVideoCallRing,
		openMeetAfterOutgoingAccepted,
		localOutgoingVideoCallIdsRef,
		runtimeController,
		tRef,
	});

	const value = useMemo<GAFChatContextValue>(
		() => ({
			isDesktopRealtimeLeader,
		}),
		[isDesktopRealtimeLeader]
	);

	return (
		<GAFChatContext.Provider value={value}>{children}</GAFChatContext.Provider>
	);
}
