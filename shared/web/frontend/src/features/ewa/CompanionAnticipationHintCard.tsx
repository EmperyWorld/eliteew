/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-message anticipation bubble from `/companion-observation` with optional clickable
 * `suggested_action` chips that submit a chat prompt (Phase 5.3).
 *
 * Invariants:
 * - Hint text is display-only; chips never auto-send without an explicit click.
 * - Dismiss is local — does not mutate server transcript.
 *
 * Related:
 * - src/features/ewa/useEwaCompanionAnticipationTick.ts
 * - documentation/product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
	anticipationSuggestedActionChips,
	anticipationSuggestedActionIcon,
	coerceCompanionAnticipationSuggestedAction,
	normalizeAnticipationEpisodeLine,
} from '@/features/ewa/companionAnticipationHintUi';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionAnticipationHint } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionAnticipationHintCardProps = {
	hint: CompanionAnticipationHint;
	onSuggestedPrompt: (promptText: string) => void;
	onDismiss: () => void;
};

export function CompanionAnticipationHintCard({
	hint,
	onSuggestedPrompt,
	onDismiss,
}: CompanionAnticipationHintCardProps) {
	const { t } = useTranslation('marketing');

	const relatedLines = useMemo(
		() =>
			hint.related_episodes
				.map(normalizeAnticipationEpisodeLine)
				.filter((line): line is string => Boolean(line))
				.slice(0, 3),
		[hint.related_episodes]
	);

	const suggestedAction = useMemo(
		() => coerceCompanionAnticipationSuggestedAction(hint.suggested_action),
		[hint.suggested_action]
	);

	const chips = useMemo(
		() =>
			suggestedAction ? anticipationSuggestedActionChips(suggestedAction) : [],
		[suggestedAction]
	);

	if (!hint.hint_text?.trim()) {
		return null;
	}

	return (
		<CompanionGlassCard
			data-testid="ewa-companion-anticipation-hint"
			className={cn(
				'shrink-0 px-3 py-2 text-[12px] leading-snug',
				'text-(--desktop-text-secondary)'
			)}
		>
			<div className="flex items-start gap-2">
				<EwaIcon
					name={anticipationSuggestedActionIcon(suggestedAction)}
					size="sm"
					tone="aura"
					className="mt-0.5 shrink-0 opacity-90"
				/>
				<span className="grow whitespace-pre-line">{hint.hint_text}</span>
				<button
					type="button"
					onClick={onDismiss}
					className={cn(
						'shrink-0 rounded-full px-1.5 text-[11px] font-medium',
						'text-(--companion-text-soft) hover:bg-white/8 hover:text-(--desktop-text-primary)',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-label={t('ewaCompanion.dismissHintAria', {
						defaultValue: 'Dismiss hint',
					})}
				>
					×
				</button>
			</div>
			{relatedLines.length > 0 ? (
				<div className="mt-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-(--companion-text-soft)">
						{t('ewaCompanion.anticipationMemorySection')}
					</p>
					<ul
						className={cn(
							'mt-0.5 list-disc space-y-0.5 pl-4 text-[11px]',
							'text-(--companion-text-soft)'
						)}
					>
						{relatedLines.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			) : null}
			{chips.length > 0 ? (
				<div
					className="mt-2 flex flex-wrap gap-1.5"
					data-testid="ewa-companion-anticipation-suggested-chips"
				>
					{chips.map((chip) => (
						<button
							key={chip}
							type="button"
							className={cn(
								'max-w-full truncate rounded-full border border-(--companion-divider)',
								'bg-(--companion-bg) px-2.5 py-1 text-[11px] font-medium',
								'text-(--companion-aura) hover:bg-(--companion-aura)/10',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							title={chip}
							aria-label={t('ewaCompanion.anticipationSuggestedActionAria', {
								text: chip,
							})}
							onClick={() => onSuggestedPrompt(chip)}
						>
							{chip}
						</button>
					))}
				</div>
			) : null}
		</CompanionGlassCard>
	);
}
