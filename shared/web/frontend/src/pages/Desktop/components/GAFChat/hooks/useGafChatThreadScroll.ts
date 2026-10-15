/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scroll container refs, stick-to-bottom auto-scroll, older-page preservation,
 * and scroll-to-bottom FAB visibility for GAF Chat message thread.
 *
 * Invariants:
 * - Auto-scroll runs only while stickToBottomRef is true or after chat switch.
 * - Loading older messages preserves viewport anchor via scrollHeight delta.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatThreadPanel.tsx
 * - src/pages/Desktop/components/GAFChat/gafChatMessageViewUtils.ts
 */
import {
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
	type RefObject,
} from 'react';
import { SCROLL_BOTTOM_THRESHOLD_PX } from '../gafChatMessageViewUtils';

export type UseGafChatThreadScrollArgs = {
	selectedChatId: string | null;
	messagesLength: number;
	messagesLoading: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
};

export type UseGafChatThreadScrollResult = {
	messageListRef: RefObject<HTMLDivElement | null>;
	loadMoreSentinelRef: RefObject<HTMLDivElement | null>;
	showScrollDown: boolean;
	updateMessageListScrollUi: () => void;
	scrollMessagesToBottom: () => void;
	handleLoadOlder: () => void;
	scrollToMessageId: string | null;
	handleJumpToMessage: (messageId: string) => void;
	onConsumedScrollToMessage: () => void;
};

export function useGafChatThreadScroll({
	selectedChatId,
	messagesLength,
	messagesLoading,
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
}: UseGafChatThreadScrollArgs): UseGafChatThreadScrollResult {
	const messageListRef = useRef<HTMLDivElement | null>(null);
	const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
	const preserveScrollBeforeOlderRef = useRef<number | null>(null);
	const stickToBottomRef = useRef(true);
	const stickToBottomChatIdRef = useRef<string | null>(null);
	const [showScrollDown, setShowScrollDown] = useState(false);
	const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(
		null
	);

	useLayoutEffect(() => {
		if (isFetchingNextPage) return;
		if (preserveScrollBeforeOlderRef.current == null) return;
		const el = messageListRef.current;
		if (!el) {
			preserveScrollBeforeOlderRef.current = null;
			return;
		}
		const prev = preserveScrollBeforeOlderRef.current;
		const delta = el.scrollHeight - prev;
		if (delta > 0) el.scrollTop += delta;
		preserveScrollBeforeOlderRef.current = null;
	}, [isFetchingNextPage]);

	const handleLoadOlder = useCallback(() => {
		const root = messageListRef.current;
		if (!root || !hasNextPage || isFetchingNextPage) return;
		preserveScrollBeforeOlderRef.current = root.scrollHeight;
		stickToBottomRef.current = false;
		void fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const handleJumpToMessage = useCallback((messageId: string) => {
		setScrollToMessageId(messageId);
	}, []);

	const onConsumedScrollToMessage = useCallback(() => {
		setScrollToMessageId(null);
	}, []);

	const updateMessageListScrollUi = useCallback(() => {
		const el = messageListRef.current;
		if (!el) return;
		const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
		const atBottom = dist <= SCROLL_BOTTOM_THRESHOLD_PX;
		stickToBottomRef.current = atBottom;
		setShowScrollDown(
			!atBottom && messagesLength > 0 && !messagesLoading && !!selectedChatId
		);
	}, [messagesLength, messagesLoading, selectedChatId]);

	const scrollMessagesToBottom = useCallback(() => {
		const el = messageListRef.current;
		if (!el) return;
		stickToBottomRef.current = true;
		const snap = () => {
			el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
		};
		snap();
		requestAnimationFrame(() => {
			requestAnimationFrame(snap);
		});
		queueMicrotask(() => updateMessageListScrollUi());
	}, [updateMessageListScrollUi]);

	useLayoutEffect(() => {
		if (stickToBottomChatIdRef.current !== selectedChatId) {
			stickToBottomChatIdRef.current = selectedChatId;
			stickToBottomRef.current = true;
		}
		const node = messageListRef.current;
		if (!node || !selectedChatId) return;
		if (messagesLoading && messagesLength === 0) return;
		if (stickToBottomRef.current) {
			const snap = () => {
				node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
			};
			snap();
			requestAnimationFrame(() => {
				requestAnimationFrame(snap);
			});
			const t1 = window.setTimeout(snap, 100);
			const t2 = window.setTimeout(snap, 350);
			updateMessageListScrollUi();
			return () => {
				window.clearTimeout(t1);
				window.clearTimeout(t2);
			};
		}
		updateMessageListScrollUi();
		return undefined;
	}, [
		selectedChatId,
		messagesLength,
		messagesLoading,
		updateMessageListScrollUi,
	]);

	return {
		messageListRef,
		loadMoreSentinelRef,
		showScrollDown,
		updateMessageListScrollUi,
		scrollMessagesToBottom,
		handleLoadOlder,
		scrollToMessageId,
		handleJumpToMessage,
		onConsumedScrollToMessage,
	};
}
