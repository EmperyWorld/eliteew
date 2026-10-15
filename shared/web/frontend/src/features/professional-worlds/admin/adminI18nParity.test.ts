/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest parity coverage for Professional Worlds admin i18n keys.
 *
 * Invariants:
 * - English and Russian admin namespaces expose the same key set.
 *
 * Related:
 * - src/i18n/locales/en/professionalWorlds.json
 * - src/i18n/locales/ru/professionalWorlds.json
 * - `integrationHandoff`, `realtorPro` и `runtime` subtrees parity (waves 3–5 follow-up coverage).
 */

import { describe, expect, it } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import ruProfessionalWorlds from '@/i18n/locales/ru/professionalWorlds.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return prefix ? [prefix] : [];
	}

	return Object.entries(value).flatMap(([key, child]) =>
		flattenKeys(child, prefix ? `${prefix}.${key}` : key)
	);
}

describe('professional worlds admin i18n parity', () => {
	it('keeps English and Russian admin keys aligned', () => {
		const enKeys = flattenKeys(enProfessionalWorlds.admin).sort();
		const ruKeys = flattenKeys(ruProfessionalWorlds.admin).sort();

		expect(enKeys).toEqual(ruKeys);
	});

	it('keeps Realtor Pro runtime subtree keys aligned', () => {
		const enKeys = flattenKeys(enProfessionalWorlds.realtorPro).sort();
		const ruKeys = flattenKeys(ruProfessionalWorlds.realtorPro).sort();

		expect(enKeys).toEqual(ruKeys);
	});

	it('keeps runtime placeholder subtree keys aligned', () => {
		const enKeys = flattenKeys(enProfessionalWorlds.runtime).sort();
		const ruKeys = flattenKeys(ruProfessionalWorlds.runtime).sort();

		expect(enKeys).toEqual(ruKeys);
	});

	it('keeps Professional Worlds desktop integration handoff keys aligned', () => {
		const enKeys = flattenKeys(enProfessionalWorlds.integrationHandoff).sort();
		const ruKeys = flattenKeys(ruProfessionalWorlds.integrationHandoff).sort();

		expect(enKeys).toEqual(ruKeys);
	});
});
