import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearDesktopPersistPatchQueue,
	enqueueDesktopPersistConfigPatch,
	enqueueDesktopPersistShellPatch,
	flushDesktopPersistPatchQueue,
	getDesktopPersistPatchQueueCounts,
} from '../desktopPersistPatchQueue';

const KEY = 'eliteew-desktop-persist-patch-queue-v1';

function ensureLocalStorageForTest(): void {
	if (typeof localStorage !== 'undefined') return;
	const store = new Map<string, string>();
	const storage = {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, String(value));
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		}),
		clear: vi.fn(() => {
			store.clear();
		}),
		key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
		get length() {
			return store.size;
		},
	} satisfies Storage;
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: storage,
	});
}

describe('desktopPersistPatchQueue', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		localStorage.clear();
	});

	afterEach(() => {
		clearDesktopPersistPatchQueue();
		vi.restoreAllMocks();
	});

	it('enqueues config and shell in FIFO order and drains on flush', async () => {
		const patches: Array<{ kind: string; payload: Record<string, unknown> }> =
			[];
		const cfg = vi.fn(async (payload: Record<string, unknown>) => {
			patches.push({ kind: 'config', payload });
		});
		const sh = vi.fn(async (payload: Record<string, unknown>) => {
			patches.push({ kind: 'shell', payload });
		});

		enqueueDesktopPersistConfigPatch('u1', { theme: 'DARK' });
		enqueueDesktopPersistShellPatch('u1', { quiet_mode: true });

		const r = await flushDesktopPersistPatchQueue({
			subject: 'u1',
			patchConfig: cfg,
			patchShell: sh,
		});
		expect(r.ok).toBe(true);
		expect(patches.map((p) => p.kind)).toEqual(['config', 'shell']);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it('stops flush on failure and retains remaining ops', async () => {
		enqueueDesktopPersistConfigPatch('u1', { a: 1 });
		enqueueDesktopPersistConfigPatch('u1', { b: 2 });

		const cfg = vi
			.fn()
			.mockRejectedValueOnce(new Error('net'))
			.mockResolvedValueOnce(undefined);

		const r = await flushDesktopPersistPatchQueue({
			subject: 'u1',
			patchConfig: cfg,
			patchShell: async () => {},
		});

		expect(r.ok).toBe(false);
		expect(cfg).toHaveBeenCalledTimes(1);
		const raw = localStorage.getItem(KEY);
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw as string) as { ops: unknown[] };
		expect(parsed.ops).toHaveLength(2);
	});

	it('returns stable count snapshots for useSyncExternalStore', () => {
		expect(getDesktopPersistPatchQueueCounts(null)).toBe(
			getDesktopPersistPatchQueueCounts(null)
		);

		const emptyForSubject = getDesktopPersistPatchQueueCounts('u1');
		expect(getDesktopPersistPatchQueueCounts('u1')).toBe(emptyForSubject);

		enqueueDesktopPersistConfigPatch('u1', { theme: 'DARK' });
		const queuedForSubject = getDesktopPersistPatchQueueCounts('u1');
		expect(queuedForSubject).toEqual({ config: 1, shell: 0, total: 1 });
		expect(getDesktopPersistPatchQueueCounts('u1')).toBe(queuedForSubject);
	});
});
