/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single chat message bubble for Desktop Assistant (user, assistant, local FAQ).
 *
 * Invariants:
 * - FAQ-local assistant bubbles keep distinct styling; actions delegate to parent.
 * - Author chips stay sentence-case shell meta (no chrome uppercase shout).
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx
 * - pages/Desktop/utils/assistantUserShellUi.ts
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	CheckCircleIcon,
	ClipboardDocumentIcon,
	HandThumbUpIcon,
	PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import {
	ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS,
	ASSISTANT_FAQ_HINT_BUBBLE_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_CLASS,
	ASSISTANT_USER_BUBBLE_SHELL_CLASS,
} from '../../utils/assistantUserShellUi';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import { formatAssistantMessageTime } from '../../utils/formatAssistantMessageTime';
import { DesktopAppButton, DesktopAppSurface } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { ProductAssistantMarkdown } from '../ProductAssistantMarkdown';
import {
	ASSISTANT_ASK_AGAIN_BUBBLE_FLASH_CLASS,
	ASSISTANT_ASK_AGAIN_BUTTON_CLASS,
	ASSISTANT_ASK_AGAIN_FLASH_CLASS,
	ASSISTANT_ASK_AGAIN_READY_CLASS,
	ASSISTANT_BUBBLE_HOVER_CLASS,
	ASSISTANT_COPY_MESSAGE_BUTTON_CLASS,
	ASSISTANT_COPY_MESSAGE_READY_CLASS,
	ASSISTANT_FEEDBACK_NEGATIVE_BUTTON_CLASS,
	ASSISTANT_FEEDBACK_NEGATIVE_ICON_CLASS,
	ASSISTANT_HELPFUL_ACK_BUBBLE_CLASS,
	ASSISTANT_HELPFUL_ACK_BUTTON_CLASS,
	ASSISTANT_HELPFUL_READY_CLASS,
	ASSISTANT_MESSAGE_ACTIONS_CLASS,
	ASSISTANT_MESSAGE_ACTIONS_HELPFUL_CLASS,
	ASSISTANT_MESSAGE_COMPACT_TOP_CLASS,
	ASSISTANT_MESSAGE_TIME_CLASS,
} from './assistantChatPanelStyles';
import { ASSISTANT_COPY_FLASH_SUCCESS_CLASS } from './assistantFaqPanelStyles';
import {
	ASSISTANT_FAQ_ASK_FLASH_CLASS,
	ASSISTANT_FAQ_ASK_READY_CLASS,
} from './assistantFaqPanelStyles';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';

export type AssistantChatMessageBubbleProps = {
	message: AssistantChatMessage;
	userQuestionForFeedback?: string;
	canAskAgain?: boolean;
	compactTop?: boolean;
	/** Wide WebView `#/mobile-handbook` — keep icon-only action buttons. */
	embeddedMobileLayout?: boolean;
	language: string;
	t: TFunction<'desktopUi', 'assistant'>;
	helpfulAckMessageId: string | null;
	copiedMessageFlashId: string | null;
	faqAskFlashId: string | null;
	faqAskDisabled: boolean;
	faqAskDisabledTitle?: string;
	rateLimitSecondsLeft: number;
	sending: boolean;
	onCopyMessageText: (
		text: string,
		opts?: { flashId?: string; doneKey?: string }
	) => void | Promise<void>;
	onAcknowledgeHelpful: (messageId: string) => void;
	onOpenFeedbackForExchange: (
		userQuestion: string,
		assistantAnswer: string
	) => void;
	onTryAskFaq: (question: string, flashId?: string) => void;
};

