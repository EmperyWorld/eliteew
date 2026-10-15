/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical site, source, and support URLs for Journey Welcome and Ещё CTAs.
 *
 * Invariants:
 * - Contact mailbox is license@eliteew.ru (not poet@ or ops aliases).
 * - Source code points to the public corresponding-source repository.
 * - Open via plugin-opener on main launcher only.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.5
 */

export const ELITEEW_SITE_URL = 'https://eliteew.ru' as const;
export const ELITEEW_SOURCE_CODE_URL =
	'https://github.com/EmperyWorld/eliteew' as const;
export const LICENSE_CONTACT_EMAIL = 'license@eliteew.ru' as const;
export const LICENSE_MAILTO_URL =
	`mailto:${LICENSE_CONTACT_EMAIL}` as const;

export type OpenerLinkKind = 'site' | 'mailto' | 'source_code';

export function openerUrlFor(kind: OpenerLinkKind): string {
	switch (kind) {
		case 'site':
			return ELITEEW_SITE_URL;
		case 'mailto':
			return LICENSE_MAILTO_URL;
		case 'source_code':
			return ELITEEW_SOURCE_CODE_URL;
	}
}
