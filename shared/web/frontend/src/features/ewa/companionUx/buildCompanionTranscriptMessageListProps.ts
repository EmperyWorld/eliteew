/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Builds the typed prop contract for the companion transcript message list.
 *
 * Invariants:
 * - The builder is pure and preserves the complete message-list prop shape.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptMessageList.tsx
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import type { CompanionTranscriptMessageListProps } from '@/features/ewa/companionUx/CompanionTranscriptMessageList';

export function buildCompanionTranscriptMessageListProps(
	props: CompanionTranscriptMessageListProps
): CompanionTranscriptMessageListProps {
	return props;
}
