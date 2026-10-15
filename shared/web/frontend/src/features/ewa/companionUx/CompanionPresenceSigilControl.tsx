/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared sigil button/wrapper for compact presence bar and mobile header.
 *
 * Invariants:
 * - Arlika v2 toggle uses button; otherwise bond arc tooltip on static wrapper.
 *
 * Related:
 * - src/features/ewa/companionPresence/CompanionSigil.tsx
 * - src/features/ewa/companionUx/CompanionPresenceCompactBar.tsx
 */

import {
	DEFAULT_EWA_PERSONA_ID,
	isEwaPersonaId,
	type EwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import {
	CompanionSigil,
	type CompanionPresenceState,
	type CompanionSigilSize,
	type CompanionStreamPhase,
} from '@/features/ewa/companionPresence/CompanionSigil';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionPresenceSigilControlProps = {
	personaId: string;
	presence: CompanionPresenceState;
	bond: number;
	streamPhase: CompanionStreamPhase;
	canToggle: boolean;
	toggleLabel: string;
	toggleBusy: boolean;
	pending: boolean;
	onToggle: () => void;
	sigilSize?: CompanionSigilSize;
	sigilClassName?: string;
	bondArcHint: string;
};

export function CompanionPresenceSigilControl({
	personaId,
	presence,
	bond,
	streamPhase,
	canToggle,
	toggleLabel,
	toggleBusy,
	pending,
	onToggle,
	sigilSize = 'default',
	sigilClassName,
	bondArcHint,
}: CompanionPresenceSigilControlProps) {
	const sigilPersonaId: EwaPersonaId = isEwaPersonaId(personaId)
		? personaId
		: DEFAULT_EWA_PERSONA_ID;
	const sigil = (
		<CompanionSigil
			personaId={sigilPersonaId}
			presence={presence}
			bond={bond}
			streamPhase={streamPhase}
			size={sigilSize}
		/>
	);

	if (canToggle) {
		return (
			<button
				type="button"
				onClick={() => void onToggle()}
				disabled={toggleBusy || pending}
				aria-label={toggleLabel}
				title={toggleLabel}
				className={cn(
					'inline-flex shrink-0 rounded-full focus-visible:outline-none',
					sigilClassName,
					DESKTOP_CHROME_FOCUS_VISIBLE,
					toggleBusy || pending
						? 'cursor-wait opacity-80'
						: 'cursor-pointer hover:opacity-90'
				)}
			>
				{sigil}
			</button>
		);
	}

	return (
		<div
			title={bondArcHint}
			className={cn(
				'inline-flex shrink-0 cursor-default rounded-full focus-within:outline-none',
				sigilClassName
			)}
		>
			{sigil}
		</div>
	);
}
