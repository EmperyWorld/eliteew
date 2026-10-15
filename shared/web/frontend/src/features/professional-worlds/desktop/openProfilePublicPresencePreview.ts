/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Launch Site Studio with a client-built profile preview capsule (no property draft API).
 *
 * Related:
 * - profilePublicPresenceLogic.ts
 * - openProfessionalDraftDestination.ts
 */

import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';

import type { ProfessionalWorldsDraftCapsule } from './professionalWorldsCrossAppDraft';

const STORAGE_SCOPE = 'eliteew.professionalWorlds.crossAppDraft.v1';

export function openProfilePublicPresencePreview(
	capsule: ProfessionalWorldsDraftCapsule
): boolean {
	if (typeof window === 'undefined') return false;
	const suffix = crypto.randomUUID();
	const key = `${STORAGE_SCOPE}.site-studio.${suffix}`;
	sessionStorage.setItem(
		key,
		JSON.stringify({
			...capsule,
			link_id_hint: 'site-studio',
			deep_link: { app_component: 'UserSiteStudio' },
		})
	);
	requestOpenDesktopApp({
		appComponent: 'UserSiteStudio',
		professionalWorldsCrossAppDraftKey: key,
	});
	return true;
}
