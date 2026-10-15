/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for session teardown: music IndexedDB audio cache must clear on logout path.
 *
 * Invariants:
 * - Uses in-memory fake IndexedDB installed before module load; no network.
 *
 * Related:
 * - src/pages/Desktop/services/desktopApi.ts
 * - src/pages/Desktop/utils/musicAudioBlobCache.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type StoreMap = Map<IDBValidKey, unknown>;

const { installFakeIndexedDB } = vi.hoisted(() => {
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
					(request as { result: IDBDatabase }).result = db as IDBDatabase;
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

	return { installFakeIndexedDB };
});

installFakeIndexedDB();

import {
	clearCachedAudioBlobs,
	getCachedAudioBlob,
	putCachedAudioBlob,
} from '../../utils/musicAudioBlobCache';
import { clearDesktopShellStateCache } from '../desktopApi';

const flushAsync = () =>
	new Promise<void>((resolve) => setTimeout(resolve, 20));

describe('desktopApi logout teardown — music IDB cache', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		installFakeIndexedDB();
	});

	it('clearDesktopShellStateCache clears music audio blobs after put', async () => {
		const stored = await putCachedAudioBlob(
			'track-logout-test',
			new Blob(['audio-bytes'], { type: 'audio/mpeg' })
		);
		expect(stored).toBe(true);
		expect(await getCachedAudioBlob('track-logout-test')).not.toBeNull();

		clearDesktopShellStateCache();
		await flushAsync();

		expect(await getCachedAudioBlob('track-logout-test')).toBeNull();
	});

	it('clearCachedAudioBlobs empties the audio blob store', async () => {
		await putCachedAudioBlob(
			'track-direct-clear',
			new Blob(['audio-bytes'], { type: 'audio/mpeg' })
		);
		expect(await getCachedAudioBlob('track-direct-clear')).not.toBeNull();

		await clearCachedAudioBlobs();
		await flushAsync();

		expect(await getCachedAudioBlob('track-direct-clear')).toBeNull();
	});
});
