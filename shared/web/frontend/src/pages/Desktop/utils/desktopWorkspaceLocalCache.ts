/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P3 subject-scoped durable cache for desktop items (+ optional config snapshot)
 * so offline edits survive reload and reconnect flush. Not a second source of truth
 * while online — dirty flag drives flush-before-GET.
 *
 * Invariants:
 * - Envelope keyed by auth subject; cross-user leakage forbidden.
 * - Clear only on logout / explicit clear; never silent wipe on offline boot.
 * - `itemsDirty` cleared only after successful full items PUT.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - utils/desktopPersistPatchQueue.ts (config PATCH peer)
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import { log } from '@/utils/logger';
import type { DesktopConfig, DesktopItem } from '../types/desktop.types';

export const DESKTOP_WORKSPACE_LOCAL_CACHE_KEY =
	'eliteew-desktop-workspace-local-cache-v1' as const;

const MAX_SUBJECTS = 4;

export type DesktopWorkspaceLocalCacheEnvelope = {
	version: 1;
	subject: string;
	items: DesktopItem[];
	config: DesktopConfig | null;
	itemsDirty: boolean;
	updatedAt: string;
};

type StoreFile = {
	version: 1;
	bySubject: Record<string, DesktopWorkspaceLocalCacheEnvelope>;
};

function stripNonJson(value: unknown): unknown {
	if (value == null) return value;
	if (typeof value === 'function') return undefined;
	if (typeof value !== 'object') return value;
	if (Array.isArray(value)) {
		return value.map(stripNonJson).filter((entry) => entry !== undefined);
	}
	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (key === 'icon') continue;
		const next = stripNonJson(entry);
		if (next !== undefined) out[key] = next;
	}
	return out;
}

function serializeItems(items: DesktopItem[]): DesktopItem[] {
	try {
		return JSON.parse(JSON.stringify(stripNonJson(items))) as DesktopItem[];
	} catch {
		return [];
	}
}

function serializeConfig(config: DesktopConfig | null): DesktopConfig | null {
	if (!config) return null;
	try {
		return JSON.parse(JSON.stringify(config)) as DesktopConfig;
	} catch {
		return null;
	}
}

function loadStore(): StoreFile {
	try {
		const raw = localStorage.getItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY);
		if (!raw) return { version: 1, bySubject: {} };
		const parsed = JSON.parse(raw) as unknown;
		if (
			parsed == null ||
			typeof parsed !== 'object' ||
			(parsed as StoreFile).version !== 1 ||
			typeof (parsed as StoreFile).bySubject !== 'object'
		) {
			return { version: 1, bySubject: {} };
		}
		return parsed as StoreFile;
	} catch {
		return { version: 1, bySubject: {} };
	}
}

function saveStore(store: StoreFile): boolean {
	try {
		const subjects = Object.keys(store.bySubject);
		if (subjects.length > MAX_SUBJECTS) {
			const ranked = subjects
				.map((subject) => ({
					subject,
					updatedAt: store.bySubject[subject]?.updatedAt ?? '',
				}))
				.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
			const drop = ranked.slice(0, subjects.length - MAX_SUBJECTS);
			for (const row of drop) {
				delete store.bySubject[row.subject];
			}
			log.warn(
				'Desktop',
				`Workspace local cache trimmed to ${MAX_SUBJECTS} subjects`
			);
		}
		localStorage.setItem(
			DESKTOP_WORKSPACE_LOCAL_CACHE_KEY,
			JSON.stringify(store)
		);
		return true;
	} catch (error) {
		log.warn(
			'Desktop',
			'Workspace local cache save failed',
			error instanceof Error ? error : undefined
		);
		return false;
	}
}

export function peekDesktopWorkspaceLocalCache(
	subject: string | null | undefined
): DesktopWorkspaceLocalCacheEnvelope | null {
	const trimmed = subject?.trim();
	if (!trimmed) return null;
	const env = loadStore().bySubject[trimmed];
	return env ?? null;
}

export function writeDesktopWorkspaceLocalCache(params: {
	subject: string;
	items: DesktopItem[];
	config?: DesktopConfig | null;
	itemsDirty?: boolean;
}): boolean {
	const trimmed = params.subject.trim();
	if (!trimmed) return false;
	const store = loadStore();
	const prev = store.bySubject[trimmed];
	const next: DesktopWorkspaceLocalCacheEnvelope = {
		version: 1,
		subject: trimmed,
		items: serializeItems(params.items),
		config:
			params.config !== undefined
				? serializeConfig(params.config)
				: (prev?.config ?? null),
		itemsDirty: params.itemsDirty ?? prev?.itemsDirty ?? false,
		updatedAt: new Date().toISOString(),
	};
	store.bySubject[trimmed] = next;
	return saveStore(store);
}

export function markDesktopWorkspaceItemsDirty(
	subject: string,
	dirty: boolean
): void {
	const trimmed = subject.trim();
	if (!trimmed) return;
	const store = loadStore();
	const prev = store.bySubject[trimmed];
	if (!prev) return;
	store.bySubject[trimmed] = {
		...prev,
		itemsDirty: dirty,
		updatedAt: new Date().toISOString(),
	};
	saveStore(store);
}

export function clearDesktopWorkspaceLocalCache(subject?: string | null): void {
	try {
		const trimmed = subject?.trim();
		if (!trimmed) {
			localStorage.removeItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY);
			return;
		}
		const store = loadStore();
		delete store.bySubject[trimmed];
		if (Object.keys(store.bySubject).length === 0) {
			localStorage.removeItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY);
			return;
		}
		saveStore(store);
	} catch {
		/* ignore */
	}
}
