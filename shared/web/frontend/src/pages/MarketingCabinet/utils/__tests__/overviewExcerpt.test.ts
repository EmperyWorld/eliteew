import { describe, expect, it } from 'vitest';

import {
	excerptOverviewPlaintext,
	stripMarkdownNoiseForOverview,
} from '../overviewExcerpt';

describe('stripMarkdownNoiseForOverview', () => {
	it('removes markdown headings', () => {
		expect(stripMarkdownNoiseForOverview('## Hello\nBody')).toBe('Hello\nBody');
	});

	it('trims repeated executive summary labels', () => {
		const s = 'Executive summary\nFoo\nИсполнительное резюме\nBar';
		expect(stripMarkdownNoiseForOverview(s)).toContain('Foo');
		expect(stripMarkdownNoiseForOverview(s)).toContain('Bar');
	});
});

describe('excerptOverviewPlaintext', () => {
	it('truncates long strings', () => {
		const long = 'x'.repeat(300);
		expect(excerptOverviewPlaintext(long, 50).length).toBeLessThanOrEqual(51);
		expect(excerptOverviewPlaintext(long, 50).endsWith('…')).toBe(true);
	});
});
