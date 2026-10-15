/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for localized desktop accent swatch labels.
 *
 * Related:
 * - pages/Desktop/utils/accentColorLabel.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { accentColorLabel } from '../accentColorLabel';

describe('accentColorLabel', () => {
	const t = vi.fn((key: string) => `i18n:${key}`) as unknown as Parameters<
		typeof accentColorLabel
	>[1];

	it('resolves known accent ids through settingsAccent.colors keys', () => {
		expect(accentColorLabel('purple', t)).toBe(
			'i18n:settingsAccent.colors.purple'
		);
		expect(t).toHaveBeenCalledWith('settingsAccent.colors.purple', {
			defaultValue: 'purple',
		});
	});
});
