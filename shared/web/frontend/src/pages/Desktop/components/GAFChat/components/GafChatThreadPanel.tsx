/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat active-thread cluster: status toolbar, in-thread search, E2EE banner,
 * scrollable message log (virtualized), empty-thread state, and scroll-to-bottom FAB.
 *
 * Invariants:
 * - Scroll container owns role="log" and aria-label for the message list.
 * - Empty thread and loading skeletons stay visible without overlapping virtualized rows.
 * - In-thread search input always has `id` + `name` (autofill / a11y scanners).
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/hooks/useGafChatThreadScroll.ts
 * - src/pages/Desktop/components/GAFChat/hooks/useGafChatThreadSearch.ts
 */
import { cn } from '@/utils/cn';
import { enUS, ru } from 'date-fns/locale';
import { memo, useId, useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppToolbar,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { getDesktopShellToolbarClusterInsetControlClassName } from '../../../utils/desktopVisualSystem';
import { GafChatVirtualizedThread } from '../GafChatVirtualizedThread';
import { GafThreadSearchNavIcons } from '../GafThreadSearchNavIcons';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import { groupMessagesByDate } from '../gafChatMessageViewUtils';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import { mapGafChatUserError } from '../gafChatMapUserError';
import type { GAFChatListItem, GAFMessageItem } from '../types';
import { GAFChatE2eeReadinessBanner } from './GAFChatE2eeReadinessBanner';
import { GAFChatErrorBar } from './GAFChatErrorBar';
import { GAFChatMessagesSkeleton } from './GAFChatSkeletons';
import { GafChatThreadSettingsPopover } from './GafChatThreadSettingsPopover';
import {
	ArrowDownIcon,
	ChatBubbleLeftRightIcon,
	LockClosedIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type GafChatThreadPanelProps = {
	shellFrame: Parameters<
		typeof getDesktopShellToolbarClusterInsetControlClassName
	>[0];
	selectedChatId: string;
	partner: GAFChatListItem['partner'] | null | undefined;
	chatMuted: boolean;
	chatBlocked: boolean;
	threadPrefs: GafChatThreadPrefs;
	onThreadPrefsChange: (next: GafChatThreadPrefs) => void;
	showE2eeReadinessBanner: boolean;
	e2eeStatusValue?: 'off' | 'pending' | 'active' | 'declined';
	e2eeActive?: boolean;
	onSetupE2eeKeys: () => void;
	onDismissE2eeReadinessBanner: () => void;
	messageListRef: RefObject<HTMLDivElement | null>;
	loadMoreSentinelRef: RefObject<HTMLDivElement | null>;
	onMessageListScroll: () => void;
	showScrollDown: boolean;
	onScrollToBottom: () => void;
	messagesLoading: boolean;
	messagesError: boolean;
	messagesErrorDismissed: boolean;
	messagesQueryError: unknown;
	onRefetchMessages: () => void;
	onDismissMessagesError: () => void;
	messages: GAFMessageItem[];
	messageById: Map<string, GAFMessageItem>;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	onLoadOlder: () => void;
	myUserId: string | null;
	meLabel: string;
	partnerLastReadIndex: number;
	threadSearchQuery: string;
	onThreadSearchQueryChange: (value: string) => void;
	threadSearchInputRef: RefObject<HTMLInputElement | null>;
	threadSearchTrimmed: string;
	threadMatchIds: string[];
	threadMatchIndex: number;
	onPrevThreadMatch: () => void;
	onNextThreadMatch: () => void;
	scrollToMessageId: string | null;
	onConsumedScrollToMessage: () => void;
	onCopyPlainText: (text: string) => void;
	onAcceptAttachment: (m: GAFMessageItem) => void;
	acceptBusyMessageId: string | null;
	onReply: (m: GAFMessageItem) => void;
	onJumpToMessage: (messageId: string) => void;
	onEditMessage: (m: GAFMessageItem) => void;
	onDeleteMessageForMe: (m: GAFMessageItem) => void;
	onDeleteMessageForEveryone: (m: GAFMessageItem) => void;
};

export const GafChatThreadPanel = memo(function GafChatThreadPanel({
	shellFrame,
	selectedChatId,
	partner,
	chatMuted,
	chatBlocked,
	threadPrefs,
	onThreadPrefsChange,
	showE2eeReadinessBanner,
	e2eeStatusValue,
	e2eeActive = false,
	onSetupE2eeKeys,
	onDismissE2eeReadinessBanner,
	messageListRef,
	loadMoreSentinelRef,
	onMessageListScroll,
	showScrollDown,
	onScrollToBottom,
	messagesLoading,
	messagesError,
	messagesErrorDismissed,
	messagesQueryError,
	onRefetchMessages,
	onDismissMessagesError,
	messages,
	messageById,
	hasNextPage,
	isFetchingNextPage,
	onLoadOlder,
	myUserId,
	meLabel,
	partnerLastReadIndex,
	threadSearchQuery,
	onThreadSearchQueryChange,
	threadSearchInputRef,
	threadSearchTrimmed,
	threadMatchIds,
	threadMatchIndex,
	onPrevThreadMatch,
	onNextThreadMatch,
	scrollToMessageId,
	onConsumedScrollToMessage,
	onCopyPlainText,
	onAcceptAttachment,
	acceptBusyMessageId,
	onReply,
	onJumpToMessage,
	onEditMessage,
	onDeleteMessageForMe,
	onDeleteMessageForEveryone,
}: GafChatThreadPanelProps) {
	const { t, i18n } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const threadSearchFieldId = `${useId().replace(/:/g, '')}-thread-search`;
	const dateLocale = useMemo(
		() => (i18n.language?.startsWith('en') ? enUS : ru),
		[i18n.language]
	);
	const messageGroups = useMemo(
		() => groupMessagesByDate(messages, t, dateLocale),
		[messages, t, dateLocale]
	);
	const messageOrder = useMemo(
		() => new Map(messages.map((message, index) => [message.id, index])),
		[messages]
	);
	const shellThreadSearchBoxClass = useMemo(
		() =>
			cn(
				'flex min-h-9 touch-manipulation items-center gap-1.5 rounded-(--desktop-radius) px-1.5 py-0.5 sm:min-w-[200px]',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
			),
		[shellFrame]
	);
	const shellThreadSearchInputClass = useMemo(
		() =>
			cn(
				DESKTOP_TYPOGRAPHY.body,
				'w-full min-h-8 min-w-0 flex-1 rounded-(--desktop-radius) border border-transparent bg-transparent px-2 py-1.5 text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors duration-200 motion-reduce:transition-none scheme-dark',
				DESKTOP_CHROME_FOCUS_VISIBLE,
				'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)'
			),
		[]
	);

	const emptyThreadCopy = useMemo(() => {
		if (chatBlocked) {
			return {
				title: t('emptyThreadBlockedTitle'),
				description: t('emptyThreadBlockedDescription'),
			};
		}
		if (e2eeStatusValue === 'pending') {
			return {
				title: t('emptyThreadE2eePendingTitle'),
				description: t('emptyThreadE2eePendingDescription'),
			};
		}
		return {
			title: t('emptyThreadTitle'),
			description: t('emptyThreadDescription'),
		};
	}, [chatBlocked, e2eeStatusValue, t]);

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			{partner ? (
				<DesktopAppToolbar className="shrink-0 flex-col flex-wrap items-stretch gap-1.5 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-2.5 py-1.5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
					{chatMuted || partner.is_blocked || partner.blocked_by_partner ? (
						<div
							className="flex flex-wrap gap-1.5"
							role="status"
							aria-label={t('threadStatusChipsAria')}
						>
							{chatMuted ? (
								<DesktopChromeTooltip
									content={t('mutedPill')}
									placement="bottom"
									offsetExtra={4}
								>
									<span
										className={cn(
											'inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/14 px-2.5 py-0.5 font-semibold tracking-wide text-amber-100/95',
											DESKTOP_TYPOGRAPHY.captionInherit
										)}
									>
										{t('mutedPill')}
									</span>
								</DesktopChromeTooltip>
							) : null}
							{partner.is_blocked ? (
								<DesktopChromeTooltip
									content={t('blockedYouPill')}
									placement="bottom"
									offsetExtra={4}
								>
									<span
										className={cn(
											'inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/12 px-2.5 py-0.5 font-semibold tracking-wide text-rose-100',
											DESKTOP_TYPOGRAPHY.captionInherit
										)}
									>
										{t('blockedYouPill')}
									</span>
								</DesktopChromeTooltip>
							) : null}
							{partner.blocked_by_partner ? (
								<DesktopChromeTooltip
									content={t('blockedByPartnerPill')}
									placement="bottom"
									offsetExtra={4}
								>
									<span
										className={cn(
											'inline-flex items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/80 px-2.5 py-0.5 font-semibold tracking-wide text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.captionInherit
										)}
									>
										{t('blockedByPartnerPill')}
									</span>
								</DesktopChromeTooltip>
							) : null}
						</div>
					) : null}
					<div className="flex min-w-0 flex-1 flex-wrap items-start gap-1.5">
						<div className="min-w-0 flex-1">
							<div className="flex w-full min-w-0 flex-col gap-1">
								<DesktopChromeTooltip
									content={t('threadSearchTooltip')}
									placement="bottom"
									offsetExtra={4}
								>
									<div className={shellThreadSearchBoxClass}>
										<MagnifyingGlassIcon
											className="h-4 w-4 shrink-0 text-(--desktop-text-muted)"
											aria-hidden
											strokeWidth={lucideStroke}
										/>
										<input
											id={threadSearchFieldId}
											name="gaf-chat-thread-search"
											ref={threadSearchInputRef}
											type="search"
											enterKeyHint="search"
											placeholder={t('threadSearchPlaceholder')}
											className={shellThreadSearchInputClass}
											aria-label={t('threadSearchAria')}
											autoComplete="off"
											value={threadSearchQuery}
											onChange={(e) =>
												onThreadSearchQueryChange(e.target.value)
											}
											onKeyDown={(e) => {
												if (e.key === 'Escape') {
													onThreadSearchQueryChange('');
													e.currentTarget.blur();
												}
											}}
										/>
										{threadSearchTrimmed ? (
											<>
												{threadMatchIds.length > 1 ? (
													<GafThreadSearchNavIcons
														onPrev={onPrevThreadMatch}
														onNext={onNextThreadMatch}
														prevLabel={t('threadSearchPrevAria')}
														nextLabel={t('threadSearchNextAria')}
													/>
												) : null}
												<GafChatDesktopIconTooltip
													content={t('threadSearchClearTitle')}
												>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														className="h-8 w-8 shrink-0 touch-manipulation"
														aria-label={t('threadSearchClearAria')}
														onClick={() => {
															onThreadSearchQueryChange('');
															threadSearchInputRef.current?.focus();
														}}
													>
														<XMarkIcon
															className="h-4 w-4"
															aria-hidden
															strokeWidth={lucideStroke}
														/>
													</DesktopAppButton>
												</GafChatDesktopIconTooltip>
											</>
										) : null}
									</div>
								</DesktopChromeTooltip>
								{threadSearchTrimmed ? (
									<p
										className={cn(
											'px-0.5 sm:text-right',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
										aria-live="polite"
									>
										{threadMatchIds.length === 0
											? t('threadSearchNoMatches')
											: t('threadSearchMatchPosition', {
													current: threadMatchIndex + 1,
													total: threadMatchIds.length,
												})}
									</p>
								) : null}
							</div>
						</div>
						<GafChatThreadSettingsPopover
							prefs={threadPrefs}
							onChange={onThreadPrefsChange}
							disabled={chatBlocked}
						/>
					</div>
				</DesktopAppToolbar>
			) : null}
			{showE2eeReadinessBanner ? (
				<GAFChatE2eeReadinessBanner
					onSetupKeys={onSetupE2eeKeys}
					onDismiss={onDismissE2eeReadinessBanner}
				/>
			) : null}
			{e2eeActive ? (
				<div
					className="flex shrink-0 items-center gap-1.5 border-b border-[rgb(var(--desktop-accent-rgb)/0.25)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-3 py-1"
					role="status"
				>
					<LockClosedIcon
						className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.captionInherit,
							'font-medium text-[rgb(var(--desktop-fg-primary-rgb)/0.92)]'
						)}
					>
						{t('e2eeStatusActive')}
					</span>
				</div>
			) : null}
			<div
				ref={messageListRef}
				className={cn(
					'relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable',
					'px-2.5 py-3 sm:px-4',
					'bg-transparent'
				)}
				role="log"
				aria-label={t('messagesLogAria')}
				onScroll={onMessageListScroll}
				data-gaf-guide="thread"
			>
				{messagesLoading && <GAFChatMessagesSkeleton />}
				{messagesError && !messagesLoading && !messagesErrorDismissed && (
					<GAFChatErrorBar
						message={mapGafChatUserError(messagesQueryError, t, 'messages')}
						onAction={() => void onRefetchMessages()}
						onDismiss={onDismissMessagesError}
					/>
				)}
				{!messagesLoading && !messagesError && messages.length === 0 && (
					<DesktopAppEmptyState
						className="min-h-[200px] py-8"
						icon={
							<ChatBubbleLeftRightIcon
								className="w-7 h-7 text-[rgb(var(--desktop-accent-rgb)/0.7)]"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						}
						title={
							<span className={cn('block', DESKTOP_TYPOGRAPHY.subtitle)}>
								{emptyThreadCopy.title}
							</span>
						}
						description={
							<span
								className={cn(
									'max-w-sm leading-relaxed',
									DESKTOP_TYPOGRAPHY.bodyMuted
								)}
							>
								{emptyThreadCopy.description}
							</span>
						}
					/>
				)}
				{!messagesLoading && !messagesError && messageGroups.length > 0 && (
					<GafChatVirtualizedThread
						messagesScrollRef={messageListRef}
						loadMoreSentinelRef={loadMoreSentinelRef}
						messageGroups={messageGroups}
						hasNextPage={Boolean(hasNextPage)}
						isFetchingNextPage={isFetchingNextPage}
						messageOrder={messageOrder}
						partnerLastReadIndex={partnerLastReadIndex}
						myUserId={myUserId}
						partner={partner}
						meLabel={meLabel}
						threadSearchQuery={threadSearchQuery}
						onCopyPlainText={onCopyPlainText}
						activeChatId={selectedChatId}
						onAcceptAttachment={onAcceptAttachment}
						acceptBusyMessageId={acceptBusyMessageId}
						onLoadOlder={onLoadOlder}
						messageById={messageById}
						onReply={onReply}
						onJumpToMessage={onJumpToMessage}
						mediaPrefs={threadPrefs}
						scrollToMessageId={scrollToMessageId}
						onConsumedScrollToMessage={onConsumedScrollToMessage}
						onEditMessage={onEditMessage}
						onDeleteMessageForMe={onDeleteMessageForMe}
						onDeleteMessageForEveryone={onDeleteMessageForEveryone}
					/>
				)}
			</div>
			{showScrollDown && !threadSearchTrimmed ? (
				<div
					className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2"
					style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_BASE }}
				>
					<DesktopChromeTooltip
						content={t('scrollToBottom')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							className={cn(
								'pointer-events-auto touch-manipulation px-2 py-1 shadow-md ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)] ring-offset-1 ring-offset-[color-mix(in_srgb,var(--desktop-surface-app)_88%,transparent)] motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-reduce:transition-none hover:shadow-lg hover:ring-[rgb(var(--desktop-accent-rgb)/0.45)] motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.98]',
								DESKTOP_TYPOGRAPHY.meta
							)}
							onClick={onScrollToBottom}
						>
							<ArrowDownIcon
								className="h-3.5 w-3.5 shrink-0"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
							{t('scrollToBottom')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			) : null}
		</div>
	);
});
