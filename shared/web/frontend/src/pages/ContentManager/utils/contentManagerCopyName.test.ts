/**
 * Tests Content Manager copy-name helpers (prefix + batch uniqueness).
 */
import { describe, expect, it } from 'vitest';
import {
	buildCopyNameForItem,
	buildPrefixedCopyName,
	ensureUniqueCopyName,
} from './contentManagerCopyName';

describe('buildPrefixedCopyName', () => {
	it('adds prefix to base name', () => {
		expect(buildPrefixedCopyName('report.pdf', 'Copy of ')).toBe(
			'Copy of report.pdf'
		);
	});

	it('does not double-prefix', () => {
		expect(buildPrefixedCopyName('Copy of report.pdf', 'Copy of ')).toBe(
			'Copy of report.pdf'
		);
	});
});

describe('ensureUniqueCopyName', () => {
	it('returns candidate when unused', () => {
		expect(ensureUniqueCopyName('a.txt', new Set())).toBe('a.txt');
	});

	it('appends numeric suffix before extension', () => {
		const reserved = new Set(['report.pdf']);
		expect(ensureUniqueCopyName('report.pdf', reserved)).toBe('report_2.pdf');
	});

	it('appends numeric suffix without extension', () => {
		const reserved = new Set(['readme']);
		expect(ensureUniqueCopyName('readme', reserved)).toBe('readme_2');
	});
});

describe('buildCopyNameForItem', () => {
	it('uses title when present', () => {
		const name = buildCopyNameForItem(
			{ name: 'slug', title: 'Quarterly plan' },
			'Копия — ',
			new Set()
		);
		expect(name).toBe('Копия — Quarterly plan');
	});
});
