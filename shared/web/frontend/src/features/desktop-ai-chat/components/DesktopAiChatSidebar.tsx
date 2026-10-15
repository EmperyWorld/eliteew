/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat sidebar: new chat, search, pinned chat list with title edit.
 * Team/shared chats use quiet card chrome + roster avatars; list titles via
 * desktopAiChatListPrimaryTitle (no duplicate «Команда» badge).
 *
 * Invariants:
 * - Chat row double-click rename must not nest interactive buttons.
 * - Meta labels (pending invites, shared chip) stay sentence-case — no uppercase shout.
 *
 * Related:
 * - hooks/useDesktopAiChatList.ts, DesktopAiChatApp.tsx
 * - utils/desktopAiChatListDisplayTitle.ts
 * - layout/desktopAiChatLayoutTokens.ts
 */
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import type { TFunction } from 'i18next';
import * as React from 'react';
import type {
	DesktopAiChatItem,
	DesktopAiChatMember,
} from '../api/desktopChatClient';
import { hasDesktopChatCapability } from '../utils/desktopChatCapabilities';
import {
	desktopAiChatListPrimaryTitle,
	desktopAiChatListSecondaryLabel,
} from '../utils/desktopAiChatListDisplayTitle';
import {
	desktopChatSideLabel,
	desktopEnsembleRosterHeroes,
	getDesktopAiHero,
	isDesktopEnsembleChat,
} from '../desktopAiHeroes';
import { readChatHasDraft } from '../utils/desktopAiChatDraft';
import { DesktopAiChatIconTooltip } from './desktopAiChatIconTooltip';
import { DesktopAiChatHumanRosterStack } from './DesktopAiChatHumanRosterStack';
import {
	ChatBubbleLeftEllipsisIcon,
	MagnifyingGlassIcon,
	MapPinIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import type { DesktopAiChatLoadState } from '../desktopAiChatSurfaceState';
import { DesktopAiChatStatePanel } from '../layout/DesktopAiChatStatePanel';
import {
	DESKTOP_AI_CHAT_SIDEBAR_LIST_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_SECONDARY_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS,
	DESKTOP_AI_CHAT_SIDEBAR_TITLE_CLASS,
} from '../layout/desktopAiChatLayoutTokens';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { cn } from '@/utils/cn';

export type DesktopAiChatSidebarProps = {
	filteredChats: DesktopAiChatItem[];
	loadingList: boolean;
	listLoadState: DesktopAiChatLoadState;
	onRetryListLoad: () => void;
	activeId: string | null;
	chatPins: string[];
	titleEditChatId: string | null;
	titleDraft: string;
	setTitleDraft: (v: string) => void;
	setActiveId: (id: string) => void;
	setTitleEditChatId: (id: string | null) => void;
	saveChatTitle: () => void | Promise<void>;
	cancelTitleEdit: () => void;
	togglePinChat: (chatId: string, e: React.MouseEvent) => void;
	onOpenHeroPicker: () => void;
	chatFilter: string;
	setChatFilter: (v: string) => void;
	shellNavAsideClass: string;
	shellNewChatBtnClass: string;
	shellChatSearchInputClass: string;
	isCompactSurface: boolean;
	shellTheme: DesktopShellTheme;
	lucideStroke: number;
	pendingInvites: DesktopAiChatMember[];
	pendingInvitesLoading: boolean;
	inviteActionBusyId: string | null;
	onAcceptInvite: (memberId: string) => void | Promise<void>;
	onDeclineInvite: (memberId: string) => void | Promise<void>;
	/** DB users.id for «you» tooltip on human roster stacks. */
	currentUserId: string | null;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatSidebar({
	filteredChats,
	loadingList,
	listLoadState,
	onRetryListLoad,
	activeId,
	chatPins,
	titleEditChatId,
	titleDraft,
	setTitleDraft,
	setActiveId,
	setTitleEditChatId,
	saveChatTitle,
	cancelTitleEdit,
	togglePinChat,
	onOpenHeroPicker,
	chatFilter,
	setChatFilter,
	shellNavAsideClass,
	shellNewChatBtnClass,
	shellChatSearchInputClass,
	isCompactSurface,
	shellTheme,
	lucideStroke,
	pendingInvites,
	pendingInvitesLoading,
	inviteActionBusyId,
	onAcceptInvite,
	onDeclineInvite,
	currentUserId,
	t,
}: DesktopAiChatSidebarProps) {
	return (
		<aside
			data-ai-chat-guide="sidebar"
			aria-label={t('sidebarLabel')}
			className={cn(
				'min-h-0 w-full max-w-full shrink-0 flex flex-col',
				DESKTOP_SURFACE.radius,
				shellNavAsideClass,
				isCompactSurface
					? 'm-2 mb-0 max-h-[min(42%,280px)] border-r-0 border-b border-(--desktop-border-subtle)'
					: 'm-2 mr-0 sm:max-w-60 lg:w-56 lg:max-w-60'
			)}
		>
			<div className="p-3 flex gap-2">
				<button
					type="button"
					onClick={() => onOpenHeroPicker()}
					className={shellNewChatBtnClass}
				>
					<ChatBubbleLeftEllipsisIcon
						className="h-4 w-4 shrink-0"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
					{t('newChat')}
				</button>
			</div>
			<div className="px-2 pb-2">
				<div className="relative">
					<MagnifyingGlassIcon
						className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-muted)"
						strokeWidth={lucideStroke}
					/>
					<input
						type="search"
						className={shellChatSearchInputClass}
						placeholder={t('chatSearchPlaceholder')}
						value={chatFilter}
						onChange={(e) => setChatFilter(e.target.value)}
						aria-label={t('chatSearchAria')}
					/>
				</div>
			</div>
			{pendingInvites.length > 0 || pendingInvitesLoading ? (
				<div
					className="mx-2 mb-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] p-2 space-y-2"
					data-testid="desktop-ai-chat-pending-invites"
				>
					<p className={DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS}>
						{t('collabPendingInvitesTitle', { count: pendingInvites.length })}
					</p>
					{pendingInvitesLoading && pendingInvites.length === 0 ? (
						<p
							className={cn(
								'text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('collabPendingInvitesLoading')}
						</p>
					) : (
						<ul className="space-y-1.5">
							{pendingInvites.map((inv) => (
								<li
									key={inv.id}
									className="rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.35)_100%,transparent)] px-2 py-1.5"
								>
									<p
										className={cn(
											'text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
									>
										{t('collabPendingInviteRow', {
											chat: inv.chat_id.slice(0, 8),
										})}
									</p>
									<div className="mt-1.5 flex flex-wrap gap-1.5">
										<DesktopAppButton
											type="button"
											variant="accent"
											disabled={inviteActionBusyId === inv.id}
											onClick={() => void onAcceptInvite(inv.id)}
										>
											{t('collabInviteAcceptShort')}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant="ghost"
											disabled={inviteActionBusyId === inv.id}
											onClick={() => void onDeclineInvite(inv.id)}
										>
											{t('collabInviteDeclineShort')}
										</DesktopAppButton>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
			<div className={DESKTOP_AI_CHAT_SIDEBAR_LIST_CLASS}>
				{listLoadState === 'error' ? (
					<div className="px-1 py-2">
						<DesktopAiChatStatePanel
							state="error"
							title={t('chatListLoadErrorInline')}
							description={t('chatListLoadError')}
							onRetry={onRetryListLoad}
							className="min-h-0 w-full"
						/>
					</div>
				) : loadingList ? (
					<div className="space-y-2 px-1 py-2" aria-hidden>
						{[0, 1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="h-10 rounded-lg bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)] animate-pulse motion-reduce:animate-none"
							/>
						))}
					</div>
				) : filteredChats.length === 0 ? (
					<div className="px-1 py-2">
						<DesktopAiChatStatePanel
							state="empty"
							title={t('sidebarEmptyTitle')}
							description={t('sidebarEmptyBody')}
							className="min-h-0 w-full"
							actions={
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={() => onOpenHeroPicker()}
								>
									{t('workspaceHero.primaryCta')}
								</DesktopAppButton>
							}
						/>
					</div>
				) : (
					filteredChats.map((c) => {
						const hid =
							typeof c.settings?.desktop_hero_id === 'string'
								? c.settings.desktop_hero_id
								: undefined;
						const sideHeroDef = getDesktopAiHero(hid);
						const cEnsemble = isDesktopEnsembleChat(c.settings);
						const isShared = c.is_shared === true;
						const isTeamCard = cEnsemble || isShared;
						const sideLabel = cEnsemble
							? t('ensembleModeBadge')
							: (desktopChatSideLabel(c.settings) ?? t('defaultAssistant'));
						const rosterPreviewHeroes = cEnsemble
							? desktopEnsembleRosterHeroes(c.settings).slice(0, 3)
							: [];
						const rosterPreviewTitle = rosterPreviewHeroes.length
							? rosterPreviewHeroes.map((h) => h.shortLabel).join(' · ')
							: '';
						const listTitle = desktopAiChatListPrimaryTitle({
							title: c.title,
							isEnsemble: cEnsemble,
							teamFallback: t('newChatTitleEnsemble'),
							soloFallback: t('defaultChatTitle'),
							rosterPreview: rosterPreviewTitle,
						});
						const secondary = desktopAiChatListSecondaryLabel({
							primaryTitle: listTitle,
							sideLabel,
							isEnsemble: cEnsemble,
							isShared,
							sharedBadge: t('collabSharedBadgeShort'),
						});
						const pinned = chatPins.includes(c.id);
						const hasDraft = readChatHasDraft(c.id);
						const isEditingTitle = titleEditChatId === c.id;
						const canPatchTitle = hasDesktopChatCapability(
							c,
							'can_patch_settings'
						);
						const chatRowMainClass = [
							'min-w-0 flex-1 flex items-start gap-2 text-left rounded-lg px-2 py-2 text-sm outline-none',
							isEditingTitle
								? ''
								: 'cursor-pointer focus-visible:ring-1 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
							c.id === activeId
								? 'text-(--desktop-text-primary)'
								: 'text-(--desktop-text-secondary)',
						].join(' ');
						const chatRowInteractiveProps = isEditingTitle
							? ({} as Record<string, never>)
							: {
									role: 'button' as const,
									tabIndex: 0,
									onClick: () => setActiveId(c.id),
									onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setActiveId(c.id);
										}
									},
								};
						return (
							<div
								key={c.id}
								className={cn(
									'group flex items-stretch gap-0.5 rounded-xl transition',
									isTeamCard &&
										c.id !== activeId &&
										DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS,
									c.id === activeId
										? shellTheme === 'light'
											? 'border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
											: 'border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.2)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.2)_100%,transparent)]'
										: !isTeamCard &&
												(shellTheme === 'light'
													? 'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.04)_100%,transparent)]'
													: 'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]')
								)}
							>
								<div
									{...chatRowInteractiveProps}
									aria-current={c.id === activeId ? 'true' : undefined}
									className={chatRowMainClass}
								>
									<span className="flex shrink-0 items-center gap-1 self-start mt-0.5">
										{isShared && (c.participants?.length ?? 0) > 0 ? (
											<DesktopAiChatHumanRosterStack
												participants={c.participants ?? []}
												currentUserId={currentUserId}
												youLabel={t('messageFromYouTitle')}
												sizeClass="h-6 w-6"
												maxVisible={3}
											/>
										) : null}
										{cEnsemble ? (
											rosterPreviewHeroes.length > 0 ? (
												<DesktopChromeTooltip
													content={rosterPreviewTitle}
													placement="top"
													offsetExtra={4}
												>
													<span
														className="flex shrink-0 items-center pl-0.5"
														aria-hidden
													>
														{rosterPreviewHeroes.map((h, i) => (
															<img
																key={h.id}
																src={h.avatarPublicPath}
																alt=""
																className={[
																	'relative h-6 w-6 rounded-full border-2 border-[color-mix(in_srgb,var(--glass-bg-strong)_90%,#0a0520)] object-cover',
																	i > 0 ? '-ml-2' : '',
																	`z-[${rosterPreviewHeroes.length - i}]`,
																].join(' ')}
															/>
														))}
													</span>
												</DesktopChromeTooltip>
											) : (
												<DesktopChromeTooltip
													content={sideLabel}
													placement="top"
													offsetExtra={4}
												>
													<div className="h-8 w-8 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.2)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] flex items-center justify-center">
														<UsersIcon
															className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.92)]"
															strokeWidth={lucideStroke}
														/>
													</div>
												</DesktopChromeTooltip>
											)
										) : !isShared && sideHeroDef ? (
											<DesktopChromeTooltip
												content={sideLabel}
												placement="top"
												offsetExtra={4}
											>
												<img
													src={sideHeroDef.avatarPublicPath}
													alt=""
													className="h-8 w-8 shrink-0 rounded-full object-cover border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)]"
												/>
											</DesktopChromeTooltip>
										) : !isShared ||
											!(c.participants && c.participants.length > 0) ? (
											<DesktopChromeTooltip
												content={sideLabel}
												placement="top"
												offsetExtra={4}
											>
												{isShared ? (
													<div className="h-8 w-8 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.2)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] flex items-center justify-center">
														<UsersIcon
															className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.92)]"
															strokeWidth={lucideStroke}
														/>
													</div>
												) : (
													<div className="h-8 w-8 shrink-0 rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]" />
												)}
											</DesktopChromeTooltip>
										) : null}
									</span>
									<span className="min-w-0 flex-1">
										{titleEditChatId === c.id ? (
											<input
												data-desktop-ai-chat-title-input={c.id}
												className="w-full min-w-0 rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.18)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.38)_100%,transparent)] px-1.5 py-0.5 text-sm font-medium text-(--desktop-text-primary) antialiased"
												value={titleDraft}
												onChange={(e) => setTitleDraft(e.target.value)}
												onClick={(e) => e.stopPropagation()}
												onBlur={() => void saveChatTitle()}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														void saveChatTitle();
													}
													if (e.key === 'Escape') {
														e.preventDefault();
														cancelTitleEdit();
													}
												}}
												aria-label={t('chatTitleAria')}
												onPointerDown={(e) => e.stopPropagation()}
											/>
										) : (
											<DesktopChromeTooltip
												content={[
													listTitle,
													cEnsemble ? t('ensembleModeBadge') : null,
													isShared ? t('collabSharedBadge') : null,
													hasDraft ? t('draftIndicatorTitle') : null,
													canPatchTitle ? t('doubleClickRename') : null,
												]
													.filter(Boolean)
													.join('\n')}
												placement="top"
												offsetExtra={4}
											>
												{/* biome-ignore lint/a11y/noStaticElementInteractions: double-click rename inside parent chat row (role=button); avoids nested interactive buttons */}
												<span
													className={DESKTOP_AI_CHAT_SIDEBAR_TITLE_CLASS}
													onDoubleClick={(e) => {
														if (!canPatchTitle) return;
														e.stopPropagation();
														setActiveId(c.id);
														setTitleEditChatId(c.id);
														setTitleDraft(c.title);
													}}
												>
													{listTitle}
													{hasDraft ? (
														<span
															className="ml-1 inline-block align-middle h-1.5 w-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.88)]"
															aria-hidden
														/>
													) : null}
												</span>
											</DesktopChromeTooltip>
										)}
										{secondary ? (
											<div className="mt-1 flex flex-wrap items-center gap-1">
												<span
													className={
														secondary.kind === 'shared'
															? DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS
															: DESKTOP_AI_CHAT_SIDEBAR_SECONDARY_CLASS
													}
												>
													{secondary.label}
												</span>
											</div>
										) : null}
									</span>
								</div>
								{pinned ? (
									<DesktopAiChatIconTooltip content={t('unpinChatTitle')}>
										<button
											type="button"
											onClick={(e) => togglePinChat(c.id, e)}
											className={[
												'shrink-0 self-start mt-2 mr-1 p-1 rounded-md transition',
												'text-amber-300 bg-amber-500/15',
											].join(' ')}
											aria-label={t('unpinChatAria')}
											aria-pressed="true"
										>
											<MapPinIcon
												className="h-3.5 w-3.5"
												strokeWidth={lucideStroke}
											/>
										</button>
									</DesktopAiChatIconTooltip>
								) : (
									<DesktopAiChatIconTooltip content={t('pinChatTitle')}>
										<button
											type="button"
											onClick={(e) => togglePinChat(c.id, e)}
											className={[
												'shrink-0 self-start mt-2 mr-1 p-1 rounded-md transition',
												'text-(--desktop-text-muted) opacity-60 hover:opacity-100',
											].join(' ')}
											aria-label={t('pinChatAria')}
										>
											<MapPinIcon
												className="h-3.5 w-3.5"
												strokeWidth={lucideStroke}
											/>
										</button>
									</DesktopAiChatIconTooltip>
								)}
							</div>
						);
					})
				)}
			</div>
		</aside>
	);
}
