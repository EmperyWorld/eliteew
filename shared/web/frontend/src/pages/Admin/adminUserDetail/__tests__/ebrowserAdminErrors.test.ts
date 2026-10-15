/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EBrowser admin validation code → i18n key mapping.
 *
 * Related:
 * - pages/Admin/adminUserDetail/ebrowserAdminErrors.ts
 */

import { describe, expect, it } from 'vitest';
import {
	ebrowserAdminErrorI18nKey,
	ebrowserAdminValidationCode,
} from '../ebrowserAdminErrors';

describe('ebrowserAdminErrors', () => {
	it('maps known validation codes', () => {
		expect(ebrowserAdminValidationCode('denylist_empty_forbidden')).toBe(
			'denylist_empty_forbidden'
		);
		expect(ebrowserAdminErrorI18nKey('denylist_empty_forbidden')).toBe(
			'adminUserDetail.ebrowser.errors.denylist_empty_forbidden'
		);
	});

	it('falls back for unknown messages', () => {
		expect(ebrowserAdminValidationCode('network boom')).toBeNull();
		expect(ebrowserAdminErrorI18nKey('network boom')).toBe(
			'adminUserDetail.ebrowser.saveFailed'
		);
	});
});
