/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map visual pack import errors to plain user copy.
 *
 * Invariants:
 * - Raw parser tokens never leak to toast descriptions.
 *
 * Related:
 * - `desktopSettingsVisualPackImportErrors.ts`
 */

import { describe, expect, it } from 'vitest';
import { mapVisualPackImportErrorMessage } from '../desktopSettingsVisualPackImportErrors';

const t = ((key: string) => {
	if (key === 'settingsPanel.visualPackImportFailedDamaged') {
		return 'File is damaged or not a settings file.';
	}
	return key;
}) as never;

describe('mapVisualPackImportErrorMessage', () => {
	it('maps parser errors to damaged file copy', () => {
		expect(mapVisualPackImportErrorMessage('Unexpected token in JSON', t)).toBe(
			'File is damaged or not a settings file.'
		);
	});

	it('maps empty errors to damaged file copy', () => {
		expect(mapVisualPackImportErrorMessage(undefined, t)).toBe(
			'File is damaged or not a settings file.'
		);
	});
});
