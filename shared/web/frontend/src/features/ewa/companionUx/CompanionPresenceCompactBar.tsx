/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop lg+ compact presence: small sigil left-aligned at top of left rail — frees vertical space for transcript and operations.
 *
 * Invariants:
 * - Rendered only inside desktop left rail (`lg+`); mobile uses `CompanionPresenceHeader`.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionLeftRailCluster.tsx
 * - src/features/ewa/companionUx/companionPresenceDisplayTypes.ts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CompanionPresenceDisplayProps } from '@/features/ewa/companionUx/companionPresenceDisplayTypes';
import {
	dismissBondArcOnboarding as persistBondArcOnboardingDismiss,
	isBondArcOnboardingDismissed,
} from '@/features/ewa/companionUx/companionBondArcHintStorage';
import { CompanionPresenceSigilControl } from '@/features/ewa/companionUx/CompanionPresenceSigilControl';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionPresenceCompactBarProps = CompanionPresenceDisplayProps & {
	companionPrincipalId?: string;
};

export function CompanionPresenceCompactBar({
	personaId,
	presence,
	bond,
	streamPhase,
	displayName,
	presenceChipLabel,
	roleLine,
	canToggleArlikaV2Sigil,
	arlikaV2SigilLabel,
	arlikaV2ModeSwitching,
	pending,
	onArlikaV2SigilToggle,
	companionPrincipalId = '',
}: CompanionPresenceCompactBarProps) {
	const { t } = useTranslation('marketing');
	const bondArcHint = t('ewaCompanion.bondArcHint');
	const [bondArcOnboardingVisible, setBondArcOnboardingVisible] = useState(
		() =>
			Boolean(companionPrincipalId) &&
			!isBondArcOnboardingDismissed(companionPrincipalId)
	);

	const handleDismissBondArcOnboarding = () => {
		if (companionPrincipalId) {
			persistBondArcOnboardingDismiss(companionPrincipalId);
		}
		setBondArcOnboardingVisible(false);
	};

	return (
		<div
			data-testid="ewa-companion-presence-compact"
			data-ewa-guide="presence-compact"
			className={cn(
				'flex shrink-0 flex-col gap-1.5 rounded-xl border border-(--companion-divider)',
				'bg-[linear-gradient(180deg,rgba(15,23,42,0.38),rgba(15,23,42,0.14))] px-2 py-2',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
			)}
		>
			<div className="flex items-start gap-2">
				<CompanionPresenceSigilControl
					personaId={personaId}
					presence={presence}
					bond={bond}
					streamPhase={streamPhase}
					canToggle={canToggleArlikaV2Sigil}
					toggleLabel={arlikaV2SigilLabel}
					toggleBusy={arlikaV2ModeSwitching}
					pending={pending}
					onToggle={onArlikaV2SigilToggle}
					sigilSize="compact"
					bondArcHint={bondArcHint}
				/>
				<div className="min-w-0 flex-1 pt-0.5">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.label,
							'truncate tracking-wide'
						)}
						title={displayName}
					>
						{displayName}
					</p>
					{presenceChipLabel ? (
						<p
							className={cn(
								'mt-0.5 inline-flex max-w-full truncate rounded-full border border-white/10 bg-white/[0.07] px-1.5 py-0.5',
								EWA_COMPANION_TYPOGRAPHY.micro,
								'font-medium text-(--companion-text-soft)'
							)}
							title={presenceChipLabel}
						>
							{presenceChipLabel}
						</p>
					) : null}
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.cardTitle,
							'mt-0.5 truncate leading-snug text-(--desktop-text-secondary)'
						)}
						title={roleLine}
					>
						{roleLine}
					</p>
				</div>
			</div>
			{bondArcOnboardingVisible ? (
				<div
					className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/4 px-2 py-1.5"
					data-testid="ewa-companion-bond-arc-onboarding"
					role="note"
				>
					<p className="text-[10px] leading-snug text-(--companion-text-soft)">
						{bondArcHint}
					</p>
					<button
						type="button"
						className={cn(
							'shrink-0 text-[10px] font-medium text-(--companion-aura)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={handleDismissBondArcOnboarding}
					>
						{t('ewaCompanion.chatTranscriptLatestReplyHintDismiss')}
					</button>
				</div>
			) : null}
		</div>
	);
}
