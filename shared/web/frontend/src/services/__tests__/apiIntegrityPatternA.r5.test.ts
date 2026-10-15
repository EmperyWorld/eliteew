/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * R5 Pattern A locks — query param coercion, toast id typing, profile payload
 * field mapping without `as unknown as`.
 *
 * Invariants:
 * - toQueryParams accepts domain query objects (no UnknownRecord cast).
 * - showLoading returns Sonner toast id as string | number.
 * - getProfile normalizes nested/camelCase profile bags into UserProfileResponse.
 *
 * Related:
 * - documentation/api/API-INTEGRITY-BACKLOG.md §R5
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	get: vi.fn(),
	loading: vi.fn(),
	dismiss: vi.fn(),
}));

vi.mock('../api/client', () => ({
	apiClient: {
		get: hoisted.get,
	},
	unwrapApiData: (payload: unknown) => payload,
}));

vi.mock('@/notifications', () => ({
	notify: {
		loading: hoisted.loading,
		dismiss: hoisted.dismiss,
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	},
}));

import { showLoading, dismissToast } from '../api/error-handler';
import { toQueryParams } from '../contentApi/utils';
import { getProfile } from '../profileService';

describe('R5 Pattern A — shared API boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('toQueryParams accepts ContentListQuery-shaped objects without casts', () => {
		expect(
			toQueryParams({
				limit: 25,
				offset: 0,
				search: 'notes',
				owner_only: true,
				folder_unassigned: false,
			})
		).toEqual({
			limit: 25,
			offset: 0,
			search: 'notes',
			owner_only: true,
			folder_unassigned: false,
		});
	});

	it('showLoading returns Sonner toast id without as-unknown-as string cast', () => {
		hoisted.loading.mockReturnValue(42);
		const id = showLoading('Saving…');
		expect(id).toBe(42);
		dismissToast(id);
		expect(hoisted.dismiss).toHaveBeenCalledWith(42);
	});

	it('getProfile maps nested fullName bag into typed UserProfileResponse', async () => {
		hoisted.get.mockResolvedValueOnce({
			data: {
				data: {
					id: 'u1',
					username: 'alice',
					email: 'a@example.com',
					fullName: ' Alice ',
					bio: null,
					avatar_url: null,
					role: 'user',
					is_active: true,
					is_verified: false,
					preferences: { theme: 'dark' },
					created_at: '2026-01-01T00:00:00Z',
					last_login_at: null,
					login_count: 3,
				},
			},
		});

		const profile = await getProfile();
		expect(hoisted.get).toHaveBeenCalled();
		expect(profile).toMatchObject({
			id: 'u1',
			username: 'alice',
			email: 'a@example.com',
			full_name: ' Alice ',
			login_count: 3,
			preferences: { theme: 'dark' },
		});
	});
});
