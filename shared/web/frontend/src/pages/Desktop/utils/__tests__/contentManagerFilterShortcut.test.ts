import { describe, expect, it } from 'vitest';
import {
	contentManagerFilterSnapshotFromShortcutTarget,
	shortcutTargetFromSavedFilterFields,
} from '../contentManagerFilterShortcut';

describe('contentManagerFilterShortcut', () => {
	it('builds snapshot from shortcut target with only known keys', () => {
		expect(
			contentManagerFilterSnapshotFromShortcutTarget({
				searchQuery: '  x  ',
				filterType: 'pdf',
				extra: 'ignored',
			})
		).toEqual({ searchQuery: 'x', filterType: 'pdf' });
	});

	it('returns undefined when target empty', () => {
		expect(contentManagerFilterSnapshotFromShortcutTarget({})).toBeUndefined();
		expect(
			contentManagerFilterSnapshotFromShortcutTarget({ extra: '  ' })
		).toBeUndefined();
	});

	it('shortcutTargetFromSavedFilterFields omits empty fields', () => {
		expect(
			shortcutTargetFromSavedFilterFields({
				label: 'My filter',
				searchQuery: 'q',
				filterCompanyId: '',
			})
		).toEqual({ searchQuery: 'q' });
	});
});
