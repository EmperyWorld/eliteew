import { describe, expect, it } from 'vitest';
import {
	folderIdBucket,
	getFolderAccentBorderClass,
} from './contentManagerFolderAccent';

describe('folderIdBucket', () => {
	it('returns stable bucket for same id', () => {
		expect(folderIdBucket('folder-a')).toBe(folderIdBucket('folder-a'));
	});

	it('returns value in palette range', () => {
		for (const id of ['x', 'eliteew-proj-abc', '123', 'папка']) {
			const b = folderIdBucket(id);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThan(10);
		}
	});
});

describe('getFolderAccentBorderClass', () => {
	it('uses dedicated class for unfiled', () => {
		expect(getFolderAccentBorderClass(null)).toContain('zinc');
		expect(getFolderAccentBorderClass('')).toContain('zinc');
		expect(getFolderAccentBorderClass('   ')).toContain('zinc');
	});

	it('returns non-zinc accent for real folder ids', () => {
		const c = getFolderAccentBorderClass('some-desktop-folder-id');
		expect(c).toMatch(/border-l-/);
		expect(c).not.toContain('zinc');
	});
});
