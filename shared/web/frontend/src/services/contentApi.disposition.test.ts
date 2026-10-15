import { describe, expect, it } from 'vitest';

import { parseContentDispositionFilename } from './contentApi';

describe('parseContentDispositionFilename', () => {
	it('parses RFC 5987 filename* UTF-8', () => {
		const cd = "attachment; filename*=UTF-8''%D0%9D%D0%BE%D1%82%D0%B0.md";
		expect(parseContentDispositionFilename(cd)).toBe('Нота.md');
	});

	it('parses quoted filename=', () => {
		expect(
			parseContentDispositionFilename('attachment; filename="hello world.txt"')
		).toBe('hello world.txt');
	});

	it('returns undefined when missing', () => {
		expect(parseContentDispositionFilename(undefined)).toBeUndefined();
		expect(parseContentDispositionFilename('inline')).toBeUndefined();
	});
});
