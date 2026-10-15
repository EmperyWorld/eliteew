/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P1 IndexedDB command journal for desktop shell domains `windows` and
 * `virtualDesktops`. Local-first durability before / when network PATCH fails;
 * clear ops only after successful flush (2xx / pipeline OK).
 *
 * Invariants:
 * - One envelope per auth subject; at most one pending op per domain (snapshot coalesce).
 * - Prefer `IDBTransaction` durability `"strict"` when the browser supports it.
 * - Unavailable / quota → `{ ok: false, reason }` — callers must not claim “saved”.
 * - Logout clears the journal store (see `clearDesktopShellStateCache`).
 *
 * Related:
 * - utils/desktopWidgetOutboxQueue.ts (peer pattern)
 * - hooks/useDesktopShellWindowPersistence.ts, hooks/useVirtualDesktops.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import { log } from '@/utils/logger';

export const DESKTOP_SHELL_COMMAND_JOURNAL_DB =
	'eliteew-desktop-shell-command-journal-v1' as const;
export const DESKTOP_SHELL_COMMAND_JOURNAL_STORE = 'envelopes' as const;

const DB_VERSION = 1;
const MAX_OPS = 16;

export type ShellCommandJournalDomain = 'windows' | 'virtualDesktops';

export type ShellCommandJournalOp = {
	id: string;
	domain: ShellCommandJournalDomain;
	patch: Record<string, unknown>;
	createdAt: string;
};

export type ShellCommandJournalEnvelope = {
	id: string;
	version: 1;
	subject: string;
	ops: ShellCommandJournalOp[];
};

export type ShellCommandJournalEnqueueResult =
	| { ok: true; op: ShellCommandJournalOp }
	| { ok: false; reason: 'unavailable' | 'quota' | 'clone_failed' };

type Listener = () => void;

const listeners = new Set<Listener>();
let memoryFallback: ShellCommandJournalEnvelope | null = null;
let lastCountSnapshot: { subject: string | null; total: number } = {
	subject: null,
	total: 0,
};

function notify(): void {
	for (const fn of listeners) {
		try {
			fn();
		} catch {
			/* ignore listener errors */
		}
	}
}

