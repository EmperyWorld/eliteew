/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared orchestration types for EWRP generator hook atomization.
 *
 * Invariants:
 * - Public props type stays re-exported from facade `useEwrpGeneratorOrchestration.tsx`.
 *
 * Related:
 * - `useEwrpGeneratorOrchestration.tsx`, `useEwrpGeneratorCompose.ts`
 */

import type { WindowInitialPayload } from '@/pages/Desktop/types/desktop.types';
import type { EwrpSlide } from '@/services/ewrpApi';

export type EWRPGeneratorProps = {
	/** Plaintext inventory for companion `shell_context.surface_listing` via merged desktop window payload. */
	onWindowPayloadChange?: (patch: WindowInitialPayload) => void;
	/** Professional Worlds cross-app draft (`sessionStorage` key). */
	professionalWorldsCrossAppDraftKey?: string;
	/** Desktop deep-link / companion action: open a specific EWRP job. */
	ewrpJobId?: string;
};

export type DeleteTarget = {
	id: string;
	label: string;
};

export type DraftRestorePrompt = {
	slides: EwrpSlide[];
	savedAt: number;
};
