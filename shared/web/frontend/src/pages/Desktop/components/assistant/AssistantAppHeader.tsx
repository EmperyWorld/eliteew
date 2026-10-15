/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AssistantApp header toolbar: streaming indicator, message count chip, history refresh, overflow menu.
 *
 * Invariants:
 * - Desktop: toolbar-only (shell WindowTitleBar owns title); mobile embedded keeps compact title.
 * - Message count uses plural i18n + `ASSISTANT_HEADER_MESSAGE_COUNT_CLASS` (no «сообщ.» abbrev).
 * - Overflow menu portals to document.body to avoid window rim clipping (R12).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - pages/Desktop/components/assistant/assistantHeaderStyles.ts
 */
import { cn } from '@/utils/cn';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	BookOpenIcon,
	CheckCircleIcon,
	ClipboardDocumentIcon,
	EllipsisVerticalIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import * as React from 'react';
import {
	ASSISTANT_FAQ_SIDEBAR_HINT_DOT_CLASS,
	ASSISTANT_STREAMING_THINKING_CLASS,
} from '../../utils/assistantUserShellUi';
import { DESKTOP_TYPOGRAPHY, DESKTOP_PORTAL_STACK_BUMP } from '../../constants';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import { useDesktopWindowPortalStackBase } from '../../context/DesktopWindowPortalStackContext';
import { getDesktopPortalShellProps } from '../../utils/desktopUi';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';
import {
	ASSISTANT_CLEAR_LOCAL_FAQ_BUTTON_CLASS,
	ASSISTANT_HEADER_EXPORT_BUTTON_CLASS,
	ASSISTANT_HEADER_MESSAGE_COUNT_CLASS,
	ASSISTANT_HEADER_STREAMING_BAR_CLASS,
	ASSISTANT_HEADER_TAGLINE_CLASS,
	ASSISTANT_HEADER_TAGLINE_STREAMING_CLASS,
	ASSISTANT_HISTORY_ERROR_REFRESH_CLASS,
	ASSISTANT_HISTORY_REFRESH_READY_CLASS,
	ASSISTANT_HISTORY_REFRESH_SUCCESS_CLASS,
	ASSISTANT_MOBILE_HEADER_TOOLBAR_OPEN_CLASS,
	ASSISTANT_MOBILE_MENU_CLEAR_LOCAL_FLASH_CLASS,
	ASSISTANT_MOBILE_MENU_CLEAR_READY_CLASS,
	ASSISTANT_MOBILE_MENU_EXPORT_READY_CLASS,
	ASSISTANT_MOBILE_MENU_ITEM_FLASH_CLASS,
	ASSISTANT_MOBILE_MENU_SURFACE_CLASS,
	ASSISTANT_STREAMING_BAR_INNER_CLASS,
} from './assistantHeaderStyles';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export type AssistantAppHeaderProps = {
	headerClassName: string;
	embeddedMobileLayout: boolean;
	sending: boolean;
	t: TFunction<'desktopUi', 'assistant'>;
	msgQuery: UseQueryResult<AssistantChatMessage[], Error>;
	historyRefreshFlash: boolean;
	onRefreshHistory: () => void;
	clearing: boolean;
	localFaqMessagesCount: number;
	displayMessagesCount: number;
	persistedMessagesCount: number;
	streamingRaw: string;
	pendingUserText: string | null;
	streamingSourcesHint: string;
	copyConversationFlash: boolean;
	downloadConversationFlash: boolean;
	clearLocalFaqFlash: boolean;
	onCopyConversation: () => void;
	onDownloadConversation: () => void;
	onClearLocalFaq: () => void;
	onOpenClearConfirm: () => void;
	streamAnnounced: string;
};

