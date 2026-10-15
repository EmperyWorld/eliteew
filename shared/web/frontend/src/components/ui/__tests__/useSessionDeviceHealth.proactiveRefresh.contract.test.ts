/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: proactive token refresh must not re-enter AuthContext checkAuthentication.
 *
 * Invariants:
 * - refreshTokenNow relies on authSession.updateToken → onAuthRefreshSuccess silent sync.
 *
 * Related:
 * - `useSessionDeviceHealth.ts`, `AuthContext.tsx`, `AppRouter.tsx`
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { checkAuthentication, updateToken } = vi.hoisted(() => ({
	checkAuthentication: vi.fn(async () => {}),
	updateToken: vi.fn(async () => true),
}));

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({
		user: { id: 'u1' },
		isAuthenticated: true,
		loading: false,
		logout: vi.fn(),
		checkAuthentication,
	}),
}));

vi.mock('@/services/authSession', () => ({
	default: {
		token: 't',
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken,
	},
}));

vi.mock('@/services/profileService', () => ({
	default: {
		getProfile: vi.fn(async () => ({ id: 'u1' })),
	},
	PROFILE_ME_QUERY_KEY: ['profile', 'me'],
}));

vi.mock('@/providers/QueryProvider', () => ({
	queryClient: {
		fetchQuery: vi.fn(
			async ({
				queryFn,
			}: {
				queryFn: (ctx: { signal: AbortSignal }) => Promise<unknown>;
			}) => queryFn({ signal: new AbortController().signal })
		),
	},
}));

vi.mock('@/utils/authRedirect', () => ({
	beginInteractiveLogin: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
	log: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useSessionDeviceHealth } from '../useSessionDeviceHealth';

describe('useSessionDeviceHealth proactive refresh', () => {
	beforeEach(() => {
		checkAuthentication.mockClear();
		updateToken.mockClear();
	});

	it('refreshTokenNow does not call checkAuthentication (onAuthRefreshSuccess owns sync)', async () => {
		const { result } = renderHook(() =>
			useSessionDeviceHealth({ pollingEnabled: false })
		);

		await act(async () => {
			await result.current.refreshTokenNow();
		});

		expect(updateToken).toHaveBeenCalledWith(5 * 60);
		expect(checkAuthentication).not.toHaveBeenCalled();
	});
});