export function AssistantChatMessageBubble({
	message: m,
	userQuestionForFeedback,
	canAskAgain,
	compactTop,
	embeddedMobileLayout = false,
	language,
	t,
	helpfulAckMessageId,
	copiedMessageFlashId,
	faqAskFlashId,
	faqAskDisabled,
	faqAskDisabledTitle,
	rateLimitSecondsLeft,
	sending,
	onCopyMessageText,
	onAcknowledgeHelpful,
	onOpenFeedbackForExchange,
	onTryAskFaq,
}: AssistantChatMessageBubbleProps): React.ReactElement {
	const isLocalFaqAssistant =
		m.role === 'assistant' && m.id.startsWith('faq-local-a-');
	const helpfulAcked = helpfulAckMessageId === m.id;
	const copyFlashed = copiedMessageFlashId === m.id;
	const timeLabel = formatAssistantMessageTime(m.created_at, language);

	return (
		<div
			className={cn(
				m.role === 'user' ? 'flex justify-end' : 'flex justify-start',
				compactTop && ASSISTANT_MESSAGE_COMPACT_TOP_CLASS
			)}
		>
			<DesktopAppSurface
				variant={m.role === 'user' ? 'panel' : 'inset'}
				padding={m.role === 'user' ? 'sm' : 'md'}
				className={cn(
					'group/bubble max-w-[min(100%,44rem)]',
					m.role === 'user' && ASSISTANT_USER_BUBBLE_SHELL_CLASS,
					m.role !== 'user' &&
						(isLocalFaqAssistant
							? ASSISTANT_FAQ_HINT_BUBBLE_CLASS
							: ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS),
					m.role !== 'user' &&
						'motion-safe:transition-[box-shadow,background-color] motion-safe:duration-200',
					ASSISTANT_BUBBLE_HOVER_CLASS,
					helpfulAcked && ASSISTANT_HELPFUL_ACK_BUBBLE_CLASS,
					faqAskFlashId === `ask-again-${m.id}` &&
						ASSISTANT_ASK_AGAIN_BUBBLE_FLASH_CLASS
				)}
			>
				<div
					className={cn(
						'mb-2 flex items-center gap-2',
						m.role === 'user' ? 'justify-end' : 'justify-start'
					)}
				>
					<span
						className={cn(
							m.role === 'user'
								? ASSISTANT_MESSAGE_AUTHOR_CLASS
								: ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS
						)}
					>
						{m.role === 'user'
							? t('messageRoleYou')
							: isLocalFaqAssistant
								? t('messageRoleFaq')
								: t('messageRoleAssistant')}
					</span>
					{timeLabel ? (
						<time
							dateTime={m.created_at}
							className={ASSISTANT_MESSAGE_TIME_CLASS}
						>
							{timeLabel}
						</time>
					) : null}
				</div>
				{m.role === 'user' ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'whitespace-pre-wrap leading-relaxed text-(--desktop-text-primary)'
						)}
					>
						{m.content}
					</p>
				) : (
					<div className="min-w-0 leading-relaxed">
						<ProductAssistantMarkdown content={m.content} />
					</div>
				)}
				<div
					className={cn(
						ASSISTANT_MESSAGE_ACTIONS_CLASS,
						helpfulAcked && ASSISTANT_MESSAGE_ACTIONS_HELPFUL_CLASS,
						'flex flex-wrap justify-end gap-1.5'
					)}
				>
					<DesktopChromeTooltip
						content={copyFlashed ? t('copyMessageDone') : t('copyMessage')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className={cn(
								'gap-1.5',
								embeddedMobileLayout ? 'px-2' : 'max-sm:px-2',
								DESKTOP_TYPOGRAPHY.body,
								copyFlashed
									? ASSISTANT_COPY_FLASH_SUCCESS_CLASS
									: cn(
											ASSISTANT_COPY_MESSAGE_BUTTON_CLASS,
											ASSISTANT_COPY_MESSAGE_READY_CLASS
										)
							)}
							disabled={copyFlashed}
							onClick={() =>
								void onCopyMessageText(m.content, { flashId: m.id })
							}
						>
							{copyFlashed ? (
								<CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
							) : (
								<ClipboardDocumentIcon
									className="h-4 w-4 shrink-0"
									aria-hidden
								/>
							)}
							{!embeddedMobileLayout ? (
								<span className="hidden sm:inline">
									{copyFlashed ? t('copyMessageDone') : t('copyMessage')}
								</span>
							) : null}
						</DesktopAppButton>
					</DesktopChromeTooltip>
					{m.role === 'assistant' &&
					userQuestionForFeedback &&
					!isLocalFaqAssistant ? (
						<>
							<AssistantDesktopTooltip
								content={
									helpfulAcked ? t('feedbackHelpfulDone') : t('feedbackHelpful')
								}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										'gap-1.5',
										embeddedMobileLayout ? 'px-2' : 'max-sm:px-2',
										DESKTOP_TYPOGRAPHY.body,
										helpfulAcked
											? ASSISTANT_HELPFUL_ACK_BUTTON_CLASS
											: cn(
													'hover:text-emerald-200/95 hover:bg-emerald-500/10',
													ASSISTANT_HELPFUL_READY_CLASS
												)
									)}
									disabled={helpfulAcked}
									onClick={() => onAcknowledgeHelpful(m.id)}
								>
									{helpfulAcked ? (
										<CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
									) : (
										<HandThumbUpIcon className="h-4 w-4 shrink-0" aria-hidden />
									)}
									{!embeddedMobileLayout ? (
										<span className="hidden sm:inline">
											{helpfulAcked
												? t('feedbackHelpfulDone')
												: t('feedbackHelpful')}
										</span>
									) : null}
								</DesktopAppButton>
							</AssistantDesktopTooltip>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									ASSISTANT_FEEDBACK_NEGATIVE_BUTTON_CLASS,
									'gap-1.5',
									embeddedMobileLayout ? 'px-2' : 'max-md:px-2'
								)}
								aria-label={t('feedbackNotHelpful')}
								onClick={() =>
									onOpenFeedbackForExchange(userQuestionForFeedback, m.content)
								}
							>
								<ArrowTopRightOnSquareIcon
									className={cn(
										'h-4 w-4 shrink-0',
										ASSISTANT_FEEDBACK_NEGATIVE_ICON_CLASS
									)}
									aria-hidden
								/>
								{!embeddedMobileLayout ? (
									<span className="hidden md:inline">
										{t('feedbackNotHelpfulLabel')}
									</span>
								) : null}
							</DesktopAppButton>
						</>
					) : null}
					{m.role === 'assistant' &&
					userQuestionForFeedback &&
					isLocalFaqAssistant ? (
						<>
							<AssistantDesktopTooltip
								content={faqAskDisabledTitle ?? t('faqAskModelFromLocal')}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										ASSISTANT_ASK_AGAIN_BUTTON_CLASS,
										!faqAskDisabled && ASSISTANT_FAQ_ASK_READY_CLASS,
										faqAskFlashId === `faq-a-local-${m.id}` &&
											ASSISTANT_FAQ_ASK_FLASH_CLASS
									)}
									disabled={faqAskDisabled}
									onClick={() =>
										onTryAskFaq(userQuestionForFeedback, `faq-a-local-${m.id}`)
									}
								>
									<PaperAirplaneIcon className="h-4 w-4 shrink-0" aria-hidden />
									{t('faqAskModelFromLocal')}
								</DesktopAppButton>
							</AssistantDesktopTooltip>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={ASSISTANT_FEEDBACK_NEGATIVE_BUTTON_CLASS}
								onClick={() =>
									onOpenFeedbackForExchange(userQuestionForFeedback, m.content)
								}
							>
								<ArrowTopRightOnSquareIcon
									className={cn(
										'h-4 w-4 shrink-0',
										ASSISTANT_FEEDBACK_NEGATIVE_ICON_CLASS
									)}
									aria-hidden
								/>
								{t('feedbackNotHelpfulFaq')}
							</DesktopAppButton>
						</>
					) : null}
					{canAskAgain && userQuestionForFeedback ? (
						<AssistantDesktopTooltip
							content={
								rateLimitSecondsLeft > 0
									? t('rateLimitWait', { seconds: rateLimitSecondsLeft })
									: faqAskFlashId === `ask-again-${m.id}`
										? t('askAgainDone')
										: t('askAgain')
							}
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									ASSISTANT_ASK_AGAIN_BUTTON_CLASS,
									!sending &&
										rateLimitSecondsLeft === 0 &&
										ASSISTANT_ASK_AGAIN_READY_CLASS,
									faqAskFlashId === `ask-again-${m.id}` &&
										ASSISTANT_ASK_AGAIN_FLASH_CLASS
								)}
								disabled={sending || rateLimitSecondsLeft > 0}
								onClick={() =>
									onTryAskFaq(userQuestionForFeedback, `ask-again-${m.id}`)
								}
							>
								{faqAskFlashId === `ask-again-${m.id}` ? (
									<ArrowPathIcon
										className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
										aria-hidden
									/>
								) : (
									<ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden />
								)}
								{faqAskFlashId === `ask-again-${m.id}`
									? t('askAgainDone')
									: t('askAgain')}
							</DesktopAppButton>
						</AssistantDesktopTooltip>
					) : null}
				</div>
			</DesktopAppSurface>
		</div>
	);
}
