/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AI assistant side panel shell; delegates state to aiAssistant/* hooks and UI modules.
 *
 * Invariants:
 * - Stream chat, voice, pre-insert guard, suggestions, recovery, FM context preserved via compose.
 * - Named export `AIAssistantPanel` for lazy import from UltimateDocEditorMainGrid.
 *
 * Related:
 * - ../AIAssistantPanel.tsx (facade re-export)
 * - useAIAssistantCompose.ts
 */

import * as React from 'react';
import { motion } from 'framer-motion';

import { AIAssistantChatRegion } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantChatRegion';
import { AIAssistantComposer } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantComposer';
import { AIAssistantContextBanners } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantContextBanners';
import { AIAssistantHeader } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantHeader';
import { AIAssistantSavedPrompts } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantSavedPrompts';
import { AIAssistantSavePromptModal } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantSavePromptModal';
import { AIAssistantToolbar } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantToolbar';
import type { AIAssistantPanelProps } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import { useAIAssistantCompose } from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantCompose';

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = (props) => {
	const { isOpen } = props;
	const c = useAIAssistantCompose(props);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-assistant-panel-title"
			initial={{ opacity: 0, x: 460, scale: 0.985 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 460, scale: 0.985 }}
			transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
			className={c.aiPanelRootClass}
			style={{ zIndex: c.docSidePanelZ }}
		>
			<AIAssistantHeader
				t={c.t}
				headerStripClass={c.aiHeaderStripClass}
				onClose={c.onClose}
			/>

			<AIAssistantContextBanners
				t={c.t}
				fileManagerDocumentContext={c.fileManagerDocumentContext}
				onClearFileManagerDocumentContext={c.onClearFileManagerDocumentContext}
				recoveryDraft={c.recoveryDraft}
				onRestoreDraft={c.handleRestoreDocAiDraft}
				onDismissRecovery={c.handleDismissDocAiRecovery}
			/>

			<AIAssistantToolbar
				t={c.t}
				headerStripClass={c.aiHeaderStripClass}
				selectedText={c.selectedText}
				quickActionItems={c.quickActionItems}
				onQuickAction={(action) => void c.handleQuickAction(action)}
				contextScope={c.contextScope}
				setContextScope={c.setContextScope}
				actionMode={c.actionMode}
				setActionMode={c.setActionMode}
				estimatedTokenBudget={c.estimatedTokenBudget}
			/>

			<AIAssistantChatRegion
				t={c.t}
				streamA11yMessage={c.streamA11yMessage}
				hasReplacePreview={c.hasReplacePreview}
				replaceDiffStats={c.replaceDiffStats}
				latestAiText={c.latestAiText}
				chatHistory={c.chatHistory}
				streamingText={c.streamingText}
				selectedText={c.selectedText}
				actionMode={c.actionMode}
				contextScope={c.contextScope}
				suggestions={c.suggestions}
				chatEndRef={c.chatEndRef}
				onInsert={(text) => void c.handleInsert(text)}
				onReplace={(text) => void c.handleReplace(text)}
				onQueueSuggestion={c.queueSuggestion}
				onAcceptSuggestion={(id, text) =>
					void c.handleAcceptSuggestion(id, text)
				}
				onRejectSuggestion={c.handleRejectSuggestion}
			/>

			<AIAssistantSavedPrompts
				t={c.t}
				footerStripClass={c.aiFooterStripClass}
				savedPrompts={c.savedPrompts}
				onUsePrompt={c.handleUsePrompt}
			/>

			<AIAssistantComposer
				t={c.t}
				footerStripClass={c.aiFooterStripClass}
				composerTextareaClass={c.aiComposerTextareaClass}
				prompt={c.prompt}
				setPrompt={c.setPrompt}
				setVoiceError={c.setVoiceError}
				isStreaming={c.isStreaming}
				isTranscribing={c.isTranscribing}
				isRecording={c.isRecording}
				voiceBusy={c.voiceBusy}
				voiceStatusText={c.voiceStatusText}
				voiceStatusTone={c.voiceStatusTone}
				voiceMeterRef={c.voiceMeterRef}
				selectedText={c.selectedText}
				actionMode={c.actionMode}
				contextScope={c.contextScope}
				latestAiMeta={c.latestAiMeta}
				onSubmit={() => void c.handleSubmit()}
				onStopStreaming={c.stopStreaming}
				onVoiceToggle={() => void c.handleVoiceToggle()}
				onSavePrompt={() => void c.handleSavePrompt()}
			/>

			<AIAssistantSavePromptModal
				t={c.t}
				isOpen={c.showSavePromptModal}
				promptName={c.promptName}
				setPromptName={c.setPromptName}
				inputRef={c.savePromptInputRef}
				onClose={() => {
					c.setShowSavePromptModal(false);
					c.setPromptName('');
				}}
				onConfirm={() => void c.handleSavePromptConfirm()}
			/>
		</motion.div>
	);
};
