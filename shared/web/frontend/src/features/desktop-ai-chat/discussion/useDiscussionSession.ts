/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion session controller: load, live SSE, lifecycle actions.
 *
 * Invariants:
 * - After user interjection session stays paused until explicit continue.
 * - Document generation is opt-in, except interview-handoff sessions which auto-document on finish.
 * - queued/running live via authenticated GET …/events; interval poll only on SSE degrade.
 * - Unexpected SSE EOF is degrade (backoff + poll), not a healthy 250ms reconnect.
 * - In-flight GET refresh must not apply after chat or session identity changes.
 * - discussion_version_conflict rehydrates session from GET before the next action.
 * - completed/cancelled must not keep blocking normal /stream sends.
 *
 * Related:
 * - discussion/api.ts
 * - discussionLiveTransport.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import * as React from 'react';
import {
	cancelDiscussion,
	continueDiscussion,
	discussionEventsUrl,
	fetchDiscussionParticipantProfile,
	finishDiscussion,
	generateDiscussionDocument,
	getDiscussion,
	listDiscussionPresets,
	postDiscussionInterjection,
	raiseDiscussionHand,
	startDiscussion,
} from './api';
import { latestDiscussionSessionIdFromMessages } from './discussionAnchors';
import {
	DISCUSSION_LIVE_POLL_INTERVAL_MS,
	discussionAllowsIntervalPoll,
	discussionLiveMode,
	type DiscussionLiveMode,
} from './discussionLiveTransport';
import {
	consumeDiscussionEventStream,
	discussionSseEventRequiresRefresh,
} from './discussionSse';
import { DISCUSSION_FALLBACK_PRESETS } from './presets';
import type {
	DiscussionIntensity,
	DiscussionPreset,
	DiscussionSession,
	DiscussionStatus,
} from './types';
import { discussionControlVisibility } from './discussionControls';
import type { DesktopAiMessage } from '../api/desktopChatClient';

const LIVE_DISCUSSION_STATUSES = new Set<DiscussionStatus>([
	'queued',
	'running',
	'paused_user',
	'paused_checkpoint',
	'paused_goal',
	'paused_error',
]);

const TERMINAL_DISCUSSION_STATUSES = new Set<DiscussionStatus>([
	'completed',
	'cancelled',
]);

function shouldKeepLiveSession(
	prev: DiscussionSession | null,
	next: DiscussionSession
): boolean {
	if (!prev || prev.id === next.id) return false;
	if (!LIVE_DISCUSSION_STATUSES.has(prev.status)) return false;
	return TERMINAL_DISCUSSION_STATUSES.has(next.status);
}

