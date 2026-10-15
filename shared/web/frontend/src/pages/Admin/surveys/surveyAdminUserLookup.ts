/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map admin user list entries to survey response display and CSV export.
 */
import type { UserAppAccessGroupResponse } from '@/pages/Desktop/services/desktopAdminApi';

export type SurveyUserProfile = {
	username: string;
	email: string;
};

export type SurveyUserLookup = ReadonlyMap<string, SurveyUserProfile>;

export function buildSurveyUserLookup(
	users: UserAppAccessGroupResponse[]
): SurveyUserLookup {
	const map = new Map<string, SurveyUserProfile>();
	for (const user of users) {
		map.set(user.id, {
			username: user.username,
			email: user.email,
		});
	}
	return map;
}

export function resolveSurveyUserLabel(
	lookup: SurveyUserLookup,
	userId: string
): string {
	const profile = lookup.get(userId);
	if (!profile) return userId;
	return profile.username || profile.email || userId;
}
