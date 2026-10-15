/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single ticket card chrome for Feedback Hub history list: badges, body, team reply, reward.
 *
 * Invariants:
 * - admin_notes rendered as team reply when present; reward only on closed tickets.
 *
 * Related:
 * - FeedbackHubTicketListSection.tsx · FEEDBACK-HUB.md
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import {
	BugAntIcon,
	ChatBubbleLeftRightIcon,
	ClipboardDocumentIcon,
	LightBulbIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { FeedbackTicket } from '../../services/productDesktopApi';
import {
	feedbackKindBadgeClass,
	feedbackKindLabel,
	feedbackStatusBadgeClass,
	feedbackStatusLabel,
} from '../../utils/feedbackLabels';
import { formatFeedbackListDate } from '../../utils/feedbackHubLocale';
import {
	formatFeedbackRewardCredits,
	hasVisibleFeedbackReward,
} from '../../utils/feedbackHubSubmitGate';
import { DesktopAppButton, DesktopAppSurface } from '../DesktopAppChrome';

export type FeedbackHubTicketCardProps = {
	ticket: FeedbackTicket;
	highlightedId: string | null;
	t: TFunction<'desktopUi', 'feedbackHub'>;
	tFeedbackLabels: TFunction<'desktopUi'>;
	locale: string;
	onCopyTicketId: (ticketId: string) => void;
};

export function FeedbackHubTicketCard({
	ticket,
	highlightedId,
	t,
	tFeedbackLabels,
	locale,
	onCopyTicketId,
}: FeedbackHubTicketCardProps): React.ReactElement {
	const ticketKindLabel = feedbackKindLabel(ticket.kind, tFeedbackLabels);
	const ticketStatusLabel = feedbackStatusLabel(ticket.status, tFeedbackLabels);
	const ticketDateLabel = formatFeedbackListDate(ticket.created_at, locale);
	const ticketClosedAtLabel =
		ticket.status === 'closed' && ticket.closed_at
			? formatFeedbackListDate(ticket.closed_at, locale)
			: null;
	const ticketHeadingId = `feedback-ticket-heading-${ticket.id}`;

	return (
		<article
			id={`feedback-ticket-article-${ticket.id}`}
			tabIndex={highlightedId === ticket.id ? -1 : undefined}
			aria-labelledby={ticketHeadingId}
		>
			<p id={ticketHeadingId} className="sr-only">
				{t('ticketCardHeading', {
					kind: ticketKindLabel,
					status: ticketStatusLabel,
					date: ticketDateLabel,
				})}
			</p>
			<DesktopAppSurface
				variant="soft"
				padding="md"
				className={cn(
					'relative overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
					'ring-1 ring-[color-mix(in_srgb,rgb(255_255_255)_6%,transparent)]',
					'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
					'hover:border-(--desktop-border-strong)/35 hover:shadow-(--desktop-shadow-soft)',
					'before:pointer-events-none before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-full',
					ticket.kind === 'bug'
						? 'before:bg-[color-mix(in_srgb,rgb(244_63_94)_75%,transparent)]'
						: 'before:bg-[color-mix(in_srgb,rgb(34_211_238)_70%,transparent)]',
					highlightedId === ticket.id &&
						'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
				)}
			>
				<div className="mb-2 flex flex-wrap items-center justify-between gap-2 pl-1">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide',
								DESKTOP_TYPOGRAPHY.captionInherit,
								feedbackKindBadgeClass(ticket.kind)
							)}
						>
							{ticket.kind === 'bug' ? (
								<BugAntIcon
									className="h-3 w-3 opacity-90"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<LightBulbIcon
									className="h-3 w-3 opacity-90"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{ticketKindLabel}
						</span>
						<span
							className={cn(
								'inline-flex items-center rounded-full border px-2 py-0.5 font-medium',
								DESKTOP_TYPOGRAPHY.captionInherit,
								feedbackStatusBadgeClass(ticket.status)
							)}
						>
							{ticketStatusLabel}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`${DESKTOP_TYPOGRAPHY.meta} max-w-36 truncate font-mono tabular-nums text-(--desktop-text-dim)`}
							title={ticket.id}
						>
							{t('ticketIdShort', { id: ticket.id.slice(0, 8) })}
						</span>
						{ticketClosedAtLabel ? (
							<span
								className={`${DESKTOP_TYPOGRAPHY.meta} tabular-nums text-(--desktop-text-muted)`}
							>
								{t('ticketClosedAt', { date: ticketClosedAtLabel })}
							</span>
						) : null}
						<time
							className={`${DESKTOP_TYPOGRAPHY.meta} tabular-nums`}
							dateTime={ticket.created_at}
						>
							{ticketDateLabel}
						</time>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className={cn('h-7 min-w-0 px-2', DESKTOP_TYPOGRAPHY.caption)}
							aria-label={t('copyTicketIdAria')}
							onClick={() => void onCopyTicketId(ticket.id)}
						>
							<ClipboardDocumentIcon
								className="h-3.5 w-3.5 shrink-0"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('copyTicketId')}
						</DesktopAppButton>
					</div>
				</div>
				<p
					className={`${DESKTOP_TYPOGRAPHY.body} whitespace-pre-wrap pl-1 text-(--desktop-text-primary)`}
				>
					{ticket.body}
				</p>
				{ticket.admin_notes ? (
					<section
						className={cn(
							'mt-3 flex gap-2 rounded-(--desktop-radius) border border-emerald-500/25',
							'bg-[color-mix(in_srgb,rgb(16_185_129)_12%,var(--desktop-surface-soft))] px-3 py-2.5',
							DESKTOP_TYPOGRAPHY.small
						)}
						aria-labelledby={`feedback-team-reply-${ticket.id}`}
					>
						<ChatBubbleLeftRightIcon
							className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<div>
							<div
								id={`feedback-team-reply-${ticket.id}`}
								className={cn(
									'mb-0.5 font-medium text-emerald-200/95',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
							>
								{t('teamReply')}
							</div>
							<div className="whitespace-pre-wrap text-emerald-100/95">
								{ticket.admin_notes}
							</div>
						</div>
					</section>
				) : null}
				{ticket.status === 'closed' &&
				hasVisibleFeedbackReward(ticket.reward_credits) ? (
					<div
						className={cn(
							'mt-3 flex gap-2 rounded-(--desktop-radius) border border-amber-500/30',
							'bg-[color-mix(in_srgb,rgb(245_158_11)_12%,var(--desktop-surface-soft))] px-3 py-2.5',
							DESKTOP_TYPOGRAPHY.small
						)}
						role="status"
					>
						<SparklesIcon
							className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<div className="text-amber-100/95">
							{t('ticketRecognition', {
								amount: formatFeedbackRewardCredits(ticket.reward_credits),
							})}
						</div>
					</div>
				) : null}
			</DesktopAppSurface>
		</article>
	);
}
