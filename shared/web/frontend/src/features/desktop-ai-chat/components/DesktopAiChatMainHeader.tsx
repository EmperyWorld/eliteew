/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat main header: consultant context + settings toggle + overflow «⋯»
 * for secondary actions (quiet chrome; one primary settings affordance).
 *
 * Invariants:
 * - Settings rail renders outside this component when header is expanded.
 * - Ensemble roster: each stacked avatar opens that hero's dossier (not always roster[0]).
 * - Human participant names: primary text; AI roster title: accent, normal case, truncated (+N).
 * - Export / delete / plan / release / guide live in the overflow menu, not equal-weight icon row.
 *
 * Related:
 * - components/DesktopAiChatSettingsRail.tsx, DesktopAiChatApp.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md §UI state inventory
 * - utils/desktopAiChatHeaderRosterLabel.ts
 */
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import {
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { TFunction } from 'i18next';
import * as React from 'react';
import type { DesktopAiChatItem } from '../api/desktopChatClient';
import type { DesktopAiHero } from '../desktopAiHeroes';
import { DesktopAiChatIconTooltip } from './desktopAiChatIconTooltip';
import { DesktopAiChatHumanRosterStack } from './DesktopAiChatHumanRosterStack';
import { compactDesktopAiHeaderRosterLabel } from '../utils/desktopAiChatHeaderRosterLabel';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowRightOnRectangleIcon,
	Cog6ToothIcon,
	EllipsisHorizontalIcon,
	QuestionMarkCircleIcon,
	QueueListIcon,
	SparklesIcon,
	TrashIcon,
	UserGroupIcon,
	UserMinusIcon,
	ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiChatMainHeaderProps = {
	isCompactSurface: boolean;
	shellHeaderBarClusterClass: string;
	shellHeaderCollapseBtnClass: string;
	isEnsembleActive: boolean;
	ensembleRosterHeroes: readonly DesktopAiHero[];
	assistantHeaderLabel: string;
	ensembleRosterSubtitle: string;
	activeHeroAvatarPath: string | null;
	activeChat: DesktopAiChatItem | null;
	currentUserId: string | null;
	soloSlotCountdownLabel: string | null;
	soloCanReleaseConsultant: boolean;
	releaseConsultantBusy: boolean;
	sending: boolean;
	headerCollapsed: boolean;
	activeId: string | null;
	messagesCount: number;
	/** Ensemble stack: open dossier for the clicked roster hero. */
	onOpenRosterHeroDossier: (heroId: string) => void;
	onOpenHeroDossier: () => void;
	onOpenReleaseConsultantModal: () => void;
	onOpenEnsemblePlanCommands: () => void;
	onOpenDiscussion?: () => void;
	onToggleHeaderCollapsed: () => void;
	onExportMd: () => void;
	onDeleteChat: () => void | Promise<void>;
	onExtractMemoryCell?: () => void | Promise<void>;
	onOpenMembersPanel: () => void;
	onRequestLeaveChat: () => void;
	canManageMembers: boolean;
	canLeave: boolean;
	canDeleteChat: boolean;
	canExport: boolean;
	onOpenGuide: () => void;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatMainHeader(props: DesktopAiChatMainHeaderProps) {
	const {
		isCompactSurface,
		shellHeaderBarClusterClass,
		shellHeaderCollapseBtnClass,
		isEnsembleActive,
		ensembleRosterHeroes,
		assistantHeaderLabel,
		ensembleRosterSubtitle,
		activeHeroAvatarPath,
		activeChat,
		currentUserId,
		soloSlotCountdownLabel,
		soloCanReleaseConsultant,
		releaseConsultantBusy,
		sending,
		headerCollapsed,
		activeId,
		messagesCount,
		onOpenRosterHeroDossier,
		onOpenHeroDossier,
		onOpenReleaseConsultantModal,
		onOpenEnsemblePlanCommands,
		onOpenDiscussion,
		onToggleHeaderCollapsed,
		onExportMd,
		onDeleteChat,
		onExtractMemoryCell,
		onOpenMembersPanel,
		onRequestLeaveChat,
		canManageMembers,
		canLeave,
		canDeleteChat,
		canExport,
		onOpenGuide,
		lucideStroke,
		t,
	} = props;

	const [moreOpen, setMoreOpen] = React.useState(false);
	const moreWrapRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (!moreOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			const el = moreWrapRef.current;
			if (el && e.target instanceof Node && !el.contains(e.target)) {
				setMoreOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setMoreOpen(false);
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [moreOpen]);

	const exportDisabled =
		!activeId || messagesCount === 0 || sending || !canExport;
	const deleteDisabled = !activeId || sending || !canDeleteChat;

	const closeMore = () => setMoreOpen(false);

	const humanRosterSubtitle = React.useMemo(() => {
		const rows = activeChat?.participants ?? [];
		if (rows.length === 0) return '';
		const selfId = currentUserId?.trim() || '';
		return rows
			.map((p) => {
				if (selfId && p.user_id === selfId) return t('messageFromYouTitle');
				return (p.display_name || '').trim();
			})
			.filter(Boolean)
			.join(' · ');
	}, [activeChat?.participants, currentUserId, t]);

	const ensembleRosterTitleCompact = React.useMemo(
		() =>
			compactDesktopAiHeaderRosterLabel({
				heroShortLabels: ensembleRosterHeroes.map((h) => h.shortLabel),
				fallbackSubtitle: ensembleRosterSubtitle,
			}),
		[ensembleRosterHeroes, ensembleRosterSubtitle]
	);

	return (
		<>
			{isCompactSurface ? (
				<div
					className={cn(
						'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					{t('compactSurfaceHint')}
				</div>
			) : null}
			<div
				className={shellHeaderBarClusterClass}
				data-ai-chat-guide="header-bar"
			>
				{(activeChat?.participants?.length ?? 0) > 0 ? (
					<DesktopAiChatHumanRosterStack
						participants={activeChat?.participants ?? []}
						currentUserId={currentUserId}
						youLabel={t('messageFromYouTitle')}
						sizeClass="h-7 w-7"
					/>
				) : null}
				{isEnsembleActive && ensembleRosterHeroes.length > 0 ? (
					<div className="flex shrink-0 items-center pl-0.5">
						{ensembleRosterHeroes.map((h, i) => (
							<span
								key={h.id}
								className={['relative inline-flex', i > 0 ? '-ml-2' : ''].join(
									' '
								)}
								style={{ zIndex: i + 1 }}
							>
								<DesktopAiChatIconTooltip
									content={t('ensembleRosterHeroTitle', {
										name: h.label,
										header: assistantHeaderLabel,
									})}
								>
									<button
										type="button"
										onClick={() => onOpenRosterHeroDossier(h.id)}
										aria-label={t('ensembleRosterHeroAria', {
											name: h.label,
										})}
										className="h-7 w-7 shrink-0 rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
									>
										<img
											src={h.avatarPublicPath}
											alt=""
											className="pointer-events-none h-7 w-7 rounded-full border-2 border-[color-mix(in_srgb,var(--glass-bg-strong)_90%,#0a0520)] object-cover"
										/>
									</button>
								</DesktopAiChatIconTooltip>
							</span>
						))}
					</div>
				) : activeHeroAvatarPath ? (
					activeChat ? (
						<DesktopAiChatIconTooltip content={t('heroAboutTitle')}>
							<button
								type="button"
								onClick={onOpenHeroDossier}
								aria-label={t('heroAboutAria')}
								className="shrink-0 rounded-full border-0 bg-transparent p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
							>
								<img
									src={activeHeroAvatarPath}
									alt=""
									className="pointer-events-none h-7 w-7 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.38)] object-cover"
								/>
							</button>
						</DesktopAiChatIconTooltip>
					) : (
						<DesktopChromeTooltip
							content={assistantHeaderLabel}
							placement="top"
							offsetExtra={4}
						>
							<img
								src={activeHeroAvatarPath}
								alt=""
								className="h-7 w-7 shrink-0 rounded-full object-cover border border-[rgb(var(--desktop-accent-rgb)/0.38)]"
							/>
						</DesktopChromeTooltip>
					)
				) : activeChat ? (
					<DesktopAiChatIconTooltip content={t('heroAboutTitle')}>
						<button
							type="button"
							onClick={onOpenHeroDossier}
							aria-label={t('heroAboutAria')}
							className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
						>
							<SparklesIcon
								className="pointer-events-none h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
								strokeWidth={lucideStroke}
							/>
						</button>
					</DesktopAiChatIconTooltip>
				) : (
					<DesktopChromeTooltip
						content={assistantHeaderLabel}
						placement="top"
						offsetExtra={4}
					>
						<span className="shrink-0">
							<SparklesIcon
								className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
								strokeWidth={lucideStroke}
							/>
						</span>
					</DesktopChromeTooltip>
				)}
				{activeChat ? (
					<div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
						<DesktopChromeTooltip
							content={[
								assistantHeaderLabel,
								humanRosterSubtitle,
								isEnsembleActive ? ensembleRosterSubtitle : '',
							]
								.filter(Boolean)
								.join(' · ')}
							placement="top"
							offsetExtra={4}
						>
							<p
								className={cn(
									'min-w-0 truncate font-semibold leading-none text-(--desktop-text-secondary) tracking-tight',
									DESKTOP_TYPOGRAPHY.shellCopy13
								)}
							>
								{assistantHeaderLabel}
								{humanRosterSubtitle ? (
									<span className="font-medium normal-case tracking-normal text-(--desktop-text-primary)">
										{' '}
										· {humanRosterSubtitle}
									</span>
								) : null}
								{isEnsembleActive && ensembleRosterTitleCompact ? (
									<span className="font-medium tracking-normal text-[rgb(var(--desktop-accent-rgb)/0.92)]">
										{' '}
										· {ensembleRosterTitleCompact}
									</span>
								) : null}
							</p>
						</DesktopChromeTooltip>
						{!isEnsembleActive &&
						activeChat?.solo_slot_active === true &&
						activeChat.solo_slot_ends_at &&
						soloSlotCountdownLabel ? (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.shellMeta10,
									'shrink-0 tabular-nums text-[rgb(var(--desktop-accent-rgb)/0.95)]'
								)}
								aria-live="polite"
							>
								{t('soloSlotTimeRemaining', {
									time: soloSlotCountdownLabel,
								})}
							</p>
						) : null}
					</div>
				) : null}
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<DesktopAiChatIconTooltip
						content={
							headerCollapsed ? t('expandSettings') : t('collapseSettings')
						}
					>
						<button
							type="button"
							onClick={onToggleHeaderCollapsed}
							aria-expanded={!headerCollapsed}
							aria-label={
								headerCollapsed ? t('expandSettings') : t('collapseSettings')
							}
							className={cn(
								shellHeaderCollapseBtnClass,
								'inline-flex items-center gap-1 rounded-lg px-2',
								!headerCollapsed &&
									'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
							)}
							data-testid="desktop-ai-chat-settings-toggle"
						>
							<Cog6ToothIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
							<span
								className={cn(
									'hidden sm:inline font-medium',
									DESKTOP_TYPOGRAPHY.shellMeta10
								)}
							>
								{t('chatSettingsShort')}
							</span>
						</button>
					</DesktopAiChatIconTooltip>
					<div className="relative" ref={moreWrapRef}>
						<DesktopAiChatIconTooltip content={t('headerMoreTitle')}>
							<button
								type="button"
								onClick={() => setMoreOpen((o) => !o)}
								aria-expanded={moreOpen}
								aria-haspopup="menu"
								aria-label={t('headerMoreAria')}
								className={cn(
									'shrink-0 p-1.5 rounded-lg',
									DESKTOP_INTERACTIVE.btnRounded,
									moreOpen &&
										'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)]'
								)}
								data-testid="desktop-ai-chat-header-more"
							>
								<EllipsisHorizontalIcon
									className="h-4 w-4"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							</button>
						</DesktopAiChatIconTooltip>
						{moreOpen ? (
							<DesktopAppMenuSurface
								role="menu"
								aria-label={t('headerMoreAria')}
								className="absolute right-0 top-full z-50 mt-1 py-1"
								data-testid="desktop-ai-chat-header-more-menu"
							>
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									icon={
										<QuestionMarkCircleIcon
											className="h-4 w-4"
											strokeWidth={lucideStroke}
										/>
									}
									onClick={() => {
										closeMore();
										onOpenGuide();
									}}
								>
									{t('openGuideMenu')}
								</DesktopAppMenuItem>
								{isEnsembleActive ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										icon={
											<QueueListIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											onOpenEnsemblePlanCommands();
										}}
									>
										{t('ensemblePlanCommandsAria')}
									</DesktopAppMenuItem>
								) : null}
								{isEnsembleActive && onOpenDiscussion ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										icon={
											<ChatBubbleLeftRightIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											onOpenDiscussion();
										}}
									>
										{t('discussionOpenMenu')}
									</DesktopAppMenuItem>
								) : null}
								{!isEnsembleActive && soloCanReleaseConsultant ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										disabled={releaseConsultantBusy || sending}
										icon={
											releaseConsultantBusy ? (
												<ArrowPathIcon
													className="h-4 w-4 animate-spin motion-reduce:animate-none"
													strokeWidth={lucideStroke}
												/>
											) : (
												<UserMinusIcon
													className="h-4 w-4"
													strokeWidth={lucideStroke}
												/>
											)
										}
										onClick={() => {
											closeMore();
											onOpenReleaseConsultantModal();
										}}
									>
										{t('soloSlotReleaseConsultant')}
									</DesktopAppMenuItem>
								) : null}
								{canManageMembers ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										icon={
											<UserGroupIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											onOpenMembersPanel();
										}}
									>
										{t('collabMembersMenu')}
									</DesktopAppMenuItem>
								) : null}
								{canLeave ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										icon={
											<ArrowRightOnRectangleIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											onRequestLeaveChat();
										}}
									>
										{t('collabLeaveMenu')}
									</DesktopAppMenuItem>
								) : null}
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									disabled={exportDisabled}
									title={
										exportDisabled
											? t('exportMdDisabledHint')
											: t('exportMdTitle')
									}
									icon={
										<ArrowDownTrayIcon
											className="h-4 w-4"
											strokeWidth={lucideStroke}
										/>
									}
									onClick={() => {
										closeMore();
										onExportMd();
									}}
								>
									{t('exportMdAria')}
								</DesktopAppMenuItem>
								{canDeleteChat && onExtractMemoryCell ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										disabled={deleteDisabled}
										title={
											activeChat?.memory_cell_id
												? t('memoryCellExtractUpdate')
												: t('memoryCellExtractCreate')
										}
										icon={
											<SparklesIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											void onExtractMemoryCell();
										}}
									>
										{activeChat?.memory_cell_id
											? t('memoryCellExtractUpdate')
											: t('memoryCellExtractCreate')}
									</DesktopAppMenuItem>
								) : null}
								{canDeleteChat ? (
									<DesktopAppMenuItem
										type="button"
										role="menuitem"
										tone="danger"
										disabled={deleteDisabled}
										title={
											deleteDisabled
												? t('deleteChatDisabledHint')
												: t('deleteChatAria')
										}
										icon={
											<TrashIcon
												className="h-4 w-4"
												strokeWidth={lucideStroke}
											/>
										}
										onClick={() => {
											closeMore();
											void onDeleteChat();
										}}
									>
										{t('deleteChatAria')}
									</DesktopAppMenuItem>
								) : null}
							</DesktopAppMenuSurface>
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}
