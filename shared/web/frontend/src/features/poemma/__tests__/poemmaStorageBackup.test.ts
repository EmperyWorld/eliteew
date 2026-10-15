import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyPoemmaStorageBackup,
	buildPoemmaStorageKeys,
	collectPoemmaStorageBackup,
	validatePoemmaStorageBackup,
} from '../poemmaStorage';
import { getPoemmaRepository } from '../poemmaRepository';

describe('poemma storage backup', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('exports all scoped keys for userId', async () => {
		const repo = getPoemmaRepository('user-backup');
		await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		const org = await repo.getOrg();
		expect(org).not.toBeNull();
		if (!org) {
			throw new Error('Expected organization after workspace init');
		}
		await repo.saveOrgSettings({
			orgId: org.id,
			experienceBalanceThresholdPercent: 7,
			orgDisplayName: 'Тест',
		});

		const backup = collectPoemmaStorageBackup('user-backup');
		expect(backup.version).toBe('v1');
		expect(backup.userId).toBe('user-backup');
		expect(
			Object.keys(backup.entries).every((key) => key.includes('user-backup'))
		).toBe(true);
		const orgId = org.id;
		expect(
			backup.entries[buildPoemmaStorageKeys('user-backup').orgSettings(orgId)]
		).toEqual({
			orgId,
			experienceBalanceThresholdPercent: 7,
			orgDisplayName: 'Тест',
		});
	});

	it('roundtrips import for same userId', async () => {
		const repoA = getPoemmaRepository('user-roundtrip');
		await repoA.initializeWorkspace({
			displayName: 'До',
			ownerDisplayName: 'Зоя',
		});
		const backup = await repoA.exportStorageBackup();

		localStorage.clear();

		const repoB = getPoemmaRepository('user-roundtrip');
		const result = await repoB.importStorageBackup(backup);
		expect(result).toEqual({ ok: true });

		const org = await repoB.getOrg();
		expect(org?.displayName).toBe('До');
	});

	it('rejects backup from another userId', () => {
		const backup = {
			version: 'v1' as const,
			userId: 'user-other',
			exportedAt: '2026-06-03T00:00:00.000Z',
			entries: {
				'poemma:v1:user-other:org': { id: 'org-1' },
			},
		};

		expect(validatePoemmaStorageBackup(backup, 'user-me')).toEqual({
			ok: false,
			message: 'Бэкап от другого пользователя — импорт запрещён',
		});
		expect(applyPoemmaStorageBackup(backup, 'user-me').ok).toBe(false);
	});

	it('rejects entries with foreign key prefix', async () => {
		const repo = getPoemmaRepository('user-keys');
		await repo.initializeWorkspace({
			displayName: 'Mine',
			ownerDisplayName: 'Z',
		});
		const backup = await repo.exportStorageBackup();
		const tampered = {
			...backup,
			entries: {
				...backup.entries,
				'poemma:v1:user-evil:org': { id: 'evil' },
			},
		};

		expect(validatePoemmaStorageBackup(tampered, 'user-keys')).toEqual({
			ok: false,
			message: 'Бэкап содержит ключи другого пользователя',
		});
	});
});
