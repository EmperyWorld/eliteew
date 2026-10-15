/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single Discussion bubble: Process | Document tabs + control bar.
 *
 * Invariants:
 * - Document tab only shows persisted markdown; stale badge when document_stale.
 * - Header close dismisses the panel only; Finish/Cancel own the discussion process.
 *
 * Related:
 * - DesktopAiCouncilTabsShell.tsx
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import * as React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAiChatMarkdown } from '../DesktopAiChatMarkdown';
import { DiscussionControlBar } from './DiscussionControlBar';
import { DiscussionProcessPanel } from './DiscussionProcessPanel';
import type { DiscussionControlVisibility, DiscussionSession } from './types';

export function DiscussionBubble({
	session,
	controls,
	busy,
	liveDegraded = false,
	onClosePanel,
	onRaiseHand,
	onContinue,
	onFinish,
	onCancel,
	onGenerateDocument,
	composerSlot,
}: {
	session: DiscussionSession;
	controls: DiscussionControlVisibility;
	busy: boolean;
	liveDegraded?: boolean;
	/** Hide the bubble UI without finishing/cancelling the discussion process. */
	onClosePanel: () => void;
	onRaiseHand: () => void;
	onContinue: () => void;
	onFinish: () => void;
	onCancel: () => void;
	onGenerateDocument: () => void;
	composerSlot?: React.ReactNode;
}) {
	const { t } = useTranslation('desktopAiChat');
	const [tab, setTab] = React.useState<'process' | 'document'>('process');
	const hasDoc = Boolean(session.document_markdown?.trim());

	return (
		<div
			className="w-full min-w-0 rounded-xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.72)_100%,transparent)] p-4"
			data-discussion-session={session.id}
			data-discussion-status={session.status}
			data-testid="discussion-panel"
		>
			<header className="mb-3 flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('discussionModeLabel')}
					</p>
					<h3
						className={cn(
							DESKTOP_TYPOGRAPHY.title,
							'text-(--desktop-text-primary)'
						)}
					>
						{session.topic || t('discussionUntitled')}
					</h3>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="rounded-md border border-(--desktop-border-subtle) px-2 py-1 text-xs text-(--desktop-text-secondary)">
						{t(`discussionStatus.${session.status}`, {
							defaultValue: session.status,
						})}
					</span>
					<button
						type="button"
						onClick={onClosePanel}
						className={cn(
							'inline-flex items-center gap-1 rounded-lg border border-(--desktop-border-subtle) px-2 py-1.5 text-sm font-medium text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
							DESKTOP_INTERACTIVE.btnRounded,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label={t('discussionPanelCloseAria')}
						data-testid="discussion-panel-close"
					>
						<span className="hidden sm:inline">
							{t('discussionPanelClose')}
						</span>
						<XMarkIcon className="size-4" aria-hidden />
					</button>
				</div>
			</header>

			<div className="mb-3 flex gap-2">
				<button
					type="button"
					onClick={() => setTab('process')}
					className={cn(
						'rounded-md px-2.5 py-1 text-sm',
						tab === 'process'
							? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] text-(--desktop-text-primary)'
							: 'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionTabProcess')}
				</button>
				<button
					type="button"
					onClick={() => setTab('document')}
					disabled={!hasDoc}
					className={cn(
						'rounded-md px-2.5 py-1 text-sm disabled:opacity-40',
						tab === 'document'
							? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] text-(--desktop-text-primary)'
							: 'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionTabDocument')}
					{session.document_stale ? ` · ${t('discussionDocumentStale')}` : ''}
				</button>
			</div>

			{tab === 'process' ? (
				<DiscussionProcessPanel
					turns={session.turns ?? []}
					sessionDisplayName={session.participant_display_name}
					sessionRoleTitle={session.participant_role_title}
				/>
			) : hasDoc ? (
				<div className="max-h-[min(52vh,420px)] overflow-y-auto">
					<DesktopAiChatMarkdown
						markdown={session.document_markdown ?? ''}
						presentation="chat"
					/>
				</div>
			) : (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionDocumentEmpty')}
				</p>
			)}

			{controls.composerEnabled ? composerSlot : null}

			<DiscussionControlBar
				session={session}
				controls={controls}
				busy={busy}
				liveDegraded={liveDegraded}
				onRaiseHand={onRaiseHand}
				onContinue={onContinue}
				onFinish={onFinish}
				onCancel={onCancel}
				onGenerateDocument={onGenerateDocument}
			/>
		</div>
	);
}
