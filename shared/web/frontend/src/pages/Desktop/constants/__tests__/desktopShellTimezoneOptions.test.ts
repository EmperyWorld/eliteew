/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for shared desktop shell timezone option list.
 *
 * Invariants:
 * - Values are unique IANA ids consumed by widget + Settings Center sync card.
 *
 * Related:
 * - `constants/desktopShellTimezoneOptions.ts`
 */

import { describe, expect, it } from 'vitest';
import { DESKTOP_SHELL_TIMEZONE_OPTIONS } from '../desktopShellTimezoneOptions';

describe('DESKTOP_SHELL_TIMEZONE_OPTIONS', () => {
	it('has unique values and includes Moscow default region', () => {
		const values = DESKTOP_SHELL_TIMEZONE_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
		expect(values).toContain('Europe/Moscow');
		expect(values).toContain('UTC');
	});

	it('labels are non-empty for every option', () => {
		for (const option of DESKTOP_SHELL_TIMEZONE_OPTIONS) {
			expect(option.label.trim().length).toBeGreaterThan(0);
		}
	});
});
