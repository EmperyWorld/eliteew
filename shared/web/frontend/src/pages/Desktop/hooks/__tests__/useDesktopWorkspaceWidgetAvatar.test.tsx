/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensures desktop widget avatar reads PROFILE_ME_QUERY_KEY instead of a raw second GET.
 *
 * Invariants:
 * - With cached profile data, getProfile is not called again for the widget.
 *
 * Related:
 * - `useDesktopWorkspaceWidgetAvatar.ts`, `AuthContext`
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PROFILE_ME_QUERY_KEY } from '@/services/profileService';
import { useDesktopWorkspaceWidgetAvatar } from '../useDesktopWorkspaceWidgetAvatar';

const getProfile = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/profileService', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@/services/profileService')>();
	return {
		...actual,
		default: {
			...actual.default,
			getProfile,
		},
		getProfile,
		PROFILE_ME_QUERY_KEY: actual.PROFILE_ME_QUERY_KEY,
	};
});

function wrap(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
	};
}

describe('useDesktopWorkspaceWidgetAvatar', () => {
	it('reuses PROFILE_ME_QUERY_KEY cache and does not refetch getProfile', async () => {
		getProfile.mockClear();
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		client.setQueryData(PROFILE_ME_QUERY_KEY, {
			avatar_url: 'https://cdn.example/a.webp',
			full_name: 'Test',
		});

		const { result } = renderHook(
			() => useDesktopWorkspaceWidgetAvatar('user-1'),
			{ wrapper: wrap(client) }
		);

		await waitFor(() => {
			expect(result.current[0]).toBe('https://cdn.example/a.webp');
		});
		expect(getProfile).not.toHaveBeenCalled();
	});
});
