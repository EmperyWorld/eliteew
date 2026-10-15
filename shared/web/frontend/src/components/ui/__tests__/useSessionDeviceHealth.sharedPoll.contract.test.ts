/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: multiple useSessionDeviceHealth mounts share one poll retain loop.
 *
 * Invariants:
 * - pollingEnabled mounts increment retain count; unmount releases.
 * - Decorative (pollingEnabled=false) mounts do not retain.
 *
 * Related:
 * - `useSessionDeviceHealth.ts`
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({
		user: { id: 'u1' },
		isAuthenticated: true,
		loading: false,
		logout: vi.fn(),
		checkAuthentication: vi.fn(),
	}),
}));

vi.mock('@/services/authSession', () => ({
	default: {
		token: 't',
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken: vi.fn(),
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

import {
	getSessionDeviceHealthPollRetainCountForTests,
	useSessionDeviceHealth,
} from '../useSessionDeviceHealth';

describe('useSessionDeviceHealth shared poll', () => {
	it('retains one shared poll across two polling mounts', () => {
		const a = renderHook(() =>
			useSessionDeviceHealth({ pollingEnabled: true })
		);
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(1);

		const b = renderHook(() =>
			useSessionDeviceHealth({ pollingEnabled: true })
		);
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(2);

		act(() => {
			a.unmount();
		});
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(1);

		act(() => {
			b.unmount();
		});
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(0);
	});

	it('does not retain poll when pollingEnabled is false', () => {
		const decorative = renderHook(() =>
			useSessionDeviceHealth({ pollingEnabled: false })
		);
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(0);
		act(() => {
			decorative.unmount();
		});
		expect(getSessionDeviceHealthPollRetainCountForTests()).toBe(0);
	});
});
