/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W2 honesty rules for the split SPA persistence vs Keycloak
 * Remember Me controls (copy + semantic checks).
 *
 * Invariants:
 * - SPA copy must describe browser token persistence only.
 * - SPA copy must not claim the checkbox alone grants 14-day Keycloak SSO.
 * - IdP Remember Me copy owns the longer SSO cookie wording.
 *
 * Related:
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W2
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md` §Remember Me
 */

export type SpaPersistenceCopy = {
	label: string;
	hint: string;
};

export type IdpRememberMeCopy = {
	label: string;
	help: string;
};

/** SPA checkbox must not pretend to be Keycloak Remember Me alone. */
const SPA_FORBIDDEN = [/запомнить\s+устройств/i, /remember\s+this\s+device/i];

/** Avoid JS `\b` — it is ASCII-only and breaks Cyrillic stems. */
const SPA_MUST_MENTION_BROWSER_OR_TAB = [
	/браузер/i,
	/вкладк/i,
	/browser/i,
	/\btab\b/i,
	/token/i,
	/токен/i,
];

const SPA_MUST_POINT_AT_SEPARATE_IDP = [
	/keycloak/i,
	/страниц[аеы]\s+входа/i,
	/login\s+page/i,
];

const IDP_MUST_MENTION_DURATION = [/\b14\b/, /четырнадцат/i];

export function evaluateSpaPersistenceCopyHonesty(
	copy: SpaPersistenceCopy
): { ok: true } | { ok: false; reasons: string[] } {
	const reasons: string[] = [];
	const blob = `${copy.label}\n${copy.hint}`;
	for (const re of SPA_FORBIDDEN) {
		if (re.test(copy.label)) {
			reasons.push(`label still uses ambiguous device-remember wording: ${re}`);
		}
	}
	if (!SPA_MUST_MENTION_BROWSER_OR_TAB.some((re) => re.test(blob))) {
		reasons.push('SPA copy must mention browser/tab/token persistence');
	}
	if (!SPA_MUST_POINT_AT_SEPARATE_IDP.some((re) => re.test(copy.hint))) {
		reasons.push('SPA hint must point at the separate Keycloak login option');
	}
	// The SPA may mention 14 days only as the IdP option, not as its own effect.
	if (/\b14\b/.test(copy.label) && !/keycloak|страниц/i.test(copy.label)) {
		reasons.push('SPA label must not claim 14-day duration as its own effect');
	}
	return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function evaluateIdpRememberMeCopyHonesty(
	copy: IdpRememberMeCopy
): { ok: true } | { ok: false; reasons: string[] } {
	const reasons: string[] = [];
	const blob = `${copy.label}\n${copy.help}`;
	if (!IDP_MUST_MENTION_DURATION.some((re) => re.test(blob))) {
		reasons.push('IdP Remember Me copy must mention the 14-day SSO duration');
	}
	if (!/keycloak|SSO|cookie|токен|браузер/i.test(copy.help)) {
		reasons.push(
			'IdP help must separate Keycloak SSO from the SPA browser checkbox'
		);
	}
	return reasons.length ? { ok: false, reasons } : { ok: true };
}
