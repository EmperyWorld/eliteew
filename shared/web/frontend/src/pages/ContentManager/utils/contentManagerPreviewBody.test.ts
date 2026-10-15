import { describe, expect, it } from 'vitest';
import {
	isMarkdownFileName,
	looksLikeHtmlFragment,
	mdFileBodyIsLikelyHtmlExport,
	normalizeTextPreviewNewlines,
	resolveTextPreviewBodyKind,
} from './contentManagerPreviewBody';

describe('looksLikeHtmlFragment', () => {
	it('detects paragraph HTML with styles', () => {
		const s =
			'<p style="text-align: left;">Hello <br><strong>World</strong></p>';
		expect(looksLikeHtmlFragment(s)).toBe(true);
	});

	it('returns false for plain markdown', () => {
		expect(looksLikeHtmlFragment('# Title\n\n- a\n- b')).toBe(false);
	});

	it('returns false for short angle-bracket text', () => {
		expect(looksLikeHtmlFragment('<3')).toBe(false);
	});
});

describe('isMarkdownFileName', () => {
	it('detects .md', () => {
		expect(isMarkdownFileName('foo/bar/README.md')).toBe(true);
	});
	it('returns false for html', () => {
		expect(isMarkdownFileName('x.html')).toBe(false);
	});
});

describe('normalizeTextPreviewNewlines', () => {
	it('normalizes CRLF and lone CR', () => {
		expect(normalizeTextPreviewNewlines('a\r\nb\rc')).toBe('a\nb\nc');
	});
});

describe('mdFileBodyIsLikelyHtmlExport', () => {
	it('detects styled paragraph', () => {
		const s = '<p style="text-align: left;">x</p>';
		expect(mdFileBodyIsLikelyHtmlExport(s)).toBe(true);
	});

	it('false for plain markdown with code angle brackets', () => {
		const s = '# T\n\n`if (a < b && c > d)`\n';
		expect(mdFileBodyIsLikelyHtmlExport(s)).toBe(false);
	});
});

describe('resolveTextPreviewBodyKind', () => {
	it('uses html for Word-style fragment in .md file', () => {
		const html = '<p style="text-align: left;"><strong>x</strong></p>';
		expect(resolveTextPreviewBodyKind(html, 'note.md', 'text/markdown')).toBe(
			'html'
		);
	});

	it('keeps markdown for .md with html-like snippet but not export', () => {
		const s = '<p><strong>x</strong></p>';
		expect(resolveTextPreviewBodyKind(s, 'note.md', 'text/plain')).toBe(
			'markdown'
		);
	});

	it('uses markdown for normal md body', () => {
		expect(
			resolveTextPreviewBodyKind('# Hi\n\nx', 'note.md', 'text/markdown')
		).toBe('markdown');
	});

	it('markdown before generic html heuristic: comparisons in body', () => {
		expect(
			resolveTextPreviewBodyKind(
				'# Doc\n\nУсловие: a < b и c > d.\n',
				'd.md',
				'text/plain'
			)
		).toBe('markdown');
	});
});
