/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stream chat, recovery draft, FM seed prompt, and stream a11y for AIAssistantPanel.
 *
 * Invariants:
 * - Aborted streams keep partial text; recovery banner uses docAiStreamRecovery utils.
 *
 * Related:
 * - useLlamaAI, utils/docAiStreamRecovery.ts
 */

import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from 'react';
import type { TFunction } from 'i18next';
import { mapAiErrorForUser } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantErrorMappers';
import type {
	AIAssistantActionMode,
	AIAssistantChatMessage,
	AIAssistantContextScope,
	AIGenerationMeta,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import type { AiFileManagerContext } from '@/components/UltimateDocEditor/types/editor.types';
import {
	clearDocAiStreamDraft,
	readDocAiStreamDraft,
	shouldOfferDocAiRecovery,
	type DocAiStreamDraft,
} from '@/components/UltimateDocEditor/utils/docAiStreamRecovery';

type CompleteTextStreaming = (
	message: string,
	context: string,
	onChunk: (chunk: string) => void,
	opts: {
		actionMode: AIAssistantActionMode;
		contextScope: AIAssistantContextScope;
		documentId: string | undefined;
	}
) => Promise<{
	aborted?: boolean;
	partialText?: string;
	meta?: AIGenerationMeta | null;
}>;

type UseAIAssistantChatArgs = {
	t: TFunction<'docEditorPanels'>;
	isOpen: boolean;
	selectedText?: string;
	documentText?: string;
	fileManagerDocumentContext?: AiFileManagerContext | null;
	effectiveDocumentIdForAi: string | undefined;
	prompt: string;
	setPrompt: Dispatch<SetStateAction<string>>;
	contextScope: AIAssistantContextScope;
	setContextScope: Dispatch<SetStateAction<AIAssistantContextScope>>;
	actionMode: AIAssistantActionMode;
	setActionMode: Dispatch<SetStateAction<AIAssistantActionMode>>;
	isStreaming: boolean;
	isTranscribing: boolean;
	isRecording: boolean;
	completeTextStreaming: CompleteTextStreaming;
	lastResponseMeta: AIGenerationMeta | null;
	showError: (title: string, body: string) => void;
	success: (title: string, body: string) => void;
};

export function useAIAssistantChat({
	t,
	isOpen,
	selectedText,
	documentText,
	fileManagerDocumentContext,
	effectiveDocumentIdForAi,
	prompt,
	setPrompt,
	contextScope,
	setContextScope,
	actionMode,
	setActionMode,
	isStreaming,
	isTranscribing,
	isRecording,
	completeTextStreaming,
	lastResponseMeta,
	showError,
	success,
}: UseAIAssistantChatArgs) {
	const [chatHistory, setChatHistory] = useState<AIAssistantChatMessage[]>([]);
	const chatMessageIdRef = useRef(0);
	const nextChatMessageId = (): string => {
		chatMessageIdRef.current += 1;
		return `doc-ai-msg-${chatMessageIdRef.current}`;
	};
	const clearChatHistory = (): void => {
		chatMessageIdRef.current = 0;
		setChatHistory([]);
	};
	const [streamingText, setStreamingText] = useState('');
	const [recoveryDraft, setRecoveryDraft] = useState<DocAiStreamDraft | null>(
		null
	);
	const chatEndRef = useRef<HTMLDivElement>(null);
	const streamingTextLenRef = useRef(0);
	const [streamA11yMessage, setStreamA11yMessage] = useState('');

	useEffect(() => {
		streamingTextLenRef.current = streamingText.length;
	}, [streamingText.length]);

	useEffect(() => {
		if (!isOpen) {
			setStreamA11yMessage('');
			return;
		}
		if (!isStreaming) {
			return;
		}
		setStreamA11yMessage(t('ai.streamStarting'));
		const intervalId = window.setInterval(() => {
			setStreamA11yMessage(
				t('ai.streamStatus', { count: streamingTextLenRef.current })
			);
		}, 2000);
		return () => window.clearInterval(intervalId);
	}, [isOpen, isStreaming, t]);

	useEffect(() => {
		if (!isOpen || isStreaming) {
			return;
		}
		const id = window.setTimeout(() => setStreamA11yMessage(''), 800);
		return () => window.clearTimeout(id);
	}, [isOpen, isStreaming]);

	const fileManagerSeedAppliedRef = useRef<string | null>(null);
	useEffect(() => {
		if (!fileManagerDocumentContext) {
			fileManagerSeedAppliedRef.current = null;
		}
	}, [fileManagerDocumentContext]);

	useEffect(() => {
		if (!isOpen || !fileManagerDocumentContext) {
			return;
		}
		const id = fileManagerDocumentContext.documentId;
		if (fileManagerSeedAppliedRef.current === id) {
			return;
		}
		fileManagerSeedAppliedRef.current = id;
		setContextScope('document');
		setPrompt(
			t('ai.fileManagerContext.seedPrompt', {
				title: fileManagerDocumentContext.title,
			})
		);
	}, [isOpen, fileManagerDocumentContext, t, setContextScope, setPrompt]);

	useEffect(() => {
		if (!isOpen) {
			setRecoveryDraft(null);
			return;
		}
		if (isStreaming) {
			setRecoveryDraft(null);
			return;
		}
		const draft = readDocAiStreamDraft(effectiveDocumentIdForAi ?? undefined);
		if (shouldOfferDocAiRecovery(draft)) {
			setRecoveryDraft(draft);
		} else {
			setRecoveryDraft(null);
		}
	}, [isOpen, effectiveDocumentIdForAi, isStreaming]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	const handleSubmit = async (): Promise<void> => {
		if (!prompt.trim() || isStreaming || isTranscribing || isRecording) {
			return;
		}

		const actionPrefixByMode: Record<AIAssistantActionMode, string> = {
			rewrite: t('ai.actionPrefix.rewrite'),
			expand: t('ai.actionPrefix.expand'),
			summarize: t('ai.actionPrefix.summarize'),
			translate: t('ai.actionPrefix.translate'),
			free: t('ai.actionPrefix.free'),
		};

		const sourceByScope = (() => {
			if (contextScope === 'selection') {
				return selectedText?.trim() || '';
			}
			if (contextScope === 'section') {
				return (selectedText?.trim() || documentText?.trim() || '').slice(
					0,
					2200
				);
			}
			const fm = fileManagerDocumentContext?.plainText?.trim();
			if (fm) {
				return fm.slice(0, 8000);
			}
			return (documentText?.trim() || '').slice(0, 8000);
		})();

		const contextBlock = sourceByScope
			? `\n\n${t('ai.compose.contextHeader', {
					scope: t(`ai.scopeShort.${contextScope}`),
				})}\n${sourceByScope}`
			: '';

		const composedMessage = [
			actionPrefixByMode[actionMode],
			prompt.trim(),
			contextBlock,
		]
			.filter(Boolean)
			.join('\n\n');

		const userMessage = composedMessage;
		const context = sourceByScope;

		setChatHistory((prev) => [
			...prev,
			{ id: nextChatMessageId(), role: 'user', text: userMessage },
		]);
		setPrompt('');
		setStreamingText('');

		try {
			let fullResponse = '';
			const result = await completeTextStreaming(
				userMessage,
				context,
				(chunk) => {
					fullResponse += chunk;
					setStreamingText(fullResponse);
				},
				{
					actionMode,
					contextScope,
					documentId: effectiveDocumentIdForAi,
				}
			);

			if (result.aborted) {
				const partial = result.partialText?.trim();
				const stoppedNote = t('ai.aborted.stoppedByUserInline');
				setChatHistory((prev) => [
					...prev,
					{
						id: nextChatMessageId(),
						role: 'ai',
						text: partial
							? `${partial}\n\n_(${stoppedNote})_`
							: t('ai.aborted.stoppedByUserOnly'),
						meta: result.meta,
					},
				]);
				setStreamingText('');
				return;
			}

			setChatHistory((prev) => [
				...prev,
				{
					id: nextChatMessageId(),
					role: 'ai',
					text: fullResponse,
					meta: result.meta ?? lastResponseMeta,
				},
			]);
			setStreamingText('');
		} catch (error: unknown) {
			const errorMessage = mapAiErrorForUser(error, t);
			showError(t('ai.errorTitle'), errorMessage);
			setChatHistory((prev) => [
				...prev,
				{
					id: nextChatMessageId(),
					role: 'ai',
					text: errorMessage,
				},
			]);
			setStreamingText('');
		}
	};

	const handleQuickAction = async (action: string): Promise<void> => {
		const prompts: Record<string, string> = {
			summarize: t('ai.quickPrompts.summarize'),
			improve: t('ai.quickPrompts.improve'),
			correct: t('ai.quickPrompts.correct'),
			translate: t('ai.quickPrompts.translate'),
			expand: t('ai.quickPrompts.expand'),
			simplify: t('ai.quickPrompts.simplify'),
		};

		setPrompt(prompts[action] || '');
		if (action === 'summarize') {
			setActionMode('summarize');
		} else if (action === 'translate') {
			setActionMode('translate');
		} else if (action === 'expand') {
			setActionMode('expand');
		} else if (action === 'improve' || action === 'correct') {
			setActionMode('rewrite');
		}
	};

	const handleRestoreDocAiDraft = (): void => {
		if (!recoveryDraft) return;
		setActionMode(recoveryDraft.actionMode);
		setContextScope(recoveryDraft.contextScope);
		const partial = recoveryDraft.partialResponse.trim();
		const aiText = partial
			? `${partial}\n\n_(${t('ai.recovery.noteFromDraft')})_`
			: `_(${t('ai.recovery.noteNoAnswer')})_`;
		setChatHistory((prev) => {
			const hasUser = prev.some(
				(m) => m.role === 'user' && m.text === recoveryDraft.userMessage
			);
			if (hasUser) {
				return [
					...prev,
					{
						id: nextChatMessageId(),
						role: 'ai' as const,
						text: aiText,
						meta: null,
					},
				];
			}
			return [
				...prev,
				{
					id: nextChatMessageId(),
					role: 'user' as const,
					text: recoveryDraft.userMessage,
				},
				{
					id: nextChatMessageId(),
					role: 'ai' as const,
					text: aiText,
					meta: null,
				},
			];
		});
		if (!partial) {
			setPrompt(recoveryDraft.userMessage);
		}
		clearDocAiStreamDraft(effectiveDocumentIdForAi ?? undefined);
		setRecoveryDraft(null);
		success(t('ai.toast.draftRestoredTitle'), t('ai.toast.draftRestoredBody'));
	};

	const handleDismissDocAiRecovery = (): void => {
		clearDocAiStreamDraft(effectiveDocumentIdForAi ?? undefined);
		setRecoveryDraft(null);
	};

	const latestAiText =
		[...chatHistory].reverse().find((message) => message.role === 'ai')?.text ||
		'';
	const latestAiMeta =
		[...chatHistory]
			.reverse()
			.find((message) => message.role === 'ai' && message.meta)?.meta ??
		lastResponseMeta;

	return {
		chatHistory,
		streamingText,
		setStreamingText,
		clearChatHistory,
		chatEndRef,
		streamA11yMessage,
		recoveryDraft,
		handleSubmit,
		handleQuickAction,
		handleRestoreDocAiDraft,
		handleDismissDocAiRecovery,
		latestAiText,
		latestAiMeta,
	};
}
