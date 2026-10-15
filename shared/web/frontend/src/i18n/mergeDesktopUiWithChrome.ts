/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge `desktopChrome` keys into `desktopUi` so existing `t(..., { ns: 'desktopUi' })`
 * paths keep working after chrome/shell split.
 *
 * Invariants:
 * - Top-level object sections are deep-merged one level (chrome wins on leaf collision).
 * - Chrome keys win on collision (tray/taskbar copy is canonical in desktopChrome.json).
 *
 * Related:
 * - `i18n/config.ts`, `i18n/lazyLocaleBackend.ts`
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeDesktopUiWithChrome(
	base: Record<string, unknown>,
	chrome: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...base };
	for (const [key, chromeValue] of Object.entries(chrome)) {
		const baseValue = out[key];
		if (isPlainObject(baseValue) && isPlainObject(chromeValue)) {
			out[key] = { ...baseValue, ...chromeValue };
		} else {
			out[key] = chromeValue;
		}
	}
	return out;
}
