import { describe, expect, it } from 'vitest';

import {
	isUnifiedOfficeDocumentFormat,
	resolveUnifiedLoadBodyKind,
	resolvedUnifiedContentStorageName,
	unifiedDownloadBodyLooksLikeHtml,
} from './unifiedContentLoadRouting';

describe('unifiedDownloadBodyLooksLikeHtml', () => {
	it('detects HTML fragment', () => {
		expect(unifiedDownloadBodyLooksLikeHtml('<p>a</p>')).toBe(true);
		expect(unifiedDownloadBodyLooksLikeHtml('<h1 style="x">t</h1>')).toBe(true);
	});

	it('does not treat markdown as HTML', () => {
		expect(unifiedDownloadBodyLooksLikeHtml('# Title\n\nHi')).toBe(false);
	});
});

describe('resolvedUnifiedContentStorageName', () => {
	it('prefers original_filename over name', () => {
		expect(
			resolvedUnifiedContentStorageName({
				name: 'Заметка',
				original_filename: 'note.md',
			})
		).toBe('note.md');
	});
});

describe('resolveUnifiedLoadBodyKind', () => {
	it('plain', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{ mime_type: 'text/plain', name: 'x.txt' },
				'hello'
			)
		).toBe('plain_paragraphs');
	});

	it('markdown file by name', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{ content_type: 'document', name: 'r.md' },
				'# A\n\nb'
			)
		).toBe('markdown_to_html');
	});

	it('.md with text/plain mime is markdown not plain_paragraphs', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{
					content_type: 'document',
					mime_type: 'text/plain',
					original_filename: 'ELITEEW-MINI-PREZENTACIYA.md',
				},
				'# Title\n\nParagraph'
			)
		).toBe('markdown_to_html');
	});

	it('.md with HTML body uses html_as_is not plain_paragraphs', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{
					mime_type: 'text/plain',
					original_filename: 'export.md',
				},
				'<h1>Title</h1><p>Body</p>'
			)
		).toBe('html_as_is');
	});

	it('markdown by original_filename when name has no extension', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{
					content_type: 'document',
					name: 'desktop_file_test',
					original_filename: 'desktop_file_test.md',
				},
				'# A\n\nb'
			)
		).toBe('markdown_to_html');
	});

	it('markdown mime', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{ mime_type: 'text/markdown', name: 'x' },
				'# A'
			)
		).toBe('markdown_to_html');
	});

	it('.md with HTML body stays html (Word-style export)', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{ content_type: 'document', name: 'broken.md' },
				'<h1>x</h1><p>y</p>'
			)
		).toBe('html_as_is');
	});

	it('document + html mime', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{ content_type: 'document', mime_type: 'text/html', name: 'd.html' },
				'<p>x</p>'
			)
		).toBe('html_as_is');
	});

	it('.txt by original_filename loads as plain when body is not HTML', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{
					content_type: 'document',
					mime_type: 'text/html',
					name: 'Заметка',
					original_filename: 'notes.txt',
				},
				'hello\nworld'
			)
		).toBe('plain_paragraphs');
	});

	it('docx by mime is office_to_html regardless of binary body', () => {
		expect(
			resolveUnifiedLoadBodyKind(
				{
					content_type: 'document',
					mime_type:
						'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					name: 'Report',
					original_filename: 'report.docx',
				},
				'PK\x03\x04garbage'
			)
		).toBe('office_to_html');
	});

	it('isUnifiedOfficeDocumentFormat detects .doc extension', () => {
		expect(
			isUnifiedOfficeDocumentFormat({
				original_filename: 'legacy.doc',
			})
		).toBe(true);
		expect(
			isUnifiedOfficeDocumentFormat({
				original_filename: 'readme.md',
			})
		).toBe(false);
	});
});
