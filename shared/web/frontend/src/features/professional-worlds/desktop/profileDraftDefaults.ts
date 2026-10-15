/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locale-neutral specialist profile draft defaults before server profile is loaded or when none exists.
 *
 * Invariants:
 * - Do not hardcode geography or specialization presets; hydrate from GET profile when present.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - types.ts (`SpecialistProfileUpsert`)
 */

import type { SpecialistProfileUpsert } from './types';

export function emptySpecialistProfileDraft(
	verticalSlug: string
): SpecialistProfileUpsert {
	return {
		vertical_slug: verticalSlug,
		display_name: '',
		headline: '',
		city: '',
		agency_name: '',
		specialization: [],
		profile_data: { areas: [], languages: [] },
		is_public_ready: false,
	};
}