export function useDiscussionSession(
	chatId: string | null,
	messages: readonly DesktopAiMessage[] = []
) {
	const [session, setSession] = React.useState<DiscussionSession | null>(null);
	const [presets, setPresets] = React.useState<DiscussionPreset[]>(
		DISCUSSION_FALLBACK_PRESETS
	);
	const [participantDisplayName, setParticipantDisplayName] =
		React.useState('');
	const [preferredRoleTitle, setPreferredRoleTitle] =
		React.useState('инкогнито');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [sseHealthy, setSseHealthy] = React.useState(true);
	const [scopedChatId, setScopedChatId] = React.useState(chatId);
	if (chatId !== scopedChatId) {
		setScopedChatId(chatId);
		setSession(null);
		setError(null);
		setSseHealthy(true);
	}
	const lastEventIdRef = React.useRef('0-0');
	const chatIdRef = React.useRef(chatId);
	chatIdRef.current = chatId;
	const sessionIdRef = React.useRef<string | null>(session?.id ?? null);
	sessionIdRef.current = session?.id ?? null;

	const liveMode: DiscussionLiveMode = discussionLiveMode(
		session?.status,
		sseHealthy
	);

	const anchorSessionId = React.useMemo(
		() => latestDiscussionSessionIdFromMessages(messages),
		[messages]
	);

	React.useEffect(() => {
		if (!chatId || !anchorSessionId) return;
		let cancelled = false;
		void getDiscussion(chatId, anchorSessionId)
			.then((next) => {
				if (cancelled || chatIdRef.current !== chatId) return;
				setSession((prev) => (shouldKeepLiveSession(prev, next) ? prev : next));
			})
			.catch(() => {
				/* cancelled / finished session — leave bubble closed */
			});
		return () => {
			cancelled = true;
		};
	}, [chatId, anchorSessionId]);

	React.useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const items = await listDiscussionPresets();
				if (!cancelled && items.length > 0) setPresets(items);
			} catch {
				/* fallback presets remain */
			}
			try {
				const profile = await fetchDiscussionParticipantProfile();
				if (cancelled) return;
				setParticipantDisplayName(profile.display_name || '');
				setPreferredRoleTitle(
					profile.role_title || profile.default_role_title || 'инкогнито'
				);
			} catch {
				/* keep defaults */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const refresh = React.useCallback(
		async (sessionId: string) => {
			const requestChatId = chatId;
			if (!requestChatId) return null;
			const next = await getDiscussion(requestChatId, sessionId);
			if (chatIdRef.current !== requestChatId) return null;
			if (sessionIdRef.current != null && sessionIdRef.current !== sessionId) {
				return null;
			}
			setSession(next);
			return next;
		},
		[chatId]
	);

	React.useEffect(() => {
		if (!chatId || !session?.id) return;
		if (session.status !== 'running' && session.status !== 'queued') return;
		const sessionId = session.id;
		lastEventIdRef.current = '0-0';
		setSseHealthy(true);
		let cancelled = false;
		const abort = new AbortController();
		let attempt = 0;

		const wait = (ms: number) => {
			if (abort.signal.aborted) return Promise.resolve();
			return new Promise<void>((resolve) => {
				let timerId: number | null = null;
				const settle = () => {
					if (timerId !== null) window.clearTimeout(timerId);
					abort.signal.removeEventListener('abort', settle);
					resolve();
				};
				timerId = window.setTimeout(settle, ms);
				abort.signal.addEventListener('abort', settle, { once: true });
			});
		};

		const isAbortLike = (err: unknown) => {
			if (abort.signal.aborted || cancelled) return true;
			if (err instanceof DOMException && err.name === 'AbortError') {
				return true;
			}
			return err instanceof Error && err.name === 'AbortError';
		};

		const connect = async () => {
			while (!cancelled && !abort.signal.aborted) {
				try {
					await consumeDiscussionEventStream({
						url: discussionEventsUrl(chatId, sessionId, lastEventIdRef.current),
						signal: abort.signal,
						onOpen: () => {
							attempt = 0;
							setSseHealthy(true);
							// PG is SoT — hydrate immediately in case Redis field decode
							// or a missed XADD left the SPA on a stale queued snapshot.
							void refresh(sessionId).catch(() => undefined);
						},
						onFrame: (frame) => {
							if (frame.id) lastEventIdRef.current = frame.id;
							if (!discussionSseEventRequiresRefresh(frame.event)) {
								return;
							}
							void refresh(sessionId).catch(() => undefined);
						},
					});
					if (cancelled || abort.signal.aborted) break;
					attempt += 1;
					setSseHealthy(false);
					const delayMs = Math.min(15_000, 1_500 * 2 ** Math.min(attempt, 4));
					await wait(delayMs);
				} catch (err) {
					if (isAbortLike(err)) break;
					attempt += 1;
					setSseHealthy(false);
					const delayMs = Math.min(15_000, 1_500 * 2 ** Math.min(attempt, 4));
					await wait(delayMs);
				}
			}
		};

		void connect();
		return () => {
			cancelled = true;
			abort.abort();
		};
	}, [chatId, session?.id, session?.status, refresh]);

	React.useEffect(() => {
		if (!chatId || !session?.id) return;
		if (!discussionAllowsIntervalPoll(liveMode)) return;
		const sessionId = session.id;
		const timer = window.setInterval(() => {
			void refresh(sessionId).catch(() => undefined);
		}, DISCUSSION_LIVE_POLL_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [chatId, session?.id, liveMode, refresh]);

	const run = React.useCallback(
		async <T>(fn: () => Promise<T>): Promise<T | null> => {
			setBusy(true);
			setError(null);
			try {
				return await fn();
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'discussion_action_failed';
				const codeMatch = message.match(
					/\b(discussion_already_active_for_account|discussion_already_active|discussion_version_conflict)\b/
				);
				const code = codeMatch?.[1] ?? null;
				setError(code ?? message);
				// Stale expected_version after another participant finish/continue —
				// rehydrate PG SoT so the next send is not stuck on interjections.
				if (
					code === 'discussion_version_conflict' &&
					chatIdRef.current &&
					sessionIdRef.current
				) {
					try {
						const next = await getDiscussion(
							chatIdRef.current,
							sessionIdRef.current
						);
						if (chatIdRef.current && sessionIdRef.current === next.id) {
							setSession(next);
						}
					} catch {
						/* keep prior session; user can retry after reload */
					}
				}
				return null;
			} finally {
				setBusy(false);
			}
		},
		[]
	);

	const start = React.useCallback(
		async (input: {
			preset_id: string;
			topic: string;
			goal?: string;
			roster: string[];
			intensity?: DiscussionIntensity;
			role_title?: string;
			source_message_id?: string;
		}) => {
			if (!chatId) return null;
			const next = await run(() => startDiscussion(chatId, input));
			if (next) {
				setSession(next);
				if (next.participant_role_title) {
					setPreferredRoleTitle(next.participant_role_title);
				}
				if (next.participant_display_name) {
					setParticipantDisplayName(next.participant_display_name);
				}
			}
			return next;
		},
		[chatId, run]
	);

	const raiseHand = React.useCallback(async () => {
		if (!chatId || !session) return null;
		const next = await run(() =>
			raiseDiscussionHand(chatId, session.id, session.version)
		);
		if (next) setSession(next);
		return next;
	}, [chatId, session, run]);

	const interject = React.useCallback(
		async (content: string) => {
			if (!chatId || !session) return null;
			const result = await run(() =>
				postDiscussionInterjection(chatId, session.id, {
					content,
					expected_version: session.version,
				})
			);
			if (result?.session) setSession(result.session);
			return result;
		},
		[chatId, session, run]
	);

	const cont = React.useCallback(async () => {
		if (!chatId || !session) return null;
		const next = await run(() =>
			continueDiscussion(chatId, session.id, session.version)
		);
		if (next) setSession(next);
		return next;
	}, [chatId, session, run]);

	const finish = React.useCallback(async () => {
		if (!chatId || !session) return null;
		const next = await run(() =>
			finishDiscussion(chatId, session.id, session.version)
		);
		if (next) setSession(next);
		return next;
	}, [chatId, session, run]);

	const cancel = React.useCallback(async () => {
		if (!chatId || !session) return null;
		const next = await run(() =>
			cancelDiscussion(chatId, session.id, session.version)
		);
		if (next) setSession(next);
		return next;
	}, [chatId, session, run]);

	const generateDocument = React.useCallback(
		async (force = false) => {
			if (!chatId || !session) return null;
			const next = await run(() =>
				generateDiscussionDocument(chatId, session.id, session.version, force)
			);
			if (next) setSession(next);
			return next;
		},
		[chatId, session, run]
	);

	const bindSession = React.useCallback((next: DiscussionSession | null) => {
		setSession(next);
	}, []);

	const controls = discussionControlVisibility(session?.status);

	return {
		session,
		presets,
		participantDisplayName,
		preferredRoleTitle,
		busy,
		error,
		liveMode,
		controls,
		bindSession,
		refresh,
		start,
		raiseHand,
		interject,
		continueDiscussion: cont,
		finish,
		cancel,
		generateDocument,
	};
}
