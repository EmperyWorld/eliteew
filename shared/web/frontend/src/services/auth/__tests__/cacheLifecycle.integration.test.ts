/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Integration lock for authenticated session cache teardown: login → data fetch → logout → empty
 * (React Query, conditionalJsonGet, desktop shell RAM, music IDB, principal-scoped LS, GAF E2EE LS).
 *
 * Invariants:
 * - Orchestrates the same teardown order as AuthContext logout without Keycloak.
 * - Fails if Wave 1 cause-layer hooks (IDB clear, principal LS purge, RQ/ETag/shell clear) regress.
 *
 * Related:
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md
 * - src/contexts/AuthContext.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';

type StoreMap = Map<IDBValidKey, unknown>;

const { installFakeIndexedDB, mockApiGet } = vi.hoisted(() => {
	type StoreRecord = { data: StoreMap; keyPath: string };

	function dispatchRequestSuccess<T>(request: IDBRequest<T>): void {
		setTimeout(() => {
			request.onsuccess?.({ target: request } as unknown as Event);
		}, 0);
	}

	function createObjectStore(record: StoreRecord): IDBObjectStore {
		const { data, keyPath } = record;
		return {
			put(value: unknown) {
				if (value && typeof value === 'object') {
					const key = (value as Record<string, IDBValidKey>)[keyPath];
					if (key !== undefined) data.set(key, value);
				}
				const request = {
					result: undefined,
				} as unknown as IDBRequest<IDBValidKey>;
				dispatchRequestSuccess(request);
				return request;
			},
			get(key: IDBValidKey) {
				const request = { result: data.get(key) } as IDBRequest<unknown>;
				dispatchRequestSuccess(request);
				return request;
			},
			getAll() {
				const request = { result: [...data.values()] } as IDBRequest<unknown[]>;
				dispatchRequestSuccess(request);
				return request;
			},
			clear() {
				data.clear();
				const request = { result: undefined } as IDBRequest<undefined>;
				dispatchRequestSuccess(request);
				return request;
			},
			delete(key: IDBValidKey) {
				data.delete(key);
				const request = { result: undefined } as IDBRequest<undefined>;
				dispatchRequestSuccess(request);
				return request;
			},
		} as IDBObjectStore;
	}

	function installFakeIndexedDB(): void {
		const databases = new Map<string, Map<string, StoreRecord>>();

		function getDbStores(dbName: string): Map<string, StoreRecord> {
			let stores = databases.get(dbName);
			if (!stores) {
				stores = new Map();
				databases.set(dbName, stores);
			}
			return stores;
		}

		const indexedDB = {
			open(dbName: string, version?: number) {
				const request = {} as IDBOpenDBRequest;
				const stores = getDbStores(dbName);
				const db = {
					objectStoreNames: {
						contains: (name: string) => stores.has(name),
					},
					createObjectStore(name: string, options?: IDBObjectStoreParameters) {
						const record: StoreRecord = {
							data: new Map(),
							keyPath: (options?.keyPath as string) ?? 'key',
						};
						stores.set(name, record);
						return createObjectStore(record);
					},
					transaction(storeName: string, _mode?: IDBTransactionMode) {
						let record = stores.get(storeName);
						if (!record) {
							record = { data: new Map(), keyPath: 'key' };
							stores.set(storeName, record);
						}
						const tx = {
							objectStore: () => createObjectStore(record),
							oncomplete: null as ((event: Event) => void) | null,
							onerror: null,
							onabort: null,
							error: null,
						};
						setTimeout(() => {
							tx.oncomplete?.({ target: tx } as unknown as Event);
						}, 10);
						return tx as unknown as IDBTransaction;
					},
					close() {},
				};

				setTimeout(() => {
					Object.defineProperty(request, 'result', {
						value: db as IDBDatabase,
						writable: true,
						configurable: true,
					});
					if (!stores.has('audio_blobs')) {
						request.onupgradeneeded?.({
							target: request,
							oldVersion: 0,
							newVersion: version ?? 1,
						} as unknown as IDBVersionChangeEvent);
					}
					request.onsuccess?.({ target: request } as unknown as Event);
				}, 0);
				return request;
			},
		} as IDBFactory;

		vi.stubGlobal('indexedDB', indexedDB);
	}

	const mockApiGet = vi.fn();

	return { installFakeIndexedDB, mockApiGet };
});

