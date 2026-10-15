/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Messages pane state for Desktop AI Chat: short tail load, older pages before the window,
 * scroll stick/restore, context footnotes, delete-from-here.
 *
 * Invariants:
 * - Initial load uses DESKTOP_AI_MESSAGES_TAIL (6); older pages use DESKTOP_AI_MESSAGES_OLDER_PAGE.
 * - Stream tail merge preserves older prefix when server returns truncated tail.
 * - Prepend older keeps scroll anchor (no jump to bottom).
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts, components/DesktopAiChatMessagesPane.tsx
 * - desktopChatMessagesMerge.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	deleteDesktopAiMessagesFromUserMessage,
	listDesktopAiChats,
	listDesktopAiMessages,
	type DesktopAiChatItem,
	type DesktopAiMessage,
	type ListDesktopAiMessagesResult,
} from '../api/desktopChatClient';
import { buildMessageListWithDays } from '../buildMessageListWithDays';
import {
	buildDesktopAiContextFootnote,
	type DesktopAiContextFootnote as DesktopAiContextFootnoteData,
} from '../desktopChatContextSummary';
import {
	countPersistedDesktopAiMessages,
	DESKTOP_AI_MESSAGES_OLDER_PAGE,
	DESKTOP_AI_MESSAGES_TAIL,
	mergeServerTailWithOlderPrefix,
	nextOlderMessagesQuery,
	prependOlderSlice,
} from '../desktopChatMessagesMerge';
import {
	resolveMessageWebSearchSources,
	type DesktopAiWebSearchSource,
} from '../desktopWebSearchSources';
import { formatDayDividerLabel } from '../utils/desktopAiChatFormatters';
import type { DesktopAiChatLoadState } from '../desktopAiChatSurfaceState';
import { DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID } from '../desktopAiChatDomIds';

const SCROLL_STICKY_PX = 80;

export type UseDesktopAiChatMessagesParams = {
	activeId: string | null;
	setChats: React.Dispatch<React.SetStateAction<DesktopAiChatItem[]>>;
	sending: boolean;
	i18nLanguage: string;
	t: TFunction<'desktopAiChat'>;
};

