import { describe, expect, it } from 'vitest';

import { buildUnifiedEditorSavePayload } from './unifiedContentEditorSave';

describe('buildUnifiedEditorSavePayload', () => {
	it('keeps HTML for .html files', () => {
		const html = '<p>a</p><p>b</p>';
		const r = buildUnifiedEditorSavePayload(html, 'doc.html');
		expect(r.mime.startsWith('text/html')).toBe(true);
		expect(r.bytes).toBe(html);
		expect(r.logicalHtml).toBe(html);
	});

	it('writes markdown for .md with newlines between blocks', () => {
		const html = '<h1>Hi</h1><p>Line one.</p><p>Line two.</p>';
		const r = buildUnifiedEditorSavePayload(html, 'note.md');
		expect(r.mime.startsWith('text/markdown')).toBe(true);
		expect(r.bytes).toContain('# Hi');
		expect(r.bytes).toContain('Line one.');
		expect(r.bytes.split('\n').length).toBeGreaterThan(2);
		expect(r.logicalHtml).toBe(html);
	});

	it('uses markdown when API mime is text/markdown even if display name lacks extension', () => {
		const html = '<h1>Hi</h1>';
		const r = buildUnifiedEditorSavePayload(html, 'Заметка', {
			storedMimeType: 'text/markdown',
		});
		expect(r.mime.startsWith('text/markdown')).toBe(true);
		expect(r.bytes).toContain('# Hi');
	});

	it('writes plain text for .txt (paragraph breaks)', () => {
		const html = '<p>Line one.</p><p>Line two.</p>';
		const r = buildUnifiedEditorSavePayload(html, 'notes.txt');
		expect(r.mime.startsWith('text/plain')).toBe(true);
		expect(r.bytes).toContain('Line one.');
		expect(r.bytes).toContain('Line two.');
		expect(r.logicalHtml).toBe(html);
	});

	it('uses plain when API mime is text/plain without .html name', () => {
		const html = '<p>Only</p>';
		const r = buildUnifiedEditorSavePayload(html, 'export', {
			storedMimeType: 'text/plain',
		});
		expect(r.mime.startsWith('text/plain')).toBe(true);
		expect(r.bytes.trim()).toBe('Only');
	});
});
