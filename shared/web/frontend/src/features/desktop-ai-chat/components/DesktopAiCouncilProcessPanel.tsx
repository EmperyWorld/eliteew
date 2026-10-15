/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave F2 Process tab — chronological council mini-chat from persisted
 * `council_transcript` (briefs, speaker replies, future closing).
 *
 * Invariants:
 * - User-facing copy only; no SSE/metadata operator jargon in default UI.
 * - Auto-scrolls to newest turn while the list grows (live stream or reload).
 * - transcript.mode === 'discussion' is Council separate-delivery (user: «по очереди» /
 *   «in turn»), not product Discussion mode.
 *
 * Related:
 * - ensemble/types.ts DesktopCouncilTranscript
 * - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol)
 */
import * as React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { DesktopCouncilTranscript } from '../ensemble/types';
import { DesktopAiChatMarkdown } from '../DesktopAiChatMarkdown';
import { getDesktopAiHero, heroAvatarPublicPath } from '../desktopAiHeroes';
import { stripCouncilProcessTurnMarkdown } from '../utils/councilProcessMarkdown';
import { desktopAiChatAuthorInitials } from '../utils/desktopAiChatOwnUserMessage';

function CouncilSpeakerAvatar({
	heroId,
	size = 'md',
}: {
	heroId?: string | null;
	size?: 'md' | 'sm';
}) {
	const hero = heroId ? getDesktopAiHero(heroId) : undefined;
	const path = heroAvatarPublicPath(heroId);
	const label = hero?.shortLabel ?? heroId ?? '';
	const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
	return (
		<div
			className={cn(
				'shrink-0 overflow-hidden rounded-full border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.34)_100%,transparent)]',
				dim
			)}
			role="img"
			aria-hidden={!label}
			aria-label={label || undefined}
		>
			{path ? (
				<img
					src={path}
					alt=""
					className="pointer-events-none h-full w-full object-cover"
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]">
					{label ? (
						<span
							className={cn(
								'font-semibold text-(--desktop-text-secondary)',
								size === 'sm' ? 'text-[0.65rem]' : 'text-xs'
							)}
						>
							{desktopAiChatAuthorInitials(label)}
						</span>
					) : (
						<SparklesIcon
							className="h-3.5 w-3.5 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
							strokeWidth={2}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export function DesktopAiCouncilProcessPanel({
	transcript,
	live = false,
	activeSpeakerId = null,
}: {
	transcript: DesktopCouncilTranscript;
	live?: boolean;
	/** Live stream: show ephemeral «думает» until this speaker's reply lands. */
	activeSpeakerId?: string | null;
}) {
	const { t } = useTranslation('desktopAiChat');
	const scrollerRef = React.useRef<HTMLDivElement>(null);
	const visibleTurns = transcript.turns.filter(
		(turn) => turn.kind !== 'orchestrator_brief'
	);
	const turnCount = visibleTurns.length;
	const repliedHeroIds = new Set(
		visibleTurns
			.filter((turn) => turn.kind === 'speaker_reply' && turn.hero_id)
			.map((turn) => turn.hero_id as string)
	);
	const showThinking =
		live && activeSpeakerId && !repliedHeroIds.has(activeSpeakerId);
	const thinkingLabel = activeSpeakerId
		? (getDesktopAiHero(activeSpeakerId)?.shortLabel ?? activeSpeakerId)
		: null;

	React.useEffect(() => {
		if (turnCount === 0 && !live && !showThinking) {
			return;
		}
		const scroller = scrollerRef.current;
		if (!scroller) {
			return;
		}
		scroller.scrollTop = scroller.scrollHeight;
	}, [turnCount, live, showThinking]);

	const modeLabel =
		transcript.mode === 'discussion'
			? t('councilModeDiscussion')
			: t('councilModeJoint');

	return (
		<section
			className="flex min-h-48 flex-col rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)]"
			aria-label={t('councilProcessAria')}
		>
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--desktop-border-subtle) px-3 py-2">
				<div className="min-w-0">
					<p
						className={cn(
							'font-semibold text-(--desktop-text-primary)',
							'text-sm'
						)}
					>
						{t('councilProcessTitle')}
					</p>
					<p
						className={cn(
							'mt-0.5 text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
					>
						{live
							? t('councilProcessLiveSubtitle')
							: t('councilProcessArchiveSubtitle')}
						{' · '}
						{modeLabel}
					</p>
				</div>
				{transcript.roster.length > 0 ? (
					<div className="flex max-w-full flex-wrap gap-1">
						{transcript.roster.map((hid) => (
							<span
								key={hid}
								className="rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,transparent)] px-1.5 py-0.5 text-xs text-(--desktop-text-secondary)"
							>
								{getDesktopAiHero(hid)?.shortLabel ?? hid}
							</span>
						))}
					</div>
				) : null}
			</div>
			{transcript.closing?.decision ? (
				<p
					role="note"
					className={cn(
						'mx-3 mt-2 rounded-md border px-2.5 py-1.5 text-xs leading-snug',
						transcript.closing.decision === 'ok'
							? 'border-emerald-400/30 bg-emerald-400/8 text-emerald-50/95'
							: 'border-amber-300/35 bg-amber-300/10 text-amber-50/95',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					{transcript.closing.decision === 'ok'
						? t('councilClosingOk')
						: t('councilClosingSupplement')}
					{transcript.closing.notes ? ` — ${transcript.closing.notes}` : null}
				</p>
			) : null}

			<div
				ref={scrollerRef}
				className="max-h-[min(28rem,55vh)] flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5"
				role="log"
				aria-live={live ? 'polite' : 'off'}
			>
				{visibleTurns.length === 0 && !showThinking ? (
					<p
						className={cn(
							'py-6 text-center text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('councilProcessEmpty')}
					</p>
				) : (
					visibleTurns.map((turn, idx) => {
						const who =
							turn.label?.trim() ||
							(turn.hero_id
								? (getDesktopAiHero(turn.hero_id)?.shortLabel ?? turn.hero_id)
								: null) ||
							(turn.kind === 'orchestrator_brief'
								? t('councilRoleLead')
								: turn.kind === 'closing'
									? t('councilRoleClosing')
									: t('councilRoleSpeaker'));
						const kindLabel =
							turn.kind === 'orchestrator_brief'
								? t('councilTurnBrief')
								: turn.kind === 'closing'
									? t('councilTurnClosing')
									: t('councilTurnReply');
						const key = `${turn.kind}-${turn.at_ms}-${turn.hero_id ?? 'x'}-${idx}`;
						return (
							<article
								key={key}
								className={cn(
									'rounded-lg border px-2.5 py-2',
									turn.kind === 'speaker_reply'
										? 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.07)]'
										: turn.kind === 'closing'
											? 'border-emerald-400/30 bg-emerald-400/8'
											: 'border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]'
								)}
							>
								<header className="mb-1.5 flex items-start gap-2">
									{turn.hero_id ? (
										<CouncilSpeakerAvatar heroId={turn.hero_id} />
									) : null}
									<div className="min-w-0 flex-1 flex flex-wrap items-baseline justify-between gap-1.5">
										<p
											className={cn(
												'font-semibold text-(--desktop-text-primary)',
												'text-sm'
											)}
										>
											{who}
										</p>
										<span
											className={cn(
												'uppercase tracking-wide text-(--desktop-text-muted)',
												DESKTOP_TYPOGRAPHY.shellMeta10
											)}
										>
											{kindLabel}
										</span>
									</div>
								</header>
								<div className="min-w-0 text-(--desktop-text-secondary)">
									<DesktopAiChatMarkdown
										markdown={stripCouncilProcessTurnMarkdown(turn.text)}
										presentation="chat"
									/>
								</div>
							</article>
						);
					})
				)}
				{showThinking && thinkingLabel ? (
					<article
						className="rounded-lg border border-dashed border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.05)] px-2.5 py-2"
						role="status"
						aria-live="polite"
					>
						<div className="flex items-center gap-2">
							{activeSpeakerId ? (
								<CouncilSpeakerAvatar heroId={activeSpeakerId} size="sm" />
							) : null}
							<p
								className={cn(
									'text-sm text-(--desktop-text-secondary) italic',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
							>
								{t('councilSpeakerThinking', { name: thinkingLabel })}
							</p>
						</div>
					</article>
				) : null}
			</div>
		</section>
	);
}
