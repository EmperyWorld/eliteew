/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	translateEnsemblePlanFormError,
	translateEnsemblePlanParseFailure,
} from '../ensemblePlan/ensemblePlanFormErrorI18n';

const t = ((key: string, params?: Record<string, string | number>) => {
	const map: Record<string, string> = {
		'adminEnsemblePlan.errors.emptyStepId': 'Every step needs step_id',
		'adminEnsemblePlan.errors.duplicateStepId': `Duplicate: ${params?.id}`,
		'adminEnsemblePlan.errors.stepIndexEmptyId': `steps[${params?.index}]: empty`,
	};
	return map[key] ?? key;
}) as TFunction<'desktopUi'>;

describe('ensemblePlanFormErrorI18n', () => {
	it('translates error keys and colon suffix ids', () => {
		expect(translateEnsemblePlanFormError('emptyStepId', t)).toBe(
			'Every step needs step_id'
		);
		expect(translateEnsemblePlanFormError('duplicateStepId:foo', t)).toBe(
			'Duplicate: foo'
		);
	});

	it('translates parse failure objects', () => {
		expect(
			translateEnsemblePlanParseFailure(
				{ error: 'stepIndexEmptyId', errorParams: { index: 2 } },
				t
			)
		).toBe('steps[2]: empty');
	});
});
