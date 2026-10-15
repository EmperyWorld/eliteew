/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight helpers for Professional Worlds admin i18n keys used by non-hook utilities.
 *
 * Invariants:
 * - All keys resolve under the `professionalWorlds.admin` namespace branch.
 * - Use React `useTranslation` in components when language-reactive rendering is needed.
 *
 * Related:
 * - src/i18n/locales/en/professionalWorlds.json
 * - src/i18n/locales/ru/professionalWorlds.json
 */

import i18n from '@/i18n/config';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

export function adminText(
	key: string,
	options?: Record<string, unknown>
): string {
	return i18n.t(`admin.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		...(options ?? {}),
	});
}