export function AssistantAppHeader({
	headerClassName,
	embeddedMobileLayout,
	sending,
	t,
	msgQuery,
	historyRefreshFlash,
	onRefreshHistory,
	clearing,
	localFaqMessagesCount,
	displayMessagesCount,
	persistedMessagesCount,
	streamingRaw,
	pendingUserText,
	streamingSourcesHint,
	copyConversationFlash,
	downloadConversationFlash,
	clearLocalFaqFlash,
	onCopyConversation,
	onDownloadConversation,
	onClearLocalFaq,
	onOpenClearConfirm,
	streamAnnounced,
}: AssistantAppHeaderProps): React.ReactElement {
	const [headerMenuOpen, setHeaderMenuOpen] = React.useState(false);
	const headerMenuBtnRef = React.useRef<HTMLButtonElement | null>(null);
	const headerMenuRef = React.useRef<HTMLDivElement | null>(null);
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [menuPos, setMenuPos] = React.useState<{
		top: number;
		left: number;
	} | null>(null);

	React.useEffect(() => {
		if (!headerMenuOpen) return;
		const onDoc = (event: MouseEvent) => {
			if (headerMenuRef.current?.contains(event.target as Node)) return;
			setHeaderMenuOpen(false);
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [headerMenuOpen]);

	React.useEffect(() => {
		if (!headerMenuOpen || !headerMenuBtnRef.current) return;
		const rect = headerMenuBtnRef.current.getBoundingClientRect();
		setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 216) });
	}, [headerMenuOpen]);

	const messageCountLabel = t('messageCount', { count: displayMessagesCount });
	const messageCountTitle =
		localFaqMessagesCount > 0
			? t('messageCountBreakdownTooltip', {
					total: displayMessagesCount,
					server: persistedMessagesCount,
					local: localFaqMessagesCount,
				})
			: messageCountLabel;

	const menuItems = [
		{
			key: 'copy' as const,
			label: t('copyConversation'),
			doneLabel: t('copyConversationDone'),
			icon: ClipboardDocumentIcon,
			disabled:
				clearing || sending || msgQuery.isLoading || displayMessagesCount === 0,
			onClick: onCopyConversation,
			flashed: copyConversationFlash,
			flashClass: ASSISTANT_MOBILE_MENU_ITEM_FLASH_CLASS,
		},
		{
			key: 'download' as const,
			label: t('downloadConversation'),
			doneLabel: t('downloadConversationDone'),
			icon: ArrowDownTrayIcon,
			disabled:
				clearing || sending || msgQuery.isLoading || displayMessagesCount === 0,
			onClick: onDownloadConversation,
			flashed: downloadConversationFlash,
			flashClass: ASSISTANT_MOBILE_MENU_ITEM_FLASH_CLASS,
		},
		{
			key: 'clearLocal' as const,
			label: t('clearLocalFaq'),
			doneLabel: t('clearLocalFaqDone'),
			icon: XMarkIcon,
			disabled: clearing || sending || localFaqMessagesCount === 0,
			onClick: onClearLocalFaq,
			flashed: clearLocalFaqFlash,
			flashClass: ASSISTANT_MOBILE_MENU_CLEAR_LOCAL_FLASH_CLASS,
		},
		{
			key: 'clear' as const,
			label: t('clearChat'),
			doneLabel: t('clearChat'),
			icon: TrashIcon,
			disabled:
				clearing ||
				sending ||
				msgQuery.isLoading ||
				(persistedMessagesCount === 0 &&
					localFaqMessagesCount === 0 &&
					!streamingRaw &&
					!pendingUserText),
			onClick: onOpenClearConfirm,
			flashed: false,
			flashClass: null,
		},
	];

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	const menuPortal =
		headerMenuOpen && menuPos && typeof document !== 'undefined' ? (
			<ShellPortalMount>
				<div
					style={portalShellStyle}
					className={portalTheme === 'dark' ? 'dark' : ''}
				>
					<div ref={headerMenuRef}>
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
							{menuItems.map((item) => {
								const Icon =
									item.flashed && item.key !== 'clear'
										? CheckCircleIcon
										: item.icon;
								const label =
									item.flashed && item.key !== 'clear'
										? item.doneLabel
										: item.label;
								return (
									<button
										key={item.key}
										type="button"
										role="menuitem"
										disabled={item.disabled}
										className={cn(
											'flex w-full items-center gap-2 px-3 py-2 text-left',
											DESKTOP_TYPOGRAPHY.shellCopy13,
											item.key === 'clear'
												? cn(
														'text-(--desktop-text-primary) hover:bg-rose-500/10 hover:text-rose-200/95',
														!item.disabled &&
															ASSISTANT_MOBILE_MENU_CLEAR_READY_CLASS
													)
												: cn(
														'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)',
														(item.key === 'copy' || item.key === 'download') &&
															!item.disabled &&
															!item.flashed &&
															cn(
																ASSISTANT_HEADER_EXPORT_BUTTON_CLASS,
																ASSISTANT_MOBILE_MENU_EXPORT_READY_CLASS
															),
														item.flashed && item.flashClass,
														item.key === 'clearLocal' &&
															!item.disabled &&
															!item.flashed &&
															ASSISTANT_CLEAR_LOCAL_FAQ_BUTTON_CLASS
													),
											'disabled:cursor-not-allowed disabled:opacity-45',
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
										onClick={() => {
											item.onClick();
											if (item.key === 'clear') {
												setHeaderMenuOpen(false);
											}
										}}
									>
										<Icon
											className={cn(
												'h-4 w-4 shrink-0',
												item.flashed &&
													item.key === 'clearLocal' &&
													'text-amber-300/95',
												item.flashed &&
													(item.key === 'copy' || item.key === 'download') &&
													'text-emerald-300/95'
											)}
											aria-hidden
										/>
										{label}
									</button>
								);
							})}
						</DesktopAppMenuSurface>
					</div>
				</div>
			</ShellPortalMount>
		) : null;

	const toolbarActions = (
		<div
			className={cn(
				'relative flex shrink-0 items-center gap-0.5 self-start rounded-lg border border-(--desktop-border-subtle)/55 bg-(--desktop-surface-soft)/45 p-0.5',
				headerMenuOpen && ASSISTANT_MOBILE_HEADER_TOOLBAR_OPEN_CLASS
			)}
		>
			<AssistantDesktopTooltip
				content={
					historyRefreshFlash && !msgQuery.isFetching
						? t('historyRefreshed')
						: msgQuery.isError
							? t('historyRetry')
							: t('refreshHistory')
				}
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						'gap-1.5 text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
						msgQuery.isError && ASSISTANT_HISTORY_ERROR_REFRESH_CLASS,
						!msgQuery.isFetching &&
							!historyRefreshFlash &&
							ASSISTANT_HISTORY_REFRESH_READY_CLASS,
						historyRefreshFlash &&
							!msgQuery.isFetching &&
							ASSISTANT_HISTORY_REFRESH_SUCCESS_CLASS
					)}
					disabled={clearing || sending || msgQuery.isFetching}
					onClick={onRefreshHistory}
					aria-label={
						historyRefreshFlash && !msgQuery.isFetching
							? t('historyRefreshed')
							: msgQuery.isError
								? t('historyRetry')
								: t('refreshHistory')
					}
				>
					{historyRefreshFlash && !msgQuery.isFetching ? (
						<CheckCircleIcon
							className="w-4 h-4 text-emerald-300/95"
							aria-hidden
						/>
					) : (
						<ArrowPathIcon
							className={cn(
								'w-4 h-4',
								msgQuery.isFetching && 'motion-safe:animate-spin'
							)}
							aria-hidden
						/>
					)}
				</DesktopAppButton>
			</AssistantDesktopTooltip>
			<AssistantDesktopTooltip content={t('headerActionsMenu')}>
				<DesktopAppButton
					ref={headerMenuBtnRef}
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						'relative px-2 text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
						headerMenuOpen &&
							'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
						headerMenuOpen &&
							'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-soft))]'
					)}
					aria-expanded={headerMenuOpen}
					aria-haspopup="menu"
					aria-label={t('headerActionsMenu')}
					data-assistant-guide="overflow-menu"
					onClick={() => setHeaderMenuOpen((open) => !open)}
				>
					<EllipsisVerticalIcon className="h-4 w-4" aria-hidden />
					{localFaqMessagesCount > 0 ? (
						<span
							className={cn(
								'absolute right-1 top-1',
								ASSISTANT_FAQ_SIDEBAR_HINT_DOT_CLASS
							)}
							aria-hidden
						/>
					) : null}
				</DesktopAppButton>
			</AssistantDesktopTooltip>
			{menuPortal}
		</div>
	);

	return (
		<div className={headerClassName} data-assistant-guide="header">
			<span className="sr-only" aria-live="polite">
				{streamAnnounced}
			</span>
			<div
				className={cn(
					'flex w-full items-start justify-between gap-3',
					embeddedMobileLayout ? 'px-3 py-2' : 'px-3 py-1.5'
				)}
			>
				{embeddedMobileLayout ? (
					<div className="flex min-w-0 flex-1 flex-col gap-1 pr-1">
						<div className="flex min-w-0 items-center gap-2">
							<BookOpenIcon
								className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
								aria-hidden
							/>
							<span className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'truncate')}>
								{t('title')}
							</span>
							{sending ? (
								<span
									className={ASSISTANT_STREAMING_THINKING_CLASS}
									aria-live="polite"
								>
									{t('streaming')}
								</span>
							) : null}
						</div>
						<p className={ASSISTANT_HEADER_TAGLINE_CLASS}>
							{t('headerTagline')}
						</p>
					</div>
				) : (
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
						<DesktopChromeTooltip
							content={messageCountTitle}
							placement="bottom"
							offsetExtra={4}
						>
							<span
								className={ASSISTANT_HEADER_MESSAGE_COUNT_CLASS}
								data-assistant-guide="message-count"
							>
								{messageCountLabel}
							</span>
						</DesktopChromeTooltip>
						{sending ? (
							<span className="flex min-w-0 flex-wrap items-center gap-2">
								<span className="relative flex h-2 w-2 shrink-0" aria-hidden>
									<span
										className={cn(
											'motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full',
											'bg-[rgb(var(--desktop-accent-rgb)/0.45)] opacity-75 motion-reduce:animate-none'
										)}
									/>
									<span className="relative inline-flex h-2 w-2 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)]" />
								</span>
								<span
									className={cn(
										ASSISTANT_STREAMING_THINKING_CLASS,
										ASSISTANT_HEADER_TAGLINE_STREAMING_CLASS
									)}
									aria-live="polite"
								>
									{t('streaming')}
								</span>
								{streamingSourcesHint ? (
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'truncate text-(--desktop-text-dim)'
										)}
									>
										{streamingSourcesHint}
									</span>
								) : null}
							</span>
						) : null}
					</div>
				)}
				{toolbarActions}
			</div>
			{sending ? (
				<div className={ASSISTANT_HEADER_STREAMING_BAR_CLASS} aria-hidden>
					<div className={ASSISTANT_STREAMING_BAR_INNER_CLASS} />
				</div>
			) : null}
		</div>
	);
}
