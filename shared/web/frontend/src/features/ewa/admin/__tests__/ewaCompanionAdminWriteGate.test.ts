/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import type { EwaCompanionAdminStatus } from '../ewaCompanionAdminApi';
import { isEwaCompanionWorkflowWriteEnabled } from '../ewaCompanionAdminWriteGate';

describe('ewaCompanionAdminWriteGate', () => {
	it('requires both admin_write and pg_catalog flags', () => {
		const cases: Array<{
			status: EwaCompanionAdminStatus | undefined;
			expected: boolean;
		}> = [
			{ status: undefined, expected: false },
			{
				status: {
					admin_enabled: true,
					admin_write_enabled: false,
					pg_catalog_enabled: false,
				},
				expected: false,
			},
			{
				status: {
					admin_enabled: true,
					admin_write_enabled: true,
					pg_catalog_enabled: false,
				},
				expected: false,
			},
			{
				status: {
					admin_enabled: true,
					admin_write_enabled: false,
					pg_catalog_enabled: true,
				},
				expected: false,
			},
			{
				status: {
					admin_enabled: true,
					admin_write_enabled: true,
					pg_catalog_enabled: true,
				},
				expected: true,
			},
		];
		for (const { status, expected } of cases) {
			expect(isEwaCompanionWorkflowWriteEnabled(status)).toBe(expected);
		}
	});
});
