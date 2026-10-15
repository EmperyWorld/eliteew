/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assistant chat column shell: subheader, mobile FAQ chip, scroll viewport, scroll FAB.
 *
 * Invariants:
 * - Message list presentation lives in AssistantChatMessageList + AssistantChatHistorySidebar.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatMessageList.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 */
import { cn } from '@/utils/cn';
import {
	ChatBubbleLeftRightIcon,
	ChevronDownIcon,
	QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import { ASSISTANT_STREAMING_THINKING_CLASS } from '../../utils/assistantUserShellUi';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type {
	AssistantChatMessage,
	AssistantFaqEntry,
} from '../../services/productDesktopApi';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import { MOBILE_EMBEDDED_HANDBOOK_FAQ_CHIP_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { AssistantChatMessageList } from './AssistantChatMessageList';
import {
	ASSISTANT_CHAT_LOCAL_FAQ_COLUMN_CLASS,
	ASSISTANT_CHAT_SCROLL_FADE_BOTTOM_CLASS,
	ASSISTANT_CHAT_SCROLL_FADE_TOP_CLASS,
	ASSISTANT_CHAT_SUBHEADER_CLASS,
	ASSISTANT_CHAT_SUBHEADER_STREAMING_CLASS,
	ASSISTANT_SCROLL_STREAMING_ACTIVE_CLASS,
	ASSISTANT_SCROLL_TO_BOTTOM_BUTTON_CLASS,
	ASSISTANT_SCROLL_TO_BOTTOM_READY_CLASS,
	ASSISTANT_STREAMING_BAR_CLASS,
	ASSISTANT_STREAMING_BAR_INNER_CLASS,
} from './assistantChatPanelStyles';
import { ASSISTANT_FAQ_COUNT_BADGE_CLASS } from './assistantFaqPanelStyles';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';

export type AssistantChatThreadPanelProps = {
	embeddedMobileLayout: boolean;
	localFaqMessagesCount: number;
	onClearLocalFaq: () => void;
	faqMobileOpen: boolean;
	onFaqMobileOpenChange: (open: boolean) => void;
	faqSearchInputRef: RefObject<HTMLInputElement | null>;
	faq: AssistantFaqEntry[];
	faqQueryLoading: boolean;
	faqSearch: string;
	sending: boolean;
	rateLimitSecondsLeft: number;
	streamingBarVisible: boolean;
	chatScrollWrapClass: string;
	chatScrollClass: string;
	chatScrollRef: RefObject<HTMLDivElement | null>;
	bottomRef: RefObject<HTMLDivElement | null>;
	chatScrollFade: { top: boolean; bottom: boolean };
	onChatScroll: () => void;
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
	nearBottom: boolean;
	onScrollToBottom: () => void;
	suggestedFaq: AssistantFaqEntry[];
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
};

export function AssistantChatThreadPanel({
	embeddedMobileLayout,
	localFaqMessagesCount,
	onClearLocalFaq,
	faqMobileOpen,
	onFaqMobileOpenChange,
	faqSearchInputRef,
	faq,
	faqQueryLoading,
	faqSearch,
	sending,
	rateLimitSecondsLeft,
	streamingBarVisible,
	chatScrollWrapClass,
	chatScrollClass,
	chatScrollRef,
	bottomRef,
	chatScrollFade,
	onChatScroll,
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
	nearBottom,
	onScrollToBottom,
	suggestedFaq,
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
	onCopyMessageText,
	onAcknowledgeHelpful,
	onOpenFeedbackForExchange,
	onFocusFaqSearch,
}: AssistantChatThreadPanelProps): React.ReactElement {
	return (
		<div
			className={cn(
				'flex-1 min-h-0 flex flex-col relative',
				localFaqMessagesCount > 0 && ASSISTANT_CHAT_LOCAL_FAQ_COLUMN_CLASS
			)}
			data-assistant-guide="chat-panel"
		>
			{!embeddedMobileLayout ? (
				<div
					className={cn(
						ASSISTANT_CHAT_SUBHEADER_CLASS,
						sending && ASSISTANT_CHAT_SUBHEADER_STREAMING_CLASS
					)}
					data-assistant-guide="chat-subheader"
				>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<ChatBubbleLeftRightIcon
							className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
							aria-hidden
						/>
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.subtitle,
								'text-sm font-semibold tracking-tight text-(--desktop-text-primary)'
							)}
						>
							{t('chatPanelLabel')}
						</span>
						{sending ? (
							<span
								className={ASSISTANT_STREAMING_THINKING_CLASS}
								aria-live="polite"
							>
								{t('streaming')}
							</span>
						) : rateLimitSecondsLeft > 0 ? (
							<span
								className={cn(
									ASSISTANT_STREAMING_THINKING_CLASS,
									'text-(--desktop-text-muted)'
								)}
								aria-live="polite"
							>
								{t('rateLimitWait', { seconds: rateLimitSecondsLeft })}
							</span>
						) : null}
					</div>
					{localFaqMessagesCount > 0 ? (
						<button
							type="button"
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'shrink-0 rounded-full border border-amber-500/35 px-2.5 py-1',
								'text-amber-100/95 hover:bg-amber-500/10',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							data-assistant-guide="local-faq-chip"
							aria-label={t('localFaqChipAria')}
							onClick={onClearLocalFaq}
						>
							{t('localFaqChip', { count: localFaqMessagesCount })}
						</button>
					) : null}
				</div>
			) : null}
			{embeddedMobileLayout &&
			!faqMobileOpen &&
			faq.length > 0 &&
			!faqQueryLoading ? (
				<div
					className="shrink-0 border-b border-(--desktop-border-subtle)/45 px-3 py-2"
					data-assistant-guide="faq-collapsed-chip"
				>
					<AssistantDesktopTooltip
						content={t('faqCollapsedTapHint', { count: faq.length })}
						inlineClassName="w-full"
					>
						<button
							type="button"
							className={cn(MOBILE_EMBEDDED_HANDBOOK_FAQ_CHIP_CLASS, 'group')}
							aria-label={t('faqCollapsedTapHint', { count: faq.length })}
							onClick={() => {
								onFaqMobileOpenChange(true);
								window.requestAnimationFrame(() => {
									faqSearchInputRef.current?.focus();
								});
							}}
						>
							<span className="flex w-full items-center justify-center gap-2">
								<QuestionMarkCircleIcon
									className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
									aria-hidden
								/>
								<span className="min-w-0 truncate">
									{t('faqCollapsedChipLabel', { count: faq.length })}
								</span>
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'shrink-0 rounded-full border px-2 py-0.5 tabular-nums',
										ASSISTANT_FAQ_COUNT_BADGE_CLASS
									)}
									aria-hidden
								>
									{faq.length}
								</span>
								<ChevronDownIcon
									className="h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none"
									aria-hidden
								/>
							</span>
						</button>
					</AssistantDesktopTooltip>
				</div>
			) : null}
			{embeddedMobileLayout && localFaqMessagesCount > 0 ? (
				<div className="flex shrink-0 justify-end border-b border-(--desktop-border-subtle)/45 px-3 py-1.5">
					<button
						type="button"
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'shrink-0 rounded-full border border-amber-500/35 px-2.5 py-1',
							'text-amber-100/95 hover:bg-amber-500/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						data-assistant-guide="local-faq-chip"
						aria-label={t('localFaqChipAria')}
						onClick={onClearLocalFaq}
					>
						{t('localFaqChip', { count: localFaqMessagesCount })}
					</button>
				</div>
			) : null}
			{streamingBarVisible ? (
				<div className={ASSISTANT_STREAMING_BAR_CLASS} aria-hidden>
					<div className={ASSISTANT_STREAMING_BAR_INNER_CLASS} />
				</div>
			) : null}
			<div
				className={chatScrollWrapClass}
				data-assistant-guide="chat-scroll-wrap"
			>
				{!embeddedMobileLayout && chatScrollFade.top ? (
					<div className={ASSISTANT_CHAT_SCROLL_FADE_TOP_CLASS} aria-hidden />
				) : null}
				{!embeddedMobileLayout && chatScrollFade.bottom ? (
					<div
						className={ASSISTANT_CHAT_SCROLL_FADE_BOTTOM_CLASS}
						aria-hidden
					/>
				) : null}
				<div
					ref={chatScrollRef}
					onScroll={onChatScroll}
					className={chatScrollClass}
					data-assistant-guide="chat-messages"
				>
					<AssistantChatMessageList
						bottomRef={bottomRef}
						msgQuery={msgQuery}
						displayMessages={displayMessages}
						olderMessages={olderMessages}
						recentMessages={recentMessages}
						allVisibleMessages={allVisibleMessages}
						messageIndexById={messageIndexById}
						lastPersistedAssistantId={lastPersistedAssistantId}
						streamingRaw={streamingRaw}
						streamingMarkdown={streamingMarkdown}
						pendingUserText={pendingUserText}
						sending={sending}
						suggestedFaq={suggestedFaq}
						faqSearch={faqSearch}
						faqShowFlashId={faqShowFlashId}
						faqInsertFlashId={faqInsertFlashId}
						faqAskFlashId={faqAskFlashId}
						onShowFaqInChat={onShowFaqInChat}
						onInsertFaqQuestion={onInsertFaqQuestion}
						onTryAskFaq={onTryAskFaq}
						language={language}
						t={t}
						helpfulAckMessageId={helpfulAckMessageId}
						copiedMessageFlashId={copiedMessageFlashId}
						faqAskDisabled={faqAskDisabled}
						faqAskDisabledTitle={faqAskDisabledTitle}
						rateLimitSecondsLeft={rateLimitSecondsLeft}
						onCopyMessageText={onCopyMessageText}
						onAcknowledgeHelpful={onAcknowledgeHelpful}
						onOpenFeedbackForExchange={onOpenFeedbackForExchange}
						onFocusFaqSearch={onFocusFaqSearch}
						embeddedMobileLayout={embeddedMobileLayout}
					/>
				</div>
				{!nearBottom &&
				(displayMessages.length > 0 ||
					sending ||
					streamingRaw ||
					pendingUserText) ? (
					<div
						className={cn(
							'pointer-events-none z-3 [&_button]:pointer-events-auto',
							embeddedMobileLayout
								? 'flex shrink-0 justify-center py-1'
								: 'absolute bottom-3 left-1/2 -translate-x-1/2'
						)}
					>
						<AssistantDesktopTooltip content={t('scrollToBottom')}>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className={cn(
									ASSISTANT_SCROLL_TO_BOTTOM_BUTTON_CLASS,
									ASSISTANT_SCROLL_TO_BOTTOM_READY_CLASS,
									sending && ASSISTANT_SCROLL_STREAMING_ACTIVE_CLASS
								)}
								onClick={onScrollToBottom}
								aria-label={t('scrollToBottom')}
							>
								<span className="relative inline-flex">
									<ChevronDownIcon className="h-4 w-4" aria-hidden />
									<span
										className={cn(
											'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
											'bg-[rgb(var(--desktop-accent-rgb)/0.95)] ring-2 ring-(--desktop-surface-app)',
											sending &&
												'motion-safe:animate-pulse motion-reduce:animate-none'
										)}
										aria-hidden
									/>
								</span>
								{!embeddedMobileLayout ? (
									<span className="hidden sm:inline">
										{t('scrollToBottom')}
									</span>
								) : null}
							</DesktopAppButton>
						</AssistantDesktopTooltip>
					</div>
				) : null}
			</div>
		</div>
	);
}
