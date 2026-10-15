/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat messages pane orchestrator: section shell, day dividers,
 * message rows, peer-generating status, and scroll-down FAB.
 *
 * Invariants:
 * - data-testid / data-ai-chat-guide="thread" on the scroll section.
 * - desktop-ai-chat-peer-generating when peer holds stream lock.
 *
 * Related:
 * - DesktopAiChatMessagesPane.tsx (facade)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import { ArrowDownIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS } from '../../layout/desktopAiChatLayoutTokens';
import { DesktopAiChatIconTooltip } from '../desktopAiChatIconTooltip';
import { buildDesktopAiChatMessageRowModel } from './buildDesktopAiChatMessageRowModel';
import { DesktopAiChatLoadOlderBanner } from './DesktopAiChatLoadOlderBanner';
import { DesktopAiChatMessageRow } from './DesktopAiChatMessageRow';
import type { DesktopAiChatMessagesPaneProps } from './desktopAiChatMessagesPaneTypes';
import { DesktopAiChatThreadStates } from './DesktopAiChatThreadStates';
import { useDesktopAiChatLoadOlderBanner } from './useDesktopAiChatLoadOlderBanner';

export function DesktopAiChatMessagesPaneView(
	props: DesktopAiChatMessagesPaneProps
) {
	const {
		scrollRef,
		messagesRegionId,
		messagesTestId,
		shellMessagesPanelClass,
		showLoadOlderMessages,
		messages,
		messagesTotal,
		messagesLoadingOlder,
		onLoadOlderMessages,
		loadingList,
		activeId,
		chatsCount,
		messagesLoading,
		messagesLoadState,
		onRetryLoadMessages,
		sending,
		streamLockHeldByOther = false,
		isEnsembleActive,
		ensembleRosterSubtitle,
		messageListEntries,
		activeChat,
		activeHeroId,
		assistantHeaderLabel,
		ensembleDocConfirm,
		soloSendsBlocked,
		canRegenerate,
		canDeleteMessages,
		isSharedChat,
		currentUserId,
		ensembleActiveSpeakerId = null,
		webSearchSourcesByMessageId,
		saveBlueprintToProjectBusyId,
		showScrollDown,
		lowGpu,
		onMessagesScroll,
		scrollMessagesToBottom,
		onRegenerate,
		onCopyBubble,
		onDeleteUserMessage,
		onSaveBlueprintToProject,
		onStartInterviewFromMessage,
		interviewStartBusy = false,
		onExportAssistantMarkdown,
		onOpenBubbleHeroDossier,
		onBubbleContextMenu,
		i18nLanguage,
		lucideStroke,
		onOpenNewChat,
		onFocusComposer,
		t,
	} = props;

	const {
		loadOlderBannerDismissed,
		dismissLoadOlderBanner,
		restoreLoadOlderBanner,
	} = useDesktopAiChatLoadOlderBanner(activeId);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">
			<section
				id={messagesRegionId}
				data-testid={messagesTestId}
				data-ai-chat-guide="thread"
				ref={scrollRef}
				aria-label={t('messagesRegion')}
				tabIndex={-1}
				onScroll={onMessagesScroll}
				className={shellMessagesPanelClass}
			>
				<DesktopAiChatLoadOlderBanner
					activeId={activeId}
					showLoadOlderMessages={showLoadOlderMessages}
					loadOlderBannerDismissed={loadOlderBannerDismissed}
					messagesLength={messages.length}
					messagesTotal={messagesTotal}
					messagesLoadingOlder={messagesLoadingOlder}
					lowGpu={lowGpu}
					lucideStroke={lucideStroke}
					onLoadOlderMessages={onLoadOlderMessages}
					onDismiss={dismissLoadOlderBanner}
					onRestore={restoreLoadOlderBanner}
					t={t}
				/>
				<DesktopAiChatThreadStates
					loadingList={loadingList}
					activeId={activeId}
					chatsCount={chatsCount}
					messagesLength={messages.length}
					messagesLoading={messagesLoading}
					messagesLoadState={messagesLoadState}
					sending={sending}
					isEnsembleActive={isEnsembleActive}
					ensembleRosterSubtitle={ensembleRosterSubtitle}
					onRetryLoadMessages={onRetryLoadMessages}
					onOpenNewChat={onOpenNewChat}
					onFocusComposer={onFocusComposer}
					t={t}
				/>
				{messageListEntries.map((entry) => {
					if (entry.kind === 'day') {
						return (
							<div
								key={entry.key}
								className="-mx-3 flex justify-center border-b border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)] py-1.5 px-3"
							>
								<span
									className={cn(
										'rounded-full border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] px-2.5 py-0.5 uppercase tracking-wider text-(--desktop-text-dim)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{entry.label}
								</span>
							</div>
						);
					}
					const model = buildDesktopAiChatMessageRowModel({
						message: entry.msg,
						compactTop: entry.compactTop,
						messages,
						sending,
						i18nLanguage,
						activeHeroId,
						assistantHeaderLabel,
						isEnsembleActive,
						ensembleDocConfirm,
						soloSendsBlocked,
						canRegenerate,
						canDeleteMessages,
						isSharedChat,
						currentUserId,
						activeChat,
						webSearchSourcesByMessageId,
						peerAuthorFallback: t('messageFromPeerFallback'),
					});
					return (
						<DesktopAiChatMessageRow
							key={entry.msg.id}
							model={model}
							sending={sending}
							isEnsembleActive={isEnsembleActive}
							canDeleteMessages={canDeleteMessages}
							saveBlueprintToProjectBusyId={saveBlueprintToProjectBusyId}
							lucideStroke={lucideStroke}
							onRegenerate={onRegenerate}
							onCopyBubble={onCopyBubble}
							onDeleteUserMessage={onDeleteUserMessage}
							onSaveBlueprintToProject={onSaveBlueprintToProject}
							onStartInterviewFromMessage={onStartInterviewFromMessage}
							interviewStartBusy={interviewStartBusy}
							onExportAssistantMarkdown={onExportAssistantMarkdown}
							onOpenBubbleHeroDossier={onOpenBubbleHeroDossier}
							onBubbleContextMenu={onBubbleContextMenu}
							ensembleActiveSpeakerId={ensembleActiveSpeakerId}
							t={t}
						/>
					);
				})}
				{streamLockHeldByOther && !sending ? (
					<div
						className={cn(
							'flex w-full items-center gap-2 px-1 py-2',
							DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS
						)}
						role="status"
						aria-live="polite"
						data-testid="desktop-ai-chat-peer-generating"
					>
						<span
							className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.9)] motion-reduce:animate-none"
							aria-hidden
						/>
						<span
							className={cn(
								'text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('collabPeerGenerating')}
						</span>
					</div>
				) : null}
			</section>
			{showScrollDown ? (
				<DesktopAiChatIconTooltip content={t('scrollToNewTitle')}>
					<button
						type="button"
						onClick={scrollMessagesToBottom}
						className={cn(
							`absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.2)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.5)_100%,transparent)] text-white shadow-lg ${DESKTOP_INTERACTIVE.btnRounded}`,
							!lowGpu && 'backdrop-blur-sm'
						)}
						aria-label={t('scrollToNewAria')}
					>
						<ArrowDownIcon className="h-4 w-4" strokeWidth={lucideStroke} />
					</button>
				</DesktopAiChatIconTooltip>
			) : null}
		</div>
	);
}
