/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Progressive disclosure for Professional Worlds sidebar: compact starter nav vs full menu.
 *
 * Invariants:
 * - Compact mode hides brand, artifacts, playbooks and profession tools from sidebar only.
 * - Preference persists in localStorage per browser profile.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - ProfessionalWorldsRuntimeShell.tsx
 */

import type { ProfessionalWorldsActiveView } from './ProfessionalWorldsWorkspaceContext';

export const PROFESSIONAL_WORLDS_NAV_MODE_LS_KEY =
	'eliteew.professionalWorlds.navMode.v1';

export type ProfessionalWorldsNavMode = 'compact' | 'full';
export type ProfessionalWorldsNavProgressStage =
	| 'firstRun'
	| 'midProgress'
	| 'complete';

const COMPACT_NAV_VIEW_IDS = new Set<ProfessionalWorldsActiveView>([
	'overview',
	'profile',
	'properties',
	'clients',
	'learning',
]);

export function readStoredNavMode(): ProfessionalWorldsNavMode {
	if (typeof window === 'undefined') {
		return 'compact';
	}
	const raw = window.localStorage.getItem(PROFESSIONAL_WORLDS_NAV_MODE_LS_KEY);
	return raw === 'full' ? 'full' : 'compact';
}

export function writeStoredNavMode(mode: ProfessionalWorldsNavMode): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.localStorage.setItem(PROFESSIONAL_WORLDS_NAV_MODE_LS_KEY, mode);
}

export function filterNavItemsForMode<
	T extends { id: ProfessionalWorldsActiveView },
>(items: T[], mode: ProfessionalWorldsNavMode): T[] {
	if (mode === 'full') {
		return items;
	}
	return items.filter((item) => COMPACT_NAV_VIEW_IDS.has(item.id));
}

export function isViewVisibleInNavMode(
	view: ProfessionalWorldsActiveView,
	mode: ProfessionalWorldsNavMode
): boolean {
	if (mode === 'full') {
		return true;
	}
	return COMPACT_NAV_VIEW_IDS.has(view);
}

/** Suggest expanding to full menu once quick-start signals exist. */
export type ProfessionalWorldsNavProgressInput = {
	profileReady: boolean;
	onboardingComplete: boolean;
	propertiesCount: number;
};

export function deriveNavProgressStage(
	input: ProfessionalWorldsNavProgressInput
): ProfessionalWorldsNavProgressStage {
	if (
		input.profileReady &&
		input.onboardingComplete &&
		input.propertiesCount >= 1
	) {
		return 'complete';
	}
	if (
		input.profileReady ||
		input.propertiesCount >= 1 ||
		input.onboardingComplete
	) {
		return 'midProgress';
	}
	return 'firstRun';
}

export function suggestFullNavMode(
	input: ProfessionalWorldsNavProgressInput
): boolean {
	return deriveNavProgressStage(input) === 'complete';
}

export function toggleNavMode(
	mode: ProfessionalWorldsNavMode
): ProfessionalWorldsNavMode {
	return mode === 'compact' ? 'full' : 'compact';
}
