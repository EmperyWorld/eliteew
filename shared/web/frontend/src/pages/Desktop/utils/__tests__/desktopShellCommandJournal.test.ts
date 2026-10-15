/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * L3 contractual tests for shell command journal: retain across “reload”,
 * clear only after successful flush, honest failure when IndexedDB missing.
 *
 * Invariants:
 * - Uses in-memory fake IndexedDB; no network.
 *
 * Related:
 * - utils/desktopShellCommandJournal.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
							keyPath: (options?.keyPath as string) ?? 'id',
						};
						stores.set(name, record);
						return createObjectStore(record);
					},
					transaction(storeName: string, _mode?: IDBTransactionMode) {
						let record = stores.get(storeName);
						if (!record) {
							record = { data: new Map(), keyPath: 'id' };
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
					if (!stores.has('envelopes')) {
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
	clearShellCommandJournal,
	enqueueShellCommandJournal,
	flushShellCommandJournal,
	getShellCommandJournalCount,
	peekShellCommandJournal,
	resetShellCommandJournalMemoryForTests,
} from '../desktopShellCommandJournal';

const flushAsync = () =>
	new Promise<void>((resolve) => setTimeout(resolve, 25));

describe('desktopShellCommandJournal (L3)', () => {
	beforeEach(async () => {
		resetShellCommandJournalMemoryForTests();
		await clearShellCommandJournal();
		await flushAsync();
	});

	afterEach(async () => {
		await clearShellCommandJournal();
		resetShellCommandJournalMemoryForTests();
		vi.unstubAllGlobals();
		installFakeIndexedDB();
	});

	it('retains windows command across simulated reload and clears only after successful flush', async () => {
		const subject = 'user-shell-l3';
		const first = await enqueueShellCommandJournal(subject, 'windows', {
			windows_snapshot: { activeDesktopId: 'd1', windows: [{ id: 'w1' }] },
		});
		expect(first.ok).toBe(true);
		expect(await getShellCommandJournalCount(subject)).toBe(1);

		// Simulate module memory loss; IDB envelope must remain.
		resetShellCommandJournalMemoryForTests();
		const peeked = await peekShellCommandJournal(subject);
		expect(peeked?.ops).toHaveLength(1);
		expect(peeked?.ops[0]?.domain).toBe('windows');

		const patchShell = vi.fn(async () => undefined);
		const failed = await flushShellCommandJournal({
			subject,
			patchShell: async () => {
				throw new Error('network down');
			},
		});
		expect(failed.ok).toBe(false);
		expect(await getShellCommandJournalCount(subject)).toBe(1);

		const ok = await flushShellCommandJournal({ subject, patchShell });
		expect(ok.ok).toBe(true);
		expect(patchShell).toHaveBeenCalledTimes(1);
		expect(await getShellCommandJournalCount(subject)).toBe(0);
		expect(await peekShellCommandJournal(subject)).toBeNull();
	});

	it('coalesces same-domain commands so only latest windows snapshot remains', async () => {
		const subject = 'user-coalesce';
		await enqueueShellCommandJournal(subject, 'windows', {
			windows_snapshot: { windows: [] },
		});
		await enqueueShellCommandJournal(subject, 'windows', {
			windows_snapshot: { windows: [{ id: 'latest' }] },
		});
		await enqueueShellCommandJournal(subject, 'virtualDesktops', {
			virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
		});
		const env = await peekShellCommandJournal(subject);
		expect(env?.ops).toHaveLength(2);
		const windowsOp = env?.ops.find((op) => op.domain === 'windows');
		expect(windowsOp?.patch).toEqual({
			windows_snapshot: { windows: [{ id: 'latest' }] },
		});
	});

	it('returns honest unavailable when IndexedDB is missing', async () => {
		vi.unstubAllGlobals();
		vi.stubGlobal('indexedDB', undefined);
		resetShellCommandJournalMemoryForTests();

		const result = await enqueueShellCommandJournal('user-no-idb', 'windows', {
			windows_snapshot: { windows: [] },
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe('unavailable');
		}

		installFakeIndexedDB();
	});
});
