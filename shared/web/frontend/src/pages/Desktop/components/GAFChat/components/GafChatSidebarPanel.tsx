/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat sidebar rail: collapse toggle, search/filter controls, and thread list rows.
 *
 * Invariants:
 * - Collapsed mode shows avatar-only rows; expanded mode shows full list with keyboard refs.
 * - Empty/loading/error states mirror parent chat query state without duplicating fetch logic.
 * - Sidebar search input always has `id` + `name` (autofill / a11y scanners).
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/components/GafChatSidebarThreadList.tsx
 */
import {
	ArrowPathIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { memo, useId, type MutableRefObject, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { getDesktopShellHeaderStripClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GafChatSidebarThreadList } from './GafChatSidebarThreadList';
import type { GAFChatListItem } from '../types';

export type GafChatSidebarPanelProps = {
	shellNavAsideClass: string;
	shellFrame: Parameters<typeof getDesktopShellHeaderStripClassName>[0];
	shellSidebarSearchRowClass: string;
	shellSidebarSearchInputClass: string;
	sidebarCollapsed: boolean;
	sidebarCollapsePersisting: boolean;
	toggleSidebarCollapsed: () => void;
	sidebarSearchInputRef: RefObject<HTMLInputElement | null>;
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	sidebarFilter: 'all' | 'unread';
	onSidebarFilterChange: (filter: 'all' | 'unread') => void;
	chatsLoading: boolean;
	chatsError: boolean;
	chats: GAFChatListItem[];
	filteredChats: GAFChatListItem[];
	selectedChatId: string | null;
	onSelectChat: (chatId: string) => void;
	chatListRowRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
	pinnedChatIds: string[];
	onTogglePin: (chatId: string) => void;
	onPrefetchThread: (chatId: string) => void;
	onRefetchChats?: () => void;
};

export const GafChatSidebarPanel = memo(function GafChatSidebarPanel({
	shellNavAsideClass,
	shellFrame,
	shellSidebarSearchRowClass,
	shellSidebarSearchInputClass,
	sidebarCollapsed,
	sidebarCollapsePersisting,
	toggleSidebarCollapsed,
	sidebarSearchInputRef,
	searchQuery,
	onSearchQueryChange,
	sidebarFilter,
	onSidebarFilterChange,
	chatsLoading,
	chatsError,
	chats,
	filteredChats,
	selectedChatId,
	onSelectChat,
	chatListRowRefs,
	pinnedChatIds,
	onTogglePin,
	onPrefetchThread,
	onRefetchChats,
}: GafChatSidebarPanelProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const searchFieldId = `${useId().replace(/:/g, '')}-sidebar-search`;

	return (
		<aside
			className={cn(shellNavAsideClass, sidebarCollapsed ? 'w-14' : 'w-64')}
			data-gaf-guide="sidebar"
		>
			<div
				className={cn(
					'flex shrink-0 items-center border-b border-(--desktop-border-subtle)/55 px-1.5 py-1.5',
					sidebarCollapsed ? 'justify-center' : 'justify-between gap-2',
					getDesktopShellHeaderStripClassName(shellFrame)
				)}
			>
				{!sidebarCollapsed ? (
					<DesktopAppSectionLabel className="min-w-0 flex-1 truncate tracking-[0.12em]">
						{t('sidebarSectionChats')}
					</DesktopAppSectionLabel>
				) : null}
				<DesktopChromeTooltip
					content={
						sidebarCollapsed ? t('sidebarExpandAria') : t('sidebarCollapseAria')
					}
					placement="bottom"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 touch-manipulation"
						aria-label={
							sidebarCollapsed
								? t('sidebarExpandAria')
								: t('sidebarCollapseAria')
						}
						aria-expanded={!sidebarCollapsed}
						disabled={sidebarCollapsePersisting}
						onClick={toggleSidebarCollapsed}
					>
						{sidebarCollapsePersisting ? (
							<ArrowPathIcon
								className="h-4 w-4 animate-spin motion-reduce:animate-none"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						) : sidebarCollapsed ? (
							<ChevronRightIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						) : (
							<ChevronLeftIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						)}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</div>
			{!sidebarCollapsed ? (
				<>
					<DesktopChromeTooltip
						content={t('sidebarSearchTooltip')}
						placement="bottom"
						offsetExtra={4}
					>
						<div className={shellSidebarSearchRowClass}>
							<MagnifyingGlassIcon
								className="h-4 w-4 shrink-0 text-(--desktop-text-muted)"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
							<DesktopAppInput
								id={searchFieldId}
								name="gaf-chat-sidebar-search"
								ref={sidebarSearchInputRef}
								type="text"
								placeholder={t('searchChatsPlaceholder')}
								aria-label={t('sidebarSearchAria')}
								autoComplete="off"
								className={cn(
									shellSidebarSearchInputClass,
									'min-w-0 flex-1 border-transparent py-1.5'
								)}
								value={searchQuery}
								onChange={(e) => onSearchQueryChange(e.target.value)}
							/>
						</div>
					</DesktopChromeTooltip>
					<fieldset
						className="m-0 flex shrink-0 flex-wrap gap-1 border-0 p-0 px-2 pb-1.5 pt-0"
						aria-label={t('sidebarFilterAria')}
					>
						<DesktopChromeTooltip
							content={t('sidebarFilterAll')}
							placement="bottom"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant={sidebarFilter === 'all' ? 'accent' : 'neutral'}
								size="sm"
								className={cn(
									'min-h-7 px-2 py-0.5 font-medium',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
								aria-pressed={sidebarFilter === 'all'}
								onClick={() => onSidebarFilterChange('all')}
							>
								{t('sidebarFilterAll')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('sidebarFilterUnread')}
							placement="bottom"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant={sidebarFilter === 'unread' ? 'accent' : 'neutral'}
								size="sm"
								className={cn(
									'min-h-7 px-2 py-0.5 font-medium',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
								aria-pressed={sidebarFilter === 'unread'}
								onClick={() => onSidebarFilterChange('unread')}
							>
								{t('sidebarFilterUnread')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</fieldset>
				</>
			) : null}
			<GafChatSidebarThreadList
				sidebarCollapsed={sidebarCollapsed}
				chatsLoading={chatsLoading}
				chatsError={chatsError}
				chats={chats}
				filteredChats={filteredChats}
				searchQuery={searchQuery}
				sidebarFilter={sidebarFilter}
				selectedChatId={selectedChatId}
				onSelectChat={onSelectChat}
				chatListRowRefs={chatListRowRefs}
				pinnedChatIds={pinnedChatIds}
				onTogglePin={onTogglePin}
				onPrefetchThread={onPrefetchThread}
				onRefetchChats={onRefetchChats}
			/>
		</aside>
	);
});
