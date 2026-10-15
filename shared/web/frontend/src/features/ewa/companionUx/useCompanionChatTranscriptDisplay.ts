/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transcript display state: messages, pending turn echo, scroll anchor, copy/restore (plan 15 R13 slice).
 *
 * Invariants:
 * - Pending turn clears only when profile reload echoes the same user+assistant pair.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type { TFunction } from 'i18next';

import { extractCompanionCopyText } from '@/features/ewa/companionLongreadReplyUi';
import { companionTurnStageHintKey } from '@/features/ewa/companionTurnStageUi';
import { companionTranscriptDisplayMessages } from '@/features/ewa/companionUx/companionPendingTurnUi';
import { fnv1a32 } from '@/features/ewa/companionUx/companionChatOrchestrationShared';
import { useCompanionPendingTurn } from '@/features/ewa/companionUx/useCompanionPendingTurn';
import type { CompanionTurnStagePayload } from '@/services/ewa/ewaCompanionChatApi';
import {
	extractCompanionChatMessagesFromLearned,
	extractLatestCompanionAssistantReplyFromLearned,
	resolveLastUserMessageForRestore,
} from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionChatTranscriptDisplayOptions = {
	profile: Pick<
		EwaCompanionProfileOut,
		'learned_preferences' | 'companion_revision' | 'principal_id'
	>;
	personaId: string;
	pending: boolean;
	streamingText: string;
	turnStage: CompanionTurnStagePayload | null;
	headerRotation: number;
	reducedMotion: boolean;
	bottomRef: RefObject<HTMLDivElement | null>;
	companionScrollEpochRef: React.MutableRefObject<number>;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	setCopiedMessageKey: React.Dispatch<React.SetStateAction<string | null>>;
	copyFeedbackTimerRef: React.MutableRefObject<ReturnType<
		typeof setTimeout
	> | null>;
	notifyError: (message: string) => void;
	updateDraft: (text: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionChatTranscriptDisplay({
	profile,
	personaId,
	pending,
	streamingText,
	turnStage,
	headerRotation,
	reducedMotion,
	bottomRef,
	companionScrollEpochRef,
	inputRef,
	setCopiedMessageKey,
	copyFeedbackTimerRef,
	notifyError,
	updateDraft,
	t,
}: UseCompanionChatTranscriptDisplayOptions) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: revision bumps after PATCH must refresh transcript.
	const messages = useMemo(
		() => extractCompanionChatMessagesFromLearned(profile.learned_preferences),
		[profile.learned_preferences, profile.companion_revision]
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: same hydration guard as messages.
	const latestVisibleReply = useMemo(
		() =>
			extractLatestCompanionAssistantReplyFromLearned(
				profile.learned_preferences
			),
		[profile.learned_preferences, profile.companion_revision]
	);

	const { pendingTurn, setPendingTurn } = useCompanionPendingTurn(messages);

	const thinkingHintText = useMemo(() => {
		const stageKey = companionTurnStageHintKey(turnStage);
		if (pending && !streamingText.trim() && stageKey) {
			return t(stageKey);
		}
		const raw = t('ewaCompanion.thinkingHints', { returnObjects: true });
		const arr = Array.isArray(raw)
			? raw
					.filter((x): x is string => typeof x === 'string')
					.map((x) => x.trim())
					.filter((x) => x.length > 0)
			: [];
		if (arr.length === 0) return t('ewaCompanion.thinkingHint');
		const h = fnv1a32(`${personaId}:${headerRotation}:hint`);
		return arr[h % arr.length] ?? t('ewaCompanion.thinkingHint');
	}, [t, personaId, headerRotation, pending, streamingText, turnStage]);

	const displayMessages = useMemo(
		() => companionTranscriptDisplayMessages(latestVisibleReply, pendingTurn),
		[latestVisibleReply, pendingTurn]
	);

	const lastRestorableUserMessage = useMemo(
		() =>
			resolveLastUserMessageForRestore({
				messages,
				pendingTurn,
			}),
		[messages, pendingTurn]
	);

	const handleRestoreLastUserMessage = useCallback(() => {
		if (pending) return;
		const text = lastRestorableUserMessage;
		if (!text) {
			notifyError(t('ewaCompanion.chatRestoreLastMessageEmpty'));
			return;
		}
		updateDraft(text);
		inputRef.current?.focus();
	}, [
		notifyError,
		lastRestorableUserMessage,
		pending,
		t,
		updateDraft,
		inputRef,
	]);

	const copyAssistantReply = useCallback(
		async (content: string, messageKey: string) => {
			const text = extractCompanionCopyText(content);
			if (!text) return;
			try {
				if (navigator.clipboard?.writeText) {
					await navigator.clipboard.writeText(text);
				} else {
					throw new Error('clipboard_unavailable');
				}
				setCopiedMessageKey(messageKey);
				if (copyFeedbackTimerRef.current) {
					clearTimeout(copyFeedbackTimerRef.current);
				}
				copyFeedbackTimerRef.current = setTimeout(() => {
					setCopiedMessageKey((prev) => (prev === messageKey ? null : prev));
				}, 2000);
			} catch {
				notifyError(t('ewaCompanion.chatCopyFailed'));
			}
		},
		[copyFeedbackTimerRef, notifyError, setCopiedMessageKey, t]
	);

	const keyedMessages = useMemo(
		() =>
			displayMessages.map((m, idx) => ({
				message: m,
				key: `${profile.companion_revision}-${idx}-${m.role}`,
			})),
		[displayMessages, profile.companion_revision]
	);

	const streamGrowingAssistant = pending && Boolean(streamingText.trim());
	const empty = displayMessages.length === 0 && !streamingText && !pending;

	const lastAssistantReplyText = useMemo(() => {
		for (let i = displayMessages.length - 1; i >= 0; i -= 1) {
			const row = displayMessages[i];
			if (row.role === 'assistant' && row.content.trim()) {
				return row.content.trim();
			}
		}
		return '';
	}, [displayMessages]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: anchor scroll tracks transcript updates including streaming text growth.
	useEffect(() => {
		const el = bottomRef.current;
		if (!el) return;

		const streaming = pending && Boolean(streamingText.trim());

		const scrollToBottom = (behavior: ScrollBehavior) => {
			el.scrollIntoView({ behavior, block: 'end' });
		};

		if (!streaming) {
			scrollToBottom(reducedMotion ? 'auto' : 'smooth');
			return;
		}

		const epoch = ++companionScrollEpochRef.current;
		const delayMs = 160;
		const timer = window.setTimeout(() => {
			if (companionScrollEpochRef.current !== epoch) return;
			scrollToBottom('auto');
		}, delayMs);

		return () => window.clearTimeout(timer);
	}, [
		displayMessages,
		streamingText,
		pending,
		reducedMotion,
		bottomRef,
		companionScrollEpochRef,
	]);

	return {
		messages,
		pendingTurn,
		setPendingTurn,
		displayMessages,
		keyedMessages,
		streamGrowingAssistant,
		empty,
		thinkingHintText,
		lastRestorableUserMessage,
		handleRestoreLastUserMessage,
		copyAssistantReply,
		lastAssistantReplyText,
	};
}
