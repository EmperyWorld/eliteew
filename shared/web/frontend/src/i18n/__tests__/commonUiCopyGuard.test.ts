/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard shared primitive copy against leaking technical/product-specific terms.
 *
 * Invariants:
 * - `commonUi` stays generic enough for every Desktop product workspace.
 * - RU/EN resources expose the same top-level contracts.
 *
 * Related:
 * - src/i18n/locales/ru/commonUi.json
 * - src/i18n/locales/en/commonUi.json
 */

import { describe, expect, it } from 'vitest';
import enCommonUi from '../locales/en/commonUi.json';
import ruCommonUi from '../locales/ru/commonUi.json';

function flattenStrings(value: unknown): string[] {
	if (typeof value === 'string') {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(flattenStrings);
	}
	if (value && typeof value === 'object') {
		return Object.values(value).flatMap(flattenStrings);
	}
	return [];
}

describe('commonUi copy guard', () => {
	it('keeps shared primitive copy free of product-specific technical terms', () => {
		const allCopy = [
			...flattenStrings(ruCommonUi),
			...flattenStrings(enCommonUi),
		];
		const forbidden =
			/\b(runtime|workspace|UGS|pipeline|artifact|Scope|Rollout|Feature flags|reconcile)\b/i;

		expect(allCopy.join('\n')).not.toMatch(forbidden);
	});

	it('keeps the shared namespace shape aligned across ru/en', () => {
		expect(Object.keys(enCommonUi).sort()).toEqual(
			Object.keys(ruCommonUi).sort()
		);
		expect(Object.keys(enCommonUi.actions).sort()).toEqual(
			Object.keys(ruCommonUi.actions).sort()
		);
		expect(Object.keys(enCommonUi.states).sort()).toEqual(
			Object.keys(ruCommonUi.states).sort()
		);
		expect(Object.keys(enCommonUi.workspace).sort()).toEqual(
			Object.keys(ruCommonUi.workspace).sort()
		);
	});
});
