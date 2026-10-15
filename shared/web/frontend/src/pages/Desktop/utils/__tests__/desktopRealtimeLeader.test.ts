/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for sync tab role detect and embedded client bypass.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
	DESKTOP_REALTIME_BC,
	LEADER_STALE_MS,
	detectSyncBrowserTabRole,
} from '../desktopRealtimeLeader';
import {
	getBrowserTabLeaderRole,
	normalizeSingleTabApiPath,
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
	shouldBlockSingleTabApi,
} from '@/utils/browserTabLeaderState';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { getOrCreateBrowserTabSessionId } from '@/utils/browserTabSessionId';

const LOCK_PREFIX = 'eliteew-desktop-realtime:';

function mockStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => map.get(key) ?? null,
		key: (index: number) => [...map.keys()][index] ?? null,
		removeItem: (key: string) => {
			map.delete(key);
		},
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
	};
}

describe('desktopRealtimeLeader', () => {
	beforeEach(() => {
		const local = mockStorage();
		const session = mockStorage();
		Object.defineProperty(globalThis, 'localStorage', {
			value: local,
			configurable: true,
		});
		Object.defineProperty(globalThis, 'sessionStorage', {
			value: session,
			configurable: true,
		});
	});
	it('uses stable BroadcastChannel name for relay', () => {
		expect(DESKTOP_REALTIME_BC).toBe('eliteew-desktop-realtime-v1');
	});

	it('detectSyncBrowserTabRole marks second tab follower when heartbeat fresh', () => {
		const userId = 'user-test-1';
		const leaderTab = 'leader-tab-id';
		const storageKey = `${LOCK_PREFIX}heartbeat:${userId}`;
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				tabId: leaderTab,
				ts: Date.now(),
				socketConnected: true,
			})
		);
		sessionStorage.setItem('eliteew.browser-tab-session-id', 'follower-tab-id');
		expect(detectSyncBrowserTabRole(userId)).toBe('follower');
	});

	it('detectSyncBrowserTabRole allows leader when heartbeat stale', () => {
		const userId = 'user-test-2';
		const storageKey = `${LOCK_PREFIX}heartbeat:${userId}`;
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				tabId: 'old-tab',
				ts: Date.now() - LEADER_STALE_MS - 1000,
				socketConnected: false,
			})
		);
		sessionStorage.setItem('eliteew.browser-tab-session-id', 'new-tab-id');
		expect(detectSyncBrowserTabRole(userId)).toBe('leader');
	});
});

describe('browserTabLeaderState', () => {
	beforeEach(() => {
		setSingleTabPolicyEnabled(true);
		setBrowserTabLeaderRole('follower');
	});

	afterEach(() => {
		setSingleTabPolicyEnabled(!isEmbeddedEliteEWClient());
		setBrowserTabLeaderRole('leader');
	});

	it('blocks gated API for non-leader when policy enabled', () => {
		expect(shouldBlockSingleTabApi('/api/v1/desktop/shell-state')).toBe(true);
		expect(
			shouldBlockSingleTabApi('/desktop/shell-state', 'PATCH', '/api/v1')
		).toBe(true);
		expect(
			shouldBlockSingleTabApi(
				'/desktop/shell-state',
				'PATCH',
				'https://app.eliteew.ru/api/v1'
			)
		).toBe(true);
		expect(shouldBlockSingleTabApi('/api/v1/auth/refresh')).toBe(false);
	});

	it('allows unified content media download on follower tabs', () => {
		expect(
			shouldBlockSingleTabApi(
				'/api/v1/content/cedc59e7-826a-46ac-8cdc-907d7f4eda44/download',
				'get'
			)
		).toBe(false);
		expect(
			shouldBlockSingleTabApi(
				'/api/v1/content/cedc59e7-826a-46ac-8cdc-907d7f4eda44/thumbnail',
				'GET'
			)
		).toBe(false);
		expect(
			shouldBlockSingleTabApi(
				'/content/cedc59e7-826a-46ac-8cdc-907d7f4eda44/download',
				'GET',
				'/api/v1'
			)
		).toBe(false);
		expect(
			shouldBlockSingleTabApi('/api/v1/content?content_type=audio', 'get')
		).toBe(true);
	});

	it('normalizes baseURL + url before matching gated paths', () => {
		expect(normalizeSingleTabApiPath('/desktop/shell-state', '/api/v1')).toBe(
			'/api/v1/desktop/shell-state'
		);
		expect(
			normalizeSingleTabApiPath(
				'desktop/shell-state?x=1',
				'https://app.eliteew.ru/api/v1/'
			)
		).toBe('/api/v1/desktop/shell-state?x=1');
		expect(
			normalizeSingleTabApiPath('/api/v1/desktop/shell-state', '/api/v1')
		).toBe('/api/v1/desktop/shell-state');
	});

	it('does not block when policy disabled (embedded client path)', () => {
		setSingleTabPolicyEnabled(false);
		expect(shouldBlockSingleTabApi('/api/v1/desktop/shell-state')).toBe(false);
	});

	it('stores leadership role', () => {
		setBrowserTabLeaderRole('leader');
		expect(getBrowserTabLeaderRole()).toBe('leader');
	});
});

describe('eliteewEmbeddedClient', () => {
	it('returns false for default test UA', () => {
		expect(isEmbeddedEliteEWClient()).toBe(false);
	});
});

describe('browserTabSessionId', () => {
	it('returns stable id within session', () => {
		sessionStorage.removeItem('eliteew.browser-tab-session-id');
		const a = getOrCreateBrowserTabSessionId();
		const b = getOrCreateBrowserTabSessionId();
		expect(a).toBe(b);
	});
});
