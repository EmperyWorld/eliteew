/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assistant chat SSE send/stop orchestration: streaming tokens, rate-limit countdown, cache merge.
 *
 * Invariants:
 * - Parent owns composer input ref/height sync; hook owns stream lifecycle and query cache updates.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - pages/Desktop/services/productDesktopApi.ts
 */
import type { QueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import { useVisibilityAwareInterval } from '@/pages/Desktop/hooks/useVisibilityAwareInterval';
import {
	listAssistantMessages,
	sendAssistantMessageStream,
	type AssistantChatMessage,
} from '../../services/productDesktopApi';
import {
	ASSISTANT_MESSAGES_DEFAULT_LIMIT,
	assistantMessagesQueryKey,
} from '../assistantQueryOptions';
import { maybeAppendRagSourcesFooter } from '../../utils/assistantRagSourcesFooter';
import { mapAssistantStreamError } from './mapAssistantStreamError';
import { useDebouncedValue } from './useDebouncedValue';

const STREAM_MARKDOWN_DEBOUNCE_MS = 80;

export type UseAssistantMessageStreamOptions = {
	qc: QueryClient;
	messages: AssistantChatMessage[];
	t: TFunction<'desktopUi', 'assistant'>;
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
	syncComposerHeight: () => void;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	stickToBottomRef: React.MutableRefObject<boolean>;
	setNearBottom: React.Dispatch<React.SetStateAction<boolean>>;
	/** When false, SSE ask is denied with an honest toast (K17 offline). */
	networkAvailable?: boolean;
};

export type UseAssistantMessageStreamResult = {
	sending: boolean;
	streamingRaw: string;
	streamingMarkdown: string;
	pendingUserText: string | null;
	rateLimitSecondsLeft: number;
	streamStoppedFlash: boolean;
	streamingRagLabels: string[];
	runSend: (message: string) => Promise<void>;
	stopStream: () => void;
	faqAskDisabled: boolean;
	faqAskDisabledTitle: string | undefined;
	clearStreamState: () => void;
};

export function useAssistantMessageStream({
	qc,
	messages,
	t,
	inputRef,
	syncComposerHeight,
	setInput,
	stickToBottomRef,
	setNearBottom,
	networkAvailable = true,
}: UseAssistantMessageStreamOptions): UseAssistantMessageStreamResult {
	const [streamingRaw, setStreamingRaw] = React.useState('');
	const [streamingRagLabels, setStreamingRagLabels] = React.useState<string[]>(
		[]
	);
	const streamingDisplay = useDebouncedValue(
		streamingRaw,
		STREAM_MARKDOWN_DEBOUNCE_MS
	);
	const [pendingUserText, setPendingUserText] = React.useState<string | null>(
		null
	);
	const [sending, setSending] = React.useState(false);
	const [streamStoppedFlash, setStreamStoppedFlash] = React.useState(false);
	const [rateLimitUntil, setRateLimitUntil] = React.useState<number | null>(
		null
	);
	const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = React.useState(0);
	const [streamStartedAt, setStreamStartedAt] = React.useState<number | null>(
		null
	);
	const [, setStreamElapsedSec] = React.useState(0);
	const streamAbortRef = React.useRef<AbortController | null>(null);
	const pendingSendRef = React.useRef<string | null>(null);

	React.useEffect(() => {
		if (!rateLimitUntil) {
			setRateLimitSecondsLeft(0);
		}
	}, [rateLimitUntil]);

	const updateRateLimitCountdown = React.useCallback(() => {
		if (!rateLimitUntil) return;
		const left = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
		setRateLimitSecondsLeft(left);
		if (left === 0) setRateLimitUntil(null);
	}, [rateLimitUntil]);

	useVisibilityAwareInterval(
		updateRateLimitCountdown,
		1000,
		rateLimitUntil != null
	);

	React.useEffect(() => {
		if (!streamStartedAt) {
			setStreamElapsedSec(0);
		}
	}, [streamStartedAt]);

	const updateStreamElapsed = React.useCallback(() => {
		if (!streamStartedAt) return;
		setStreamElapsedSec(
			Math.max(0, Math.floor((Date.now() - streamStartedAt) / 1000))
		);
	}, [streamStartedAt]);

	useVisibilityAwareInterval(
		updateStreamElapsed,
		1000,
		streamStartedAt != null
	);

	const mapStreamError = React.useCallback(
		(m: string, meta?: { retryAfterSeconds?: number; status?: number }) =>
			mapAssistantStreamError(m, t, meta),
		[t]
	);

	const clearStreamState = React.useCallback(() => {
		streamAbortRef.current?.abort();
		streamAbortRef.current = null;
		setStreamingRaw('');
		setStreamingRagLabels([]);
		setPendingUserText(null);
		setStreamStartedAt(null);
		setSending(false);
		pendingSendRef.current = null;
	}, []);

	const stopStream = React.useCallback(() => {
		streamAbortRef.current?.abort();
		streamAbortRef.current = null;
		setStreamingRaw('');
		setStreamingRagLabels([]);
		setPendingUserText(null);
		setStreamStartedAt(null);
		setSending(false);
		setStreamStoppedFlash(true);
		const pending = pendingSendRef.current;
		if (pending) setInput(pending);
	}, [setInput]);

	React.useEffect(() => {
		if (!streamStoppedFlash) return;
		const id = window.setTimeout(() => setStreamStoppedFlash(false), 2000);
		return () => window.clearTimeout(id);
	}, [streamStoppedFlash]);

	const runSend = React.useCallback(
		async (message: string) => {
			const trimmed = message.trim();
			if (!trimmed || sending || rateLimitSecondsLeft > 0) return;
			if (!networkAvailable) {
				toast.message(t('offlineAiChatDisabled'));
				return;
			}
			streamAbortRef.current?.abort();
			const ac = new AbortController();
			streamAbortRef.current = ac;
			stickToBottomRef.current = true;
			setNearBottom(true);
			setStreamStoppedFlash(false);
			pendingSendRef.current = trimmed;
			setSending(true);
			setStreamStartedAt(Date.now());
			setStreamingRaw('');
			setStreamingRagLabels([]);
			setPendingUserText(trimmed);
			setInput('');
			window.requestAnimationFrame(() => syncComposerHeight());
			let acc = '';
			try {
				await sendAssistantMessageStream(
					trimmed,
					{
						onToken: (tok) => {
							acc += tok;
							setStreamingRaw(acc);
						},
						onMeta: (meta) => {
							setStreamingRagLabels(meta.rag_source_labels ?? []);
						},
						onDone: (saved) => {
							setPendingUserText(null);
							setStreamingRagLabels([]);
							pendingSendRef.current = null;
							const prev = messages;
							const withoutDup = prev.filter(
								(m) =>
									!(
										m.role === 'assistant' &&
										m.content === saved.content &&
										Math.abs(
											new Date(m.created_at).getTime() -
												new Date(saved.created_at).getTime()
										) < 5000
									)
							);
							const hasUser = withoutDup.some(
								(m) => m.role === 'user' && m.content === trimmed
							);
							const next: AssistantChatMessage[] = hasUser
								? [...withoutDup, saved]
								: [
										...withoutDup,
										{
											id: `local-user-${Date.now()}`,
											role: 'user',
											content: trimmed,
											created_at: saved.created_at,
										},
										saved,
									];
							qc.setQueryData(assistantMessagesQueryKey(), next);
							setStreamingRaw('');
							queueMicrotask(() => inputRef.current?.focus());
							void listAssistantMessages(ASSISTANT_MESSAGES_DEFAULT_LIMIT)
								.then((fresh) => {
									qc.setQueryData(assistantMessagesQueryKey(), fresh);
								})
								.catch(() => {
									void qc.invalidateQueries({
										queryKey: assistantMessagesQueryKey(),
									});
								});
						},
						onError: (m, meta) => {
							if (meta?.retryAfterSeconds) {
								setRateLimitUntil(Date.now() + meta.retryAfterSeconds * 1000);
							}
							toast.error(mapStreamError(m, meta));
							setStreamingRaw('');
							setPendingUserText(null);
							pendingSendRef.current = null;
							setInput(trimmed);
						},
						onAborted: () => {
							setStreamingRaw('');
							setPendingUserText(null);
							const pending = pendingSendRef.current;
							if (pending) setInput(pending);
						},
					},
					{ signal: ac.signal }
				);
			} finally {
				if (streamAbortRef.current === ac) streamAbortRef.current = null;
				setStreamStartedAt(null);
				setSending(false);
			}
		},
		[
			qc,
			sending,
			rateLimitSecondsLeft,
			networkAvailable,
			mapStreamError,
			messages,
			syncComposerHeight,
			setInput,
			stickToBottomRef,
			setNearBottom,
			inputRef,
			t,
		]
	);

	const faqAskDisabled =
		sending || rateLimitSecondsLeft > 0 || !networkAvailable;
	const faqAskDisabledTitle = !networkAvailable
		? t('offlineAiChatDisabled')
		: rateLimitSecondsLeft > 0
			? t('rateLimitWait', { seconds: rateLimitSecondsLeft })
			: undefined;

	// Backend finalizes reply (incl. RAG footer) before SSE token chunks; streamed text
	// eventually contains the same footer. Client mirror here only covers the brief
	// partial-token window so the bubble does not snap when footer chunks arrive;
	// maybeAppendRagSourcesFooter skips once streamed text mentions sources.
	const streamingMarkdown = React.useMemo(
		() => maybeAppendRagSourcesFooter(streamingDisplay, streamingRagLabels),
		[streamingDisplay, streamingRagLabels]
	);

	return {
		sending,
		streamingRaw,
		streamingMarkdown,
		pendingUserText,
		rateLimitSecondsLeft,
		streamStoppedFlash,
		streamingRagLabels,
		runSend,
		stopStream,
		faqAskDisabled,
		faqAskDisabledTitle,
		clearStreamState,
	};
}
