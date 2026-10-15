/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Translate ensemble plan form validation error keys for admin UI.
 *
 * Related:
 * - `ensemblePlanFormState.ts`
 * - `DesktopEnsemblePlanFormEditor.tsx` / `ensemblePlanForm/`
 */

import type { TFunction } from 'i18next';

/** Error key returned by `parsePlanBodyToForm` / `validateStepIdsUnique`. */
export type EnsemblePlanFormErrorKey = string;

export function translateEnsemblePlanFormError(
	key: EnsemblePlanFormErrorKey,
	t: TFunction<'desktopUi'>,
	params?: Record<string, string | number>
): string {
	const colon = key.indexOf(':');
	if (colon > 0) {
		const base = key.slice(0, colon);
		const id = key.slice(colon + 1);
		return translateEnsemblePlanFormError(base, t, { id, ...params });
	}
	const fullKey = key.startsWith('adminEnsemblePlan.errors.')
		? key
		: `adminEnsemblePlan.errors.${key}`;
	const label = t(fullKey, params);
	return label === fullKey ? key : label;
}

export function translateEnsemblePlanParseFailure(
	failure: { error: string; errorParams?: Record<string, string | number> },
	t: TFunction<'desktopUi'>
): string {
	return translateEnsemblePlanFormError(failure.error, t, failure.errorParams);
}
