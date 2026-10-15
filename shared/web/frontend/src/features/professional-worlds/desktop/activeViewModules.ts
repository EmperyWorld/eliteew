/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Professional Worlds sidebar views to backend runtime module keys for enablement checks.
 *
 * Invariants:
 * - Overview, professionTools intentionally omitted from module map; playbooks maps via vertical slug convention.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx (`activeRuntimeConfig.modules`)
 * - verticalConstants.ts
 */

import { playbooksModuleKeyForVertical } from './verticalConstants';

export type ProfessionalWorldsUiView =
	| 'overview'
	| 'profile'
	| 'properties'
	| 'clients'
	| 'professionTools'
	| 'learning'
	| 'brand'
	| 'playbooks'
	| 'artifacts';

export function runtimeModuleKeyForView(
	view: ProfessionalWorldsUiView,
	verticalSlug = 'realtor'
): string | undefined {
	switch (view) {
		case 'profile':
			return 'profile';
		case 'properties':
			return 'objects';
		case 'clients':
			return 'clients';
		case 'learning':
			return 'learning';
		case 'brand':
			return 'public-presence';
		case 'artifacts':
			return 'artifacts';
		case 'playbooks':
			return playbooksModuleKeyForVertical(verticalSlug);
		default:
			return undefined;
	}
}
