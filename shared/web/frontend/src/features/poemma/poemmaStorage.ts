/**
 * Poemma localStorage key layout — one namespace per Empery user (tenant isolation).
 */

import type { PoemmaOrganization, PoemmaUserId } from './poemmaDomain';

export const POEMMA_STORAGE_VERSION = 'v1';
const LEGACY_PREFIX = `poemma:${POEMMA_STORAGE_VERSION}:`;

export function poemmaStoragePrefix(userId: PoemmaUserId): string {
	const normalized = userId.trim();
	if (!normalized) {
		throw new Error('Poemma: userId обязателен для storage');
	}
	return `poemma:${POEMMA_STORAGE_VERSION}:${normalized}:`;
}

export function buildPoemmaStorageKeys(userId: PoemmaUserId) {
	const prefix = poemmaStoragePrefix(userId);
	return {
		org: `${prefix}org`,
		periods: `${prefix}periods`,
		strategy: `${prefix}strategy`,
		segments: (orgId: string) => `${prefix}segments:${orgId}`,
		goal: (periodId: string) => `${prefix}goal:${periodId}`,
		review: (periodId: string) => `${prefix}review:${periodId}`,
		finance: (periodId: string) => `${prefix}finance:${periodId}`,
		initiatives: (periodId: string) => `${prefix}initiatives:${periodId}`,
		customerPath: (orgId: string) => `${prefix}customer-path:${orgId}`,
		churn: (periodId: string) => `${prefix}churn:${periodId}`,
		channels: (orgId: string) => `${prefix}channels:${orgId}`,
		promotions: (periodId: string) => `${prefix}promotions:${periodId}`,
		experience: (orgId: string) => `${prefix}experience:${orgId}`,
		happinessSignals: (orgId: string) => `${prefix}happiness-signals:${orgId}`,
		nps: (periodId: string) => `${prefix}nps:${periodId}`,
		orgSettings: (orgId: string) => `${prefix}settings:${orgId}`,
		utmLinks: (orgId: string) => `${prefix}utm:${orgId}`,
		teamTasks: (orgId: string) => `${prefix}teamTasks:${orgId}`,
		migrationDone: `${prefix}migration:legacy-v1`,
	};
}

const LEGACY_KEYS = {
	org: `${LEGACY_PREFIX}org`,
	periods: `${LEGACY_PREFIX}periods`,
	strategy: `${LEGACY_PREFIX}strategy`,
} as const;

function readJson<T>(key: string): T | null {
	const raw = localStorage.getItem(key);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as T;
}

function writeJson<T>(key: string, value: T): void {
	localStorage.setItem(key, JSON.stringify(value));
}

function hasScopedData(
	keys: ReturnType<typeof buildPoemmaStorageKeys>
): boolean {
	return localStorage.getItem(keys.org) !== null;
}

/**
 * One-time move from pre-tenant keys (`poemma:v1:org`) into `poemma:v1:{userId}:`.
 * Skips if legacy org belongs to another ownerUserId.
 */
export function migrateLegacyPoemmaStorageForUser(userId: PoemmaUserId): void {
	const keys = buildPoemmaStorageKeys(userId);
	if (localStorage.getItem(keys.migrationDone) === '1' || hasScopedData(keys)) {
		return;
	}

	const legacyOrg = readJson<PoemmaOrganization & { ownerUserId?: string }>(
		LEGACY_KEYS.org
	);
	if (!legacyOrg) {
		localStorage.setItem(keys.migrationDone, '1');
		return;
	}

	if (legacyOrg.ownerUserId && legacyOrg.ownerUserId !== userId) {
		localStorage.setItem(keys.migrationDone, '1');
		return;
	}

	const orgToSave: PoemmaOrganization = {
		...legacyOrg,
		ownerUserId: userId,
	};

	writeJson(keys.org, orgToSave);

	const legacyPeriods = readJson<unknown[]>(LEGACY_KEYS.periods);
	if (legacyPeriods) {
		writeJson(keys.periods, legacyPeriods);
	}

	const legacyStrategy = readJson<unknown>(`${LEGACY_PREFIX}strategy`);
	if (legacyStrategy) {
		writeJson(keys.strategy, legacyStrategy);
	}

	localStorage.setItem(keys.migrationDone, '1');
}

export interface PoemmaStorageBackupPayload {
	version: typeof POEMMA_STORAGE_VERSION;
	userId: PoemmaUserId;
	exportedAt: string;
	entries: Record<string, unknown>;
}

export type PoemmaStorageBackupImportResult =
	| { ok: true }
	| { ok: false; message: string };

export function listPoemmaStorageKeysForUser(userId: PoemmaUserId): string[] {
	const prefix = poemmaStoragePrefix(userId);
	const keys: string[] = [];
	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (key?.startsWith(prefix)) {
			keys.push(key);
		}
	}
	return keys.sort();
}

export function collectPoemmaStorageBackup(
	userId: PoemmaUserId
): PoemmaStorageBackupPayload {
	const entries: Record<string, unknown> = {};
	for (const key of listPoemmaStorageKeysForUser(userId)) {
		const raw = localStorage.getItem(key);
		if (raw) {
			entries[key] = JSON.parse(raw) as unknown;
		}
	}
	return {
		version: POEMMA_STORAGE_VERSION,
		userId,
		exportedAt: new Date().toISOString(),
		entries,
	};
}

export function validatePoemmaStorageBackup(
	data: unknown,
	expectedUserId: PoemmaUserId
): PoemmaStorageBackupImportResult {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return { ok: false, message: 'Файл не похож на бэкап Poemma' };
	}

	const backup = data as Record<string, unknown>;
	if (backup.version !== POEMMA_STORAGE_VERSION) {
		return { ok: false, message: 'Версия бэкапа не поддерживается' };
	}

	const backupUserId =
		typeof backup.userId === 'string' ? backup.userId.trim() : '';
	if (!backupUserId || backupUserId !== expectedUserId.trim()) {
		return {
			ok: false,
			message: 'Бэкап от другого пользователя — импорт запрещён',
		};
	}

	if (
		!backup.entries ||
		typeof backup.entries !== 'object' ||
		Array.isArray(backup.entries)
	) {
		return { ok: false, message: 'В бэкапе нет данных' };
	}

	const prefix = poemmaStoragePrefix(expectedUserId);
	for (const key of Object.keys(backup.entries as Record<string, unknown>)) {
		if (!key.startsWith(prefix)) {
			return {
				ok: false,
				message: 'Бэкап содержит ключи другого пользователя',
			};
		}
	}

	return { ok: true };
}

export function applyPoemmaStorageBackup(
	data: unknown,
	expectedUserId: PoemmaUserId
): PoemmaStorageBackupImportResult {
	const validation = validatePoemmaStorageBackup(data, expectedUserId);
	if (!validation.ok) {
		return validation;
	}

	const backup = data as PoemmaStorageBackupPayload;
	const prefix = poemmaStoragePrefix(expectedUserId);
	for (const key of listPoemmaStorageKeysForUser(expectedUserId)) {
		localStorage.removeItem(key);
	}

	for (const [key, value] of Object.entries(backup.entries)) {
		if (!key.startsWith(prefix)) {
			continue;
		}
		localStorage.setItem(key, JSON.stringify(value));
	}

	return { ok: true };
}
