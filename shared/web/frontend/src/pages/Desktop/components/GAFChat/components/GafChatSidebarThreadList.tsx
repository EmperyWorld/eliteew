/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat sidebar scrollable thread list: empty/loading states, collapsed avatar rail,
 * and expanded list rows with content-visibility virtualization hints.
 *
 * Invariants:
 * - Empty inbox, unread-filter, and search-no-results states mirror parent query props.
 * - Expanded list rows keep [content-visibility:auto] intrinsic-size hints unchanged.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatSidebarPanel.tsx
 * - src/pages/Desktop/components/GAFChat/GAFChatSidebarRow.tsx
 */
import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { memo, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton, DesktopAppEmptyState } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GAFChatSidebarRow } from '../GAFChatSidebarRow';
import type { GAFChatListItem } from '../types';
import { GAFChatSidebarSkeleton } from './GAFChatSkeletons';

export type GafChatSidebarThreadListProps = {
	sidebarCollapsed: boolean;
	chatsLoading: boolean;
	chatsError: boolean;
	chats: GAFChatListItem[];
	filteredChats: GAFChatListItem[];
	searchQuery: string;
	sidebarFilter: 'all' | 'unread';
	selectedChatId: string | null;
	onSelectChat: (chatId: string) => void;
	chatListRowRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
	pinnedChatIds: string[];
	onTogglePin: (chatId: string) => void;
	onPrefetchThread: (chatId: string) => void;
	onRefetchChats?: () => void;
};

export const GafChatSidebarThreadList = memo(function GafChatSidebarThreadList({
	sidebarCollapsed,
	chatsLoading,
	chatsError,
	chats,
	filteredChats,
	searchQuery,
	sidebarFilter,
	selectedChatId,
	onSelectChat,
	chatListRowRefs,
	pinnedChatIds,
	onTogglePin,
	onPrefetchThread,
	onRefetchChats,
}: GafChatSidebarThreadListProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;

	return (
		<div
			className={cn(
				'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable',
				sidebarCollapsed && 'px-1 py-1'
			)}
		>
			{!sidebarCollapsed && chatsLoading && <GAFChatSidebarSkeleton />}
			{!sidebarCollapsed &&
				!chatsLoading &&
				chatsError &&
				chats.length === 0 && (
					<DesktopAppEmptyState
						icon={
							<ChatBubbleLeftRightIcon
								className="h-7 w-7 text-rose-300/80"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						}
						title={t('sidebarChatsLoadErrorTitle')}
						description={t('sidebarChatsLoadErrorDescription')}
						className="min-h-[220px]"
					>
						{onRefetchChats ? (
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className="mt-3"
								onClick={() => void onRefetchChats()}
							>
								<ArrowPathIcon
									className="h-4 w-4 shrink-0"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
								{t('errorBarRetry')}
							</DesktopAppButton>
						) : null}
					</DesktopAppEmptyState>
				)}
			{!sidebarCollapsed &&
				!chatsLoading &&
				!chatsError &&
				chats.length === 0 && (
					<DesktopAppEmptyState
						icon={
							<ChatBubbleLeftRightIcon
								className="h-7 w-7 text-[rgb(var(--desktop-accent-rgb)/0.65)]"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						}
						title={t('emptyInboxTitle')}
						description={t('emptyInboxDescription')}
						className="min-h-[220px]"
					/>
				)}
			{!sidebarCollapsed &&
				!chatsLoading &&
				!chatsError &&
				chats.length > 0 &&
				filteredChats.length === 0 &&
				!searchQuery.trim() &&
				sidebarFilter === 'unread' && (
					<DesktopAppEmptyState
						icon={
							<ChatBubbleLeftRightIcon
								className="h-6 w-6 text-(--desktop-text-dim)"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						}
						title={t('sidebarEmptyUnreadFilter')}
						description={t('sidebarEmptyUnreadFilterHint')}
						className="min-h-[160px]"
					/>
				)}
			{!sidebarCollapsed &&
				!chatsLoading &&
				!chatsError &&
				chats.length > 0 &&
				filteredChats.length === 0 &&
				searchQuery.trim().length > 0 && (
					<DesktopAppEmptyState
						icon={
							<MagnifyingGlassIcon
								className="h-6 w-6 text-(--desktop-text-dim)"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						}
						title={t('searchNoResultsTitle')}
						description={t('searchNoResultsDescription')}
						className="min-h-[160px]"
					/>
				)}
			{!chatsLoading && filteredChats.length === 0 && sidebarCollapsed ? (
				<DesktopChromeTooltip
					content={t('sidebarCollapsedEmptyHint')}
					placement="right"
					offsetExtra={6}
				>
					<div
						className="flex min-h-[120px] flex-col items-center justify-center px-1 py-4 text-center"
						role="status"
					>
						<ChatBubbleLeftRightIcon
							className="h-6 w-6 text-(--desktop-text-dim)"
							aria-hidden
							strokeWidth={lucideStroke}
						/>
					</div>
				</DesktopChromeTooltip>
			) : null}
			{!chatsLoading && filteredChats.length > 0 ? (
				sidebarCollapsed ? (
					<ul
						className="m-0 flex list-none flex-col items-center gap-0.5 p-0"
						aria-label={t('chatListAria')}
					>
						{filteredChats.map((chat, idx) => (
							<li
								key={chat.chat_id}
								className="list-none flex min-w-0 justify-center"
							>
								<GAFChatSidebarRow
									chat={chat}
									active={selectedChatId === chat.chat_id}
									onSelect={onSelectChat}
									rowIndex={idx}
									chatCount={filteredChats.length}
									chatListRefs={chatListRowRefs}
									pinned={pinnedChatIds.includes(chat.chat_id)}
									onTogglePin={onTogglePin}
									onPrefetchThread={onPrefetchThread}
									collapsed
								/>
							</li>
						))}
					</ul>
				) : (
					<DesktopChromeTooltip
						content={t('sidebarListNavHint')}
						placement="right"
						offsetExtra={6}
					>
						<ul className="m-0 list-none p-0" aria-label={t('chatListAria')}>
							{filteredChats.map((chat, idx) => (
								<li
									key={chat.chat_id}
									className="list-none flex min-w-0 [content-visibility:auto] [contain-intrinsic-size:0_68px]"
								>
									<GAFChatSidebarRow
										chat={chat}
										active={selectedChatId === chat.chat_id}
										onSelect={onSelectChat}
										rowIndex={idx}
										chatCount={filteredChats.length}
										chatListRefs={chatListRowRefs}
										pinned={pinnedChatIds.includes(chat.chat_id)}
										onTogglePin={onTogglePin}
										onPrefetchThread={onPrefetchThread}
									/>
								</li>
							))}
						</ul>
					</DesktopChromeTooltip>
				)
			) : null}
		</div>
	);
});
