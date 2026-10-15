/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Message list presentation: loading skeleton, history error, empty state, bubbles, streaming.
 *
 * Invariants:
 * - User-facing errors use i18n keys historyError / historyRetry / toastError via parent t().
 * - Recent bubble wrappers use content-visibility for off-screen paint skip.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatHistorySidebar.tsx
 * - pages/Desktop/components/assistant/AssistantChatMessageBubble.tsx
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ChatBubbleLeftRightIcon,
	QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import {
	ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_CLASS,
	ASSISTANT_STREAMING_THINKING_CLASS,
	ASSISTANT_USER_BUBBLE_SHELL_CLASS,
} from '../../utils/assistantUserShellUi';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type {
	AssistantChatMessage,
	AssistantFaqEntry,
} from '../../services/productDesktopApi';
import { requestOpenDesktopApp } from '../../utils/desktopDeepLink';
import { FaqHighlightText } from '../../utils/assistantFaqHighlight';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSurface,
} from '../DesktopAppChrome';
import { ProductAssistantMarkdown } from '../ProductAssistantMarkdown';
import { AssistantChatHistorySidebar } from './AssistantChatHistorySidebar';
import { AssistantChatMessageBubble } from './AssistantChatMessageBubble';
import {
	ASSISTANT_EMPTY_CHAT_FRAME_CLASS,
	ASSISTANT_EMPTY_FEEDBACK_FOOTER_CLASS,
	ASSISTANT_EMPTY_FEEDBACK_HINT_CLASS,
	ASSISTANT_EMPTY_ICON_PULSE_CLASS,
	ASSISTANT_EMPTY_SUGGESTIONS_WRAP_CLASS,
	ASSISTANT_HISTORY_SKELETON_BUBBLE_CLASS,
	ASSISTANT_OPEN_FEEDBACK_READY_CLASS,
	ASSISTANT_OPEN_FEEDBACK_SECONDARY_CLASS,
	ASSISTANT_PENDING_USER_BUBBLE_CLASS,
	ASSISTANT_STREAMING_BUBBLE_SHIMMER_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CAPTION_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_ASK_FLASH_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_FLASH_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_HINT_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_INSERT_FLASH_CLASS,
	ASSISTANT_SUGGESTED_FAQ_CHIP_READY_CLASS,
} from './assistantChatPanelStyles';
import {
	ASSISTANT_ERROR_RETRY_BUTTON_CLASS,
	ASSISTANT_ERROR_RETRY_READY_CLASS,
	ASSISTANT_ERROR_STATE_FRAME_CLASS,
	ASSISTANT_ERROR_STATE_ICON_WRAP_CLASS,
} from './assistantFaqPanelStyles';
import { findUserQuestionBeforeAssistant } from './splitAssistantDisplayMessages';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';

export type AssistantChatMessageListProps = {
	bottomRef: RefObject<HTMLDivElement | null>;
	msgQuery: Pick<
		UseQueryResult<AssistantChatMessage[]>,
		'isLoading' | 'isError' | 'isFetching' | 'refetch'
	>;
	displayMessages: AssistantChatMessage[];
	olderMessages: AssistantChatMessage[];
	recentMessages: AssistantChatMessage[];
	allVisibleMessages: AssistantChatMessage[];
	messageIndexById: Map<string, number>;
	lastPersistedAssistantId: string | null;
	streamingRaw: string;
	streamingMarkdown: string;
	pendingUserText: string | null;
	sending: boolean;
	suggestedFaq: AssistantFaqEntry[];
	faqSearch: string;
	faqShowFlashId: string | null;
	faqInsertFlashId: string | null;
	faqAskFlashId: string | null;
	onShowFaqInChat: (entry: AssistantFaqEntry) => void;
	onInsertFaqQuestion: (question: string, flashId?: string) => void;
	onTryAskFaq: (question: string, flashId?: string) => void;
	language: string;
	t: TFunction<'desktopUi', 'assistant'>;
	helpfulAckMessageId: string | null;
	copiedMessageFlashId: string | null;
	faqAskDisabled: boolean;
	faqAskDisabledTitle?: string;
	rateLimitSecondsLeft: number;
	onCopyMessageText: (
		text: string,
		opts?: { flashId?: string; doneKey?: string }
	) => void | Promise<void>;
	onAcknowledgeHelpful: (messageId: string) => void;
	onOpenFeedbackForExchange: (
		userQuestion: string,
		assistantAnswer: string
	) => void;
	onFocusFaqSearch?: () => void;
	embeddedMobileLayout?: boolean;
};

