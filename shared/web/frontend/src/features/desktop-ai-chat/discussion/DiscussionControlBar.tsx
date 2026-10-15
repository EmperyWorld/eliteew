/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion control bar by session status.
 *
 * Invariants:
 * - Composer enablement is owned by parent via controls.composerEnabled.
 * - Poll fallback shows an honest live-degraded caption (not silent lag).
 *
 * Related:
 * - discussionControls.ts
 * - discussionLiveTransport.ts
 */
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DiscussionControlVisibility, DiscussionSession } from './types';

export function DiscussionControlBar({
	session,
	controls,
	busy,
	liveDegraded = false,
	onRaiseHand,
	onContinue,
	onFinish,
	onCancel,
	onGenerateDocument,
}: {
	session: DiscussionSession;
	controls: DiscussionControlVisibility;
	busy: boolean;
	liveDegraded?: boolean;
	onRaiseHand: () => void;
	onContinue: () => void;
	onFinish: () => void;
	onCancel: () => void;
	onGenerateDocument: () => void;
}) {
	const { t } = useTranslation('desktopAiChat');
	const checkpointProgress = Math.min(
		5,
		Math.max(0, Number(session.checkpoint_ai_turns || 0))
	);

	return (
		<div className="mt-3 flex flex-col gap-2 border-t border-(--desktop-border-subtle) pt-3">
			{(session.status === 'running' || session.status === 'queued') && (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionCheckpointProgress', { n: checkpointProgress, max: 5 })}
				</p>
			)}
			{session.status === 'paused_user' && (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionPausedUserHint')}
				</p>
			)}
			{(session.status === 'paused_checkpoint' ||
				session.status === 'paused_goal' ||
				session.status === 'paused_error') && (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('discussionPausedReplyHint')}
				</p>
			)}
			{session.pause_requested &&
				(session.status === 'running' || session.status === 'queued') && (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('discussionRaiseHandPending')}
					</p>
				)}
			{liveDegraded ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
					data-testid="discussion-live-degraded"
				>
					{t('discussionLiveDegraded')}
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				{controls.raiseHand ? (
					<button
						type="button"
						disabled={busy}
						onClick={onRaiseHand}
						className="rounded-md border border-(--desktop-border-subtle) px-3 py-1.5 text-sm text-(--desktop-text-primary) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] disabled:opacity-50"
					>
						{t('discussionRaiseHand')}
					</button>
				) : null}
				{controls.continue ? (
					<button
						type="button"
						disabled={busy}
						onClick={onContinue}
						className="rounded-md bg-[rgb(var(--desktop-accent-rgb))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
					>
						{t('discussionContinue')}
					</button>
				) : null}
				{controls.generateDocument ? (
					<button
						type="button"
						disabled={busy}
						onClick={onGenerateDocument}
						className="rounded-md border border-(--desktop-border-subtle) px-3 py-1.5 text-sm text-(--desktop-text-primary) disabled:opacity-50"
					>
						{t('discussionGenerateDocument')}
					</button>
				) : null}
				{controls.finish ? (
					<button
						type="button"
						disabled={busy}
						onClick={onFinish}
						className="rounded-md border border-(--desktop-border-subtle) px-3 py-1.5 text-sm text-(--desktop-text-secondary) disabled:opacity-50"
					>
						{t('discussionFinish')}
					</button>
				) : null}
				{controls.cancel ? (
					<button
						type="button"
						disabled={busy}
						onClick={onCancel}
						className="rounded-md px-3 py-1.5 text-sm text-(--desktop-text-secondary) disabled:opacity-50"
					>
						{t('discussionCancel')}
					</button>
				) : null}
			</div>
		</div>
	);
}
