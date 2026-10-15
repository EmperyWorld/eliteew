/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator notice when active profession vertical is not the realtor MVP pack.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 */

import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

export function shouldShowNonRealtorVerticalNotice(input: {
	activeVerticalSlug: string;
	hasRuntimeConfig: boolean;
}): boolean {
	return (
		input.hasRuntimeConfig &&
		input.activeVerticalSlug !== PROFESSIONAL_WORLDS_VERTICAL_REALTOR
	);
}
