/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrates AIAssistantPanel hooks, chrome classes, save-prompt modal, and derived UI state.
 *
 * Invariants:
 * - Escape closes save modal first, then the panel.
 * - Named export panel shell consumes this hook as a single `c` object.
 *
 * Related:
 * - AIAssistantPanel.tsx, useAIAssistantChat.ts
 */

import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	BookOpenIcon,
	CheckCircleIcon,
	DocumentTextIcon,
	LanguageIcon,
	LightBulbIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useNotifications } from '@/notifications';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	getDesktopShellEastColumnClassName,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { useLlamaAI } from '@/components/UltimateDocEditor/hooks/useLlamaAI';
import { useEditorStoreShallow } from '@/components/UltimateDocEditor/store/editorStoreContext';
import { selectAIAssistantPromptsSlice } from '@/components/UltimateDocEditor/store/editorStoreSelectors';
import type {
	AIAssistantActionMode,
	AIAssistantContextScope,
	AIAssistantPanelProps,
	AIAssistantQuickActionItem,
	AIAssistantReplaceDiffStats,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import { useAIAssistantChat } from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantChat';
import { useAIAssistantInsertPolicy } from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantInsertPolicy';
import { useAIAssistantSuggestions } from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantSuggestions';
import { useAIAssistantVoice } from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantVoice';

const QUICK_ACTION_ICON_PROPS = {
	width: 14,
	height: 14,
	'aria-hidden': true,
	className: 'shrink-0 opacity-90',
} as const;
export function useAIAssistantCompose({
	isOpen,
	onClose,
	selectedText,
	documentText,
	documentId,
	fileManagerDocumentContext = null,
	onClearFileManagerDocumentContext,
	onInsert,
	onReplace,
}: AIAssistantPanelProps) {
	const { t } = useTranslation('docEditorPanels');
	const effectiveDocumentIdForAi =
		fileManagerDocumentContext?.documentId ?? documentId;
	const [prompt, setPrompt] = useState('');
	const [contextScope, setContextScope] =
		useState<AIAssistantContextScope>('selection');
	const [actionMode, setActionMode] = useState<AIAssistantActionMode>('free');
	const [showSavePromptModal, setShowSavePromptModal] = useState(false);
	const [promptName, setPromptName] = useState('');
	const savePromptInputRef = useRef<HTMLInputElement>(null);

	const {
		isStreaming,
		completeTextStreaming,
		stopStreaming,
		lastResponseMeta,
	} = useLlamaAI();
	const { savedPrompts, loadPrompts, savePrompt } = useEditorStoreShallow(
		selectAIAssistantPromptsSlice
	);
	const { success, error: showError } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const shellFrame = useDesktopShellFrame();

	const aiPanelRootClass = useMemo(
		() =>
			cn(
				'ai-assistant-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-[420px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden will-change-transform',
				getDesktopShellEastColumnClassName(shellFrame),
				'shadow-(--desktop-shadow-panel)'
			),
		[shellFrame]
	);
	const aiHeaderStripClass = useMemo(
		() => getDesktopShellHeaderStripClassName(shellFrame),
		[shellFrame]
	);
	const aiFooterStripClass = useMemo(
		() => getDesktopShellFooterStripClassName(shellFrame),
		[shellFrame]
	);
	const aiComposerTextareaClass = useMemo(
		() =>
			cn(
				'min-h-0 flex-1 resize-none rounded-lg px-2.5 py-1.5 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);

	const voice = useAIAssistantVoice({
		t,
		isStreaming,
		setPrompt,
		success,
	});

	const chat = useAIAssistantChat({
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
		isTranscribing: voice.isTranscribing,
		isRecording: voice.isRecording,
		completeTextStreaming,
		lastResponseMeta,
		showError,
		success,
	});

	const insertPolicy = useAIAssistantInsertPolicy({
		t,
		contextScope,
		effectiveDocumentIdForAi,
		onInsert,
		onReplace,
		clearChatHistory: chat.clearChatHistory,
		setStreamingText: chat.setStreamingText,
		showError,
	});

	const suggestions = useAIAssistantSuggestions({
		selectedText,
		handleInsert: insertPolicy.handleInsert,
		handleReplace: insertPolicy.handleReplace,
	});

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				if (showSavePromptModal) {
					e.stopPropagation();
					setShowSavePromptModal(false);
					setPromptName('');
					return;
				}
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose, showSavePromptModal]);

	useEffect(() => {
		if (!showSavePromptModal) {
			return;
		}
		const id = requestAnimationFrame(() => {
			savePromptInputRef.current?.focus();
			savePromptInputRef.current?.select();
		});
		return () => cancelAnimationFrame(id);
	}, [showSavePromptModal]);

	useEffect(() => {
		loadPrompts();
	}, [loadPrompts]);

	const handleSavePrompt = async (): Promise<void> => {
		if (!prompt.trim()) {
			return;
		}
		setShowSavePromptModal(true);
	};

	const handleSavePromptConfirm = async (): Promise<void> => {
		if (!promptName.trim() || !prompt.trim()) {
			return;
		}

		try {
			await savePrompt(promptName.trim(), prompt, 'general');
			success(
				t('ai.toast.promptSavedTitle'),
				t('ai.toast.promptSavedBody', { name: promptName.trim() })
			);
			setShowSavePromptModal(false);
			setPromptName('');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: t('ai.errors.savePromptGeneric');
			showError(t('ai.toast.promptSaveFailedTitle'), errorMessage);
		}
	};

	const handleUsePrompt = (promptText: string): void => {
		voice.setVoiceError(null);
		setPrompt(promptText);
	};

	const documentContextCharLength =
		contextScope === 'document'
			? fileManagerDocumentContext
				? (fileManagerDocumentContext.plainText?.length ?? 0)
				: (documentText?.length ?? 0)
			: (selectedText?.length ?? 0);
	const estimatedTokenBudget = Math.ceil(
		(documentContextCharLength + prompt.length) / 4
	);
	const hasReplacePreview = Boolean(selectedText && chat.latestAiText);
	const replaceDiffStats = ((): AIAssistantReplaceDiffStats | null => {
		if (!selectedText || !chat.latestAiText) {
			return null;
		}
		const before = selectedText;
		const after = chat.latestAiText;
		const delta = after.length - before.length;
		const firstMismatchIndex = (() => {
			const limit = Math.min(before.length, after.length);
			for (let i = 0; i < limit; i += 1) {
				if (before[i] !== after[i]) {
					return i;
				}
			}
			return limit;
		})();
		return {
			beforeLength: before.length,
			afterLength: after.length,
			delta,
			beforeSnippet: before.slice(
				Math.max(0, firstMismatchIndex - 24),
				firstMismatchIndex + 56
			),
			afterSnippet: after.slice(
				Math.max(0, firstMismatchIndex - 24),
				firstMismatchIndex + 56
			),
		};
	})();

	const quickActionItems = useMemo(
		(): AIAssistantQuickActionItem[] => [
			{
				action: 'summarize',
				label: t('ai.quickActions.summarize'),
				icon: createElement(DocumentTextIcon, QUICK_ACTION_ICON_PROPS),
			},
			{
				action: 'improve',
				label: t('ai.quickActions.improve'),
				icon: createElement(SparklesIcon, QUICK_ACTION_ICON_PROPS),
			},
			{
				action: 'correct',
				label: t('ai.quickActions.correct'),
				icon: createElement(CheckCircleIcon, QUICK_ACTION_ICON_PROPS),
			},
			{
				action: 'translate',
				label: t('ai.quickActions.translate'),
				icon: createElement(LanguageIcon, QUICK_ACTION_ICON_PROPS),
			},
			{
				action: 'expand',
				label: t('ai.quickActions.expand'),
				icon: createElement(BookOpenIcon, QUICK_ACTION_ICON_PROPS),
			},
			{
				action: 'simplify',
				label: t('ai.quickActions.simplify'),
				icon: createElement(LightBulbIcon, QUICK_ACTION_ICON_PROPS),
			},
		],
		[t]
	);

	return {
		t,
		onClose,
		selectedText,
		fileManagerDocumentContext,
		onClearFileManagerDocumentContext,
		docSidePanelZ,
		aiPanelRootClass,
		aiHeaderStripClass,
		aiFooterStripClass,
		aiComposerTextareaClass,
		prompt,
		setPrompt,
		contextScope,
		setContextScope,
		actionMode,
		setActionMode,
		isStreaming,
		stopStreaming,
		savedPrompts,
		showSavePromptModal,
		setShowSavePromptModal,
		promptName,
		setPromptName,
		savePromptInputRef,
		handleSavePrompt,
		handleSavePromptConfirm,
		handleUsePrompt,
		estimatedTokenBudget,
		hasReplacePreview,
		replaceDiffStats,
		quickActionItems,
		...voice,
		...chat,
		...insertPolicy,
		...suggestions,
	};
}

export type AIAssistantCompose = ReturnType<typeof useAIAssistantCompose>;
