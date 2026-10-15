/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * No-chat hero, messages load error, skeleton, and empty-thread states for Desktop AI Chat.
 *
 * Invariants:
 * - DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID on error panel.
 * - Skeleton columns use DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS.
 *
 * Related:
 * - DesktopAiChatMessagesPaneView.tsx
 * - layout/DesktopAiChatStatePanel.tsx
 */
import type { TFunction } from 'i18next';
import {
	DesktopAppButton,
	DesktopProductNextAction,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopAiChatLoadState } from '../../desktopAiChatSurfaceState';
import { DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID } from '../../desktopAiChatDomIds';
import { DesktopAiChatStatePanel } from '../../layout/DesktopAiChatStatePanel';
import { DesktopAiChatWorkspaceHero } from '../../layout/DesktopAiChatWorkspaceHero';
import { DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS } from '../../layout/desktopAiChatLayoutTokens';

export type DesktopAiChatThreadStatesProps = {
	loadingList: boolean;
	activeId: string | null;
	chatsCount: number;
	messagesLength: number;
	messagesLoading: boolean;
	messagesLoadState: DesktopAiChatLoadState;
	sending: boolean;
	isEnsembleActive: boolean;
	ensembleRosterSubtitle: string;
	onRetryLoadMessages: () => void;
	onOpenNewChat: () => void;
	onFocusComposer: () => void;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatThreadStates(
	props: DesktopAiChatThreadStatesProps
) {
	const {
		loadingList,
		activeId,
		chatsCount,
		messagesLength,
		messagesLoading,
		messagesLoadState,
		sending,
		isEnsembleActive,
		ensembleRosterSubtitle,
		onRetryLoadMessages,
		onOpenNewChat,
		onFocusComposer,
		t,
	} = props;

	return (
		<>
			{!loadingList && !activeId ? (
				<div className="flex h-full min-h-40 items-center justify-center p-6">
					<DesktopAiChatWorkspaceHero
						eyebrow={t('workspaceHero.eyebrow')}
						title={
							chatsCount
								? t('workspaceHero.pickChat.title')
								: t('workspaceHero.noChats.title')
						}
						description={
							chatsCount
								? t('workspaceHero.pickChat.description')
								: t('workspaceHero.noChats.description')
						}
						primaryAction={
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={onOpenNewChat}
							>
								{t('workspaceHero.primaryCta')}
							</DesktopAppButton>
						}
					/>
				</div>
			) : null}
			{activeId && messagesLoadState === 'error' ? (
				<div
					data-testid={DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID}
					className="flex h-full min-h-40 items-center justify-center p-4"
				>
					<DesktopAiChatStatePanel
						state="error"
						title={t('messagesLoadErrorInline')}
						description={t('messagesLoadErrorInlineHint')}
						onRetry={onRetryLoadMessages}
						retryLabel={t('messagesLoadRetry')}
						className="min-h-0 w-full max-w-md"
					/>
				</div>
			) : null}
			{activeId && messagesLoading && !sending ? (
				<div className="space-y-3 py-2" aria-busy="true">
					<p
						className={cn(
							'px-3 text-center text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						role="status"
						aria-live="polite"
					>
						{t('statePanel.loading.title')}
					</p>
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={cn(
								'mx-auto h-20 w-full rounded-2xl bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)] animate-pulse motion-reduce:animate-none',
								DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS
							)}
						/>
					))}
				</div>
			) : null}
			{activeId &&
			messagesLength === 0 &&
			!sending &&
			!loadingList &&
			messagesLoadState === 'ready' ? (
				<div className="mx-auto max-w-md px-4 py-6">
					<DesktopProductNextAction
						title={
							isEnsembleActive
								? t('messagesEmptyEnsembleLead', {
										roster:
											ensembleRosterSubtitle || t('heroesCatalogFallback'),
									})
								: t('messagesEmptySoloLead')
						}
						description={
							isEnsembleActive
								? t('messagesEmptyEnsembleHint')
								: t('messagesEmptySoloHint')
						}
						actions={
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={onFocusComposer}
							>
								{t('workspaceHero.composePrimaryCta')}
							</DesktopAppButton>
						}
					/>
				</div>
			) : null}
		</>
	);
}
