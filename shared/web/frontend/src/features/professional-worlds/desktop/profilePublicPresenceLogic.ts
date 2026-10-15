/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile → Site Studio public presence wizard: readiness checks and preview capsule builder.
 *
 * Invariants:
 * - Preview opens Site Studio only; no auto-publish.
 * - Capsule is client-built when profile has no listing anchor yet.
 *
 * Related:
 * - ProfileWorkspacePanel.tsx
 * - professionalWorldsCrossAppDraft.ts
 */

import type { ProfessionalWorldsDraftCapsule } from './professionalWorldsCrossAppDraft';
import type { SpecialistProfileUpsert } from './types';

export type ProfilePublicPresenceStepId =
	| 'name'
	| 'city'
	| 'headline'
	| 'preview';

export const PROFILE_PUBLIC_PRESENCE_CHECKLIST: ProfilePublicPresenceStepId[] =
	['name', 'city', 'headline', 'preview'];

export function countProfileBasicsProgress(profile: SpecialistProfileUpsert): {
	filled: number;
	total: number;
} {
	const flags = [
		Boolean(profile.display_name?.trim()),
		Boolean(profile.city?.trim()),
		Boolean(profile.headline?.trim()),
		Boolean(profile.agency_name?.trim()),
	];
	return { filled: flags.filter(Boolean).length, total: flags.length };
}

export function isProfilePublicPresenceStepDone(
	step: ProfilePublicPresenceStepId,
	profile: SpecialistProfileUpsert
): boolean {
	if (step === 'name') return Boolean(profile.display_name?.trim());
	if (step === 'city') return Boolean(profile.city?.trim());
	if (step === 'headline') return Boolean(profile.headline?.trim());
	return isProfilePublicPresenceReady(profile);
}

export function resolveProfilePublicPresenceSteps(
	profile: SpecialistProfileUpsert
): ProfilePublicPresenceStepId[] {
	const steps: ProfilePublicPresenceStepId[] = [];
	if (!profile.display_name?.trim()) steps.push('name');
	if (!profile.city?.trim()) steps.push('city');
	if (!profile.headline?.trim()) steps.push('headline');
	steps.push('preview');
	return steps;
}

export function isProfilePublicPresenceReady(
	profile: SpecialistProfileUpsert
): boolean {
	return Boolean(profile.display_name?.trim()) && Boolean(profile.city?.trim());
}

export function buildProfilePublicPresenceCapsule(
	profile: SpecialistProfileUpsert
): ProfessionalWorldsDraftCapsule {
	const displayName = profile.display_name?.trim() || 'Specialist';
	const city = profile.city?.trim() || '';
	const headline = profile.headline?.trim() || '';
	const agency = profile.agency_name?.trim() || '';
	const outlineParts = [
		headline,
		agency ? `Agency: ${agency}` : '',
		'Public specialist page preview from Professional Worlds profile.',
	].filter(Boolean);
	return {
		destination: 'site_studio',
		property: {
			title_hint: displayName,
			city: city || null,
		},
		presentation: {
			title: displayName,
			outline_markdown: outlineParts.join('\n\n'),
		},
		page_sections: [{ key: 'about', title: 'About specialist' }],
	};
}