export function AssistantChatMessageList({
	bottomRef,
	msgQuery,
	displayMessages,
	olderMessages,
	recentMessages,
	allVisibleMessages,
	messageIndexById,
	lastPersistedAssistantId,
	streamingRaw,
	streamingMarkdown,
	pendingUserText,
	sending,
	suggestedFaq,
	faqSearch,
	faqShowFlashId,
	faqInsertFlashId,
	faqAskFlashId,
	onShowFaqInChat,
	onInsertFaqQuestion,
	onTryAskFaq,
	language,
	t,
	helpfulAckMessageId,
	copiedMessageFlashId,
	faqAskDisabled,
	faqAskDisabledTitle,
	rateLimitSecondsLeft,
	onCopyMessageText,
	onAcknowledgeHelpful,
	onOpenFeedbackForExchange,
	onFocusFaqSearch,
	embeddedMobileLayout = false,
}: AssistantChatMessageListProps): React.ReactElement {
	const renderBubbleWithContext = (
		m: AssistantChatMessage,
		opts?: { compactTop?: boolean }
	) => {
		const idx = messageIndexById.get(m.id) ?? -1;
		const userQ =
			m.role === 'assistant' && idx >= 0
				? findUserQuestionBeforeAssistant(idx, allVisibleMessages)
				: undefined;
		const canAskAgain =
			m.role === 'assistant' &&
			m.id === lastPersistedAssistantId &&
			!streamingRaw &&
			!sending &&
			!m.id.startsWith('faq-local-');
		const compactTop =
			opts?.compactTop ??
			(m.role === 'assistant' &&
				idx > 0 &&
				allVisibleMessages[idx - 1]?.role === 'user');

		return (
			<AssistantChatMessageBubble
				key={m.id}
				message={m}
				userQuestionForFeedback={userQ}
				canAskAgain={canAskAgain}
				compactTop={compactTop}
				embeddedMobileLayout={embeddedMobileLayout}
				language={language}
				t={t}
				helpfulAckMessageId={helpfulAckMessageId}
				copiedMessageFlashId={copiedMessageFlashId}
				faqAskFlashId={faqAskFlashId}
				faqAskDisabled={faqAskDisabled}
				faqAskDisabledTitle={faqAskDisabledTitle}
				rateLimitSecondsLeft={rateLimitSecondsLeft}
				sending={sending}
				onCopyMessageText={onCopyMessageText}
				onAcknowledgeHelpful={onAcknowledgeHelpful}
				onOpenFeedbackForExchange={onOpenFeedbackForExchange}
				onTryAskFaq={onTryAskFaq}
			/>
		);
	};

	return (
		<>
			{msgQuery.isLoading ? (
				<div
					className="space-y-4 py-4 motion-safe:animate-pulse motion-reduce:animate-none"
					aria-busy="true"
					aria-live="polite"
				>
					<div className="flex justify-end">
						<div
							className={cn(
								'h-14 w-[min(100%,16rem)] rounded-lg border border-(--desktop-border-subtle)/40',
								'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_65%,transparent)]',
								ASSISTANT_HISTORY_SKELETON_BUBBLE_CLASS
							)}
						/>
					</div>
					<div className="flex justify-start">
						<div
							className={cn(
								'h-24 w-[min(100%,22rem)] rounded-lg border border-(--desktop-border-subtle)/40',
								'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
								ASSISTANT_HISTORY_SKELETON_BUBBLE_CLASS
							)}
						/>
					</div>
					<div className="flex justify-end">
						<div
							className={cn(
								'h-11 w-[min(100%,12rem)] rounded-lg border border-(--desktop-border-subtle)/40',
								'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_60%,transparent)]',
								ASSISTANT_HISTORY_SKELETON_BUBBLE_CLASS
							)}
						/>
					</div>
					<span className="sr-only">{t('historyLoading')}</span>
				</div>
			) : null}
			{msgQuery.isError ? (
				<div
					className={cn(
						ASSISTANT_ERROR_STATE_FRAME_CLASS,
						'flex flex-col items-center gap-3 py-8 text-center'
					)}
					role="alert"
				>
					<div className={ASSISTANT_ERROR_STATE_ICON_WRAP_CLASS}>
						<ArrowPathIcon className="h-5 w-5 text-rose-300/90" aria-hidden />
					</div>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'font-medium text-(--desktop-text-primary)'
						)}
					>
						{t('historyError')}
					</p>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className={cn(
							ASSISTANT_ERROR_RETRY_BUTTON_CLASS,
							!msgQuery.isFetching && ASSISTANT_ERROR_RETRY_READY_CLASS
						)}
						disabled={msgQuery.isFetching}
						onClick={() => void msgQuery.refetch()}
					>
						<ArrowPathIcon
							className={cn(
								'h-4 w-4 shrink-0',
								msgQuery.isFetching && 'animate-spin'
							)}
							aria-hidden
						/>
						{t('historyRetry')}
					</DesktopAppButton>
				</div>
			) : null}
			{!msgQuery.isLoading &&
			displayMessages.length === 0 &&
			!streamingRaw &&
			!pendingUserText &&
			!msgQuery.isFetching ? (
				<div className={ASSISTANT_EMPTY_CHAT_FRAME_CLASS}>
					<DesktopAppEmptyState
						icon={
							<span className={ASSISTANT_EMPTY_ICON_PULSE_CLASS}>
								<ChatBubbleLeftRightIcon
									className="h-8 w-8 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
									aria-hidden
								/>
							</span>
						}
						title={t('emptyTitle')}
						description={t('emptyDesc')}
					/>
					{suggestedFaq.length > 0 ? (
						<div className={ASSISTANT_EMPTY_SUGGESTIONS_WRAP_CLASS}>
							<p className={ASSISTANT_SUGGESTED_FAQ_CAPTION_CLASS}>
								<QuestionMarkCircleIcon
									className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
									aria-hidden
								/>
								<span>{t('suggestedFaqCaption')}</span>
							</p>
							<div className="flex flex-wrap gap-2">
								{suggestedFaq.map((f, chipIndex) => (
									<AssistantDesktopTooltip
										key={f.id}
										content={t('suggestedFaqChipTitle')}
										inlineClassName="max-w-full"
									>
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											className={cn(
												ASSISTANT_SUGGESTED_FAQ_CHIP_CLASS,
												ASSISTANT_SUGGESTED_FAQ_CHIP_READY_CLASS,
												faqShowFlashId === `faq-s-${f.id}` &&
													ASSISTANT_SUGGESTED_FAQ_CHIP_FLASH_CLASS,
												faqInsertFlashId === `faq-i-chip-${f.id}` &&
													ASSISTANT_SUGGESTED_FAQ_CHIP_INSERT_FLASH_CLASS,
												faqAskFlashId === `faq-a-chip-${f.id}` &&
													ASSISTANT_SUGGESTED_FAQ_CHIP_ASK_FLASH_CLASS
											)}
											onClick={(e) => {
												if (!embeddedMobileLayout && e.altKey) {
													onTryAskFaq(f.question, `faq-a-chip-${f.id}`);
													return;
												}
												if (!embeddedMobileLayout && e.shiftKey) {
													onInsertFaqQuestion(f.question, `faq-i-chip-${f.id}`);
													return;
												}
												onShowFaqInChat(f);
											}}
										>
											<ChatBubbleLeftRightIcon
												className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.82)]"
												aria-hidden
											/>
											<span
												className={cn(
													'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
													DESKTOP_TYPOGRAPHY.caption,
													'font-semibold tabular-nums',
													'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,transparent)]',
													'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
												)}
												aria-hidden
											>
												{chipIndex + 1}
											</span>
											<span className="min-w-0">
												{faqSearch.trim() ? (
													<FaqHighlightText
														text={f.question}
														query={faqSearch}
													/>
												) : (
													f.question
												)}
											</span>
										</DesktopAppButton>
									</AssistantDesktopTooltip>
								))}
							</div>
							{!embeddedMobileLayout ? (
								<p className={ASSISTANT_SUGGESTED_FAQ_CHIP_HINT_CLASS}>
									<ChatBubbleLeftRightIcon
										className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
										aria-hidden
									/>
									<span>{t('suggestedFaqChipHint')}</span>
								</p>
							) : null}
						</div>
					) : onFocusFaqSearch ? (
						<div className="px-0.5">
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								className="gap-1.5"
								onClick={onFocusFaqSearch}
							>
								<QuestionMarkCircleIcon
									className="h-4 w-4 shrink-0"
									aria-hidden
								/>
								{t('emptyFaqCta')}
							</DesktopAppButton>
						</div>
					) : (
						<p className={cn(ASSISTANT_SUGGESTED_FAQ_CAPTION_CLASS, 'px-0.5')}>
							<QuestionMarkCircleIcon
								className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
								aria-hidden
							/>
							<span>{t('emptyFaqHint')}</span>
						</p>
					)}
					{!embeddedMobileLayout ? (
						<div className={ASSISTANT_EMPTY_FEEDBACK_FOOTER_CLASS}>
							<p className={ASSISTANT_EMPTY_FEEDBACK_HINT_CLASS}>
								{t('emptyFeedbackHint')}
							</p>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className={cn(
									ASSISTANT_OPEN_FEEDBACK_SECONDARY_CLASS,
									ASSISTANT_OPEN_FEEDBACK_READY_CLASS
								)}
								aria-label={t('openFeedbackEmptyAria')}
								onClick={() =>
									requestOpenDesktopApp({
										appComponent: 'FeedbackHubApp',
										feedbackQuickMode: 'text',
									})
								}
							>
								<ArrowTopRightOnSquareIcon
									className="h-3.5 w-3.5 shrink-0 opacity-70"
									aria-hidden
								/>
								{t('openFeedbackEmpty')}
							</DesktopAppButton>
						</div>
					) : null}
				</div>
			) : null}
			<AssistantChatHistorySidebar
				olderMessages={olderMessages}
				t={t}
				renderMessage={(m) => renderBubbleWithContext(m)}
			/>
			{recentMessages.map((m) => (
				<div
					key={m.id}
					className="[content-visibility:auto] [contain-intrinsic-size:auto_120px]"
				>
					{renderBubbleWithContext(m)}
				</div>
			))}
			{pendingUserText ? (
				<div className="flex justify-end" aria-live="polite">
					<DesktopAppSurface
						variant="panel"
						padding="md"
						className={cn(
							'max-w-[min(100%,44rem)] opacity-90',
							ASSISTANT_USER_BUBBLE_SHELL_CLASS,
							ASSISTANT_PENDING_USER_BUBBLE_CLASS
						)}
					>
						<div className="mb-2 flex items-center justify-end gap-2">
							<span className={ASSISTANT_MESSAGE_AUTHOR_CLASS}>
								{t('messageRoleYou')}
							</span>
							<span className={ASSISTANT_STREAMING_THINKING_CLASS}>
								{t('pendingSendingBadge')}
							</span>
						</div>
						<p
							className={`${DESKTOP_TYPOGRAPHY.body} whitespace-pre-wrap text-(--desktop-text-primary)`}
						>
							{pendingUserText}
						</p>
					</DesktopAppSurface>
				</div>
			) : null}
			{sending ? (
				<div className="flex justify-start" aria-live="polite" aria-busy="true">
					<DesktopAppSurface
						variant="inset"
						padding="lg"
						className={cn(
							'max-w-[min(100%,44rem)]',
							ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS,
							ASSISTANT_STREAMING_BUBBLE_SHIMMER_CLASS,
							'motion-safe:transition-[box-shadow,background-color] motion-safe:duration-200'
						)}
					>
						<div className="mb-2">
							<span className={ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS}>
								{t('messageRoleAssistant')}
							</span>
							{!streamingMarkdown ? (
								<p className={cn(ASSISTANT_STREAMING_THINKING_CLASS, 'mt-2')}>
									{t('streaming')}
								</p>
							) : null}
						</div>
						{streamingMarkdown ? (
							<div className="inline">
								<ProductAssistantMarkdown content={streamingMarkdown} />
								<span
									className={cn(
										'ml-0.5 inline-block h-4 w-0.5 align-middle',
										'bg-[rgb(var(--desktop-accent-rgb)/0.9)]',
										'motion-safe:animate-pulse motion-reduce:animate-none'
									)}
									aria-hidden
								/>
							</div>
						) : null}
					</DesktopAppSurface>
				</div>
			) : null}
			<div ref={bottomRef} />
		</>
	);
}