installFakeIndexedDB();

vi.mock('@/services/authSession', () => {
	const session = {
		token: 'integration-test-token',
		authenticated: true,
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken: vi.fn().mockResolvedValue(true),
	};
	return {
		default: session,
		authSession: session,
	};
});

vi.mock('@/services/api/client', async (importOriginal) =>
	importOriginal<typeof import('@/services/api/client')>()
);

import { apiClient } from '@/services/api/client';
import { queryClient, resetQueryClient } from '@/providers/QueryProvider';
import {
	clearFeSessionApiCaches,
	conditionalJsonGet,
	getConditionalJsonEtag,
} from '@/services/api/conditionalJsonGet';
import { executeFullLogoutCascade } from '@/services/auth/authSessionCoordinator';
import {
	clearPrincipalScopedLocalStorage,
	DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
} from '@/services/auth/clearPrincipalScopedLocalStorage';
import { STORAGE_KEYS } from '@/pages/Desktop/constants';
import {
	clearDesktopShellStateCache,
	fetchDesktopShellStateDeduplicated,
	peekDesktopShellStateCache,
} from '@/pages/Desktop/services/desktopApi';
import {
	getDesktopConditionalCacheEtag,
	updateDesktopConditionalCache,
} from '@/pages/Desktop/services/desktopConditionalGet';
import {
	getCachedAudioBlob,
	putCachedAudioBlob,
} from '@/pages/Desktop/utils/musicAudioBlobCache';
import { PROFILE_ME_QUERY_KEY } from '@/services/profileService';

const PRINCIPAL_A = 'user-a-sub';
const PRINCIPAL_B = 'user-b-sub';
const MUSIC_CACHE_KEY = `${PRINCIPAL_A}:track-1`;

const flushAsync = () =>
	new Promise<void>((resolve) => setTimeout(resolve, 25));

/** Mirrors AuthContext.logout cache teardown order (without Keycloak redirect). */
function runAuthLogoutCacheTeardown(principalId: string): void {
	executeFullLogoutCascade({ principalId });
}

function companionPinnedToolsKey(userId: string): string {
	return `eliteew.companion.pinnedTools.v1:${userId}`;
}

async function simulateAuthenticatedSessionWithDataFetch(): Promise<void> {
	queryClient.setQueryData(PROFILE_ME_QUERY_KEY, {
		id: PRINCIPAL_A,
		full_name: 'User A',
	});

	mockApiGet.mockResolvedValueOnce({
		status: 200,
		data: { total: 1 },
		headers: { etag: '"friends-etag"' },
	});
	await conditionalJsonGet<{ total: number }>(
		'friends:overview',
		'/friends/overview',
		{}
	);

	updateDesktopConditionalCache(
		'config',
		{ theme: 'dark' },
		'"desktop-config-etag"'
	);

	mockApiGet.mockResolvedValueOnce({
		data: { quiet_mode: false, ewa_hints: {} },
		headers: {
			etag: '"shell-etag"',
			'x-shell-state-field-etags': '{"quiet_mode":"field-qm"}',
		},
	});
	await fetchDesktopShellStateDeduplicated();

	const stored = await putCachedAudioBlob(
		MUSIC_CACHE_KEY,
		new Blob(['audio-bytes'], { type: 'audio/mpeg' })
	);
	expect(stored).toBe(true);

	localStorage.setItem(companionPinnedToolsKey(PRINCIPAL_A), '["tool-a"]');
	localStorage.setItem(`ewa_companion_voice_out.v1:${PRINCIPAL_A}`, '1');
	localStorage.setItem(companionPinnedToolsKey(PRINCIPAL_B), '["tool-b"]');
	localStorage.setItem('elite_desktop_config', '{"theme":"dark"}');
	localStorage.setItem(
		'gaf_chat_e2e_identity_private_jwk',
		JSON.stringify({ kty: 'RSA', d: 'secret' })
	);
	localStorage.setItem('gaf_chat_e2e_session_key_chat-1', 'session-key');
	localStorage.setItem(
		STORAGE_KEYS.WIDGET_NOTES,
		JSON.stringify([{ id: 'n1', content: 'private note' }])
	);
	localStorage.setItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY, '["secret clip"]');
}

