/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { adminUsersCsvHeaderLabelI18n } from '../adminUsersCsvHeaderI18n';

describe('adminUsersCsvHeaderI18n', () => {
	it('resolves known column keys', () => {
		const t = ((key: string) =>
			key === 'adminUsersHub.csvHeaders.username' ? 'Логин' : key) as TFunction;
		expect(adminUsersCsvHeaderLabelI18n('username', t)).toBe('Логин');
	});
});
