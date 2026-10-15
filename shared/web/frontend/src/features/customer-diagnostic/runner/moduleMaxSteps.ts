/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-count helper for diagnostic module runners (emotions depends on selected touchpoints).
 *
 * Invariants:
 * - Emotions maxSteps uses selectedTouchpoints length — keep in sync with EmotionsStep.
 *
 * Related:
 * - ../diagnosticDefinition.ts
 * - ModuleRunner.tsx
 */

import { QUESTIONS } from '../diagnosticDefinition';
import type {
	CustomerDiagnosticSessionState,
	DiagnosticModuleId,
} from '../diagnosticTypes';

export function moduleMaxSteps(
	moduleId: DiagnosticModuleId,
	draft: CustomerDiagnosticSessionState
): number {
	switch (moduleId) {
		case 'archetype':
			return QUESTIONS.archetype.length;
		case 'values':
			return QUESTIONS.values.length;
		case 'business':
			return QUESTIONS.business.length;
		case 'service':
			return QUESTIONS.service.length;
		case 'emotions': {
			const em = draft.answers.emotions;
			const tp =
				em && typeof em === 'object' && Array.isArray(em.selectedTouchpoints)
					? (em.selectedTouchpoints as string[])
					: [];
			return tp.length >= 4 ? 1 + tp.length * 2 : 1;
		}
		default:
			return 1;
	}
}
