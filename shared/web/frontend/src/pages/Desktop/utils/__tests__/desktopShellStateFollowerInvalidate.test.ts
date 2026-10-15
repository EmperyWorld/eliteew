/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock follower RAM shell_state invalidation when leader broadcasts shell-state-invalidated BC.
 *
 * Invariants:
 * - Mocks only; no network.
 *
 * Related:
 * - `services/desktopApi.ts`, `utils/desktopRealtimeLeader.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
	shouldBlockSingleTabApi,
} from '@/utils/browserTabLeaderState';
import {
	clearDesktopShellStateCache,
	fetchDesktopShellStateDeduplicated,
	peekDesktopShellStateCache,
	SHELL_STATE_INVALIDATED_BC,
} from '../../services/desktopApi';
import {
	DESKTOP_REALTIME_BC,
	handleDesktopShellStateInvalidatedForFollower,
} from '../desktopRealtimeLeader';

const apiClientGet = vi.hoisted(() => vi.fn());
const logCacheInvalidationMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/authSession', () => ({
	authSession: {
		token: 'test-token',
		authenticated: true,
	},
}));

vi.mock('../../../../services/api/client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../../services/api/client')>();
	return {
		...actual,
		apiClient: {
			...actual.apiClient,
			get: apiClientGet,
		},
	};
});

vi.mock('../../../../services/api/cacheInvalidationLogger', () => ({
	logCacheInvalidation: logCacheInvalidationMock,
}));

type BcListener = (event: MessageEvent) => void;

class MockBroadcastChannel {
	static readonly instances = new Map<string, Set<MockBroadcastChannel>>();
	readonly name: string;
	onmessage: ((event: MessageEvent) => void) | null = null;
	private listeners = new Set<BcListener>();

	constructor(name: string) {
		this.name = name;
		const peers = MockBroadcastChannel.instances.get(name) ?? new Set();
		peers.add(this);
		MockBroadcastChannel.instances.set(name, peers);
	}

	addEventListener(_type: 'message', listener: BcListener): void {
		this.listeners.add(listener);
	}

	removeEventListener(_type: 'message', listener: BcListener): void {
		this.listeners.delete(listener);
	}

	postMessage(data: unknown): void {
		const event = { data } as MessageEvent;
		this.onmessage?.(event);
		for (const ch of MockBroadcastChannel.instances.get(this.name) ?? []) {
			if (ch === this) continue;
			ch.onmessage?.(event);
			for (const listener of ch.listeners) {
				listener(event);
			}
		}
	}

	close(): void {
		MockBroadcastChannel.instances.get(this.name)?.delete(this);
	}
}

describe('desktopShellStateFollowerInvalidate', () => {
	beforeEach(() => {
		MockBroadcastChannel.instances.clear();
		vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
		clearDesktopShellStateCache();
		setBrowserTabLeaderRole('follower');
		apiClientGet.mockReset();
		logCacheInvalidationMock.mockReset();
	});

	afterEach(() => {
		clearDesktopShellStateCache();
		setBrowserTabLeaderRole('leader');
		vi.unstubAllGlobals();
	});

	async function populateShellCache(): Promise<void> {
		apiClientGet.mockResolvedValueOnce({
			data: { quiet_mode: true },
			headers: { etag: '"etag-follower"' },
		});
		await fetchDesktopShellStateDeduplicated();
		expect(peekDesktopShellStateCache()).toEqual({ quiet_mode: true });
	}

	it('uses shared BC channel and message type constants', () => {
		expect(DESKTOP_REALTIME_BC).toBe('eliteew-desktop-realtime-v1');
		expect(SHELL_STATE_INVALIDATED_BC).toBe('shell-state-invalidated');
	});

	it('clears follower RAM cache on shell-state-invalidated handler', async () => {
		await populateShellCache();

		handleDesktopShellStateInvalidatedForFollower(
			SHELL_STATE_INVALIDATED_BC,
			'follower'
		);

		expect(peekDesktopShellStateCache()).toBeNull();
		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'invalidateDesktopShellStateRamCache'
		);
	});

	it('does not clear cache for leader role or unrelated BC types', async () => {
		await populateShellCache();

		handleDesktopShellStateInvalidatedForFollower(
			SHELL_STATE_INVALIDATED_BC,
			'leader'
		);
		expect(peekDesktopShellStateCache()).toEqual({ quiet_mode: true });

		handleDesktopShellStateInvalidatedForFollower('leader-alive', 'follower');
		expect(peekDesktopShellStateCache()).toEqual({ quiet_mode: true });
	});

	it('follower BC listener clears populated shell cache', async () => {
		await populateShellCache();

		const follower = new MockBroadcastChannel(DESKTOP_REALTIME_BC);
		follower.onmessage = (event: MessageEvent) => {
			const data = event.data as Record<string, unknown> | undefined;
			if (!data?.type) return;
			handleDesktopShellStateInvalidatedForFollower(
				String(data.type),
				'follower'
			);
		};

		const leader = new MockBroadcastChannel(DESKTOP_REALTIME_BC);
		leader.postMessage({ type: SHELL_STATE_INVALIDATED_BC });

		expect(peekDesktopShellStateCache()).toBeNull();
		follower.close();
		leader.close();
	});

	it('follower write storm — single-tab gate blocks every shell-state PATCH', () => {
		setSingleTabPolicyEnabled(true);
		setBrowserTabLeaderRole('follower');

		for (let i = 0; i < 20; i++) {
			expect(
				shouldBlockSingleTabApi('/api/v1/desktop/shell-state', 'PATCH')
			).toBe(true);
			expect(
				shouldBlockSingleTabApi('/desktop/shell-state', 'PATCH', '/api/v1')
			).toBe(true);
		}
	});
});
