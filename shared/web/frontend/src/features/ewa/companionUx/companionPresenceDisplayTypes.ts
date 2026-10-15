/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared presence display props for compact bar and mobile header.
 *
 * Invariants:
 * - Persona/sigil fields stay aligned between desktop compact bar and mobile header.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionPresenceCompactBar.tsx
 * - src/features/ewa/companionUx/CompanionPresenceHeader.tsx
 */

import type {
	CompanionPresenceState,
	CompanionStreamPhase,
} from '@/features/ewa/companionPresence/CompanionSigil';

export type CompanionPresenceDisplayProps = {
	personaId: string;
	presence: CompanionPresenceState;
	bond: number;
	streamPhase: CompanionStreamPhase;
	displayName: string;
	presenceChipLabel: string;
	roleLine: string;
	canToggleArlikaV2Sigil: boolean;
	arlikaV2SigilLabel: string;
	arlikaV2ModeSwitching: boolean;
	pending: boolean;
	onArlikaV2SigilToggle: () => void;
};

export type CompanionPresenceHeaderProps = CompanionPresenceDisplayProps & {
	mobileEmbeddedLayout: boolean;
	mobileEmbeddedLandscape: boolean;
	/** When true (below lg / no right rail), show Operations control that opens the ops sheet. */
	showOperationsEntry?: boolean;
	activeOperationCount?: number;
	awaitingConfirmationCount?: number;
	onOpenOperations?: () => void;
};
