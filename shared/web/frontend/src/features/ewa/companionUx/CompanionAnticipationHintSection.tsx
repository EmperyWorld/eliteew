/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional left-rail / meta anticipation hint from companion-observation (U8.3 slice 11).
 *
 * Invariants:
 * - Renders nothing when ``hint`` is null.
 *
 * Related:
 * - src/features/ewa/CompanionAnticipationHintCard.tsx
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 */

import { CompanionAnticipationHintCard } from '@/features/ewa/CompanionAnticipationHintCard';
import type { CompanionAnticipationHint } from '@/services/ewa/ewaCompanionChatApi';

export type CompanionAnticipationHintSectionProps = {
	hint: CompanionAnticipationHint | null;
	onSuggestedPrompt: (promptText: string) => void;
	onDismiss: () => void;
};

export function CompanionAnticipationHintSection({
	hint,
	onSuggestedPrompt,
	onDismiss,
}: CompanionAnticipationHintSectionProps) {
	if (!hint) return null;
	return (
		<CompanionAnticipationHintCard
			hint={hint}
			onSuggestedPrompt={onSuggestedPrompt}
			onDismiss={onDismiss}
		/>
	);
}
