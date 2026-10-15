/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-thread message search state, match navigation, and scroll-into-view for GAF Chat.
 * Exposes refs consumed by global keyboard shortcuts in GAFChatApp.
 *
 * Invariants:
 * - Search query resets when selectedChatId changes.
 * - Match index clamps when match list shrinks.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/gafChatThreadSearch.ts
 * - src/pages/Desktop/components/GAFChat/components/GafChatThreadPanel.tsx
 */
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from 'react';
import { buildThreadSearchMatchIds } from '../gafChatThreadSearch';
import type { GAFMessageItem } from '../types';

export type GafChatThreadSearchNavRef = {
	trimmed: string;
	matchCount: number;
	goNext: () => void;
	goPrev: () => void;
};

export type UseGafChatThreadSearchArgs = {
	selectedChatId: string | null;
	messages: GAFMessageItem[];
	myUserId: string | null;
	messageListRef: RefObject<HTMLDivElement | null>;
};

export type UseGafChatThreadSearchResult = {
	threadSearchQuery: string;
	setThreadSearchQuery: (value: string) => void;
	threadSearchQueryRef: RefObject<string>;
	threadSearchInputRef: RefObject<HTMLInputElement | null>;
	threadSearchNavRef: RefObject<GafChatThreadSearchNavRef>;
	threadSearchTrimmed: string;
	threadMatchIds: string[];
	threadMatchIndex: number;
	goNextThreadMatch: () => void;
	goPrevThreadMatch: () => void;
};

export function useGafChatThreadSearch({
	selectedChatId,
	messages,
	myUserId,
	messageListRef,
}: UseGafChatThreadSearchArgs): UseGafChatThreadSearchResult {
	const [threadSearchQuery, setThreadSearchQuery] = useState('');
	const threadSearchQueryRef = useRef(threadSearchQuery);
	useEffect(() => {
		threadSearchQueryRef.current = threadSearchQuery;
	}, [threadSearchQuery]);
	const threadSearchInputRef = useRef<HTMLInputElement | null>(null);
	const [threadMatchIndex, setThreadMatchIndex] = useState(0);

	// Reset in-thread search when the active conversation changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on selectedChatId only
	useEffect(() => {
		setThreadSearchQuery('');
	}, [selectedChatId]);

	const threadSearchTrimmed = threadSearchQuery.trim();
	const threadSearchLower = threadSearchTrimmed.toLowerCase();

	const threadMatchIds = useMemo(
		() => buildThreadSearchMatchIds(messages, myUserId, threadSearchLower),
		[messages, myUserId, threadSearchLower]
	);

	useEffect(() => {
		setThreadMatchIndex((i) => {
			if (threadMatchIds.length === 0) return 0;
			return Math.min(i, threadMatchIds.length - 1);
		});
	}, [threadMatchIds]);

	const goNextThreadMatch = useCallback(() => {
		if (threadMatchIds.length === 0) return;
		setThreadMatchIndex((i) => (i + 1) % threadMatchIds.length);
	}, [threadMatchIds.length]);

	const goPrevThreadMatch = useCallback(() => {
		if (threadMatchIds.length === 0) return;
		setThreadMatchIndex(
			(i) => (i - 1 + threadMatchIds.length) % threadMatchIds.length
		);
	}, [threadMatchIds.length]);

	const threadSearchNavRef = useRef<GafChatThreadSearchNavRef>({
		trimmed: '',
		matchCount: 0,
		goNext: () => {},
		goPrev: () => {},
	});
	useEffect(() => {
		threadSearchNavRef.current = {
			trimmed: threadSearchTrimmed,
			matchCount: threadMatchIds.length,
			goNext: goNextThreadMatch,
			goPrev: goPrevThreadMatch,
		};
	}, [
		threadSearchTrimmed,
		threadMatchIds.length,
		goNextThreadMatch,
		goPrevThreadMatch,
	]);

	useLayoutEffect(() => {
		if (!threadSearchTrimmed || threadMatchIds.length === 0) return;
		const id = threadMatchIds[threadMatchIndex] ?? threadMatchIds[0];
		if (!id) return;
		const root = messageListRef.current;
		if (!root) return;
		const safe =
			typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
				? CSS.escape(id)
				: id.replace(/["\\]/g, '\\$&');
		const el = root.querySelector(`[data-gaf-message-id="${safe}"]`);
		queueMicrotask(() => {
			el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	}, [threadSearchTrimmed, threadMatchIds, threadMatchIndex, messageListRef]);

	return {
		threadSearchQuery,
		setThreadSearchQuery,
		threadSearchQueryRef,
		threadSearchInputRef,
		threadSearchNavRef,
		threadSearchTrimmed,
		threadMatchIds,
		threadMatchIndex,
		goNextThreadMatch,
		goPrevThreadMatch,
	};
}
