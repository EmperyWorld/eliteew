/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin shell i18n label resolution.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	resolveAdminNavGroupLabel,
	resolveAdminSectionLabel,
} from '../shell/adminShellLabels';

const t = ((key: string) =>
	(
		({
			'adminShell.sections.users': 'Users',
			'adminShell.groups.operations': 'Operations',
		}) as Record<string, string>
	)[key] ?? key) as TFunction<'desktopUi'>;

describe('adminShellLabels', () => {
	it('resolves section label via i18n key', () => {
		expect(resolveAdminSectionLabel('users', t)).toBe('Users');
	});

	it('resolves nav group label via i18n key', () => {
		expect(resolveAdminNavGroupLabel('operations', t)).toBe('Operations');
	});

	it('falls back to static label when i18n returns key unchanged', () => {
		const tFallback = ((key: string) => key) as TFunction<'desktopUi'>;
		expect(resolveAdminSectionLabel('system', tFallback)).toBe(
			'adminShell.sections.system'
		);
	});
});
