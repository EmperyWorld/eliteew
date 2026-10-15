/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scrollable chat region: replace preview, messages, streaming bubble, a11y live region.
 *
 * Related:
 * - AIAssistantSuggestionsList.tsx, useAIAssistantChat.ts
 */

import { lazy, Suspense, type RefObject } from 'react';
import { motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	AIAssistantActionMode,
	AIAssistantChatMessage,
	AIAssistantContextScope,
	AIAssistantReplaceDiffStats,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import { AIAssistantSuggestionsList } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantSuggestionsList';
import type { AIAssistantSuggestion } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import {
	DOC_EDITOR_AI_CHAT_SCROLL_CLASS,
	DOC_EDITOR_AI_EMPTY_ICON_CLASS,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantPanelChrome';
const LazyAssistantMessageRenderer = lazy(async () => {
	const m = await import('@/components/assistantMessage');
	return { default: m.AssistantMessageRenderer };
});

type AIAssistantChatRegionProps = {
	t: TFunction<'docEditorPanels'>;
	streamA11yMessage: string;
	hasReplacePreview: boolean;
	replaceDiffStats: AIAssistantReplaceDiffStats | null;
	latestAiText: string;
	chatHistory: AIAssistantChatMessage[];
	streamingText: string;
	selectedText?: string;
	actionMode: AIAssistantActionMode;
	contextScope: AIAssistantContextScope;
	suggestions: AIAssistantSuggestion[];
	chatEndRef: RefObject<HTMLDivElement | null>;
	onInsert: (text: string) => void;
	onReplace: (text: string) => void;
	onQueueSuggestion: (text: string) => void;
	onAcceptSuggestion: (id: string, text: string) => void;
	onRejectSuggestion: (id: string) => void;
};

export function AIAssistantChatRegion({
	t,
	streamA11yMessage,
	hasReplacePreview,
	replaceDiffStats,
	latestAiText,
	chatHistory,
	streamingText,
	selectedText,
	actionMode,
	contextScope,
	suggestions,
	chatEndRef,
	onInsert,
	onReplace,
	onQueueSuggestion,
	onAcceptSuggestion,
	onRejectSuggestion,
}: AIAssistantChatRegionProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--desktop-surface-app)">
			<div className={DOC_EDITOR_AI_CHAT_SCROLL_CLASS}>
				<div
					role="status"
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
				>
					{streamA11yMessage}
				</div>
				<div className="flex flex-col gap-4">
					{hasReplacePreview && replaceDiffStats ? (
						<DesktopAppPanel className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
							<p className="text-[11px] font-medium text-(--desktop-text-secondary)">
								{t('ai.diff.previewTitle')}
							</p>
							<p className="mt-1 text-[10px] text-(--desktop-text-dim)">
								{t('ai.diff.stats', {
									before: replaceDiffStats.beforeLength,
									after: replaceDiffStats.afterLength,
									delta: `${replaceDiffStats.delta >= 0 ? '+' : ''}${replaceDiffStats.delta}`,
								})}
							</p>
							<p className="mt-1 line-clamp-2 text-[10px] text-(--desktop-text-dim)">
								{t('ai.diff.before')} {replaceDiffStats.beforeSnippet}
							</p>
							<p className="line-clamp-2 text-[10px] text-(--desktop-text-dim)">
								{t('ai.diff.after')} {replaceDiffStats.afterSnippet}
							</p>
							<div className="mt-2">
								<div className="flex flex-wrap gap-2">
									<DesktopAppButton
										onClick={() => onReplace(latestAiText)}
										variant="accent"
										size="sm"
									>
										{t('ai.diff.replaceStrict')}
									</DesktopAppButton>
									<DesktopAppButton
										onClick={() => onInsert(latestAiText)}
										variant="neutral"
										size="sm"
									>
										{t('ai.diff.insertAsProposal')}
									</DesktopAppButton>
									<DesktopAppButton
										onClick={() => onQueueSuggestion(latestAiText)}
										variant="ghost"
										size="sm"
									>
										{t('ai.diff.addTracked')}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppPanel>
					) : null}
					{chatHistory.length === 0 && !streamingText && (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<SparklesIcon
										width={28}
										height={28}
										className={DOC_EDITOR_AI_EMPTY_ICON_CLASS}
										aria-hidden
									/>
								}
								title={t('ai.emptyChat.title')}
								description={t('ai.emptyChat.description')}
								className="py-6"
							/>
						</DesktopAppPanel>
					)}

					{chatHistory.map((message) => (
						<motion.div
							key={message.id}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.15 }}
							className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
						>
							<div
								className={`
                max-w-[min(90%,20rem)] rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed
                ${
									message.role === 'user'
										? 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
								}
              `}
							>
								{message.role === 'ai' ? (
									<Suspense
										fallback={
											<div className="text-sm text-(--desktop-text-dim)">…</div>
										}
									>
										<LazyAssistantMessageRenderer
											content={message.text}
											className="[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1"
										/>
									</Suspense>
								) : (
									<div className="whitespace-pre-wrap">{message.text}</div>
								)}
								{message.role === 'ai' && message.meta ? (
									<div className="mt-2 border-t border-(--desktop-border-subtle) pt-2 text-[10px] text-(--desktop-text-dim)">
										{t('ai.message.metaLine', {
											model: message.meta.model ?? 'auto',
											action: t(
												`ai.actionShort.${message.meta.actionMode ?? actionMode}`
											),
											context: t(
												`ai.scopeShort.${message.meta.contextScope ?? contextScope}`
											),
										})}
									</div>
								) : null}
								{message.role === 'ai' && (
									<div className="mt-2.5 flex flex-wrap gap-2 border-t border-(--desktop-border-subtle) pt-2.5">
										<DesktopAppButton
											onClick={() => onInsert(message.text)}
											variant="accent"
											size="sm"
											className="text-[11px]"
										>
											{t('ai.message.insert')}
										</DesktopAppButton>
										{selectedText && (
											<DesktopAppButton
												onClick={() => onReplace(message.text)}
												variant="neutral"
												size="sm"
												className="text-[11px]"
											>
												{t('ai.message.replace')}
											</DesktopAppButton>
										)}
										<DesktopAppButton
											onClick={() => onQueueSuggestion(message.text)}
											variant="ghost"
											size="sm"
											className="text-[11px]"
										>
											{t('ai.message.toSuggestions')}
										</DesktopAppButton>
									</div>
								)}
							</div>
						</motion.div>
					))}

					<AIAssistantSuggestionsList
						t={t}
						suggestions={suggestions}
						onAccept={onAcceptSuggestion}
						onReject={onRejectSuggestion}
					/>

					{streamingText && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex justify-start"
						>
							<div className="max-w-[min(90%,20rem)] max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3.5 py-2.5 text-(--desktop-text-primary) [-webkit-overflow-scrolling:touch]">
								<div className="text-sm leading-relaxed whitespace-pre-wrap">
									{streamingText}
								</div>
								<div className="mt-1.5 flex items-center gap-1 text-[10px] text-(--desktop-text-dim)">
									<ArrowPathIcon
										width={10}
										height={10}
										className="animate-spin"
									/>
									<span>{t('ai.streaming.label')}</span>
								</div>
							</div>
						</motion.div>
					)}

					<div ref={chatEndRef} className="h-px shrink-0" aria-hidden />
				</div>
			</div>
		</div>
	);
}
