/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion transcript panel (Process tab content).
 *
 * Invariants:
 * - User-facing copy only; relation shown as short badge.
 *
 * Related:
 * - DesktopAiCouncilProcessPanel.tsx (visual kinship)
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAiChatMarkdown } from '../DesktopAiChatMarkdown';
import { getDesktopAiHero, heroAvatarPublicPath } from '../desktopAiHeroes';
import type { DiscussionTurn } from './types';

function Avatar({ heroId }: { heroId?: string | null }) {
	const hero = heroId ? getDesktopAiHero(heroId) : undefined;
	const path = heroAvatarPublicPath(heroId);
	return (
		<div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-(--desktop-border-subtle)">
			{path ? (
				<img src={path} alt="" className="h-full w-full object-cover" />
			) : (
				<div className="flex h-full w-full items-center justify-center text-[0.65rem] font-semibold text-(--desktop-text-secondary)">
					{hero?.shortLabel?.slice(0, 2) ?? '·'}
				</div>
			)}
		</div>
	);
}

export function DiscussionProcessPanel({
	turns,
	sessionDisplayName,
	sessionRoleTitle,
}: {
	turns: DiscussionTurn[];
	sessionDisplayName?: string;
	sessionRoleTitle?: string;
}) {
	const { t } = useTranslation('desktopAiChat');
	const bottomRef = React.useRef<HTMLDivElement | null>(null);

	const turnCount = turns.length;
	React.useEffect(() => {
		if (turnCount < 0) return;
		bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [turnCount]);

	if (!turns.length) {
		return (
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-secondary)'
				)}
			>
				{t('discussionEmptyTranscript')}
			</p>
		);
	}

	const fallbackUserLabel = (() => {
		const name = sessionDisplayName?.trim() || t('discussionUserTurn');
		const role = sessionRoleTitle?.trim() || 'инкогнито';
		return `${name} (${role})`;
	})();

	return (
		<div className="flex max-h-[min(52vh,420px)] flex-col gap-3 overflow-y-auto pr-1">
			{turns.map((turn) => {
				const isUser = turn.actor_type === 'user';
				const metaLabel =
					typeof turn.metadata?.speaker_label === 'string'
						? turn.metadata.speaker_label.trim()
						: '';
				const label = isUser
					? metaLabel || fallbackUserLabel
					: (getDesktopAiHero(turn.hero_id ?? undefined)?.shortLabel ??
						turn.hero_id ??
						t('discussionAiTurn'));
				return (
					<div key={turn.id} className="flex gap-2">
						{!isUser ? (
							<Avatar heroId={turn.hero_id} />
						) : (
							<div className="w-7" />
						)}
						<div className="min-w-0 flex-1">
							<div className="mb-1 flex flex-wrap items-center gap-2">
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'font-semibold text-(--desktop-text-primary)'
									)}
								>
									{label}
								</span>
								<span className="rounded-md border border-(--desktop-border-subtle) px-1.5 py-0.5 text-[0.65rem] text-(--desktop-text-secondary)">
									{t(`discussionRelation.${turn.relation}`, {
										defaultValue: turn.relation,
									})}
								</span>
							</div>
							<div
								className={cn(
									'rounded-lg px-3 py-2',
									isUser
										? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,transparent)]'
										: 'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)]'
								)}
							>
								<DesktopAiChatMarkdown
									markdown={turn.content}
									presentation="chat"
								/>
							</div>
						</div>
					</div>
				);
			})}
			<div ref={bottomRef} />
		</div>
	);
}