function expectAuthenticatedCachesPopulated(): void {
	expect(queryClient.getQueryData(PROFILE_ME_QUERY_KEY)).toEqual({
		id: PRINCIPAL_A,
		full_name: 'User A',
	});
	expect(getConditionalJsonEtag('friends:overview')).toBe('"friends-etag"');
	expect(getDesktopConditionalCacheEtag('config')).toBe(
		'"desktop-config-etag"'
	);
	expect(getDesktopConditionalCacheEtag('shell-state')).toBe('"shell-etag"');
	expect(peekDesktopShellStateCache()).toEqual({
		quiet_mode: false,
		ewa_hints: {},
	});
}

async function expectLogoutCachesEmpty(): Promise<void> {
	expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	expect(getConditionalJsonEtag('friends:overview')).toBeNull();
	expect(getDesktopConditionalCacheEtag('config')).toBeNull();
	expect(getDesktopConditionalCacheEtag('shell-state')).toBeNull();
	expect(peekDesktopShellStateCache()).toBeNull();

	await flushAsync();
	expect(await getCachedAudioBlob(MUSIC_CACHE_KEY)).toBeNull();

	expect(localStorage.getItem(companionPinnedToolsKey(PRINCIPAL_A))).toBeNull();
	expect(
		localStorage.getItem(`ewa_companion_voice_out.v1:${PRINCIPAL_A}`)
	).toBeNull();
	expect(localStorage.getItem(companionPinnedToolsKey(PRINCIPAL_B))).toBe(
		'["tool-b"]'
	);
	expect(localStorage.getItem('elite_desktop_config')).toBe('{"theme":"dark"}');
	expect(localStorage.getItem('gaf_chat_e2e_identity_private_jwk')).toBeNull();
	expect(localStorage.getItem('gaf_chat_e2e_session_key_chat-1')).toBeNull();
	expect(localStorage.getItem(STORAGE_KEYS.WIDGET_NOTES)).toBeNull();
	expect(localStorage.getItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY)).toBeNull();
}

describe('cache lifecycle integration — login fetch logout empty', () => {
	let apiGetSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
		mockApiGet.mockReset();
		apiGetSpy = vi.spyOn(apiClient, 'get').mockImplementation(mockApiGet);
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
	});

	afterEach(async () => {
		apiGetSpy.mockRestore();
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
		vi.unstubAllGlobals();
		installFakeIndexedDB();
		await flushAsync();
	});

	it('clears RQ, ETag maps, shell RAM, music IDB, and principal LS after logout teardown', async () => {
		await simulateAuthenticatedSessionWithDataFetch();
		expect(await getCachedAudioBlob(MUSIC_CACHE_KEY)).not.toBeNull();
		expectAuthenticatedCachesPopulated();

		runAuthLogoutCacheTeardown(PRINCIPAL_A);

		await expectLogoutCachesEmpty();
	});

	it('leaves music IDB populated when clearDesktopShellStateCache is skipped (Wave 1 regression guard)', async () => {
		await simulateAuthenticatedSessionWithDataFetch();
		expect(await getCachedAudioBlob(MUSIC_CACHE_KEY)).not.toBeNull();

		clearPrincipalScopedLocalStorage(PRINCIPAL_A);
		clearFeSessionApiCaches();
		resetQueryClient();

		await flushAsync();
		expect(await getCachedAudioBlob(MUSIC_CACHE_KEY)).not.toBeNull();
	});
});
