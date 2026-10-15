/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single FAQ card: expand/read primary, «Show in chat» secondary, overflow for other actions (R03).
 *
 * Invariants:
 * - FAQ answer renders without LLM; actions delegate to parent callbacks.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 */
import { cn } from '@/utils/cn';
import {
	BookOpenIcon,
	ChatBubbleLeftRightIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ClipboardDocumentIcon,
	EllipsisHorizontalIcon,
	PaperAirplaneIcon,
	PencilSquareIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { ProductAssistantMarkdown } from '../ProductAssistantMarkdown';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import { FaqHighlightText } from '../../utils/assistantFaqHighlight';
import {
	faqAnswerMatchesQuery,
	faqAnswerSearchPreview,
} from '../../utils/extractFaqSearchSnippet';
import { useDesktopWindowPortalStackBase } from '../../context/DesktopWindowPortalStackContext';
import { DESKTOP_PORTAL_STACK_BUMP } from '../../constants';
import { getDesktopPortalShellProps } from '../../utils/desktopUi';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';
import {
	ASSISTANT_FAQ_ANSWER_LABEL_CLASS,
	ASSISTANT_FAQ_CARD_ACTIONS_CLASS,
	ASSISTANT_FAQ_CARD_CLASS,
	ASSISTANT_FAQ_CARD_COPY_FLASH_CLASS,
	ASSISTANT_FAQ_CARD_HOVER_READY_CLASS,
	ASSISTANT_FAQ_CARD_OPEN_SUMMARY_CLASS,
	ASSISTANT_FAQ_COPY_BUTTON_CLASS,
	ASSISTANT_FAQ_COPY_READY_CLASS,
	ASSISTANT_FAQ_QUESTION_INSERT_FLASH_CLASS,
	ASSISTANT_FAQ_QUESTION_INSERT_READY_CLASS,
	ASSISTANT_FAQ_SHOW_IN_CHAT_BUTTON_CLASS,
	ASSISTANT_FAQ_SHOW_IN_CHAT_FLASH_CLASS,
	ASSISTANT_FAQ_SHOW_READY_CLASS,
} from './assistantFaqPanelStyles';
import { ASSISTANT_MOBILE_MENU_SURFACE_CLASS } from './assistantHeaderStyles';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export type AssistantFaqCardProps = {
	entry: AssistantFaqEntry;
	faqSearch: string;
	openFaqIds: Set<string>;
	onOpenFaqIdsChange: (
		updater: Set<string> | ((prev: Set<string>) => Set<string>)
	) => void;
	sending: boolean;
	copiedMessageFlashId: string | null;
	faqInsertFlashId: string | null;
	faqShowFlashId: string | null;
	faqAskFlashId: string | null;
	faqAskDisabled: boolean;
	faqAskDisabledTitle: string | undefined;
	onShowFaqInChat: (entry: AssistantFaqEntry) => void;
	onCopyMessageText: (
		text: string,
		opts?: {
			doneKey?: 'copyMessageDone' | 'faqCopyQuestionDone' | 'faqCopyAnswerDone';
			flashId?: string;
		}
	) => void | Promise<void>;
	onInsertFaqQuestion: (question: string, flashId: string) => void;
	onTryAskFaq: (question: string, flashId: string) => void;
	onActionAck?: (messageKey: string) => void;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantFaqCard({
	entry: f,
	faqSearch,
	openFaqIds,
	onOpenFaqIdsChange,
	sending,
	copiedMessageFlashId,
	faqInsertFlashId,
	faqShowFlashId,
	faqAskDisabled,
	onShowFaqInChat,
	onCopyMessageText,
	onInsertFaqQuestion,
	onTryAskFaq,
	onActionAck,
	t,
}: AssistantFaqCardProps): React.ReactElement {
	const [overflowOpen, setOverflowOpen] = React.useState(false);
	const overflowRef = React.useRef<HTMLDivElement | null>(null);
	const overflowBtnRef = React.useRef<HTMLButtonElement | null>(null);
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [menuPos, setMenuPos] = React.useState<{
		top: number;
		left: number;
	} | null>(null);

	React.useEffect(() => {
		if (!overflowOpen) return;
		const onDoc = (event: MouseEvent) => {
			if (overflowRef.current?.contains(event.target as Node)) return;
			setOverflowOpen(false);
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [overflowOpen]);

	React.useEffect(() => {
		if (!overflowOpen || !overflowBtnRef.current) return;
		const rect = overflowBtnRef.current.getBoundingClientRect();
		setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 216) });
	}, [overflowOpen]);

	const showInChat = () => {
		onShowFaqInChat(f);
		onActionAck?.('faqShowInChatDone');
	};

	const insertQuestion = () => {
		onInsertFaqQuestion(f.question, `faq-i-${f.id}`);
		onActionAck?.('faqInsertDone');
		setOverflowOpen(false);
	};

	const askQuestion = () => {
		onTryAskFaq(f.question, `faq-a-${f.id}`);
		onActionAck?.('faqSend');
		setOverflowOpen(false);
	};

	const copyAnswer = () => {
		void onCopyMessageText(f.answer, {
			doneKey: 'faqCopyAnswerDone',
			flashId: `faq-a-${f.id}`,
		});
		setOverflowOpen(false);
	};

	const copyQuestion = () => {
		void onCopyMessageText(f.question, {
			doneKey: 'faqCopyQuestionDone',
			flashId: `faq-q-${f.id}`,
		});
		setOverflowOpen(false);
	};

	const overflowItems = [
		{
			key: 'insert',
			label: t('faqInsert'),
			icon: PencilSquareIcon,
			onClick: insertQuestion,
			disabled: sending,
		},
		{
			key: 'ask',
			label: t('faqSend'),
			icon: PaperAirplaneIcon,
			onClick: askQuestion,
			disabled: faqAskDisabled,
		},
		{
			key: 'copyQ',
			label: t('faqCopyQuestion'),
			icon: ClipboardDocumentIcon,
			onClick: copyQuestion,
			disabled: sending,
		},
		{
			key: 'copyA',
			label: t('faqCopyAnswer'),
			icon: ClipboardDocumentIcon,
			onClick: copyAnswer,
			disabled: sending,
		},
	];

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	const overflowMenu =
		overflowOpen && menuPos && typeof document !== 'undefined' ? (
			<ShellPortalMount>
				<div
					style={portalShellStyle}
					className={portalTheme === 'dark' ? 'dark' : ''}
				>
					<div ref={overflowRef}>
						<DesktopAppMenuSurface
							role="menu"
							className={cn(
								'fixed min-w-54 py-1 shadow-lg',
								ASSISTANT_MOBILE_MENU_SURFACE_CLASS
							)}
							style={{
								top: menuPos.top,
								left: menuPos.left,
								zIndex:
									portalStackBase +
									DESKTOP_PORTAL_STACK_BUMP.NOTIFICATION_HUB_ITEM_MENU,
							}}
						>
							{overflowItems.map((item) => {
								const Icon = item.icon;
								return (
									<button
										key={item.key}
										type="button"
										role="menuitem"
										disabled={item.disabled}
										className={cn(
											'flex w-full items-center gap-2 px-3 py-2 text-left',
											DESKTOP_TYPOGRAPHY.shellCopy13,
											'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)',
											'disabled:cursor-not-allowed disabled:opacity-45',
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
										onClick={item.onClick}
									>
										<Icon className="h-4 w-4 shrink-0" aria-hidden />
										{item.label}
									</button>
								);
							})}
						</DesktopAppMenuSurface>
					</div>
				</div>
			</ShellPortalMount>
		) : null;

	return (
		<li
			className={cn(
				'group/faq-card flex flex-col gap-1.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
				'bg-(--desktop-surface-soft)/80 p-2',
				ASSISTANT_FAQ_CARD_CLASS,
				ASSISTANT_FAQ_CARD_HOVER_READY_CLASS,
				'transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none',
				'hover:border-(--desktop-border-strong)/35 hover:shadow-sm',
				'has-[details[open]]:border-[rgb(var(--desktop-accent-rgb)/0.32)]',
				'has-[details[open]]:shadow-md',
				faqSearch.trim() && 'border-[rgb(var(--desktop-accent-rgb)/0.22)]',
				(copiedMessageFlashId === `faq-a-${f.id}` ||
					copiedMessageFlashId === `faq-q-${f.id}`) &&
					ASSISTANT_FAQ_CARD_COPY_FLASH_CLASS
			)}
		>
			<details
				className="group"
				open={faqSearch.trim() ? openFaqIds.has(f.id) : undefined}
				onToggle={(e) => {
					const open = e.currentTarget.open;
					onOpenFaqIdsChange((prev) => {
						const next = new Set(prev);
						if (open) next.add(f.id);
						else next.delete(f.id);
						return next;
					});
				}}
			>
				<summary
					className={cn(
						'cursor-pointer list-none text-left rounded-lg px-1 py-0.5',
						DESKTOP_TYPOGRAPHY.body,
						'leading-snug sm:leading-snug',
						DESKTOP_TYPOGRAPHY.shellCopy15Sm,
						'font-semibold text-(--desktop-text-primary)',
						'hover:bg-(--desktop-surface-soft-hover) transition-colors duration-200',
						'[&::-webkit-details-marker]:hidden flex items-start gap-2',
						ASSISTANT_FAQ_CARD_OPEN_SUMMARY_CLASS,
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
				>
					<ChevronDownIcon
						className="mt-1 h-4 w-4 shrink-0 text-(--desktop-accent) transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
					<DesktopChromeTooltip
						content={t('faqInsert')}
						placement="top"
						offsetExtra={4}
					>
						<button
							type="button"
							className={cn(
								'min-w-0 flex-1 cursor-pointer rounded-sm text-left',
								'font-semibold text-(--desktop-text-primary)',
								'hover:underline hover:decoration-[rgb(var(--desktop-accent-rgb)/0.55)]',
								faqInsertFlashId !== `faq-i-${f.id}` &&
									ASSISTANT_FAQ_QUESTION_INSERT_READY_CLASS,
								faqInsertFlashId === `faq-i-${f.id}` &&
									ASSISTANT_FAQ_QUESTION_INSERT_FLASH_CLASS,
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								insertQuestion();
							}}
						>
							<FaqHighlightText text={f.question} query={faqSearch} />
						</button>
					</DesktopChromeTooltip>
				</summary>
				{faqSearch.trim() && faqAnswerMatchesQuery(f.answer, faqSearch) ? (
					<p
						className={cn(
							'group-open:hidden mt-1 pl-6 leading-relaxed',
							DESKTOP_TYPOGRAPHY.meta,
							'text-(--desktop-text-dim)'
						)}
					>
						<FaqHighlightText
							text={faqAnswerSearchPreview(f.answer, faqSearch)}
							query={faqSearch}
						/>
					</p>
				) : null}
				<div
					className={cn(
						'mt-2 pl-6 border-l-2 border-[rgb(var(--desktop-accent-rgb)/0.35)]',
						'text-(--desktop-text-secondary)'
					)}
				>
					<p className={ASSISTANT_FAQ_ANSWER_LABEL_CLASS}>
						<BookOpenIcon className="h-3 w-3 shrink-0 opacity-85" aria-hidden />
						{t('faqAnswerLabel')}
					</p>
					<ProductAssistantMarkdown
						content={f.answer}
						searchHighlightQuery={faqSearch}
					/>
				</div>
			</details>
			<div className={ASSISTANT_FAQ_CARD_ACTIONS_CLASS}>
				<AssistantDesktopTooltip
					content={
						faqShowFlashId === `faq-s-${f.id}`
							? t('faqShowInChatDone')
							: t('faqShowInChat')
					}
				>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						className={cn(
							ASSISTANT_FAQ_SHOW_IN_CHAT_BUTTON_CLASS,
							'gap-1.5 shadow-sm ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.22)]',
							!sending &&
								faqShowFlashId !== `faq-s-${f.id}` &&
								ASSISTANT_FAQ_SHOW_READY_CLASS,
							faqShowFlashId === `faq-s-${f.id}` &&
								ASSISTANT_FAQ_SHOW_IN_CHAT_FLASH_CLASS
						)}
						disabled={sending || faqShowFlashId === `faq-s-${f.id}`}
						onClick={showInChat}
					>
						{faqShowFlashId === `faq-s-${f.id}` ? (
							<CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
						) : (
							<ChatBubbleLeftRightIcon
								className="h-4 w-4 shrink-0"
								aria-hidden
							/>
						)}
						<span>
							{faqShowFlashId === `faq-s-${f.id}`
								? t('faqShowInChatDone')
								: t('faqShowInChat')}
						</span>
					</DesktopAppButton>
				</AssistantDesktopTooltip>
				<div className="relative ml-auto">
					<AssistantDesktopTooltip content={t('faqMoreActions')}>
						<DesktopAppButton
							ref={overflowBtnRef}
							type="button"
							variant="ghost"
							size="sm"
							className={cn(
								ASSISTANT_FAQ_COPY_BUTTON_CLASS,
								!sending && ASSISTANT_FAQ_COPY_READY_CLASS
							)}
							aria-expanded={overflowOpen}
							aria-haspopup="menu"
							aria-label={t('faqMoreActions')}
							onClick={() => setOverflowOpen((open) => !open)}
						>
							<EllipsisHorizontalIcon
								className="h-4 w-4 shrink-0"
								aria-hidden
							/>
						</DesktopAppButton>
					</AssistantDesktopTooltip>
					{overflowMenu}
				</div>
			</div>
		</li>
	);
}
