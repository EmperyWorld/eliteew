/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public and internal types for Desktop AI Chat SSE stream hook atomization.
 *
 * Invariants:
 * - UseDesktopAiChatStreamParams shape is stable for DesktopAiChatApp callers.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts (facade)
 * - hooks/desktopAiChatStream/useDesktopAiChatStream.ts
 */
import type { TFunction } from 'i18next';
import type * as React from 'react';
import type {
	DesktopAiChatItem,
	DesktopAiMessage,
	DesktopAiStreamContextSummary,
	ListDesktopAiMessagesResult,
} from '../../api/desktopChatClient';
import type { DesktopAiContextFootnote as DesktopAiContextFootnoteData } from '../../desktopChatContextSummary';
import type { DesktopAiDocumentReplacementPayload } from '../../desktopChatDocumentReplacement';
import type { DesktopAiWebSearchSource } from '../../desktopWebSearchSources';
import type { DesktopEnsembleCouncilUiState } from '../../ensemble';

export type LastFailedSendState = {
	text: string;
	useTools: boolean;
	useWebSearch: boolean;
	regenerate: boolean;
	documentConfirm?: {
		decision: 'accept' | 'decline';
		refUserMessageId: string;
	};
};

export type UseDesktopAiChatStreamParams = {
	activeId: string | null;
	featureOn: boolean;
	sending: boolean;
	setSending: React.Dispatch<React.SetStateAction<boolean>>;
	input: string;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	messages: DesktopAiMessage[];
	setMessages: React.Dispatch<React.SetStateAction<DesktopAiMessage[]>>;
	chats: DesktopAiChatItem[];
	settings: Record<string, unknown>;
	useTools: boolean;
	useWebSearch: boolean;
	/** Clear panel web-search arm after it is consumed for a send (one-shot). */
	consumeWebSearchArm: () => void;
	ensembleDocConfirm: { userMessageId: string; reason: string } | null;
	setEnsembleDocConfirm: React.Dispatch<
		React.SetStateAction<{ userMessageId: string; reason: string } | null>
	>;
	soloSendsBlocked: boolean;
	setSoloSlotModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setStreamErrorBanner: React.Dispatch<
		React.SetStateAction<{
			message: string;
			retryable: boolean;
			canClearStreamLock?: boolean;
			turnBusy?: boolean;
		} | null>
	>;
	setComposerHint: React.Dispatch<React.SetStateAction<string | null>>;
	setShowScrollDown: React.Dispatch<React.SetStateAction<boolean>>;
	setToolsHistory: React.Dispatch<
		React.SetStateAction<
			Array<{
				at: number;
				summary: string;
				sources: DesktopAiWebSearchSource[];
			}>
		>
	>;
	setEnsembleCouncilUi: React.Dispatch<
		React.SetStateAction<DesktopEnsembleCouncilUiState | null>
	>;
	setAssistantContextByMessageId: React.Dispatch<
		React.SetStateAction<Record<string, DesktopAiContextFootnoteData>>
	>;
	setWebSearchSourcesByMessageId: React.Dispatch<
		React.SetStateAction<Record<string, DesktopAiWebSearchSource[]>>
	>;
	stickToBottomRef: React.MutableRefObject<boolean>;
	skipTtsRef: React.MutableRefObject<boolean>;
	/** Live peer turn busy (stream-lock poll / turn_started); checked on send. */
	remoteStreamBusyRef: React.MutableRefObject<boolean>;
	applyTailMergeAfterStream: (res: ListDesktopAiMessagesResult) => void;
	applyTailReplace: (res: ListDesktopAiMessagesResult) => void;
	refreshAttachments: () => void | Promise<void>;
	playTts: (text: string) => void | Promise<void>;
	/** DB users.id from GET /desktop/ai-chat/me (for optimistic author_user_id). */
	currentUserId?: string | null;
	t: TFunction<'desktopAiChat'>;
};

export type RunStreamOptions = {
	regenerate: boolean;
	signal: AbortSignal;
	soloAssistantLocalId: string | null;
	isEnsemble: boolean;
	useToolsFlag: boolean;
	useWebSearchFlag: boolean;
	streamChatId: string;
	streamEpoch: number;
	clientRequestId: string;
	documentConfirm?: {
		decision: 'accept' | 'decline';
		refUserMessageId: string;
	};
};

export type DesktopAiChatStreamRefs = {
	streamEpochRef: React.MutableRefObject<number>;
	streamAbortRef: React.MutableRefObject<AbortController | null>;
	sendLockRef: React.MutableRefObject<boolean>;
	lastFailedSendRef: React.MutableRefObject<LastFailedSendState | null>;
	pendingContextRef: React.MutableRefObject<DesktopAiStreamContextSummary | null>;
	ensembleDeliveryModeRef: React.MutableRefObject<'joint' | 'separate'>;
	ensembleJointBubbleIdRef: React.MutableRefObject<string | null>;
};

export type StreamRunMutableState = {
	acc: string;
	currentAsstId: string | null;
	stagedReplacement: DesktopAiDocumentReplacementPayload | null;
};
