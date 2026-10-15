/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vertical template helpers for Professional Worlds desktop (core modules, playbooks, listing/media gates).
 *
 * Invariants:
 * - Core module keys match pack manifest catalog keys; objects/listing workspace remains realtor-only.
 * - Consultant and other non-realtor verticals expose no listing media context.
 *
 * Related:
 * - verticalModuleLogic.ts
 * - verticalConstants.ts
 * - documentation/product/PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md
 */

import { playbooksModuleKeyForVertical } from './verticalConstants';
import { verticalSupportsListingWorkspace } from './verticalModuleLogic';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

export type ProfessionalMediaContextType = 'realtor' | 'consultant';

const CORE_MODULE_KEYS = [
	'profile',
	'clients',
	'deals',
	'learning',
	'public-presence',
	'artifacts',
] as const;

/** Shared CRM / learning / brand module keys from vertical pack manifests. */
export function listCoreModuleKeys(): readonly string[] {
	return CORE_MODULE_KEYS;
}

export { playbooksModuleKeyForVertical, verticalSupportsListingWorkspace };

/** Maps vertical slug to media workbench context; null when listing media is unavailable. */
export function mediaContextForVertical(
	slug: string
): ProfessionalMediaContextType | null {
	const normalized = slug.trim().toLowerCase();
	if (normalized === PROFESSIONAL_WORLDS_VERTICAL_REALTOR) {
		return 'realtor';
	}
	if (normalized === 'consultant') {
		return null;
	}
	return null;
}
