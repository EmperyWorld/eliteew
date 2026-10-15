import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	buildPoemmaStorageKeys,
	migrateLegacyPoemmaStorageForUser,
	poemmaStoragePrefix,
} from '../poemmaStorage';

const LEGACY_ORG_KEY = 'poemma:v1:org';
const LEGACY_PERIODS_KEY = 'poemma:v1:periods';

describe('poemmaStorage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('builds scoped keys per userId', () => {
		expect(poemmaStoragePrefix('user-a')).toBe('poemma:v1:user-a:');
		const keys = buildPoemmaStorageKeys('user-a');
		expect(keys.org).toBe('poemma:v1:user-a:org');
		expect(keys.periods).toBe('poemma:v1:user-a:periods');
		expect(keys.orgSettings('org-1')).toBe('poemma:v1:user-a:settings:org-1');
		expect(keys.goal('p1')).toBe('poemma:v1:user-a:goal:p1');
		expect(keys.experience('org-1')).toBe('poemma:v1:user-a:experience:org-1');
		expect(keys.happinessSignals('org-1')).toBe(
			'poemma:v1:user-a:happiness-signals:org-1'
		);
		expect(keys.teamTasks('org-1')).toBe('poemma:v1:user-a:teamTasks:org-1');
	});

	it('migrates legacy org into scoped namespace for matching user', () => {
		localStorage.setItem(
			LEGACY_ORG_KEY,
			JSON.stringify({
				id: 'org-1',
				displayName: 'Старый бизнес',
				niche: 'косметика',
				geo: 'Приморье',
				ownerDisplayName: 'Зоя',
				createdAt: '2026-01-01T00:00:00.000Z',
			})
		);
		localStorage.setItem(LEGACY_PERIODS_KEY, JSON.stringify([{ id: 'p1' }]));

		migrateLegacyPoemmaStorageForUser('user-a');

		const keys = buildPoemmaStorageKeys('user-a');
		expect(localStorage.getItem(keys.org)).toContain('user-a');
		expect(localStorage.getItem(keys.org)).toContain('Старый бизнес');
		expect(localStorage.getItem(keys.periods)).toBe(
			JSON.stringify([{ id: 'p1' }])
		);
		expect(localStorage.getItem(keys.migrationDone)).toBe('1');
		expect(localStorage.getItem(LEGACY_ORG_KEY)).not.toBeNull();
	});

	it('does not migrate legacy org owned by another user', () => {
		localStorage.setItem(
			LEGACY_ORG_KEY,
			JSON.stringify({
				id: 'org-2',
				ownerUserId: 'user-b',
				displayName: 'Чужой',
				niche: '',
				geo: '',
				ownerDisplayName: 'B',
				createdAt: '2026-01-01T00:00:00.000Z',
			})
		);

		migrateLegacyPoemmaStorageForUser('user-a');

		const keys = buildPoemmaStorageKeys('user-a');
		expect(localStorage.getItem(keys.org)).toBeNull();
		expect(localStorage.getItem(keys.migrationDone)).toBe('1');
	});

	it('keeps user-a and user-b org data isolated', () => {
		const keysA = buildPoemmaStorageKeys('user-a');
		const keysB = buildPoemmaStorageKeys('user-b');
		localStorage.setItem(
			keysA.org,
			JSON.stringify({ id: 'a', ownerUserId: 'user-a', displayName: 'A' })
		);
		localStorage.setItem(
			keysB.org,
			JSON.stringify({ id: 'b', ownerUserId: 'user-b', displayName: 'B' })
		);

		expect(localStorage.getItem(keysA.org)).toContain('"displayName":"A"');
		expect(localStorage.getItem(keysB.org)).toContain('"displayName":"B"');
	});
});
