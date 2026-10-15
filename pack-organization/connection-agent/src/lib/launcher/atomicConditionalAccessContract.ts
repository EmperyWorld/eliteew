/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Launcher-side pure contract for Desktop Atomic Conditional Access (Start URL).
 * Wave 0 lock — shared rules with SPA/API contract modules.
 *
 * Invariants:
 * - Product Start URLs must not expose raw license/device ids at enforce cutover.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 * - atomicConditionalAccessContract.test.ts
 */

export const FORBIDDEN_START_URL_QUERY_PARAMS = [
	'eliteewLicenseId',
	'eliteewDeviceId',
] as const;

export const ALLOWED_START_URL_PROFILE_MARKERS = [
	'eliteewDesktopClient',
	'eliteewFoflineClient',
] as const;

export function startUrlHasForbiddenBindIds(url: string): boolean {
	try {
		const parsed = new URL(url);
		for (const param of FORBIDDEN_START_URL_QUERY_PARAMS) {
			if (parsed.searchParams.has(param)) {
				return true;
			}
		}
		return false;
	} catch {
		return true;
	}
}

export function buildCompliantProductStartUrl(
	appBase: string,
	options?: { profileMarker?: (typeof ALLOWED_START_URL_PROFILE_MARKERS)[number] },
): string {
	const url = new URL(appBase.endsWith('/') ? appBase : `${appBase}/`);
	const marker =
		options?.profileMarker ?? ALLOWED_START_URL_PROFILE_MARKERS[0];
	url.searchParams.set(marker, '1');
	return url.toString();
}
