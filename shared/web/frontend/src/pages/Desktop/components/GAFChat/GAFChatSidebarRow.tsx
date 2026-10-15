/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sidebar row for one GAF Chat thread with selection, pinning, keyboard navigation,
 * context menu, and bounded hover prefetch trigger.
 *
 * Invariants:
 * - Hover prefetch is only fired for fine pointer devices, not touch scroll gestures.
 * - Row refs are indexed by visible row order for keyboard navigation.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/gafChatPrefetchPolicy.ts · DesktopChromeTooltip.tsx
 */
import { UserAccountBadges } from '@/components/ui/UserAccountBadges';
import { GAFChatAvatar } from './components/GAFChatAvatar';
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { forwardRef, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppListRow,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { GafChatDesktopIconTooltip } from './gafChatDesktopIconTooltip';
import type { GAFChatListItem } from './types';
import { GafChatThreadListContextMenu } from './components/GafChatThreadListContextMenu';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { gafChatSidebarMonogram } from './gafChatSidebarMonogram';

export const GAFChatSidebarRow = memo(
	forwardRef<
		HTMLButtonElement,
		{
			chat: GAFChatListItem;
			active: boolean;
			onSelect: (id: string) => void;
			rowIndex: number;
			chatCount: number;
			chatListRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
			pinned?: boolean;
			onTogglePin?: (chatId: string) => void;
			/** Prefetch thread messages (e.g. on hover) for faster open. */
			onPrefetchThread?: (chatId: string) => void;
			/** Narrow rail: avatar / monogram only. */
			collapsed?: boolean;
		}
	>(function GAFChatSidebarRow(
		{
			chat,
			active,
			onSelect,
			rowIndex,
			chatCount,
			chatListRefs,
			pinned,
			onTogglePin,
			onPrefetchThread,
			collapsed = false,
		},
		ref
	) {
		const { t, i18n } = useTranslation('gafChat');
		const dateLocale = i18n.language?.toLowerCase().startsWith('ru')
			? ru
			: enUS;
		const lastMessageTime = useMemo(() => {
			const raw = chat.last_message_at;
			if (!raw) return null;
			const d = new Date(raw);
			if (!isValid(d)) return null;
			return format(d, 'HH:mm', { locale: dateLocale });
		}, [chat.last_message_at, dateLocale]);
		const assignRef = useCallback(
			(el: HTMLButtonElement | null) => {
				const bucket = chatListRefs.current;
				if (bucket) bucket[rowIndex] = el;
				if (typeof ref === 'function') ref(el);
				else if (ref) ref.current = el;
			},
			[chatListRefs, rowIndex, ref]
		);
		const onRowKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLButtonElement>) => {
				if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
				e.preventDefault();
				const bucket = chatListRefs.current;
				if (!bucket) return;
				const delta = e.key === 'ArrowDown' ? 1 : -1;
				const next = rowIndex + delta;
				if (next < 0 || next >= chatCount) return;
				bucket[next]?.focus();
			},
			[chatCount, chatListRefs, rowIndex]
		);
		const showPin = Boolean(onTogglePin);
		const [threadCtxAnchor, setThreadCtxAnchor] = useState<{
			clientX: number;
			clientY: number;
		} | null>(null);
		const partnerDisplayName = getFriendDisplayName(
			chat.partner?.username,
			chat.partner?.full_name,
			t('unnamedUser')
		);
		const previewText = chat.last_message_preview || t('noMessagesPreview');
		const avatarUrl = chat.partner?.avatar_url ?? null;
		const monogram = gafChatSidebarMonogram(chat.partner?.username);

		const onThreadRowContextMenuCapture = useCallback((e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setThreadCtxAnchor({ clientX: e.clientX, clientY: e.clientY });
		}, []);

		if (collapsed) {
			return (
				<DesktopChromeTooltip
					content={partnerDisplayName}
					placement="right"
					offsetExtra={6}
				>
					<button
						ref={assignRef}
						type="button"
						onClick={() => onSelect(chat.chat_id)}
						aria-current={active ? 'true' : undefined}
						className={cn(
							'relative mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-[background-color,box-shadow,transform] duration-150 motion-reduce:transition-none',
							'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
							active
								? 'bg-[rgb(var(--desktop-accent-rgb)/0.14)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.35)]'
								: 'hover:bg-(--desktop-surface-soft-hover)/70'
						)}
						onKeyDown={onRowKeyDown}
						onPointerEnter={
							onPrefetchThread
								? (event) => {
										if (
											event.pointerType !== 'mouse' &&
											event.pointerType !== 'pen'
										) {
											return;
										}
										onPrefetchThread(chat.chat_id);
									}
								: undefined
						}
					>
						{avatarUrl ? (
							<GAFChatAvatar
								avatarUrl={avatarUrl}
								className="h-9 w-9 rounded-full object-cover ring-1 ring-(--desktop-border-subtle)/80"
								alt=""
							/>
						) : (
							<span
								className={cn(
									'flex h-9 w-9 items-center justify-center rounded-full bg-(--desktop-surface-soft) font-semibold text-(--desktop-text-primary) ring-1 ring-(--desktop-border-subtle)/80',
									DESKTOP_TYPOGRAPHY.body,
									active && 'ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
								)}
								aria-hidden
							>
								{monogram}
							</span>
						)}
						{chat.unread_count > 0 ? (
							<span
								className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[rgb(var(--desktop-accent-rgb))] ring-2 ring-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)]"
								aria-hidden
							/>
						) : null}
						{pinned ? (
							<MapPinIcon
								className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : null}
					</button>
				</DesktopChromeTooltip>
			);
		}

		const row = (
			<DesktopAppListRow
				ref={assignRef}
				type="button"
				onClick={() => onSelect(chat.chat_id)}
				active={active}
				aria-current={active ? 'true' : undefined}
				className={cn(
					'min-w-0 flex-1 rounded-none border-b border-(--desktop-border-subtle) px-2.5 py-2 transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
					showPin && 'rounded-r-none',
					active
						? 'bg-[rgb(var(--desktop-accent-rgb)/0.08)] shadow-[inset_3px_0_0_rgb(var(--desktop-accent-rgb))] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.14)]'
						: 'hover:bg-(--desktop-surface-soft-hover)/60'
				)}
				onKeyDown={onRowKeyDown}
				onPointerEnter={
					onPrefetchThread && !showPin
						? (event) => {
								if (
									event.pointerType !== 'mouse' &&
									event.pointerType !== 'pen'
								) {
									return;
								}
								onPrefetchThread(chat.chat_id);
							}
						: undefined
				}
			>
				<div className="flex min-w-0 items-center gap-2">
					<GAFChatAvatar
						avatarUrl={chat.partner?.avatar_url ?? null}
						className="h-9 w-9 shrink-0 rounded-full object-cover"
						alt=""
					/>
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-start justify-between gap-2">
							<div
								className={cn(
									'flex min-w-0 flex-1 items-center gap-1.5 truncate font-medium text-(--desktop-text-primary)',
									DESKTOP_TYPOGRAPHY.body
								)}
							>
								<DesktopChromeTooltip
									content={partnerDisplayName}
									placement="top"
									offsetExtra={4}
								>
									<span className="truncate">{partnerDisplayName}</span>
								</DesktopChromeTooltip>
								{chat.partner ? (
									<UserAccountBadges
										isTrusted={chat.partner.is_trusted}
										adminBadgeLabel={chat.partner.admin_badge_label}
										adminBadgeHint={chat.partner.admin_badge_hint}
										isSystemAccount={chat.partner.is_system_account}
										className="shrink-0"
									/>
								) : null}
							</div>
							{lastMessageTime ? (
								<DesktopChromeTooltip
									content={t('sidebarLastMessageTimeAria')}
									placement="left"
									offsetExtra={4}
								>
									<time
										dateTime={chat.last_message_at ?? undefined}
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'shrink-0 tabular-nums text-(--desktop-text-dim)',
											active && 'text-(--desktop-text-muted)'
										)}
									>
										{lastMessageTime}
									</time>
								</DesktopChromeTooltip>
							) : null}
						</div>
						<DesktopChromeTooltip
							content={previewText}
							placement="top"
							offsetExtra={4}
						>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-0.5 truncate text-(--desktop-text-muted)',
									active && 'text-(--desktop-text-secondary)'
								)}
							>
								{previewText}
							</div>
						</DesktopChromeTooltip>
					</div>
					{chat.unread_count > 0 && (
						<span
							className={`${DESKTOP_APP_STYLE_CONTRACT.counterBadge} min-w-[22px] shrink-0 tabular-nums bg-[rgb(var(--desktop-accent-rgb))] px-2 py-0.5 text-[rgb(var(--desktop-fg-primary-rgb))]`}
						>
							{chat.unread_count > 99 ? '99+' : chat.unread_count}
						</span>
					)}
				</div>
			</DesktopAppListRow>
		);

		const threadMenu = (
			<GafChatThreadListContextMenu
				open={threadCtxAnchor !== null}
				anchor={threadCtxAnchor}
				onClose={() => setThreadCtxAnchor(null)}
				onOpenChat={() => onSelect(chat.chat_id)}
				showPin={showPin}
				pinned={pinned === true}
				onTogglePin={
					showPin && onTogglePin ? () => onTogglePin(chat.chat_id) : undefined
				}
			/>
		);

		if (!showPin) {
			return (
				<>
					<div
						className="min-w-0 flex-1"
						onContextMenuCapture={onThreadRowContextMenuCapture}
					>
						{row}
					</div>
					{threadMenu}
				</>
			);
		}

		return (
			<>
				<div
					className="flex min-w-0 flex-1 items-stretch"
					onPointerEnter={
						onPrefetchThread && showPin
							? () => {
									onPrefetchThread(chat.chat_id);
								}
							: undefined
					}
					onContextMenuCapture={onThreadRowContextMenuCapture}
				>
					{row}
					<div className="flex shrink-0 items-stretch border-b border-l border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-panel)_35%,transparent)]">
						<GafChatDesktopIconTooltip
							content={pinned ? t('unpinChatTitle') : t('pinChatTitle')}
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className="h-auto min-h-13 w-9 shrink-0 rounded-none touch-manipulation"
								aria-pressed={pinned === true}
								aria-label={pinned ? t('unpinChatAria') : t('pinChatAria')}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onTogglePin?.(chat.chat_id);
								}}
							>
								<MapPinIcon
									className={cn(
										'h-4 w-4 shrink-0 text-(--desktop-text-dim) motion-safe:transition-colors motion-safe:duration-200',
										pinned &&
											'fill-[rgb(var(--desktop-accent-rgb)/0.35)] text-[rgb(var(--desktop-accent-rgb))]'
									)}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
						</GafChatDesktopIconTooltip>
					</div>
				</div>
				{threadMenu}
			</>
		);
	})
);
GAFChatSidebarRow.displayName = 'GAFChatSidebarRow';
