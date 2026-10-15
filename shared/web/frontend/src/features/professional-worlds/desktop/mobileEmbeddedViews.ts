/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Allowlist of Professional Worlds workspace views shown in MobileAndroid embedded WebView.
 *
 * Invariants:
 * - Mobile subset is core CRM surfaces plus listing photos; profession tools and playbooks stay desktop-first.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - __tests__/ProfessionalWorldsApp.mobile-embedded.contract.test.ts
 */

import type { ProfessionalWorldsActiveView } from './ProfessionalWorldsWorkspaceContext';

export const MOBILE_EMBEDDED_VIEWS: ReadonlySet<ProfessionalWorldsActiveView> =
	new Set(['overview', 'profile', 'clients', 'artifacts', 'properties']);

export function isMobileEmbeddedViewAllowed(
	view: ProfessionalWorldsActiveView
): boolean {
	return MOBILE_EMBEDDED_VIEWS.has(view);
}

export function filterNavItemsForMobileEmbedded<
	T extends { id: ProfessionalWorldsActiveView },
>(items: T[]): T[] {
	return items.filter((item) => isMobileEmbeddedViewAllowed(item.id));
}
