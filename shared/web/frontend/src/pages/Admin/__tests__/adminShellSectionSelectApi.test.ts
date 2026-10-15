/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock best-effort section-select POST + debounce (no nav throw on failure).
 *
 * Related:
 * - pages/Admin/shell/adminShellSectionSelectApi.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	reportAdminShellSectionSelect,
	resetAdminShellSectionSelectApiForTests,
} from '../shell/adminShellSectionSelectApi';

const post = vi.fn();

vi.mock('../../../services/api/client', () => ({
	api: {
		post: (...args: unknown[]) => post(...args),
	},
}));

beforeEach(() => {
	resetAdminShellSectionSelectApiForTests();
	post.mockReset();
	post.mockResolvedValue({});
});

afterEach(() => {
	resetAdminShellSectionSelectApiForTests();
});

describe('reportAdminShellSectionSelect', () => {
	it('posts section + embedded to shell telemetry', async () => {
		reportAdminShellSectionSelect('users', { embedded: true });
		await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
		expect(post).toHaveBeenCalledWith(
			'/api/v1/desktop/admin/shell/section-select',
			{ section: 'users', embedded: true }
		);
	});

	it('debounces identical selects within window', async () => {
		reportAdminShellSectionSelect('workers');
		reportAdminShellSectionSelect('workers');
		await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
	});

	it('does not throw when POST rejects', async () => {
		post.mockRejectedValueOnce(new Error('offline'));
		expect(() => reportAdminShellSectionSelect('system')).not.toThrow();
		await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
	});
});