export function useDesktopAiChatMessages({
	activeId,
	setChats,
	sending,
	i18nLanguage,
	t,
}: UseDesktopAiChatMessagesParams) {
	const [messages, setMessages] = React.useState<DesktopAiMessage[]>([]);
	const [messagesTotal, setMessagesTotal] = React.useState<number | null>(null);
	const [messagesLoadingOlder, setMessagesLoadingOlder] = React.useState(false);
	const [messagesLoadState, setMessagesLoadState] =
		React.useState<DesktopAiChatLoadState>('idle');
	const [assistantContextByMessageId, setAssistantContextByMessageId] =
		React.useState<Record<string, DesktopAiContextFootnoteData>>({});
	const [webSearchSourcesByMessageId, setWebSearchSourcesByMessageId] =
		React.useState<Record<string, DesktopAiWebSearchSource[]>>({});
	const [userMessageDeleteTarget, setUserMessageDeleteTarget] =
		React.useState<DesktopAiMessage | null>(null);
	const [userMessageDeleteLoading, setUserMessageDeleteLoading] =
		React.useState(false);
	const [showScrollDown, setShowScrollDown] = React.useState(false);
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const stickToBottomRef = React.useRef(true);
	const pendingScrollRestoreRef = React.useRef<{
		height: number;
		top: number;
	} | null>(null);

	const messageListEntries = React.useMemo(
		() =>
			buildMessageListWithDays(messages, (iso) =>
				formatDayDividerLabel(iso, i18nLanguage, t)
			),
		[messages, i18nLanguage, t]
	);

	const pendingUserMessageDeleteCount = React.useMemo(() => {
		if (!userMessageDeleteTarget) {
			return 0;
		}
		const idx = messages.findIndex((x) => x.id === userMessageDeleteTarget.id);
		if (idx < 0) {
			return 0;
		}
		return messages.length - idx;
	}, [userMessageDeleteTarget, messages]);

	const persistedLoaded = React.useMemo(
		() => countPersistedDesktopAiMessages(messages),
		[messages]
	);

	const showLoadOlderMessages =
		messagesTotal != null && persistedLoaded < messagesTotal;

	const applyTailReplace = React.useCallback(
		(res: ListDesktopAiMessagesResult) => {
			setMessages(res.items);
			setMessagesTotal(res.total);
		},
		[]
	);

	const applyTailMergeAfterStream = React.useCallback(
		(res: ListDesktopAiMessagesResult) => {
			setMessages((prev) => mergeServerTailWithOlderPrefix(prev, res));
			setMessagesTotal(res.total);
		},
		[]
	);

	const handleLoadOlderMessages = React.useCallback(async () => {
		if (!activeId || messagesLoadingOlder || messagesTotal == null) {
			return;
		}
		const query = nextOlderMessagesQuery(
			messagesTotal,
			countPersistedDesktopAiMessages(messages),
			DESKTOP_AI_MESSAGES_OLDER_PAGE
		);
		if (!query) {
			return;
		}
		const el = scrollRef.current;
		if (el) {
			pendingScrollRestoreRef.current = {
				height: el.scrollHeight,
				top: el.scrollTop,
			};
		}
		setMessagesLoadingOlder(true);
		try {
			const res = await listDesktopAiMessages(activeId, {
				offset: query.offset,
				limit: query.limit,
			});
			setMessages((prev) => prependOlderSlice(prev, res.items));
			setMessagesTotal(res.total);
		} catch {
			pendingScrollRestoreRef.current = null;
			toast.error(t('messagesLoadError'));
		} finally {
			setMessagesLoadingOlder(false);
		}
	}, [activeId, messagesLoadingOlder, messagesTotal, messages, t]);

	const messagesLoading = messagesLoadState === 'loading';

	const loadMessagesForActiveChat = React.useCallback(async () => {
		if (!activeId) {
			return;
		}
		setMessagesLoadState('loading');
		try {
			const res = await listDesktopAiMessages(activeId, {
				tail: DESKTOP_AI_MESSAGES_TAIL,
			});
			applyTailReplace(res);
			setMessagesLoadState('ready');
		} catch {
			toast.error(t('messagesLoadError'));
			setMessagesLoadState('error');
		}
	}, [activeId, t, applyTailReplace]);

	const retryLoadMessages = React.useCallback(() => {
		void loadMessagesForActiveChat();
	}, [loadMessagesForActiveChat]);

	const truncateUserMessageConfirmed = React.useCallback(async () => {
		if (!activeId || !userMessageDeleteTarget) {
			return;
		}
		setUserMessageDeleteLoading(true);
		try {
			const { deleted_count } = await deleteDesktopAiMessagesFromUserMessage(
				activeId,
				userMessageDeleteTarget.id
			);
			toast.success(t('messagesDeletedToast', { count: deleted_count }));
			setUserMessageDeleteTarget(null);
			const res = await listDesktopAiMessages(activeId, {
				tail: DESKTOP_AI_MESSAGES_TAIL,
			});
			applyTailReplace(res);
			setMessagesLoadState('ready');
			try {
				const items = await listDesktopAiChats();
				setChats(items);
			} catch {
				/* список чатов вторичен */
			}
		} catch {
			toast.error(t('messagesDeleteError'));
		} finally {
			setUserMessageDeleteLoading(false);
		}
	}, [activeId, userMessageDeleteTarget, t, applyTailReplace, setChats]);

	const onMessagesScroll = React.useCallback(() => {
		const el = scrollRef.current;
		if (!el) {
			return;
		}
		const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
		const near = dist <= SCROLL_STICKY_PX;
		stickToBottomRef.current = near;
		if (sending) {
			setShowScrollDown(!near);
		}
	}, [sending]);

	const scrollMessagesToBottom = React.useCallback(() => {
		const el = scrollRef.current;
		if (!el) {
			return;
		}
		stickToBottomRef.current = true;
		el.scrollTop = el.scrollHeight;
		setShowScrollDown(false);
	}, []);

	React.useEffect(() => {
		if (!activeId) {
			setMessages([]);
			setMessagesTotal(null);
			setMessagesLoadState('idle');
			setAssistantContextByMessageId({});
			setWebSearchSourcesByMessageId({});
			pendingScrollRestoreRef.current = null;
			return;
		}
		let cancelled = false;
		setMessagesLoadState('loading');
		void (async () => {
			try {
				const res = await listDesktopAiMessages(activeId, {
					tail: DESKTOP_AI_MESSAGES_TAIL,
				});
				if (!cancelled) {
					applyTailReplace(res);
					setMessagesLoadState('ready');
				}
			} catch {
				if (!cancelled) {
					toast.error(t('messagesLoadError'));
					setMessagesLoadState('error');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeId, t, applyTailReplace]);

	React.useEffect(() => {
		if (!messages.length) {
			return;
		}
		setAssistantContextByMessageId((prev) => {
			const next = { ...prev };
			for (const row of messages) {
				if (row.role !== 'assistant') {
					continue;
				}
				const ctx = row.metadata?.context_summary;
				if (ctx) {
					const footnote = buildDesktopAiContextFootnote(ctx, t);
					if (footnote) {
						next[row.id] = footnote;
					}
					continue;
				}
				const sources = resolveMessageWebSearchSources(row.metadata);
				if (sources.length > 0 && !next[row.id]) {
					const footnote = buildDesktopAiContextFootnote(
						{ chat_rag_chunks: 0, web_search_sources: sources },
						t
					);
					if (footnote) {
						next[row.id] = footnote;
					}
				}
			}
			return next;
		});
		setWebSearchSourcesByMessageId((prev) => {
			const next = { ...prev };
			for (const row of messages) {
				if (row.role !== 'assistant') {
					continue;
				}
				if (next[row.id]?.length) {
					continue;
				}
				const sources = resolveMessageWebSearchSources(row.metadata);
				if (sources.length > 0) {
					next[row.id] = sources;
				}
			}
			return next;
		});
	}, [messages, t]);

	React.useEffect(() => {
		if (!activeId || messagesLoading) {
			return;
		}
		const el = scrollRef.current;
		if (!el) {
			return;
		}
		const id = requestAnimationFrame(() => {
			el.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(id);
	}, [activeId, messagesLoading]);

	React.useEffect(() => {
		if (
			!activeId ||
			messagesLoading ||
			messagesLoadState !== 'ready' ||
			messages.length !== 0
		) {
			return;
		}
		const composer = document.getElementById(
			DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID
		);
		if (!(composer instanceof HTMLElement)) {
			return;
		}
		const id = requestAnimationFrame(() => {
			composer.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(id);
	}, [activeId, messagesLoading, messagesLoadState, messages.length]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: restore scroll after prepend when `messages` changes
	React.useLayoutEffect(() => {
		const pending = pendingScrollRestoreRef.current;
		const el = scrollRef.current;
		if (!pending || !el) {
			return;
		}
		pendingScrollRestoreRef.current = null;
		el.scrollTop = pending.top + (el.scrollHeight - pending.height);
	}, [messages]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when messages/sending update; DOM refs only in body
	React.useEffect(() => {
		const el = scrollRef.current;
		if (el && stickToBottomRef.current && !pendingScrollRestoreRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, sending]);

	return {
		messages,
		setMessages,
		messagesTotal,
		messagesLoading,
		messagesLoadState,
		retryLoadMessages,
		messagesLoadingOlder,
		messageListEntries,
		showLoadOlderMessages,
		handleLoadOlderMessages,
		applyTailReplace,
		applyTailMergeAfterStream,
		scrollRef,
		showScrollDown,
		setShowScrollDown,
		stickToBottomRef,
		onMessagesScroll,
		scrollMessagesToBottom,
		assistantContextByMessageId,
		setAssistantContextByMessageId,
		webSearchSourcesByMessageId,
		setWebSearchSourcesByMessageId,
		userMessageDeleteTarget,
		setUserMessageDeleteTarget,
		userMessageDeleteLoading,
		pendingUserMessageDeleteCount,
		truncateUserMessageConfirmed,
	};
}
