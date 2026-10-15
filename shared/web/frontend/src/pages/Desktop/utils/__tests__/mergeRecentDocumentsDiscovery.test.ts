import { describe, expect, it } from 'vitest';
import { mergeRecentDocumentsDiscovery } from '../mergeRecentDocumentsDiscovery';
import type { RecentFile } from '../../types/desktop.types';

function rf(id: string, name = id): RecentFile {
	return {
		id,
		name,
		type: 'document',
		path: `#/c/${id}`,
		openedAt: new Date(),
	};
}

describe('mergeRecentDocumentsDiscovery', () => {
	it('returns empty when maxItems is 0', () => {
		expect(mergeRecentDocumentsDiscovery([rf('a')], [rf('b')], 0)).toEqual([]);
	});

	it('prefers library opened order then fills from shell MRU', () => {
		const lib = [rf('1', 'L1'), rf('2', 'L2')];
		const shell = [rf('3', 'S3'), rf('1', 'dup')];
		expect(
			mergeRecentDocumentsDiscovery(lib, shell, 10).map((x) => x.id)
		).toEqual(['1', '2', '3']);
	});

	it('respects max length', () => {
		const lib = [rf('a'), rf('b')];
		const shell = [rf('c')];
		expect(
			mergeRecentDocumentsDiscovery(lib, shell, 2).map((x) => x.id)
		).toEqual(['a', 'b']);
	});
});
