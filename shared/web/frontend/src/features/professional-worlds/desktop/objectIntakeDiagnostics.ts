/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map structured Realtor object-intake diagnostics (SSE/API) into user-facing summaries via i18n.
 *
 * Invariants:
 * - Does not scrape bracket-prefixed server warning strings; uses `ObjectIntakeDiagnostics` from the backend only.
 *
 * Related:
 * - shared/web/frontend/src/features/professional-worlds/desktop/types.ts
 */

import type { ObjectIntakeDiagnostics } from '@/features/professional-worlds/desktop/types';

/** `t` is typically `react-i18next` `useTranslation`; keys live under `properties.intakeDiagnostics.*`. */
export function explainIntakeDiagnostics(
	d: ObjectIntakeDiagnostics,
	t: (key: string) => string
): string {
	if (d.parse_failed) {
		return t('properties.intakeDiagnostics.modelNonJson');
	}
	if (!d.had_property_key) {
		return t('properties.intakeDiagnostics.missingProperty');
	}
	if (d.empty_property_signal) {
		return t('properties.intakeDiagnostics.emptyPropertyBlock');
	}
	return t('properties.intakeDiagnostics.genericFallback');
}