export function subscribeShellCommandJournal(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function newOpId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `shell-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clonePatch(
	patch: Record<string, unknown>
): Record<string, unknown> | null {
	try {
		return JSON.parse(JSON.stringify(patch)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function isIndexedDbAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
	if (!isIndexedDbAvailable()) return Promise.resolve(null);
	return new Promise((resolve) => {
		try {
			const request = indexedDB.open(
				DESKTOP_SHELL_COMMAND_JOURNAL_DB,
				DB_VERSION
			);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (
					!db.objectStoreNames.contains(DESKTOP_SHELL_COMMAND_JOURNAL_STORE)
				) {
					db.createObjectStore(DESKTOP_SHELL_COMMAND_JOURNAL_STORE, {
						keyPath: 'id',
					});
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

function txDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error ?? new Error('idb transaction abort'));
		tx.onerror = () => reject(tx.error ?? new Error('idb transaction error'));
	});
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function openReadwriteTx(db: IDBDatabase): IDBTransaction {
	try {
		return db.transaction(DESKTOP_SHELL_COMMAND_JOURNAL_STORE, 'readwrite', {
			durability: 'strict',
		} as IDBTransactionOptions);
	} catch {
		return db.transaction(DESKTOP_SHELL_COMMAND_JOURNAL_STORE, 'readwrite');
	}
}

async function withStore<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
	const db = await openDb();
	if (!db) return null;
	try {
		const tx =
			mode === 'readonly'
				? db.transaction(DESKTOP_SHELL_COMMAND_JOURNAL_STORE, 'readonly')
				: openReadwriteTx(db);
		const store = tx.objectStore(DESKTOP_SHELL_COMMAND_JOURNAL_STORE);
		const result = await fn(store);
		await txDone(tx);
		return result;
	} catch (error) {
		log.warn(
			'Desktop',
			'Shell command journal IDB transaction failed',
			error instanceof Error ? error : undefined
		);
		return null;
	} finally {
		db.close();
	}
}

function normalizeEnvelope(raw: unknown): ShellCommandJournalEnvelope | null {
	if (raw == null || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (
		o.version !== 1 ||
		typeof o.subject !== 'string' ||
		typeof o.id !== 'string' ||
		!Array.isArray(o.ops)
	) {
		return null;
	}
	return {
		id: o.id,
		version: 1,
		subject: o.subject,
		ops: o.ops as ShellCommandJournalOp[],
	};
}

async function loadEnvelope(
	subject: string
): Promise<ShellCommandJournalEnvelope | null> {
	const fromIdb = await withStore('readonly', async (store) => {
		const raw = await requestToPromise(store.get(subject));
		return normalizeEnvelope(raw);
	});
	if (fromIdb) return fromIdb;
	if (memoryFallback && memoryFallback.subject === subject) {
		return memoryFallback;
	}
	return null;
}

async function saveEnvelope(
	env: ShellCommandJournalEnvelope
): Promise<'ok' | 'unavailable' | 'quota'> {
	const written = await withStore('readwrite', async (store) => {
		await requestToPromise(store.put(env));
		return true as const;
	});
	if (written) {
		memoryFallback = null;
		lastCountSnapshot = { subject: env.subject, total: env.ops.length };
		notify();
		return 'ok';
	}
	if (!isIndexedDbAvailable()) {
		memoryFallback = env;
		lastCountSnapshot = { subject: env.subject, total: env.ops.length };
		notify();
		log.warn(
			'Desktop',
			'Shell command journal using memory fallback (IndexedDB unavailable)'
		);
		return 'unavailable';
	}
	// IDB open/tx failed — try memory so session is not silent, but report unavailable
	memoryFallback = env;
	lastCountSnapshot = { subject: env.subject, total: env.ops.length };
	notify();
	log.warn(
		'Desktop',
		'Shell command journal IDB save failed; memory-only (not durable across reload)'
	);
	return 'unavailable';
}

export async function enqueueShellCommandJournal(
	subject: string,
	domain: ShellCommandJournalDomain,
	patch: Record<string, unknown>
): Promise<ShellCommandJournalEnqueueResult> {
	const trimmed = subject.trim();
	if (!trimmed) {
		return { ok: false, reason: 'unavailable' };
	}
	const cloned = clonePatch(patch);
	if (!cloned || Object.keys(cloned).length === 0) {
		return { ok: false, reason: 'clone_failed' };
	}

	const existing = (await loadEnvelope(trimmed)) ?? {
		id: trimmed,
		version: 1 as const,
		subject: trimmed,
		ops: [] as ShellCommandJournalOp[],
	};

	const op: ShellCommandJournalOp = {
		id: newOpId(),
		domain,
		patch: cloned,
		createdAt: new Date().toISOString(),
	};

	const ops = existing.ops.filter((entry) => entry.domain !== domain);
	ops.push(op);
	if (ops.length > MAX_OPS) {
		ops.splice(0, ops.length - MAX_OPS);
		log.warn(
			'Desktop',
			`Shell command journal trimmed to ${MAX_OPS} ops (subject-scoped)`
		);
	}

	const next: ShellCommandJournalEnvelope = {
		...existing,
		id: trimmed,
		subject: trimmed,
		ops,
	};

	const saveResult = await saveEnvelope(next);
	if (saveResult === 'quota') {
		return { ok: false, reason: 'quota' };
	}
	if (saveResult === 'unavailable') {
		return { ok: false, reason: 'unavailable' };
	}
	return { ok: true, op };
}

export async function peekShellCommandJournal(
	subject: string | null
): Promise<ShellCommandJournalEnvelope | null> {
	if (!subject?.trim()) return null;
	return loadEnvelope(subject.trim());
}

export async function getShellCommandJournalCount(
	subject: string | null
): Promise<number> {
	if (!subject?.trim()) {
		lastCountSnapshot = { subject: null, total: 0 };
		return 0;
	}
	const env = await loadEnvelope(subject.trim());
	const total = env?.ops.length ?? 0;
	lastCountSnapshot = { subject: subject.trim(), total };
	return total;
}

/** Sync snapshot for useSyncExternalStore (may lag one tick after async enqueue). */
export function getShellCommandJournalCountSync(
	subject: string | null
): number {
	if (!subject?.trim()) return 0;
	if (lastCountSnapshot.subject === subject.trim()) {
		return lastCountSnapshot.total;
	}
	if (memoryFallback && memoryFallback.subject === subject.trim()) {
		return memoryFallback.ops.length;
	}
	return lastCountSnapshot.subject === subject.trim()
		? lastCountSnapshot.total
		: 0;
}

export async function clearShellCommandJournalDomain(
	subject: string,
	domain: ShellCommandJournalDomain
): Promise<void> {
	const trimmed = subject.trim();
	if (!trimmed) return;
	const env = await loadEnvelope(trimmed);
	if (!env) return;
	const ops = env.ops.filter((entry) => entry.domain !== domain);
	if (ops.length === env.ops.length) return;
	if (ops.length === 0) {
		await clearShellCommandJournal(trimmed);
		return;
	}
	await saveEnvelope({ ...env, ops });
}

export async function clearShellCommandJournal(
	subject?: string | null
): Promise<void> {
	const trimmed = subject?.trim();
	if (trimmed) {
		await withStore('readwrite', async (store) => {
			await requestToPromise(store.delete(trimmed));
			return true as const;
		});
		if (memoryFallback?.subject === trimmed) {
			memoryFallback = null;
		}
		lastCountSnapshot = { subject: trimmed, total: 0 };
		notify();
		return;
	}
	await withStore('readwrite', async (store) => {
		await requestToPromise(store.clear());
		return true as const;
	});
	memoryFallback = null;
	lastCountSnapshot = { subject: null, total: 0 };
	notify();
}

export type FlushShellCommandJournalParams = {
	subject: string;
	patchShell: (
		domain: ShellCommandJournalDomain,
		patch: Record<string, unknown>
	) => Promise<void>;
};

/**
 * Apply journaled ops in order. Stops on first failure; remaining ops stay queued.
 */
export async function flushShellCommandJournal(
	params: FlushShellCommandJournalParams
): Promise<{ ok: boolean; error?: string }> {
	const trimmed = params.subject.trim();
	const env = await loadEnvelope(trimmed);
	if (!env || env.ops.length === 0 || env.subject !== trimmed) {
		return { ok: true };
	}

	const remaining = [...env.ops];
	while (remaining.length > 0) {
		const next = remaining[0];
		try {
			await params.patchShell(next.domain, next.patch);
			remaining.shift();
			if (remaining.length === 0) {
				await clearShellCommandJournal(trimmed);
			} else {
				await saveEnvelope({ ...env, ops: remaining });
			}
		} catch (err) {
			const error =
				err instanceof Error
					? err.message
					: 'shell command journal flush failed';
			await saveEnvelope({ ...env, ops: remaining });
			return { ok: false, error };
		}
	}
	return { ok: true };
}

/** Test / logout helper: drop memory fallback without touching IDB. */
export function resetShellCommandJournalMemoryForTests(): void {
	memoryFallback = null;
	lastCountSnapshot = { subject: null, total: 0 };
	notify();
}
