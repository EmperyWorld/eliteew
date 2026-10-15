import { describe, expect, it } from 'vitest';
import { normalizeContentUploadFiles } from './normalizeContentUploadFiles';

describe('normalizeContentUploadFiles', () => {
	it('returns empty array for null/undefined', () => {
		expect(normalizeContentUploadFiles(null)).toEqual([]);
		expect(normalizeContentUploadFiles(undefined)).toEqual([]);
	});

	it('filters out entries without a name', () => {
		const a = new File(['x'], 'a.txt');
		const b = new File(['y'], '');
		expect(normalizeContentUploadFiles([a, b])).toEqual([a]);
	});

	it('accepts FileList-like array', () => {
		const files = [new File(['1'], 'one.md'), new File(['2'], 'two.md')];
		expect(normalizeContentUploadFiles(files)).toHaveLength(2);
	});
});
